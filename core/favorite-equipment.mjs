const MAX_GROUPS = 3;
const MAX_ITEMS_PER_GROUP = 5;
const MAX_GROUP_NAME_LENGTH = 12;
const TERMINAL_SHORTCUT_STATUSES = new Set(["cancelled", "admin_cancelled", "rejected"]);

function fail(message) {
  throw Object.assign(new Error(message), { status: 400 });
}

function publicEquipment(item) {
  return {
    id: String(item.id || ""),
    code: String(item.code || ""),
    name: String(item.name || ""),
    category: String(item.category || ""),
    status: String(item.status || ""),
    active: item.active !== false,
    reservable: item.reservable !== false
  };
}

export function validateFavoriteGroups(value, equipment = [], { createId = () => "favorite_group" } = {}) {
  if (!Array.isArray(value)) fail("즐겨찾기 그룹 목록이 올바르지 않습니다.");
  if (value.length > MAX_GROUPS) fail("즐겨찾기 그룹은 3개까지 만들 수 있습니다.");
  const equipmentById = new Map((Array.isArray(equipment) ? equipment : []).map((item) => [String(item?.id || ""), item]));
  const seenEquipmentIds = new Set();
  const seenGroupIds = new Set();

  return value.map((rawGroup) => {
    if (!rawGroup || typeof rawGroup !== "object" || Array.isArray(rawGroup)) fail("즐겨찾기 그룹 값이 올바르지 않습니다.");
    const name = String(rawGroup.name || "").trim();
    if (!name) fail("즐겨찾기 그룹 이름을 입력하세요.");
    if (name.length > MAX_GROUP_NAME_LENGTH) fail("즐겨찾기 그룹 이름은 12자 이하로 입력하세요.");
    const groupId = String(rawGroup.id || createId("favorite_group"));
    if (!groupId || seenGroupIds.has(groupId)) fail("즐겨찾기 그룹 ID가 중복되었습니다.");
    seenGroupIds.add(groupId);
    if (!Array.isArray(rawGroup.equipmentItemIds)) fail("그룹 기자재 목록이 올바르지 않습니다.");
    if (rawGroup.equipmentItemIds.length > MAX_ITEMS_PER_GROUP) fail("이 그룹에는 장비를 5개까지 저장할 수 있습니다.");
    const equipmentItemIds = rawGroup.equipmentItemIds.map((value) => String(value || "").trim());
    if (equipmentItemIds.some((equipmentId) => !equipmentId)) fail("즐겨찾기 기자재를 확인하세요.");
    for (const equipmentId of equipmentItemIds) {
      if (seenEquipmentIds.has(equipmentId)) fail("하나의 장비는 한 그룹에만 넣을 수 있습니다.");
      const item = equipmentById.get(equipmentId);
      if (!item || item.active === false || item.reservable === false) fail("현재 즐겨찾기에 추가할 수 없는 장비가 포함되어 있습니다.");
      seenEquipmentIds.add(equipmentId);
    }
    return { id: groupId, name, equipmentItemIds };
  });
}

export function publicFavoriteGroups(groups, equipment = []) {
  const equipmentById = new Map((Array.isArray(equipment) ? equipment : []).map((item) => [String(item?.id || ""), item]));
  return (Array.isArray(groups) ? groups : []).map((group) => ({
    id: String(group?.id || ""),
    name: String(group?.name || ""),
    equipmentItemIds: Array.isArray(group?.equipmentItemIds) ? group.equipmentItemIds.map((item) => String(item || "")).filter(Boolean) : [],
    equipment: (Array.isArray(group?.equipmentItemIds) ? group.equipmentItemIds : [])
      .map((equipmentId) => equipmentById.get(String(equipmentId || "")))
      .filter(Boolean)
      .map(publicEquipment)
  }));
}

function safeReservationFields(reservation) {
  const fields = reservation?.fields || {};
  return {
    period: String(fields.period || ""),
    equipmentItemIds: Array.isArray(fields.equipmentItemIds) ? fields.equipmentItemIds.map((item) => String(item || "")).filter(Boolean) : [],
    studioSpace: String(fields.studioSpace || ""),
    studioSpaces: Array.isArray(fields.studioSpaces) ? fields.studioSpaces.map((item) => String(item || "")).filter(Boolean) : [],
    timeSlots: Array.isArray(fields.timeSlots) ? fields.timeSlots.map((item) => String(item || "")).filter(Boolean) : [],
    processTypes: Array.isArray(fields.processTypes) ? fields.processTypes.map((item) => String(item || "")).filter(Boolean) : [],
    participantCount: fields.participantCount ?? "",
    participants: String(fields.participants || ""),
    requiredEquipment: String(fields.requiredEquipment || ""),
    purpose: String(fields.purpose || ""),
    standRequest: String(fields.standRequest || ""),
    printType: String(fields.printType || ""),
    paper: String(fields.paper || ""),
    size: String(fields.size || ""),
    count: Number(fields.count || 0),
    memo: String(fields.memo || "")
  };
}

export function reservationShortcuts({ userId, reservations = [], equipment = [] } = {}) {
  const equipmentById = new Map((Array.isArray(equipment) ? equipment : []).map((item) => [String(item?.id || ""), item]));
  return (Array.isArray(reservations) ? reservations : [])
    .filter((reservation) => reservation?.userId === userId && !TERMINAL_SHORTCUT_STATUSES.has(reservation.status) && ["equipment", "studio", "darkroom", "print"].includes(reservation.type))
    .slice()
    .sort((left, right) => String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || "")))
    .slice(0, 3)
    .map((reservation) => ({
      id: String(reservation.id || ""),
      type: reservation.type,
      status: String(reservation.status || ""),
      fields: safeReservationFields(reservation),
      equipmentItems: (Array.isArray(reservation.fields?.equipmentItemIds) ? reservation.fields.equipmentItemIds : [])
        .map((equipmentId) => equipmentById.get(String(equipmentId || "")))
        .filter(Boolean)
        .map(publicEquipment)
    }));
}

export function favoriteGroupsForUser(user, equipment) {
  return publicFavoriteGroups(user?.preferences?.favoriteEquipmentGroups, equipment);
}
