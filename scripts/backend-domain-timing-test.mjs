import assert from "node:assert/strict";
import { handleApiRequest, initialDb } from "../core.mjs";

const db = await initialDb("backend-domain-timing-password");
const token = "backend-domain-timing-token";
db.sessions.push({
  id: "session_backend_domain_timing",
  token,
  userId: "user_admin",
  expiresAt: "2099-12-31T00:00:00.000Z",
  createdAt: "2099-01-01T00:00:00.000Z",
  lastSeenAt: "2099-01-01T00:00:00.000Z"
});

async function api(method, pathname, body = {}) {
  return handleApiRequest({
    method,
    pathname,
    authorization: `Bearer ${token}`,
    readText: async () => JSON.stringify(body),
    db,
    saveDb: async () => {},
    slackWebhook: ""
  });
}

const studioFields = {
  reservedDate: "2099-01-05",
  phone: "01012345678",
  studioSpaces: ["Studio A Front"],
  timeSlots: ["12:00-14:00", "10:30-12:00"],
  reportStatus: "required"
};
const createResponse = await api("POST", "/api/reservations", { type: "studio", fields: studioFields });
assert.equal(createResponse.status, 200);
const createdStudio = createResponse.body.data;
assert.deepEqual(createdStudio.fields, {
  ...studioFields,
  studentStatus: "관리자"
});
assert.deepEqual(createdStudio.timing, {
  startAt: "2099-01-05T01:30:00.000Z",
  endAt: "2099-01-05T05:00:00.000Z",
  reportDeadlineAt: "2099-01-07T05:00:00.000Z"
});

const storedStudio = db.reservations.find((item) => item.id === createdStudio.id);
assert.equal("timing" in storedStudio, false, "computed timing must not be persisted in the reservation record");
assert.deepEqual(storedStudio.fields.timeSlots, studioFields.timeSlots, "timing canonicalization must not reorder stored studio slots");

const midnightStudioCases = [
  {
    reservedDate: "2099-01-12",
    timeSlots: ["00:00-02:00 (야간)", "22:00-24:00 (야간)"],
    timing: {
      startAt: "2099-01-12T13:00:00.000Z",
      endAt: "2099-01-12T17:00:00.000Z",
      reportDeadlineAt: "2099-01-14T17:00:00.000Z"
    }
  },
  {
    reservedDate: "2099-01-13",
    timeSlots: ["22:00-24:00 (야간)", "00:00-02:00 (야간)"],
    timing: {
      startAt: "2099-01-13T13:00:00.000Z",
      endAt: "2099-01-13T17:00:00.000Z",
      reportDeadlineAt: "2099-01-15T17:00:00.000Z"
    }
  }
];

for (const testCase of midnightStudioCases) {
  const fields = {
    reservedDate: testCase.reservedDate,
    phone: "01012345678",
    studioSpaces: ["Studio A Back"],
    timeSlots: testCase.timeSlots,
    reportStatus: "required"
  };
  const response = await api("POST", "/api/reservations", { type: "studio", fields });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.timing, testCase.timing);
  assert.deepEqual(response.body.data.fields.timeSlots, testCase.timeSlots, "studio response fields must retain request order");
  const stored = db.reservations.find((item) => item.id === response.body.data.id);
  assert.deepEqual(stored.fields.timeSlots, testCase.timeSlots, "studio timing must not mutate persisted slot order");
}

const blockedStudioNextDate = "2099-01-21";
const blockedStudioDay = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][
  new Date(`${blockedStudioNextDate}T00:00:00`).getDay()
];
db.settings.blockedSchedules.push({
  id: "blocked-studio-next-date",
  type: "studio",
  day: blockedStudioDay,
  start: "00:00",
  end: "02:00",
  from: blockedStudioNextDate,
  to: blockedStudioNextDate,
  target: "Studio A",
  label: "다음 날짜 수업"
});
const blockedNextDateStudioResponse = await api("POST", "/api/reservations", {
  type: "studio",
  fields: {
    reservedDate: "2099-01-20",
    phone: "01012345678",
    studioSpaces: ["Studio A Front"],
    timeSlots: ["22:00-24:00 (야간)", "00:00-02:00 (야간)"],
    reportStatus: "required"
  }
});
assert.equal(blockedNextDateStudioResponse.status, 409, "post-midnight studio slots must check the actual next calendar date");
assert.match(blockedNextDateStudioResponse.body.error, /다음 날짜 수업/);
db.settings.blockedSchedules = db.settings.blockedSchedules.filter((rule) => rule.id !== "blocked-studio-next-date");

for (const timeSlots of [["00:00-02:00", "22:00-24:00"], ["22:00-24:00", "00:00-02:00"]]) {
  const response = await api("POST", "/api/reservations", {
    type: "darkroom",
    fields: {
      reservedDate: "2099-01-14",
      phone: "01012345678",
      timeSlots,
      participantCount: 1
    }
  });
  assert.equal(response.status, 400, "darkroom slots must retain calendar-day semantics");
  assert.match(response.body.error, /자정|날짜별/);
}

const crossingMidnightDarkroomResponse = await api("POST", "/api/reservations", {
  type: "darkroom",
  fields: {
    reservedDate: "2099-01-15",
    phone: "01012345678",
    timeSlots: ["23:00-01:00"],
    participantCount: 1
  }
});
assert.equal(crossingMidnightDarkroomResponse.status, 400, "a single darkroom range must not cross midnight");
assert.match(crossingMidnightDarkroomResponse.body.error, /자정|날짜별/);

for (const fields of [
  { reservedDate: "2099-01-17", timeSlots: ["22:00-24:00"] },
  { reservedDate: "2099-01-18", timeSlots: ["00:00-02:00"] }
]) {
  const response = await api("POST", "/api/reservations", {
    type: "darkroom",
    fields: { ...fields, phone: "01012345678", participantCount: db.settings.darkroomCapacity }
  });
  assert.equal(response.status, 200, "adjacent midnight slots on separate reserved dates must use independent capacity buckets");
}

const midnightDarkroomCases = [
  {
    reservedDate: "2099-01-16",
    timeSlots: ["12:00-14:00", "10:00-12:00"],
    timing: {
      startAt: "2099-01-16T01:00:00.000Z",
      endAt: "2099-01-16T05:00:00.000Z"
    }
  }
];

for (const testCase of midnightDarkroomCases) {
  const fields = {
    reservedDate: testCase.reservedDate,
    phone: "01012345678",
    timeSlots: testCase.timeSlots,
    participantCount: 1
  };
  const response = await api("POST", "/api/reservations", { type: "darkroom", fields });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.timing, testCase.timing);
  assert.deepEqual(response.body.data.fields.timeSlots, testCase.timeSlots, "darkroom response fields must retain request order");
  const stored = db.reservations.find((item) => item.id === response.body.data.id);
  assert.deepEqual(stored.fields.timeSlots, testCase.timeSlots, "darkroom timing must not mutate persisted slot order");
}

const reservableEquipment = db.equipment.find((item) => item.active && item.reservable && item.category === "Lighting");
assert.ok(reservableEquipment, "a reservable non-camera item is required for equipment timing tests");
const weekendEquipmentFields = {
  reservedDate: "2099-01-09",
  period: "2박3일",
  rentalTime: "17:30",
  returnTime: "10:15",
  phone: "01012345678",
  equipmentItemIds: [reservableEquipment.id]
};
const weekendEquipmentResponse = await api("POST", "/api/reservations", { type: "equipment", fields: weekendEquipmentFields });
assert.equal(weekendEquipmentResponse.status, 200, "a Friday 2박3일 reservation must use the actual create path");
assert.deepEqual(weekendEquipmentResponse.body.data.timing, {
  startAt: "2099-01-09T08:30:00.000Z",
  endAt: "2099-01-11T01:15:00.000Z"
});
assert.equal(weekendEquipmentResponse.body.data.fields.reservedDate, "2099-01-09");
assert.equal(weekendEquipmentResponse.body.data.fields.period, "2박3일");

for (const [rentalTime, returnTime] of [["10:15", "10:15"], ["17:30", "10:15"]]) {
  const invalidSameDayResponse = await api("POST", "/api/reservations", {
    type: "equipment",
    fields: {
      reservedDate: rentalTime === returnTime ? "2099-01-05" : "2099-01-06",
      period: "당일",
      rentalTime,
      returnTime,
      phone: "01012345678",
      equipmentItemIds: [reservableEquipment.id]
    }
  });
  assert.equal(invalidSameDayResponse.status, 400);
  assert.equal(invalidSameDayResponse.body.error, "당일 대여는 반납 시간이 대여 시작 시간보다 늦어야 합니다.");
}

for (const [rentalTime, returnTime] of [
  ["not-a-time", "17:10"],
  ["24:00", "17:10"],
  ["10:15junk", "17:10"],
  ["23:59", "17:10"]
]) {
  const malformedEquipmentResponse = await api("POST", "/api/reservations", {
    type: "equipment",
    fields: {
      reservedDate: "2099-01-19",
      period: "당일",
      rentalTime,
      returnTime,
      phone: "01012345678",
      equipmentItemIds: [reservableEquipment.id]
    }
  });
  assert.equal(malformedEquipmentResponse.status, 400);
  assert.match(malformedEquipmentResponse.body.error, /대여\/반납 시간을 올바르게/);
}

db.reservations.push(
  {
    id: "timing-darkroom",
    type: "darkroom",
    userId: "user_admin",
    status: "approved",
    fields: { reservedDate: "2099-01-06", timeSlots: ["22:00-24:00"] }
  },
  {
    id: "timing-print",
    type: "print",
    userId: "user_admin",
    status: "auto_confirmed",
    fields: { reservedDate: "2099-01-07", startTime: "10:00", endTime: "11:00" }
  }
);

const mineResponse = await api("GET", "/api/reservations/my");
assert.equal(mineResponse.status, 200);
const mine = Object.fromEntries(mineResponse.body.data.map((item) => [item.id, item]));
assert.deepEqual(mine["timing-darkroom"].timing, {
  startAt: "2099-01-06T13:00:00.000Z",
  endAt: "2099-01-06T15:00:00.000Z"
});
assert.deepEqual(mine["timing-print"].timing, {
  startAt: "2099-01-07T01:00:00.000Z",
  endAt: "2099-01-07T02:00:00.000Z"
});
assert.equal("reportDeadlineAt" in weekendEquipmentResponse.body.data.timing, false);

async function studioTimingWithPersistedDeadline(value) {
  db.settings.studioReportDeadlineHours = value;
  const response = await api("GET", "/api/reservations/my");
  assert.equal(response.status, 200);
  return response.body.data.find((item) => item.id === createdStudio.id).timing;
}

assert.equal((await studioTimingWithPersistedDeadline(72)).reportDeadlineAt, "2099-01-08T05:00:00.000Z");
for (const invalidValue of [0, "0", -2, Number.NaN, Number.POSITIVE_INFINITY, "malformed", true, [], [72], { hours: 72 }]) {
  const timing = await studioTimingWithPersistedDeadline(invalidValue);
  assert.equal(timing.reportDeadlineAt, "2099-01-07T05:00:00.000Z", `persisted deadline ${String(invalidValue)} must fall back to 48 hours`);
}

db.settings.studioReportDeadlineHours = 48;
const validDeadlineSetting = await api("PATCH", "/api/admin/settings", { studioReportDeadlineHours: "72.9" });
assert.equal(validDeadlineSetting.status, 200);
assert.equal(validDeadlineSetting.body.data.studioReportDeadlineHours, 72);
assert.equal(typeof db.settings.studioReportDeadlineHours, "number");
for (const invalidValue of [0, 721, "malformed", true, [], [72], { hours: 72 }]) {
  const invalidSetting = await api("PATCH", "/api/admin/settings", { studioReportDeadlineHours: invalidValue });
  assert.equal(invalidSetting.status, 400);
  assert.match(invalidSetting.body.error, /1-720/);
  assert.equal(db.settings.studioReportDeadlineHours, 72, "rejected settings updates must preserve the current deadline");
}
const restoreDeadlineSetting = await api("PATCH", "/api/admin/settings", { studioReportDeadlineHours: 48 });
assert.equal(restoreDeadlineSetting.status, 200);

const bootstrapResponse = await api("GET", "/api/bootstrap");
assert.equal(bootstrapResponse.status, 200);
const bootstrapStudio = bootstrapResponse.body.data.reservations.find((item) => item.id === createdStudio.id);
assert.deepEqual(bootstrapStudio.timing, createdStudio.timing, "bootstrap reservation summaries must expose the same computed timing");

const adminResponse = await api("GET", "/api/admin/reservations");
assert.equal(adminResponse.status, 200);
const adminStudio = adminResponse.body.data.find((item) => item.id === createdStudio.id);
assert.deepEqual(adminStudio.timing, createdStudio.timing, "admin reservation outputs must expose computed timing");
assert.equal(adminStudio.user.name, "admin", "existing admin detail fields must remain present");

const updateResponse = await api("PATCH", `/api/reservations/${createdStudio.id}`, { fields: { phone: "01087654321" } });
assert.equal(updateResponse.status, 200);
assert.equal(updateResponse.body.data.id, createdStudio.id);
assert.equal(updateResponse.body.data.fields.phone, "01087654321");
assert.deepEqual(updateResponse.body.data.fields.timeSlots, studioFields.timeSlots);
assert.deepEqual(updateResponse.body.data.timing, createdStudio.timing);
assert.equal(updateResponse.body.data.user.name, "admin");
assert.equal(Array.isArray(updateResponse.body.data.equipmentItems), true);

const invalidStudioCheckout = await api("PATCH", `/api/admin/reservations/${createdStudio.id}/status`, { status: "checked_out" });
assert.equal(invalidStudioCheckout.status, 400, "studio reservations must reject equipment-only checked_out state");
assert.match(invalidStudioCheckout.body.error, /스튜디오|상태/);

const statusResponse = await api("PATCH", `/api/admin/reservations/${createdStudio.id}/status`, { status: "completed" });
assert.equal(statusResponse.status, 200);
assert.equal(statusResponse.body.data.status, "completed");
assert.deepEqual(statusResponse.body.data.timing, createdStudio.timing);
assert.equal(statusResponse.body.data.fields.phone, "01087654321");

const paginatedResponse = await api("GET", "/api/admin/reservations?page=1&pageSize=200&type=studio");
assert.equal(paginatedResponse.status, 200);
assert.equal(Array.isArray(paginatedResponse.body.data.items), true);
assert.equal(paginatedResponse.body.data.page, 1);
assert.equal(paginatedResponse.body.data.pageSize, 200);
assert.equal(typeof paginatedResponse.body.data.total, "number");
assert.equal(typeof paginatedResponse.body.data.hasMore, "boolean");
const paginatedStudio = paginatedResponse.body.data.items.find((item) => item.id === createdStudio.id);
assert.deepEqual(paginatedStudio.timing, createdStudio.timing);
assert.equal(paginatedStudio.user.name, "admin");

const exportResponse = await api("GET", "/api/admin/export");
assert.equal(exportResponse.status, 200);
assert.equal(Array.isArray(exportResponse.body.data.reservations), true);
assert.equal(typeof exportResponse.body.data.exportedAt, "string");
const exportedStudio = exportResponse.body.data.reservations.find((item) => item.id === createdStudio.id);
assert.deepEqual(exportedStudio.timing, createdStudio.timing);
assert.equal(exportedStudio.status, "completed");
assert.equal(exportedStudio.fields.phone, "01087654321");

const cancelResponse = await api("POST", `/api/reservations/${createdStudio.id}/cancel`, { reason: "timing compatibility test" });
assert.equal(cancelResponse.status, 409, "completed reservations must not be cancelled again");
assert.match(cancelResponse.body.error, /종료|취소/);
assert.equal(storedStudio.status, "completed");
assert.deepEqual(storedStudio.fields.timeSlots, studioFields.timeSlots, "read and mutation responses must not reorder persisted slots");

const createdInquiryEquipment = await api("POST", "/api/admin/equipment", {
  codePrefix: "CAM-REVIEW-001",
  name: "리뷰 카메라",
  category: "Body",
  brand: "Sony",
  model: "FX3",
  source: "department",
  quantity: 1,
  status: "문의",
  reservable: false,
  inquiryOnly: true
});
assert.equal(createdInquiryEquipment.status, 200);
assert.equal(createdInquiryEquipment.body.data[0].code, "CAM-REVIEW-001", "a single explicit codePrefix must preserve the entered equipment code");
assert.equal(createdInquiryEquipment.body.data[0].brand, "Sony");
assert.equal(createdInquiryEquipment.body.data[0].model, "FX3");
assert.equal(createdInquiryEquipment.body.data[0].status, "가능", "inquiry is a reservation mode, not a persisted equipment status");
assert.equal(createdInquiryEquipment.body.data[0].reservable, false);
assert.equal(createdInquiryEquipment.body.data[0].inquiryOnly, true);

const noticeOne = await api("POST", "/api/admin/notices", {
  title: "공개 공지 1",
  body: "첫 번째",
  active: true
});
const noticeTwo = await api("POST", "/api/admin/notices", {
  title: "비공개 공지",
  body: "숨김",
  active: false
});
const noticeThree = await api("POST", "/api/admin/notices", {
  title: "공개 공지 2",
  body: "세 번째",
  active: true
});
assert.equal(noticeOne.status, 200);
assert.equal(noticeTwo.status, 200);
assert.equal(noticeThree.status, 200);
assert.equal(noticeTwo.body.data.active, false);
assert.equal(noticeTwo.body.data.status, "draft");

const noticePage = await api("GET", "/api/admin/notices?page=2&pageSize=1&sort=createdAt&direction=desc");
assert.equal(noticePage.status, 200);
assert.equal(noticePage.body.data.items.length, 1);
assert.equal(noticePage.body.data.total, 3);
assert.equal(noticePage.body.data.collectionTotal, 3);
assert.equal(noticePage.body.data.page, 2);
assert.equal(noticePage.body.data.pageSize, 1);
assert.equal(noticePage.body.data.hasMore, true);

const publicNotices = (await api("GET", "/api/bootstrap")).body.data.notices;
assert.equal(publicNotices.some((notice) => notice.id === noticeOne.body.data.id), true);
assert.equal(publicNotices.some((notice) => notice.id === noticeThree.body.data.id), true);
assert.equal(publicNotices.some((notice) => notice.id === noticeTwo.body.data.id), false, "inactive notices must stay out of the public bootstrap contract");

const singleNoticeDelete = await api("DELETE", `/api/admin/notices/${noticeTwo.body.data.id}`);
assert.equal(singleNoticeDelete.status, 200);
assert.equal(singleNoticeDelete.body.data.id, noticeTwo.body.data.id);
assert.equal(singleNoticeDelete.body.data.deletedNotices, 1);
assert.equal(db.notices.some((notice) => notice.id === noticeTwo.body.data.id), false);

const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
const dateKeyOffset = (dateKey, days) => {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
db.reservations.push({
  id: "dashboard_today_equipment",
  type: "equipment",
  userId: "user_admin",
  status: "checked_out",
  fields: { reservedDate: today, period: "당일", rentalTime: "10:15", returnTime: "17:10", equipmentItemIds: [] },
  history: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});
db.reservations.push({
  id: "dashboard_multiday_return",
  type: "equipment",
  userId: "user_admin",
  status: "checked_out",
  fields: { reservedDate: dateKeyOffset(today, -2), period: "2박3일", rentalTime: "10:15", returnTime: "17:10", equipmentItemIds: [] },
  history: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});
const dashboardSummary = await api("GET", "/api/admin/summary");
assert.equal(dashboardSummary.status, 200);
assert.equal(dashboardSummary.body.data.todaySchedule.some((item) => item.id === "dashboard_today_equipment"), true);
assert.equal(dashboardSummary.body.data.checkoutReturnQueue.some((item) => item.id === "dashboard_today_equipment"), true);
const multidayReturnQueueItem = dashboardSummary.body.data.checkoutReturnQueue.find((item) => item.id === "dashboard_multiday_return");
assert.equal(multidayReturnQueueItem?.queueAction, "return", "multi-day equipment must enter the queue on its computed return date");
assert.equal(multidayReturnQueueItem?.queueAt, `${today}T08:10:00.000Z`, "return queue time must use the computed KST return time");
for (const key of ["weekReservations", "activeEquipment", "availableEquipment", "repairEquipment", "equipmentAvailableRate", "cancelledReservations", "reportQueueCount", "openLectures", "typeCounts", "popularEquipment", "latestNotice"]) {
  assert(Object.hasOwn(dashboardSummary.body.data.metrics, key), `dashboard summary metrics must include ${key}`);
}

console.log("Backend reservation timing and additive response checks passed.");
