const express = require('express');
const { client } = require('../db');

const router = express.Router();

async function getLegs(betId) {
  const result = await client.execute({
    sql: 'SELECT * FROM bet_legs WHERE bet_id = ? ORDER BY leg_order',
    args: [betId],
  });
  return result.rows.map((r) => ({ ...r }));
}

async function attachLegs(bet) {
  return { ...bet, legs: await getLegs(bet.id) };
}

async function getBetById(id) {
  const result = await client.execute({ sql: 'SELECT * FROM bets WHERE id = ?', args: [id] });
  return result.rows[0] ? { ...result.rows[0] } : null;
}

function computeCombinedOdds(legs) {
  return legs.reduce((p, l) => p * Number(l.odds), 1);
}

// Wett-Verlauf abrufen (neueste zuerst), inkl. aller Beine je Wette
router.get('/', async (req, res, next) => {
  try {
    const result = await client.execute('SELECT * FROM bets ORDER BY created_at DESC, id DESC');
    const bets = await Promise.all(result.rows.map((r) => attachLegs({ ...r })));
    res.json({ bets });
  } catch (err) {
    next(err);
  }
});

// Eine Wette speichern - ein oder mehrere Beine (Kombi-Wette), z.B. aus einem Empfehlungs-
// Vorschlag übernommen oder manuell für eine eigene Tipico-Kombi eingetragen.
router.post('/', async (req, res, next) => {
  try {
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

    const insertBet = await client.execute({
      sql: `INSERT INTO bets (
              label, combined_odds, combined_fair_prob, combined_edge, confidence,
              suggested_stake, actual_stake, status, notes
            ) VALUES (
              @label, @combined_odds, @combined_fair_prob, @combined_edge, @confidence,
              @suggested_stake, @actual_stake, @status, @notes
            )`,
      args: betPayload,
    });
    const betId = Number(insertBet.lastInsertRowid);

    const legStatements = legs.map((leg, i) => ({
      sql: `INSERT INTO bet_legs (
              bet_id, leg_order, sport_key, sport_title, commence_time, home_team, away_team,
              market, outcome_name, odds, fair_prob
            ) VALUES (
              @bet_id, @leg_order, @sport_key, @sport_title, @commence_time, @home_team, @away_team,
              @market, @outcome_name, @odds, @fair_prob
            )`,
      args: {
        bet_id: betId,
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
      },
    }));
    await client.batch(legStatements, 'write');

    const created = await attachLegs(await getBetById(betId));
    res.status(201).json({ bet: created });
  } catch (err) {
    next(err);
  }
});

// Ergebnis einer Wette nachtragen (gewonnen/verloren/annulliert + Profit)
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await getBetById(id);
    if (!existing) return res.status(404).json({ error: 'Wette nicht gefunden.' });

    const { status, result_profit, actual_stake, notes } = req.body || {};
    await client.execute({
      sql: `UPDATE bets SET
              status = COALESCE(@status, status),
              result_profit = COALESCE(@result_profit, result_profit),
              actual_stake = COALESCE(@actual_stake, actual_stake),
              notes = COALESCE(@notes, notes)
            WHERE id = @id`,
      args: {
        status: status ?? null,
        result_profit: result_profit ?? null,
        actual_stake: actual_stake ?? null,
        notes: notes ?? null,
        id,
      },
    });

    const updated = await attachLegs(await getBetById(id));
    res.json({ bet: updated });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    // Kein Verlass auf FK-CASCADE über den Remote-Client - Beine explizit mitlöschen.
    await client.batch(
      [
        { sql: 'DELETE FROM bet_legs WHERE bet_id = ?', args: [req.params.id] },
        { sql: 'DELETE FROM bets WHERE id = ?', args: [req.params.id] },
      ],
      'write'
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
