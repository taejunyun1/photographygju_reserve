import { defaultSettings } from "./settings.mjs";
import { reservationIntervals, reservationTiming } from "./reservation-timing.mjs";
import { getEquipmentHandoffBlockers } from "./reservation-views.mjs";

const DAY = 86400000;
const SPACE_ACTIVE = new Set(["auto_confirmed"]);
const EQUIPMENT_ACTIVE = new Set(["pending_approval", "approved", "checked_out"]);
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const SPACES = [
  { key: "a", name: "스튜디오 A", type: "studio" },
  { key: "b", name: "스튜디오 B", type: "studio" },
  { key: "dark", name: "암실", type: "darkroom" },
  { key: "print", name: "출력실", type: "print" }
];
const iso = value => Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const dateKey = value => new Date(new Date(value).getTime() + 9 * 3600000).toISOString().slice(0, 10);
const addDays = (date, count) => new Date(Date.parse(`${date}T00:00:00Z`) + count * DAY).toISOString().slice(0, 10);
const midnight = date => Date.parse(`${date}T00:00:00+09:00`);
const at = (date, minute) => new Date(midnight(date) + minute * 60000).toISOString();
const overlaps = (interval, from, to) => Date.parse(interval.startAt) < to && Date.parse(interval.endAt) > from;
const minute = time => {
  const match = String(time || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = Number(match[1]), m = Number(match[2]);
  return h <= 24 && m < 60 && (h !== 24 || m === 0) ? h * 60 + m : null;
};
const roomForSubspace = key => /studio\s*a|스튜디오\s*a/i.test(key) ? "a" : /studio\s*b|스튜디오\s*b/i.test(key) ? "b" : null;
const studioSpaces = fields => [...new Set((Array.isArray(fields?.studioSpaces) && fields.studioSpaces.length ? fields.studioSpaces : [fields?.studioSpace]).filter(value => typeof value === "string" && value))];
// Keep restriction scope aligned with reservation-validation.studioTargetMatches.
// Its legacy room-letter fallback applies e.g. "Studio A Front" to both A halves.
const targetMatchesSubspace = (target, key) => {
  const raw = String(target || "").trim();
  if (!raw) return true;
  const normalize = value => value.toLowerCase().replace(/[\s,_/()·-]+/g, "");
  if (normalize(raw).includes(normalize(key)) || normalize(key).includes(normalize(raw))) return true;
  const wantsA = /studio\s*a|스튜디오\s*a|(^|[^a-z])a($|[^a-z])/i.test(raw);
  const wantsB = /studio\s*b|스튜디오\s*b|(^|[^a-z])b($|[^a-z])/i.test(raw);
  return (wantsA && roomForSubspace(key) === "a") || (wantsB && roomForSubspace(key) === "b");
};
const ruleApplies = (rule, date) => WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()] === rule.day && (!rule.from || date >= rule.from) && (!rule.to || date <= rule.to);
const checkoutTimestamp = reservation => iso(reservation.actualCheckedOutAt) || (reservation.history || []).filter(row => row.status === "checked_out").map(row => iso(row.at)).filter(Boolean).sort().at(-1) || null;

function blockedForSpace(space, date, settings) {
  const intervals = [];
  const push = (startAt, endAt, label, subspaceKeys) => {
    if (Date.parse(endAt) <= Date.parse(startAt) || !overlaps({ startAt, endAt }, midnight(date), midnight(date) + DAY)) return;
    intervals.push({ startAt, endAt, label, ...(subspaceKeys?.length ? { subspaceKeys } : {}) });
  };
  const rules = [...(settings.blockedSchedules || []).filter(rule => rule.type === space.type), ...(space.key === "dark" ? settings.darkroomBlockedRules || [] : [])];
  for (const day of [addDays(date, -1), date]) for (const rule of rules) {
    if (!ruleApplies(rule, day)) continue;
    const start = minute(rule.start), parsedEnd = minute(rule.end);
    if (start === null || parsedEnd === null) continue;
    let subspaceKeys;
    if (space.type === "studio" && rule.target) {
      subspaceKeys = space.subspaces.filter(row => targetMatchesSubspace(rule.target, row.key)).map(row => row.key);
      if (!subspaceKeys.length) continue;
    }
    push(at(day, start), at(day, parsedEnd <= start ? parsedEnd + 1440 : parsedEnd), rule.label || "예약 제한", subspaceKeys);
  }
  if (space.key === "print") {
    const start = minute(settings.printAvailableStart), end = minute(settings.printAvailableEnd);
    if (start !== null && start > 0) push(at(date, 0), at(date, start), "운영시간 외");
    if (end !== null && end < 1440) push(at(date, end), at(date, 1440), "운영시간 외");
    if ((settings.printUploadStartDate && date < settings.printUploadStartDate) || (settings.printUploadEndDate && date > settings.printUploadEndDate)) push(at(date, 0), at(date, 1440), "출력 신청 기간 외");
  }
  return intervals.sort((a, b) => a.startAt.localeCompare(b.startAt));
}

/** One KST day of schedule / recorded custody, with explicit role projection. */
export function buildFacilityTimeline(db, { date, now, viewer }) {
  const clock = new Date(now);
  if (!Number.isFinite(clock.getTime())) throw Object.assign(new Error("조회 기준 시각이 올바르지 않습니다."), { status: 400 });
  const today = dateKey(clock), maxDate = addDays(today, 30);
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(midnight(date)) || dateKey(midnight(date)) !== date || date < today || date > maxDate) throw Object.assign(new Error("현황 날짜는 오늘부터 30일 후까지 올바른 날짜여야 합니다."), { status: 400 });
  const settings = { ...defaultSettings, ...db.settings };
  const from = midnight(date), to = from + DAY;
  const admin = viewer?.role === "admin";
  const identity = (reservation, custody = false) => {
    const isMine = Boolean(viewer?.id && reservation.userId === viewer.id);
    return {
      label: admin ? (db.users || []).find(user => user.id === reservation.userId)?.name || "예약자" : isMine ? "내 예약" : custody ? "대여 중" : "예약 있음",
      isMine,
      ...(admin || isMine ? { reservationId: reservation.id } : {})
    };
  };
  let entry = 0;
  const interval = (reservation, timing, extra = {}) => ({ entryKey: `entry-${++entry}`, startAt: timing.startAt, endAt: timing.endAt, status: reservation.status, ...identity(reservation), ...extra });
  const spaces = SPACES.map(definition => {
    const space = { ...definition, subspaces: definition.type === "studio" ? (settings.studioSpaces || []).filter(key => roomForSubspace(key) === definition.key).map(key => ({ key, label: key })) : [], intervals: [], blockedIntervals: [] };
    space.blockedIntervals = blockedForSpace(space, date, settings);
    return space;
  });
  for (const reservation of db.reservations || []) {
    if (reservation.type === "equipment" || !SPACE_ACTIVE.has(reservation.status)) continue;
    const targets = reservation.type === "studio" ? studioSpaces(reservation.fields) : [];
    for (const timing of reservationIntervals(reservation, settings)) {
      if (!overlaps(timing, from, to)) continue;
      for (const space of spaces) {
        if (space.type !== reservation.type) continue;
        const subspaceKeys = targets.filter(key => roomForSubspace(key) === space.key);
        if (space.type === "studio" && !subspaceKeys.length) continue;
        const currentStudioA = space.key === "a" && date === today && Date.parse(timing.startAt) <= clock.getTime() && clock.getTime() < Date.parse(timing.endAt);
        const contact = currentStudioA ? (db.users || []).find(user => user.id === reservation.userId) : null;
        space.intervals.push(interval(reservation, timing, space.type === "studio" ? { subspaceKeys, ...(contact ? { contactName: contact.name || "", phone: contact.phone || "" } : {}) } : {}));
      }
    }
  }
  for (const space of spaces) space.intervals.sort((a, b) => a.startAt.localeCompare(b.startAt));
  const equipment = [];
  for (const item of db.equipment || []) {
    const related = (db.reservations || []).filter(row => row.type === "equipment" && row.fields?.equipmentItemIds?.includes(item.id));
    const reservations = [], history = [];
    let custody = null;
    for (const reservation of related) {
      const timing = reservationTiming(reservation, settings);
      const startAt = checkoutTimestamp(reservation), endAt = iso(reservation.actualReturnedAt);
      if (startAt && endAt && Date.parse(endAt) > Date.parse(startAt) && overlaps({ startAt, endAt }, from, to)) history.push({ startAt, endAt, ...identity(reservation, true) });
      // A checked_out status is authoritative even when old records lack checkout timestamps.
      if (reservation.status === "checked_out" && !endAt) custody = { ...identity(reservation, true), checkedOutAt: startAt, expectedReturnAt: timing?.endAt || null, overdue: Boolean(timing && Date.parse(timing.endAt) < clock.getTime()) };
      if (timing && overlaps(timing, from, to) && (EQUIPMENT_ACTIVE.has(reservation.status) || (reservation.status === "returned" && (!startAt || !endAt)))) {
        const handoffNeedsReview = reservation.status === "approved" && getEquipmentHandoffBlockers(db, reservation, clock).some(block => block.equipmentId === item.id && block.reason !== "not_started");
        reservations.push(interval(reservation, timing, {
          ...(handoffNeedsReview ? { handoffNeedsReview: true } : {}),
          ...(!startAt && Date.parse(timing.startAt) < clock.getTime() || reservation.status === "returned" && (!startAt || !endAt) ? { historyUnavailable: true } : {})
        }));
      }
    }
    if (!custody && !reservations.length && !history.length) continue;
    equipment.push({ equipmentId: item.id, name: item.name || "장비", category: item.category || "", facility: item.facility || "", source: item.source || "", ...(admin ? { code: item.code || "" } : {}), custody, reservations: reservations.sort((a, b) => a.startAt.localeCompare(b.startAt)), history: history.sort((a, b) => a.startAt.localeCompare(b.startAt)) });
  }
  // Equipment validation checks every rental date without a time range. Mirror that
  // whole-day restriction instead of promising availability outside the rule's clock hours.
  const equipmentBlockedIntervals = (settings.blockedSchedules || [])
    .filter(rule => rule.type === "equipment" && ruleApplies(rule, date))
    .map(rule => ({ startAt: at(date, 0), endAt: at(date, 1440), label: rule.label || "기자재 예약 제한" }));
  return { schemaVersion: 1, layoutVersion: "corridor-v1", viewer: admin ? "admin" : "student", date, today, maxDate, timeZone: "Asia/Seoul", generatedAt: clock.toISOString(), validUntil: new Date(clock.getTime() + 60000).toISOString(), spaces, equipment, equipmentBlockedIntervals };
}
