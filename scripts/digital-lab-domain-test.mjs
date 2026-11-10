import assert from "node:assert/strict";
import test from "node:test";
import { handleApiRequest, normalizeDb } from "../core.mjs";
import { reservationIntervals, reservationTiming } from "../core/reservation-timing.mjs";
import { defaultSettings } from "../core/settings.mjs";

const now = new Date("2026-11-09T02:30:00Z");
const userId = "student-a";
const settings = {
  ...defaultSettings,
  digitalLabEnabled: true,
  digitalLabOpenTime: "10:00",
  digitalLabCloseTime: "20:00"
};
const noon = { reservedDate: "2026-11-09", seatId: "mac-01", startTime: "12:00", endTime: "14:00" };
const noonWindow = { startAt: "2026-11-09T03:00:00.000Z", endAt: "2026-11-09T05:00:00.000Z" };

function booking(fields = {}, attrs = {}) {
  return { id: "booking-1", type: "digital_lab", userId: "student-b", status: "auto_confirmed", fields: { ...noon, ...fields }, ...attrs };
}

test("exposes the exact Mac and PC seats in room order", async () => {
  const { DIGITAL_LAB_SEATS } = await import("../core/digital-lab.mjs");
  assert.deepEqual(DIGITAL_LAB_SEATS.map(({ id, label, computerType }) => [id, label, computerType]), [
    ["mac-01", "Mac 01", "mac"], ["mac-02", "Mac 02", "mac"], ["mac-03", "Mac 03", "mac"], ["mac-04", "Mac 04", "mac"],
    ["mac-05", "Mac 05", "mac"], ["mac-06", "Mac 06", "mac"], ["mac-07", "Mac 07", "mac"], ["mac-08", "Mac 08", "mac"],
    ["mac-09", "Mac 09", "mac"], ["mac-10", "Mac 10", "mac"], ["mac-11", "Mac 11", "mac"], ["mac-12", "Mac 12", "mac"],
    ["pc-01", "PC 01", "pc"], ["pc-02", "PC 02", "pc"], ["pc-03", "PC 03", "pc"], ["pc-04", "PC 04", "pc"]
  ]);
});

test("rejects a started slot and accepts a future or exact-start slot in KST", async () => {
  const { getDigitalLabWindow, evaluateDigitalLabSelection } = await import("../core/digital-lab.mjs");
  const db = { settings, reservations: [] };
  assert.deepEqual(getDigitalLabWindow(settings, noon, { now }), noonWindow);
  assert.deepEqual(evaluateDigitalLabSelection(db, noon, { now, userId }), { available: true, reasonCode: null, reason: "" });
  assert.equal(evaluateDigitalLabSelection(db, { ...noon, startTime: "10:00", endTime: "12:00" }, { now, userId }).reasonCode, "past");
  assert.equal(evaluateDigitalLabSelection(db, noon, { now: new Date(noonWindow.startAt), userId }).available, true);
  assert.equal(evaluateDigitalLabSelection(db, { ...noon, reservedDate: "2026-11-08" }, {
    now: new Date("2026-11-08T15:30:00Z"), userId
  }).reasonCode, "past", "KST has already advanced to Monday while UTC is Sunday");
});

test("rejects one-hour intervals and odd-hour starts and ends", async () => {
  const { evaluateDigitalLabSelection } = await import("../core/digital-lab.mjs");
  const db = { settings, reservations: [] };
  for (const [startTime, endTime] of [["12:00", "13:00"], ["13:00", "15:00"], ["11:00", "14:00"], ["12:00", "15:00"]]) {
    const result = evaluateDigitalLabSelection(db, { ...noon, startTime, endTime }, { now, userId });
    assert.equal(result.reasonCode, "invalid_input", `${startTime}~${endTime}`);
  }
});

test("accepts consecutive two-hour slots in one reservation", async () => {
  const { getDigitalLabWindow } = await import("../core/digital-lab.mjs");
  assert.deepEqual(getDigitalLabWindow(settings, { ...noon, endTime: "18:00" }, { now }), {
    startAt: "2026-11-09T03:00:00.000Z", endAt: "2026-11-09T09:00:00.000Z"
  });
});

test("uses the configured inclusive reservation horizon in KST", async () => {
  const { getDigitalLabWindow } = await import("../core/digital-lab.mjs");
  const windowSettings = { ...settings, reservationWindowDays: 1 };
  const clock = new Date("2026-11-08T15:30:00Z");
  assert.deepEqual(getDigitalLabWindow(windowSettings, { ...noon, reservedDate: "2026-11-10" }, { now: clock }), {
    startAt: "2026-11-10T03:00:00.000Z",
    endAt: "2026-11-10T05:00:00.000Z"
  });
  assert.throws(
    () => getDigitalLabWindow(windowSettings, { ...noon, reservedDate: "2026-11-11" }, { now: clock }),
    { status: 400, reasonCode: "invalid_input" }
  );
});

test("rejects malformed dates, seats, and time intervals", async () => {
  const { getDigitalLabWindow, evaluateDigitalLabSelection } = await import("../core/digital-lab.mjs");
  const db = { settings, reservations: [] };
  for (const seatId of ["pc-05", "mac-13", "MAC-01", ["mac-01"]]) {
    assert.equal(evaluateDigitalLabSelection(db, { ...noon, seatId }, { now, userId }).reasonCode, "invalid_input");
  }
  for (const fields of [
    { reservedDate: "2026-02-30" }, { reservedDate: ["2026-11-09"] }, { reservedDate: { toString: null } },
    { startTime: "12:30" },
    { endTime: "12:30" }, { endTime: "12:00" }, { endTime: "11:00" }, { startTime: "9:00" },
    { startTime: "22:00", endTime: "00:00" }, { startTime: "24:00", endTime: "24:00" }, { endTime: "25:00" }
  ]) {
    assert.throws(() => getDigitalLabWindow(settings, { ...noon, ...fields }, { now }), { status: 400, reasonCode: "invalid_input" });
  }
});

test("requires enabled and configured hours and permits closing at 24:00", async () => {
  const { getDigitalLabWindow } = await import("../core/digital-lab.mjs");
  assert.throws(() => getDigitalLabWindow({}, noon, { now }), { status: 400, reasonCode: "disabled" });
  assert.throws(() => getDigitalLabWindow({ digitalLabEnabled: true }, noon, { now }), { status: 400, reasonCode: "disabled" });
  const late = { ...noon, startTime: "22:00", endTime: "24:00" };
  assert.throws(() => getDigitalLabWindow(settings, late, { now }), { status: 400, reasonCode: "outside_hours" });
  assert.deepEqual(getDigitalLabWindow({ ...settings, digitalLabOpenTime: "00:00", digitalLabCloseTime: "24:00" }, late, { now }), {
    startAt: "2026-11-09T13:00:00.000Z",
    endAt: "2026-11-09T15:00:00.000Z"
  });
  assert.throws(
    () => getDigitalLabWindow(settings, { ...noon, reservedDate: "2026-11-10", startTime: "08:00", endTime: "10:00" }, { now }),
    { status: 400, reasonCode: "outside_hours" }
  );
});

test("blocks only half-open overlaps on the selected seat or for the same user", async () => {
  const { evaluateDigitalLabSelection } = await import("../core/digital-lab.mjs");
  const previous = booking({ startTime: "10:00", endTime: "12:00" });
  assert.equal(evaluateDigitalLabSelection({ settings, reservations: [previous] }, noon, { now, userId }).available, true);
  const reservations = [booking({ startTime: "14:00", endTime: "16:00" })];
  assert.equal(evaluateDigitalLabSelection({ settings, reservations }, noon, { now, userId }).available, true);
  const consecutiveSlots = { ...noon, endTime: "16:00" };
  assert.equal(evaluateDigitalLabSelection({ settings, reservations }, consecutiveSlots, { now, userId }).reasonCode, "seat_reserved");
  assert.equal(evaluateDigitalLabSelection({ settings, reservations }, { ...consecutiveSlots, seatId: "pc-04" }, { now, userId }).available, true);
  reservations[0].userId = userId;
  assert.equal(evaluateDigitalLabSelection({ settings, reservations }, { ...consecutiveSlots, seatId: "pc-04" }, { now, userId }).reasonCode, "user_overlap");
});

test("ignores terminal reservations, authorized edits, and invalid persisted intervals", async () => {
  const { evaluateDigitalLabSelection, overlappingDigitalLabReservations } = await import("../core/digital-lab.mjs");
  const inactive = ["cancelled", "admin_cancelled", "rejected", "returned", "completed"].map((status) => booking({}, { status }));
  const active = booking({}, { id: "editing-booking", userId });
  const reservations = [...inactive, null, booking({}, { fields: null }), booking({ endTime: "11:00" }), active];
  const db = { settings, reservations };
  assert.deepEqual(overlappingDigitalLabReservations(db, noon), [active]);
  assert.equal(evaluateDigitalLabSelection(db, noon, { now, userId }).reasonCode, "seat_reserved");
  assert.equal(evaluateDigitalLabSelection(db, noon, { now, userId, editingId: active.id }).available, true);
});

test("applies minute-precision class blocks to all seats on matching weekdays and dates", async () => {
  const { digitalLabClassOverlaps, evaluateDigitalLabSelection } = await import("../core/digital-lab.mjs");
  const rule = { type: "digital_lab", day: "monday", from: "2026-11-09", to: "2026-11-16", start: "10:30", end: "12:10", target: "사진 수업" };
  const db = { settings: { ...settings, blockedSchedules: [rule] }, reservations: [] };
  for (const reservedDate of ["2026-11-09", "2026-11-16"]) {
    for (const seatId of ["mac-01", "pc-04"]) {
      const result = evaluateDigitalLabSelection(db, { ...noon, reservedDate, seatId }, { now, userId });
      assert.equal(result.reasonCode, "class_blocked");
    }
  }
  for (const reservedDate of ["2026-11-10", "2026-11-23"]) {
    assert.equal(evaluateDigitalLabSelection(db, { ...noon, reservedDate }, { now, userId }).available, true);
  }
  assert.equal(digitalLabClassOverlaps({ ...rule, end: "12:00" }, noon), false);
  assert.equal(digitalLabClassOverlaps({ ...rule, start: "14:00", end: "15:00" }, noon), false);
  assert.equal(digitalLabClassOverlaps({ ...rule, type: "darkroom" }, noon), false);
  assert.equal(digitalLabClassOverlaps({ ...rule, end: "24:00" }, { ...noon, startTime: "22:00", endTime: "24:00" }), true);
});

test("ignores malformed persisted class times and date bounds", async () => {
  const { digitalLabClassOverlaps } = await import("../core/digital-lab.mjs");
  const rule = { type: "digital_lab", day: "monday", from: "2026-11-09", to: "2026-11-16", start: "10:30", end: "12:10" };
  for (const key of ["start", "end", "from", "to"]) {
    assert.equal(digitalLabClassOverlaps({ ...rule, [key]: { toString: null } }, noon), false, key);
  }
});

test("derives persisted historical timing and intervals without current settings", () => {
  const row = booking({ reservedDate: "2024-02-29", startTime: "22:00", endTime: "24:00" });
  const expected = { startAt: "2024-02-29T13:00:00.000Z", endAt: "2024-02-29T15:00:00.000Z" };
  assert.deepEqual(reservationTiming(row), expected);
  assert.deepEqual(reservationIntervals(row), [expected]);
  assert.deepEqual(reservationIntervals(booking({ startTime: "22:00", endTime: "00:00" })), []);
});

test("returns no timing for malformed persisted digital lab dates or missing fields", () => {
  assert.equal(reservationTiming(booking({ reservedDate: { toString: null } })), null);
  assert.deepEqual(reservationIntervals(booking({}, { fields: null })), []);
});

test("normalizes legacy settings as disabled and enforces operating settings through the existing endpoint", async () => {
  const db = normalizeDb({
    settings: {},
    users: [{ id: "admin", role: "admin", name: "관리자", status: "approved" }],
    sessions: [{ token: "settings-test", userId: "admin", expiresAt: "2099-01-01T00:00:00Z" }]
  });
  assert.equal(db.settings.digitalLabEnabled, false);
  assert.equal(db.settings.digitalLabOpenTime, "");
  assert.equal(db.settings.digitalLabCloseTime, "");
  const patch = (body) => handleApiRequest({
    method: "PATCH", pathname: "/api/admin/settings", authorization: "Bearer settings-test",
    readText: async () => JSON.stringify(body), db, saveDb: async () => {}
  });
  for (const invalid of [
    { digitalLabEnabled: true }, { digitalLabEnabled: "true" }, { digitalLabOpenTime: "24:00" },
    { digitalLabOpenTime: "09:30" }, { digitalLabOpenTime: "09:00" }, { digitalLabCloseTime: "19:00" },
    { digitalLabCloseTime: "24:01" }, { digitalLabOpenTime: "10:00", digitalLabCloseTime: "10:00" },
    { digitalLabOpenTime: "12:00", digitalLabCloseTime: "10:00" }
  ]) {
    assert.equal((await patch(invalid)).status, 400, JSON.stringify(invalid));
  }
  assert.equal((await patch({ digitalLabOpenTime: "00:00" })).status, 200);
  const enabled = await patch({ digitalLabEnabled: true, digitalLabCloseTime: "24:00" });
  assert.equal(enabled.status, 200);
  assert.equal(enabled.body.data.digitalLabEnabled, true);
  assert.equal(enabled.body.data.digitalLabOpenTime, "00:00");
  assert.equal(enabled.body.data.digitalLabCloseTime, "24:00");
  assert.equal((await patch({ digitalLabCloseTime: "" })).status, 400);
  assert.equal(db.settings.digitalLabCloseTime, "24:00");
  const disabled = await patch({ digitalLabEnabled: false, digitalLabOpenTime: "", digitalLabCloseTime: "" });
  assert.equal(disabled.status, 200);
  assert.equal(disabled.body.data.digitalLabEnabled, false);
});

test("accepts same-day minute-precision class rules through the existing settings endpoint", async () => {
  const db = normalizeDb({
    settings: {},
    users: [{ id: "admin", role: "admin", name: "관리자", status: "approved" }],
    sessions: [{ token: "settings-test", userId: "admin", expiresAt: "2099-01-01T00:00:00Z" }]
  });
  const patch = (rule) => handleApiRequest({
    method: "PATCH", pathname: "/api/admin/settings", authorization: "Bearer settings-test",
    readText: async () => JSON.stringify({ blockedSchedules: [rule] }), db, saveDb: async () => {}
  });
  const rule = { id: "class-1", type: "digital_lab", day: "monday", from: "2026-11-09", to: "2026-11-16", start: "10:30", end: "12:10", target: "사진 수업" };
  const valid = await patch(rule);
  assert.equal(valid.status, 200);
  assert.deepEqual(valid.body.data.blockedSchedules, [rule]);
  for (const invalid of [
    { end: "10:30" }, { end: "09:00" }, { start: "24:00", end: "24:00" }, { end: "24:01" }, { day: "constructor" }
  ]) {
    assert.equal((await patch({ ...rule, ...invalid })).status, 400);
    assert.deepEqual(db.settings.blockedSchedules, [rule]);
  }
  assert.equal((await patch({ ...rule, end: "24:00" })).status, 200);
});

test("preserves a legacy studio rule when the admin deletes another class rule", async () => {
  const legacy = { id: "legacy-class", type: "studio", day: "constructor", from: "2026-11-09", to: "2026-11-16", start: "10:00", end: "12:00", target: "기존 수업" };
  const db = normalizeDb({
    settings: { blockedSchedules: [legacy, { ...legacy, id: "removed-class", day: "monday" }] },
    users: [{ id: "admin", role: "admin", name: "관리자", status: "approved" }],
    sessions: [{ token: "settings-test", userId: "admin", expiresAt: "2099-01-01T00:00:00Z" }]
  });
  const response = await handleApiRequest({
    method: "PATCH", pathname: "/api/admin/settings", authorization: "Bearer settings-test",
    readText: async () => JSON.stringify({ blockedSchedules: [legacy] }), db, saveDb: async () => {}
  });
  assert.equal(response.status, 200);
  assert.deepEqual(db.settings.blockedSchedules, [legacy]);
});
