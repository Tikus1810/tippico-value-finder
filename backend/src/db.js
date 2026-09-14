// Nutzt Node's eingebautes SQLite-Modul (node:sqlite) statt eines externen nativen Addons
// (better-sqlite3), weil dessen vorkompilierte Binärdatei auf diesem Rechner mit der
// installierten Node-Version abstürzte (native Assertion beim Aufräumen von Statements).
// node:sqlite ist Teil von Node selbst und hat daher immer eine passende ABI.
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, '..', 'data.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS bets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    label TEXT,
    combined_odds REAL,
    combined_fair_prob REAL,
    combined_edge REAL,
    confidence REAL,
    suggested_stake REAL,
    actual_stake REAL,
    status TEXT NOT NULL DEFAULT 'vorgeschlagen', -- vorgeschlagen | platziert | gewonnen | verloren | annulliert
    result_profit REAL,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS bet_legs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bet_id INTEGER NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
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
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

/** Führt fn innerhalb einer SQLite-Transaktion aus (node:sqlite hat kein eingebautes db.transaction()). */
function runInTransaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

function setSetting(key, value) {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, value);
}

module.exports = { db, getSetting, setSetting, runInTransaction };
