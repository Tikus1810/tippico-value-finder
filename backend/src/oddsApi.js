// Dünner Client für The Odds API (https://the-odds-api.com/liveapi/guides/v4/)
// Cached Antworten kurz im Speicher, damit das begrenzte Kontingent (Free Tier: 500 req/Monat)
// nicht bei jedem Dashboard-Reload verbrannt wird.

const BASE_URL = 'https://api.the-odds-api.com/v4';
const cache = new Map(); // key -> { expiresAt, data }

function getCacheTtlMs() {
  const seconds = Number(process.env.CACHE_TTL_SECONDS || 300);
  return seconds * 1000;
}

async function cachedFetch(url) {
  const cached = cache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return { data: cached.data, fromCache: true, remaining: cached.remaining, used: cached.used };
  }

  const res = await fetch(url);
  const remaining = res.headers.get('x-requests-remaining');
  const used = res.headers.get('x-requests-used');

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`The Odds API Fehler ${res.status}: ${body || res.statusText}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  cache.set(url, { data, expiresAt: Date.now() + getCacheTtlMs(), remaining, used });
  return { data, fromCache: false, remaining, used };
}

function requireApiKey() {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey || apiKey === 'dein_api_key_hier') {
    const err = new Error(
      'Kein ODDS_API_KEY gesetzt. Trag deinen kostenlosen Key von https://the-odds-api.com/ in backend/.env ein.'
    );
    err.status = 400;
    throw err;
  }
  return apiKey;
}

/** Alle verfügbaren Sportarten holen, optional nur eine Gruppe (z. B. "Soccer"). */
async function listSports({ group } = {}) {
  const apiKey = requireApiKey();
  const url = `${BASE_URL}/sports/?apiKey=${apiKey}`;
  const { data, ...meta } = await cachedFetch(url);
  const filtered = group ? data.filter((s) => s.group === group) : data;
  return { sports: filtered, ...meta };
}

/**
 * Quoten für eine Sportart/Liga holen (Markt: h2h = Sieg/Unentschieden/Niederlage).
 * bookmakers: kommagetrennte Liste von Bookmaker-Keys, inkl. Tipico + Vergleichs-Buchmacher.
 */
async function getOddsForSport(
  sportKey,
  { region, bookmakers, markets = 'h2h', commenceTimeFrom, commenceTimeTo } = {}
) {
  const apiKey = requireApiKey();
  const params = new URLSearchParams({
    apiKey,
    markets,
    oddsFormat: 'decimal',
    dateFormat: 'iso',
  });
  if (bookmakers && bookmakers.length) {
    params.set('bookmakers', bookmakers.join(','));
  } else {
    params.set('regions', region || 'eu');
  }
  if (commenceTimeFrom) params.set('commenceTimeFrom', commenceTimeFrom);
  if (commenceTimeTo) params.set('commenceTimeTo', commenceTimeTo);
  const url = `${BASE_URL}/sports/${encodeURIComponent(sportKey)}/odds/?${params.toString()}`;
  return cachedFetch(url);
}

module.exports = { listSports, getOddsForSport };
