import { state } from "./state.js?v=20260714-mobile-card-r6";
import { api } from "./api.js?v=20260714-mobile-card-r6";
import { syncNativeReservationNotifications, syncWatchReservationSnapshot } from "./native-notifications.js?v=20260714-mobile-card-r6";

const ADMIN_VIEW_CACHE_TTL_MS = 15_000;
const adminViewCache = new Map();
const adminViewInflight = new Map();
const adminViewGeneration = new Map();

export async function loadBootstrap() {
  state.bootstrap = await api("/api/bootstrap");
}

export async function loadMe() {
  if (!state.token) return;
  let data;
  try {
    data = await api("/api/me");
  } catch (error) {
    if (error.status !== 401) throw error;
    data = { user: null };
  }
  state.user = data.user || null;
  if (!state.user) {
    clearAdminViewCache();
    state.token = "";
    state.myReservations = [];
    state.favoriteGroups = [];
    state.recentReservations = [];
    state.rebookingDetails = null;
    state.reservationRecommendations = null;
    state.lectures = [];
    state.adminUsers = [];
    state.adminReservations = [];
    state.adminEquipment = [];
    state.adminReports = [];
    state.adminNotices = [];
    state.adminLectures = [];
    state.adminSessions = [];
    state.adminLogs = [];
    state.adminCoursePlanning = null;
    localStorage.removeItem("gju_token");
    sessionStorage.removeItem("gju_token");
  }
}

export async function loadMyReservations() {
  state.myReservations = await api("/api/reservations/my");
  await Promise.all([
    syncNativeReservationNotifications({ silent: true }),
    syncWatchReservationSnapshot({ silent: true })
  ]);
}

export async function loadLectures() {
  state.lectures = await api("/api/lectures");
}

function pagedItems(result) {
  return Array.isArray(result) ? result : (result?.items || []);
}

function pageMeta(result) {
  return Array.isArray(result)
    ? { total: result.length, collectionTotal: result.length, page: 1, pageSize: result.length, hasMore: false }
    : {
      total: Number(result?.total || 0),
      collectionTotal: Number(result?.collectionTotal ?? result?.total ?? 0),
      page: Number(result?.page || 1),
      pageSize: Number(result?.pageSize || 0),
      hasMore: Boolean(result?.hasMore)
    };
}

function semesterLabel(key) {
  const match = String(key || "").match(/^(\d{4})-S([12])$/);
  return match ? `${match[1]}년 ${match[2]}학기` : String(key || "");
}

export function normalizeSemesterOptions(options) {
  const seen = new Set();
  return (Array.isArray(options) ? options : []).flatMap((option) => {
    const key = typeof option === "string" ? option.trim() : String(option?.key || "").trim();
    if (!key || seen.has(key)) return [];
    seen.add(key);
    const label = typeof option === "object" && option
      ? String(option.label || semesterLabel(key)).trim()
      : semesterLabel(key);
    return [{ key, label: label || key }];
  });
}

function clearAdminViewCache(view = "") {
  const prefix = view ? `${view}:` : "";
  for (const key of adminViewCache.keys()) {
    if (!prefix || key.startsWith(prefix)) adminViewCache.delete(key);
  }
}

function nextAdminViewGeneration(view) {
  const generation = Number(adminViewGeneration.get(view) || 0) + 1;
  adminViewGeneration.set(view, generation);
  return generation;
}

export function invalidateAdminViewCache(...views) {
  if (!views.length) {
    clearAdminViewCache();
    for (const view of adminViewGeneration.keys()) nextAdminViewGeneration(view);
    return;
  }
  views.filter(Boolean).forEach((view) => {
    const key = String(view);
    clearAdminViewCache(key);
    nextAdminViewGeneration(key);
  });
}

function queryString(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "" && value !== "all") search.set(key, String(value));
  }
  return search.toString();
}

function pageNumber(page) {
  return Math.max(1, Number(page?.page || 1));
}

function pageSizeNumber(page, fallback = 100) {
  return Math.max(1, Number(page?.pageSize || fallback));
}

function filterValue(filters, key, fallback) {
  return Object.prototype.hasOwnProperty.call(filters, key) ? filters[key] : fallback;
}

function sortValue(filters, stateKey, defaultField, defaultDirection) {
  const current = state[stateKey] && typeof state[stateKey] === "object" ? state[stateKey] : {};
  return {
    sort: filterValue(filters, "sort", current.field || defaultField),
    direction: filterValue(filters, "direction", current.direction || defaultDirection)
  };
}

function adminUsersPath(filters = {}) {
  const sort = sortValue(filters, "adminUserSort", "approvalStatus", "asc");
  return `/api/admin/users?${queryString({
    page: filterValue(filters, "page", pageNumber(state.adminUsersPage)),
    pageSize: filterValue(filters, "pageSize", pageSizeNumber(state.adminUsersPage)),
    role: filterValue(filters, "role", "student"),
    status: filterValue(filters, "status", state.adminUserStatusFilter),
    q: filterValue(filters, "q", state.adminUserSearch),
    ...sort
  })}`;
}

function adminReservationsPath(filters = {}) {
  const query = String(filterValue(filters, "q", state.adminReservationSearch) || "").trim();
  const activeType = filterValue(filters, "type", state.adminReservationTab);
  const type = query ? "" : activeType;
  const status = query || activeType !== "equipment"
    ? ""
    : filterValue(filters, "status", state.adminEquipmentReservationStatusFilter);
  const sort = sortValue(filters, "adminReservationSort", "createdAt", "desc");
  return `/api/admin/reservations?${queryString({
    page: filterValue(filters, "page", pageNumber(state.adminReservationsPage)),
    pageSize: filterValue(filters, "pageSize", pageSizeNumber(state.adminReservationsPage)),
    type,
    status,
    semester: filterValue(filters, "semester", state.adminReservationSemesterFilter),
    q: query,
    ...sort
  })}`;
}

function adminReportsPath(filters = {}) {
  const sort = sortValue(filters, "adminReportSort", "submittedAt", "desc");
  return `/api/admin/reports?${queryString({
    page: filterValue(filters, "page", pageNumber(state.adminReportsPage)),
    pageSize: filterValue(filters, "pageSize", pageSizeNumber(state.adminReportsPage)),
    semester: filterValue(filters, "semester", state.adminReportSemesterFilter),
    q: filterValue(filters, "q", state.adminReportSearch),
    ...sort
  })}`;
}

function adminLecturesPath(filters = {}) {
  const sort = sortValue(filters, "adminLectureSort", "lectureDate", "asc");
  return `/api/admin/lectures?${queryString({
    page: filterValue(filters, "page", pageNumber(state.adminLecturesPage)),
    pageSize: filterValue(filters, "pageSize", pageSizeNumber(state.adminLecturesPage)),
    semester: filterValue(filters, "semester", state.adminLectureSemesterFilter),
    q: filterValue(filters, "q", state.adminLectureSearch),
    ...sort
  })}`;
}

function adminNoticesPath(filters = {}) {
  const sort = sortValue(filters, "adminNoticeSort", "createdAt", "desc");
  return `/api/admin/notices?${queryString({
    page: filterValue(filters, "page", pageNumber(state.adminNoticesPage)),
    pageSize: filterValue(filters, "pageSize", pageSizeNumber(state.adminNoticesPage)),
    q: filterValue(filters, "q", state.adminNoticeSearch),
    ...sort
  })}`;
}

function setPage(stateKey, page) {
  state[stateKey] = {
    ...(state[stateKey] || {}),
    page: Math.max(1, Number(page || 1))
  };
}

function setPageSize(stateKey, pageSize) {
  state[stateKey] = {
    ...(state[stateKey] || {}),
    pageSize: Math.max(1, Number(pageSize || 100))
  };
}

function setSort(stateKey, filters, defaultField, defaultDirection) {
  if (!Object.prototype.hasOwnProperty.call(filters, "sort") && !Object.prototype.hasOwnProperty.call(filters, "direction")) return;
  const current = state[stateKey] && typeof state[stateKey] === "object" ? state[stateKey] : {};
  state[stateKey] = {
    field: filterValue(filters, "sort", current.field || defaultField),
    direction: filterValue(filters, "direction", current.direction || defaultDirection)
  };
}

function applyFilterState(view, filters) {
  if (view === "users") {
    if ("q" in filters) state.adminUserSearch = String(filters.q || "");
    if ("status" in filters) state.adminUserStatusFilter = String(filters.status || "all");
    if ("page" in filters) setPage("adminUsersPage", filters.page);
    if ("pageSize" in filters) setPageSize("adminUsersPage", filters.pageSize);
    setSort("adminUserSort", filters, "approvalStatus", "asc");
  } else if (view === "reservations") {
    if ("q" in filters) state.adminReservationSearch = String(filters.q || "");
    if ("type" in filters) state.adminReservationTab = String(filters.type || "all");
    if ("status" in filters) state.adminEquipmentReservationStatusFilter = String(filters.status || "all");
    if ("semester" in filters) state.adminReservationSemesterFilter = String(filters.semester || "all");
    if ("page" in filters) setPage("adminReservationsPage", filters.page);
    if ("pageSize" in filters) setPageSize("adminReservationsPage", filters.pageSize);
    setSort("adminReservationSort", filters, "createdAt", "desc");
  } else if (view === "equipment") {
    if ("q" in filters) state.adminEquipmentSearch = String(filters.q || "");
    if ("source" in filters) state.adminEquipmentTab = String(filters.source || "all");
    if ("category" in filters) state.adminEquipmentCategoryTab = String(filters.category || "all");
    if ("panel" in filters) state.adminEquipmentPanelTab = String(filters.panel || "manage");
  } else if (view === "reports") {
    if ("q" in filters) state.adminReportSearch = String(filters.q || "");
    if ("semester" in filters) state.adminReportSemesterFilter = String(filters.semester || "all");
    if ("page" in filters) setPage("adminReportsPage", filters.page);
    if ("pageSize" in filters) setPageSize("adminReportsPage", filters.pageSize);
    setSort("adminReportSort", filters, "submittedAt", "desc");
  } else if (view === "lectures") {
    if ("q" in filters) state.adminLectureSearch = String(filters.q || "");
    if ("semester" in filters) state.adminLectureSemesterFilter = String(filters.semester || "all");
    if ("page" in filters) setPage("adminLecturesPage", filters.page);
    if ("pageSize" in filters) setPageSize("adminLecturesPage", filters.pageSize);
    if ("panel" in filters) state.adminLecturePanelTab = String(filters.panel || "list");
    setSort("adminLectureSort", filters, "lectureDate", "asc");
  } else if (view === "notices") {
    if ("q" in filters) state.adminNoticeSearch = String(filters.q || "");
    if ("page" in filters) setPage("adminNoticesPage", filters.page);
    if ("pageSize" in filters) setPageSize("adminNoticesPage", filters.pageSize);
    setSort("adminNoticeSort", filters, "createdAt", "desc");
  } else if (view === "logs") {
    if ("sessionQuery" in filters) state.adminSessionSearch = String(filters.sessionQuery || "");
    if ("sessionSort" in filters) state.adminSessionSort = String(filters.sessionSort || "createdAt");
    if ("logQuery" in filters) state.adminLogSearch = String(filters.logQuery || "");
    if ("logAction" in filters) state.adminLogActionFilter = String(filters.logAction || "all");
    if ("logDirection" in filters) state.adminLogSort = String(filters.logDirection || "desc");
  } else if (view === "settings" && "blockedQuery" in filters) {
    state.adminBlockedScheduleSearch = String(filters.blockedQuery || "");
  }
}

function adminViewDescriptor(view, filters) {
  if (view === "dashboard") {
    return {
      key: "/api/admin/summary",
      load: () => api("/api/admin/summary"),
      apply: (summary) => { state.summary = summary; }
    };
  }
  if (view === "users") {
    const path = adminUsersPath(filters);
    return {
      key: path,
      load: () => api(path),
      apply: (users) => {
        state.adminUsers = pagedItems(users);
        state.adminUsersPage = pageMeta(users);
      }
    };
  }
  if (view === "reservations") {
    const path = adminReservationsPath(filters);
    return {
      key: path,
      load: () => api(path),
      apply: (reservations) => {
        state.adminReservations = pagedItems(reservations);
        state.adminReservationSemesters = normalizeSemesterOptions(reservations?.semesterOptions);
        state.adminReservationsPage = pageMeta(reservations);
      }
    };
  }
  if (view === "equipment") {
    return {
      key: "/api/admin/equipment",
      load: () => api("/api/admin/equipment"),
      apply: (equipment) => { state.adminEquipment = Array.isArray(equipment) ? equipment : []; }
    };
  }
  if (view === "reports") {
    const path = adminReportsPath(filters);
    return {
      key: path,
      load: () => api(path),
      apply: (reports) => {
        state.adminReports = pagedItems(reports);
        state.adminReportSemesters = normalizeSemesterOptions(reports?.semesterOptions);
        state.adminReportsPage = pageMeta(reports);
      }
    };
  }
  if (view === "lectures") {
    const path = adminLecturesPath(filters);
    return {
      key: path,
      load: () => api(path),
      apply: (lectures) => {
        state.adminLectures = pagedItems(lectures);
        state.adminLectureSemesters = normalizeSemesterOptions(lectures?.semesterOptions);
        state.adminLecturesPage = pageMeta(lectures);
      }
    };
  }
  if (view === "notices") {
    const path = adminNoticesPath(filters);
    return {
      key: path,
      load: () => api(path),
      apply: (notices) => {
        state.adminNotices = pagedItems(notices);
        state.adminNoticesPage = pageMeta(notices);
      }
    };
  }
  if (view === "logs") {
    return {
      key: "/api/admin/sessions|/api/admin/logs",
      load: () => Promise.all([api("/api/admin/sessions"), api("/api/admin/logs")]),
      apply: ([sessions, logs]) => {
        state.adminSessions = Array.isArray(sessions) ? sessions : [];
        state.adminLogs = Array.isArray(logs) ? logs : [];
      }
    };
  }
  if (view === "settings") {
    return {
      key: "/api/admin/settings",
      load: () => api("/api/admin/settings"),
      apply: (settings) => {
        state.bootstrap = { ...(state.bootstrap || {}), settings };
      }
    };
  }
  if (view === "course-demand") {
    return {
      key: "/api/admin/course-planning",
      load: () => api("/api/admin/course-planning"),
      apply: (coursePlanning) => { state.adminCoursePlanning = coursePlanning || null; }
    };
  }
  return null;
}

export async function loadAdminView(view, filters = {}, options = {}) {
  const requestedView = String(view || "dashboard");
  const sourceFilters = filters && typeof filters === "object" ? filters : {};
  const force = Boolean(options.force ?? sourceFilters.force);
  const viewFilters = Object.fromEntries(Object.entries(sourceFilters).filter(([key]) => key !== "force"));
  const descriptor = adminViewDescriptor(requestedView, viewFilters);
  if (!descriptor) return null;

  const cacheKey = `${requestedView}:${descriptor.key}`;
  const generation = nextAdminViewGeneration(requestedView);
  if (!force) {
    const cached = adminViewCache.get(cacheKey);
    if (cached && Date.now() - cached.at < ADMIN_VIEW_CACHE_TTL_MS) {
      if (adminViewGeneration.get(requestedView) === generation) {
        applyFilterState(requestedView, viewFilters);
        descriptor.apply(cached.value);
      }
      return cached.value;
    }
  } else {
    clearAdminViewCache(requestedView);
  }

  let pending = force ? null : adminViewInflight.get(cacheKey);
  if (!pending) {
    const source = Promise.resolve().then(() => descriptor.load());
    pending = source.then(
      (value) => {
        if (adminViewInflight.get(cacheKey) === pending) adminViewInflight.delete(cacheKey);
        return value;
      },
      (error) => {
        if (adminViewInflight.get(cacheKey) === pending) adminViewInflight.delete(cacheKey);
        throw error;
      }
    );
    adminViewInflight.set(cacheKey, pending);
  }

  const value = await pending;
  const pageItems = Array.isArray(value?.items) ? value.items : null;
  const responsePage = Number(value?.page || viewFilters.page || 1);
  const responseTotal = Number(value?.total || 0);
  if (pageItems && pageItems.length === 0 && responseTotal > 0 && responsePage > 1) {
    const pageSize = Math.max(1, Number(value?.pageSize || viewFilters.pageSize || 100));
    const lastPage = Math.max(1, Math.ceil(responseTotal / pageSize));
    return loadAdminView(requestedView, {
      ...viewFilters,
      page: Math.min(responsePage - 1, lastPage)
    }, { force: true });
  }
  if (adminViewGeneration.get(requestedView) === generation) {
    applyFilterState(requestedView, viewFilters);
    descriptor.apply(value);
    adminViewCache.set(cacheKey, { at: Date.now(), value });
    if (requestedView === "dashboard") {
      await syncNativeReservationNotifications({ silent: true });
    }
  }
  return value;
}

export async function loadAdminData() {
  if (state.reactAdminEnabled !== false && typeof window.GJUReactAdmin?.mount === "function") {
    await loadAdminView("dashboard", { force: true });
    return;
  }
  await Promise.all([
    "dashboard",
    "users",
    "reservations",
    "equipment",
    "reports",
    "notices",
    "lectures",
    "logs"
  ].map((view) => loadAdminView(view, { force: true })));
}
