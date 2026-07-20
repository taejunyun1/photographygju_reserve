import assert from "node:assert/strict";

let appWriteCount = 0;
let frameVisible = false;
const mountCalls = [];
const updateCalls = [];
const unmountCalls = [];
const apiRequests = [];
const apiResponses = [];
const promptResponses = [];
const listeners = new Map();
const reactAdminChrome = { innerHTML: "" };
const reactAdminRoot = { id: "react-admin-root", innerHTML: "", mountedSubtree: null };
const app = {
  _innerHTML: "",
  set innerHTML(value) {
    this._innerHTML = value;
    appWriteCount += 1;
    frameVisible = value.includes('id="react-admin-root"');
    if (!value.includes('id="react-admin-chrome"')) reactAdminChrome.innerHTML = "";
  },
  get innerHTML() {
    return this._innerHTML;
  }
};
let adminActions;

globalThis.CustomEvent = class CustomEvent {
  constructor(type) {
    this.type = type;
  }
};
globalThis.requestAnimationFrame = (callback) => {
  callback();
  return 0;
};
globalThis.confirm = () => true;
globalThis.prompt = () => promptResponses.shift() ?? "DELETE";
globalThis.alert = () => {};
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(String(input), "https://admin.test");
  apiRequests.push({ path: `${url.pathname}${url.search}`, method: options.method || "GET", body: options.body || "" });
  const response = apiResponses.shift();
  if (!response) throw new Error(`Unexpected API request: ${options.method || "GET"} ${url.pathname}${url.search}`);
  return {
    status: response.status || 200,
    async json() {
      return response.payload;
    }
  };
};
globalThis.document = {
  documentElement: { scrollTop: 0 },
  body: { scrollTop: 0 },
  addEventListener(type, handler) {
    const handlers = listeners.get(type) || [];
    handlers.push(handler);
    listeners.set(type, handlers);
  },
  dispatchEvent(event) {
    for (const handler of listeners.get(event.type) || []) handler(event);
    return true;
  },
  querySelector(selector) {
    if (selector === "#app") return app;
    if (selector === "#react-admin-root") return frameVisible ? reactAdminRoot : null;
    if (selector === "#react-admin-chrome") return frameVisible ? reactAdminChrome : null;
    return null;
  },
  querySelectorAll() {
    return [];
  }
};
globalThis.window = {
  GJU_REACT_ADMIN_ENABLED: true,
  GJUReactAdmin: {
    mount(options) {
      mountCalls.push(options.root);
      adminActions = options.actions;
      options.root.innerHTML = `<section data-render="${mountCalls.length}" data-refreshing="${String(Boolean(options.state.adminRefresh?.refreshing))}" data-notices="${String(options.state.adminNotices?.length || 0)}">legacy admin</section>`;
      options.root.mountedSubtree = { render: mountCalls.length, refreshing: Boolean(options.state.adminRefresh?.refreshing) };
    },
    update(options) {
      updateCalls.push(options.root);
      adminActions = options.actions;
      options.root.innerHTML = `<section data-render="update:${updateCalls.length}" data-refreshing="${String(Boolean(options.state.adminRefresh?.refreshing))}" data-notices="${String(options.state.adminNotices?.length || 0)}">legacy admin</section>`;
      options.root.mountedSubtree = { render: mountCalls.length, update: updateCalls.length, refreshing: Boolean(options.state.adminRefresh?.refreshing) };
    },
    unmount() {
      unmountCalls.push(true);
      reactAdminRoot.innerHTML = "";
      reactAdminRoot.mountedSubtree = null;
    }
  },
  scrollX: 0,
  scrollY: 0,
  scrollTo() {}
};
globalThis.localStorage = {
  getItem() {
    return "";
  },
  setItem() {},
  removeItem() {}
};
globalThis.sessionStorage = globalThis.localStorage;

const { state } = await import("../public/js/state.js?v=20260714-mobile-card-r6");
const { render, toast } = await import("../public/js/renderer.js?v=20260714-mobile-card-r6");

state.bootstrap = { settings: { blockedSchedules: [] } };
state.user = { id: "admin1", role: "admin", name: "관리자", email: "admin@gju.local" };
state.reactAdminEnabled = true;
state.loadingCount = 0;
state.toast = "";

render();

assert.equal(appWriteCount, 1, "initial React Admin render must write the shell once");
assert.equal(mountCalls.length, 1, "initial React Admin render must mount the bundle");
assert.equal(updateCalls.length, 0, "initial React Admin render must not call update before mount");
assert.equal(unmountCalls.length, 0, "initial React Admin render must not unmount");

const initialRoot = mountCalls[0];
state.toast = "브리지 확인";
render();

assert.equal(appWriteCount, 1, "toast renders inside React Admin must preserve the mounted shell");
assert.equal(mountCalls.length, 1, "toast renders inside React Admin must not remount the bundle");
assert.equal(updateCalls.length, 1, "toast renders inside React Admin must update the mounted bundle");
assert.equal(unmountCalls.length, 0, "toast renders inside React Admin must not unmount the bundle");
assert(reactAdminChrome.innerHTML.includes("toast"), "toast renders inside React Admin must update the surrounding chrome");
assert(reactAdminRoot.innerHTML.includes('data-render="update:1"'), "toast renders inside React Admin must update the existing React Admin tree");

state.loadingCount = 1;
document.dispatchEvent(new CustomEvent("gju-loading-change"));

assert.equal(appWriteCount, 1, "loading overlay renders inside React Admin must preserve the mounted shell");
assert.equal(mountCalls.length, 1, "loading overlay renders inside React Admin must not remount the bundle");
assert.equal(updateCalls.length, 2, "loading overlay renders inside React Admin must update the mounted bundle");
assert.equal(unmountCalls.length, 0, "loading overlay renders inside React Admin must not unmount the bundle");
assert(reactAdminChrome.innerHTML.includes("loading-overlay"), "loading overlay renders inside React Admin must update the surrounding chrome");
assert(reactAdminRoot.innerHTML.includes('data-render="update:2"'), "loading overlay renders inside React Admin must update the existing React Admin tree");

state.adminRefresh = { refreshing: true };
render();

assert.equal(appWriteCount, 1, "refresh busy-state renders inside React Admin must preserve the mounted shell");
assert.equal(mountCalls.length, 1, "refresh busy-state renders inside React Admin must not remount the bundle");
assert.equal(updateCalls.length, 3, "refresh busy-state renders inside React Admin must update the mounted bundle");
assert.equal(unmountCalls.length, 0, "refresh busy-state renders inside React Admin must not unmount the bundle");
assert(reactAdminRoot.innerHTML.includes('data-refreshing="true"'), "refresh busy-state renders inside React Admin must propagate the refreshing flag");

state.adminRefresh = { refreshing: false };
render();

assert.equal(appWriteCount, 1, "refresh clear renders inside React Admin must preserve the mounted shell");
assert.equal(mountCalls.length, 1, "refresh clear renders inside React Admin must not remount the bundle");
assert.equal(updateCalls.length, 4, "refresh clear renders inside React Admin must update the mounted bundle");
assert.equal(unmountCalls.length, 0, "refresh clear renders inside React Admin must not unmount the bundle");
assert(reactAdminRoot.innerHTML.includes('data-refreshing="false"'), "refresh clear renders inside React Admin must clear the refreshing flag");

state.loadingCount = 0;
toast("한 번만 안내", { duration: 20 });
assert(reactAdminChrome.innerHTML.includes('role="status"'), "a new success toast invocation must expose status semantics");
assert(reactAdminChrome.innerHTML.includes('aria-live="polite"'), "a new success toast invocation must announce politely");
render();
assert(reactAdminChrome.innerHTML.includes("한 번만 안내"), "a repeated render must keep the visible toast");
assert(reactAdminChrome.innerHTML.includes('aria-live="off"'), "a repeated render of the same toast invocation must be inert");
assert(!reactAdminChrome.innerHTML.includes('role="status"'), "a repeated render must not announce the same success toast again");
toast("한 번만 안내", { duration: 20 });
assert(reactAdminChrome.innerHTML.includes('role="status"'), "a new invocation of identical toast text must announce again");
toast("오류 안내", { tone: "error", duration: 20 });
assert(reactAdminChrome.innerHTML.includes('role="alert"'), "a new error toast invocation must expose alert semantics");
assert(reactAdminChrome.innerHTML.includes('aria-live="assertive"'), "a new error toast invocation must announce assertively");

apiResponses.push({ status: 500, payload: { ok: false, error: "notice save failed" } });
await assert.rejects(
  () => adminActions.createNotice({ title: "실패 공지", body: "본문", active: true }),
  /notice save failed/,
  "typed Admin mutations must reject when the API mutation fails"
);
assert.equal(apiRequests.at(-1).method, "POST");
assert.equal(apiRequests.at(-1).path, "/api/admin/notices");
assert(reactAdminChrome.innerHTML.includes("notice save failed"), "failed typed mutations must still surface their error toast");

apiResponses.push(
  { payload: { ok: true, data: { id: "notice-created" } } },
  { status: 503, payload: { ok: false, error: "notice refresh failed" } }
);
await assert.doesNotReject(
  () => adminActions.createNotice({ title: "저장 공지", body: "본문", active: true }),
  "a successful mutation must stay resolved when its follow-up refresh fails"
);
assert(reactAdminChrome.innerHTML.includes("공지를 등록했습니다."), "refresh failure warning must retain the successful mutation result");
assert(reactAdminChrome.innerHTML.includes("notice refresh failed"), "refresh failure warning must explain the separate refresh failure");

state.adminNotices = [];
apiResponses.push(
  { payload: { ok: true, data: { id: "notice-rendered" } } },
  { payload: { ok: true, data: { items: [{ id: "notice-rendered" }], total: 1, collectionTotal: 1, page: 1, pageSize: 100, hasMore: false } } }
);
await adminActions.createNotice({ title: "렌더 공지", body: "본문", active: true });
assert(reactAdminRoot.innerHTML.includes('data-notices="1"'), "a successful follow-up refresh must render its applied state");

apiResponses.push(
  { payload: { ok: true, data: { id: "notice-one", deletedNotices: 1 } } },
  { payload: { ok: true, data: { items: [], total: 0, collectionTotal: 0, page: 1, pageSize: 100, hasMore: false } } }
);
await adminActions.deleteNotice("notice-one", "단건 공지");
assert.equal(apiRequests.at(-2).method, "DELETE", "single notice deletion must use a dedicated DELETE request");
assert.equal(apiRequests.at(-2).path, "/api/admin/notices/notice-one", "single notice deletion must target the exact notice id");

apiResponses.push({ payload: { ok: true, data: { id: "notice-missing", deletedNotices: 0 } } });
await assert.rejects(
  () => adminActions.deleteNotice("notice-missing", "없는 공지"),
  /삭제 건수를 확인할 수 없습니다/,
  "single notice deletion must reject an API response that did not delete exactly one record"
);

state.adminReportsPage = { total: 2, collectionTotal: 2, page: 1, pageSize: 100 };
apiResponses.push(
  { payload: { ok: true, data: { id: "report-review", status: "reviewed" } } },
  { payload: { ok: true, data: { items: [{ id: "report-review", status: "reviewed" }], total: 1, collectionTotal: 1, page: 1, pageSize: 100, hasMore: false } } }
);
await adminActions.reviewReport("report-review");
const reviewReportRequest = apiRequests.at(-2);
assert.equal(reviewReportRequest.method, "PATCH");
assert.equal(reviewReportRequest.path, "/api/admin/reports/report-review/status");
assert.deepEqual(JSON.parse(reviewReportRequest.body), { status: "reviewed" });

const unsafeFilteredRequestCount = apiRequests.length;
await adminActions.bulkDeleteReports({ q: "", semester: "all" });
assert.equal(apiRequests.length, unsafeFilteredRequestCount, "filtered deletion without an effective filter must stop before the API");
await adminActions.bulkDeleteReports({ q: "matches-everything", semester: "all" });
assert.equal(apiRequests.length, unsafeFilteredRequestCount, "filtered deletion equal to collectionTotal must require the separate full-delete action");

state.adminReportsPage = { total: 1, collectionTotal: 2, page: 1, pageSize: 100 };
promptResponses.push("DELETE");
apiResponses.push(
  { payload: { ok: true, data: { deletedReports: 1 } } },
  { payload: { ok: true, data: { items: [], total: 0, collectionTotal: 1, page: 1, pageSize: 100, hasMore: false } } }
);
await adminActions.bulkDeleteReports({ q: "filtered", semester: "all" });
const filteredDeleteRequest = apiRequests.at(-2);
assert.equal(filteredDeleteRequest.method, "DELETE");
assert.equal(JSON.parse(filteredDeleteRequest.body).scope, "filtered", "filtered deletion must send scope=filtered");

state.adminReservationsPage = { total: 1, collectionTotal: 3, page: 1, pageSize: 100 };
promptResponses.push("DELETE");
apiResponses.push(
  { payload: { ok: true, data: { deletedReservations: 1, deletedReports: 0 } } },
  { payload: { ok: true, data: { items: [], total: 0, collectionTotal: 2, page: 1, pageSize: 100, hasMore: false, semesterOptions: [] } } }
);
await adminActions.bulkDeleteReservations({ q: "needle", type: "studio", status: "completed", semester: "all" });
const searchedReservationDeleteBody = JSON.parse(apiRequests.at(-2).body);
assert.deepEqual(
  searchedReservationDeleteBody.filters,
  { q: "needle" },
  "reservation search deletion must ignore stale type and status tabs just like the list request"
);

state.adminReservationsPage = { total: 1, collectionTotal: 3, page: 1, pageSize: 100 };
promptResponses.push("DELETE");
apiResponses.push(
  { payload: { ok: true, data: { deletedReservations: 1, deletedReports: 0 } } },
  { payload: { ok: true, data: { items: [], total: 0, collectionTotal: 2, page: 1, pageSize: 100, hasMore: false, semesterOptions: [] } } }
);
await adminActions.bulkDeleteReservations({ q: "", type: "studio", status: "returned", semester: "all" });
const facilityReservationDeleteBody = JSON.parse(apiRequests.at(-2).body);
assert.deepEqual(
  facilityReservationDeleteBody.filters,
  { type: "studio" },
  "facility reservation deletion must ignore a stale equipment status filter just like the list request"
);

promptResponses.push("전체 삭제");
apiResponses.push(
  { payload: { ok: true, data: { deletedReports: 2 } } },
  { payload: { ok: true, data: { items: [], total: 0, collectionTotal: 0, page: 1, pageSize: 100, hasMore: false } } }
);
await adminActions.deleteAllReports(2);
const fullDeleteRequest = apiRequests.at(-2);
const fullDeleteBody = JSON.parse(fullDeleteRequest.body);
assert.equal(fullDeleteBody.scope, "all", "full deletion must send scope=all separately from filtered deletion");
assert.equal(fullDeleteBody.confirmText, "전체 삭제", "full deletion must send the exact server confirmation phrase");

state.reactAdminEnabled = false;
render();

assert.equal(unmountCalls.length, 1, "leaving the React Admin path must unmount the bundle");
assert.equal(appWriteCount, 2, "leaving the React Admin path must replace the shell with legacy admin content");
assert(!app.innerHTML.includes('id="react-admin-root"'), "legacy admin render must remove the React Admin root");
assert.equal(reactAdminRoot.mountedSubtree, null, "leaving the React Admin path must clear the mounted subtree");

console.log("React Admin bridge behavior checks passed.");
