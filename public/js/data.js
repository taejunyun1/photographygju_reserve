import { state } from "./state.js?v=20260613-conflict1";
import { api } from "./api.js?v=20260613-conflict1";

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
  }
}

export async function loadMyReservations() {
  state.myReservations = await api("/api/reservations/my");
}

export async function loadLectures() {
  state.lectures = await api("/api/lectures");
}

export async function loadAdminData() {
  const [summary, users, reservations, equipment, reports, notices, lectures] = await Promise.all([
    api("/api/admin/summary"),
    api("/api/admin/users"),
    api("/api/admin/reservations"),
    api("/api/admin/equipment"),
    api("/api/admin/reports"),
    api("/api/admin/notices"),
    api("/api/admin/lectures")
  ]);
  Object.assign(state, {
    summary,
    adminUsers: users,
    adminReservations: reservations,
    adminEquipment: equipment,
    adminReports: reports,
    adminNotices: notices,
    adminLectures: lectures
  });
}
