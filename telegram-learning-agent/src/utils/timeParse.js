/**
 * Parse "HH:mm" or "H:mm" into normalized "HH:mm" (24h).
 * @param {string} raw
 * @returns {{ ok: true, value: string } | { ok: false, error: string }}
 */
function parseScheduleTime(raw) {
  const s = String(raw || '').trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) {
    return { ok: false, error: 'Format waktu harus HH:mm (contoh: 07:30 atau 18:05).' };
  }
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isInteger(hh) || !Number.isInteger(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return { ok: false, error: 'Jam tidak valid. Gunakan 00–23 dan menit 00–59.' };
  }
  return {
    ok: true,
    value: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
  };
}

module.exports = { parseScheduleTime };
