import { syncEquipmentOverdueWarnings } from './equipment-overdue.mjs';

export function equipmentOverdueCronPath(cron) {
  if (cron === '* * * * *') return '/api/internal/equipment-overdue';
  if (cron === '0 18 */3 * *') return '/api/internal/cleanup';
  return null;
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
