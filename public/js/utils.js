import { state } from "./state.js?v=20260623-notify-ui2";
import { statusColor, statusLabel, typeLabel, weekdayIndex } from "./constants.js?v=20260623-notify-ui2";

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const HANGUL_INITIALS = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const HANGUL_MEDIALS = ["ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ", "ㅙ", "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ", "ㅡ", "ㅢ", "ㅣ"];
const HANGUL_FINALS = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const HANGUL_COMPOUND_MEDIALS = new Map([
  ["ㅗㅏ", "ㅘ"], ["ㅗㅐ", "ㅙ"], ["ㅗㅣ", "ㅚ"],
  ["ㅜㅓ", "ㅝ"], ["ㅜㅔ", "ㅞ"], ["ㅜㅣ", "ㅟ"],
  ["ㅡㅣ", "ㅢ"]
]);
const HANGUL_COMPOUND_FINALS = new Map([
  ["ㄱㅅ", "ㄳ"], ["ㄴㅈ", "ㄵ"], ["ㄴㅎ", "ㄶ"],
  ["ㄹㄱ", "ㄺ"], ["ㄹㅁ", "ㄻ"], ["ㄹㅂ", "ㄼ"],
  ["ㄹㅅ", "ㄽ"], ["ㄹㅌ", "ㄾ"], ["ㄹㅍ", "ㄿ"],
  ["ㄹㅎ", "ㅀ"], ["ㅂㅅ", "ㅄ"]
]);
const HANGUL_INITIAL_INDEX = new Map(HANGUL_INITIALS.map((item, index) => [item, index]));
const HANGUL_MEDIAL_INDEX = new Map(HANGUL_MEDIALS.map((item, index) => [item, index]));
const HANGUL_FINAL_INDEX = new Map(HANGUL_FINALS.map((item, index) => [item, index]));

function isCompatibilityConsonant(value) {
  return HANGUL_INITIAL_INDEX.has(value);
}

function readCompatibilityMedial(chars, index) {
  const single = chars[index];
  if (!HANGUL_MEDIAL_INDEX.has(single)) return null;
  const compound = HANGUL_COMPOUND_MEDIALS.get(`${single}${chars[index + 1] || ""}`);
  return compound ? { value: compound, length: 2 } : { value: single, length: 1 };
}

function composeCompatibilityHangul(value = "") {
  const chars = Array.from(String(value ?? ""));
  const output = [];
  let index = 0;

  while (index < chars.length) {
    const initial = chars[index];
    const medial = readCompatibilityMedial(chars, index + 1);
    if (!isCompatibilityConsonant(initial) || !medial) {
      output.push(initial);
      index += 1;
      continue;
    }

    index += 1 + medial.length;
    let final = "";
    const firstFinal = chars[index];
    const nextMedial = readCompatibilityMedial(chars, index + 1);

    if (HANGUL_FINAL_INDEX.has(firstFinal) && !nextMedial) {
      const secondFinal = chars[index + 1];
      const compoundFinal = HANGUL_COMPOUND_FINALS.get(`${firstFinal}${secondFinal || ""}`);
      const afterCompoundMedial = readCompatibilityMedial(chars, index + 2);
      if (compoundFinal && !afterCompoundMedial) {
        final = compoundFinal;
        index += 2;
      } else {
        final = firstFinal;
        index += 1;
      }
    }

    const code = 0xac00
      + ((HANGUL_INITIAL_INDEX.get(initial) * HANGUL_MEDIALS.length) + HANGUL_MEDIAL_INDEX.get(medial.value)) * HANGUL_FINALS.length
      + HANGUL_FINAL_INDEX.get(final);
    output.push(String.fromCharCode(code));
  }

  return output.join("");
}

export function normalizeUnicodeText(value = "") {
  try {
    return composeCompatibilityHangul(value).normalize("NFC");
  } catch {
    return String(value ?? "");
  }
}

export function normalizeSearchText(value = "") {
  return normalizeUnicodeText(value).toLowerCase();
}

export function searchableText(values = []) {
  const flatten = (value) => {
    if (Array.isArray(value)) return value.flatMap(flatten);
    if (value && typeof value === "object") return Object.values(value).flatMap(flatten);
    return value === undefined || value === null ? [] : [value];
  };
  return normalizeSearchText(flatten(values).filter(Boolean).join(" "));
}

export function tag(value, color = "") {
  return `<span class="tag ${color || statusColor[value] || "gray"}">${escapeHtml(statusLabel[value] || value)}</span>`;
}

export function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function userStatusCell(user) {
  const blockedUntil = user.approvalStatus === "blocked" && user.blockedUntil ? `<small class="status-note">대여금지 해제 ${escapeHtml(formatDateTime(user.blockedUntil))}</small>` : "";
  return `<div class="status-cell">${tag(user.approvalStatus)}${blockedUntil}</div>`;
}

export function userSortValue(user, field) {
  if (field === "name") return user.name || "";
  if (field === "studentId") return user.studentId || "";
  if (field === "studentStatus") return user.studentStatus || "";
  if (field === "approvalStatus") return statusLabel[user.approvalStatus] || user.approvalStatus || "";
  return user[field] || "";
}

export function sortedAdminUsers() {
  const { field, direction } = state.adminUserSort;
  const statusFilter = state.adminUserStatusFilter || "all";
  const multiplier = direction === "desc" ? -1 : 1;
  return state.adminUsers
    .filter((user) => user.role !== "admin")
    .filter((user) => statusFilter === "all" || user.approvalStatus === statusFilter)
    .sort((a, b) => {
      const aValue = String(userSortValue(a, field)).toLocaleLowerCase();
      const bValue = String(userSortValue(b, field)).toLocaleLowerCase();
      return aValue.localeCompare(bValue, "ko") * multiplier;
    });
}

export function userSortButton(field, label) {
  const active = state.adminUserSort.field === field;
  const direction = active ? state.adminUserSort.direction : "";
  return `<button class="table-sort ${active ? "active" : ""}" data-user-sort="${field}">${label}${active ? (direction === "asc" ? " ↑" : " ↓") : ""}</button>`;
}

export function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

export function getChecked(name) {
  return [...document.querySelectorAll(`[name="${name}"]:checked`)].map((item) => item.value);
}

export function equipmentCategories() {
  const fromSettings = state.bootstrap?.settings?.equipmentCategories || ["Body", "Lens", "Lighting", "Audio", "Drone", "Other"];
  const fromEquipment = (state.bootstrap?.equipment || []).map((item) => item.category).filter(Boolean);
  return [...new Set([...fromSettings, ...fromEquipment])];
}

export function equipmentBrand(item = {}) {
  const haystack = [item.brand, item.name, item.model, item.code, item.notes]
    .map((value) => String(value || "").trim().toLowerCase())
    .join(" ");
  if (/소니|sony/.test(haystack)) return "sony";
  if (/캐논|canon|eos|ef[\s-]?|rf[\s-]?/.test(haystack)) return "canon";
  if (/니콘|nikon|nikkor/.test(haystack)) return "nikon";
  return "";
}

export function equipmentBrandLabel(brand = "") {
  return {
    sony: "소니",
    canon: "캐논",
    nikon: "니콘"
  }[brand] || "";
}

export function adminGuide(title, body) {
  return `
    <details class="guide-card auxiliary-guide">
      <summary>
        <strong>${escapeHtml(title)}</strong>
        <span>보기</span>
      </summary>
      <p>${escapeHtml(body)}</p>
    </details>
  `;
}

export function sortedNotices(notices = []) {
  return [...notices].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
}

export function noticePreview(body = "") {
  const compact = String(body).replace(/\s+/g, " ").trim();
  if (compact.length <= 74) return compact;
  return `${compact.slice(0, 74)}...`;
}

export function areSlotsConsecutive(selectedSlots, orderedSlots) {
  const unique = [...new Set(selectedSlots)];
  if (unique.length !== selectedSlots.length) return false;
  const indices = unique.map((slot) => orderedSlots.indexOf(slot)).sort((a, b) => a - b);
  if (indices.some((index) => index < 0)) return false;
  return indices.every((index, position) => position === 0 || index === indices[position - 1] + 1);
}

export function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayKey() {
  return dateKey(new Date());
}

export function addMonths(monthKey, offset) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return dateKey(date).slice(0, 7);
}

export function monthTitle(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return `${year}년 ${month}월`;
}

export function reservationDate(reservation) {
  return reservation?.fields?.reservedDate || "";
}

export function addDaysToDateKey(key, days) {
  const date = new Date(`${key}T00:00:00`);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

export function equipmentPeriodDays(period = "") {
  if (String(period).includes("2박3일") || String(period).includes("주말")) return 2;
  if (String(period).includes("1박2일")) return 1;
  return 0;
}

export function equipmentReservationDates(fields = {}) {
  if (!fields.reservedDate) return [];
  return Array.from({ length: equipmentPeriodDays(fields.period) + 1 }, (_, index) => addDaysToDateKey(fields.reservedDate, index));
}

export function equipmentReservationRange(fields = {}) {
  const start = fields.reservedDate || "";
  if (!start) return null;
  return { start, end: addDaysToDateKey(start, equipmentPeriodDays(fields.period)) };
}

export function dateRangesOverlap(a, b) {
  if (!a || !b) return false;
  return a.start <= b.end && b.start <= a.end;
}

export function equipmentItemReservationConflict(itemId, reservedDate, period) {
  if (!itemId || !reservedDate) return null;
  const requestedRange = equipmentReservationRange({ reservedDate, period });
  return (state.bootstrap?.reservations || []).find((reservation) => {
    if (reservation.type !== "equipment") return false;
    const itemIds = [
      ...(reservation.fields?.equipmentItemIds || []),
      ...(reservation.equipmentItems || []).map((item) => item.id)
    ];
    return itemIds.includes(itemId) && dateRangesOverlap(equipmentReservationRange(reservation.fields), requestedRange);
  }) || null;
}

export function equipmentItemReservedInRange(itemId, reservedDate, period) {
  return Boolean(equipmentItemReservationConflict(itemId, reservedDate, period));
}

export function relatedLensItemsForSelection(selectedItems = [], { reservedDate = "", period = "" } = {}) {
  const bodyBrands = [...new Set(selectedItems
    .filter((item) => String(item?.category || "").trim().toLowerCase() === "body")
    .map(equipmentBrand)
    .filter(Boolean))];
  if (!bodyBrands.length) return [];
  const selectedIds = new Set(selectedItems.map((item) => item.id));
  return (state.bootstrap?.equipment || [])
    .filter((item) => item.active !== false && item.reservable && item.status === "가능")
    .filter((item) => String(item.category || "").trim().toLowerCase() === "lens")
    .filter((item) => bodyBrands.includes(equipmentBrand(item)))
    .filter((item) => !selectedIds.has(item.id))
    .filter((item) => !reservedDate || !equipmentItemReservedInRange(item.id, reservedDate, period));
}

export function equipmentItemReservedOnDate(itemId, key) {
  return equipmentItemReservedInRange(itemId, key, "당일");
}

export function equipmentRangeLabel(reservedDate, period) {
  const range = equipmentReservationRange({ reservedDate, period });
  if (!range) return "기간을 선택하세요";
  if (range.start === range.end) return range.start;
  return `${range.start} - ${range.end}`;
}

export function reservationOverlapsDate(reservation, key) {
  if (!reservation || !key) return false;
  if (reservation.type === "equipment") {
    return dateRangesOverlap(equipmentReservationRange(reservation.fields), { start: key, end: key });
  }
  return reservationDate(reservation) === key;
}

export function sharedReservations(type, key) {
  return (state.bootstrap?.reservations || [])
    .filter((item) => item.type === type)
    .filter((item) => reservationOverlapsDate(item, key));
}

export function isPastDate(key) {
  return Boolean(key && key < todayKey());
}

export function requiresPreviousDayReservation(type) {
  return type === "equipment" || type === "studio";
}

export function isReservationDateClosed(type, key) {
  if (!key) return false;
  return requiresPreviousDayReservation(type)
    ? key <= todayKey()
    : key < todayKey();
}

export function reservationClosedMessage(type) {
  if (requiresPreviousDayReservation(type)) {
    return `${typeLabel[type]} 예약은 사용일 전날 23:59까지만 가능합니다. 당일 예약은 시스템에서 접수할 수 없습니다.`;
  }
  return "오늘 이전 날짜는 예약할 수 없습니다. 기록 확인만 가능합니다.";
}

export function printDateOutsideUploadWindow(key) {
  if (!key) return false;
  const settings = state.bootstrap?.settings || {};
  return Boolean((settings.printUploadStartDate && key < settings.printUploadStartDate) ||
    (settings.printUploadEndDate && key > settings.printUploadEndDate));
}

export function printUploadWindowLabel() {
  const settings = state.bootstrap?.settings || {};
  if (!settings.printUploadStartDate && !settings.printUploadEndDate) return "상시 가능";
  return `${settings.printUploadStartDate || "제한 없음"} ~ ${settings.printUploadEndDate || "제한 없음"}`;
}

export function equipmentIsHighValue(item) {
  const categories = state.bootstrap?.settings?.equipmentHighValueCategories || ["Body", "Lens"];
  return categories.map((category) => String(category || "").trim().toLowerCase()).includes(String(item?.category || "").trim().toLowerCase());
}

export function equipmentIsCameraBag(item) {
  const keywords = state.bootstrap?.settings?.equipmentBagKeywords || ["펠리컨", "Pelican"];
  const haystack = [item?.name, item?.code, item?.category, item?.notes, item?.model, item?.brand]
    .map((value) => String(value || "").trim().toLowerCase())
    .join(" ");
  return keywords
    .map((keyword) => String(keyword || "").trim().toLowerCase())
    .filter(Boolean)
    .some((keyword) => haystack.includes(keyword));
}

export function timeToMinutes(value) {
  const match = String(value || "").match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function minutesToTime(minutes) {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

export function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

export function studioPairReservedOnDate(date, space, slot) {
  if (!date || !space || !slot) return false;
  return sharedReservations("studio", date).some((reservation) => {
    const spaces = (reservation.fields?.studioSpaces || [reservation.fields?.studioSpace]).filter(Boolean);
    return spaces.includes(space) && (reservation.fields?.timeSlots || []).includes(slot);
  });
}

export function studioSelectionConflicts(date, spaces = [], slots = []) {
  if (!date) return [];
  const conflicts = [];
  spaces.forEach((space) => {
    slots.forEach((slot) => {
      if (studioPairReservedOnDate(date, space, slot)) conflicts.push(`${space} / ${slot}`);
    });
  });
  return conflicts;
}

export function darkroomSlotUsage(date, slot) {
  if (!date || !slot) return 0;
  return sharedReservations("darkroom", date)
    .filter((reservation) => (reservation.fields?.timeSlots || []).includes(slot))
    .reduce((sum, reservation) => sum + Math.max(1, Number(reservation.fields?.participantCount || 1)), 0);
}

export function darkroomSlotRemaining(date, slot) {
  const capacity = Number(state.bootstrap?.settings?.darkroomCapacity || 6);
  return Math.max(0, capacity - darkroomSlotUsage(date, slot));
}

export function printCapacityBuckets() {
  const settings = state.bootstrap?.settings || {};
  const start = timeToMinutes(settings.printAvailableStart);
  const end = timeToMinutes(settings.printAvailableEnd);
  const windowMinutes = Number(settings.printCapacityWindowMinutes || 120);
  if (start === null || end === null || windowMinutes <= 0) return [];
  const buckets = [];
  for (let cursor = start; cursor < end; cursor += windowMinutes) {
    buckets.push({ start: cursor, end: Math.min(cursor + windowMinutes, end) });
  }
  return buckets;
}

export function printBucketUsage(date, bucket) {
  if (!date || !bucket) return 0;
  return sharedReservations("print", date).filter((reservation) => {
    const start = timeToMinutes(reservation.fields?.startTime);
    const end = timeToMinutes(reservation.fields?.endTime);
    return start !== null && end !== null && intervalsOverlap(start, end, bucket.start, bucket.end);
  }).length;
}

export function printSelectionConflicts(date, startTime, endTime) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (!date || start === null || end === null || end <= start) return [];
  const capacity = Number(state.bootstrap?.settings?.printCapacityPerWindow || 4);
  return printCapacityBuckets()
    .filter((bucket) => intervalsOverlap(start, end, bucket.start, bucket.end))
    .map((bucket) => ({ ...bucket, count: printBucketUsage(date, bucket) }))
    .filter((bucket) => bucket.count + 1 > capacity);
}

export function isMineReservation(reservation) {
  return Boolean(state.user?.id && reservation.userId === state.user.id);
}

export function calendarReservationMeta(reservation) {
  const f = reservation.fields || {};
  if (reservation.type === "equipment") {
    const items = (reservation.equipmentItems || []).map((item) => item.code || item.name).join(", ");
    const range = equipmentRangeLabel(f.reservedDate, f.period);
    return `${range} · ${f.rentalTime || "-"} 대여 · ${items || "기자재"}`;
  }
  if (reservation.type === "studio") {
    return `${(f.timeSlots || []).join(", ") || "-"} · ${(f.studioSpaces || [f.studioSpace]).filter(Boolean).join(", ") || "-"}`;
  }
  if (reservation.type === "darkroom") {
    return `${(f.timeSlots || []).join(", ") || "-"} · ${(f.processTypes || []).join(", ") || "작업"}`;
  }
  return `${f.startTime || "-"}-${f.endTime || "-"} · ${f.printType || "출력"}`;
}

export function calendarDayDetails(type, selected) {
  if (!selected) return "";
  const reservations = sharedReservations(type, selected);
  const blocked = reservationBlockedItemsForDate(type, selected);
  if (!reservations.length && !blocked.length) {
    return `<div class="calendar-reservations empty-calendar-note">선택한 날짜에 공유된 ${typeLabel[type]} 예약이 없습니다.</div>`;
  }
  return `
    <div class="calendar-reservations">
      ${reservations.map((reservation) => {
        const mine = isMineReservation(reservation);
        return `
          <div class="calendar-reservation-row ${mine ? "mine" : "other"}">
            <span>${mine ? "내 예약" : "타인 예약"}</span>
            <strong>${escapeHtml(reservation.userName || "예약자")}</strong>
            <em>${escapeHtml(calendarReservationMeta(reservation))}</em>
          </div>
        `;
      }).join("")}
      ${blocked.map((item) => `
        <div class="calendar-reservation-row blocked">
          <span>차단</span>
          <strong>${escapeHtml(item.target || item.label || "운영 차단")}</strong>
          <em>${escapeHtml(`${item.start || "-"}-${item.end || "-"}${item.from ? ` · ${item.from}~${item.to}` : ""}`)}</em>
        </div>
      `).join("")}
    </div>
  `;
}

export function blockedItemsForDate(items, key) {
  const day = new Date(`${key}T00:00:00`).getDay();
  return items.filter((item) => {
    if (weekdayIndex[item.day] !== day) return false;
    if (item.from && key < item.from) return false;
    if (item.to && key > item.to) return false;
    return true;
  });
}

export function reservationBlockedItemsForDate(type, key) {
  const schedules = blockedItemsForDate(state.bootstrap.settings.blockedSchedules || [], key)
    .filter((item) => item.type === type);
  if (type !== "darkroom") return schedules;
  const darkroomRules = blockedItemsForDate(state.bootstrap.settings.darkroomBlockedRules || [], key)
    .map((item, index) => ({ ...item, id: item.id || `darkroom_rule_${index}`, type: "darkroom", target: item.label || "암실 사용 불가" }));
  return [...schedules, ...darkroomRules];
}

export function timeRangeFromLabel(value) {
  const match = String(value || "").match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
  if (!match) return null;
  const start = timeToMinutes(match[1]);
  let end = timeToMinutes(match[2]);
  if (start === null || end === null) return null;
  if (end <= start) end += 1440;
  return { start, end };
}

export function scheduleOverlapsRange(item, range) {
  if (!range) return true;
  const start = timeToMinutes(item.start);
  let end = timeToMinutes(item.end);
  if (start === null || end === null) return true;
  if (end <= start) end += 1440;
  return intervalsOverlap(range.start, range.end, start, end);
}

export function studioTargetMatches(target, space) {
  const rawTarget = String(target || "").trim();
  if (!rawTarget) return true;
  const rawSpace = String(space || "").trim();
  if (!rawSpace) return true;
  const normalizedTarget = rawTarget.toLowerCase().replace(/[\s,_/()·-]+/g, "");
  const normalizedSpace = rawSpace.toLowerCase().replace(/[\s,_/()·-]+/g, "");
  if (normalizedTarget.includes(normalizedSpace) || normalizedSpace.includes(normalizedTarget)) return true;
  const wantsA = /studio\s*a|스튜디오\s*a|(^|[^a-z])a($|[^a-z])/i.test(rawTarget);
  const wantsB = /studio\s*b|스튜디오\s*b|(^|[^a-z])b($|[^a-z])/i.test(rawTarget);
  const isA = /studio\s*a|스튜디오\s*a/i.test(rawSpace);
  const isB = /studio\s*b|스튜디오\s*b/i.test(rawSpace);
  return (wantsA && isA) || (wantsB && isB);
}

export function blockingSchedulesForSlot(type, key, slot, target = "") {
  const range = timeRangeFromLabel(slot);
  return reservationBlockedItemsForDate(type, key)
    .filter((item) => scheduleOverlapsRange(item, range))
    .filter((item) => type !== "studio" || studioTargetMatches(item.target, target));
}

export function studioSlotBlocked(date, space, slot) {
  return Boolean(date && blockingSchedulesForSlot("studio", date, slot, space).length);
}

export function darkroomSlotBlocked(date, slot) {
  return Boolean(date && blockingSchedulesForSlot("darkroom", date, slot).length);
}

export function printSelectionBlocked(date, startTime, endTime) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (!date || start === null || end === null || end <= start) return [];
  return reservationBlockedItemsForDate("print", date)
    .filter((item) => scheduleOverlapsRange(item, { start, end }));
}

export function printBucketBlocked(date, bucket) {
  return Boolean(date && reservationBlockedItemsForDate("print", date).some((item) => scheduleOverlapsRange(item, bucket)));
}

export function equipmentRangeBlocked(date, period) {
  const range = equipmentReservationRange({ reservedDate: date, period });
  if (!range) return [];
  const blocked = [];
  let cursor = range.start;
  while (cursor <= range.end && blocked.length < 31) {
    blocked.push(...reservationBlockedItemsForDate("equipment", cursor));
    cursor = addDaysToDateKey(cursor, 1);
  }
  return blocked;
}

export function calendar(type) {
  const monthKey = state.calendarMonth || todayKey().slice(0, 7);
  state.calendarMonth = monthKey;

  const [year, month] = monthKey.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const selected = state.selectedDates[type] || "";
  const today = todayKey();
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    const key = dateKey(day);
    const reservations = sharedReservations(type, key);
    const ownCount = reservations.filter(isMineReservation).length;
    const otherCount = reservations.length - ownCount;
    const blocked = reservationBlockedItemsForDate(type, key);
    const past = key < today;
    const closed = isReservationDateClosed(type, key);
    return {
      key,
      day: day.getDate(),
      currentMonth: day.getMonth() === month - 1,
      selected: key === selected,
      today: key === today,
      past,
      closed,
      ownCount,
      otherCount,
      blocked
    };
  });

  return `
    <section class="calendar-card" data-calendar="${type}">
      <input type="hidden" name="reservedDate" value="${escapeHtml(selected)}" />
      <div class="calendar-head">
        <div>
          <p class="eyebrow">예약 일자</p>
          <h2>${monthTitle(monthKey)}</h2>
        </div>
        <div class="row-actions calendar-month-actions">
          <button class="button compact" type="button" data-calendar-month="${addMonths(monthKey, -1)}" aria-label="이전 달">‹</button>
          <button class="button compact" type="button" data-calendar-month="${today.slice(0, 7)}">오늘</button>
          <button class="button compact" type="button" data-calendar-month="${addMonths(monthKey, 1)}" aria-label="다음 달">›</button>
        </div>
      </div>
      <div class="calendar-weekdays">
        ${["일", "월", "화", "수", "목", "금", "토"].map((item) => `<span>${item}</span>`).join("")}
      </div>
      <div class="calendar-legend">
        <span><i class="legend-dot mine"></i>내 예약</span>
        <span><i class="legend-dot other"></i>타인 예약</span>
        <span><i class="legend-dot blocked"></i>차단</span>
      </div>
      <div class="calendar-grid-large">
        ${days.map((day) => `
          <button class="calendar-day ${day.currentMonth ? "" : "outside"} ${day.selected ? "selected" : ""} ${day.today ? "today" : ""} ${day.past ? "past" : ""} ${day.closed ? "closed" : ""} ${day.ownCount ? "has-own" : ""} ${day.otherCount ? "has-other" : ""} ${day.blocked.length ? "blocked" : ""}" type="button" data-calendar-day="${day.key}">
            <span>${day.day}</span>
            <div class="calendar-markers">
              ${day.ownCount ? `<small class="calendar-marker mine">내 ${day.ownCount}</small>` : ""}
              ${day.otherCount ? `<small class="calendar-marker other">타인 ${day.otherCount}</small>` : ""}
              ${day.closed && !day.past && !day.blocked.length ? `<small class="calendar-marker blocked">마감</small>` : ""}
              ${day.blocked.length ? `<small class="calendar-marker blocked">차단</small>` : ""}
            </div>
          </button>
        `).join("")}
      </div>
      <p class="selected-date">선택한 날짜: <strong data-calendar-selected>${selected || "날짜를 선택하세요"}</strong></p>
      <div data-calendar-details>${calendarDayDetails(type, selected)}</div>
    </section>
  `;
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const source = String(text || "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (quoted && char === "\"" && next === "\"") {
      cell += "\"";
      index += 1;
      continue;
    }
    if (char === "\"") {
      quoted = !quoted;
      continue;
    }
    if (!quoted && char === ",") {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows[0].map((item) => item.trim());
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
}

export function csvEscape(value) {
  const text = String(value ?? "");
  const protectedText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${protectedText.replaceAll('"', '""')}"`;
}
