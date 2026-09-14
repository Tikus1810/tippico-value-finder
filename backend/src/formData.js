// Tabellenplatz & Form (letzte 5 Spiele) von football-data.org - ergänzt die reine
// Quoten-Analyse um echte Team-Daten. Kostenloser Tarif: 10 Requests/Minute, deckt genau
// die "Big 5"-Ligen ab (nicht die Pokale - die haben kein klassisches Tabellen-Format).
// https://www.football-data.org/

const BASE_URL = 'https://api.football-data.org/v4';
const cache = new Map(); // competitionCode -> { data, expiresAt }
const STANDINGS_CACHE_TTL_MS = 30 * 60 * 1000; // 30 Min. - Tabellen ändern sich nicht minütlich

// Odds-API sport_key -> football-data.org Wettbewerbs-Code. Nur Ligen mit klassischer
// Tabelle (Pokale/K.o.-Wettbewerbe haben kein sinnvolles "Form"-Tabellenformat).
const SPORT_KEY_TO_COMPETITION = {
  soccer_germany_bundesliga: 'BL1',
  soccer_epl: 'PL',
  soccer_spain_la_liga: 'PD',
  soccer_italy_serie_a: 'SA',
  soccer_france_ligue_one: 'FL1',
};

function hasApiKey() {
  return Boolean(process.env.FOOTBALL_DATA_API_KEY);
}

/** Entfernt Vereinszusätze/Akzente, damit Namen von zwei verschiedenen Anbietern matchen. */
function normalizeTeamName(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // Akzente entfernen (München -> Munchen)
    .toLowerCase()
    .replace(/\b(fc|cf|sc|ac|afc|cfc|1\.|club|calcio|de|deportivo)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

async function fetchStandings(competitionCode) {
  const cached = cache.get(competitionCode);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const res = await fetch(`${BASE_URL}/competitions/${competitionCode}/standings`, {
    headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY },
  });
  if (!res.ok) {
    throw new Error(`football-data.org Fehler ${res.status} für ${competitionCode}`);
  }
  const json = await res.json();
  const table = json.standings?.find((s) => s.type === 'TOTAL')?.table || [];
  cache.set(competitionCode, { data: table, expiresAt: Date.now() + STANDINGS_CACHE_TTL_MS });
  return table;
}

function findRow(table, teamName) {
  const target = normalizeTeamName(teamName);
  if (!target) return null;
  // Erst exakte Übereinstimmung nach Normalisierung, sonst "enthält" in beide Richtungen.
  let row = table.find((r) => normalizeTeamName(r.team.name) === target);
  if (!row) row = table.find((r) => normalizeTeamName(r.team.shortName || '') === target);
  if (!row) {
    row = table.find((r) => {
      const n = normalizeTeamName(r.team.name);
      return n.includes(target) || target.includes(n);
    });
  }
  return row || null;
}

/** Punkte aus "form" (z.B. "W,D,L,W,W") - W=3, D=1, L=0, max. 15 bei 5 Siegen. */
function formPoints(formString) {
  if (!formString) return null;
  const results = formString.split(',');
  const points = results.reduce((sum, r) => sum + (r === 'W' ? 3 : r === 'D' ? 1 : 0), 0);
  return { points, games: results.length, raw: formString.replace(/,/g, '') };
}

/**
 * Liefert Tabellenplatz + Form für Heim- und Auswärtsteam eines Spiels, oder null wenn die
 * Liga nicht unterstützt wird, kein API-Key gesetzt ist, oder eines der Teams nicht gefunden wurde.
 */
async function getFormForMatch(sportKey, homeTeam, awayTeam) {
  const competitionCode = SPORT_KEY_TO_COMPETITION[sportKey];
  if (!competitionCode || !hasApiKey()) return null;

  try {
    const table = await fetchStandings(competitionCode);
    const homeRow = findRow(table, homeTeam);
    const awayRow = findRow(table, awayTeam);
    if (!homeRow || !awayRow) return null;

    return {
      home: {
        position: homeRow.position,
        points: homeRow.points,
        played: homeRow.playedGames,
        form: formPoints(homeRow.form),
      },
      away: {
        position: awayRow.position,
        points: awayRow.points,
        played: awayRow.playedGames,
        form: formPoints(awayRow.form),
      },
    };
  } catch (err) {
    console.error('formData Fehler:', err.message);
    return null;
  }
}

module.exports = { getFormForMatch, normalizeTeamName, hasApiKey, SPORT_KEY_TO_COMPETITION };
