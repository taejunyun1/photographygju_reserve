const DEFAULT_TIME_ZONE = "Asia/Seoul";
export const RESERVATION_REMINDER_CHANNEL_ID = "gju_reservation_reminders";
const PRE_START_REMINDERS = [
  { key: "day-before", minutes: 24 * 60, label: "내일" },
  { key: "hour-before", minutes: 60, label: "1시간 전" }
];
const REPORT_REMINDERS = [
  { key: "report-after-use", minutesAfterEnd: 60, label: "보고서 작성 필요" },
  { key: "report-deadline", minutesBeforeDeadline: 180, label: "보고서 마감 임박" }
];
const TERMINAL_STATUSES = new Set(["cancelled", "admin_cancelled", "rejected", "returned", "completed"]);
const REPORT_EXCLUDED_STATUSES = new Set(["cancelled", "admin_cancelled", "rejected", "returned"]);

export function stableNotificationId(value) {
  const text = String(value || "");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return 100000 + (hash >>> 0) % 1899900000;
}

export function diagnosticNotificationId(value) {
  const text = String(value || "");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return 2000000000 + (hash >>> 0) % 147000000;
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

function validDate(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function kstDate(dateKey, time = "09:00") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey))) return null;
  const parsedTime = timeStart(time) || "09:00";
  return validDate(`${dateKey}T${parsedTime}:00+09:00`);
}

function addDaysToDateKey(dateKey, days) {
  const date = kstDate(dateKey, "00:00");
  if (!date) return "";
  const next = new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DEFAULT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(next);
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

function equipmentPeriodDays(period = "") {
  if (String(period).includes("2박3일") || String(period).includes("주말")) return 2;
  if (String(period).includes("1박2일")) return 1;
  return 0;
}

function legacyStartDate(reservation) {
  const fields = reservation.fields || {};
  const time = {
    equipment: timeStart(fields.rentalTime),
    studio: earliestSlotStart(fields.timeSlots || []),
    darkroom: earliestSlotStart(fields.timeSlots || []),
    print: timeStart(fields.startTime),
    lecture: timeStart(fields.time)
  }[reservation.type] || "";
  return kstDate(fields.reservedDate, time || "09:00");
}

function legacyEndDate(reservation, startAt) {
  const fields = reservation.fields || {};
  const date = fields.reservedDate || "";
  if (reservation.type === "equipment") {
    return kstDate(addDaysToDateKey(date, equipmentPeriodDays(fields.period)), timeStart(fields.returnTime) || "17:00");
  }
  if (reservation.type === "studio" || reservation.type === "darkroom") {
    const latestEnd = (fields.timeSlots || [])
      .map(slotBounds)
      .filter(Boolean)
      .reduce((max, slot) => Math.max(max, slot.end), -1);
    return latestEnd >= 0 ? new Date(kstDate(date, "00:00").getTime() + latestEnd * 60 * 1000) : startAt;
  }
  if (reservation.type === "print") return kstDate(date, timeStart(fields.endTime) || "19:00");
  return startAt;
}

export function reservationStartDate(reservation) {
  return validDate(reservation?.timing?.startAt) || legacyStartDate(reservation);
}

export function reservationEndDate(reservation, startAt) {
  return validDate(reservation?.timing?.endAt) || legacyEndDate(reservation, startAt);
}

function typeLabel(type) {
  return {
    equipment: "기자재",
    studio: "스튜디오",
    darkroom: "암실",
    print: "출력실",
    lecture: "특강"
  }[type] || "예약";
}

export function reservationMeta(reservation) {
  const fields = reservation.fields || {};
  if (reservation.type === "equipment") {
    return (reservation.equipmentItems || []).map((item) => item.code || item.name).filter(Boolean).slice(0, 3).join(", ") || "기자재 예약";
  }
  if (reservation.type === "studio") return [fields.studioSpace || (fields.studioSpaces || []).join(", "), (fields.timeSlots || []).join(", ")].filter(Boolean).join(" · ");
  if (reservation.type === "darkroom") return [(fields.timeSlots || []).join(", "), (fields.processTypes || []).join(", ")].filter(Boolean).join(" · ");
  if (reservation.type === "print") return [fields.startTime && fields.endTime ? `${fields.startTime}-${fields.endTime}` : "", fields.printType].filter(Boolean).join(" · ");
  if (reservation.type === "lecture") return [fields.title, fields.time, fields.location].filter(Boolean).join(" · ");
  return "";
}

function dateLabel(date, timeZone = DEFAULT_TIME_ZONE) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone, dateStyle: "short", timeStyle: "short" }).format(date);
}

function dateKey(date, timeZone = DEFAULT_TIME_ZONE) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function reportNotificationTime(reminder, endAt, reportDeadlineHours, explicitDeadlineAt) {
  if (!endAt) return null;
  if (reminder.minutesAfterEnd !== undefined) return new Date(endAt.getTime() + reminder.minutesAfterEnd * 60 * 1000);
  const deadlineAt = validDate(explicitDeadlineAt) || new Date(endAt.getTime() + reportDeadlineHours * 60 * 60 * 1000);
  return new Date(deadlineAt.getTime() - reminder.minutesBeforeDeadline * 60 * 1000);
}

function pushUnique(notifications, notification, seen) {
  if (seen.has(notification.id)) return;
  seen.add(notification.id);
  notifications.push(notification);
}

function isWithinTwelveHours(left, right) {
  return Math.abs(left.getTime() - right.getTime()) < 12 * 60 * 60 * 1000;
}

function reservationNotification({ userId, reservation, type, key, title, body, notifyAt, notificationType, extra = {} }) {
  return {
    id: stableNotificationId(`${userId}:${reservation.id}:${key}`),
    title,
    body,
    schedule: { at: notifyAt },
    channelId: RESERVATION_REMINDER_CHANNEL_ID,
    autoCancel: true,
    reservationId: reservation.id,
    extra: {
      route: "mine",
      reservationId: reservation.id,
      reservationType: reservation.type,
      notificationType,
      ...extra
    }
  };
}

export function planReservationNotifications({
  userId = "user",
  reservations = [],
  now = new Date(),
  reportDeadlineHours = 48,
  max = 64,
  timeZone = DEFAULT_TIME_ZONE
} = {}) {
  const notifications = [];
  const seen = new Set();
  const candidates = (Array.isArray(reservations) ? reservations : []).filter(Boolean);
  for (const reservation of candidates) {
    const startAt = reservationStartDate(reservation);
    if (!startAt) continue;
    const type = typeLabel(reservation.type);
    if (!TERMINAL_STATUSES.has(reservation.status)) {
      const acceptedPreStartTimes = [];
      for (const reminder of [...PRE_START_REMINDERS].sort((left, right) => left.minutes - right.minutes)) {
        const notifyAt = new Date(startAt.getTime() - reminder.minutes * 60 * 1000);
        if (notifyAt.getTime() <= now.getTime() + 60 * 1000) continue;
        if (acceptedPreStartTimes.some((acceptedAt) => isWithinTwelveHours(acceptedAt, notifyAt))) continue;
        pushUnique(notifications, reservationNotification({
          userId,
          reservation,
          type,
          key: reminder.key,
          title: `${type} ${reminder.label} 알림`,
          body: `${dateLabel(startAt, timeZone)} · ${reservationMeta(reservation) || type}`,
          notifyAt,
          notificationType: "pre-start",
          extra: { reminderKey: reminder.key }
        }), seen);
        acceptedPreStartTimes.push(notifyAt);
      }
      if (reservation.type === "equipment" && reservation.status === "checked_out") {
        const endAt = reservationEndDate(reservation, startAt);
        const notifyAt = endAt ? new Date(endAt.getTime() - 60 * 60 * 1000) : null;
        if (notifyAt && notifyAt.getTime() > now.getTime() + 60 * 1000) {
          pushUnique(notifications, reservationNotification({
            userId,
            reservation,
            type,
            key: "return-hour-before",
            title: "기자재 반납 1시간 전 알림",
            body: `${dateLabel(endAt, timeZone)}까지 ${reservationMeta(reservation) || "기자재"}를 반납해 주세요.`,
            notifyAt,
            notificationType: "return-hour-before"
          }), seen);
        }
      }
    }
    if (reservation.type !== "studio" || reservation.fields?.reportStatus === "submitted" || REPORT_EXCLUDED_STATUSES.has(reservation.status)) continue;
    const endAt = reservationEndDate(reservation, startAt);
    for (const reminder of REPORT_REMINDERS) {
      const notifyAt = reportNotificationTime(
        reminder,
        endAt,
        Math.max(1, Number(reportDeadlineHours || 48)),
        reservation.timing?.reportDeadlineAt
      );
      if (!notifyAt || notifyAt.getTime() <= now.getTime() + 60 * 1000) continue;
      pushUnique(notifications, {
        id: stableNotificationId(`${userId}:${reservation.id}:${reminder.key}`),
        title: reminder.label,
        body: `${dateKey(endAt, timeZone)} 스튜디오 사용 후 보고서가 필요합니다. ${reservationMeta(reservation) || "스튜디오 예약"}`,
        schedule: { at: notifyAt },
        channelId: RESERVATION_REMINDER_CHANNEL_ID,
        autoCancel: true,
        reservationId: reservation.id,
        extra: { route: "reports", reservationId: reservation.id, reservationType: reservation.type, notificationType: reminder.key }
      }, seen);
    }
  }
  const limit = Math.min(64, Math.max(0, Number.isFinite(Number(max)) ? Number(max) : 64));
  return notifications.sort((a, b) => a.schedule.at.getTime() - b.schedule.at.getTime() || a.id - b.id).slice(0, limit);
}

function kstParts(date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function nextAdminDigestTime(now) {
  const today = kstParts(now);
  for (const hour of [9, 15]) {
    const candidate = kstDate(today, `${String(hour).padStart(2, "0")}:00`);
    if (candidate.getTime() > now.getTime() + 60 * 1000) return candidate;
  }
  return kstDate(addDaysToDateKey(today, 1), "09:00");
}

export function planAdminNotifications({ userId = "admin", summary = {}, now = new Date() } = {}) {
  const counts = [
    ["가입 승인", Number(summary.pendingUsers || 0)],
    ["기자재 승인 대기", Number(summary.equipmentPendingApproval ?? summary.pendingEquipment ?? 0)],
    ["승인 완료", Number(summary.equipmentApproved || 0)],
    ["대여 중", Number(summary.equipmentCheckedOut || 0)],
    ["반납 완료", Number(summary.equipmentReturned || 0)],
    ["취소/반려", Number(summary.equipmentCancelled || 0)],
    ["오늘 예약", Number(summary.todayReservations || 0)],
    ["보고서 확인", Number(summary.missingReports || 0)]
  ].filter(([, count]) => count > 0);
  if (!counts.length) return [];
  const notifyAt = nextAdminDigestTime(now);
  return [{
    id: stableNotificationId(`${userId}:admin-digest:${notifyAt.toISOString().slice(0, 13)}`),
    title: "운영 확인 필요",
    body: counts.map(([label, count]) => `${label} ${count}건`).join(" · "),
    schedule: { at: notifyAt },
    channelId: RESERVATION_REMINDER_CHANNEL_ID,
    autoCancel: true,
    extra: { route: "admin", adminView: "dashboard", notificationType: "admin-digest" }
  }];
}
