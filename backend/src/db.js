// Datenbank-Client: @libsql/client (SQLite-kompatibel).
// - Lokal (kein DATABASE_URL gesetzt): schreibt in eine lokale Datei, genau wie vorher -
//   kein Turso-Account nötig für die Entwicklung.
// - Produktion (Render): DATABASE_URL/DATABASE_AUTH_TOKEN zeigen auf eine Turso-Cloud-DB,
//   die unabhängig vom (ephemeren) Render-Dateisystem persistent bleibt.
const { createClient } = require('@libsql/client');
const path = require('path');

const client = createClient({
  url: process.env.DATABASE_URL || `file:${path.join(__dirname, '..', 'data.db')}`,
  authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
});

async function init() {
  await client.batch(
    [
      `CREATE TABLE IF NOT EXISTS bets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        label TEXT,
        combined_odds REAL,
        combined_fair_prob REAL,
        combined_edge REAL,
        confidence REAL,
        suggested_stake REAL,
        actual_stake REAL,
        status TEXT NOT NULL DEFAULT 'vorgeschlagen',
        result_profit REAL,
        notes TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS bet_legs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bet_id INTEGER NOT NULL,
        leg_order INTEGER NOT NULL DEFAULT 0,
        sport_key TEXT,
        sport_title TEXT,
        commence_time TEXT,
        home_team TEXT,
        away_team TEXT,
        market TEXT,
        outcome_name TEXT,
        odds REAL NOT NULL,
        fair_prob REAL
      )`,
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )`,
    ],
    'write'
  );
}

async function getSetting(key, fallback = null) {
  const result = await client.execute({ sql: 'SELECT value FROM settings WHERE key = ?', args: [key] });
  return result.rows[0] ? result.rows[0].value : fallback;
}

async function setSetting(key, value) {
  await client.execute({
    sql: 'INSERT INTO settings (key, value) VALUES (@key, @value) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    args: { key, value },
  });
}

module.exports = { client, init, getSetting, setSetting };
