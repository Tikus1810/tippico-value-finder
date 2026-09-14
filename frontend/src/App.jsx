import React, { useEffect, useState } from 'react';
import { api } from './api';
import Dashboard from './pages/Dashboard';
import History from './pages/History';
import Settings from './pages/Settings';

const TABS = [
  { key: 'dashboard', label: 'Empfehlungen' },
  { key: 'history', label: 'Verlauf' },
  { key: 'settings', label: 'Einstellungen' },
];

export default function App() {
  const [tab, setTab] = useState('dashboard');
  const [health, setHealth] = useState(null);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth({ ok: false }));
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>⚽ Value Finder</h1>
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={tab === t.key ? 'tab active' : 'tab'}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      {health && !health.hasApiKey && (
        <div className="banner warning">
          Kein Odds-API-Key konfiguriert. Trag deinen kostenlosen Key von{' '}
          <a href="https://the-odds-api.com/" target="_blank" rel="noreferrer">
            the-odds-api.com
          </a>{' '}
          in <code>backend/.env</code> ein und starte das Backend neu.
        </div>
      )}

      <main>
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'history' && <History />}
        {tab === 'settings' && <Settings />}
      </main>
    </div>
  );
}
