const PERIOD_DAYS = new Map([["당일", 0], ["1박2일", 1], ["2박3일", 2], ["주말사용", 2]]);
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function dateStart(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) return null;
  return timestamp;
}

function timeMinutes(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? hour * 60 + minute : null;
}

/** Calculate scheduled equipment use in KST; malformed fields have no valid window. */
export function equipmentScheduledWindow(fields) {
  if (!fields || typeof fields !== "object") return null;
  const date = dateStart(fields.reservedDate);
  const days = PERIOD_DAYS.get(fields.period);
  const rental = timeMinutes(fields.rentalTime);
  const returned = timeMinutes(fields.returnTime);
  if (date === null || days === undefined || rental === null || returned === null) return null;
  const start = date + rental * 60000 - KST_OFFSET_MS;
  const end = date + days * 86400000 + returned * 60000 - KST_OFFSET_MS;
  if (end <= start) return null;
  return { startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString() };
}

function windowBounds(window) {
  if (!window || typeof window.startAt !== "string" || typeof window.endAt !== "string") return null;
  const start = Date.parse(window.startAt);
  const end = Date.parse(window.endAt);
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? { start, end } : null;
}

/** Half-open intervals allow the next rental to start exactly at scheduled return. */
export function equipmentWindowsOverlap(left, right) {
  const a = windowBounds(left);
  const b = windowBounds(right);
  return Boolean(a && b && a.start < b.end && b.start < a.end);
}
