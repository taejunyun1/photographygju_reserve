const RESERVATION_TYPES = new Set(["equipment", "studio", "darkroom", "print"]);

function values(value) {
  return Array.isArray(value) ? value.map((item) => String(item || "")).filter(Boolean) : [];
}

function copyFields(fields = {}) {
  const next = { ...fields };
  for (const key of ["equipmentItemIds", "studioSpaces", "timeSlots", "processTypes", "printTypes", "papers", "sizes"]) {
    if (Array.isArray(fields[key])) next[key] = [...fields[key]];
  }
  return next;
}

function addDaysToDateKey(value, days) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return "";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function timeMinutes(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 24 && minute <= 59 ? hour * 60 + minute : null;
}

function timeLabel(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function equalValues(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function publicPatch(type, source, candidate) {
  const patch = { type };
  if (source.reservedDate !== candidate.reservedDate) patch.selectedDate = String(candidate.reservedDate || "");
  if (type === "equipment") {
    if (source.period !== candidate.period) patch.equipmentPeriod = String(candidate.period || "");
    if (source.rentalTime !== candidate.rentalTime) patch.equipmentRentalTime = String(candidate.rentalTime || "");
    if (source.returnTime !== candidate.returnTime) patch.equipmentReturnTime = String(candidate.returnTime || "");
    if (!equalValues(values(source.equipmentItemIds), values(candidate.equipmentItemIds))) patch.equipmentItemIds = values(candidate.equipmentItemIds);
  } else if (type === "studio") {
    const sourceSpace = String(source.studioSpace || values(source.studioSpaces)[0] || "");
    const candidateSpace = String(candidate.studioSpace || values(candidate.studioSpaces)[0] || "");
    if (sourceSpace !== candidateSpace) patch.studioSpace = candidateSpace;
    if (!equalValues(values(source.timeSlots), values(candidate.timeSlots))) patch.studioSlots = values(candidate.timeSlots);
  } else if (type === "darkroom") {
    if (!equalValues(values(source.timeSlots), values(candidate.timeSlots))) patch.darkroomSlots = values(candidate.timeSlots);
    if (!equalValues(values(source.processTypes), values(candidate.processTypes))) patch.darkroomProcessTypes = values(candidate.processTypes);
    if (String(source.participantCount || "") !== String(candidate.participantCount || "")) patch.darkroomParticipantCount = String(candidate.participantCount || "");
  } else if (type === "print") {
    if (source.startTime !== candidate.startTime) patch.printStartTime = String(candidate.startTime || "");
    if (source.endTime !== candidate.endTime) patch.printEndTime = String(candidate.endTime || "");
    if (!equalValues(values(source.printTypes), values(candidate.printTypes))) patch.printTypes = values(candidate.printTypes);
    if (!equalValues(values(source.papers), values(candidate.papers))) patch.printPapers = values(candidate.papers);
    if (!equalValues(values(source.sizes), values(candidate.sizes))) patch.printSizes = values(candidate.sizes);
  }
  return patch;
}

function configuredSlotAlternatives(slots, currentSlots) {
  const selectedLength = Math.max(1, values(currentSlots).length);
  const current = values(currentSlots);
  const options = Array.isArray(slots) ? slots.map((slot) => String(slot || "")).filter(Boolean) : [];
  const alternatives = [];
  for (let index = 0; index + selectedLength <= options.length; index += 1) {
    const candidate = options.slice(index, index + selectedLength);
    if (!equalValues(candidate, current)) alternatives.push(candidate);
  }
  return alternatives;
}

function printTimeAlternatives(settings, fields) {
  const start = timeMinutes(settings?.printAvailableStart);
  const end = timeMinutes(settings?.printAvailableEnd);
  const requestedStart = timeMinutes(fields?.startTime);
  const requestedEnd = timeMinutes(fields?.endTime);
  const unit = Math.max(1, Number(settings?.printTimeUnitMinutes || 60));
  const duration = requestedStart !== null && requestedEnd !== null && requestedEnd > requestedStart ? requestedEnd - requestedStart : unit;
  if (start === null || end === null || duration <= 0) return [];
  const alternatives = [];
  for (let cursor = start; cursor + duration <= end; cursor += unit) {
    const candidate = { startTime: timeLabel(cursor), endTime: timeLabel(cursor + duration) };
    if (candidate.startTime !== fields.startTime || candidate.endTime !== fields.endTime) alternatives.push(candidate);
  }
  return alternatives;
}

function itemLabel(item) {
  return String(item?.name || item?.code || "대체 장비").trim() || "대체 장비";
}

export function findReservationRecommendations({ db = {}, type, fields = {}, validateCandidate, now = new Date() } = {}) {
  if (!RESERVATION_TYPES.has(type) || typeof validateCandidate !== "function") return [];
  const source = copyFields(fields);
  const alternatives = [];
  const seenPatches = new Set();

  function add(kind, label, candidate) {
    if (alternatives.length >= 3) return false;
    const next = copyFields(candidate);
    try {
      validateCandidate(next);
    } catch {
      return false;
    }
    const patch = publicPatch(type, source, next);
    if (Object.keys(patch).length === 1) return false;
    const key = JSON.stringify(patch);
    if (seenPatches.has(key)) return false;
    seenPatches.add(key);
    alternatives.push({ kind, label, patch });
    return true;
  }

  for (let days = 1; days <= 7 && alternatives.length < 1; days += 1) {
    const reservedDate = addDaysToDateKey(source.reservedDate, days);
    if (!reservedDate) break;
    add(type === "equipment" ? "same_equipment_time" : "alternate_time", `다른 날짜 · ${reservedDate}`, { ...source, reservedDate });
  }

  if (type === "equipment") {
    const selectedIds = values(source.equipmentItemIds);
    const equipmentById = new Map((Array.isArray(db.equipment) ? db.equipment : []).map((item) => [String(item?.id || ""), item]));
    for (let index = 0; index < selectedIds.length && alternatives.length < 2; index += 1) {
      const selected = equipmentById.get(selectedIds[index]);
      if (!selected?.category) continue;
      const candidates = (Array.isArray(db.equipment) ? db.equipment : [])
        .filter((item) => item?.active !== false && item?.reservable !== false && item?.category === selected.category && item?.id !== selected.id && !selectedIds.includes(item?.id))
        .slice()
        .sort((left, right) => String(left.code || left.name || left.id).localeCompare(String(right.code || right.name || right.id), "ko"));
      for (const item of candidates) {
        const equipmentItemIds = [...selectedIds];
        equipmentItemIds[index] = item.id;
        if (add("alternate_equipment", `대체 장비 · ${itemLabel(item)}`, { ...source, equipmentItemIds })) break;
      }
    }
    for (const rentalTime of Array.isArray(db.settings?.equipmentRentalTimes) ? db.settings.equipmentRentalTimes : []) {
      for (const returnTime of Array.isArray(db.settings?.equipmentReturnTimes) ? db.settings.equipmentReturnTimes : []) {
        if (alternatives.length >= 3) break;
        add("alternate_time", `다른 시간 · ${rentalTime}–${returnTime}`, { ...source, rentalTime, returnTime });
      }
      if (alternatives.length >= 3) break;
    }
  } else if (type === "studio" || type === "darkroom") {
    const slots = type === "studio" ? db.settings?.studioSlots : db.settings?.darkroomSlots;
    for (const timeSlots of configuredSlotAlternatives(slots, source.timeSlots)) {
      if (alternatives.length >= 3) break;
      add("alternate_time", `다른 시간 · ${timeSlots.join(", ")}`, { ...source, timeSlots });
    }
  } else if (type === "print") {
    for (const time of printTimeAlternatives(db.settings, source)) {
      if (alternatives.length >= 3) break;
      add("alternate_time", `다른 시간 · ${time.startTime}–${time.endTime}`, { ...source, ...time });
    }
  }

  return alternatives.slice(0, 3);
}
