import assert from "node:assert/strict";
import { reservationTiming } from "../core/reservation-timing.mjs";
const first = { reservedDate: "2099-01-06", period: "당일", rentalTime: "10:15", returnTime: "17:10", equipmentItemIds: ["camera"], phone: "01012345678" };
const next = { ...first, period: "1박2일", rentalTime: "17:30" };
assert.ok(Date.parse(reservationTiming({type:"equipment", fields:first}).endAt) < Date.parse(reservationTiming({type:"equipment", fields:next}).startAt));
const { equipmentScheduledWindow, equipmentWindowsOverlap } = await import("../public/js/equipment-schedule.mjs");
assert.equal(equipmentWindowsOverlap(equipmentScheduledWindow(first), equipmentScheduledWindow(next)), false);
const a = { startAt: '2026-10-13T01:15:00.000Z', endAt: '2026-10-13T08:10:00.000Z' };
const b = { startAt: '2026-10-13T08:30:00.000Z', endAt: '2026-10-14T08:10:00.000Z' };
assert.equal(equipmentWindowsOverlap(a, b), false);
assert.equal(equipmentWindowsOverlap(a, { ...b, startAt: '2026-10-13T08:00:00.000Z' }), true);
assert.equal(equipmentWindowsOverlap(a, { ...b, startAt: a.endAt }), false);
assert.equal(equipmentWindowsOverlap(b, a), false);
assert.equal(equipmentWindowsOverlap(null, b), false);
assert.equal(equipmentWindowsOverlap({ ...a, endAt: a.startAt }, b), false);
assert.equal(equipmentWindowsOverlap({ ...a, startAt: "invalid" }, b), false);
const fields = { reservedDate: "2026-10-13", period: "당일", rentalTime: "10:15", returnTime: "17:10" };
assert.deepEqual(equipmentScheduledWindow(fields), a);
for (const [period, endAt] of [["1박2일", "2026-10-14T08:10:00.000Z"], ["2박3일", "2026-10-15T08:10:00.000Z"]]) {
  assert.equal(equipmentScheduledWindow({ ...fields, period }).endAt, endAt);
}
assert.equal(equipmentScheduledWindow({ ...fields, reservedDate: "2026-10-16", period: "주말사용" }).endAt, "2026-10-18T08:10:00.000Z");
assert.equal(equipmentScheduledWindow({ ...fields, reservedDate: "2026-12-31", period: "1박2일" }).endAt, "2027-01-01T08:10:00.000Z");
assert.equal(equipmentScheduledWindow({ ...fields, reservedDate: "2028-02-29" }).startAt, "2028-02-29T01:15:00.000Z");
for (const patch of [{reservedDate:"2026-02-29"}, {reservedDate:""}, {period:""}, {period:"unknown"}, {period:"foo2박3일"}, {rentalTime:""}, {returnTime:""}, {rentalTime:"24:00"}, {returnTime:"17:60"}, {returnTime:"10:15"}, {returnTime:"10:00"}]) {
  assert.equal(equipmentScheduledWindow({ ...fields, ...patch }), null, JSON.stringify(patch));
  assert.equal(reservationTiming({ type:"equipment", fields:{ ...fields, ...patch } }), null);
}
assert.equal(equipmentScheduledWindow(null), null);
assert.deepEqual(reservationTiming({ type:"equipment", fields }), a);
console.log("Equipment scheduled windows and half-open overlap checks passed.");
