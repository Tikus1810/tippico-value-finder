const express = require('express');
const { listSports } = require('../oddsApi');
const { getSetting, setSetting } = require('../db');

const router = express.Router();

// Alle Fußball-Ligen/Sportarten auflisten, die The Odds API aktuell anbietet
// (inkl. unscheinbarer/kleinerer Ligen - hier wird nichts vorgefiltert).
router.get('/', async (req, res, next) => {
  try {
    const { sports, remaining, used } = await listSports({ group: 'Soccer' });
    const selectedRaw = await getSetting('selected_sport_keys', '[]');
    const selected = new Set(JSON.parse(selectedRaw));

    res.json({
      sports: sports
        .filter((s) => s.active)
        .map((s) => ({
          key: s.key,
          title: s.title,
          description: s.description,
          selected: selected.has(s.key),
        })),
      apiQuota: { remaining, used },
    });
  } catch (err) {
    next(err);
  }
});

// Ausgewählte Ligen speichern (die dann im Dashboard analysiert werden)
router.post('/selection', async (req, res, next) => {
  try {
    const { sportKeys } = req.body;
    if (!Array.isArray(sportKeys)) {
      return res.status(400).json({ error: 'sportKeys muss ein Array von Sport-Keys sein.' });
    }
    await setSetting('selected_sport_keys', JSON.stringify(sportKeys));
    res.json({ ok: true, sportKeys });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
