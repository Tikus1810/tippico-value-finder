const express = require('express');
const { getOddsForSport } = require('../oddsApi');
const { analyzeEvent, buildComboSuggestions, TIPICO_KEY } = require('../valueCalc');
const { getSetting } = require('../db');
const { todayBerlinDateString, berlinDayBoundsUtc } = require('../dateUtils');

const router = express.Router();

// Bookmaker-Keys verifiziert gegen die EU-Region-Liste von The Odds API
// (https://the-odds-api.com/sports-odds-data/bookmaker-apis.html). "pinnacle" gilt in der
// Branche als besonders scharfer/"sharper" Buchmacher und ist daher ein guter Referenzpunkt.
const COMPARISON_BOOKMAKERS = [
  TIPICO_KEY,
  'pinnacle',
  'betsson',
  'onexbet',
  'marathonbet',
  'williamhill',
  'matchbook',
  'winamax_de',
];

router.get('/', async (req, res, next) => {
  try {
    const minEdge = Number(req.query.minEdge ?? 0.02);
    const minProb = Number(req.query.minProb ?? 0.3);
    const requestedDate = req.query.date || todayBerlinDateString();
    const { startUtc, endUtc } = berlinDayBoundsUtc(requestedDate);
    const selectedRaw = await getSetting('selected_sport_keys', '[]');
    const selectedSports = JSON.parse(selectedRaw);

    if (!selectedSports.length) {
      return res.json({
        recommendations: [],
        warning: 'Keine Ligen ausgewählt. Wähle unter Einstellungen mindestens eine Liga aus.',
      });
    }

    const results = [];
    const errors = [];
    let quota = null;

    for (const sportKey of selectedSports) {
      try {
        const { data: events, remaining, used } = await getOddsForSport(sportKey, {
          bookmakers: COMPARISON_BOOKMAKERS,
          commenceTimeFrom: startUtc.toISOString().replace(/\.\d+Z$/, 'Z'),
          commenceTimeTo: endUtc.toISOString().replace(/\.\d+Z$/, 'Z'),
        });
        quota = { remaining, used };
        for (const event of events) {
          const recs = analyzeEvent(event, { minEdge, minProb });
          results.push(...recs);
        }
      } catch (err) {
        errors.push({ sportKey, message: err.message });
      }
    }

    results.sort((a, b) => b.confidence - a.confidence || b.edge - a.edge);
    const combos = buildComboSuggestions(results);

    res.json({ recommendations: results, combos, apiQuota: quota, errors, date: requestedDate });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
