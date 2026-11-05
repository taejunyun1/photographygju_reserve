import assert from "node:assert/strict";
import { buildFacilityTimeline } from "../core/facility-timeline.mjs";
import { defaultSettings } from "../core/settings.mjs";
import { reservationIntervals } from "../core/reservation-timing.mjs";

const now = new Date("2026-10-19T12:00:00+09:00");
const viewer = { id: "mine", name: "내 이름", role: "student" };
const reservation = (id, type, status, fields, extra = {}) => ({ id, type, status, userId: "secret-user-id", fields, ...extra });
const eqFields = (ids, date = "2026-10-19") => ({ equipmentItemIds: ids, reservedDate: date, rentalTime: "10:15", returnTime: "17:10", period: "당일" });
const db = {
  settings: { ...defaultSettings, blockedSchedules: [{ type: "studio", day: "monday", from: "2026-10-19", to: "2026-10-19", start: "09:00", end: "10:30", target: "Studio A Front" }] },
  users: [{ id: "secret-user-id", name: "타인비밀이름", studentId: "secret-student-id", phone: "secret-phone" }],
  equipment: ["one", "two", "three", "four", "unused"].map(id => ({ id, name: `장비 ${id}`, category: "Body", code: `SECRET-CODE-${id}`, facility: "외부센터", source: "external", status: "가능" })),
  reservations: [
    reservation("dark-secret", "darkroom", "auto_confirmed", { reservedDate: "2026-10-19", timeSlots: ["10:00-12:00", "14:00-16:00"] }),
    reservation("front-secret", "studio", "auto_confirmed", { reservedDate: "2026-10-19", studioSpace: "Studio A Front", timeSlots: ["10:30-12:00"] }),
    reservation("mine-res", "studio", "auto_confirmed", { reservedDate: "2026-10-19", studioSpaces: ["Studio A Back"], timeSlots: ["10:30-12:00"] }, { userId: "mine" }),
    reservation("overnight-secret", "studio", "auto_confirmed", { reservedDate: "2026-10-18", studioSpace: "Studio B Back", timeSlots: ["22:00-24:00 (야간)", "00:00-02:00 (야간)", "02:00-04:00 (야간)"] }),
    ...["cancelled", "admin_cancelled", "completed", "rejected", "returned", "approved", "pending_approval", "unknown"].map(status => reservation(`excluded-${status}`, "darkroom", status, { reservedDate: "2026-10-19", timeSlots: ["16:00-18:00"] })),
    reservation("print-secret", "print", "auto_confirmed", { reservedDate: "2026-10-19", startTime: "10:15", endTime: "10:45" }),
    reservation("old-custody-secret", "equipment", "checked_out", eqFields(["one", "one"], "2026-10-15"), { actualCheckedOutAt: "2026-10-15T01:15:00.000Z" }),
    reservation("scheduled-secret", "equipment", "approved", eqFields(["one", "two", "two"])),
    reservation("pending-secret", "equipment", "pending_approval", eqFields(["three"])),
    reservation("early-secret", "equipment", "returned", eqFields(["four"]), { actualCheckedOutAt: "2026-10-19T01:15:00.000Z", actualReturnedAt: "2026-10-19T02:00:00.000Z", returnProcessedAt: "2026-10-19T09:00:00.000Z" }),
    reservation("unrecorded-secret", "equipment", "returned", eqFields(["three"]))
  ]
};
const student = buildFacilityTimeline(db, { date: "2026-10-19", now, viewer });
assert.equal(student.generatedAt, now.toISOString());
assert.equal(student.today, "2026-10-19");
assert.equal(student.maxDate, "2026-11-18");
assert.equal(student.viewer, "student");
assert.equal(student.spaces.length, 4);
const room = key => student.spaces.find(space => space.key === key);
assert.equal(room("dark").intervals.length, 2, "noncontinuous slots must leave the gap empty and exclude terminal states");
assert.equal(room("dark").intervals[0].endAt, "2026-10-19T03:00:00.000Z");
assert.equal(room("dark").intervals[1].startAt, "2026-10-19T05:00:00.000Z");
assert.equal(room("a").intervals.length, 2, "Front and Back simultaneous reservations remain separate");
assert.deepEqual(room("a").intervals.map(row => row.subspaceKeys), [["Studio A Front"], ["Studio A Back"]]);
assert.equal(room("a").intervals.find(row => row.isMine).reservationId, "mine-res");
assert.equal(room("a").intervals.find(row => row.isMine).label, "내 예약");
assert.equal(room("b").intervals.length, 2, "previous-day overnight segments overlap today");
assert.equal(room("b").intervals[1].endAt, "2026-10-18T19:00:00.000Z");
assert.equal(room("print").intervals[0].startAt, "2026-10-19T01:15:00.000Z");
assert.equal(room("print").intervals[0].endAt, "2026-10-19T01:45:00.000Z");
assert.equal(room("a").blockedIntervals[0].endAt, "2026-10-19T01:30:00.000Z");
assert(room("dark").blockedIntervals.some(row => row.startAt === "2026-10-19T05:00:00.000Z"));
assert(room("print").blockedIntervals.some(row => row.endAt === "2026-10-19T01:00:00.000Z"));
assert.equal(student.equipment.length, 4, "only relevant unique inventory items appear");
const one = student.equipment.find(row => row.equipmentId === "one");
assert.equal(student.equipment.filter(row => row.custody).length, 1, "approval is never counted as actual checkout");
assert.equal(one.custody.overdue, true);
assert.equal(one.custody.checkedOutAt, "2026-10-15T01:15:00.000Z");
assert.equal(one.facility, "외부센터");
assert.equal(one.source, "external");
assert.equal(one.reservations.length, 1);
assert.equal(one.reservations[0].handoffNeedsReview, true, "an outstanding checkout prevents promising the next handoff");
assert.deepEqual(room("a").blockedIntervals[0].subspaceKeys, ["Studio A Front", "Studio A Back"], "restrictions mirror the existing validator's conservative room-letter target fallback");
const four = student.equipment.find(row => row.equipmentId === "four");
assert.equal(four.history[0].endAt, "2026-10-19T02:00:00.000Z", "actual return, not administrative processing, closes custody");
assert.equal(student.equipment.find(row => row.equipmentId === "three").history.length, 0, "missing timestamps never invent historical use");
assert(student.equipment.find(row => row.equipmentId === "three").reservations.some(row => row.historyUnavailable), "missing history must be explicit");
const serialized = JSON.stringify(student);
for (const secret of ["secret-user-id", "타인비밀이름", "SECRET-CODE", "secret-phone", "dark-secret", "front-secret", "old-custody-secret", "scheduled-secret", "secret-student-id"]) assert(!serialized.includes(secret), `student response leaks ${secret}`);
const admin = buildFacilityTimeline(db, { date: "2026-10-19", now, viewer: { id: "admin", role: "admin" } });
assert.equal(admin.viewer, "admin");
assert(admin.spaces.find(row => row.key === "a").intervals.some(row => row.label.includes("타인비밀이름") && row.reservationId === "front-secret"));
const activeAdmin = buildFacilityTimeline(db, { date: "2026-10-19", now: "2026-10-19T11:00:00+09:00", viewer: { id: "admin", role: "admin" } });
assert.equal(activeAdmin.spaces.find(row => row.key === "a").intervals.find(row => row.reservationId === "front-secret").phone, "secret-phone", "admin sees the current Studio A reservation phone");
assert.equal(admin.spaces.find(row => row.key === "a").intervals.find(row => row.reservationId === "front-secret").phone, undefined, "ended reservations do not expose phone on the board");
const activeStudent = buildFacilityTimeline(db, { date: "2026-10-19", now: "2026-10-19T11:00:00+09:00", viewer });
const activeStudentFront = activeStudent.spaces.find(row => row.key === "a").intervals.find(row => !row.isMine);
assert.equal(activeStudentFront.contactName, "타인비밀이름");
assert.equal(activeStudentFront.phone, "secret-phone");
assert(!JSON.stringify(activeStudent).includes("secret-student-id"), "student number remains private");
assert.equal(admin.equipment[0].code, "SECRET-CODE-one");
const future = buildFacilityTimeline(db, { date: "2026-11-18", now, viewer });
assert.equal(future.equipment.find(row => row.equipmentId === "one").custody.overdue, true, "unreturned custody has no invented end even in future projections");
for (const date of ["2026-02-30", "2026-10-18", "2026-11-19", "bad"]) assert.throws(() => buildFacilityTimeline(db, { date, now, viewer }), error => error.status === 400);
const wrap = reservationIntervals(reservation("wrap", "studio", "auto_confirmed", { reservedDate: "2026-10-19", timeSlots: ["00:00-02:00", "22:00-24:00"] }), { studioSlots: Array.from({ length: 12 }, (_, n) => `${String(n * 2).padStart(2, "0")}:00-${String(n * 2 + 2).padStart(2, "0")}:00`) });
assert.equal(wrap[0].startAt, "2026-10-19T13:00:00.000Z");
assert.equal(wrap[1].endAt, "2026-10-19T17:00:00.000Z", "full-day configured slots preserve circular midnight continuation");
const overnightDb = structuredClone(db);
overnightDb.settings.blockedSchedules.push({ type: "studio", day: "sunday", from: "2026-10-18", to: "2026-10-18", start: "23:00", end: "02:00", target: "Studio B" });
const overnight = buildFacilityTimeline(overnightDb, { date: "2026-10-19", now, viewer });
assert(overnight.spaces.find(row => row.key === "b").blockedIntervals.some(row => row.startAt === "2026-10-18T14:00:00.000Z" && row.endAt === "2026-10-18T17:00:00.000Z"), "previous-day overnight restrictions reach today's early hours");
const midnightBoard = buildFacilityTimeline(db, { date: "2026-10-19", now: "2026-10-18T15:05:00.000Z", viewer });
assert.equal(midnightBoard.today, "2026-10-19", "day window follows KST even when UTC is previous day");
const equipmentBlockedDb = structuredClone(db);
equipmentBlockedDb.settings.blockedSchedules.push({ type: "equipment", day: "monday", from: "2026-10-19", to: "2026-10-19", start: "10:00", end: "12:00", label: "기자재 점검" });
const blockedEquipmentBoard = buildFacilityTimeline(equipmentBlockedDb, { date: "2026-10-19", now, viewer });
assert.deepEqual(blockedEquipmentBoard.equipmentBlockedIntervals, [{ startAt: "2026-10-18T15:00:00.000Z", endAt: "2026-10-19T15:00:00.000Z", label: "기자재 점검" }], "equipment reservation validation blocks the whole rental day, not only the configured clock range");
assert.deepEqual(buildFacilityTimeline(equipmentBlockedDb, { date: "2026-10-20", now, viewer }).equipmentBlockedIntervals, [], "equipment restrictions must respect configured date and weekday");
console.log("Facility timeline domain fixtures passed.");
