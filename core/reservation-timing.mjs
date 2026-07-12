import {
  DEFAULT_STUDIO_REPORT_DEADLINE_HOURS,
  parseStudioReportDeadlineHours
} from "./settings.mjs";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function validDateParts(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return { year, month, day };
}

function timeMinutes(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 24 || minute > 59 || (hour === 24 && minute !== 0)) return null;
  return hour * 60 + minute;
}

function kstDateAtMinutes(dateKey, minutes) {
  const parts = validDateParts(dateKey);
  if (!parts || !Number.isFinite(minutes) || minutes < 0) return null;
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0) + minutes * 60 * 1000 - KST_OFFSET_MS);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(dateKey, days) {
  const parts = validDateParts(dateKey);
  if (!parts || !Number.isInteger(days)) return "";
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return date.toISOString().slice(0, 10);
}

function slotEndMinutes(slot) {
  const match = String(slot || "").match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
  if (!match) return null;
  const start = timeMinutes(match[1]);
  let end = timeMinutes(match[2]);
  if (start === null || end === null) return null;
  if (end <= start) end += 24 * 60;
  return { start, end };
}

function rangeBounds(ranges) {
  if (!ranges.length) return null;
  return {
    start: Math.min(...ranges.map((range) => range.start)),
    end: Math.max(...ranges.map((range) => range.end))
  };
}

function circularRangeBounds(ranges) {
  const ordered = ranges
    .map((range) => ({ start: range.start, end: range.end }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
  if (ordered.length < 2) return rangeBounds(ordered);

  let largestGapIndex = -1;
  let largestGap = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < ordered.length; index += 1) {
    const current = ordered[index];
    const next = ordered[(index + 1) % ordered.length];
    const nextStart = next.start + (index === ordered.length - 1 ? 24 * 60 : 0);
    const gap = nextStart - current.end;
    if (gap >= largestGap) {
      largestGap = gap;
      largestGapIndex = index;
    }
  }

  const firstIndex = (largestGapIndex + 1) % ordered.length;
  const start = ordered[firstIndex].start;
  let end = ordered[firstIndex].end;
  for (let offset = 1; offset < ordered.length; offset += 1) {
    const range = ordered[(firstIndex + offset) % ordered.length];
    end = Math.max(end, range.end + (range.start < start ? 24 * 60 : 0));
  }
  return { start, end };
}

function configuredSlotRanges(orderedSlots) {
  let dayOffset = 0;
  let previousStart = null;
  return (Array.isArray(orderedSlots) ? orderedSlots : []).map((slot) => {
    const range = slotEndMinutes(slot);
    if (!range) return null;
    let start = range.start + dayOffset;
    if (previousStart !== null && start < previousStart) {
      dayOffset += 24 * 60;
      start = range.start + dayOffset;
    }
    previousStart = start;
    return { slot, start, end: range.end + dayOffset };
  }).filter(Boolean);
}

function canonicalSlotRange(selectedSlots, orderedSlots, { allowCircular = true } = {}) {
  const selected = Array.isArray(selectedSlots) ? [...selectedSlots] : [];
  if (!selected.length) return null;

  const configured = configuredSlotRanges(orderedSlots);
  const configuredBySlot = new Map(configured.map((range) => [range.slot, range]));
  const configuredSelection = selected.map((slot) => configuredBySlot.get(slot));
  if (configuredSelection.every(Boolean)) {
    if (!allowCircular) return rangeBounds(configuredSelection);
    const wrapsInConfiguredOrder = configured.some((range) => range.start >= 24 * 60);
    const coversFullDay = !wrapsInConfiguredOrder && configured[0]?.start === 0 && configured.at(-1)?.end === 24 * 60;
    return coversFullDay ? circularRangeBounds(configuredSelection) : rangeBounds(configuredSelection);
  }

  const parsedSelection = selected.map(slotEndMinutes);
  if (parsedSelection.some((range) => !range)) return null;
  const crossesDayBoundary = allowCircular && parsedSelection.some((range) => range.start === 0) && parsedSelection.some((range) => range.end === 24 * 60);
  return crossesDayBoundary ? circularRangeBounds(parsedSelection) : rangeBounds(parsedSelection);
}

function equipmentPeriodDays(period = "") {
  if (String(period).includes("2박3일") || String(period).includes("주말")) return 2;
  if (String(period).includes("1박2일")) return 1;
  return 0;
}

function studioReportDeadlineHours(value) {
  return parseStudioReportDeadlineHours(value) ?? DEFAULT_STUDIO_REPORT_DEADLINE_HOURS;
}

function timingForFields(type, fields = {}, settings = {}) {
  const date = fields.reservedDate || "";
  if (!validDateParts(date)) return null;

  if (type === "equipment") {
    const start = timeMinutes(fields.rentalTime);
    const end = timeMinutes(fields.returnTime);
    const endDate = addDays(date, equipmentPeriodDays(fields.period));
    const startAt = kstDateAtMinutes(date, start);
    const endAt = kstDateAtMinutes(endDate, end);
    return startAt && endAt ? { startAt: startAt.toISOString(), endAt: endAt.toISOString() } : null;
  }

  if (type === "studio" || type === "darkroom") {
    const slots = Array.isArray(fields.timeSlots) ? fields.timeSlots : [];
    const slotRange = canonicalSlotRange(
      slots,
      type === "studio" ? settings.studioSlots : settings.darkroomSlots,
      { allowCircular: type === "studio" }
    );
    if (!slotRange) return null;
    const startAt = kstDateAtMinutes(date, slotRange.start);
    const endAt = kstDateAtMinutes(date, slotRange.end);
    if (!startAt || !endAt) return null;
    const timing = { startAt: startAt.toISOString(), endAt: endAt.toISOString() };
    if (type === "studio") {
      const deadlineHours = studioReportDeadlineHours(settings.studioReportDeadlineHours);
      timing.reportDeadlineAt = new Date(endAt.getTime() + deadlineHours * 60 * 60 * 1000).toISOString();
    }
    return timing;
  }

  if (type === "print") {
    const startAt = kstDateAtMinutes(date, timeMinutes(fields.startTime));
    const endAt = kstDateAtMinutes(date, timeMinutes(fields.endTime));
    return startAt && endAt ? { startAt: startAt.toISOString(), endAt: endAt.toISOString() } : null;
  }

  return null;
}

export function reservationTiming(reservation, settings = {}) {
  if (!reservation?.type) return null;
  return timingForFields(reservation.type, reservation.fields, settings);
}
