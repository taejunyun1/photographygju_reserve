import { state } from "./state.js?v=20260616-feat3";
import { api } from "./api.js?v=20260616-feat3";

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
}

export async function loadLectures() {
  state.lectures = await api("/api/lectures");
}

export async function loadAdminData() {
  const [summary, users, reservations, equipment, reports, notices, lectures, sessions, logs] = await Promise.all([
    api("/api/admin/summary"),
    api("/api/admin/users"),
    api("/api/admin/reservations"),
    api("/api/admin/equipment"),
    api("/api/admin/reports"),
    api("/api/admin/notices"),
    api("/api/admin/lectures"),
    api("/api/admin/sessions"),
    api("/api/admin/logs")
  ]);
  Object.assign(state, {
    summary,
    adminUsers: users,
    adminReservations: reservations,
    adminEquipment: equipment,
    adminReports: reports,
    adminNotices: notices,
    adminLectures: lectures,
    adminSessions: sessions,
    adminLogs: logs
  });
}
