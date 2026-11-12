import assert from "node:assert/strict";
import { handleApiRequest, initialDb, normalizeDb } from "../core.mjs";

let db = await initialDb("fixture-password");
const admin = db.users[0];
const student = { ...admin, id: "notice-student", role: "student", username: "notice-student", approvalStatus: "approved" };
const other = { ...student, id: "notice-other" };
db.users.push(student, other);
for (const user of [admin, student, other]) db.sessions.push({ id: user.id, token: user.id, userId: user.id, createdAt: new Date().toISOString(), expiresAt: "2099-01-01T00:00:00.000Z" });
db.notices = [
  { id: "notice-one", title: "첫 공지", body: "본문", active: true, createdAt: "2026-11-10" },
  { id: "notice-two", title: "새 공지", body: "새 본문", active: true, createdAt: "2026-11-12" },
  { id: "notice-hidden", title: "숨긴 공지", body: "비공개", active: false }
];
let saves = 0;
let failSave = false;
async function request(method, pathname, user = student, body = {}) {
  return handleApiRequest({ method, pathname, authorization: user ? `Bearer ${user.id}` : "", readText: async () => JSON.stringify(body), db, saveDb: async () => { if (failSave) throw new Error("injected write failure"); saves++; } });
}
assert.equal((await request("GET", "/api/me/notices", null)).status, 401);
assert.equal((await request("GET", "/api/me/notices", admin)).status, 403);
const initial = await request("GET", "/api/me/notices");
assert.equal(initial.status, 200);
assert.deepEqual(initial.body.data.notices.map(n => n.id), ["notice-one", "notice-two"]);
assert.deepEqual(initial.body.data.readNoticeIds, []);
assert.equal((await request("POST", "/api/me/notices/notice-hidden/read")).status, 404);
assert.equal((await request("POST", "/api/me/notices/missing/read")).status, 404);
const read = await request("POST", "/api/me/notices/notice-two/read", student, { userId: other.id });
assert.equal(read.status, 200);
assert.deepEqual(read.body.data.readNoticeIds, ["notice-two"]);
const writesAfterRead = saves;
await request("POST", "/api/me/notices/notice-two/read");
assert.equal(saves, writesAfterRead, "repeat reads are idempotent");
assert.deepEqual((await request("GET", "/api/me/notices", other)).body.data.readNoticeIds, [], "read history belongs to the authenticated account");
assert.deepEqual((await request("GET", "/api/bootstrap")).body.data.readNoticeIds, ["notice-two"]);
assert.deepEqual((await request("GET", "/api/bootstrap", null)).body.data.readNoticeIds, []);
assert.equal((await request("GET", "/api/me")).body.data.user.noticeReadIds, undefined, "generic public user projections must not expose reading history");
db = normalizeDb(structuredClone(db));
assert.deepEqual((await request("GET", "/api/me/notices")).body.data.readNoticeIds, ["notice-two"], "read state survives persistence and normalization");
failSave = true;
assert.equal((await request("POST", "/api/me/notices/notice-one/read")).status, 500);
assert.deepEqual((await request("GET", "/api/me/notices")).body.data.readNoticeIds, ["notice-two"], "failed writes do not record a read");
console.log("Notice API: persistence, privacy, authentication, hidden notices, idempotence and rollback passed.");

const { createNoticeReader, createStudentNoticeRefresher } = await import("../public/js/notice-announcements.js");
const state = { token: "session-a", user: { id: "a", role: "student" }, bootstrap: { noticeReaderId: "a", notices: [{ id: "n", title: "공지" }], readNoticeIds: [] }, view: "home" };
let resolveRead;
const opened = createNoticeReader({ state, render() {}, toast() {}, api: () => new Promise(resolve => { resolveRead = resolve; }) });
const readPending = opened("n");
assert.equal(state.view, "notices");
assert.equal(state.activeNoticeId, "n", "opening the toast immediately displays its actual notice");
resolveRead({ readerId: "a", readNoticeIds: ["n"] });
await readPending;
assert.deepEqual(state.bootstrap.readNoticeIds, ["n"]);
const duplicate = opened("n");
await duplicate;
const stale = opened("n2");
await stale;
state.bootstrap.notices.push({ id: "new", title: "새 공지" });
const oldSessionRead = opened("new");
state.user = { id: "b", role: "student" };
state.token = "session-b";
state.bootstrap = { noticeReaderId: "b", notices: [], readNoticeIds: [] };
resolveRead({ readerId: "a", readNoticeIds: ["n", "new"] });
await oldSessionRead;
assert.deepEqual(state.bootstrap.readNoticeIds, [], "late acknowledgements cannot modify another account");
let refreshCount = 0;
let resolveRefresh;
const refresh = createStudentNoticeRefresher({ state, render() {}, api: () => { refreshCount++; return new Promise(resolve => { resolveRefresh = resolve; }); } });
const firstRefresh = refresh();
const duplicateRefresh = refresh();
assert.equal(refreshCount, 1, "quiet refresh requests deduplicate");
state.bootstrap.readNoticeIds = ["during-refresh"];
resolveRefresh({ readerId: "b", notices: [{ id: "during-refresh", title: "확인한 공지" }], readNoticeIds: [] });
await Promise.all([firstRefresh, duplicateRefresh]);
assert.deepEqual(state.bootstrap.readNoticeIds, ["during-refresh"], "a stale fetch cannot undo a concurrent acknowledgement");
const oldSessionRefresh = refresh({ force: true });
state.user = { id: "c", role: "student" };
state.token = "session-c";
state.bootstrap = { noticeReaderId: "c", notices: [], readNoticeIds: [] };
resolveRefresh({ readerId: "b", notices: [{ id: "private-old-notice" }], readNoticeIds: ["during-refresh"] });
await oldSessionRefresh;
assert.deepEqual(state.bootstrap.notices, [], "late background refreshes cannot cross accounts");
const failedState = { token: "token", user: { id: "c", role: "student" }, bootstrap: { noticeReaderId: "c", notices: [{ id: "fail" }], readNoticeIds: [] } };
let readError = "";
await createNoticeReader({ state: failedState, render() {}, toast: msg => { readError = msg; }, api: async () => { throw new Error("offline"); } })("fail");
assert.deepEqual(failedState.bootstrap.readNoticeIds, []);
assert.match(readError, /읽음/);
console.log("Notice client: exact notice opening, deduplication, failure, acknowledgement races and account isolation passed.");
