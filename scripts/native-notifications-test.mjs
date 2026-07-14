import assert from "node:assert/strict";

globalThis.window = {};
globalThis.document = {
  querySelector: () => null,
  querySelectorAll: () => [],
  dispatchEvent: () => true
};
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) || "",
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
  key: (index) => [...storage.keys()][index] || null,
  get length() {
    return storage.size;
  }
};
globalThis.sessionStorage = globalThis.localStorage;

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial).map(([key, value]) => [key, String(value)]));
  return {
    values,
    getItem: (key) => values.get(key) || "",
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    key: (index) => [...values.keys()][index] || null,
    get length() {
      return values.size;
    }
  };
}

const {
  planReservationNotifications,
  RESERVATION_REMINDER_CHANNEL_ID,
  reservationEndDate,
  reservationStartDate,
  diagnosticNotificationId,
  stableNotificationId
} = await import("../public/js/notification-planner.js");
const nativeModule = await import("../public/js/native-notifications.js");
const { createNotificationManager, enableNativeReservationNotifications, initializeNativeNotifications } = nativeModule;
const { state: bridgeState } = await import("../public/js/state.js?v=20260714-mobile-card-r6");

const now = new Date("2026-07-01T00:00:00.000Z");

const legacyReservation = {
  id: "legacy-studio",
  type: "studio",
  status: "approved",
  fields: {
    reservedDate: "2026-07-02",
    timeSlots: ["10:00-11:00"],
    reportStatus: "submitted"
  }
};
const timingReservation = {
  id: "timing-studio",
  type: "studio",
  status: "approved",
  timing: {
    startAt: "2026-07-03T01:00:00.000Z",
    endAt: "2026-07-03T02:00:00.000Z"
  },
  fields: {
    reservedDate: "2026-07-04",
    timeSlots: ["20:00-21:00"],
    reportStatus: "submitted"
  }
};

const planned = planReservationNotifications({
  userId: "student1",
  reservations: [legacyReservation, timingReservation],
  now
});
assert.equal(planned.length, 8, "legacy and additive timing reservations should each plan four reminders");
assert.equal(planned[0].reservationId, "legacy-studio", "planner should sort by the closest KST start time");
assert.equal(planned.find((item) => item.reservationId === "timing-studio").body.includes("7. 3."), true, "timing should take precedence over legacy fields");
assert(planned.every((item) => item.channelId === RESERVATION_REMINDER_CHANNEL_ID), "every planned reminder should target the configured Android channel");

const fridayEquipment = {
  id: "friday-equipment",
  type: "equipment",
  status: "approved",
  fields: {
    reservedDate: "2026-07-03",
    rentalTime: "10:00",
    returnTime: "17:00",
    period: "2박3일"
  }
};
const fridayStart = reservationStartDate(fridayEquipment);
const fridayEnd = reservationEndDate(fridayEquipment, fridayStart);
assert.equal(fridayStart.toISOString(), "2026-07-03T01:00:00.000Z", "Friday equipment rental should start in KST");
assert.equal(fridayEnd.toISOString(), "2026-07-05T08:00:00.000Z", "2-night/3-day equipment rental should end on Sunday in KST");

const terminalPlan = planReservationNotifications({
  userId: "student1",
  reservations: ["cancelled", "admin_cancelled", "rejected", "returned", "completed"].map((status) => ({
    ...timingReservation,
    id: `terminal-${status}`,
    status
  })),
  now
});
assert.equal(terminalPlan.length, 0, "terminal reservations should never schedule reminders");

const deadlineReservation = {
  ...timingReservation,
  id: "deadline-studio",
  timing: {
    startAt: "2026-07-03T01:00:00.000Z",
    endAt: "2026-07-03T02:00:00.000Z",
    reportDeadlineAt: "2026-07-04T02:00:00.000Z"
  },
  fields: {
    ...timingReservation.fields,
    reportStatus: "required"
  }
};
const deadlinePlan = planReservationNotifications({ userId: "student1", reservations: [deadlineReservation], now });
assert.equal(
  deadlinePlan.find((item) => item.extra?.notificationType === "report-deadline")?.schedule.at.toISOString(),
  "2026-07-03T23:00:00.000Z",
  "server-computed reportDeadlineAt should drive the deadline reminder"
);

const completedReportPlan = planReservationNotifications({
  userId: "student1",
  reservations: [{ ...deadlineReservation, id: "completed-report-studio", status: "completed" }],
  now
});
assert.equal(completedReportPlan.length, 2, "completed studio reservations should retain only their pending report reminders");
assert(
  completedReportPlan.every((item) => item.extra?.notificationType?.startsWith("report-")),
  "completed studio reservations must not schedule reservation start reminders"
);

const duplicatePlan = planReservationNotifications({
  userId: "student1",
  reservations: [timingReservation, { ...timingReservation }],
  now
});
assert.equal(new Set(duplicatePlan.map((item) => item.id)).size, duplicatePlan.length, "planner should dedupe stable IDs");

const manyReservations = Array.from({ length: 20 }, (_, index) => ({
  id: `reservation-${index}`,
  type: "print",
  status: "approved",
  timing: {
    startAt: new Date(now.getTime() + (index + 2) * 24 * 60 * 60 * 1000).toISOString(),
    endAt: new Date(now.getTime() + (index + 2) * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString()
  },
  fields: { reservedDate: "2026-07-01", startTime: "09:00", endTime: "10:00" }
}));
const capped = planReservationNotifications({ userId: "student1", reservations: manyReservations, now });
assert.equal(capped.length, 64, "planner should cap scheduled reminders at 64");
assert.deepEqual(capped.map((item) => item.schedule.at.getTime()), [...capped].sort((a, b) => a.schedule.at - b.schedule.at).map((item) => item.schedule.at.getTime()), "planner should sort by delivery time");
assert.equal(planReservationNotifications({ userId: "student1", reservations: manyReservations, now, max: 100 }).length, 64, "callers must not bypass the iOS 64-notification ceiling");

const calls = [];
let activeSyncs = 0;
let maxActiveSyncs = 0;
let failCancel = false;
let permissionState = "granted";
const plugin = {
  checkPermissions: async () => ({ display: permissionState }),
  requestPermissions: async () => ({ display: permissionState }),
  getPending: async () => ({ notifications: [] }),
  createChannel: async () => calls.push("channel"),
  cancel: async ({ notifications }) => {
    calls.push(["cancel", notifications.map(({ id }) => id)]);
    if (failCancel) throw new Error("cancel failed");
  },
  removeDeliveredNotifications: async ({ notifications }) => calls.push(["delivered", notifications.map(({ id }) => id)]),
  removeAllDeliveredNotifications: async () => calls.push(["delivered-all"]),
  schedule: async ({ notifications }) => {
    activeSyncs += 1;
    maxActiveSyncs = Math.max(maxActiveSyncs, activeSyncs);
    await new Promise((resolve) => setTimeout(resolve, 5));
    calls.push(["schedule", notifications]);
    activeSyncs -= 1;
  },
  addListener: async (event, handler) => {
    calls.push(["listener", event]);
    plugin.listener = handler;
    return { remove: async () => {} };
  }
};

storage.set("gju_native_notifications_enabled", "true");
storage.set("gju_native_notification_ids", JSON.stringify([7, 8]));
const manager = createNotificationManager({
  plugin,
  storage: globalThis.localStorage,
  userId: "student1",
  role: "student",
  reservations: () => [timingReservation],
  now: () => now,
  platform: "android",
  supported: true
});

assert.equal(manager.preferenceEnabled(), true, "manager should migrate the legacy preference");
assert.deepEqual(JSON.parse(storage.get("gju_native_notifications_v2:student1:ids")), [7, 8], "manager should migrate legacy IDs per user");
assert.equal(storage.has("gju_native_notifications_enabled"), false, "legacy preference should be removed after migration");

const directLegacyStore = memoryStorage({
  gju_native_notifications_enabled: "true",
  gju_native_notification_ids: JSON.stringify([71, 72])
});
const directLegacyManager = createNotificationManager({
  plugin,
  storage: directLegacyStore,
  userId: "direct-legacy-user",
  role: "student",
  reservations: [],
  now: () => now,
  platform: "ios",
  supported: true
});
await directLegacyManager.initialize();
assert.equal(directLegacyManager.preferenceEnabled(), true, "initialization should migrate the legacy preference into the signed-in account without a prior preference read");
assert.deepEqual(JSON.parse(directLegacyStore.getItem("gju_native_notifications_v2:direct-legacy-user:ids")), [71, 72], "initialization should preserve legacy pending ownership under the signed-in account");
assert.equal(directLegacyStore.getItem("gju_native_notifications_v2:legacy:enabled"), "", "legacy migration must not create a synthetic enabled account");

const firstSync = manager.sync({ force: true });
const secondSync = manager.sync({ force: true });
await Promise.all([firstSync, secondSync]);
assert.equal(maxActiveSyncs, 1, "sync operations should be serialized");

await manager.notifyCreated(timingReservation);
const allScheduled = calls.filter(([kind]) => kind === "schedule").flatMap(([, notifications]) => notifications);
const createdNotification = allScheduled.find((item) => item.extra?.notificationType === "reservation-created");
assert(createdNotification, "reservation-created should be delivered immediately");
assert.equal(createdNotification.schedule, undefined, "reservation-created should not create a delayed pending slot");
assert.equal(JSON.parse(storage.get("gju_native_notifications_v2:student1:ids")).includes(createdNotification.id), false, "immediate delivery should not be persisted as pending");
assert.equal(JSON.parse(storage.get("gju_native_notifications_v2:student1:deliveredIds")).includes(createdNotification.id), true, "immediate delivery should be tracked under its owning account");

failCancel = true;
await assert.rejects(() => manager.clearAccount(), /cancel failed/, "account cleanup should expose cancellation failure");
assert.notEqual(storage.get("gju_native_notifications_v2:student1:ids"), "[]", "failed cancellation should preserve IDs for retry");
assert.equal(storage.get("gju_native_notifications_v2:student1:clearPending"), "true", "failed account cleanup should remain in the retry queue");
failCancel = false;
await manager.clearAccount();
const accountDeliveredCleanup = calls.filter(([kind]) => kind === "delivered").at(-1)?.[1] || [];
assert(accountDeliveredCleanup.includes(createdNotification.id), "account cleanup should remove immediate notifications by owned ID");
assert.equal(calls.some(([kind]) => kind === "delivered-all"), false, "account cleanup must not remove another account's delivered notifications");
assert.equal(storage.has("gju_native_notifications_v2:student1:clearPending"), false, "successful cleanup should clear the retry marker");

await manager.setupListeners((route) => calls.push(["opened", route]));
plugin.listener({ notification: { extra: { route: "reports", reservationId: "timing-studio" } } });
assert.deepEqual(calls.at(-1), ["opened", { route: "reports", reservationId: "timing-studio" }], "action routing should preserve report destination");

storage.set("gju_native_notifications_v2:old-user:ids", JSON.stringify([991]));
storage.set("gju_native_notifications_v2:old-user:clearPending", "true");
const switchedManager = createNotificationManager({
  plugin,
  storage: globalThis.localStorage,
  userId: "new-user",
  role: "student",
  reservations: [],
  now: () => now,
  platform: "ios",
  supported: true
});
await switchedManager.initialize();
assert(calls.some(([kind, ids]) => kind === "cancel" && ids.includes(991)), "initialization after an account switch should retry stale account cleanup");
assert.equal(storage.has("gju_native_notifications_v2:old-user:clearPending"), false, "successful stale cleanup should leave the retry queue");

let resumeSyncCount = 0;
storage.set("gju_native_notifications_v2:new-user:enabled", "true");
const resumeManager = createNotificationManager({
  plugin: { ...plugin, schedule: async () => { resumeSyncCount += 1; } },
  storage: globalThis.localStorage,
  userId: "new-user",
  role: "student",
  reservations: () => [timingReservation],
  now: () => now,
  platform: "ios",
  supported: true
});
await resumeManager.handleResume();
assert.equal(resumeSyncCount, 1, "foreground resume should resynchronize enabled reminders");

storage.set("gju_native_notifications_v2:partial-user:enabled", "true");
const partialPlugin = {
  ...plugin,
  schedule: async ({ notifications }) => {
    calls.push(["partial-schedule", notifications]);
    throw new Error("partial native failure");
  }
};
const partialManager = createNotificationManager({
  plugin: partialPlugin,
  storage: globalThis.localStorage,
  userId: "partial-user",
  role: "student",
  reservations: () => [timingReservation],
  now: () => now,
  platform: "ios",
  supported: true
});
const partialResult = await partialManager.sync({ force: true, silent: true });
assert.match(partialResult.error, /partial native failure/, "silent sync should report native scheduling failures without rejecting");
assert(JSON.parse(storage.get("gju_native_notifications_v2:partial-user:ids")).length > 0, "possibly accepted native notifications must remain owned after a scheduling failure");

let raceUser = "race-a";
let releasePermission;
let permissionStarted;
const permissionGate = new Promise((resolve) => { releasePermission = resolve; });
const permissionObserved = new Promise((resolve) => { permissionStarted = resolve; });
const raceScheduled = [];
const racePlugin = {
  ...plugin,
  checkPermissions: async () => {
    permissionStarted();
    await permissionGate;
    return { display: "granted" };
  },
  schedule: async ({ notifications }) => raceScheduled.push(...notifications)
};
storage.set("gju_native_notifications_v2:race-a:enabled", "true");
const raceManager = createNotificationManager({
  plugin: racePlugin,
  storage: globalThis.localStorage,
  userId: () => raceUser,
  role: "student",
  reservations: () => [timingReservation],
  now: () => now,
  platform: "ios",
  supported: true
});
const racingSync = raceManager.sync({ force: true });
await permissionObserved;
raceUser = "race-b";
const racingCleanup = raceManager.clearAccount("race-a");
releasePermission();
await Promise.all([racingSync, racingCleanup]);
const expectedRaceIds = new Set(["day-before", "hour-before", "ten-min-before", "start"].map((key) => stableNotificationId(`race-a:${timingReservation.id}:${key}`)));
assert.deepEqual(new Set(raceScheduled.map((item) => item.id)), expectedRaceIds, "account snapshot should remain stable while permission is pending");
assert.equal(storage.get("gju_native_notifications_v2:race-a:ids"), "[]", "queued account cleanup should cancel reminders created by an in-flight sync");
assert.equal(storage.has("gju_native_notifications_v2:race-b:ids"), false, "an in-flight sync must not write IDs into the next account");

let queuedAccount = "queued-a";
const queuedAccountStore = memoryStorage({
  "gju_native_notifications_v2:queued-a:enabled": "true",
  "gju_native_notifications_v2:queued-b:enabled": "true"
});
const queuedAccountManager = createNotificationManager({
  plugin: { ...plugin, schedule: async () => {} },
  storage: queuedAccountStore,
  userId: () => queuedAccount,
  role: "student",
  reservations: () => [timingReservation],
  now: () => now,
  platform: "ios",
  supported: true
});
const queuedA = queuedAccountManager.sync({ force: true });
queuedAccount = "queued-b";
const queuedB = queuedAccountManager.sync({ force: true });
await Promise.all([queuedA, queuedB]);
assert.deepEqual(JSON.parse(queuedAccountStore.getItem("gju_native_notifications_v2:queued-a:ids")), [], "a queued account switch should clear reminders scheduled by the previous account operation");
assert(JSON.parse(queuedAccountStore.getItem("gju_native_notifications_v2:queued-b:ids")).length > 0, "the newest queued account should retain only its own reminders");
assert.equal(queuedAccountStore.getItem("gju_native_notifications_v2:activeAccount"), "queued-b", "queued activation should finish on the newest account");

const notifyRaceEvents = [];
let notifyScheduleStarted;
const notifyScheduleObserved = new Promise((resolve) => { notifyScheduleStarted = resolve; });
const notifyRacePlugin = {
  ...plugin,
  schedule: async () => {
    notifyRaceEvents.push("schedule-start");
    notifyScheduleStarted();
    await new Promise((resolve) => setTimeout(resolve, 10));
    notifyRaceEvents.push("schedule-done");
  },
  cancel: async () => notifyRaceEvents.push("cancel"),
  removeDeliveredNotifications: async ({ notifications }) => notifyRaceEvents.push(["delivered-remove", notifications.map(({ id }) => id)])
};
storage.set("gju_native_notifications_v2:notify-race:enabled", "true");
storage.set("gju_native_notifications_v2:other-user:deliveredIds", JSON.stringify([1234]));
storage.set("gju_native_notifications_v2:activeAccount", "notify-race");
const notifyRaceManager = createNotificationManager({
  plugin: notifyRacePlugin,
  storage: globalThis.localStorage,
  userId: "notify-race",
  role: "student",
  reservations: [],
  now: () => now,
  platform: "ios",
  supported: true
});
const racingCreated = notifyRaceManager.notifyCreated(timingReservation);
await notifyScheduleObserved;
const cleanupAfterCreated = notifyRaceManager.clearAccount();
await Promise.all([racingCreated, cleanupAfterCreated]);
const scheduleDoneIndex = notifyRaceEvents.indexOf("schedule-done");
const deliveredRemoveIndex = notifyRaceEvents.findIndex((event) => Array.isArray(event) && event[0] === "delivered-remove");
assert(deliveredRemoveIndex > scheduleDoneIndex, "created notifications and account cleanup should share one serialization queue");
assert.equal(notifyRaceEvents[deliveredRemoveIndex][1].includes(1234), false, "clearing one account must not remove another account's delivered IDs");
assert.equal(storage.get("gju_native_notifications_v2:notify-race:deliveredIds"), "[]", "successful cleanup should release delivered ID ownership");

const revokedStore = memoryStorage({
  "gju_native_notifications_v2:activeAccount": "revoked-user",
  "gju_native_notifications_v2:revoked-user:ids": JSON.stringify([4101]),
  "gju_native_notifications_v2:revoked-user:deliveredIds": JSON.stringify([4102])
});
const revokedCalls = [];
const revokedManager = createNotificationManager({
  plugin: {
    ...plugin,
    cancel: async ({ notifications }) => revokedCalls.push(["cancel", notifications.map(({ id }) => id)]),
    removeDeliveredNotifications: async ({ notifications }) => revokedCalls.push(["delivered", notifications.map(({ id }) => id)])
  },
  storage: revokedStore,
  userId: "anonymous",
  role: "student",
  reservations: [],
  now: () => now,
  platform: "ios",
  supported: true
});
await revokedManager.initialize();
assert(revokedCalls.some(([kind, ids]) => kind === "cancel" && ids.includes(4101)), "initialization without a session should clear the previously active account's pending reminders");
assert(revokedCalls.some(([kind, ids]) => kind === "delivered" && ids.includes(4102)), "initialization without a session should clear the previously active account's delivered reminders");
assert.equal(revokedStore.getItem("gju_native_notifications_v2:activeAccount"), "", "successful remote-session cleanup should forget the prior active account");

const deliveredStore = memoryStorage({ "gju_native_notifications_v2:many-delivered:enabled": "true" });
const deliveredRemoved = [];
const deliveredManager = createNotificationManager({
  plugin: {
    ...plugin,
    schedule: async () => {},
    removeDeliveredNotifications: async ({ notifications }) => deliveredRemoved.push(...notifications.map(({ id }) => id))
  },
  storage: deliveredStore,
  userId: "many-delivered",
  role: "student",
  reservations: [],
  now: () => now,
  platform: "ios",
  supported: true
});
for (let index = 0; index < 65; index += 1) {
  await deliveredManager.notifyCreated({ ...timingReservation, id: `created-${index}` });
}
assert.equal(JSON.parse(deliveredStore.getItem("gju_native_notifications_v2:many-delivered:deliveredIds")).length, 65, "delivered notification ownership must not be truncated at the pending limit");
await deliveredManager.clearAccount();
assert.equal(deliveredRemoved.length, 65, "account cleanup should remove every owned delivered notification");

const capStore = memoryStorage({ "gju_native_notifications_v2:cap-user:enabled": "true" });
let cappedNativeBatch = [];
const capPlugin = {
  ...plugin,
  getPending: async () => ({ notifications: Array.from({ length: 5 }, (_, index) => ({ id: 5000 + index })) }),
  schedule: async ({ notifications }) => { cappedNativeBatch = notifications; }
};
const capManager = createNotificationManager({
  plugin: capPlugin,
  storage: capStore,
  userId: "cap-user",
  role: "student",
  reservations: manyReservations,
  now: () => now,
  platform: "ios",
  supported: true
});
await capManager.sync({ force: true });
assert.equal(cappedNativeBatch.length, 59, "iOS synchronization should reserve slots already occupied by stale pending requests");
const conservativeCapStore = memoryStorage({
  "gju_native_notifications_v2:storage-owner:ids": JSON.stringify(Array.from({ length: 10 }, (_, index) => 8000 + index)),
  "gju_native_notifications_v2:conservative-user:enabled": "true"
});
let conservativeBatch = [];
const conservativeCapManager = createNotificationManager({
  plugin: {
    ...plugin,
    getPending: async () => ({ notifications: Array.from({ length: 5 }, (_, index) => ({ id: 9000 + index })) }),
    cancel: async ({ notifications }) => {
      if (notifications.some(({ id }) => id >= 8000 && id < 8010)) throw new Error("stale owner cleanup failed");
    },
    schedule: async ({ notifications }) => { conservativeBatch = notifications; }
  },
  storage: conservativeCapStore,
  userId: "conservative-user",
  role: "student",
  reservations: manyReservations,
  now: () => now,
  platform: "ios",
  supported: true
});
await conservativeCapManager.sync({ force: true });
assert.equal(conservativeBatch.length, 54, "iOS capacity should use the larger native or persisted pending estimate");

let inspectionFailureSchedules = 0;
const inspectionFailureManager = createNotificationManager({
  plugin: {
    ...plugin,
    getPending: async () => { throw new Error("pending unavailable"); },
    schedule: async ({ notifications }) => { inspectionFailureSchedules += notifications.length; }
  },
  storage: memoryStorage({ "gju_native_notifications_v2:inspection-user:enabled": "true" }),
  userId: "inspection-user",
  role: "student",
  reservations: manyReservations,
  now: () => now,
  platform: "ios",
  supported: true
});
await inspectionFailureManager.sync({ force: true });
assert.equal(inspectionFailureSchedules, 0, "iOS must not add pending reminders when native capacity inspection fails");
await assert.rejects(() => inspectionFailureManager.scheduleDiagnostic(10), /64개 한도/, "diagnostics should also fail closed when iOS capacity is unknown");
const fullPendingManager = createNotificationManager({
  plugin: {
    ...plugin,
    getPending: async () => ({ notifications: Array.from({ length: 64 }, (_, index) => ({ id: 7000 + index })) })
  },
  storage: memoryStorage(),
  userId: "full-user",
  role: "student",
  reservations: [],
  now: () => now,
  platform: "ios",
  supported: true
});
await assert.rejects(() => fullPendingManager.scheduleDiagnostic(10), /64개 한도/, "diagnostic reminders must not bypass the iOS pending-request ceiling");
assert(stableNotificationId("same") < 2_000_000_000, "production notification IDs should stay below the diagnostic namespace");
assert(diagnosticNotificationId("same") >= 2_000_000_000, "diagnostic notification IDs should use a disjoint reserved namespace");
assert.notEqual(stableNotificationId("same"), diagnosticNotificationId("same"), "production and diagnostic IDs must never collide for the same seed");

const routineStore = memoryStorage({
  "gju_native_notifications_v2:routine-user:enabled": "true",
  "gju_native_notifications_v2:routine-user:ids": JSON.stringify([6101]),
  "gju_native_notifications_v2:routine-user:deliveredIds": JSON.stringify([6102]),
  "gju_native_notifications_v2:routine-user:diagnosticIds": JSON.stringify([6103])
});
const routineDeliveredRemovals = [];
const routineCancels = [];
const routineManager = createNotificationManager({
  plugin: {
    ...plugin,
    cancel: async ({ notifications }) => routineCancels.push(notifications.map(({ id }) => id)),
    removeDeliveredNotifications: async ({ notifications }) => routineDeliveredRemovals.push(notifications.map(({ id }) => id)),
    schedule: async () => {}
  },
  storage: routineStore,
  userId: "routine-user",
  role: "student",
  reservations: [timingReservation],
  now: () => now,
  platform: "ios",
  supported: true
});
await routineManager.sync({ force: true });
assert.equal(routineDeliveredRemovals.length, 0, "routine synchronization must not remove delivered reservation confirmations");
assert.deepEqual(JSON.parse(routineStore.getItem("gju_native_notifications_v2:routine-user:deliveredIds")).sort((a, b) => a - b), [6101, 6102], "routine synchronization should retain both previously pending and delivered ownership for eventual account cleanup");
await routineManager.cancelDiagnostics();
assert(routineCancels.some((ids) => ids.length === 1 && ids[0] === 6103), "diagnostic cancellation should target only diagnostic pending IDs");
assert(routineDeliveredRemovals.some((ids) => ids.length === 1 && ids[0] === 6103), "diagnostic cancellation should remove only diagnostic delivered IDs");
assert(JSON.parse(routineStore.getItem("gju_native_notifications_v2:routine-user:ids")).length > 0, "diagnostic cancellation must preserve production reminder ownership");
await routineManager.clearAccount();
assert(routineDeliveredRemovals.some((ids) => ids.includes(6101) && ids.includes(6102)), "account cleanup must remove every routine reminder that may already have been delivered");

const oldAndroidStore = memoryStorage({ "gju_native_notifications_v2:android-user:enabled": "true" });
let oldAndroidScheduled = 0;
const oldAndroidManager = createNotificationManager({
  plugin: {
    ...plugin,
    createChannel: async () => { throw new Error("Notification channels require API 26"); },
    schedule: async ({ notifications }) => { oldAndroidScheduled += notifications.length; }
  },
  storage: oldAndroidStore,
  userId: "android-user",
  role: "student",
  reservations: [timingReservation],
  now: () => now,
  platform: "android",
  supported: true
});
await oldAndroidManager.sync({ force: true });
assert.equal(oldAndroidScheduled, 4, "Android API 24-25 should still schedule through the default channel when channel creation is unavailable");

permissionState = "denied";
const deniedManager = createNotificationManager({
  plugin,
  storage: globalThis.localStorage,
  userId: "denied-user",
  role: "student",
  reservations: [],
  now: () => now,
  platform: "ios",
  supported: true
});
await assert.rejects(() => deniedManager.enable(), /기기 설정/, "permission denial should be surfaced separately from an enabled preference");
const deniedStatus = await deniedManager.refresh();
assert.equal(deniedStatus.enabled, false, "permission denial must not leave notifications marked as enabled");
assert.equal(deniedStatus.effective, false, "permission denial must not be reported as effective");
assert.equal(deniedStatus.permission, "denied", "permission status should remain available for settings guidance");
permissionState = "granted";

permissionState = "denied";
globalThis.window.GJU_NATIVE_APP = true;
globalThis.window.Capacitor = {
  getPlatform: () => "ios",
  Plugins: { LocalNotifications: plugin }
};
bridgeState.user = { id: "bridge-denied", role: "student" };
bridgeState.nativeNotifications = { supported: true, enabled: false, effective: false, permission: "prompt" };
await assert.rejects(() => enableNativeReservationNotifications(), /기기 설정/, "bridge enable should still surface permission denial to the UI");
assert.equal(bridgeState.nativeNotifications.permission, "denied", "bridge state should refresh after permission denial");
assert.equal(bridgeState.nativeNotifications.enabled, false, "bridge state should remain disabled after permission denial");
assert.equal(bridgeState.nativeNotifications.effective, false, "bridge state should remain ineffective after permission denial");
permissionState = "granted";

let listenerAttempts = 0;
const retryListenerPlugin = {
  ...plugin,
  addListener: async (event, handler) => {
    listenerAttempts += 1;
    if (listenerAttempts === 1) throw new Error("listener unavailable");
    retryListenerPlugin.listener = handler;
    return { remove: async () => {} };
  },
  schedule: async () => {}
};
const retryListenerManager = createNotificationManager({
  plugin: retryListenerPlugin,
  storage: memoryStorage(),
  userId: "listener-user",
  role: "student",
  reservations: [],
  now: () => now,
  platform: "ios",
  supported: true
});
const listenerInit = await retryListenerManager.initialize({ onAction: () => {} });
assert.match(listenerInit.error, /listener unavailable/, "listener setup failures should be visible after initialization");
const listenerResume = await retryListenerManager.handleResume();
assert.equal(listenerAttempts, 2, "foreground resume should retry a failed notification action listener");
assert.equal(listenerResume.status.error, "", "a successful resume retry should clear the prior listener error");

let bridgeRenderCount = 0;
globalThis.window.GJU_NOTIFICATION_DIAGNOSTICS = true;
globalThis.window.GJU_NOTIFICATION_DIAGNOSTICS_AUTORUN = false;
bridgeState.user = { id: "bridge-student", role: "student" };
await initializeNativeNotifications(() => { bridgeRenderCount += 1; });
plugin.listener({ notification: { extra: { route: "reports", reservationId: "bridge-report" } } });
assert.equal(bridgeState.view, "reports", "bridge action handling should route report reminders to the report screen");
assert.equal(bridgeState.activeReportReservationId, "bridge-report", "bridge action handling should retain the target reservation");
plugin.listener({ notification: { extra: { route: "admin", adminView: "settings" } } });
assert.equal(bridgeState.adminView, "settings", "bridge action handling should route admin reminders to the requested admin screen");
assert.equal(bridgeRenderCount, 2, "notification actions should request one render per route transition");
assert.equal(typeof globalThis.window.GJU_NOTIFICATION_DIAGNOSTICS.scheduleTest, "function", "debug native builds should expose the diagnostic test scheduler");
assert.equal(typeof globalThis.window.GJU_NOTIFICATION_DIAGNOSTICS.pending, "function", "debug native builds should expose pending notification diagnostics");
assert.equal(typeof globalThis.window.GJU_NOTIFICATION_DIAGNOSTICS.cancel, "function", "debug native builds should expose diagnostic cancellation");
const diagnosticStartedAt = Date.now();
const diagnostic = await globalThis.window.GJU_NOTIFICATION_DIAGNOSTICS.scheduleTest(10);
assert(new Date(diagnostic.scheduledAt).getTime() >= diagnosticStartedAt + 9_900, "diagnostic notifications should default to a predictable short delay");
assert.deepEqual(await globalThis.window.GJU_NOTIFICATION_DIAGNOSTICS.pending(), [], "diagnostics should expose the native pending list");
await globalThis.window.GJU_NOTIFICATION_DIAGNOSTICS.cancel();

const { loadMe } = await import("../public/js/data.js?v=20260714-mobile-card-r6");
bridgeState.user = { id: "expired-user", role: "student" };
bridgeState.token = "expired-token";
globalThis.localStorage.setItem("gju_token", "expired-token");
globalThis.fetch = async () => ({
  status: 401,
  json: async () => ({ ok: false, error: "세션이 만료되었습니다." })
});
await loadMe();
assert.equal(bridgeState.user, null, "expired or remotely revoked sessions should clear the previous in-memory account");
assert.equal(bridgeState.token, "", "expired or remotely revoked sessions should clear the stored token before notification initialization");
assert.equal(globalThis.localStorage.getItem("gju_token"), "", "expired or remotely revoked sessions should remove persistent authentication");

const { createNativeAppResumeLifecycle } = await import("../public/js/native-app-lifecycle.js");
let appStateListener = null;
let resumeRuns = 0;
let activeResumeRuns = 0;
let maximumConcurrentResumeRuns = 0;
const resumeErrors = [];
const resumeLifecycle = createNativeAppResumeLifecycle({
  isNative: true,
  appPlugin: {
    addListener: async (event, listener) => {
      assert.equal(event, "appStateChange");
      appStateListener = listener;
      return { remove: async () => {} };
    }
  },
  onResume: async () => {
    resumeRuns += 1;
    activeResumeRuns += 1;
    maximumConcurrentResumeRuns = Math.max(maximumConcurrentResumeRuns, activeResumeRuns);
    await new Promise((resolve) => setTimeout(resolve, 1));
    activeResumeRuns -= 1;
    if (resumeRuns === 1) throw new Error("first resume failed");
  },
  onError: (error) => resumeErrors.push(error.message)
});
assert.equal(await resumeLifecycle.setup(), true, "native lifecycle should subscribe when the App plugin is available");
appStateListener({ isActive: false });
appStateListener({ isActive: true });
appStateListener({ isActive: true });
await resumeLifecycle.drain();
assert.equal(resumeRuns, 2, "inactive transitions must be ignored and each foreground event must run");
assert.equal(maximumConcurrentResumeRuns, 1, "foreground refreshes must be serialized");
assert.deepEqual(resumeErrors, ["first resume failed"], "one failed resume must be reported without blocking the next event");

assert.equal(stableNotificationId("same"), stableNotificationId("same"), "notification IDs should be stable");
console.log("Native notification planner/manager checks passed.");
