import {
  allocateEquipmentCodes,
  inferEquipmentIdentity
} from "./equipment-code.mjs";

export const EQUIPMENT_STATUSES = new Set(["가능", "수리중", "파손", "available", "rented", "maintenance", "repair", "lost", "사용 가능", "대여 중", "점검 중", "수리 중", "분실", "damaged", "broken"]);
export const FANTASY_LAB_INQUIRY_NOTE = "온라인 예약불가. 판타지랩 조교에게 직접 문의";

export function createEquipmentHelpers({ seedEquipmentGroups, defaultSettings, id, nowIso, addDaysToDateKey }) {
  function codeBase(category, name, fallbackIndex) {
    const identity = inferEquipmentIdentity({ category, name });
    const productKey = identity.productKey || `UNKNOWN${String(fallbackIndex).padStart(3, "0")}`;
    return `${identity.categoryCode}-${identity.brandCode}-${productKey}`;
  }

  function normalizeEquipmentStatus(status) {
    const value = String(status || "").trim().toLowerCase().replace(/\s+/g, "");
    if (!value || ["available", "사용가능", "가능"].includes(value)) return "가능";
    if (["repair", "maintenance", "rented", "수리중", "점검중", "대여중"].includes(value)) return "수리중";
    if (["lost", "damaged", "broken", "분실", "파손"].includes(value)) return "파손";
    return "가능";
  }

  function equipmentReservableForStatus(status) {
    return normalizeEquipmentStatus(status) === "가능";
  }

  function booleanFromBody(value) {
    return value === true || value === "true";
  }

  function equipmentAuditDetail(patch, extra = {}) {
    const allowed = ["facility", "source", "category", "name", "brand", "model", "code", "status", "reservable", "inquiryOnly", "notes", "active"];
    return allowed.reduce((detail, field) => {
      if (patch[field] !== undefined) detail[field] = patch[field];
      return detail;
    }, { ...extra });
  }

  function applyEquipmentPatch(item, patch = {}) {
    const nextStatus = patch.status !== undefined ? normalizeEquipmentStatus(patch.status) : normalizeEquipmentStatus(item.status);
    if (nextStatus && !EQUIPMENT_STATUSES.has(nextStatus)) throw Object.assign(new Error("지원하지 않는 기자재 상태입니다."), { status: 400 });
    if (patch.facility !== undefined) item.facility = String(patch.facility).trim() || item.facility;
    if (patch.source !== undefined) item.source = patch.source === "fantasy_lab" ? "fantasy_lab" : "department";
    if (patch.category !== undefined) item.category = String(patch.category).trim() || item.category;
    if (patch.name !== undefined) item.name = String(patch.name).trim() || item.name;
    if (patch.brand !== undefined) item.brand = String(patch.brand || "");
    if (patch.model !== undefined) item.model = String(patch.model || "");
    if (patch.code !== undefined) item.code = String(patch.code).trim() || item.code;
    if (patch.notes !== undefined) item.notes = String(patch.notes || "");
    if (patch.active !== undefined) item.active = booleanFromBody(patch.active);
    if (patch.reservable !== undefined) item.reservable = booleanFromBody(patch.reservable);
    if (patch.inquiryOnly !== undefined) item.inquiryOnly = booleanFromBody(patch.inquiryOnly);
    item.status = nextStatus;
    item.updatedAt = nowIso();
    if (item.source === "fantasy_lab" || item.facility === "판타지랩") {
      item.source = "fantasy_lab";
      item.facility = "판타지랩";
      item.reservable = false;
      item.inquiryOnly = true;
      if (!item.notes) item.notes = FANTASY_LAB_INQUIRY_NOTE;
    } else if (patch.status !== undefined) {
      item.reservable = patch.reservable === undefined
        ? equipmentReservableForStatus(item.status)
        : booleanFromBody(patch.reservable) && equipmentReservableForStatus(item.status);
      item.inquiryOnly = !item.reservable;
    } else if (patch.reservable !== undefined) {
      item.inquiryOnly = !item.reservable;
    }
    return item;
  }

  function seedEquipment() {
    const items = [];
    for (const [source, category, name, quantity, reservable, notes] of seedEquipmentGroups) {
      const assignedAt = nowIso();
      const allocation = allocateEquipmentCodes({
        items,
        input: { category, name },
        quantity
      });
      for (const code of allocation.codes) {
        items.push({
          id: id("eq"),
          facility: source === "fantasy_lab" ? "판타지랩" : defaultSettings.equipmentFacility,
          source,
          category: allocation.identity.category,
          name,
          brand: allocation.identity.brand,
          brandCode: allocation.identity.brandCode,
          model: allocation.identity.model,
          productKey: allocation.identity.productKey,
          functionTags: allocation.identity.functionTags,
          code,
          legacyCodes: [],
          codeVersion: 2,
          codeAssignedAt: assignedAt,
          codeAssignedBy: "seed",
          status: "가능",
          reservable,
          inquiryOnly: !reservable,
          notes,
          active: true,
          createdAt: assignedAt,
          updatedAt: assignedAt
        });
      }
    }
    return items;
  }

  function createEquipmentRecords({
    existingItems = [],
    input = {},
    quantity = 1,
    makeId = id,
    timestamp = nowIso()
  } = {}) {
    const allocation = allocateEquipmentCodes({
      items: existingItems,
      input,
      quantity
    });
    if (
      allocation.identity.warnings.includes(
        "제품 또는 모델 정보를 확인하세요."
      )
    ) {
      throw Object.assign(
        new Error("제품명 또는 모델 정보를 확인하세요."),
        { status: 400 }
      );
    }
    const legacyCode = String(input.legacyCode || "").trim();
    return allocation.codes.map((code) => ({
      id: makeId("eq"),
      code,
      legacyCodes: legacyCode ? [legacyCode] : [],
      category: allocation.identity.category,
      brand: allocation.identity.brand,
      brandCode: allocation.identity.brandCode,
      model: allocation.identity.model,
      productKey: allocation.identity.productKey,
      functionTags: allocation.identity.functionTags,
      codeVersion: 2,
      codeAssignedAt: timestamp,
      codeAssignedBy: input.codeAssignedBy || ""
    }));
  }

  function equipmentPeriodDays(period = "") {
    if (String(period).includes("2박3일") || String(period).includes("주말")) return 2;
    if (String(period).includes("1박2일")) return 1;
    return 0;
  }

  function equipmentReservationRange(fields = {}) {
    const start = fields.reservedDate || "";
    if (!start) return null;
    return { start, end: addDaysToDateKey(start, equipmentPeriodDays(fields.period)) };
  }

  function normalizedText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function equipmentMatchesCategory(item, categories = []) {
    const category = normalizedText(item?.category);
    return categories.map(normalizedText).filter(Boolean).includes(category);
  }

  function equipmentMatchesAnyKeyword(item, keywords = []) {
    const haystack = [
      item?.name,
      item?.code,
      ...(Array.isArray(item?.legacyCodes) ? item.legacyCodes : []),
      item?.category,
      item?.notes,
      item?.model,
      item?.brand,
      item?.brandCode,
      item?.productKey,
      ...(Array.isArray(item?.functionTags) ? item.functionTags : [])
    ].map(normalizedText).join(" ");
    return keywords.map(normalizedText).filter(Boolean).some((keyword) => haystack.includes(keyword));
  }

  function isHighValueEquipment(item, settings = defaultSettings) {
    return equipmentMatchesCategory(item, settings.equipmentHighValueCategories || defaultSettings.equipmentHighValueCategories);
  }

  function isCameraBagEquipment(item, settings = defaultSettings) {
    return equipmentMatchesAnyKeyword(item, settings.equipmentBagKeywords || defaultSettings.equipmentBagKeywords);
  }

  function printDateOutsideUploadWindow(settings, reservedDate) {
    if (!reservedDate) return false;
    const start = settings.printUploadStartDate || "";
    const end = settings.printUploadEndDate || "";
    return Boolean((start && reservedDate < start) || (end && reservedDate > end));
  }

  return {
    applyEquipmentPatch,
    booleanFromBody,
    codeBase,
    createEquipmentRecords,
    equipmentAuditDetail,
    equipmentMatchesAnyKeyword,
    equipmentMatchesCategory,
    equipmentPeriodDays,
    equipmentReservationRange,
    equipmentReservableForStatus,
    isCameraBagEquipment,
    isHighValueEquipment,
    normalizeEquipmentStatus,
    printDateOutsideUploadWindow,
    seedEquipment
  };
}
