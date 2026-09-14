// Kernlogik: "faire" Wahrscheinlichkeit aus mehreren Buchmacher-Quoten schätzen (Vergleichsmarkt),
// dann prüfen ob Tipicos eigene Quote dafür einen positiven Erwartungswert (Value) bietet.
//
// WICHTIG (siehe README): Das ist eine heuristische Schätzung auf Basis des Marktkonsens,
// KEINE garantierte Gewinnwahrscheinlichkeit. Buchmacher-Quoten sind im Schnitt sehr effizient.

const TIPICO_KEY = process.env.TIPICO_BOOKMAKER_KEY || 'tipico_de';

/** Entfernt die Marge (Overround) eines Buchmachers proportional und gibt faire Wahrscheinlichkeiten zurück. */
function devigOutcomes(outcomes) {
  const raw = outcomes.map((o) => ({ name: o.name, implied: 1 / o.price, price: o.price }));
  const overround = raw.reduce((sum, o) => sum + o.implied, 0);
  return raw.map((o) => ({ name: o.name, fairProb: o.implied / overround, price: o.price }));
}

function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = mean(arr.map((x) => (x - m) ** 2));
  return Math.sqrt(variance);
}

/**
 * Konfidenz-Score (0-100), rein heuristisch, kombiniert:
 *  - Höhe des Edge (Erwartungswert)
 *  - Geschätzte Gewinn-Wahrscheinlichkeit selbst (ein hoher Edge bei einer 7%-Außenseiter-Quote
 *    ist statistisch "Value", fühlt sich aber nicht nach einer Wette an, die man realistisch
 *    gewinnt - deshalb fließt die reine Wahrscheinlichkeit hier bewusst mit ein)
 *  - Anzahl der Vergleichs-Buchmacher (mehr = robuster)
 *  - Einigkeit zwischen den Buchmachern (geringe Streuung = mehr Vertrauen)
 */
function computeConfidence({ edge, fairProb, numBooks, agreement }) {
  const edgeScore = clamp(edge / 0.15, 0, 1) * 35; // 15%+ Edge = volle Punktzahl
  const probScore = clamp(fairProb / 0.5, 0, 1) * 25; // 50%+ Gewinnwahrsch. = volle Punktzahl
  const bookScore = clamp(numBooks / 6, 0, 1) * 20; // 6+ Vergleichs-Buchmacher = volle Punktzahl
  const agreementScore = clamp(agreement, 0, 1) * 20;
  return Math.round(edgeScore + probScore + bookScore + agreementScore);
}

function clamp(x, min, max) {
  return Math.max(min, Math.min(max, x));
}

/** Konfidenz (0-100) -> Einsatzvorschlag in Euro, 1-10€, linear skaliert. */
function stakeFromConfidence(confidence) {
  return Math.round(1 + (clamp(confidence, 0, 100) / 100) * 9);
}

/**
 * Analysiert ein einzelnes Event (h2h-Markt) und gibt für jeden Ausgang, bei dem Tipico
 * eine im Vergleich zu günstige (= für uns vorteilhafte) Quote bietet, eine Empfehlung zurück.
 */
function analyzeEvent(event, { minEdge = 0.02, minProb = 0.3, minBooks = 2 } = {}) {
  const tipico = event.bookmakers?.find((b) => b.key === TIPICO_KEY);
  const tipicoMarket = tipico?.markets?.find((m) => m.key === 'h2h');
  if (!tipicoMarket) return [];

  const otherBooks = event.bookmakers.filter((b) => b.key !== TIPICO_KEY);
  const fairProbsByOutcome = new Map(); // outcomeName -> [fairProb, ...]

  for (const book of otherBooks) {
    const market = book.markets?.find((m) => m.key === 'h2h');
    if (!market || market.outcomes.length < 2) continue;
    const devigged = devigOutcomes(market.outcomes);
    for (const o of devigged) {
      if (!fairProbsByOutcome.has(o.name)) fairProbsByOutcome.set(o.name, []);
      fairProbsByOutcome.get(o.name).push(o.fairProb);
    }
  }

  const recommendations = [];
  for (const outcome of tipicoMarket.outcomes) {
    const comparisons = fairProbsByOutcome.get(outcome.name) || [];
    if (comparisons.length < minBooks) continue; // zu wenig Vergleichsdaten, überspringen

    const fairProb = mean(comparisons);
    const sd = stddev(comparisons);
    const agreement = 1 - clamp(sd / 0.1, 0, 1); // Streuung >=10%-Punkte -> Agreement 0

    const edge = fairProb * outcome.price - 1; // Erwartungswert pro gesetztem Euro
    if (edge < minEdge) continue;
    if (fairProb < minProb) continue; // zu unwahrscheinlich, um "realistisch" zu sein

    const confidence = computeConfidence({ edge, fairProb, numBooks: comparisons.length, agreement });

    recommendations.push({
      sport_key: event.sport_key,
      sport_title: event.sport_title,
      commence_time: event.commence_time,
      home_team: event.home_team,
      away_team: event.away_team,
      market: 'h2h',
      outcome_name: outcome.name,
      tipico_odds: outcome.price,
      fair_prob: Number(fairProb.toFixed(4)),
      edge: Number(edge.toFixed(4)),
      confidence,
      num_books: comparisons.length,
      suggested_stake: stakeFromConfidence(confidence),
    });
  }

  return recommendations.sort((a, b) => b.confidence - a.confidence || b.edge - a.edge);
}

function matchId(rec) {
  return `${rec.sport_key}|${rec.commence_time}|${rec.home_team}|${rec.away_team}`;
}

/** Alle Kombinationen der Größe k aus arr (ohne Wiederholung, Reihenfolge egal). */
function combinations(arr, k) {
  const results = [];
  function go(start, chosen) {
    if (chosen.length === k) {
      results.push([...chosen]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      chosen.push(arr[i]);
      go(i + 1, chosen);
      chosen.pop();
    }
  }
  go(0, []);
  return results;
}

/**
 * Baut Kombi-Wett-Vorschläge aus mehreren Einzel-Value-Wetten unterschiedlicher Spiele.
 * WICHTIG: Jedes zusätzliche Bein multipliziert die Buchmacher-Marge mit - Kombis sind
 * praktisch immer ein schlechterer Erwartungswert-Deal als die Einzelwetten für sich genommen.
 * Die Konfidenz wird deshalb bewusst mit einem Risikoabschlag pro zusätzlichem Bein versehen.
 */
function buildComboSuggestions(
  recommendations,
  { legSizes = [2, 3], poolSize = 8, maxResults = 8, minCombinedProb = 0.15 } = {}
) {
  // Nur ein Vorschlag pro Spiel zulassen (der mit der höchsten Konfidenz), damit Kombis
  // nicht zwei Ausgänge desselben (korrelierten) Spiels mischen.
  const byMatch = new Map();
  for (const rec of recommendations) {
    const id = matchId(rec);
    const existing = byMatch.get(id);
    if (!existing || rec.confidence > existing.confidence) byMatch.set(id, rec);
  }
  const pool = Array.from(byMatch.values())
    .sort((a, b) => b.confidence - a.confidence || b.edge - a.edge)
    .slice(0, poolSize);

  const combos = [];
  for (const size of legSizes) {
    if (pool.length < size) continue;
    for (const legs of combinations(pool, size)) {
      const combinedOdds = legs.reduce((p, l) => p * l.tipico_odds, 1);
      const combinedFairProb = legs.reduce((p, l) => p * l.fair_prob, 1);
      if (combinedFairProb < minCombinedProb) continue; // zu unwahrscheinlich als Kombi
      const combinedEdge = combinedFairProb * combinedOdds - 1;
      const avgConfidence = mean(legs.map((l) => l.confidence));
      const riskPenalty = (legs.length - 1) * 10; // pro zusätzlichem Bein 10 Punkte Abschlag
      const confidence = Math.round(clamp(avgConfidence - riskPenalty, 0, 100));

      combos.push({
        legs: legs.map((l) => ({
          sport_key: l.sport_key,
          sport_title: l.sport_title,
          commence_time: l.commence_time,
          home_team: l.home_team,
          away_team: l.away_team,
          market: l.market,
          outcome_name: l.outcome_name,
          odds: l.tipico_odds,
          fair_prob: l.fair_prob,
        })),
        combined_odds: Number(combinedOdds.toFixed(2)),
        combined_fair_prob: Number(combinedFairProb.toFixed(4)),
        combined_edge: Number(combinedEdge.toFixed(4)),
        confidence,
        suggested_stake: stakeFromConfidence(confidence),
      });
    }
  }

  return combos.sort((a, b) => b.confidence - a.confidence || b.combined_edge - a.combined_edge).slice(0, maxResults);
}

module.exports = {
  analyzeEvent,
  devigOutcomes,
  computeConfidence,
  stakeFromConfidence,
  buildComboSuggestions,
  TIPICO_KEY,
};
