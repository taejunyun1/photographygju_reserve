import { todayKeySeoul } from "./availability";
import type { StudentReservation } from "./types";

export function isReportDue(reservation: StudentReservation, today = todayKeySeoul()): boolean {
  if (reservation.type !== "studio") return false;
  if (reservation.fields.reportStatus === "submitted") return false;
  if (["cancelled", "admin_cancelled", "rejected"].includes(reservation.status || "")) return false;
  const reservedDate = String(reservation.fields.reservedDate || "");
  return Boolean(reservedDate && reservedDate <= today);
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function deadlineDateKey(reservation: StudentReservation, deadlineHours: number): string {
  const explicit = new Date(reservation.timing?.reportDeadlineAt || "");
  if (!Number.isNaN(explicit.getTime())) {
    return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(explicit);
  }
  const reservedDate = String(reservation.fields.reservedDate || "");
  return reservedDate ? addDays(reservedDate, Math.ceil(Math.max(1, deadlineHours) / 24)) : "";
}

export function reportDeadlineLabel(
  reservation: StudentReservation,
  deadlineHours = 48,
  today = todayKeySeoul()
): string {
  const deadline = deadlineDateKey(reservation, deadlineHours);
  if (!deadline) return "";
  const from = new Date(`${today}T00:00:00.000Z`);
  const to = new Date(`${deadline}T00:00:00.000Z`);
  const days = Math.ceil((to.getTime() - from.getTime()) / 86400000);
  if (days > 0) return `D-${days}`;
  if (days === 0) return "D-DAY";
  return "마감 지남";
}
