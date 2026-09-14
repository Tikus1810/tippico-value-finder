// Zeitzone-sichere Tagesgrenzen für Europe/Berlin (berücksichtigt Sommer-/Winterzeit),
// ohne externe Abhängigkeit (nutzt Node's eingebautes Intl/ICU).

function getBerlinOffsetMinutes(date) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(date).reduce((acc, p) => {
    if (p.type !== 'literal') acc[p.type] = Number(p.value);
    return acc;
  }, {});
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute, parts.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** Heutiges Datum in Europe/Berlin als 'YYYY-MM-DD'. */
function todayBerlinDateString() {
  const dtf = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }); // en-CA -> YYYY-MM-DD
  return dtf.format(new Date());
}

/** UTC-Start-/End-Zeitpunkt für einen ganzen Kalendertag in Europe/Berlin ('YYYY-MM-DD'). */
function berlinDayBoundsUtc(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const guessUtc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const offsetMin = getBerlinOffsetMinutes(guessUtc);
  const startUtc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - offsetMin * 60000);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000 - 1000);
  return { startUtc, endUtc };
}

/** UTC-Start-/Ende der aktuellen Woche (Montag-Sonntag) in Europe/Berlin, für's Wochen-Budget. */
function currentWeekBoundsUtc() {
  const todayStr = todayBerlinDateString();
  const [y, m, d] = todayStr.split('-').map(Number);
  const localNoon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)); // Mittag, um DST-Kanten zu vermeiden
  const isoWeekday = ((localNoon.getUTCDay() + 6) % 7) + 1; // Mo=1 ... So=7
  const mondayLocal = new Date(localNoon);
  mondayLocal.setUTCDate(localNoon.getUTCDate() - (isoWeekday - 1));
  const mondayStr = mondayLocal.toISOString().slice(0, 10);
  const { startUtc } = berlinDayBoundsUtc(mondayStr);
  return { startUtc, endUtc: new Date() };
}

module.exports = { todayBerlinDateString, berlinDayBoundsUtc, currentWeekBoundsUtc };
