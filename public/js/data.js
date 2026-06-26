import { state } from "./state.js?v=20260626-admin-dashboard-visual-grid";
import { api } from "./api.js?v=20260626-admin-dashboard-visual-grid";
import { syncNativeReservationNotifications, syncWatchReservationSnapshot } from "./native-notifications.js?v=20260626-admin-dashboard-visual-grid";

export async function loadBootstrap() {
  state.bootstrap = await api("/api/bootstrap");
}

export async function loadMe() {
  if (!state.token) return;
  const data = await api("/api/me");
  state.user = data.user;
  if (!state.user) {
    state.token = "";
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
    ? { total: result.length, page: 1, pageSize: result.length, hasMore: false }
    : {
      total: Number(result?.total || 0),
      page: Number(result?.page || 1),
      pageSize: Number(result?.pageSize || 0),
      hasMore: Boolean(result?.hasMore)
    };
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

function adminUsersPath() {
  return `/api/admin/users?${queryString({
    page: pageNumber(state.adminUsersPage),
    pageSize: 100,
    role: "student",
    status: state.adminUserStatusFilter,
    q: state.adminUserSearch
  })}`;
}

function adminReservationsPath() {
  const query = String(state.adminReservationSearch || "").trim();
  const type = query ? "" : state.adminReservationTab;
  const status = !query && state.adminReservationTab === "equipment" ? state.adminEquipmentReservationStatusFilter : "";
  return `/api/admin/reservations?${queryString({
    page: pageNumber(state.adminReservationsPage),
    pageSize: 100,
    type,
    status,
    q: query
  })}`;
}

function adminReportsPath() {
  return `/api/admin/reports?${queryString({
    page: pageNumber(state.adminReportsPage),
    pageSize: 100,
    q: state.adminReportSearch
  })}`;
}

export async function loadAdminData() {
  const [summary, users, reservations, equipment, reports, notices, lectures, sessions, logs] = await Promise.all([
    api("/api/admin/summary"),
    api(adminUsersPath()),
    api(adminReservationsPath()),
    api("/api/admin/equipment"),
    api(adminReportsPath()),
    api("/api/admin/notices"),
    api("/api/admin/lectures"),
    api("/api/admin/sessions"),
    api("/api/admin/logs")
  ]);
  Object.assign(state, {
    summary,
    adminUsers: pagedItems(users),
    adminUsersPage: pageMeta(users),
    adminReservations: pagedItems(reservations),
    adminReservationsPage: pageMeta(reservations),
    adminEquipment: equipment,
    adminReports: pagedItems(reports),
    adminReportsPage: pageMeta(reports),
    adminNotices: notices,
    adminLectures: lectures,
    adminSessions: sessions,
    adminLogs: logs
  });
  await syncNativeReservationNotifications({ silent: true });
}
