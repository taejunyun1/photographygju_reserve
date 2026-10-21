import { state, setAuthenticatedUser, getAuthenticatedSessionGeneration } from "./state.js?v=20261014-photo-picker-r1";
import { api } from "./api.js?v=20261014-photo-picker-r1";
import { syncNativeReservationNotifications, syncWatchReservationSnapshot } from "./native-notifications.js?v=20261014-photo-picker-r1";

const ADMIN_VIEW_CACHE_TTL_MS = 15_000;
const adminViewCache = new Map();
const adminViewInflight = new Map();
const adminViewTimelineVersion = new WeakMap();
const adminViewGeneration = new Map();

const FACILITY_TIMELINE_TTL_MS = 60_000;
const facilityTimelineCache = new Map();
const facilityTimelineInflight = new Map();
let facilityTimelineIdentity = "";
let facilityTimelineGeneration = 0;
let facilityTimelineRequest = 0;

function emptyFacilityTimeline() {
  return { date: "", data: null, loading: false, error: "", lastSucceededAt: "" };
}

function currentFacilityTimelineIdentity() {
  if (!state.user?.id || !["admin", "student"].includes(state.user.role)) return "";
  return JSON.stringify([state.user.role, state.user.id, state.token, state.user.approvalStatus, getAuthenticatedSessionGeneration()]);
}

function syncFacilityTimelineIdentity() {
  const identity = currentFacilityTimelineIdentity();
  if (identity !== facilityTimelineIdentity) {
    facilityTimelineIdentity = identity;
    facilityTimelineGeneration += 1;
    facilityTimelineRequest += 1;
    facilityTimelineCache.clear();
    facilityTimelineInflight.clear();
    state.facilityTimeline = emptyFacilityTimeline();
  }
  return identity;
}

function facilityTimelineFresh(entry) {
  return Boolean(entry && !entry.failed && Date.now() - entry.at < FACILITY_TIMELINE_TTL_MS
    && Date.parse(entry.data.validUntil) > Date.now());
}

export function invalidateFacilityTimelineCache({ clear = false } = {}) {
  syncFacilityTimelineIdentity();
  facilityTimelineGeneration += 1;
  facilityTimelineRequest += 1;
  facilityTimelineCache.clear();
  facilityTimelineInflight.clear();
  state.facilityTimeline = clear ? emptyFacilityTimeline() : { ...state.facilityTimeline, loading: false, invalidated: true };
}

export function seedFacilityTimeline(data) {
  const identity = syncFacilityTimelineIdentity();
  if (!identity || !data?.date || data.viewer !== state.user.role) return;
  const key = `${identity}:${data.date}`;
  // A summary is an initial seed, not a replacement for a dedicated date refresh.
  if (facilityTimelineInflight.has(key)) return;
  const current = state.facilityTimeline;
  const previous = [facilityTimelineCache.get(key)?.data, current.date === data.date ? current.data : null];
  const generatedAt = Date.parse(data.generatedAt);
  if (previous.some((value) => value && (Date.parse(value.generatedAt) > generatedAt
    || (current.date === data.date && current.invalidated && Date.parse(value.generatedAt) === generatedAt)))) return;
  const entry = { data, at: Date.now(), lastSucceededAt: data.generatedAt || new Date().toISOString() };
  facilityTimelineCache.set(key, entry);
  if (!state.facilityTimeline.date || state.facilityTimeline.date === data.date) {
    state.facilityTimeline = { date: data.date, data, loading: false, error: "", lastSucceededAt: entry.lastSucceededAt, invalidated: false };
  }
}

export async function loadFacilityTimeline(date, { force = false } = {}) {
  const identity = syncFacilityTimelineIdentity();
  if (!identity) return null;
  const requestedDate = String(date || "");
  const request = ++facilityTimelineRequest;
  const generation = facilityTimelineGeneration;
  const key = `${identity}:${requestedDate}`;
  const cached = facilityTimelineCache.get(key);
  if (!force && facilityTimelineFresh(cached)) {
    state.facilityTimeline = { date: requestedDate, data: cached.data, loading: false, error: "", lastSucceededAt: cached.lastSucceededAt, invalidated: false };
    return cached.data;
  }
  const current = state.facilityTimeline;
  state.facilityTimeline = {
    date: requestedDate,
    data: current.date === requestedDate ? current.data : (cached?.data || null),
    loading: true,
    error: "",
    invalidated: current.date === requestedDate && Boolean(current.invalidated),
    lastSucceededAt: current.date === requestedDate ? current.lastSucceededAt : (cached?.lastSucceededAt || "")
  };
  let pending = facilityTimelineInflight.get(key);
  if (!pending) {
    pending = api(`/api/facility-timeline?date=${encodeURIComponent(requestedDate)}`, { loading: false });
    facilityTimelineInflight.set(key, pending);
  }
  const canApply = () => syncFacilityTimelineIdentity() === identity
    && facilityTimelineGeneration === generation && facilityTimelineRequest === request;
  try {
    const data = await pending;
    if (data?.date !== requestedDate || data?.viewer !== state.user?.role) {
      throw new Error("현황 응답의 날짜 또는 계정을 확인할 수 없습니다.");
    }
    if (canApply()) {
      const lastSucceededAt = data.generatedAt || new Date().toISOString();
      facilityTimelineCache.set(key, { data, at: Date.now(), lastSucceededAt });
      state.facilityTimeline = { date: requestedDate, data, loading: false, error: "", lastSucceededAt, invalidated: false };
      return data;
    }
    return null;
  } catch (error) {
    if (canApply()) {
      const previous = facilityTimelineCache.get(key);
      if (previous) facilityTimelineCache.set(key, { ...previous, failed: true });
      state.facilityTimeline = { ...state.facilityTimeline, loading: false, error: error.message || "현황을 갱신하지 못했습니다." };
    }
    return null;
  } finally {
    if (facilityTimelineInflight.get(key) === pending) facilityTimelineInflight.delete(key);
  }
}

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
  setAuthenticatedUser(data.user || null);
  if (!state.user) {
    invalidateFacilityTimelineCache({ clear: true });
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
    state.adminEquipmentCodeMigration = null;
    state.adminEquipmentReturnDraft = {};
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
      persistedTotal: Number(result?.persistedTotal ?? result?.total ?? 0),
      persistedCollectionTotal: Number(result?.persistedCollectionTotal ?? result?.collectionTotal ?? result?.total ?? 0),
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
  const sort = sortValue(filters, "adminUserSort", "createdAt", "desc");
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
  const requestedStatus = filterValue(filters, "status", state.adminEquipmentReservationStatusFilter);
  const status = query || (activeType !== "equipment" && !["cancelled_or_rejected", "operational"].includes(requestedStatus))
    ? ""
    : requestedStatus;
  const sort = sortValue(filters, "adminReservationSort", "createdAt", "desc");
  return `/api/admin/reservations?${queryString({
    page: filterValue(filters, "page", pageNumber(state.adminReservationsPage)),
    pageSize: filterValue(filters, "pageSize", pageSizeNumber(state.adminReservationsPage)),
    type,
    status,
    semester: filterValue(filters, "semester", state.adminReservationSemesterFilter),
    from: filterValue(filters, "from", state.adminReservationDateFrom),
    to: filterValue(filters, "to", state.adminReservationDateTo),
    time: filterValue(filters, "time", state.adminReservationTimeFilter),
    dateBasis: filterValue(filters, "dateBasis", state.adminReservationDateBasis),
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
    status: filterValue(filters, "status", state.adminReportStatusFilter),
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
    setSort("adminUserSort", filters, "createdAt", "desc");
  } else if (view === "reservations") {
    if ("q" in filters) state.adminReservationSearch = String(filters.q || "");
    if ("type" in filters) state.adminReservationTab = String(filters.type || "all");
    if ("status" in filters) state.adminEquipmentReservationStatusFilter = String(filters.status || "all");
    if ("semester" in filters) state.adminReservationSemesterFilter = String(filters.semester || "all");
    if ("from" in filters) state.adminReservationDateFrom = String(filters.from || "");
    if ("to" in filters) state.adminReservationDateTo = String(filters.to || "");
    if ("time" in filters) state.adminReservationTimeFilter = String(filters.time || "");
    if ("dateBasis" in filters) state.adminReservationDateBasis = String(filters.dateBasis || "reserved");
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
    if ("status" in filters) state.adminReportStatusFilter = String(filters.status || "all");
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
      apply: (summary, timelineVersion) => {
        state.summary = summary;
        if (summary?.operationsBoard && timelineVersion === facilityTimelineRequest) seedFacilityTimeline(summary.operationsBoard);
      }
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
  const identity = syncFacilityTimelineIdentity();
  const timelineVersion = facilityTimelineRequest;
  const requestedView = String(view || "dashboard");
  const sourceFilters = filters && typeof filters === "object" ? filters : {};
  const force = Boolean(options.force ?? sourceFilters.force);
  const viewFilters = Object.fromEntries(Object.entries(sourceFilters).filter(([key]) => key !== "force"));
  const descriptor = adminViewDescriptor(requestedView, viewFilters);
  if (!descriptor) return null;

  const cacheKey = `${requestedView}:${identity}:${descriptor.key}`;
  const generation = nextAdminViewGeneration(requestedView);
  if (!force) {
    const cached = adminViewCache.get(cacheKey);
    if (cached && Date.now() - cached.at < ADMIN_VIEW_CACHE_TTL_MS) {
      if (syncFacilityTimelineIdentity() === identity && adminViewGeneration.get(requestedView) === generation) {
        applyFilterState(requestedView, viewFilters);
        descriptor.apply(cached.value, cached.timelineVersion);
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
    adminViewTimelineVersion.set(pending, timelineVersion);
  }

  const value = await pending;
  const sourceTimelineVersion = adminViewTimelineVersion.get(pending);
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
  if (syncFacilityTimelineIdentity() === identity && adminViewGeneration.get(requestedView) === generation) {
    applyFilterState(requestedView, viewFilters);
    descriptor.apply(value, sourceTimelineVersion);
    adminViewCache.set(cacheKey, { at: Date.now(), value, timelineVersion: sourceTimelineVersion });
    if (requestedView === "dashboard") {
      state.adminRefresh = { ...(state.adminRefresh || {}), lastSucceededAt: new Date().toISOString(), error: "" };
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
