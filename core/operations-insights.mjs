import { defaultSettings } from "./settings.mjs";

const KST_DATE_FORMATTER = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

const CANCELLED_STATUSES = new Set(["cancelled", "admin_cancelled", "rejected"]);
const OPERATIONAL_STATUSES = new Set(["pending_approval", "approved", "checked_out", "returned", "auto_confirmed", "completed"]);

function dateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return KST_DATE_FORMATTER.format(date);
}

function addDays(dateKeyValue, days) {
  const match = String(dateKeyValue || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const next = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return next.toISOString().slice(0, 10);
}

function reservationDateKey(reservation) {
  const reservedDate = String(reservation?.fields?.reservedDate || "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(reservedDate)) return reservedDate;
  return dateKey(reservation?.timing?.startAt || reservation?.createdAt);
}

function requestDateKey(reservation) {
  return dateKey(reservation?.createdAt)
    || dateKey(reservation?.submittedAt)
    || reservationDateKey(reservation);
}

function isReservableEquipment(item) {
  return item?.active !== false
    && item?.reservable !== false
    && item?.inquiryOnly !== true
    && (!item?.status || item.status === "가능");
}

function percentage(part, total) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function reservationEquipmentIds(reservation) {
  const detailedIds = Array.isArray(reservation?.equipmentItems)
    ? reservation.equipmentItems.map((item) => String(item?.id || "")).filter(Boolean)
    : [];
  if (detailedIds.length) return detailedIds;
  return Array.isArray(reservation?.fields?.equipmentItemIds)
    ? reservation.fields.equipmentItemIds.map((item) => String(item || "")).filter(Boolean)
    : [];
}

function historicalEquipmentIndex(reservations, equipment) {
  const indexed = new Map();
  for (const reservation of reservations) {
    if (reservation?.type !== "equipment") continue;
    const details = new Map((Array.isArray(reservation.equipmentItems) ? reservation.equipmentItems : [])
      .map((item) => [String(item?.id || ""), item])
      .filter(([id]) => id));
    for (const id of reservationEquipmentIds(reservation)) {
      const item = details.get(id) || {};
      const previous = indexed.get(id) || {};
      indexed.set(id, {
        id,
        code: String(item.code || previous.code || ""),
        name: String(item.name || previous.name || "기록상 장비"),
        category: String(item.category || previous.category || "기타")
      });
    }
  }
  for (const item of Array.isArray(equipment) ? equipment : []) {
    const id = String(item?.id || "");
    if (!id || !indexed.has(id)) continue;
    const previous = indexed.get(id);
    indexed.set(id, {
      id,
      code: String(item.code || previous.code || ""),
      name: String(item.name || previous.name || "기록상 장비"),
      category: String(item.category || previous.category || "기타")
    });
  }
  return indexed;
}

function slotLabels(reservation) {
  const fields = reservation?.fields || {};
  if (reservation?.type === "equipment") return fields.rentalTime ? [String(fields.rentalTime)] : [];
  if (reservation?.type === "print") return fields.startTime ? [String(fields.startTime)] : [];
  if (reservation?.type === "studio" || reservation?.type === "darkroom") {
    return Array.isArray(fields.timeSlots) ? fields.timeSlots.map((item) => String(item || "")).filter(Boolean) : [];
  }
  return [];
}

function reservationTypeLabel(type) {
  return { equipment: "기자재", studio: "스튜디오", darkroom: "암실", print: "출력실" }[type] || "예약";
}

function buildCongestion(reservations) {
  const counts = new Map();
  for (const reservation of reservations) {
    for (const time of new Set(slotLabels(reservation))) {
      const key = `${reservation.type}:${time}`;
      counts.set(key, { type: reservation.type, time, count: Number(counts.get(key)?.count || 0) + 1 });
    }
  }
  const items = [...counts.values()]
    .filter((item) => item.count >= 3)
    .sort((left, right) => right.count - left.count || left.time.localeCompare(right.time, "ko"))
    .slice(0, 3)
    .map((item) => ({
      ...item,
      label: `${reservationTypeLabel(item.type)} ${item.time}`
    }));
  return {
    items,
    insufficientData: items.length === 0
  };
}

function buildEquipmentUtilization(reservations, equipment, days, from, to) {
  const indexedEquipment = historicalEquipmentIndex(reservations, equipment);
  const historicalEquipment = [...indexedEquipment.values()];
  const daysByEquipment = new Map(historicalEquipment.map((item) => [item.id, new Set()]));
  for (const reservation of reservations) {
    if (reservation.type !== "equipment") continue;
    const start = reservationDateKey(reservation);
    const end = dateKey(reservation?.timing?.endAt) || start;
    if (!start || end < start) continue;
    // Count each calendar day touched by the booking once, clipped to the reporting period.
    const endDay = end > to ? to : end;
    for (let key = start < from ? from : start; key <= endDay; key = addDays(key, 1)) {
      for (const equipmentId of reservationEquipmentIds(reservation)) daysByEquipment.get(equipmentId)?.add(key);
    }
  }
  return historicalEquipment
    .map((item) => {
      const reservedDays = daysByEquipment.get(item.id)?.size || 0;
      return { equipmentId: item.id, code: item.code, name: item.name, category: item.category, reservedDays, utilizationPercent: percentage(reservedDays, days) };
    })
    .filter((item) => item.reservedDays > 0)
    .sort((left, right) => right.utilizationPercent - left.utilizationPercent || right.reservedDays - left.reservedDays || left.name.localeCompare(right.name, "ko"));
}

function buildDemandWarnings(reservations, equipmentById, from, to) {
  const recentFrom = addDays(to, -6);
  const previousFrom = addDays(recentFrom, -21);
  const recent = new Map();
  const previous = new Map();
  for (const reservation of reservations) {
    const key = reservationDateKey(reservation);
    if (!key || key < previousFrom || key > to) continue;
    for (const equipmentId of reservationEquipmentIds(reservation)) {
      const item = equipmentById.get(equipmentId);
      if (!item) continue;
      const target = key >= recentFrom ? recent : previous;
      target.set(item.category, Number(target.get(item.category) || 0) + 1);
    }
  }
  return [...recent.entries()]
    .flatMap(([category, recentRequests]) => {
      const weeklyAverage = Number(previous.get(category) || 0) / 3;
      if (recentRequests < 3 || recentRequests < weeklyAverage * 1.3) return [];
      return [{ kind: "demand_increase", category, recentRequests, baselineRequests: Math.round(weeklyAverage * 10) / 10 }];
    });
}

function buildShortageWarnings(utilization, equipment) {
  const availableByCategory = new Map();
  const availableEquipmentIds = new Set();
  for (const item of equipment) {
    if (!isReservableEquipment(item)) continue;
    availableEquipmentIds.add(String(item.id || ""));
    const category = String(item.category || "");
    availableByCategory.set(category, Number(availableByCategory.get(category) || 0) + 1);
  }
  return utilization.flatMap((item) => {
    if (!availableEquipmentIds.has(item.equipmentId) || item.utilizationPercent < 80 || Number(availableByCategory.get(item.category) || 0) > 1) return [];
    return [{ kind: "shortage", equipmentId: item.equipmentId, code: item.code, name: item.name, category: item.category, utilizationPercent: item.utilizationPercent }];
  });
}

function buildOverdueWarnings(reservations, now) {
  const nowTime = now.getTime();
  return reservations.flatMap((reservation) => {
    if (reservation?.type !== "equipment" || reservation?.status !== "checked_out") return [];
    const endAt = new Date(reservation?.timing?.endAt || "");
    if (Number.isNaN(endAt.getTime()) || endAt.getTime() >= nowTime) return [];
    const firstItem = Array.isArray(reservation.equipmentItems) ? reservation.equipmentItems[0] : null;
    return [{
      kind: "overdue_return",
      reservationId: String(reservation.id || ""),
      equipmentId: String(firstItem?.id || reservationEquipmentIds(reservation)[0] || ""),
      equipmentName: String(firstItem?.name || firstItem?.code || "기자재"),
      dueAt: endAt.toISOString()
    }];
  });
}

export function buildOperationsInsights({ reservations = [], equipment = [], settings = defaultSettings, now = new Date(), days = 28 } = {}) {
  const safeDays = Math.max(1, Math.floor(Number(days) || 28));
  const to = dateKey(now);
  const from = addDays(to, -(safeDays - 1));
  const allReservations = Array.isArray(reservations) ? reservations : [];
  const scoped = allReservations.filter((reservation) => {
    const key = reservationDateKey(reservation);
    return key >= from && key <= to;
  });
  const requestScoped = allReservations.filter((reservation) => {
    const key = requestDateKey(reservation);
    return key >= from && key <= to;
  });
  const operational = scoped.filter((reservation) => OPERATIONAL_STATUSES.has(reservation?.status));
  const cancelled = requestScoped.filter((reservation) => CANCELLED_STATUSES.has(reservation?.status));
  const allUtilization = buildEquipmentUtilization(allReservations.filter((reservation) => OPERATIONAL_STATUSES.has(reservation?.status)), equipment, safeDays, from, to);
  const equipmentById = new Map((Array.isArray(equipment) ? equipment : []).map((item) => [String(item?.id || ""), item]));
  const warnings = [
    ...buildOverdueWarnings(allReservations, now),
    ...buildShortageWarnings(allUtilization, equipment),
    ...buildDemandWarnings(operational, equipmentById, from, to)
  ].slice(0, 3);

  return {
    period: { from, to, days: safeDays },
    congestion: buildCongestion(operational),
    equipmentUtilization: allUtilization.slice(0, 5),
    cancellationRate: {
      totalRequests: requestScoped.length,
      cancelledRequests: cancelled.length,
      percent: percentage(cancelled.length, requestScoped.length)
    },
    warnings
  };
}
