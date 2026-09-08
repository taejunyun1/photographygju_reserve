import assert from 'node:assert/strict';
import { handleApiRequest, initialDb } from '../core.mjs';

const db = await initialDb('count-consistency-test-password');
const now = new Date();
const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(now);
db.sessions.push({ id: 'count-session', token: 'count-token', userId: 'user_admin', expiresAt: '2099-12-31T00:00:00Z', createdAt: now.toISOString(), lastSeenAt: now.toISOString() });
const api = async (pathname) => {
  const response = await handleApiRequest({ method: 'GET', pathname, authorization: 'Bearer count-token', readText: async () => '{}', db, saveDb: async () => {}, slackWebhook: '' });
  assert.equal(response.status, 200, pathname);
  return response.body.data;
};
const booking = (id, status, date = today) => ({ id, type: 'equipment', status, userId: 'user_admin', fields: { reservedDate: date, period: '당일', rentalTime: '10:15', returnTime: '17:00', equipmentItemIds: [] }, createdAt: now.toISOString(), history: [] });
db.reservations = Array.from({ length: 105 }, (_, i) => booking(`approved-${i}`, 'approved'));
db.reservations.push(booking('admin-cancel', 'admin_cancelled'), booking('future-cancel', 'cancelled', '2099-12-01'));
db.reports = [
  { id: 'submitted', type: 'studio', userId: 'user_admin', reservationId: 'approved-0', submittedAt: now.toISOString(), fields: {} },
  { id: 'legacy-reviewed', type: 'studio', userId: 'user_admin', reservationId: 'approved-1', submittedAt: now.toISOString(), fields: { status: 'reviewed' } }
];
const summary = await api('/api/admin/summary');
for (const [key, status] of [['equipmentPendingApproval', 'pending_approval'], ['equipmentApproved', 'approved'], ['equipmentCheckedOut', 'checked_out']]) {
  const list = await api(`/api/admin/reservations?type=equipment&status=${status}&pageSize=7`);
  assert.equal(summary[key], list.total, `${key} must equal the matching list total`);
  assert.ok(list.items.length <= 7);
}
const first = await api('/api/admin/reservations?type=equipment&status=approved&pageSize=7');
const last = await api('/api/admin/reservations?type=equipment&status=approved&pageSize=7&page=15');
assert.equal(first.total, 105);
assert.equal(last.total, first.total);
assert.equal(last.hasMore, false);
const dailyCancelled = await api(`/api/admin/reservations?type=equipment&status=cancelled_or_rejected&from=${today}&to=${today}&pageSize=1`);
assert.equal(summary.equipmentCancelled, dailyCancelled.total);
assert.equal(dailyCancelled.total, 1, 'include admin cancellation, exclude other scheduled days');
const submitted = await api('/api/admin/reports?status=submitted&pageSize=1');
assert.equal(summary.metrics.reportQueueCount, submitted.total, 'report queue uses same legacy status fallback as list');
assert.equal(submitted.total, 1);
const creationCancelled = await api(`/api/admin/reservations?status=cancelled_or_rejected&dateBasis=created&from=${today}&to=${today}&pageSize=1`);
assert.equal(summary.metrics.insights.cancellationRate.cancelledRequests, creationCancelled.total, 'cancellation insight and click destination use request date');
assert.equal(creationCancelled.total, 2);
const activeSlot = await api(`/api/admin/reservations?status=operational&time=10%3A15&from=${today}&to=${today}&pageSize=1`);
assert.equal(summary.metrics.insights.congestion.items[0].count, activeSlot.total);
assert.equal(activeSlot.total, 105, 'popular-time details exclude cancelled requests');
const noPartialTime = await api('/api/admin/reservations?time=10%3A1&pageSize=1');
assert.equal(noPartialTime.total, 0, 'time filter must not match partial slot text');
db.users.push(...Array.from({ length: 105 }, (_, i) => ({ id: `pending-${i}`, role: 'student', approvalStatus: 'approval_pending', name: `학생 ${i}`, studentId: `S${i}` })));
const users = await api('/api/admin/users?role=student&status=approval_pending&pageSize=2');
const userSummary = await api('/api/admin/summary');
assert.equal(users.total, userSummary.pendingUsers);
assert.equal(users.items.length, 2);
db.lectures = Array.from({ length: 105 }, (_, i) => ({ id: `lecture-${i}`, title: `특강 ${i}`, status: '모집중', lectureDate: today, baseApplicationCount: i === 0 ? 2 : 0 }));
db.lectureApplications = [{ id: 'application', lectureId: 'lecture-0', userId: 'user_admin' }];
const lectures = await api('/api/admin/lectures?pageSize=2');
assert.equal(lectures.total, 105);
assert.equal(lectures.items.length, 2);
assert.equal(lectures.items.find((item) => item.id === 'lecture-0').applicationCount, 3, 'lecture total includes external base count plus actual applications');
const lectureSummary = await api('/api/admin/summary');
assert.equal(lectureSummary.metrics.openLectures, lectures.total);
console.log('Count consistency: paginated totals, dashboard destinations, report queue and insight date/status filters passed.');
