import { equipmentScheduledWindow } from '../public/js/equipment-schedule.mjs';
const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };
const active = warning => warning.status !== 'cleared';
export function activeWarningRecordCount(db, userId) {
  return (db.warnings || []).filter(w => w.userId === userId && active(w)).length;
}
export function effectiveWarningCount(db, userId) {
  const stored = Number((db.users || []).find(u => u.id === userId)?.warningCount || 0);
  return Math.max(0, Number.isFinite(stored) ? stored : 0, activeWarningRecordCount(db, userId));
}
function mutateWarning(db, userId, operation) {
  const baseline = effectiveWarningCount(db, userId) - activeWarningRecordCount(db, userId);
  const result = operation();
  const user = (db.users || []).find(u => u.id === userId);
  if (user) user.warningCount = baseline + activeWarningRecordCount(db, userId);
  return result;
}
function iso(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) fail(`${label}은 시간대가 포함된 ISO 시각이어야 합니다.`);
  const date = new Date(value);
  const day = value.slice(0, 10), parsedDay = new Date(`${day}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || !Number.isFinite(parsedDay.getTime()) || parsedDay.toISOString().slice(0,10) !== day) fail(`${label}이 올바르지 않습니다.`);
  return date.toISOString();
}
function nowIso(now = new Date()) {
  const date = new Date(now);
  if (!Number.isFinite(date.getTime())) fail('현재 시각이 올바르지 않습니다.');
  return date.toISOString();
}
export function validateEquipmentActualReturnedAt(reservation, actualReturnedAt, now = new Date()) {
  const actual = iso(actualReturnedAt, '실제 반납 시각');
  if (actual > nowIso(now)) fail('실제 반납 시각은 현재 시각 이후일 수 없습니다.');
  const history = (reservation.history || []).filter(h => h.status === 'checked_out' && h.at).map(h => h.at).filter(at => Number.isFinite(Date.parse(at))).sort((a,b) => Date.parse(b)-Date.parse(a));
  const checkout = reservation.actualCheckedOutAt || history[0];
  if (checkout && Number.isFinite(Date.parse(checkout)) && Date.parse(actual) < Date.parse(checkout)) fail('실제 반납 시각은 실제 대여 시각 이후여야 합니다.');
  return actual;
}
function eligible(db, reservation) {
  if (reservation.type !== 'equipment' || db.settings?.equipmentOverdueWarningsEnabled !== true) return null;
  const enabledAt = Date.parse(db.settings.equipmentOverdueWarningsEnabledAt || '');
  const window = equipmentScheduledWindow(reservation.fields || {});
  if (!Number.isFinite(enabledAt) || !window || Date.parse(window.endAt) < enabledAt) return null;
  return window.endAt;
}
function createWarning(db, reservation, dueAt, now) {
  const warning = { id:`equipment_overdue:${reservation.id}`,userId:reservation.userId,reservationId:reservation.id,source:'equipment_overdue',status:'pending_review',reason:'기자재 미반납 · 관리자 확인 대기',dueAt,detectedAt:now,createdAt:now,equipmentIds:[...new Set(reservation.fields?.equipmentItemIds || [])] };
  db.warnings ||= [];
  mutateWarning(db, reservation.userId, () => db.warnings.push(warning));
  return warning;
}
export function syncEquipmentOverdueWarnings(db, now = new Date()) {
  const timestamp = nowIso(now), createdWarningIds = [];
  for (const reservation of db.reservations || []) {
    if (reservation.status !== 'checked_out') continue;
    const dueAt = eligible(db, reservation);
    if (!dueAt || Date.parse(dueAt) >= Date.parse(timestamp) || (db.warnings || []).some(w => w.id === `equipment_overdue:${reservation.id}`)) continue;
    createdWarningIds.push(createWarning(db,reservation,dueAt,timestamp).id);
  }
  return {changed:createdWarningIds.length > 0,createdWarningIds};
}
// Caller owns custody updates, audit history and atomic persistence.
export function syncEquipmentReturnWarning(db, reservation, {actualReturnedAt, reason = '', adminId = '', now = new Date()} = {}) {
  const actual = validateEquipmentActualReturnedAt(reservation,actualReturnedAt,now), timestamp = nowIso(now);
  let warning = (db.warnings || []).find(w => w.id === `equipment_overdue:${reservation.id}`);
  const dueAt = warning?.dueAt || eligible(db,reservation);
  if (!dueAt) return null;
  const status = Date.parse(actual) > Date.parse(dueAt) ? 'confirmed' : 'cleared';
  if ((status === 'cleared' && warning || actual !== timestamp) && !String(reason).trim()) fail('실제 반납 시각 확인 또는 정정 사유를 입력하세요.');
  if (!warning && status === 'cleared') return null;
  if (!warning) warning = createWarning(db,reservation,dueAt,timestamp);
  return mutateWarning(db,reservation.userId,() => Object.assign(warning,{status,actualReturnedAt:actual,reviewedAt:timestamp,reviewedBy:adminId,reviewReason:String(reason).trim(),reason:status === 'confirmed' ? '기자재 지각 반납' : '정시 반납 확인 · 경고 해제'}));
}
export function reviewEquipmentOverdueWarning(db,{warningId,actualReturnedAt,reason,adminId,now = new Date()}) {
  const warning = (db.warnings || []).find(w => w.id === warningId && w.source === 'equipment_overdue');
  if (!warning) throw Object.assign(new Error('자동 경고를 찾을 수 없습니다.'),{status:404});
  const reservation = (db.reservations || []).find(r => r.id === warning.reservationId);
  if (!reservation || reservation.status !== 'returned') fail('미반납 예약은 반납 점검을 먼저 완료하세요.');
  if (!String(reason || '').trim()) fail('경고 확인 사유를 입력하세요.');
  if (reservation.actualReturnedAt && Date.parse(actualReturnedAt) !== Date.parse(reservation.actualReturnedAt)) fail('기록된 실제 반납 시각 변경은 반납 시각 정정을 사용하세요.');
  return syncEquipmentReturnWarning(db,reservation,{actualReturnedAt,reason,adminId,now});
}
