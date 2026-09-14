require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { init: initDb } = require('./db');
const sportsRouter = require('./routes/sports');
const recommendationsRouter = require('./routes/recommendations');
const betsRouter = require('./routes/bets');
const statsRouter = require('./routes/stats');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, hasApiKey: Boolean(process.env.ODDS_API_KEY && process.env.ODDS_API_KEY !== 'dein_api_key_hier') });
});

app.use('/api/sports', sportsRouter);
app.use('/api/recommendations', recommendationsRouter);
app.use('/api/bets', betsRouter);
app.use('/api/stats', statsRouter);

// Falls ein Frontend-Build vorhanden ist (Produktion/Hosting), wird er direkt mit ausgeliefert -
// dann läuft alles über einen einzigen Service/eine einzige URL (kein separater Frontend-Host,
// kein CORS-Ärger). Im lokalen Dev-Betrieb (Vite auf Port 5173) existiert der Ordner nicht,
// dann greift einfach nichts davon.
const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Zentrale Fehlerbehandlung
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Interner Serverfehler' });
});

const PORT = process.env.PORT || 4000;

// Datenbank-Schema erst sicherstellen, dann Server starten (Turso-Verbindung ist asynchron).
initDb()
  .then(() => {
    // 0.0.0.0 binden, damit auch dein Handy im gleichen WLAN den Server erreichen kann
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Backend läuft auf http://0.0.0.0:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Datenbank-Initialisierung fehlgeschlagen:', err);
    process.exit(1);
  });
