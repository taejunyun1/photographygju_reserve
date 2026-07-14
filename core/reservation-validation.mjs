const WEEKDAY_INDEX = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };

export function createReservationValidationHelpers({
  addDaysToDateKey,
  assertDateKey,
  assertOptionalDateKey,
  assertRequired,
  defaultSettings,
  equipmentReservationRange,
  equipmentReservableForStatus,
  isCameraBagEquipment,
  isHighValueEquipment,
  isValidDateKey,
  printDateOutsideUploadWindow,
  reservationTitle,
  studioSpaces
}) {
  function dateRangesOverlap(a, b) {
    if (!a || !b) return false;
    return a.start <= b.end && b.start <= a.end;
  }

  function isBlockingReservation(reservation) {
    return !["cancelled", "admin_cancelled", "rejected", "returned", "completed"].includes(reservation.status);
  }

  function todayKeySeoul() {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date()).reduce((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function requiresPreviousDayReservation(type) {
    return type === "equipment" || type === "studio";
  }

  function reservationDateClosed(type, reservedDate) {
    if (!reservedDate) return false;
    const today = todayKeySeoul();
    return requiresPreviousDayReservation(type) ? reservedDate <= today : reservedDate < today;
  }

  function reservationDateClosedMessage(type) {
    if (requiresPreviousDayReservation(type)) return `${reservationTitle(type)} 예약은 사용일 전날 23:59까지만 가능합니다. 당일 예약은 시스템에서 접수할 수 없습니다.`;
    return "오늘 이전 날짜는 예약할 수 없습니다. 기록 확인만 가능합니다.";
  }

  function slotSet(value) {
    return new Set(Array.isArray(value) ? value : []);
  }

  function hasOverlap(a, b) {
    const bSet = slotSet(b);
    return [...slotSet(a)].some((slot) => bSet.has(slot));
  }

  function areSlotsConsecutive(selectedSlots, orderedSlots) {
    const unique = [...new Set(Array.isArray(selectedSlots) ? selectedSlots : [])];
    if (unique.length !== (selectedSlots || []).length) return false;
    const indices = unique.map((slot) => orderedSlots.indexOf(slot)).sort((a, b) => a - b);
    if (!indices.length || indices.some((index) => index < 0)) return false;
    return indices.every((index, position) => position === 0 || index === indices[position - 1] + 1);
  }

  function timeToMinutes(value, { allowEndOfDay = true } = {}) {
    const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (minute > 59 || hour > 24 || (hour === 24 && (!allowEndOfDay || minute !== 0))) return null;
    return hour * 60 + minute;
  }

  function minutesToTime(minutes) {
    const normalized = ((minutes % 1440) + 1440) % 1440;
    return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
  }

  function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && bStart < aEnd;
  }

  function dateKeysInRange(range) {
    if (!range) return [];
    const keys = [];
    let cursor = range.start;
    while (cursor && cursor <= range.end && keys.length < 31) {
      keys.push(cursor);
      cursor = addDaysToDateKey(cursor, 1);
    }
    return keys;
  }

  function dayIndexForDateKey(key) {
    return new Date(`${key}T00:00:00`).getDay();
  }

  function equipmentReservationStartUnavailable(key) {
    const day = dayIndexForDateKey(key);
    return day === 0 || day === 6;
  }

  function ruleAppliesToDate(rule, key) {
    if (!isValidDateKey(key)) return false;
    if (!rule || !key || WEEKDAY_INDEX[rule.day] !== dayIndexForDateKey(key)) return false;
    if (rule.from && key < rule.from) return false;
    if (rule.to && key > rule.to) return false;
    return true;
  }

  function timeRangeFromLabel(value) {
    const match = String(value || "").match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    if (!match) return null;
    const start = timeToMinutes(match[1]);
    let end = timeToMinutes(match[2]);
    if (start === null || end === null) return null;
    if (end <= start) end += 1440;
    return { start, end };
  }

  function studioScheduleSegments(dateKey, selectedSlots, slot) {
    const range = timeRangeFromLabel(slot);
    if (!range) return [];
    const selectedRanges = (selectedSlots || []).map(timeRangeFromLabel).filter(Boolean);
    const continuesAfterMidnight = selectedRanges.some((item) => item.end === 1440)
      && selectedRanges.some((item) => item.start === 0);
    if (range.end > 1440) {
      return [
        { key: dateKey, range: { start: range.start, end: 1440 } },
        { key: addDaysToDateKey(dateKey, 1), range: { start: 0, end: range.end - 1440 } }
      ];
    }
    return [{
      key: continuesAfterMidnight && range.start === 0 ? addDaysToDateKey(dateKey, 1) : dateKey,
      range
    }];
  }

  function ruleTimeRange(rule) {
    const start = timeToMinutes(rule?.start);
    let end = timeToMinutes(rule?.end);
    if (start === null || end === null) return null;
    if (end <= start) end += 1440;
    return { start, end };
  }

  function scheduleOverlapsRange(rule, range) {
    if (!range) return true;
    const blocked = ruleTimeRange(rule);
    if (!blocked) return true;
    return intervalsOverlap(range.start, range.end, blocked.start, blocked.end);
  }

  function studioTargetMatches(target, space) {
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

  function blockingSchedulesFor(db, type, key, range = null, target = "") {
    return (db.settings.blockedSchedules || [])
      .filter((rule) => rule.type === type)
      .filter((rule) => ruleAppliesToDate(rule, key))
      .filter((rule) => scheduleOverlapsRange(rule, range))
      .filter((rule) => type !== "studio" || studioTargetMatches(rule.target, target));
  }

  function darkroomBlockedRulesFor(db, key, slot) {
    const range = timeRangeFromLabel(slot);
    return (db.settings.darkroomBlockedRules || [])
      .filter((rule) => ruleAppliesToDate(rule, key))
      .filter((rule) => scheduleOverlapsRange(rule, range));
  }

  function blockLabel(rule) {
    return `${rule.label || rule.day || "차단"} ${rule.start || ""}-${rule.end || ""}`.trim();
  }

  function printCapacityBuckets(settings) {
    const start = timeToMinutes(settings.printAvailableStart);
    const end = timeToMinutes(settings.printAvailableEnd);
    const windowMinutes = Number(settings.printCapacityWindowMinutes || 120);
    if (start === null || end === null || windowMinutes <= 0) return [];
    const buckets = [];
    for (let cursor = start; cursor < end; cursor += windowMinutes) buckets.push({ start: cursor, end: Math.min(cursor + windowMinutes, end) });
    return buckets;
  }

  function validateReservation(db, type, fields, editingId = null) {
    if (!["equipment", "studio", "darkroom", "print"].includes(type)) throw Object.assign(new Error("지원하지 않는 예약 종류입니다."), { status: 400 });
    assertOptionalDateKey(fields.reservedDate, "예약일");
    if (reservationDateClosed(type, fields.reservedDate)) throw Object.assign(new Error(reservationDateClosedMessage(type)), { status: 400 });

    if (type === "equipment") {
      assertRequired(fields, ["reservedDate", "period", "rentalTime", "returnTime", "phone"]);
      if (equipmentReservationStartUnavailable(fields.reservedDate)) throw Object.assign(new Error("토요일/일요일은 기자재 예약을 시작할 수 없습니다. 금요일 2박3일 옵션을 이용하세요."), { status: 400 });
      if ((String(fields.period).includes("2박3일") || String(fields.period).includes("주말")) && dayIndexForDateKey(fields.reservedDate) !== 5) throw Object.assign(new Error("2박3일(주말) 대여는 금요일에만 가능합니다."), { status: 400 });
      const rentalMinutes = timeToMinutes(fields.rentalTime, { allowEndOfDay: false });
      const returnMinutes = timeToMinutes(fields.returnTime, { allowEndOfDay: false });
      const rentalOptions = Array.isArray(db.settings.equipmentRentalTimes) ? db.settings.equipmentRentalTimes : [];
      const returnOptions = Array.isArray(db.settings.equipmentReturnTimes) ? db.settings.equipmentReturnTimes : [];
      if (
        rentalMinutes === null || returnMinutes === null
        || (rentalOptions.length && !rentalOptions.includes(fields.rentalTime))
        || (returnOptions.length && !returnOptions.includes(fields.returnTime))
      ) {
        throw Object.assign(new Error("기자재 대여/반납 시간을 올바르게 선택하세요."), { status: 400 });
      }
      const requestedRange = equipmentReservationRange(fields);
      if (requestedRange?.start === requestedRange?.end && rentalMinutes !== null && returnMinutes !== null && returnMinutes <= rentalMinutes) {
        throw Object.assign(new Error("당일 대여는 반납 시간이 대여 시작 시간보다 늦어야 합니다."), { status: 400 });
      }
      if (!Array.isArray(fields.equipmentItemIds) || fields.equipmentItemIds.length === 0) throw Object.assign(new Error("기자재를 1개 이상 선택해야 합니다."), { status: 400 });
      const blockedDate = dateKeysInRange(requestedRange).find((key) => blockingSchedulesFor(db, "equipment", key).length);
      if (blockedDate) throw Object.assign(new Error(`${blockedDate}은 기자재 예약 차단 일정이 있어 예약할 수 없습니다.`), { status: 409 });
      const selectedEquipmentItems = [];
      for (const itemId of fields.equipmentItemIds) {
        const item = db.equipment.find((eq) => eq.id === itemId);
        if (!item || !item.active || !item.reservable || !equipmentReservableForStatus(item.status)) throw Object.assign(new Error("예약할 수 없는 기자재가 포함되어 있습니다."), { status: 400 });
        selectedEquipmentItems.push(item);
        const conflict = db.reservations.find((reservation) => {
          if (reservation.id === editingId || reservation.type !== "equipment") return false;
          if (!isBlockingReservation(reservation)) return false;
          if (!Array.isArray(reservation.fields.equipmentItemIds) || !reservation.fields.equipmentItemIds.includes(itemId)) return false;
          return dateRangesOverlap(equipmentReservationRange(reservation.fields), requestedRange);
        });
        if (conflict) throw Object.assign(new Error(`${item.code} 기자재가 해당 기간에 이미 예약되어 있습니다.`), { status: 409 });
      }
      const hasHighValueEquipment = selectedEquipmentItems.some((item) => isHighValueEquipment(item, db.settings));
      const hasCameraBagEquipment = selectedEquipmentItems.some((item) => isCameraBagEquipment(item, db.settings));
      if (hasHighValueEquipment && !hasCameraBagEquipment && fields.cameraBagConfirmed !== true && fields.cameraBagConfirmed !== "true") throw Object.assign(new Error(db.settings.equipmentCameraBagNotice || defaultSettings.equipmentCameraBagNotice), { status: 400 });
      fields.cameraBagConfirmationRequired = hasHighValueEquipment;
      fields.pelicanBagReserved = hasHighValueEquipment && hasCameraBagEquipment;
      fields.cameraBagConfirmed = hasHighValueEquipment ? (hasCameraBagEquipment || fields.cameraBagConfirmed === true || fields.cameraBagConfirmed === "true") : false;
    }

    if (type === "studio") {
      assertRequired(fields, ["reservedDate", "phone"]);
      if (!Array.isArray(fields.timeSlots) || fields.timeSlots.length === 0) throw Object.assign(new Error("사용 시간을 선택해야 합니다."), { status: 400 });
      if (studioSpaces(fields).length === 0) throw Object.assign(new Error("사용 장소를 1개 이상 선택해야 합니다."), { status: 400 });
      if (fields.timeSlots.length > db.settings.studioMaxSlots) throw Object.assign(new Error(`스튜디오는 최대 ${db.settings.studioMaxSlots}타임까지 예약할 수 있습니다.`), { status: 400 });
      if (!areSlotsConsecutive(fields.timeSlots, db.settings.studioSlots)) throw Object.assign(new Error("스튜디오는 연속된 시간만 예약할 수 있습니다."), { status: 400 });
      const selectedSpaces = studioSpaces(fields);
      for (const space of selectedSpaces) {
        for (const slot of fields.timeSlots) {
          const blocked = studioScheduleSegments(fields.reservedDate, fields.timeSlots, slot)
            .flatMap((segment) => blockingSchedulesFor(db, "studio", segment.key, segment.range, space));
          if (blocked.length) throw Object.assign(new Error(`${space} ${slot}은 차단 일정(${blockLabel(blocked[0])})이 있어 예약할 수 없습니다.`), { status: 409 });
        }
      }
      const conflict = db.reservations.find((reservation) => {
        if (reservation.id === editingId || reservation.type !== "studio") return false;
        if (!isBlockingReservation(reservation)) return false;
        return reservation.fields.reservedDate === fields.reservedDate && hasOverlap(studioSpaces(reservation.fields), selectedSpaces) && hasOverlap(reservation.fields.timeSlots, fields.timeSlots);
      });
      if (conflict) throw Object.assign(new Error("선택한 스튜디오와 시간에 이미 예약이 있습니다."), { status: 409 });
    }

    if (type === "darkroom") {
      assertRequired(fields, ["reservedDate", "phone"]);
      if (!Array.isArray(fields.timeSlots) || fields.timeSlots.length === 0) throw Object.assign(new Error("암실 사용 시간을 선택해야 합니다."), { status: 400 });
      const selectedRanges = fields.timeSlots.map(timeRangeFromLabel);
      if (selectedRanges.some((range) => !range)) throw Object.assign(new Error("암실 사용 시간을 올바르게 선택하세요."), { status: 400 });
      if (
        selectedRanges.some((range) => range.end > 24 * 60)
        || (selectedRanges.some((range) => range.start === 0) && selectedRanges.some((range) => range.end === 24 * 60))
      ) {
        throw Object.assign(new Error("암실 예약은 자정을 넘어 선택할 수 없습니다. 날짜별로 나누어 예약해 주세요."), { status: 400 });
      }
      const participantCount = Math.max(1, Number(fields.participantCount || 1));
      for (const slot of fields.timeSlots) {
        const blocked = [...darkroomBlockedRulesFor(db, fields.reservedDate, slot), ...blockingSchedulesFor(db, "darkroom", fields.reservedDate, timeRangeFromLabel(slot))];
        if (blocked.length) throw Object.assign(new Error(`${slot}은 암실 차단 일정(${blockLabel(blocked[0])})이 있어 예약할 수 없습니다.`), { status: 409 });
        const reservedCount = db.reservations
          .filter((reservation) => reservation.id !== editingId)
          .filter((reservation) => reservation.type === "darkroom")
          .filter(isBlockingReservation)
          .filter((reservation) => reservation.fields.reservedDate === fields.reservedDate)
          .filter((reservation) => Array.isArray(reservation.fields.timeSlots) && reservation.fields.timeSlots.includes(slot))
          .reduce((sum, reservation) => sum + Math.max(1, Number(reservation.fields.participantCount || 1)), 0);
        if (reservedCount + participantCount > db.settings.darkroomCapacity) throw Object.assign(new Error(`${slot} 암실 정원 ${db.settings.darkroomCapacity}명을 초과합니다.`), { status: 409 });
      }
    }

    if (type === "print") {
      if (!String(db.settings.googleDriveUrl || "").trim()) {
        throw Object.assign(new Error("출력 파일 업로드용 구글 드라이브 링크가 등록되지 않았습니다."), { status: 409 });
      }
      assertRequired(fields, ["reservedDate", "startTime", "endTime", "phone", "printType", "paper", "size"]);
      if (printDateOutsideUploadWindow(db.settings, fields.reservedDate)) throw Object.assign(new Error(`출력 업로드 가능 기간(${db.settings.printUploadStartDate || "제한 없음"} ~ ${db.settings.printUploadEndDate || "제한 없음"}) 밖의 날짜입니다.`), { status: 400 });
      const start = timeToMinutes(fields.startTime);
      const end = timeToMinutes(fields.endTime);
      const availableStart = timeToMinutes(db.settings.printAvailableStart);
      const availableEnd = timeToMinutes(db.settings.printAvailableEnd);
      if (start === null || end === null || end <= start) throw Object.assign(new Error("출력실 시작/종료 시간을 올바르게 선택하세요."), { status: 400 });
      if (start < availableStart || end > availableEnd) throw Object.assign(new Error(`출력실 사용 가능 시간은 ${db.settings.printAvailableStart}-${db.settings.printAvailableEnd}입니다.`), { status: 400 });
      const blocked = blockingSchedulesFor(db, "print", fields.reservedDate, { start, end });
      if (blocked.length) throw Object.assign(new Error(`${fields.startTime}-${fields.endTime}은 출력실 차단 일정(${blockLabel(blocked[0])})이 있어 예약할 수 없습니다.`), { status: 409 });
      const capacity = Number(db.settings.printCapacityPerWindow || 4);
      const overloaded = printCapacityBuckets(db.settings)
        .filter((bucket) => intervalsOverlap(start, end, bucket.start, bucket.end))
        .map((bucket) => {
          const count = db.reservations
            .filter((reservation) => reservation.id !== editingId)
            .filter((reservation) => reservation.type === "print")
            .filter(isBlockingReservation)
            .filter((reservation) => reservation.fields.reservedDate === fields.reservedDate)
            .filter((reservation) => {
              const reservationStart = timeToMinutes(reservation.fields.startTime);
              const reservationEnd = timeToMinutes(reservation.fields.endTime);
              return reservationStart !== null && reservationEnd !== null && intervalsOverlap(reservationStart, reservationEnd, bucket.start, bucket.end);
            }).length;
          return { ...bucket, count };
        })
        .filter((bucket) => bucket.count + 1 > capacity);
      if (overloaded.length) {
        const labels = overloaded.map((bucket) => `${minutesToTime(bucket.start)}-${minutesToTime(bucket.end)}`).join(", ");
        throw Object.assign(new Error(`출력실 ${labels} 시간대는 2시간 기준 최대 ${capacity}명까지 예약 가능합니다.`), { status: 409 });
      }
    }
  }

  return { reservationDateClosed, reservationDateClosedMessage, todayKeySeoul, validateReservation };
}
