import assert from 'node:assert/strict';
import { initialDb, handleApiRequest } from '../core.mjs';
import { syncEquipmentOverdueWarnings } from '../core/equipment-overdue.mjs';

const db = await initialDb('return-anytime-test');
const admin = db.users.find(user => user.role === 'admin');
const equipment = db.equipment.find(item => item.active && item.reservable && item.status === '가능');
db.sessions.push({id:'return-admin-session',token:'return-admin',userId:admin.id,expiresAt:'2099-12-31T00:00:00Z'});
db.settings.equipmentOverdueWarningsEnabled = true;
db.settings.equipmentOverdueWarningsEnabledAt = '2026-10-01T00:00:00.000Z';
let now, saves = 0, failSave = false;
const api = (method, pathname, body) => handleApiRequest({
  method, pathname, authorization:'Bearer return-admin', readText:async()=>JSON.stringify(body), db, now,
  saveDb:async()=>{if(failSave)throw new Error('save failed');saves++;}, slackWebhook:''
});
const payload = {inspections:[{equipmentId:equipment.id,outcome:'normal',note:''}]};

for (const [label, time, late] of [
  ['early', '2026-10-13T02:00:00.123Z', false],
  ['on-time', '2026-10-13T08:10:00.000Z', false],
  ['late', '2026-10-13T08:10:00.001Z', true],
  ['next-day', '2026-10-14T14:00:00.000Z', true]
]) {
  now = time;
  const reservation = {
    id:`return-${label}`, userId:admin.id, type:'equipment', status:'checked_out',
    actualCheckedOutAt:'2026-10-13T01:15:00.000Z', history:[],
    fields:{reservedDate:'2026-10-13',period:'당일',rentalTime:'10:15',returnTime:'17:10',equipmentItemIds:[equipment.id]}
  };
  db.reservations.push(reservation);
  syncEquipmentOverdueWarnings(db, now);
  const endpoint = `/api/admin/reservations/${reservation.id}/return-inspection`;
  const result = await api('POST', endpoint, payload);
  assert.equal(result.status, 200, `${label}: ${result.body.error || ''}`);
  assert.equal(reservation.status, 'returned');
  assert.equal(reservation.actualReturnedAt, now);
  assert.equal(reservation.returnProcessedAt, now);
  assert.equal(reservation.returnProcessedBy, admin.id);
  assert.equal(equipment.status, '가능');
  assert.equal(db.equipmentInspections.filter(item=>item.reservationId===reservation.id).length, 1);
  const warnings = db.warnings.filter(item=>item.reservationId===reservation.id);
  assert.equal(warnings.length, late ? 1 : 0);
  if(late) assert.equal(warnings[0].status, 'confirmed');

  const beforeRetry = structuredClone(db), saved = saves;
  now = new Date(Date.parse(now) + 60_000).toISOString();
  assert.equal((await api('POST', endpoint, payload)).status, 200);
  assert.equal(saves, saved);
  assert.deepEqual(db, beforeRetry, 'retry must preserve the first timestamp and not duplicate warnings or inspections');
  if(late) {
    const correction = {actualReturnedAt:'2026-10-13T08:10:00.000Z',reason:'정시 반납 확인, 관리자 처리 지연'};
    assert.equal((await api('PATCH', `/api/admin/reservations/${reservation.id}/return-time`, correction)).status, 200);
    assert.equal(reservation.actualReturnedAt, correction.actualReturnedAt);
    assert.equal(reservation.returnProcessedAt, time);
    assert.equal(warnings[0].status, 'cleared');
  }
}

const previous = db.reservations.find(item=>item.id==='return-early');
const invalid = {...structuredClone(previous),id:'return-invalid',status:'checked_out'};
db.reservations.push(invalid);
now = '2026-10-15T08:00:00.000Z';
const endpoint = `/api/admin/reservations/${invalid.id}/return-inspection`;
for (const actualReturnedAt of ['not-a-time', '2026-10-16T00:00:00.000Z', '2026-10-13T01:00:00.000Z']) {
  assert.equal((await api('POST', endpoint, {...payload,actualReturnedAt,reason:'수동 기록'})).status, 400);
  assert.equal(invalid.status, 'checked_out');
}
failSave = true;
const snapshot = structuredClone(db);
assert.equal((await api('POST', endpoint, payload)).status, 500);
assert.deepEqual(db, snapshot, 'failed save must roll back custody, inventory, warnings and inspection history');
console.log('Equipment returns: early, exact deadline, late, overnight, legacy payload, retry, correction and rollback passed.');
