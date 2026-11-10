import { reservationTiming, timeMinutes } from "./reservation-timing.mjs";
import { defaultSettings, hasDigitalLabOperatingHours } from "./settings.mjs";

/**
 * @typedef {object} DigitalLabSeat
 * @property {string} id
 * @property {string} label
 * @property {"mac" | "pc"} computerType
 */

/**
 * @typedef {object} DigitalLabFields
 * @property {string} reservedDate
 * @property {string} seatId
 * @property {string} startTime
 * @property {string} endTime
 * @property {string} purpose
 * @property {string} phone
 */

/** @typedef {Pick<DigitalLabFields, "reservedDate" | "startTime" | "endTime">} DigitalLabWindowFields */

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const INACTIVE_STATUSES = new Set(["cancelled", "admin_cancelled", "rejected", "returned", "completed"]);

/**
 * @param {DigitalLabSeat["computerType"]} computerType
 * @param {string} label
 * @param {number} count
 */
function makeSeats(computerType, label, count) {
  return Array.from({ length: count }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    return Object.freeze({ id: `${computerType}-${number}`, label: `${label} ${number}`, computerType });
  });
}

/** @type {ReadonlyArray<Readonly<DigitalLabSeat>>} */
export const DIGITAL_LAB_SEATS = Object.freeze([...makeSeats("mac", "Mac", 12), ...makeSeats("pc", "PC", 4)]);
const SEAT_IDS = new Set(DIGITAL_LAB_SEATS.map((seat) => seat.id));

function windowError(reasonCode, message) {
  return Object.assign(new Error(message), { status: 400, reasonCode });
}

/** @param {DigitalLabWindowFields} fields */
function selectionTiming(fields) {
  return fields && reservationTiming({ type: "digital_lab", fields });
}

/** @param {DigitalLabWindowFields} fields */
export function getDigitalLabWindow(settings, fields, { now = new Date() } = {}) {
  if (settings?.digitalLabEnabled !== true || !hasDigitalLabOperatingHours(settings)) {
    throw windowError("disabled", "디지털사진영상실 예약이 비활성 상태입니다.");
  }
  const window = selectionTiming(fields);
  const clock = new Date(now).getTime();
  if (!window || !Number.isFinite(clock)) {
    throw windowError("invalid_input", "예약 날짜와 시작·종료 시간을 2시간 단위로 올바르게 선택하세요.");
  }
  if (Date.parse(window.startAt) < clock) {
    throw windowError("past", "이미 시작한 시간은 예약할 수 없습니다.");
  }

  const configuredDays = Number(settings.reservationWindowDays ?? defaultSettings.reservationWindowDays);
  const days = Number.isSafeInteger(configuredDays) && configuredDays >= 0 ? configuredDays : defaultSettings.reservationWindowDays;
  const today = Math.floor((clock + KST_OFFSET_MS) / DAY_MS) * DAY_MS;
  const selectedDay = Date.parse(`${fields.reservedDate}T00:00:00Z`);
  if (selectedDay > today + days * DAY_MS) {
    throw windowError("invalid_input", `오늘부터 ${days}일 후까지만 예약할 수 있습니다.`);
  }

  const { digitalLabOpenTime: open, digitalLabCloseTime: close } = settings;
  if (fields.startTime < open || fields.endTime > close) {
    throw windowError("outside_hours", `디지털사진영상실 운영 시간은 ${open}~${close}입니다.`);
  }
  return window;
}

/** @param {DigitalLabWindowFields} fields */
export function digitalLabClassOverlaps(rule, fields) {
  if (rule?.type !== "digital_lab" || !selectionTiming(fields)) return false;
  const date = fields.reservedDate;
  const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
  if (rule.day !== weekday || typeof rule.from !== "string" || typeof rule.to !== "string"
    || !rule.from || !rule.to || date < rule.from || date > rule.to) return false;
  if (typeof rule.start !== "string" || typeof rule.end !== "string") return false;

  const start = timeMinutes(rule.start);
  const end = timeMinutes(rule.end);
  return start !== null && end !== null && start < end
    && start < timeMinutes(fields.endTime) && timeMinutes(fields.startTime) < end;
}

/**
 * Internal rows that intersect the selected time, across all seats.
 * @param {DigitalLabWindowFields} fields
 */
export function overlappingDigitalLabReservations(db, fields, { editingId = null } = {}) {
  const window = selectionTiming(fields);
  if (!window) return [];
  return (db.reservations || []).filter((row) => {
    if (row?.type !== "digital_lab" || (editingId !== null && row.id === editingId) || INACTIVE_STATUSES.has(row.status)
      || row.fields?.reservedDate !== fields.reservedDate) return false;
    const timing = reservationTiming(row);
    return timing && timing.startAt < window.endAt && window.startAt < timing.endAt;
  });
}

function unavailable(reasonCode, reason) {
  return { available: false, reasonCode, reason };
}

/**
 * The caller authorizes editingId and projects the result for the viewer.
 * @param {DigitalLabWindowFields & Pick<DigitalLabFields, "seatId">} fields
 */
export function evaluateDigitalLabSelection(db, fields, { userId, now, editingId } = {}) {
  if (!SEAT_IDS.has(fields?.seatId)) return unavailable("invalid_input", "디지털사진영상실 좌석을 올바르게 선택하세요.");
  try {
    getDigitalLabWindow(db.settings, fields, { now });
  } catch (error) {
    if (error.status !== 400) throw error;
    return unavailable(error.reasonCode, error.message);
  }
  if ((db.settings.blockedSchedules || []).some((rule) => digitalLabClassOverlaps(rule, fields))) {
    return unavailable("class_blocked", "수업 시간에는 디지털사진영상실을 예약할 수 없습니다.");
  }
  const overlaps = overlappingDigitalLabReservations(db, fields, { editingId });
  if (overlaps.some((row) => row.fields.seatId === fields.seatId)) {
    return unavailable("seat_reserved", "선택한 좌석에 해당 시간의 예약이 있습니다.");
  }
  if (userId && overlaps.some((row) => row.userId === userId)) {
    return unavailable("user_overlap", "같은 시간에 디지털사진영상실의 다른 좌석을 예약할 수 없습니다.");
  }
  return { available: true, reasonCode: null, reason: "" };
}
