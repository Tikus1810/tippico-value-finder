import React, { useState } from 'react';

function formatForm(formInfo) {
  if (!formInfo) return null;
  const home = formInfo.home;
  const away = formInfo.away;
  return `${home.position}. Platz (${home.form?.raw ?? '–'}) vs ${away.position}. Platz (${away.form?.raw ?? '–'})`;
}

function formatKickoff(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/**
 * Zeigt eine Wette an - egal ob Einzelwette (1 Bein) oder Kombi-Wette (mehrere Beine).
 * Erwartet die vereinheitlichte Form: { legs: [...], combined_odds, combined_fair_prob,
 * combined_edge, confidence, suggested_stake }.
 */
export default function BetCard({ bet, onSave }) {
  const [saving, setSaving] = useState(false);
  const [stake, setStake] = useState(bet.suggested_stake || 1);
  const [saved, setSaved] = useState(false);

  const isCombo = bet.legs.length > 1;

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({ ...bet, actual_stake: stake, status: 'platziert' });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  const edgePct = bet.combined_edge != null ? (bet.combined_edge * 100).toFixed(1) : null;
  const probPct = bet.combined_fair_prob != null ? (bet.combined_fair_prob * 100).toFixed(0) : null;

  return (
    <div className="card">
      {isCombo && <div className="combo-badge">Kombi · {bet.legs.length} Spiele</div>}
      <div className="legs">
        {bet.legs.map((leg, i) => (
          <div className="leg" key={i}>
            <div className="card-header">
              <span className="league">{leg.sport_title || ''}</span>
              <span className="kickoff">{formatKickoff(leg.commence_time)}</span>
            </div>
            <div className="matchup">
              {leg.home_team}
              {leg.away_team ? (
                <>
                  {' '}
                  <span className="vs">vs</span> {leg.away_team}
                </>
              ) : null}
            </div>
            <div className="pick-row">
              <div className="pick">
                {leg.market ? <span className="market-label">{leg.market}: </span> : null}
                <strong>{leg.outcome_name}</strong>
              </div>
              <div className="odds">
                Quote: <strong>{Number(leg.odds ?? leg.tipico_odds).toFixed(2)}</strong>
              </div>
            </div>
            {leg.form && <div className="form-line">📊 {formatForm(leg.form)}</div>}
          </div>
        ))}
      </div>

      <div className="metrics">
        {probPct != null && (
          <div className="metric">
            <span className="metric-label">Geschätzte Wahrsch.</span>
            <span className="metric-value">{probPct}%</span>
          </div>
        )}
        {edgePct != null && (
          <div className="metric">
            <span className="metric-label">Edge (Erwartungswert)</span>
            <span className={`metric-value ${bet.combined_edge > 0 ? 'positive' : ''}`}>+{edgePct}%</span>
          </div>
        )}
        <div className="metric">
          <span className="metric-label">Konfidenz</span>
          <span className="metric-value">{bet.confidence ?? '–'}/100</span>
        </div>
        <div className="metric">
          <span className="metric-label">Gesamtquote</span>
          <span className="metric-value">{Number(bet.combined_odds).toFixed(2)}</span>
        </div>
      </div>

      <div className="stake-row">
        <label>
          Einsatz (€):
          <input
            type="number"
            min="1"
            max="10"
            value={stake}
            onChange={(e) => setStake(Number(e.target.value))}
          />
        </label>
        <button disabled={saving || saved} onClick={handleSave}>
          {saved ? '✓ Im Verlauf gespeichert' : saving ? 'Speichert…' : 'Als platziert vormerken'}
        </button>
      </div>
    </div>
  );
}
