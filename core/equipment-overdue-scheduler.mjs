import { syncEquipmentOverdueWarnings } from './equipment-overdue.mjs';

export function equipmentOverdueCronPath(cron) {
  if (cron === '* * * * *') return '/api/internal/equipment-overdue';
  if (cron === '0 18 */3 * *') return '/api/internal/cleanup';
  return null;
}

// A deployment may enable this once after health checks. An administrator's
// later disable remains effective because the activation marker is persisted.
export function applyEquipmentOverdueActivation(db, activationAt, now = new Date()) {
  const activation = Date.parse(activationAt || '');
  const timestamp = new Date(now);
  if (!Number.isFinite(activation) || activation > timestamp.getTime()) return false;
  if (Object.hasOwn(db.meta || {}, 'equipmentOverdueActivationApplied') || db.settings?.equipmentOverdueWarningsEnabledAt) return false;
  db.settings ||= {};
  db.meta ||= {};
  db.settings.equipmentOverdueWarningsEnabled = true;
  db.settings.equipmentOverdueWarningsEnabledAt ||= timestamp.toISOString();
  db.meta.equipmentOverdueActivationApplied = activationAt;
  return true;
}

// The database owner serializes this with requests and persists the result.
export function runEquipmentOverdueSweep(db, now = new Date()) {
  const timestamp = new Date(now).toISOString();
  const summary = syncEquipmentOverdueWarnings(db, now);
  db.meta ||= {};
  db.meta.equipmentOverdueSweep = {
    lastRunAt: timestamp,
    lastSuccessAt: timestamp,
    status: 'ok',
    createdCount: summary.createdWarningIds.length
  };
  return { ...summary, changed: true, createdCount: summary.createdWarningIds.length };
}
