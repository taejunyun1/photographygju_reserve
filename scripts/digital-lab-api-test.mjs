import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { handleApiRequest, initialDb } from "../core.mjs";

const password = "digital-lab-test-password";
const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const dateAfter = (days) => new Date(Date.parse(today) + days * 86400000).toISOString().slice(0, 10);
const bookingDate = dateAfter(1);
const classDate = dateAfter(2);
const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const weekdayFor = (date) => weekdays[new Date(date).getUTCDay()];
const fields = {
  reservedDate: bookingDate,
  seatId: "mac-01",
  startTime: "10:00",
  endTime: "12:00",
  purpose: "사진 편집",
  phone: "01011112222"
};
const enabledSettings = {
  digitalLabEnabled: true,
  digitalLabOpenTime: "00:00",
  digitalLabCloseTime: "24:00"
};

let dataDir, server, baseUrl, admin, first, second, pending;
let serverOutput = "";

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "gju-digital-lab-"));
  const db = await initialDb(password);
  await writeFile(join(dataDir, "db.json"), JSON.stringify(db));

  const probe = createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const { port } = probe.address();
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [fileURLToPath(new URL("../server.mjs", import.meta.url))], {
    env: {
      ...process.env,
      PORT: String(port),
      GJU_HOST: "127.0.0.1",
      GJU_DATA_DIR: dataDir,
      GJU_DISABLE_OVERDUE_TIMER: "1",
      SLACK_WEBHOOK_URL: "",
      REPORT_DRIVE_CLIENT_ID: "",
      REPORT_DRIVE_CLIENT_SECRET: "",
      REPORT_DRIVE_TOKEN_ENCRYPTION_KEY: ""
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Local server startup timed out. ${serverOutput}`)), 5000);
    server.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    server.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Local server exited with code ${code}. ${serverOutput}`));
    });
    server.stderr.on("data", (chunk) => { serverOutput += chunk; });
    server.stdout.on("data", (chunk) => {
      serverOutput += chunk;
      if (serverOutput.includes(`running at ${baseUrl}`)) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  admin = await login("admin");
  first = await register("first", "디지털실 테스트 가", fields.phone, true);
  second = await register("second", "디지털실 테스트 나", "01033334444", true);
  pending = await register("pending", "디지털실 테스트 다", "01055556666", false);
  await expectData(api("/api/admin/settings", admin, "PATCH", {
    ...enabledSettings,
    blockedSchedules: [{
      type: "digital_lab", day: weekdayFor(classDate), from: classDate, to: classDate,
      start: "10:30", end: "12:10", target: "디지털 사진 수업"
    }]
  }));
});

after(async () => {
  if (server?.pid && server.exitCode === null && server.signalCode === null) {
    const exited = once(server, "exit");
    server.kill();
    await exited;
  }
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
});

async function api(path, token, method = "GET", body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { authorization: token ? `Bearer ${token}` : "", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(5000)
  });
  return { status: response.status, body: await response.json() };
}

async function expectData(request) {
  const { status, body } = await request;
  assert.equal(status, 200, JSON.stringify(body));
  assert.equal(body.ok, true);
  return body.data;
}

async function expectStatus(request, expected) {
  const result = await request;
  assert.equal(result.status, expected, JSON.stringify(result.body));
  assert.equal(result.body.ok, false);
  return result.body;
}

async function login(loginId) {
  return (await expectData(api("/api/auth/login", "", "POST", { loginId, password }))).token;
}

async function register(key, name, phone, approved) {
  const email = `${key}@example.test`;
  const { user } = await expectData(api("/api/auth/signup", "", "POST", {
    name, email, phone, password, studentStatus: "재학생"
  }));
  if (approved) await expectData(api(`/api/admin/users/${user.id}/approval`, admin, "PATCH", { approvalStatus: "approved" }));
  return await login(email);
}

function availability(token, selection = {}, editingId) {
  const { reservedDate, startTime, endTime } = { ...fields, ...selection };
  const query = new URLSearchParams({ date: reservedDate, start: startTime, end: endTime });
  if (editingId !== undefined) query.set("editingId", editingId);
  return api(`/api/digital-lab/availability?${query}`, token);
}

function create(token, overrides = {}) {
  return api("/api/reservations", token, "POST", { type: "digital_lab", fields: { ...fields, ...overrides } });
}

function update(token, id, updates) {
  return api(`/api/reservations/${id}`, token, "PATCH", { fields: updates });
}

function seat(data, id) {
  return data.seats.find((item) => item.id === id);
}

test("availability is authenticated and returns the 16 fixed seats", async () => {
  await expectStatus(availability(""), 401);
  const data = await expectData(availability(pending));
  assert.equal(data.date, bookingDate);
  assert.equal(data.startTime, "10:00");
  assert.equal(data.endTime, "12:00");
  assert.ok(Number.isFinite(Date.parse(data.generatedAt)));
  assert.deepEqual(data.seats.map(({ id }) => id), [
    "mac-01", "mac-02", "mac-03", "mac-04", "mac-05", "mac-06", "mac-07", "mac-08",
    "mac-09", "mac-10", "mac-11", "mac-12", "pc-01", "pc-02", "pc-03", "pc-04"
  ]);
  assert.deepEqual(seat(data, "mac-01"), {
    id: "mac-01", label: "Mac 01", computerType: "mac",
    available: true, reasonCode: null, reason: "", isMine: false
  });
  assert.equal(seat(data, "pc-04").computerType, "pc");
  const invalid = await expectData(availability(first, { startTime: "", endTime: "" }));
  assert.ok(invalid.seats.every((item) => !item.available && item.reasonCode === "invalid_input"));
});

test("approved users book one seat with exact fields and KST timing", async () => {
  const reservation = await expectData(create(first, { computerType: "pc", userId: "forged" }));
  assert.equal(reservation.type, "digital_lab");
  assert.equal(reservation.status, "auto_confirmed");
  assert.deepEqual(reservation.fields, fields);
  assert.deepEqual(reservation.timing, {
    startAt: `${bookingDate}T01:00:00.000Z`,
    endAt: `${bookingDate}T03:00:00.000Z`
  });
  assert.ok((await expectData(api("/api/reservations/my", first))).some((item) => item.id === reservation.id));
});

test("availability hides other bookings and authorizes editingId", async () => {
  const selection = { reservedDate: dateAfter(3), seatId: "pc-04" };
  const reservation = await expectData(create(first, selection));
  const other = await expectData(availability(second, selection));
  assert.deepEqual(Object.keys(seat(other, "pc-04")).sort(), [
    "available", "computerType", "id", "isMine", "label", "reason", "reasonCode"
  ]);
  assert.equal(seat(other, "pc-04").reasonCode, "seat_reserved");
  assert.equal(seat(other, "pc-04").isMine, false);
  for (const value of [reservation.id, reservation.user.name, fields.phone]) {
    assert.ok(!JSON.stringify(other).includes(value), `Availability exposed ${value}`);
  }

  const own = await expectData(availability(first, selection));
  assert.equal(seat(own, "pc-04").isMine, true);
  assert.equal(seat(own, "mac-02").reasonCode, "user_overlap");
  const editing = await expectData(availability(first, selection, reservation.id));
  assert.ok(editing.seats.every((item) => item.available));
  assert.equal(seat(editing, "pc-04").isMine, true);
  assert.ok((await expectData(availability(admin, selection, reservation.id))).seats.every((item) => item.available));
  const unknown = await expectStatus(availability(second, selection, "no-such-reservation"), 404);
  assert.deepEqual(await expectStatus(availability(second, selection, reservation.id), 404), unknown);
});

test("bootstrap includes digital-lab details only for the owner or admin", async () => {
  const selection = { reservedDate: dateAfter(4), seatId: "mac-02" };
  const reservation = await expectData(create(first, selection));
  const own = await expectData(api("/api/bootstrap", first));
  const adminData = await expectData(api("/api/bootstrap", admin));
  const other = await expectData(api("/api/bootstrap", second));
  assert.equal(own.reservations.find((item) => item.id === reservation.id)?.fields.seatId, "mac-02");
  assert.equal(adminData.reservations.find((item) => item.id === reservation.id)?.fields.seatId, "mac-02");
  for (const value of [reservation.id, reservation.user.name, fields.phone]) {
    assert.ok(!JSON.stringify(other).includes(value), `Bootstrap exposed ${value}`);
  }
});

test("concurrent writes cannot reserve the same seat for different students", async () => {
  const selection = { reservedDate: dateAfter(5) };
  const results = await Promise.all([create(first, selection), create(second, selection)]);
  assert.deepEqual(results.map(({ status }) => status).sort(), [200, 409]);
  const rows = (await expectData(api("/api/admin/reservations", admin))).filter((item) => item.fields.reservedDate === selection.reservedDate);
  assert.equal(rows.length, 1);
});

test("concurrent writes cannot reserve overlapping seats for the same student", async () => {
  const reservedDate = dateAfter(6);
  const results = await Promise.all([
    create(first, { reservedDate, seatId: "mac-03" }),
    create(first, { reservedDate, seatId: "pc-03" })
  ]);
  assert.deepEqual(results.map(({ status }) => status).sort(), [200, 409]);
  const own = await expectData(api("/api/reservations/my", first));
  assert.equal(own.filter((item) => item.fields.reservedDate === reservedDate).length, 1);
});

test("edits exclude their own row and reject other seats, class blocks, and owner conflicts", async () => {
  const reservedDate = dateAfter(7);
  const reservation = await expectData(create(first, { reservedDate }));
  const adjacent = await expectData(create(first, { reservedDate, seatId: "mac-02", startTime: "12:00", endTime: "14:00" }));
  await expectData(create(second, { reservedDate, seatId: "pc-01" }));
  await expectStatus(update(second, reservation.id, { seatId: "pc-02" }), 403);
  assert.equal((await expectData(update(first, reservation.id, { purpose: "수정된 이용 목적" }))).fields.purpose, "수정된 이용 목적");
  await expectStatus(update(first, reservation.id, { seatId: "pc-01" }), 409);
  await expectStatus(update(first, reservation.id, { reservedDate: classDate }), 409);
  await expectStatus(update(admin, reservation.id, { startTime: "12:00", endTime: "14:00" }), 409);

  const editAvailability = await expectData(availability(admin, adjacent.fields, reservation.id));
  assert.equal(seat(editAvailability, "mac-01").reasonCode, "user_overlap");
  assert.equal((await expectData(update(admin, reservation.id, { seatId: "pc-04" }))).fields.seatId, "pc-04");
});

test("cancelling a reservation releases the seat", async () => {
  const selection = { reservedDate: dateAfter(8) };
  const reservation = await expectData(create(first, selection));
  assert.equal((await expectData(api(`/api/reservations/${reservation.id}/cancel`, first, "POST", {}))).status, "cancelled");
  await expectStatus(update(first, reservation.id, { seatId: "mac-02" }), 409);
  await expectStatus(availability(first, selection, reservation.id), 404);
  assert.equal(seat(await expectData(availability(second, selection)), "mac-01").available, true);
  assert.equal((await expectData(create(second, selection))).status, "auto_confirmed");
});

test("writes reject unapproved accounts, invalid input, past times, and class blocks", async () => {
  await expectStatus(create("", { reservedDate: dateAfter(9) }), 401);
  await expectStatus(create(pending, { reservedDate: dateAfter(9) }), 403);
  await expectStatus(create(first, { seatId: "mac-13" }), 400);
  await expectStatus(create(first, { seatId: [] }), 400);
  await expectStatus(create(first, { purpose: {} }), 400);
  await expectStatus(create(first, { phone: " " }), 400);
  await expectStatus(create(first, { reservedDate: dateAfter(-1) }), 400);
  await expectStatus(create(first, { reservedDate: classDate, seatId: "pc-04" }), 409);
  const blocked = await expectData(availability(first, { reservedDate: classDate }));
  assert.ok(blocked.seats.every((item) => !item.available && item.reasonCode === "class_blocked"));
});

test("a disabled lab reports unavailable and rejects writes", async () => {
  await expectData(api("/api/admin/settings", admin, "PATCH", { digitalLabEnabled: false }));
  const selection = { reservedDate: dateAfter(10) };
  const disabled = await expectData(availability(first, selection));
  assert.ok(disabled.seats.every((item) => !item.available && item.reasonCode === "disabled"));
  await expectStatus(create(first, selection), 400);
});

test("class availability follows inclusive term dates, weekday and minute boundaries", async () => {
  const from = dateAfter(16);
  const to = dateAfter(23);
  const allDay = dateAfter(24);
  await expectData(api("/api/admin/settings", admin, "PATCH", {
    ...enabledSettings,
    blockedSchedules: [
      { type: "digital_lab", day: weekdayFor(from), from, to, start: "10:30", end: "12:00", target: "학기 수업" },
      { type: "digital_lab", day: weekdayFor(allDay), from: allDay, to: allDay, start: "00:00", end: "24:00", target: "종일 수업" }
    ]
  }));
  for (const [reservedDate, startTime, endTime, reasonCode] of [
    [from, "10:00", "12:00", "class_blocked"],
    [to, "10:00", "12:00", "class_blocked"],
    [from, "12:00", "14:00", null],
    [dateAfter(9), "10:00", "12:00", null],
    [dateAfter(17), "10:00", "12:00", null],
    [dateAfter(30), "10:00", "12:00", null],
    [allDay, "00:00", "02:00", "class_blocked"],
    [allDay, "22:00", "24:00", "class_blocked"]
  ]) {
    const { seats } = await expectData(availability(first, { reservedDate, startTime, endTime }));
    assert.ok(seats.every((item) => item.reasonCode === reasonCode), JSON.stringify({ reservedDate, startTime, reasonCode, seats }));
  }
});

test("new or changed lab classes reject conflicts atomically until an admin explicitly cancels", async () => {
  const reservedDate = dateAfter(12);
  const booking = await expectData(create(first, { reservedDate }));
  const secondBooking = await expectData(create(second, { reservedDate, seatId: "pc-04" }));
  const adjacent = { id: "class-adjacent", type: "digital_lab", day: weekdayFor(reservedDate),
    from: reservedDate, to: reservedDate, start: "12:00", end: "14:00", target: "디지털 실습" };
  const legacy = { id: "class-legacy", type: "studio", day: adjacent.day, from: reservedDate, to: reservedDate,
    start: "10:30", end: "12:00", target: "Studio A Front" };
  const before = await expectData(api("/api/admin/settings", admin, "PATCH", { blockedSchedules: [adjacent, legacy] }));
  assert.deepEqual(before.blockedSchedules, [adjacent, legacy]);
  const rule = { ...adjacent, start: "11:59" };
  const newRule = { ...rule, id: "class-second" };
  const settings = { blockedSchedules: [rule, newRule, legacy], darkroomCapacity: 12 };
  const denied = await expectStatus(api("/api/admin/settings", first, "PATCH", settings), 403);
  assert.equal(denied.conflicts, undefined);
  const expected = [
    { reservationId: booking.id, reservedDate, seatId: "mac-01", startTime: "10:00", endTime: "12:00" },
    { reservationId: secondBooking.id, reservedDate, seatId: "pc-04", startTime: "10:00", endTime: "12:00" }
  ];
  for (const blockedSchedules of [[rule, legacy], [adjacent, newRule, legacy], settings.blockedSchedules]) {
    const { conflicts } = await expectStatus(api("/api/admin/settings", admin, "PATCH", { ...settings, blockedSchedules }), 409);
    assert.deepEqual(conflicts?.sort((a, b) => a.seatId.localeCompare(b.seatId)), expected);
  }
  assert.deepEqual((await expectData(api("/api/bootstrap", admin))).settings, before);
  const savedRows = await expectData(api("/api/admin/reservations", admin));
  assert.deepEqual(savedRows.find(({ id }) => id === booking.id), booking);
  assert.deepEqual(savedRows.find(({ id }) => id === secondBooking.id), secondBooking);

  const statusPath = `/api/admin/reservations/${booking.id}/status`;
  const cancel = { status: "admin_cancelled" };
  await expectStatus(api(statusPath, first, "PATCH", cancel), 403);
  await expectStatus(api(statusPath, admin, "PATCH", { status: "completed" }), 400);
  assert.equal((await expectData(api(statusPath, admin, "PATCH", cancel))).status, "admin_cancelled");
  await expectStatus(api(statusPath, admin, "PATCH", cancel), 409);
  assert.equal((await expectData(api(`/api/reservations/${secondBooking.id}/cancel`, admin, "POST", {}))).status, "admin_cancelled");
  assert.deepEqual((await expectData(api("/api/admin/settings", admin, "PATCH", settings))).blockedSchedules, settings.blockedSchedules);
  await expectStatus(create(first, { reservedDate }), 409);
  await expectData(api("/api/admin/settings", admin, "PATCH", { blockedSchedules: [legacy] }));
  assert.equal((await expectData(create(first, { reservedDate }))).status, "auto_confirmed");
});

test("malformed lab class date and time values are rejected before coercion", async () => {
  const rule = { type: "digital_lab", day: weekdayFor(classDate), from: classDate, to: classDate,
    start: "10:30", end: "12:10", target: "디지털 사진 수업" };
  for (const field of ["from", "to", "start", "end"]) {
    await expectStatus(api("/api/admin/settings", admin, "PATCH", {
      blockedSchedules: [{ ...rule, [field]: [rule[field]] }]
    }), 400);
  }
});

test("pre-existing overlapping rules with a shared ID do not block unrelated saves or a title edit", async () => {
  const db = await initialDb(password);
  const rule = { id: "old-class", type: "digital_lab", day: weekdayFor(bookingDate), from: bookingDate, to: bookingDate,
    start: "10:30", end: "12:00", target: "기존 수업" };
  const adjacent = { ...rule, start: "12:00", end: "14:00", target: "두 번째 수업" };
  Object.assign(db.settings, enabledSettings, { blockedSchedules: [rule, adjacent] });
  db.reservations.push({ id: "old-booking", type: "digital_lab", status: "auto_confirmed", userId: "user_admin", fields });
  db.sessions.push({ token: "fixture-admin", userId: "user_admin", expiresAt: new Date(Date.now() + 86400000).toISOString() });
  let writes = 0;
  for (const patch of [
    { darkroomCapacity: 9 },
    { darkroomCapacity: 10, blockedSchedules: [rule, adjacent] },
    { blockedSchedules: [{ ...rule, target: "수업명 수정" }, adjacent, {
      ...rule, id: "new-print", type: "print", target: "출력 수업"
    }] }
  ]) {
    const result = await handleApiRequest({
      method: "PATCH", pathname: "/api/admin/settings", authorization: "Bearer fixture-admin", db,
      readText: async () => JSON.stringify(patch), saveDb: async () => { writes += 1; }
    });
    assert.equal(result.status, 200, JSON.stringify(result.body));
  }
  assert.equal(db.settings.darkroomCapacity, 10);
  assert.equal(db.settings.blockedSchedules[0].target, "수업명 수정");
  assert.deepEqual(db.settings.blockedSchedules[1], adjacent);
  assert.equal(writes, 3);
});

test("final writes refresh the time after reading the body", async (t) => {
  const db = await initialDb(password);
  Object.assign(db.settings, enabledSettings);
  const nearStart = { ...fields, reservedDate: "2026-11-10" };
  const editing = {
    id: "editing", type: "digital_lab", status: "auto_confirmed", userId: "user_admin",
    fields: nearStart, history: []
  };
  db.sessions.push({ token: "clock-test", userId: "user_admin", expiresAt: "2026-11-24T00:00:00.000Z" });
  const beforeStart = Date.parse("2026-11-10T00:59:59.000Z");
  const afterStart = Date.parse("2026-11-10T01:00:01.000Z");
  let clock = beforeStart;
  t.mock.method(Date, "now", () => clock);
  let writes = 0;
  for (const [method, pathname, body] of [
    ["POST", "/api/reservations", { type: "digital_lab", fields: { ...nearStart, seatId: "pc-01" } }],
    ["PATCH", "/api/reservations/editing", { fields: { purpose: "늦게 도착한 수정" } }]
  ]) {
    clock = beforeStart;
    if (method === "PATCH") db.reservations.push(editing);
    const result = await handleApiRequest({
      method, pathname, authorization: "Bearer clock-test", db,
      readText: async () => {
        clock = afterStart;
        return JSON.stringify(body);
      },
      saveDb: async () => { writes += 1; }
    });
    assert.equal(result.status, 400, JSON.stringify(result.body));
    assert.match(result.body.error, /이미 시작/);
  }
  assert.equal(writes, 0);
});
