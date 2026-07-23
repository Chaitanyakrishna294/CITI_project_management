/**
 * Recency check shared by "new record" beacons.
 *
 * Postgres emits "2026-07-23 18:47:18+05:30"; the T-swap keeps Safari's
 * Date parser happy. A small negative tolerance stops a client clock that
 * lags the server from hiding a row created moments ago.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

export function isNew(createdAt, hours = 24) {
  if (!createdAt) return false;
  const t = new Date(String(createdAt).replace(' ', 'T')).getTime();
  if (Number.isNaN(t)) return false;
  const age = Date.now() - t;
  return age >= -5 * 60 * 1000 && age <= hours * (DAY_MS / 24);
}
