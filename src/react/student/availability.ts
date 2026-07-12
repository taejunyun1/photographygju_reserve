import type {
  ReservationType,
  StudentBlockedSchedule,
  StudentBootstrap,
  StudentEquipment,
  StudentReservation,
  StudentReservationSelectionPatch,
  StudentSettings
} from "./types";

const WEEKDAYS: Readonly<Record<string, number>> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
};

const NON_BLOCKING_STATUSES = new Set(["cancelled", "admin_cancelled", "rejected", "returned", "completed"]);

export type AvailabilityResult = {
  available: boolean;
  reason?: string;
  remaining?: number;
};

export type PrintCapacityBucket = {
  start: number;
  end: number;
  startTime: string;
  endTime: string;
};

function available(extra: Omit<AvailabilityResult, "available"> = {}): AvailabilityResult {
  return { available: true, ...extra };
}

function unavailable(reason: string, extra: Omit<AvailabilityResult, "available" | "reason"> = {}): AvailabilityResult {
  return { available: false, reason, ...extra };
}

export function todayKeySeoul(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now).reduce<Record<string, string>>((result, part) => {
    if (part.type !== "literal") result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function dayIndex(dateKey: string): number | null {
  const value = new Date(`${dateKey}T00:00:00`).getDay();
  return Number.isNaN(value) ? null : value;
}

function addDays(dateKey: string, count: number): string {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + count);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function periodDays(period: string): number {
  if (period.includes("2박3일") || period.includes("주말")) return 2;
  if (period.includes("1박2일")) return 1;
  return 0;
}

function equipmentRange(date: string, period: string) {
  if (!date) return null;
  return { start: date, end: addDays(date, periodDays(period)) };
}

function dateRangesOverlap(
  left: { start: string; end: string } | null,
  right: { start: string; end: string } | null
): boolean {
  return Boolean(left && right && left.start <= right.end && right.start <= left.end);
}

function isBlockingReservation(reservation: StudentReservation): boolean {
  return !NON_BLOCKING_STATUSES.has(reservation.status || "");
}

function reservations(bootstrap: StudentBootstrap, type: ReservationType, date?: string): readonly StudentReservation[] {
  return (bootstrap.reservations || [])
    .filter((reservation) => reservation.type === type)
    .filter(isBlockingReservation)
    .filter((reservation) => !date || reservation.fields.reservedDate === date);
}

export function timeToMinutes(value: string | undefined): number | null {
  const match = String(value || "").match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function minutesToTime(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

function rangeFromLabel(value: string): { start: number; end: number } | null {
  const match = value.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
  if (!match) return null;
  const start = timeToMinutes(match[1]);
  let end = timeToMinutes(match[2]);
  if (start === null || end === null) return null;
  if (end <= start) end += 1440;
  return { start, end };
}

function intervalsOverlap(leftStart: number, leftEnd: number, rightStart: number, rightEnd: number): boolean {
  return leftStart < rightEnd && rightStart < leftEnd;
}

function ruleAppliesToDate(rule: StudentBlockedSchedule, date: string): boolean {
  const expectedDay = rule.day ? WEEKDAYS[rule.day] : undefined;
  if (expectedDay === undefined || expectedDay !== dayIndex(date)) return false;
  if (rule.from && date < rule.from) return false;
  if (rule.to && date > rule.to) return false;
  return true;
}

function ruleOverlapsRange(rule: StudentBlockedSchedule, range: { start: number; end: number } | null): boolean {
  if (!range) return true;
  const start = timeToMinutes(rule.start);
  let end = timeToMinutes(rule.end);
  if (start === null || end === null) return true;
  if (end <= start) end += 1440;
  return intervalsOverlap(range.start, range.end, start, end);
}

function studioTargetMatches(target: string | undefined, space: string): boolean {
  const rawTarget = String(target || "").trim();
  if (!rawTarget || !space) return true;
  const normalizedTarget = rawTarget.toLowerCase().replace(/[\s,_/()·-]+/g, "");
  const normalizedSpace = space.toLowerCase().replace(/[\s,_/()·-]+/g, "");
  if (normalizedTarget.includes(normalizedSpace) || normalizedSpace.includes(normalizedTarget)) return true;
  const wantsA = /studio\s*a|스튜디오\s*a|(^|[^a-z])a($|[^a-z])/i.test(rawTarget);
  const wantsB = /studio\s*b|스튜디오\s*b|(^|[^a-z])b($|[^a-z])/i.test(rawTarget);
  const isA = /studio\s*a|스튜디오\s*a/i.test(space);
  const isB = /studio\s*b|스튜디오\s*b/i.test(space);
  return (wantsA && isA) || (wantsB && isB);
}

function blockedRules(
  settings: StudentSettings,
  type: ReservationType,
  date: string,
  range: { start: number; end: number } | null = null,
  target = ""
): readonly StudentBlockedSchedule[] {
  const configured = (settings.blockedSchedules || [])
    .filter((rule) => rule.type === type)
    .filter((rule) => ruleAppliesToDate(rule, date))
    .filter((rule) => ruleOverlapsRange(rule, range))
    .filter((rule) => type !== "studio" || studioTargetMatches(rule.target, target));
  if (type !== "darkroom") return configured;
  const darkroom = (settings.darkroomBlockedRules || [])
    .filter((rule) => ruleAppliesToDate(rule, date))
    .filter((rule) => ruleOverlapsRange(rule, range));
  return [...configured, ...darkroom];
}

function ruleLabel(rule: StudentBlockedSchedule): string {
  return rule.label || rule.target || `${rule.start || ""}-${rule.end || ""}` || "운영 차단";
}

export function reservationDateAvailability(
  type: ReservationType,
  date: string,
  settings: StudentSettings,
  today = todayKeySeoul()
): AvailabilityResult {
  if (!date) return unavailable("예약 날짜를 선택하세요.");
  const previousDayRequired = type === "equipment" || type === "studio";
  if (previousDayRequired ? date <= today : date < today) {
    return unavailable(previousDayRequired
      ? "사용일 전날 23:59까지 예약할 수 있습니다."
      : "오늘 이전 날짜는 예약할 수 없습니다.");
  }
  if (type === "equipment" && (dayIndex(date) === 0 || dayIndex(date) === 6)) {
    return unavailable("토요일/일요일은 기자재 예약을 시작할 수 없습니다.");
  }
  if (type === "print") {
    if (settings.printUploadStartDate && date < settings.printUploadStartDate) {
      return unavailable("출력 업로드 가능 기간 전입니다.");
    }
    if (settings.printUploadEndDate && date > settings.printUploadEndDate) {
      return unavailable("출력 업로드 가능 기간 후입니다.");
    }
  }
  return available();
}

export function equipmentScheduleAvailability(
  bootstrap: StudentBootstrap,
  date: string,
  period: string,
  rentalTime: string,
  returnTime: string,
  today?: string
): AvailabilityResult {
  const dateResult = reservationDateAvailability("equipment", date, bootstrap.settings, today);
  if (!dateResult.available) return dateResult;
  if (!period || !rentalTime || !returnTime) return unavailable("대여 기간과 시간을 모두 선택하세요.");
  if ((period.includes("2박3일") || period.includes("주말")) && dayIndex(date) !== 5) {
    return unavailable("2박3일(주말) 대여는 금요일에만 가능합니다.");
  }
  if (periodDays(period) === 0) {
    const rental = timeToMinutes(rentalTime);
    const returned = timeToMinutes(returnTime);
    if (rental === null || returned === null || returned <= rental) {
      return unavailable("당일 반납 시간은 대여 시간보다 늦어야 합니다.");
    }
  }
  const range = equipmentRange(date, period);
  if (range) {
    let cursor = range.start;
    while (cursor <= range.end) {
      const blocked = blockedRules(bootstrap.settings, "equipment", cursor);
      if (blocked.length) return unavailable(`${cursor} 기자재 예약이 차단되어 있습니다.`);
      cursor = addDays(cursor, 1);
    }
  }
  return available();
}

function statusReservable(status: string | undefined): boolean {
  const normalized = String(status || "").trim().toLowerCase().replace(/\s+/g, "");
  return !normalized || ["available", "사용가능", "가능"].includes(normalized);
}

export function equipmentItemAvailability(
  bootstrap: StudentBootstrap,
  item: StudentEquipment,
  date: string,
  period: string
): AvailabilityResult {
  if (item.active === false) return unavailable("비활성 기자재입니다.");
  if (!item.reservable || !statusReservable(item.status)) return unavailable("현재 예약할 수 없는 기자재입니다.");
  if (!date || !period) return unavailable("날짜와 대여 기간을 먼저 선택하세요.");
  const requestedRange = equipmentRange(date, period);
  const conflict = reservations(bootstrap, "equipment").find((reservation) => {
    const ids = [
      ...(reservation.fields.equipmentItemIds || []),
      ...(reservation.equipmentItems || []).map((equipmentItem) => equipmentItem.id)
    ];
    return ids.includes(item.id)
      && dateRangesOverlap(equipmentRange(String(reservation.fields.reservedDate || ""), String(reservation.fields.period || "")), requestedRange);
  });
  if (conflict) return unavailable("선택한 기간에 이미 예약된 기자재입니다.");
  return available();
}

function normalizedText(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

export function isHighValueEquipment(item: StudentEquipment, settings: StudentSettings): boolean {
  const categories = settings.equipmentHighValueCategories || ["Body", "Lens"];
  return categories.map(normalizedText).includes(normalizedText(item.category));
}

export function isCameraBagEquipment(item: StudentEquipment, settings: StudentSettings): boolean {
  const keywords = settings.equipmentBagKeywords || ["펠리컨", "Pelican"];
  const haystack = [item.name, item.code, item.category, item.notes, item.model, item.brand].map(normalizedText).join(" ");
  return keywords.map(normalizedText).filter(Boolean).some((keyword) => haystack.includes(keyword));
}

export function studioSlotAvailability(
  bootstrap: StudentBootstrap,
  date: string,
  space: string,
  slot: string
): AvailabilityResult {
  if (!date || !space || !slot) return unavailable("날짜, 공간, 시간을 선택하세요.");
  const range = rangeFromLabel(slot);
  const blocked = blockedRules(bootstrap.settings, "studio", date, range, space);
  if (blocked.length) return unavailable(`차단 일정: ${ruleLabel(blocked[0])}`);
  const conflict = reservations(bootstrap, "studio", date).some((reservation) => {
    const spaces = (reservation.fields.studioSpaces || [reservation.fields.studioSpace]).filter(Boolean);
    return spaces.includes(space) && (reservation.fields.timeSlots || []).includes(slot);
  });
  if (conflict) return unavailable("이미 예약된 시간입니다.");
  return available();
}

export function areSlotsConsecutive(selectedSlots: readonly string[], orderedSlots: readonly string[]): boolean {
  const unique = [...new Set(selectedSlots)];
  if (!unique.length || unique.length !== selectedSlots.length) return false;
  const indices = unique.map((slot) => orderedSlots.indexOf(slot)).sort((left, right) => left - right);
  if (indices.some((index) => index < 0)) return false;
  return indices.every((index, position) => position === 0 || index === indices[position - 1] + 1);
}

export function studioSelectionAvailability(
  bootstrap: StudentBootstrap,
  date: string,
  space: string,
  slots: readonly string[]
): AvailabilityResult {
  if (!date || !space || !slots.length) return unavailable("스튜디오 공간과 시간을 선택하세요.");
  const maxSlots = Number(bootstrap.settings.studioMaxSlots || 3);
  if (slots.length > maxSlots) return unavailable(`스튜디오는 최대 ${maxSlots}타임까지 선택할 수 있습니다.`);
  if (!areSlotsConsecutive(slots, bootstrap.settings.studioSlots || [])) {
    return unavailable("스튜디오는 연속된 시간만 선택할 수 있습니다.");
  }
  for (const slot of slots) {
    const result = studioSlotAvailability(bootstrap, date, space, slot);
    if (!result.available) return result;
  }
  return available();
}

export function darkroomSlotAvailability(
  bootstrap: StudentBootstrap,
  date: string,
  slot: string,
  participantCount: number
): AvailabilityResult {
  if (!date || !slot) return unavailable("암실 날짜와 시간을 선택하세요.");
  const blocked = blockedRules(bootstrap.settings, "darkroom", date, rangeFromLabel(slot));
  if (blocked.length) return unavailable(`사용 불가: ${ruleLabel(blocked[0])}`, { remaining: 0 });
  const capacity = Number(bootstrap.settings.darkroomCapacity || 6);
  const used = reservations(bootstrap, "darkroom", date)
    .filter((reservation) => (reservation.fields.timeSlots || []).includes(slot))
    .reduce((sum, reservation) => sum + Math.max(1, Number(reservation.fields.participantCount || 1)), 0);
  const remaining = Math.max(0, capacity - used);
  const requested = Math.max(1, Number(participantCount || 1));
  if (requested > remaining) return unavailable(`잔여 정원은 ${remaining}명입니다.`, { remaining });
  return available({ remaining });
}

export function printCapacityBuckets(settings: StudentSettings): readonly PrintCapacityBucket[] {
  const start = timeToMinutes(settings.printAvailableStart);
  const end = timeToMinutes(settings.printAvailableEnd);
  const windowMinutes = Number(settings.printCapacityWindowMinutes || 120);
  if (start === null || end === null || end <= start || windowMinutes <= 0) return [];
  const buckets: PrintCapacityBucket[] = [];
  for (let cursor = start; cursor < end; cursor += windowMinutes) {
    const bucketEnd = Math.min(cursor + windowMinutes, end);
    buckets.push({ start: cursor, end: bucketEnd, startTime: minutesToTime(cursor), endTime: minutesToTime(bucketEnd) });
  }
  return buckets;
}

export function printBucketAvailability(
  bootstrap: StudentBootstrap,
  date: string,
  bucket: PrintCapacityBucket
): AvailabilityResult {
  if (!date) return unavailable("출력 날짜를 선택하세요.");
  const blocked = blockedRules(bootstrap.settings, "print", date, bucket);
  if (blocked.length) return unavailable(`차단 일정: ${ruleLabel(blocked[0])}`, { remaining: 0 });
  const count = reservations(bootstrap, "print", date).filter((reservation) => {
    const start = timeToMinutes(reservation.fields.startTime as string | undefined);
    const end = timeToMinutes(reservation.fields.endTime as string | undefined);
    return start !== null && end !== null && intervalsOverlap(start, end, bucket.start, bucket.end);
  }).length;
  const capacity = Number(bootstrap.settings.printCapacityPerWindow || 4);
  const remaining = Math.max(0, capacity - count);
  if (remaining <= 0) return unavailable("예약 가능 인원이 가득 찼습니다.", { remaining });
  return available({ remaining });
}

export function reservationSelectionPatchForDate(
  type: ReservationType,
  selectedDate: string
): StudentReservationSelectionPatch {
  if (type === "equipment") {
    return {
      type,
      selectedDate,
      equipmentPeriod: "",
      equipmentRentalTime: "",
      equipmentReturnTime: "",
      equipmentItemIds: []
    };
  }
  if (type === "studio") {
    return { type, selectedDate, studioSpace: "", studioSlots: [] };
  }
  if (type === "darkroom") {
    return {
      type,
      selectedDate,
      darkroomSlots: [],
      darkroomProcessTypes: [],
      darkroomParticipantCount: "1",
      darkroomChemicals: {}
    };
  }
  return {
    type,
    selectedDate,
    printStartTime: "",
    printEndTime: "",
    printTypes: [],
    printPapers: [],
    printSizes: []
  };
}
