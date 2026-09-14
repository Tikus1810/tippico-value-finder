import React, { useState } from 'react';

const EMPTY_LEG = { home_team: '', away_team: '', market: '', outcome_name: '', odds: '' };

/**
 * Formular, um eine eigene (bei Tipico bereits platzierte) Wette manuell zu erfassen -
 * inkl. Kombi-Wetten mit beliebig vielen Beinen und freien Markt-Bezeichnungen
 * (z.B. "Über/Unter 2,5 Tore", "Beide Teams treffen", "Torschütze").
 */
export default function ManualBetForm({ onSave }) {
  const [legs, setLegs] = useState([{ ...EMPTY_LEG }]);
  const [stake, setStake] = useState(5);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  function updateLeg(index, field, value) {
    setLegs((prev) => prev.map((leg, i) => (i === index ? { ...leg, [field]: value } : leg)));
  }

  function addLeg() {
    setLegs((prev) => [...prev, { ...EMPTY_LEG }]);
  }

  function removeLeg(index) {
    setLegs((prev) => prev.filter((_, i) => i !== index));
  }

  const combinedOdds = legs.reduce((p, l) => p * (Number(l.odds) || 1), 1);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    const cleanLegs = legs
      .map((l) => ({ ...l, odds: Number(l.odds) }))
      .filter((l) => l.home_team && l.outcome_name && l.odds > 0);

    if (cleanLegs.length === 0) {
      setError('Trag mindestens ein Bein mit Spiel/Ereignis, Auswahl und Quote ein.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        legs: cleanLegs,
        actual_stake: Number(stake),
        status: 'platziert',
        notes: notes || null,
      });
      setLegs([{ ...EMPTY_LEG }]);
      setStake(5);
      setNotes('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="manual-form" onSubmit={handleSubmit}>
      <h4>Eigene Wette erfassen (auch Kombi)</h4>
      <p className="hint">
        Für jede Wette, die du selbst bei Tipico platziert hast - egal ob Einzelwette oder Kombi
        mit mehreren Spielen/Märkten (z.B. "Über/Unter 2,5 Tore", "Beide Teams treffen",
        "Torschütze"). "Auswahl" ist deine getippte Option, "Quote" die Tipico-Quote dafür.
      </p>

      {legs.map((leg, i) => (
        <div className="leg-form-row" key={i}>
          <input
            placeholder="Spiel / Ereignis (z.B. Bayern - Union Berlin)"
            value={leg.home_team}
            onChange={(e) => updateLeg(i, 'home_team', e.target.value)}
          />
          <input
            placeholder="Markt (z.B. Über/Unter 2,5 Tore)"
            value={leg.market}
            onChange={(e) => updateLeg(i, 'market', e.target.value)}
          />
          <input
            placeholder="Auswahl (z.B. Über 2,5)"
            value={leg.outcome_name}
            onChange={(e) => updateLeg(i, 'outcome_name', e.target.value)}
          />
          <input
            type="number"
            step="0.01"
            min="1"
            placeholder="Quote"
            value={leg.odds}
            onChange={(e) => updateLeg(i, 'odds', e.target.value)}
          />
          {legs.length > 1 && (
            <button type="button" className="link-btn" onClick={() => removeLeg(i)}>
              Entfernen
            </button>
          )}
        </div>
      ))}

      <button type="button" onClick={addLeg} className="secondary-btn">
        + Weiteres Bein (Kombi)
      </button>

      <div className="manual-form-footer">
        <label>
          Einsatz (€):
          <input type="number" min="1" step="1" value={stake} onChange={(e) => setStake(e.target.value)} />
        </label>
        <span className="hint">Gesamtquote: {combinedOdds > 1 ? combinedOdds.toFixed(2) : '–'}</span>
        <input
          className="notes-input"
          placeholder="Notiz (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button type="submit" disabled={saving}>
          {saving ? 'Speichert…' : 'Wette speichern'}
        </button>
      </div>

      {error && <div className="banner error">{error}</div>}
      {success && <div className="banner ok">Gespeichert! Siehe Tab "Verlauf".</div>}
    </form>
  );
}
