import assert from "node:assert/strict";
import fs from "node:fs";

const { createStudentReactActions, studentReactSnapshot } = await import("../public/js/react-student-adapter.js");

function baseState() {
  return {
    token: "token",
    user: { id: "student-1", role: "student", name: "학생", email: "student@example.com", approvalStatus: "approved" },
    bootstrap: { settings: {}, notices: [], equipment: [], darkroomChemicals: [], reservations: [] },
    view: "home",
    reservationType: "",
    reservationFlowStep: { equipment: "date", studio: "date", darkroom: "date", print: "date" },
    selectedDates: { equipment: "", studio: "", darkroom: "", print: "" },
    selectedEquipmentItemIds: [],
    selectedStudioSlots: [],
    selectedDarkroomSlots: [],
    selectedDarkroomProcessTypes: [],
    selectedDarkroomChemicals: {},
    selectedPrintTypes: [],
    selectedPrintPapers: [],
    selectedPrintSizes: [],
    myReservations: [],
    lectures: [],
    nativeNotifications: { supported: true, enabled: false, permission: "prompt", pendingCount: 0 }
  };
}

function harness(overrides = {}) {
  const state = baseState();
  const calls = [];
  let apiImplementation = async (path, options = {}) => ({ id: "created-1", type: options.body?.type, fields: options.body?.fields || {} });
  const dependencies = {
    state,
    api: (...args) => {
      calls.push(["api", ...args]);
      return apiImplementation(...args);
    },
    render: () => calls.push(["render"]),
    toast: (message, options) => calls.push(["toast", message, options]),
    loadBootstrap: async () => calls.push(["loadBootstrap"]),
    loadMyReservations: async () => calls.push(["loadMyReservations"]),
    loadLectures: async () => calls.push(["loadLectures"]),
    notifyNativeReservationCreated: async (reservation) => calls.push(["notifyCreated", reservation.id]),
    clearNativeNotificationAccount: async (userId) => calls.push(["clearNotifications", userId]),
    enableNativeReservationNotifications: async () => ({ enabled: true }),
    disableNativeReservationNotifications: async () => ({ enabled: false }),
    syncNativeReservationNotifications: async () => ({ scheduled: 2 }),
    handleNativeNotificationResume: async () => calls.push(["notificationResume"]),
    logout: async () => calls.push(["logout"]),
    confirm: () => true,
    ...overrides
  };
  if (overrides.apiImplementation) apiImplementation = overrides.apiImplementation;
  return { state, calls, actions: createStudentReactActions(dependencies) };
}

const snapshotState = baseState();
snapshotState.reservationType = "studio";
snapshotState.selectedDates.studio = "2099-01-05";
const snapshot = studentReactSnapshot(snapshotState, "2099-01-01");
assert.equal(snapshot.today, "2099-01-01");
assert.equal(snapshot.reservationType, "studio");
assert.equal(snapshot.selectedDates.studio, "2099-01-05");
assert.equal(snapshot.user.name, "학생");

const courseDemandBridge = harness({
  apiImplementation: async (path, options = {}) => {
    if (path === "/api/me/course-demand-surveys" && !options.method) {
      return [{
        id: "survey-1",
        title: "2099학년도 2학년 2학기 수요조사",
        academicYear: 2099,
        term: "fall",
        targetStudentYears: [2],
        status: "open",
        isOpen: true,
        catalog: [{ id: "course-a", name: "사진 기획", studentCredit: 3, demandCategory: "art" }],
        response: null
      }];
    }
    if (path === "/api/me/course-demand-surveys/survey-1/response") {
      return {
        id: "survey-1",
        title: "2099학년도 2학년 2학기 수요조사",
        academicYear: 2099,
        term: "fall",
        targetStudentYears: [2],
        status: "open",
        isOpen: true,
        catalog: [{ id: "course-a", name: "사진 기획", studentCredit: 3, demandCategory: "art" }],
        response: { rankings: options.body.rankings, submittedAt: "2099-01-01T00:00:00.000Z" }
      };
    }
    return {};
  }
});
await courseDemandBridge.actions.loadCourseDemandSurveys();
assert.equal(courseDemandBridge.state.courseDemandSurveys[0].id, "survey-1");
assert.equal(courseDemandBridge.state.courseDemandSurveys[0].title, "2099학년도 2학년 2학기 수요조사");
assert.equal(courseDemandBridge.state.courseDemandSurveys[0].catalog[0].demandCategory, "art");
await courseDemandBridge.actions.saveCourseDemandResponse("survey-1", [{ courseId: "course-a", rank: 1 }]);
assert.equal(courseDemandBridge.state.courseDemandSurveys[0].response.rankings[0].rank, 1);
assert(courseDemandBridge.calls.some(([kind, path]) => kind === "api" && path === "/api/me/course-demand-surveys/survey-1/response"), "ranked course demand responses must use the student-only endpoint");

const shortcutsBridge = harness({
  apiImplementation: async (path, options = {}) => {
    if (path === "/api/me/reservation-shortcuts") {
      return {
        favoriteGroups: [{ id: "favorites-camera", name: "카메라", equipmentItemIds: ["equipment-1"] }],
        recentReservations: [{
          id: "shortcut-1",
          type: "equipment",
          status: "returned",
          fields: {
            reservedDate: "2099-01-05",
            period: "당일",
            rentalTime: "10:00",
            returnTime: "17:00",
            equipmentItemIds: ["equipment-1"],
            purpose: "촬영 과제",
            phone: "010-1111-2222"
          }
        }]
      };
    }
    if (path === "/api/me/favorite-equipment-groups") {
      return { favoriteGroups: options.body.groups };
    }
    return { id: "created-1", type: options.body?.type, fields: options.body?.fields || {} };
  }
});
await shortcutsBridge.actions.loadReservationShortcuts();
assert.equal(shortcutsBridge.state.favoriteGroups[0].name, "카메라");
assert.equal(shortcutsBridge.state.recentReservations[0].id, "shortcut-1");
await shortcutsBridge.actions.saveFavoriteGroups([{ id: "favorites-light", name: "조명", equipmentItemIds: ["equipment-2"] }]);
assert.equal(shortcutsBridge.state.favoriteGroups[0].name, "조명");
assert(shortcutsBridge.calls.some(([kind, path]) => kind === "api" && path === "/api/me/favorite-equipment-groups"), "favorite groups must persist through the student API");
shortcutsBridge.state.selectedDates = { equipment: "2099-01-06", studio: "2099-01-07", darkroom: "2099-01-08", print: "2099-01-09" };
shortcutsBridge.actions.startRebooking("shortcut-1");
assert.equal(shortcutsBridge.state.view, "reserve");
assert.equal(shortcutsBridge.state.reservationType, "equipment");
assert.equal(shortcutsBridge.state.selectedEquipmentPeriod, "당일");
assert.deepEqual(shortcutsBridge.state.selectedEquipmentItemIds, ["equipment-1"]);
assert.deepEqual(shortcutsBridge.state.selectedDates, { equipment: "", studio: "", darkroom: "", print: "" }, "rebooking must never copy a previous reservation date");
assert.equal(shortcutsBridge.state.selectedEquipmentRentalTime, "", "rebooking must never copy a previous rental time");
assert.equal(shortcutsBridge.state.selectedEquipmentReturnTime, "", "rebooking must never copy a previous return time");
assert.equal(shortcutsBridge.state.rebookingDetails.fields.purpose, "촬영 과제");
assert.equal(shortcutsBridge.state.rebookingDetails.fields.phone, undefined, "rebooking must not retain a previous stored phone number");

const recommendationBridge = harness({
  apiImplementation: async (path) => {
    if (path === "/api/reservations") {
      throw Object.assign(new Error("requested equipment is unavailable"), { status: 409 });
    }
    if (path === "/api/reservations/recommendations") {
      return {
        alternatives: [{
          kind: "alternate_equipment",
          label: "대체 장비 · 카메라 2",
          patch: { type: "equipment", equipmentItemIds: ["equipment-2"] }
        }]
      };
    }
    return {};
  }
});
const conflictDraft = { type: "equipment", fields: { reservedDate: "2099-01-05", equipmentItemIds: ["equipment-1"], phone: "010-1234-5678" } };
await assert.rejects(() => recommendationBridge.actions.submitReservation(conflictDraft), /unavailable/);
assert.equal(recommendationBridge.state.reservationRecommendations.alternatives.length, 1, "409 reservation failures must load safe alternatives");
assert(recommendationBridge.calls.some(([kind, path]) => kind === "api" && path === "/api/reservations/recommendations"), "recommendations must use the dedicated endpoint");
recommendationBridge.actions.updateReservationSelection({ type: "equipment", equipmentItemIds: ["equipment-2"] });
assert.equal(recommendationBridge.state.reservationRecommendations, null, "changing the reservation draft must clear stale alternatives");

for (const type of ["equipment", "studio", "darkroom", "print"]) {
  const test = harness();
  const draft = { type, fields: { reservedDate: "2099-01-05", phone: "01012345678" } };
  await test.actions.submitReservation(draft);
  const request = test.calls.find(([kind]) => kind === "api");
  assert.equal(request[1], "/api/reservations");
  assert.deepEqual(request[2], { method: "POST", body: draft });
  assert.equal(test.state.view, "mine");
  assert.equal(test.state.myReservations[0].type, type);
  assert(test.calls.some(([kind]) => kind === "notifyCreated"), `${type} should trigger the native confirmation bridge`);

  const rejected = harness({ apiImplementation: async () => { throw new Error(`${type}-rejected`); } });
  await assert.rejects(() => rejected.actions.submitReservation(draft), new RegExp(`${type}-rejected`));
  assert.equal(rejected.state.view, "home", `${type} rejection must preserve the current view`);
  assert.equal(rejected.state.myReservations.length, 0, `${type} rejection must not append optimistic data`);
}

const navigation = harness();
await navigation.actions.setView("mine");
await navigation.actions.setView("reports");
await navigation.actions.setView("lectures");
assert.equal(navigation.calls.filter(([kind]) => kind === "loadMyReservations").length, 2);
assert.equal(navigation.calls.filter(([kind]) => kind === "loadLectures").length, 1);

const reservationNavigation = harness();
reservationNavigation.state.reservationType = "studio";
await reservationNavigation.actions.setView("reserve");
assert.equal(reservationNavigation.state.view, "reserve");
assert.equal(reservationNavigation.state.reservationType, "", "returning to reservation types must close the active form");

const reportRefreshFailure = harness({
  loadBootstrap: async () => { throw new Error("refresh failed"); },
  apiImplementation: async () => ({ id: "report-1" })
});
reportRefreshFailure.state.activeReportReservationId = "studio-1";
reportRefreshFailure.state.myReservations = [{ id: "studio-1", type: "studio", fields: { reportStatus: "required" } }];
await reportRefreshFailure.actions.submitReport("studio-1", { actualTime: "10:00-11:00", participants: "2", cleanupConfirmed: true });
assert.equal(reportRefreshFailure.state.activeReportReservationId, "", "a saved report must close even when the follow-up refresh fails");
assert.equal(reportRefreshFailure.state.myReservations[0].fields.reportStatus, "submitted", "a saved report must update the local reservation immediately");
assert(reportRefreshFailure.calls.some(([kind, message]) => kind === "toast" && message === "스튜디오 보고서가 제출되었습니다."));
assert(reportRefreshFailure.calls.some(([kind, message]) => kind === "toast" && /최신 목록/.test(message)), "refresh failure must be reported separately from mutation success");

const lectureRefreshFailure = harness({
  loadBootstrap: async () => { throw new Error("refresh failed"); },
  apiImplementation: async (_path, options) => ({
    id: "lecture-1",
    title: "테스트 특강",
    applied: options.method === "POST",
    applicationCount: options.method === "POST" ? 1 : 0
  })
});
lectureRefreshFailure.state.lectures = [{ id: "lecture-1", title: "테스트 특강", applied: false, applicationCount: 0 }];
await lectureRefreshFailure.actions.applyLecture("lecture-1");
assert.equal(lectureRefreshFailure.state.lectures[0].applied, true, "successful lecture application must update local state before refresh");
assert(lectureRefreshFailure.calls.some(([kind, message]) => kind === "toast" && message === "특강 신청이 완료되었습니다."));

const password = harness({
  api: async (path, options) => {
    password.calls.push(["api", path, options]);
    return {};
  }
});
await password.actions.changePassword({ currentPassword: "old-password", newPassword: "new-password" });
assert(password.calls.some(([kind, userId]) => kind === "clearNotifications" && userId === "student-1"));
assert.equal(password.state.user, null);
assert.equal(password.state.token, "");

const studentRuntimeSource = fs.readFileSync("src/react/app/student-main.tsx", "utf8");
const rendererSource = fs.readFileSync("public/js/renderer.js", "utf8");
const indexSource = fs.readFileSync("public/index.html", "utf8");
const configSource = fs.readFileSync("public/config.js", "utf8");
const stateSource = fs.readFileSync("public/js/state.js", "utf8");
for (const method of ["mount", "update", "unmount"]) {
  assert(studentRuntimeSource.includes(method), `student browser runtime must expose ${method}`);
}
assert(rendererSource.includes("window.GJUReactStudent?.mount"), "renderer must mount the Student React island");
assert(rendererSource.includes("studentReactSnapshot"), "renderer must pass a typed student snapshot instead of mutable legacy state");
assert(indexSource.includes("react-student.generated.js"), "index must load the generated Student React bundle");
assert(indexSource.includes("react-student.generated.css"), "index must load Student React styles");
assert(configSource.includes("GJU_REACT_STUDENT_ENABLED"), "config must expose the Student React runtime guard");
assert(stateSource.includes("reactStudentEnabled"), "legacy state must default the Student React guard on unless explicitly disabled");

console.log("Student React bridge checks passed.");
