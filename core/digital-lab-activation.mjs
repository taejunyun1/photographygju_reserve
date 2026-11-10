// Explicit deployment opt-in, consumed once. The caller must serialize and persist
// settings + marker before exposing the result; failed saves discard its cache.
export function applyDigitalLabActivation(db, activationAt, now = new Date()) {
  if (typeof activationAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(activationAt)) return false;
  const activation = Date.parse(activationAt);
  const timestamp = new Date(now).getTime();
  if (!Number.isFinite(activation) || !Number.isFinite(timestamp) || activation > timestamp) return false;
  const canonical = activationAt.includes('.') ? activationAt : activationAt.replace('Z', '.000Z');
  if (new Date(activation).toISOString() !== canonical) return false;
  if (Object.hasOwn(db.meta || {}, 'digitalLabActivationApplied')) return false;
  db.settings ||= {};
  db.meta ||= {};
  db.settings.digitalLabEnabled = true;
  db.settings.digitalLabOpenTime = '00:00';
  db.settings.digitalLabCloseTime = '24:00';
  db.meta.digitalLabActivationApplied = activationAt;
  return true;
}
