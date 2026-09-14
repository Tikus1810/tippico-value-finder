const express = require('express');
const { db, getSetting, setSetting } = require('../db');
const { currentWeekBoundsUtc } = require('../dateUtils');

const router = express.Router();

// Wochen-Budget setzen/abfragen (rein informativ, blockiert nichts - siehe README).
router.get('/budget', (req, res) => {
  const weeklyBudget = Number(getSetting('weekly_budget', '0'));
  res.json({ weeklyBudget });
});

router.put('/budget', (req, res) => {
  const { weeklyBudget } = req.body || {};
  const value = Number(weeklyBudget);
  if (!Number.isFinite(value) || value < 0) {
    return res.status(400).json({ error: 'weeklyBudget muss eine Zahl >= 0 sein.' });
  }
  setSetting('weekly_budget', String(value));
  res.json({ weeklyBudget: value });
});

router.get('/', (req, res) => {
  const settled = db
    .prepare("SELECT * FROM bets WHERE status IN ('gewonnen', 'verloren') ")
    .all();

  // Alle diese Woche tatsächlich platzierten Einsätze (unabhängig vom Ausgang),
  // um sie gegen das Wochen-Budget zu stellen.
  const { startUtc } = currentWeekBoundsUtc();
  const weekRows = db
    .prepare(
      `SELECT actual_stake FROM bets
       WHERE status IN ('platziert', 'gewonnen', 'verloren')
         AND actual_stake IS NOT NULL
         AND created_at >= ?`
    )
    .all(startUtc.toISOString().slice(0, 19).replace('T', ' '));
  const weeklyStaked = weekRows.reduce((sum, r) => sum + (r.actual_stake || 0), 0);
  const weeklyBudget = Number(getSetting('weekly_budget', '0'));

  const totalBets = settled.length;
  const wins = settled.filter((b) => b.status === 'gewonnen').length;
  const totalStaked = settled.reduce((sum, b) => sum + (b.actual_stake || 0), 0);
  const totalProfit = settled.reduce((sum, b) => sum + (b.result_profit || 0), 0);
  const hitRate = totalBets ? wins / totalBets : null;
  const roi = totalStaked ? totalProfit / totalStaked : null;

  // Performance nach Konfidenz-Bucket, um zu prüfen ob höhere Konfidenz wirklich besser trifft
  const buckets = [
    { label: '0-40', min: 0, max: 40 },
    { label: '41-70', min: 41, max: 70 },
    { label: '71-100', min: 71, max: 100 },
  ].map((bucket) => {
    const inBucket = settled.filter((b) => b.confidence >= bucket.min && b.confidence <= bucket.max);
    const bucketWins = inBucket.filter((b) => b.status === 'gewonnen').length;
    return {
      ...bucket,
      count: inBucket.length,
      hitRate: inBucket.length ? bucketWins / inBucket.length : null,
      profit: inBucket.reduce((sum, b) => sum + (b.result_profit || 0), 0),
    };
  });

  res.json({
    totalBets,
    wins,
    losses: totalBets - wins,
    totalStaked: Number(totalStaked.toFixed(2)),
    totalProfit: Number(totalProfit.toFixed(2)),
    hitRate,
    roi,
    confidenceBuckets: buckets,
    weeklyStaked: Number(weeklyStaked.toFixed(2)),
    weeklyBudget,
  });
});

module.exports = router;
