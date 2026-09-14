import React, { useEffect, useState } from 'react';
import { api } from '../api';
import StatsSummary from '../components/StatsSummary';

const STATUS_OPTIONS = ['vorgeschlagen', 'platziert', 'gewonnen', 'verloren', 'annulliert'];

function legsSummary(legs) {
  return legs
    .map((l) => `${l.home_team}${l.away_team ? ' - ' + l.away_team : ''}: ${l.outcome_name} @ ${Number(l.odds).toFixed(2)}`)
    .join(' | ');
}

export default function History() {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  async function load() {
    setLoading(true);
    try {
      const data = await api.getBets();
      setBets(data.bets || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleStatusChange(bet, status) {
    let result_profit = bet.result_profit;
    if (status === 'gewonnen') {
      result_profit = Number(((bet.actual_stake || 0) * (bet.combined_odds - 1)).toFixed(2));
    } else if (status === 'verloren') {
      result_profit = -(bet.actual_stake || 0);
    } else if (status === 'annulliert') {
      result_profit = 0;
    }
    await api.updateBet(bet.id, { status, result_profit });
    setRefreshKey((k) => k + 1);
    load();
  }

  async function handleDelete(id) {
    if (!window.confirm('Diese Wette wirklich unwiderruflich löschen?')) return;
    await api.deleteBet(id);
    setRefreshKey((k) => k + 1);
    load();
  }

  return (
    <div>
      <StatsSummary refreshKey={refreshKey} />
      <h3>Wett-Verlauf</h3>
      {loading && <p>Lädt…</p>}
      {!loading && bets.length === 0 && <p>Noch keine Wetten gespeichert.</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Datum</th>
              <th>Wette</th>
              <th>Gesamtquote</th>
              <th>Einsatz</th>
              <th>Konfidenz</th>
              <th>Status</th>
              <th>Profit</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {bets.map((bet) => (
              <tr key={bet.id}>
                <td>{new Date(bet.created_at).toLocaleDateString('de-DE')}</td>
                <td className="bet-desc">
                  {bet.legs.length > 1 && <span className="combo-tag">Kombi ({bet.legs.length})</span>}
                  {legsSummary(bet.legs)}
                  {bet.notes && <div className="notes">📝 {bet.notes}</div>}
                </td>
                <td>{bet.combined_odds?.toFixed(2)}</td>
                <td>{bet.actual_stake}€</td>
                <td>{bet.confidence ?? '–'}</td>
                <td>
                  <select value={bet.status} onChange={(e) => handleStatusChange(bet, e.target.value)}>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={bet.result_profit > 0 ? 'positive' : bet.result_profit < 0 ? 'negative' : ''}>
                  {bet.result_profit != null ? `${bet.result_profit.toFixed(2)}€` : '–'}
                </td>
                <td>
                  <button className="link-btn" onClick={() => handleDelete(bet.id)}>
                    Löschen
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
