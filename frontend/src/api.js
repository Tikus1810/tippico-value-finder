// Basis-URL des Backends. Im Dev-Betrieb übernimmt der Vite-Proxy /api -> localhost:4000.
// Für den Zugriff vom Handy im selben WLAN: VITE_API_BASE_URL beim Build/Start auf
// http://<PC-IP-Adresse>:4000 setzen (siehe README).
const BASE = import.meta.env.VITE_API_BASE_URL || '';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Anfrage fehlgeschlagen (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  health: () => request('/health'),
  getSports: () => request('/sports'),
  saveSportSelection: (sportKeys) =>
    request('/sports/selection', { method: 'POST', body: JSON.stringify({ sportKeys }) }),
  getRecommendations: (minEdge, date, minProb) =>
    request(
      `/recommendations?minEdge=${minEdge}${date ? `&date=${date}` : ''}${
        minProb != null ? `&minProb=${minProb}` : ''
      }`
    ),
  getBets: () => request('/bets'),
  createBet: (bet) => request('/bets', { method: 'POST', body: JSON.stringify(bet) }),
  updateBet: (id, patch) => request(`/bets/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteBet: (id) => request(`/bets/${id}`, { method: 'DELETE' }),
  getStats: () => request('/stats'),
  getWeeklyBudget: () => request('/stats/budget'),
  setWeeklyBudget: (weeklyBudget) =>
    request('/stats/budget', { method: 'PUT', body: JSON.stringify({ weeklyBudget }) }),
};
