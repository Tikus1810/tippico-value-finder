import React, { useEffect, useState } from 'react';
import { api } from '../api';

export default function StatsSummary({ refreshKey }) {
  const [stats, setStats] = useState(null);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');

  function reload() {
    api.getStats().then(setStats).catch(() => {});
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  async function saveBudget() {
    await api.setWeeklyBudget(Number(budgetInput) || 0);
    setEditingBudget(false);
    reload();
  }

  if (!stats) return null;

  const fmtPct = (x) => (x == null ? '–' : `${(x * 100).toFixed(1)}%`);
  const budget = stats.weeklyBudget || 0;
  const staked = stats.weeklyStaked || 0;
  const budgetPct = budget > 0 ? Math.min(100, (staked / budget) * 100) : 0;
  const overBudget = budget > 0 && staked > budget;

  return (
    <>
      <div className="stats-grid">
        <div className="stat">
          <span className="stat-label">Wetten (abgeschlossen)</span>
          <span className="stat-value">{stats.totalBets}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Trefferquote</span>
          <span className="stat-value">{fmtPct(stats.hitRate)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">ROI</span>
          <span className={`stat-value ${stats.roi > 0 ? 'positive' : stats.roi < 0 ? 'negative' : ''}`}>
            {fmtPct(stats.roi)}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Gewinn/Verlust</span>
          <span className={`stat-value ${stats.totalProfit > 0 ? 'positive' : stats.totalProfit < 0 ? 'negative' : ''}`}>
            {stats.totalProfit.toFixed(2)}€
          </span>
        </div>
      </div>

      <div className="budget-box">
        {editingBudget ? (
          <>
            <label>
              Wochen-Budget (€):
              <input
                type="number"
                min="0"
                step="5"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                autoFocus
              />
            </label>
            <button onClick={saveBudget}>Speichern</button>
            <button className="secondary-btn" onClick={() => setEditingBudget(false)}>
              Abbrechen
            </button>
          </>
        ) : budget > 0 ? (
          <>
            <div className="budget-row">
              <span>
                Diese Woche verplant: <strong>{staked.toFixed(2)}€</strong> / {budget.toFixed(2)}€
              </span>
              <button
                className="link-btn"
                onClick={() => {
                  setBudgetInput(String(budget));
                  setEditingBudget(true);
                }}
              >
                ändern
              </button>
            </div>
            <div className="budget-bar">
              <div
                className={`budget-bar-fill ${overBudget ? 'over' : ''}`}
                style={{ width: `${budgetPct}%` }}
              />
            </div>
            {overBudget && (
              <div className="banner warning">
                Du hast dein Wochen-Budget um {(staked - budget).toFixed(2)}€ überschritten.
              </div>
            )}
          </>
        ) : (
          <button
            className="secondary-btn"
            onClick={() => {
              setBudgetInput('50');
              setEditingBudget(true);
            }}
          >
            + Wochen-Budget festlegen
          </button>
        )}
      </div>
    </>
  );
}
