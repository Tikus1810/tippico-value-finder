import React, { useEffect, useState } from 'react';
import { api } from '../api';

export default function Settings() {
  const [sports, setSports] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSports();
      setSports(data.sports || []);
      setSelected(new Set(data.sports.filter((s) => s.selected).map((s) => s.key)));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function toggle(key) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      await api.saveSportSelection(Array.from(selected));
    } finally {
      setSaving(false);
    }
  }

  // Deutsche Länder-/Begriffs-Synonyme, damit z.B. "England" oder "Spanien" auch Ligen findet,
// deren Titel nur englisch ist (z.B. "EPL" für die Premier League).
const SYNONYMS = {
  england: ['epl', 'efl', 'premier', 'championship', 'english'],
  englisch: ['epl', 'efl', 'premier', 'english'],
  spanien: ['spain', 'la liga'],
  frankreich: ['france', 'ligue'],
  italien: ['italy', 'serie'],
  niederlande: ['netherlands', 'eredivisie', 'dutch'],
  holland: ['netherlands', 'eredivisie', 'dutch'],
  schottland: ['scotland', 'premiership', 'spl'],
  schweiz: ['switzerland'],
  österreich: ['austria'],
  griechenland: ['greece'],
  türkei: ['turkey'],
  russland: ['russia'],
  belgien: ['belgium'],
  dänemark: ['denmark'],
  schweden: ['sweden'],
  norwegen: ['norway'],
  polen: ['poland'],
  korea: ['korea'],
  mexiko: ['mexico'],
  brasilien: ['brazil'],
  argentinien: ['argentina'],
  irland: ['ireland'],
  usa: ['usa', 'mls'],
};

function matchesFilter(sport, rawFilter) {
  const q = rawFilter.trim().toLowerCase();
  if (!q) return true;
  const haystack = `${sport.title} ${sport.description} ${sport.key}`.toLowerCase();
  if (haystack.includes(q)) return true;
  const synonyms = SYNONYMS[q];
  return synonyms ? synonyms.some((kw) => haystack.includes(kw)) : false;
}

const visible = sports.filter((s) => matchesFilter(s, filter));

  return (
    <div>
      <h3>Ligen-Auswahl</h3>
      <p className="hint">
        Wähle die Fußball-Ligen (auch kleinere/unscheinbarere), die im Dashboard nach Value-Wetten
        durchsucht werden sollen. Mehr Ligen = mehr API-Anfragen = schneller aufgebrauchtes Kontingent.
      </p>
      {error && <div className="banner error">{error}</div>}
      {loading && <p>Lädt Ligen…</p>}

      <input
        className="filter-input"
        placeholder="Liga suchen…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      <div className="league-list">
        {visible.map((s) => (
          <label key={s.key} className="league-item">
            <input type="checkbox" checked={selected.has(s.key)} onChange={() => toggle(s.key)} />
            {s.title}
          </label>
        ))}
      </div>

      <button onClick={save} disabled={saving}>
        {saving ? 'Speichert…' : `Auswahl speichern (${selected.size} Ligen)`}
      </button>
    </div>
  );
}
