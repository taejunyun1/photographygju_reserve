import { statusLabel, typeLabel } from "./constants.js?v=20260704-student-icon-nav";
import { state } from "./state.js?v=20260704-student-icon-nav";

const NOTIFICATION_PREF_KEY = "gju_native_notifications_enabled";
const NOTIFICATION_IDS_KEY = "gju_native_notification_ids";
const REMINDER_CHANNEL_ID = "gju_reservation_reminders";
const REMINDER_OFFSETS = [
  { key: "day-before", minutes: 24 * 60, label: "내일" },
  { key: "hour-before", minutes: 60, label: "1시간 전" },
  { key: "ten-min-before", minutes: 10, label: "10분 전" },
  { key: "start", minutes: 0, label: "시작" }
];
const REPORT_REMINDERS = [
  { key: "report-after-use", minutesAfterEnd: 60, label: "보고서 작성 필요" },
  { key: "report-deadline", minutesBeforeDeadline: 180, label: "보고서 마감 임박" }
];

function baseStatus(overrides = {}) {
  return {
    supported: nativeNotificationsSupported(),
    enabled: nativeNotificationPreferenceEnabled(),
    permission: "unknown",
    pendingCount: 0,
    syncedAt: "",
    error: "",
    ...overrides
  };
}

function localNotificationsPlugin() {
  return window.Capacitor?.Plugins?.LocalNotifications || null;
}

function watchReservationsPlugin() {
  return window.Capacitor?.Plugins?.GJUWatchReservations || null;
}

function nativePlatform() {
  return window.Capacitor?.getPlatform?.() || (window.GJU_NATIVE_APP ? "native" : "web");
}

export function nativeNotificationsSupported() {
  return Boolean(window.GJU_NATIVE_APP && localNotificationsPlugin());
}

export function nativeNotificationPreferenceEnabled() {
  return localStorage.getItem(NOTIFICATION_PREF_KEY) === "true";
}

function setNativeNotificationPreference(value) {
  if (value) localStorage.setItem(NOTIFICATION_PREF_KEY, "true");
  else localStorage.removeItem(NOTIFICATION_PREF_KEY);
}

function storedNotificationIds() {
  try {
    const ids = JSON.parse(localStorage.getItem(NOTIFICATION_IDS_KEY) || "[]");
    return Array.isArray(ids) ? ids.filter((id) => Number.isInteger(id)) : [];
  } catch {
    return [];
  }
}

function storeNotificationIds(ids) {
  localStorage.setItem(NOTIFICATION_IDS_KEY, JSON.stringify([...new Set(ids)].filter((id) => Number.isInteger(id))));
}

function stableNotificationId(value) {
  const text = String(value || "");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return 100000 + (hash >>> 0) % 2000000000;
}

function timeStart(value) {
  const match = String(value || "").match(/(\d{1,2}):(\d{2})/);
  if (!match) return "";
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function timeToMinutes(value) {
  const match = String(value || "").match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function dateKeyAdd(key, days) {
  const date = new Date(`${key}T00:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function equipmentPeriodDays(period = "") {
  if (String(period).includes("2박3일") || String(period).includes("주말")) return 2;
  if (String(period).includes("1박2일")) return 1;
  return 0;
}

function earliestSlotStart(slots = []) {
  return slots.map(timeStart).filter(Boolean).sort()[0] || "";
}

function slotBounds(slot = "") {
  const match = String(slot).match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
  if (!match) return null;
  const start = timeToMinutes(match[1]);
  let end = timeToMinutes(match[2]);
  if (start === null || end === null) return null;
  if (end <= start) end += 24 * 60;
  return { start, end };
}

function dateAtMinutes(key, minutes) {
  const date = new Date(`${key}T00:00:00`);
  date.setMinutes(minutes);
  return Number.isNaN(date.getTime()) ? null : date;
}

function reservationStartDate(reservation) {
  const fields = reservation.fields || {};
  const date = fields.reservedDate || "";
  if (!date) return null;
  const time = {
    equipment: timeStart(fields.rentalTime),
    studio: earliestSlotStart(fields.timeSlots || []),
    darkroom: earliestSlotStart(fields.timeSlots || []),
    print: timeStart(fields.startTime),
    lecture: timeStart(fields.time)
  }[reservation.type] || "";
  const start = new Date(`${date}T${time || "09:00"}:00`);
  return Number.isNaN(start.getTime()) ? null : start;
}

function reservationEndDate(reservation) {
  const fields = reservation.fields || {};
  const date = fields.reservedDate || "";
  if (!date) return null;
  if (reservation.type === "equipment") {
    const endDate = dateKeyAdd(date, equipmentPeriodDays(fields.period));
    const end = new Date(`${endDate}T${timeStart(fields.returnTime) || "17:00"}:00`);
    return Number.isNaN(end.getTime()) ? null : end;
  }
  if (reservation.type === "studio" || reservation.type === "darkroom") {
    const latestEnd = (fields.timeSlots || []).map(slotBounds).filter(Boolean).reduce((max, slot) => Math.max(max, slot.end), -1);
    return latestEnd >= 0 ? dateAtMinutes(date, latestEnd) : reservationStartDate(reservation);
  }
  if (reservation.type === "print") {
    const end = new Date(`${date}T${timeStart(fields.endTime) || "19:00"}:00`);
    return Number.isNaN(end.getTime()) ? null : end;
  }
  return reservationStartDate(reservation);
}

function reservationMeta(reservation) {
  const fields = reservation.fields || {};
  if (reservation.type === "equipment") {
    const itemText = (reservation.equipmentItems || []).map((item) => item.code || item.name).filter(Boolean).slice(0, 3).join(", ");
    return itemText || "기자재 예약";
  }
  if (reservation.type === "studio") {
    return [fields.studioSpace || (fields.studioSpaces || []).join(", "), (fields.timeSlots || []).join(", ")].filter(Boolean).join(" · ");
  }
  if (reservation.type === "darkroom") {
    return [(fields.timeSlots || []).join(", "), (fields.processTypes || []).join(", ")].filter(Boolean).join(" · ");
  }
  if (reservation.type === "print") {
    return [fields.startTime && fields.endTime ? `${fields.startTime}-${fields.endTime}` : "", fields.printType].filter(Boolean).join(" · ");
  }
  if (reservation.type === "lecture") {
    return [fields.title, fields.time, fields.location].filter(Boolean).join(" · ");
  }
  return "";
}

function reservationDateLabel(date) {
  return `${date.toLocaleDateString("ko-KR")} ${date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`;
}

function activeReservationsForNotifications() {
  const terminal = new Set(["cancelled", "admin_cancelled", "rejected", "returned", "completed"]);
  return (state.myReservations || []).filter((reservation) => !terminal.has(reservation.status));
}

function watchText(value, fallback = "") {
  return String(value || fallback).replace(/\s+/g, " ").trim().slice(0, 90);
}

function reservationSortTime(reservation) {
  const startAt = reservationStartDate(reservation);
  return startAt?.getTime?.() || Number.MAX_SAFE_INTEGER;
}

export function watchReservationSnapshot(reservations = state.myReservations || []) {
  const terminal = new Set(["cancelled", "admin_cancelled", "rejected", "returned", "completed"]);
  return (Array.isArray(reservations) ? reservations : [])
    .filter((reservation) => reservation && !terminal.has(reservation.status))
    .sort((a, b) => reservationSortTime(a) - reservationSortTime(b))
    .slice(0, 10)
    .map((reservation, index) => {
      const type = typeLabel[reservation.type] || "예약";
      const status = statusLabel[reservation.status] || reservation.status || "진행 중";
      const startAt = reservationStartDate(reservation);
      return {
        id: watchText(reservation.id, `${reservation.type || "reservation"}-${index}`),
        type: watchText(type),
        status: watchText(status),
        title: watchText(`${type} · ${status}`),
        subtitle: watchText(reservationMeta(reservation), type),
        dateLabel: watchText(startAt ? reservationDateLabel(startAt) : reservation.fields?.reservedDate || "")
      };
    });
}

export async function syncWatchReservationSnapshot({ silent = false } = {}) {
  const reservations = watchReservationSnapshot();
  const plugin = watchReservationsPlugin();
  if (!window.GJU_NATIVE_APP || nativePlatform() !== "ios" || !plugin?.sync) {
    return { supported: false, reservations: reservations.length };
  }
  try {
    return await plugin.sync({
      reservations,
      syncedAt: new Date().toISOString()
    });
  } catch (error) {
    if (!silent) throw error;
    return {
      supported: true,
      reservations: reservations.length,
      error: error.message || "Apple Watch 예약 정보를 동기화하지 못했습니다."
    };
  }
}

function reportReservationsForNotifications() {
  const terminal = new Set(["cancelled", "admin_cancelled", "rejected"]);
  return (state.myReservations || []).filter((reservation) => (
    reservation.type === "studio" &&
    reservation.fields?.reportStatus !== "submitted" &&
    !terminal.has(reservation.status)
  ));
}

function reportDeadlineHours() {
  return Math.max(1, Number(state.bootstrap?.settings?.studioReportDeadlineHours || 48));
}

function reportNotificationTime(reminder, reservation) {
  const endAt = reservationEndDate(reservation);
  if (!endAt) return null;
  if (reminder.minutesAfterEnd !== undefined) {
    return new Date(endAt.getTime() + reminder.minutesAfterEnd * 60 * 1000);
  }
  const deadlineAt = new Date(endAt.getTime() + reportDeadlineHours() * 60 * 60 * 1000);
  if (reminder.minutesBeforeDeadline !== undefined) {
    return new Date(deadlineAt.getTime() - reminder.minutesBeforeDeadline * 60 * 1000);
  }
  return null;
}

function nextAdminDigestTime(now = new Date()) {
  const candidates = [9, 15].map((hour) => {
    const date = new Date(now);
    date.setHours(hour, 0, 0, 0);
    return date;
  });
  const nextToday = candidates.find((date) => date.getTime() > now.getTime() + 60 * 1000);
  if (nextToday) return nextToday;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return tomorrow;
}

export function plannedAdminNotifications(now = new Date()) {
  if (state.user?.role !== "admin") return [];
  const summary = state.summary || {};
  const counts = [
    ["가입 승인", Number(summary.pendingUsers || 0)],
    ["대여완료", Number(summary.equipmentCheckedOut ?? summary.pendingEquipment ?? 0)],
    ["반납완료", Number(summary.equipmentReturned || 0)],
    ["대여취소", Number(summary.equipmentCancelled || 0)],
    ["오늘 예약", Number(summary.todayReservations || 0)],
    ["보고서 확인", Number(summary.missingReports || 0)]
  ].filter(([, count]) => count > 0);
  if (!counts.length) return [];
  const notifyAt = nextAdminDigestTime(now);
  const userId = state.user?.id || "admin";
  return [{
    id: stableNotificationId(`${userId}:admin-digest:${notifyAt.toISOString().slice(0, 13)}`),
    title: "운영 확인 필요",
    body: counts.map(([label, count]) => `${label} ${count}건`).join(" · "),
    schedule: { at: notifyAt },
    channelId: REMINDER_CHANNEL_ID,
    autoCancel: true,
    extra: {
      route: "admin",
      adminView: "dashboard",
      notificationType: "admin-digest"
    }
  }];
}

export function plannedReservationNotifications(now = new Date()) {
  const userId = state.user?.id || "user";
  const notifications = [];
  for (const reservation of activeReservationsForNotifications()) {
    const startAt = reservationStartDate(reservation);
    if (!startAt) continue;
    for (const offset of REMINDER_OFFSETS) {
      const notifyAt = new Date(startAt.getTime() - offset.minutes * 60 * 1000);
      if (notifyAt.getTime() <= now.getTime() + 60 * 1000) continue;
      const type = typeLabel[reservation.type] || "예약";
      const id = stableNotificationId(`${userId}:${reservation.id}:${offset.key}`);
      const title = offset.key === "start" ? `${type} 사용 시작` : `${type} ${offset.label} 알림`;
      notifications.push({
        id,
        title,
        body: `${reservationDateLabel(startAt)} · ${reservationMeta(reservation) || type}`,
        schedule: { at: notifyAt },
        channelId: REMINDER_CHANNEL_ID,
        autoCancel: true,
        extra: {
          route: "mine",
          reservationId: reservation.id,
          reservationType: reservation.type
        }
      });
    }
  }
  for (const reservation of reportReservationsForNotifications()) {
    for (const reminder of REPORT_REMINDERS) {
      const notifyAt = reportNotificationTime(reminder, reservation);
      if (!notifyAt || notifyAt.getTime() <= now.getTime() + 60 * 1000) continue;
      const id = stableNotificationId(`${userId}:${reservation.id}:${reminder.key}`);
      notifications.push({
        id,
        title: reminder.label,
        body: `${reservation.fields?.reservedDate || ""} 스튜디오 사용 후 보고서가 필요합니다. ${reservationMeta(reservation) || "스튜디오 예약"}`,
        schedule: { at: notifyAt },
        channelId: REMINDER_CHANNEL_ID,
        autoCancel: true,
        extra: {
          route: "reports",
          reservationId: reservation.id,
          reservationType: reservation.type,
          notificationType: reminder.key
        }
      });
    }
  }
  return notifications.slice(0, 64);
}

export function plannedNativeNotifications(now = new Date()) {
  if (state.user?.role === "admin") return plannedAdminNotifications(now);
  return plannedReservationNotifications(now);
}

async function ensureNotificationChannel(plugin) {
  if (nativePlatform() !== "android" || !plugin?.createChannel) return;
  await plugin.createChannel({
    id: REMINDER_CHANNEL_ID,
    name: "예약 알림",
    description: "예약 접수, 사용 시간, 보고서 리마인더",
    importance: 4,
    visibility: 1,
    lights: true,
    lightColor: "#1558B0",
    vibration: true
  }).catch(() => null);
}

export async function notifyNativeReservationCreated(reservation) {
  const plugin = localNotificationsPlugin();
  if (!nativeNotificationsSupported() || !nativeNotificationPreferenceEnabled() || !reservation) return { scheduled: 0 };
  const permission = await plugin.checkPermissions().catch(() => null);
  if (permission?.display !== "granted") return { scheduled: 0 };
  await ensureNotificationChannel(plugin);
  const type = typeLabel[reservation.type] || "예약";
  const isEquipment = reservation.type === "equipment";
  const id = stableNotificationId(`${state.user?.id || "user"}:${reservation.id}:created`);
  await plugin.schedule({
    notifications: [{
      id,
      title: isEquipment ? "기자재 예약 승인 요청 접수" : `${type} 예약 확정`,
      body: `${reservation.fields?.reservedDate || ""} · ${reservationMeta(reservation) || type}`,
      schedule: { at: new Date(Date.now() + 1500) },
      channelId: REMINDER_CHANNEL_ID,
      autoCancel: true,
      extra: {
        route: "mine",
        reservationId: reservation.id,
        reservationType: reservation.type,
        notificationType: "reservation-created"
      }
    }]
  });
  return { scheduled: 1 };
}

async function cancelStoredNotifications(plugin) {
  const ids = storedNotificationIds();
  if (ids.length && plugin?.cancel) {
    await plugin.cancel({ notifications: ids.map((id) => ({ id })) }).catch(() => null);
  }
  storeNotificationIds([]);
}

export async function refreshNativeNotificationState() {
  const plugin = localNotificationsPlugin();
  if (!nativeNotificationsSupported()) {
    state.nativeNotifications = baseStatus({
      supported: false,
      permission: window.GJU_NATIVE_APP ? "unavailable" : "web"
    });
    return state.nativeNotifications;
  }
  try {
    const permission = await plugin.checkPermissions();
    const pending = await plugin.getPending?.().catch(() => ({ notifications: [] }));
    state.nativeNotifications = baseStatus({
      supported: true,
      permission: permission?.display || "unknown",
      pendingCount: Array.isArray(pending?.notifications) ? pending.notifications.length : 0
    });
  } catch (error) {
    state.nativeNotifications = baseStatus({
      supported: true,
      error: error.message || "알림 상태를 확인하지 못했습니다."
    });
  }
  return state.nativeNotifications;
}

export async function enableNativeReservationNotifications() {
  const plugin = localNotificationsPlugin();
  if (!nativeNotificationsSupported()) throw new Error("네이티브 앱에서만 알림을 사용할 수 있습니다.");
  let permission = await plugin.checkPermissions();
  if (permission?.display !== "granted") {
    permission = await plugin.requestPermissions();
  }
  if (permission?.display !== "granted") {
    throw new Error("알림 권한이 허용되지 않았습니다. 기기 설정에서 알림을 허용해 주세요.");
  }
  setNativeNotificationPreference(true);
  await syncNativeReservationNotifications({ force: true });
  return state.nativeNotifications;
}

export async function disableNativeReservationNotifications() {
  const plugin = localNotificationsPlugin();
  setNativeNotificationPreference(false);
  if (plugin) await cancelStoredNotifications(plugin);
  state.nativeNotifications = baseStatus({
    supported: nativeNotificationsSupported(),
    permission: plugin ? (await plugin.checkPermissions().catch(() => ({ display: "unknown" }))).display : "unknown",
    pendingCount: 0,
    syncedAt: new Date().toISOString()
  });
  return state.nativeNotifications;
}

export async function syncNativeReservationNotifications({ force = false, silent = false } = {}) {
  const plugin = localNotificationsPlugin();
  if (!nativeNotificationsSupported()) {
    state.nativeNotifications = baseStatus({ supported: false, permission: window.GJU_NATIVE_APP ? "unavailable" : "web" });
    return { scheduled: 0 };
  }
  if (!force && !nativeNotificationPreferenceEnabled()) {
    await refreshNativeNotificationState();
    return { scheduled: 0 };
  }
  try {
    const permission = await plugin.checkPermissions();
    if (permission?.display !== "granted") {
      state.nativeNotifications = baseStatus({
        supported: true,
        permission: permission?.display || "unknown",
        error: nativeNotificationPreferenceEnabled() ? "알림 권한이 필요합니다." : ""
      });
      return { scheduled: 0 };
    }
    await ensureNotificationChannel(plugin);
    await cancelStoredNotifications(plugin);
    const notifications = plannedNativeNotifications();
    if (notifications.length) await plugin.schedule({ notifications });
    storeNotificationIds(notifications.map((item) => item.id));
    state.nativeNotifications = baseStatus({
      supported: true,
      permission: "granted",
      pendingCount: notifications.length,
      syncedAt: new Date().toISOString()
    });
    return { scheduled: notifications.length };
  } catch (error) {
    state.nativeNotifications = baseStatus({
      supported: true,
      error: error.message || "알림을 동기화하지 못했습니다."
    });
    if (!silent) throw error;
    return { scheduled: 0, error };
  }
}

let notificationListenersReady = false;
let notificationActionListenerHandle = null;

export async function setupNativeNotificationListeners(onOpenReservation) {
  const plugin = localNotificationsPlugin();
  if (!nativeNotificationsSupported() || !plugin?.addListener || notificationListenersReady) return;
  notificationListenersReady = true;
  try {
    const listener = plugin.addListener("localNotificationActionPerformed", (event) => {
      const extra = event?.notification?.extra || {};
      if (extra.route === "admin") {
        state.adminView = extra.adminView || "dashboard";
      } else {
        state.view = extra.route === "reports" ? "reports" : "mine";
        if (state.view === "reports" && extra.reservationId) state.activeReportReservationId = extra.reservationId;
      }
      onOpenReservation?.();
    });
    notificationActionListenerHandle = typeof listener?.then === "function" ? await listener : listener;
  } catch {
    notificationListenersReady = false;
    notificationActionListenerHandle = null;
  }
}
