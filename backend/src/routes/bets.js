const express = require('express');
const { db, runInTransaction } = require('../db');

const router = express.Router();

const insertBetStmt = db.prepare(`
  INSERT INTO bets (
    label, combined_odds, combined_fair_prob, combined_edge, confidence,
    suggested_stake, actual_stake, status, notes
  ) VALUES (
    @label, @combined_odds, @combined_fair_prob, @combined_edge, @confidence,
    @suggested_stake, @actual_stake, @status, @notes
  )
`);
const insertLegStmt = db.prepare(`
  INSERT INTO bet_legs (
    bet_id, leg_order, sport_key, sport_title, commence_time, home_team, away_team,
    market, outcome_name, odds, fair_prob
  ) VALUES (
    @bet_id, @leg_order, @sport_key, @sport_title, @commence_time, @home_team, @away_team,
    @market, @outcome_name, @odds, @fair_prob
  )
`);
const getLegsStmt = db.prepare('SELECT * FROM bet_legs WHERE bet_id = ? ORDER BY leg_order');

function attachLegs(bet) {
  return { ...bet, legs: getLegsStmt.all(bet.id) };
}

function computeCombinedOdds(legs) {
  return legs.reduce((p, l) => p * Number(l.odds), 1);
}

// Wett-Verlauf abrufen (neueste zuerst), inkl. aller Beine je Wette
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM bets ORDER BY created_at DESC, id DESC').all();
  res.json({ bets: rows.map(attachLegs) });
});

// Eine Wette speichern - ein oder mehrere Beine (Kombi-Wette), z.B. aus einem Empfehlungs-
// Vorschlag übernommen oder manuell für eine eigene Tipico-Kombi eingetragen.
router.post('/', (req, res) => {
  const b = req.body || {};
  const legs = Array.isArray(b.legs) ? b.legs : null;
  if (!legs || legs.length === 0) {
    return res.status(400).json({ error: 'legs (Array mit mindestens einem Bein) ist Pflicht.' });
  }
  for (const leg of legs) {
    // away_team ist optional, damit auch Märkte ohne zwei Teams (z.B. Torschützen-Wetten)
    // erfasst werden können.
    if (!leg.home_team || !leg.outcome_name || !leg.odds) {
      return res.status(400).json({ error: 'Jedes Bein braucht mindestens home_team, outcome_name und odds.' });
    }
  }

  const combinedOdds = b.combined_odds ?? computeCombinedOdds(legs);
  const combinedFairProb =
    b.combined_fair_prob ?? (legs.every((l) => l.fair_prob != null)
      ? legs.reduce((p, l) => p * Number(l.fair_prob), 1)
      : null);
  const combinedEdge =
    b.combined_edge ?? (combinedFairProb != null ? combinedFairProb * combinedOdds - 1 : null);

  const betPayload = {
    label: b.label ?? (legs.length > 1 ? `Kombi (${legs.length} Spiele)` : null),
    combined_odds: combinedOdds,
    combined_fair_prob: combinedFairProb,
    combined_edge: combinedEdge,
    confidence: b.confidence ?? null,
    suggested_stake: b.suggested_stake ?? null,
    actual_stake: b.actual_stake ?? b.suggested_stake ?? null,
    status: b.status ?? 'platziert',
    notes: b.notes ?? null,
  };

  const betId = runInTransaction(() => {
    const info = insertBetStmt.run(betPayload);
    const id = info.lastInsertRowid;
    legs.forEach((leg, i) => {
      insertLegStmt.run({
        bet_id: id,
        leg_order: i,
        sport_key: leg.sport_key ?? null,
        sport_title: leg.sport_title ?? null,
        commence_time: leg.commence_time ?? null,
        home_team: leg.home_team,
        away_team: leg.away_team ?? null,
        market: leg.market ?? null,
        outcome_name: leg.outcome_name,
        odds: leg.odds,
        fair_prob: leg.fair_prob ?? null,
      });
    });
    return id;
  });
  const created = attachLegs(db.prepare('SELECT * FROM bets WHERE id = ?').get(betId));
  res.status(201).json({ bet: created });
});

// Ergebnis einer Wette nachtragen (gewonnen/verloren/annulliert + Profit)
router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM bets WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Wette nicht gefunden.' });

  const { status, result_profit, actual_stake, notes } = req.body || {};
  db.prepare(
    `UPDATE bets SET
      status = COALESCE(?, status),
      result_profit = COALESCE(?, result_profit),
      actual_stake = COALESCE(?, actual_stake),
      notes = COALESCE(?, notes)
     WHERE id = ?`
  ).run(status ?? null, result_profit ?? null, actual_stake ?? null, notes ?? null, id);

  const updated = attachLegs(db.prepare('SELECT * FROM bets WHERE id = ?').get(id));
  res.json({ bet: updated });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM bets WHERE id = ?').run(req.params.id); // bet_legs kaskadiert per FK
  res.status(204).end();
});

module.exports = router;
