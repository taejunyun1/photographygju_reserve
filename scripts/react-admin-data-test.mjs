import assert from "node:assert/strict";

const requests = [];
let releaseDedupedUsers;
let releaseSlowUsers;

globalThis.CustomEvent = class CustomEvent {
  constructor(type) {
    this.type = type;
  }
};
globalThis.document = {
  querySelector: () => null,
  addEventListener() {},
  dispatchEvent() {
    return true;
  }
};
globalThis.window = {
  GJU_API_BASE: "",
  GJU_REACT_ADMIN_ENABLED: true,
  GJUReactAdmin: { mount() {} }
};
globalThis.localStorage = {
  getItem: () => "",
  setItem() {},
  removeItem() {}
};
globalThis.sessionStorage = globalThis.localStorage;

function responseData(path) {
  const url = new URL(path, "https://admin.test");
  if (path === "/api/admin/summary") return { pendingUsers: 3 };
  if (path === "/api/admin/equipment") return [{ id: "equipment-1" }];
  if (path === "/api/admin/sessions") return [{ id: "session-1" }];
  if (path === "/api/admin/logs") return [{ id: "log-1" }];
  if (path === "/api/admin/settings") return { semester: "2026-S2" };
  if (path.startsWith("/api/admin/users")) {
    const query = url.searchParams.get("q") || "default";
    if (query === "last-page") {
      const page = Number(url.searchParams.get("page") || 1);
      return page > 1
        ? { items: [], total: 1, collectionTotal: 1, page, pageSize: 1, hasMore: false }
        : { items: [{ id: "user-last-page" }], total: 1, collectionTotal: 1, page: 1, pageSize: 1, hasMore: false };
    }
    return { items: [{ id: `user-${query}` }], total: 1, page: 1, pageSize: 100, hasMore: false };
  }
  if (path.startsWith("/api/admin/reservations")) {
    return {
      items: [],
      total: 0,
      page: 1,
      pageSize: 100,
      hasMore: false,
      semesterOptions: [{ key: "2026-S2", label: "2026년 2학기" }]
    };
  }
  if (path.startsWith("/api/admin/reports")) {
    return {
      items: [],
      total: 0,
      page: 1,
      pageSize: 100,
      hasMore: false,
      semesterOptions: ["2026-S1"]
    };
  }
  if (path.startsWith("/api/admin/lectures")) {
    return {
      items: [],
      total: 0,
      page: 1,
      pageSize: 100,
      hasMore: false,
      semesterOptions: [
        { key: "2025-S2", label: "2025년 2학기" },
        "2025-S1"
      ]
    };
  }
  if (path.startsWith("/api/admin/notices")) {
    return { items: [{ id: "notice-1" }], total: 1, page: 1, pageSize: 100, hasMore: false };
  }
  return { items: [], total: 0, page: 1, pageSize: 100, hasMore: false };
}

globalThis.fetch = async (input) => {
  const url = new URL(String(input), "https://admin.test");
  const path = `${url.pathname}${url.search}`;
  requests.push(path);
  if (url.pathname === "/api/admin/users" && url.searchParams.get("q") === "dedupe") {
    await new Promise((resolve) => {
      releaseDedupedUsers = resolve;
    });
  }
  if (url.pathname === "/api/admin/users" && url.searchParams.get("q") === "slow") {
    await new Promise((resolve) => {
      releaseSlowUsers = resolve;
    });
  }
  if (url.pathname === "/api/admin/users" && url.searchParams.get("q") === "fail") {
    return {
      status: 500,
      async json() {
        return { ok: false, error: "users request failed" };
      }
    };
  }
  return {
    status: 200,
    async json() {
      return { ok: true, data: responseData(path) };
    }
  };
};

const { state } = await import("../public/js/state.js?v=20260714-mobile-card-r6");
const { loadAdminData, loadAdminView } = await import("../public/js/data.js?react-admin-data-test");

state.user = { id: "admin-1", role: "admin" };
state.bootstrap = { settings: {} };

await loadAdminView("dashboard", { force: true });
assert.deepEqual(requests, ["/api/admin/summary"], "dashboard must request only the summary endpoint");
assert.equal(state.summary.pendingUsers, 3, "dashboard response must update summary state");

const dashboardRequestCount = requests.length;
await loadAdminView("dashboard");
assert.equal(requests.length, dashboardRequestCount, "a warm view cache must avoid a duplicate request");
await loadAdminView("dashboard", { force: true });
assert.equal(requests.length, dashboardRequestCount + 1, "force refresh must bypass the view cache");

const dedupeStart = requests.length;
const firstUsersLoad = loadAdminView("users", {
  q: "dedupe",
  status: "approved",
  page: 1,
  sort: "name",
  direction: "asc",
  force: true
});
const secondUsersLoad = loadAdminView("users", {
  q: "dedupe",
  status: "approved",
  page: 1,
  sort: "name",
  direction: "asc"
});
await Promise.resolve();
assert.equal(requests.length, dedupeStart + 1, "identical in-flight view loads must share one request");
const usersUrl = new URL(requests.at(-1), "https://admin.test");
assert.equal(usersUrl.pathname, "/api/admin/users");
assert.equal(usersUrl.searchParams.get("q"), "dedupe");
assert.equal(usersUrl.searchParams.get("status"), "approved");
assert.equal(usersUrl.searchParams.get("sort"), "name");
assert.equal(usersUrl.searchParams.get("direction"), "asc");
releaseDedupedUsers();
await Promise.all([firstUsersLoad, secondUsersLoad]);
assert.equal(state.adminUsers[0].id, "user-dedupe", "users response must update only users state");

await loadAdminView("users", { q: "warm", force: true });
assert.equal(state.adminUsers[0].id, "user-warm", "warm-cache race setup must prime the requested users result");
const slowUsersLoad = loadAdminView("users", { q: "slow" });
await Promise.resolve();
assert.equal(state.adminUserSearch, "warm", "an in-flight request must keep the visible filter aligned with existing rows");
assert.equal(state.adminUsers[0].id, "user-warm", "an in-flight request must keep existing rows until the response commits");
await loadAdminView("users", { q: "warm" });
assert.equal(state.adminUsers[0].id, "user-warm", "a warm cache switch must apply immediately");
releaseSlowUsers();
await slowUsersLoad;
assert.equal(state.adminUsers[0].id, "user-warm", "an older slow request must not overwrite a newer warm-cache switch");

await assert.rejects(() => loadAdminView("users", { q: "fail", force: true }), /users request failed/);
assert.equal(state.adminUserSearch, "warm", "a failed request must restore the prior visible filter");
assert.equal(state.adminUsers[0].id, "user-warm", "a failed request must preserve the prior visible rows");

const lastPageRequestStart = requests.length;
await loadAdminView("users", { q: "last-page", page: 2, pageSize: 1, force: true });
assert.deepEqual(
  requests.slice(lastPageRequestStart).map((request) => new URL(request, "https://admin.test").searchParams.get("page")),
  ["2", "1"],
  "an empty last page with remaining rows must automatically reload the nearest valid page"
);
assert.equal(state.adminUsersPage.page, 1);
assert.equal(state.adminUsers[0].id, "user-last-page");

await loadAdminView("reservations", { force: true });
assert.deepEqual(
  state.adminReservationSemesters,
  [{ key: "2026-S2", label: "2026년 2학기" }],
  "object semester options must retain their key and label"
);
await loadAdminView("reports", { force: true });
assert.deepEqual(
  state.adminReportSemesters,
  [{ key: "2026-S1", label: "2026년 1학기" }],
  "legacy string semester options must normalize to key-label objects"
);
await loadAdminView("lectures", { force: true });
assert.deepEqual(
  state.adminLectureSemesters,
  [
    { key: "2025-S2", label: "2025년 2학기" },
    { key: "2025-S1", label: "2025년 1학기" }
  ],
  "mixed semester option payloads must normalize without crashing React screens"
);

const logsStart = requests.length;
await loadAdminView("logs", { force: true });
assert.deepEqual(
  requests.slice(logsStart).map((request) => new URL(request, "https://admin.test").pathname).sort(),
  ["/api/admin/logs", "/api/admin/sessions"],
  "logs view must request only sessions and audit logs"
);

await loadAdminView("settings", { force: true });
assert.equal(state.bootstrap.settings.semester, "2026-S2", "settings response must update bootstrap settings");

await loadAdminView("notices", { sort: "title", direction: "desc", force: true });
const noticesUrl = new URL(requests.at(-1), "https://admin.test");
assert.equal(noticesUrl.pathname, "/api/admin/notices");
assert.equal(noticesUrl.searchParams.get("sort"), "title");
assert.equal(noticesUrl.searchParams.get("direction"), "desc");
assert.equal(noticesUrl.searchParams.get("page"), "1", "notices sorting must take the server list path");

const { createAdminListHelpers } = await import("../core/admin-lists.mjs");
const lists = createAdminListHelpers({
  withReservationDetails: (_db, item) => item,
  reportWithDetails: (_db, item) => item,
  publicUser: (item) => item,
  lectureDetail: (_db, item) => item
});

const db = {
  users: [
    { id: "user-b", role: "student", name: "가", approvalStatus: "approved", createdAt: "2026-01-01" },
    { id: "user-a", role: "student", name: "가", approvalStatus: "approved", createdAt: "2026-01-02" },
    { id: "user-c", role: "student", name: "나", approvalStatus: "approval_pending", createdAt: "2026-01-03" }
  ],
  reservations: [
    { id: "reservation-b", fields: { reservedDate: "2026-08-01" }, createdAt: "2026-07-02", status: "approved" },
    { id: "reservation-a", fields: { reservedDate: "2026-08-01" }, createdAt: "2026-07-03", status: "pending" },
    { id: "reservation-c", fields: { reservedDate: "2026-07-01" }, createdAt: "2026-07-01", status: "cancelled" }
  ],
  reports: [
    { id: "report-b", title: "같은 제목", submittedAt: "2026-07-03" },
    { id: "report-a", title: "같은 제목", submittedAt: "2026-07-02" },
    { id: "report-c", title: "다른 제목", submittedAt: "2026-07-01" }
  ],
  lectures: [
    { id: "lecture-b", title: "기초", lectureDate: "2026-09-01" },
    { id: "lecture-a", title: "기초", lectureDate: "2026-08-01" },
    { id: "lecture-c", title: "심화", lectureDate: "2026-07-01" }
  ],
  notices: [
    { id: "notice-b", title: "공지", createdAt: "2026-07-03" },
    { id: "notice-a", title: "공지", createdAt: "2026-07-02" },
    { id: "notice-c", title: "안내", createdAt: "2026-07-01" }
  ]
};

function params(values) {
  return new URLSearchParams({ page: "1", pageSize: "100", ...values });
}

assert.deepEqual(
  lists.adminUserList(db, params({ sort: "name", direction: "asc" })).items.map((item) => item.id),
  ["user-a", "user-b", "user-c"],
  "users must apply allowlisted sort with a stable id tie-breaker"
);
assert.deepEqual(
  lists.adminReservationList(db, params({ sort: "reservedDate", direction: "asc" })).items.map((item) => item.id),
  ["reservation-c", "reservation-a", "reservation-b"],
  "reservations must sort by reserved date with a stable tie-breaker"
);
assert.deepEqual(
  lists.adminReportList(db, params({ sort: "title", direction: "desc" })).items.map((item) => item.id),
  ["report-c", "report-a", "report-b"],
  "reports must apply descending title sort with a stable tie-breaker"
);
assert.deepEqual(
  lists.adminLectureList(db, params({ sort: "title", direction: "asc" })).items.map((item) => item.id),
  ["lecture-a", "lecture-b", "lecture-c"],
  "lectures must apply allowlisted title sort with a stable tie-breaker"
);
assert.deepEqual(
  lists.filterAdminNotices(db, { sort: "title", direction: "asc" }).items.map((item) => item.id),
  ["notice-a", "notice-b", "notice-c"],
  "notices must apply allowlisted title sort with a stable tie-breaker"
);
assert.deepEqual(
  lists.adminReservationList(db, params({ sort: "notAllowed", direction: "asc" })).items.map((item) => item.id),
  ["reservation-a", "reservation-b", "reservation-c"],
  "unsupported sort fields must preserve the existing reservation default"
);

const noticePage = lists.adminNoticeList(db, params({ page: "2", pageSize: "1", sort: "createdAt", direction: "desc" }));
assert.deepEqual(noticePage.items.map((item) => item.id), ["notice-a"], "notice pagination must slice the requested server page");
assert.equal(noticePage.total, 3, "notice pagination must report the filtered total");
assert.equal(noticePage.collectionTotal, 3, "notice pagination must preserve the full collection total");
assert.equal(noticePage.page, 2);
assert.equal(noticePage.pageSize, 1);
assert.equal(noticePage.hasMore, true);

requests.length = 0;
state.reactAdminEnabled = true;
window.GJUReactAdmin = { mount() {} };
await loadAdminData();
assert.deepEqual(
  requests.map((request) => new URL(request, "https://admin.test").pathname),
  ["/api/admin/summary"],
  "React Admin initialization must load only the dashboard view"
);

requests.length = 0;
delete window.GJUReactAdmin;
await loadAdminData();
assert.deepEqual(
  [...new Set(requests.map((request) => new URL(request, "https://admin.test").pathname))].sort(),
  [
    "/api/admin/equipment",
    "/api/admin/lectures",
    "/api/admin/logs",
    "/api/admin/notices",
    "/api/admin/reports",
    "/api/admin/reservations",
    "/api/admin/sessions",
    "/api/admin/summary",
    "/api/admin/users"
  ],
  "missing React Admin bundle must retain the legacy full-data fallback"
);

console.log("React Admin scoped data and server sort checks passed.");
