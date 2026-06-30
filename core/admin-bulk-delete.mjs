const FULL_DELETE_PHRASE = "전체 삭제";

function nowIso() {
  return new Date().toISOString();
}

function assertBulkScope({ scope, confirmText }) {
  if (!["filtered", "all"].includes(scope)) {
    throw Object.assign(new Error("삭제 범위를 확인할 수 없습니다."), { status: 400 });
  }
  if (scope === "all" && confirmText !== FULL_DELETE_PHRASE) {
    throw Object.assign(new Error("전체 삭제를 실행하려면 확인 문구를 정확히 입력하세요."), { status: 400 });
  }
}

function allowedFilters(filters = {}, allowedKeys = []) {
  const allowed = new Set(allowedKeys);
  const rejected = Object.keys(filters || {}).filter((key) => !allowed.has(key));
  if (rejected.length) {
    throw Object.assign(new Error(`지원하지 않는 삭제 필터입니다: ${rejected.join(", ")}`), { status: 400 });
  }
  return Object.fromEntries(Object.entries(filters || {}).filter(([, value]) => value !== undefined && value !== null && value !== "" && value !== "all"));
}

function selectionFromScope(scope, filters, allItems, filteredItems) {
  return scope === "all"
    ? { filters: {}, items: allItems }
    : { filters, items: filteredItems };
}

function assertFilteredDeleteSafe({ scope, filters, allItems, filteredItems, confirmText }) {
  if (scope !== "filtered") return;
  if (!Object.keys(filters || {}).length) {
    throw Object.assign(new Error("현재 필터 결과 삭제는 검색어, 학기, 유형, 상태 등 필터 조건이 있을 때만 실행할 수 있습니다."), { status: 400 });
  }
  if (allItems.length > 0 && filteredItems.length === allItems.length && confirmText !== FULL_DELETE_PHRASE) {
    throw Object.assign(new Error("현재 필터 결과가 전체 데이터와 같습니다. 전체 삭제를 실행하려면 확인 문구를 정확히 입력하세요."), { status: 400 });
  }
}

export function deleteAdminReservations(db, { scope, filters = {}, confirmText, admin, filterAdminReservations }) {
  assertBulkScope({ scope, confirmText });
  const safeFilters = allowedFilters(filters, ["q", "type", "status", "semester", "from", "to"]);
  const allItems = filterAdminReservations(db, {});
  const filteredItems = filterAdminReservations(db, safeFilters);
  assertFilteredDeleteSafe({ scope, filters: safeFilters, allItems: allItems.items, filteredItems: filteredItems.items, confirmText });
  const selected = selectionFromScope(scope, safeFilters, allItems.items, filteredItems.items);
  const reservationIds = new Set(selected.items.map((item) => item.id));
  const reportIds = new Set((db.reports || []).filter((item) => reservationIds.has(item.reservationId)).map((item) => item.id));
  db.reservations = (db.reservations || []).filter((item) => !reservationIds.has(item.id));
  db.reports = (db.reports || []).filter((item) => !reportIds.has(item.id));
  return {
    summary: {
      deletedReservations: reservationIds.size,
      deletedReports: reportIds.size
    },
    audit: {
      adminId: admin?.id || null,
      scope,
      filters: selected.filters,
      deletedReservations: reservationIds.size,
      deletedReports: reportIds.size
    }
  };
}

export function deleteAdminReports(db, { scope, filters = {}, confirmText, admin, filterAdminReports }) {
  assertBulkScope({ scope, confirmText });
  const safeFilters = allowedFilters(filters, ["q", "type", "semester", "from", "to"]);
  const allItems = filterAdminReports(db, {});
  const filteredItems = filterAdminReports(db, safeFilters);
  assertFilteredDeleteSafe({ scope, filters: safeFilters, allItems: allItems.items, filteredItems: filteredItems.items, confirmText });
  const selected = selectionFromScope(scope, safeFilters, allItems.items, filteredItems.items);
  const reportIds = new Set(selected.items.map((item) => item.id));
  const resetReservationIds = new Set(selected.items.map((item) => item.reservationId).filter(Boolean));
  db.reports = (db.reports || []).filter((item) => !reportIds.has(item.id));
  let resetReservations = 0;
  for (const reservation of db.reservations || []) {
    if (resetReservationIds.has(reservation.id) && reservation.fields?.reportStatus === "submitted") {
      reservation.fields.reportStatus = "required";
      reservation.updatedAt = nowIso();
      resetReservations += 1;
    }
  }
  return {
    summary: {
      deletedReports: reportIds.size,
      resetReservations
    },
    audit: {
      adminId: admin?.id || null,
      scope,
      filters: selected.filters,
      deletedReports: reportIds.size,
      resetReservations
    }
  };
}

export function deleteAdminLectures(db, { scope, filters = {}, confirmText, admin, filterAdminLectures }) {
  assertBulkScope({ scope, confirmText });
  const safeFilters = allowedFilters(filters, ["q", "semester", "from", "to"]);
  const allItems = filterAdminLectures(db, {});
  const filteredItems = filterAdminLectures(db, safeFilters);
  assertFilteredDeleteSafe({ scope, filters: safeFilters, allItems: allItems.items, filteredItems: filteredItems.items, confirmText });
  const selected = selectionFromScope(scope, safeFilters, allItems.items, filteredItems.items);
  const lectureIds = new Set(selected.items.map((item) => item.id));
  const deletedApplications = (db.lectureApplications || []).filter((item) => lectureIds.has(item.lectureId)).length;
  db.lectureApplications = (db.lectureApplications || []).filter((item) => !lectureIds.has(item.lectureId));
  db.lectures = (db.lectures || []).filter((item) => !lectureIds.has(item.id));
  return {
    summary: {
      deletedLectures: lectureIds.size,
      deletedApplications
    },
    audit: {
      adminId: admin?.id || null,
      scope,
      filters: selected.filters,
      deletedLectures: lectureIds.size,
      deletedApplications
    }
  };
}

export function deleteAdminNotices(db, { scope, filters = {}, confirmText, admin, filterAdminNotices }) {
  assertBulkScope({ scope, confirmText });
  const safeFilters = allowedFilters(filters, ["q", "type", "status", "from", "to"]);
  const allItems = filterAdminNotices(db, {});
  const filteredItems = filterAdminNotices(db, safeFilters);
  assertFilteredDeleteSafe({ scope, filters: safeFilters, allItems: allItems.items, filteredItems: filteredItems.items, confirmText });
  const selected = selectionFromScope(scope, safeFilters, allItems.items, filteredItems.items);
  const noticeIds = new Set(selected.items.map((item) => item.id));
  db.notices = (db.notices || []).filter((item) => !noticeIds.has(item.id));
  return {
    summary: {
      deletedNotices: noticeIds.size
    },
    audit: {
      adminId: admin?.id || null,
      scope,
      filters: selected.filters,
      deletedNotices: noticeIds.size
    }
  };
}
