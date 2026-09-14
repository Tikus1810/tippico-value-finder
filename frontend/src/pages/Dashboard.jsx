import React, { useEffect, useState } from 'react';
import { api } from '../api';
import BetCard from '../components/BetCard';
import ManualBetForm from '../components/ManualBetForm';

// Wandelt eine einzelne Empfehlung (flaches Format von /recommendations) in die
// einheitliche { legs: [...] }-Form um, die BetCard erwartet.
function singleToBetShape(rec) {
  return {
    legs: [
      {
        sport_title: rec.sport_title,
        commence_time: rec.commence_time,
        home_team: rec.home_team,
        away_team: rec.away_team,
        market: rec.market,
        outcome_name: rec.outcome_name,
        odds: rec.tipico_odds,
        fair_prob: rec.fair_prob,
      },
    ],
    combined_odds: rec.tipico_odds,
    combined_fair_prob: rec.fair_prob,
    combined_edge: rec.edge,
    confidence: rec.confidence,
    suggested_stake: rec.suggested_stake,
  };
}

// Heutiges Datum als 'YYYY-MM-DD' im lokalen (Browser-)Zeitzone - für einen Nutzer in
// Deutschland entspricht das Europe/Berlin, passend zur Backend-Berechnung.
function todayLocalISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function Dashboard() {
  const [recs, setRecs] = useState([]);
  const [combos, setCombos] = useState([]);
  const [minEdge, setMinEdge] = useState(0.02);
  const [date, setDate] = useState(todayLocalISO());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [quota, setQuota] = useState(null);
  const [showManualForm, setShowManualForm] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getRecommendations(minEdge, date);
      setRecs(data.recommendations || []);
      setCombos(data.combos || []);
      setWarning(data.warning || null);
      setQuota(data.apiQuota || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function handleSaveBet(bet) {
    await api.createBet(bet);
  }

  return (
    <div>
      <div className="toolbar">
        <label>
          Datum:
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        {date !== todayLocalISO() && (
          <button className="secondary-btn" onClick={() => setDate(todayLocalISO())}>
            Heute
          </button>
        )}
        <label>
          Mindest-Edge:
          <select value={minEdge} onChange={(e) => setMinEdge(Number(e.target.value))}>
            <option value={0}>0% (alles anzeigen)</option>
            <option value={0.02}>2%</option>
            <option value={0.05}>5%</option>
            <option value={0.1}>10%</option>
          </select>
        </label>
        <button onClick={load} disabled={loading}>
          {loading ? 'Lädt…' : 'Aktualisieren'}
        </button>
        <button className="secondary-btn" onClick={() => setShowManualForm((s) => !s)}>
          {showManualForm ? 'Formular schließen' : '+ Eigene Wette erfassen'}
        </button>
        {quota && <span className="quota">API-Kontingent: {quota.remaining ?? '?'} übrig</span>}
      </div>

      {error && <div className="banner error">{error}</div>}
      {warning && <div className="banner warning">{warning}</div>}

      <div className="disclaimer">
        Hinweis: Alle Werte sind statistische Schätzungen auf Basis eines Quotenvergleichs
        (kein garantierter Gewinn). Kombi-Wetten multiplizieren die Buchmacher-Marge mit jedem
        Bein - die Konfidenz wird deshalb pro zusätzlichem Bein bewusst niedriger angesetzt.
        Setz nur Beträge ein, deren Verlust du verkraften kannst.
      </div>

      {showManualForm && <ManualBetForm onSave={handleSaveBet} />}

      {!loading && recs.length === 0 && !warning && (
        <p>Aktuell keine Value-Wetten über der gewählten Mindest-Edge gefunden.</p>
      )}

      {recs.length > 0 && (
        <>
          <h3>Einzel-Empfehlungen</h3>
          <div className="card-list">
            {recs.map((rec, i) => (
              <BetCard key={`single-${i}`} bet={singleToBetShape(rec)} onSave={handleSaveBet} />
            ))}
          </div>
        </>
      )}

      {combos.length > 0 && (
        <>
          <h3>Kombi-Vorschläge</h3>
          <p className="hint">
            Aus den obigen Einzel-Empfehlungen automatisch kombiniert (nur Spiele, die nicht
            miteinander zusammenhängen). Höheres Risiko, daher niedrigere Konfidenz als die
            Einzelwetten.
          </p>
          <div className="card-list">
            {combos.map((combo, i) => (
              <BetCard key={`combo-${i}`} bet={combo} onSave={handleSaveBet} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
