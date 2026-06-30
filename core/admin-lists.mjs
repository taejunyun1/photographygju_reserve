function listNumber(value, fallback, { min = 1, max = 200 } = {}) {
  if (value === null || value === undefined || String(value).trim() === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(number)));
}

function listParams(searchParams, defaultPageSize = 100) {
  const page = listNumber(searchParams.get("page"), 1, { min: 1, max: 100000 });
  const pageSize = listNumber(searchParams.get("pageSize"), defaultPageSize, { min: 1, max: 200 });
  return {
    page,
    pageSize,
    q: String(searchParams.get("q") || "").trim().toLocaleLowerCase(),
    type: String(searchParams.get("type") || "").trim(),
    status: String(searchParams.get("status") || "").trim(),
    role: String(searchParams.get("role") || "").trim(),
    from: String(searchParams.get("from") || "").trim(),
    to: String(searchParams.get("to") || "").trim()
  };
}

function searchable(value) {
  return String(value ?? "").toLocaleLowerCase();
}

function searchableRecord(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return searchable(value);
  if (Array.isArray(value)) return value.map(searchableRecord).join(" ");
  if (typeof value === "object") return Object.values(value).map(searchableRecord).join(" ");
  return "";
}

function paginate(items, params) {
  const total = items.length;
  const start = (params.page - 1) * params.pageSize;
  const pageItems = items.slice(start, start + params.pageSize);
  return {
    items: pageItems,
    total,
    page: params.page,
    pageSize: params.pageSize,
    hasMore: start + pageItems.length < total
  };
}

function dateInRange(value, from, to) {
  if (from && (!value || value < from)) return false;
  if (to && (!value || value > to)) return false;
  return true;
}

export function createAdminListHelpers({ withReservationDetails, reportWithDetails, publicUser }) {
  function hasListQuery(searchParams) {
    return Boolean(searchParams && [...searchParams.keys()].length);
  }

  function adminReservationList(db, searchParams) {
    const params = listParams(searchParams, 100);
    const items = db.reservations
      .map((item) => withReservationDetails(db, item))
      .filter((item) => !params.type || item.type === params.type)
      .filter((item) => !params.status || item.status === params.status)
      .filter((item) => dateInRange(item.fields?.reservedDate || "", params.from, params.to))
      .filter((item) => !params.q || searchableRecord({
        id: item.id,
        type: item.type,
        status: item.status,
        fields: item.fields,
        user: item.user,
        equipmentItems: item.equipmentItems
      }).includes(params.q))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return paginate(items, params);
  }

  function adminReportList(db, searchParams) {
    const params = listParams(searchParams, 100);
    const items = db.reports
      .map((item) => reportWithDetails(db, item))
      .filter((item) => !params.type || item.type === params.type)
      .filter((item) => dateInRange(item.reservation?.fields?.reservedDate || item.submittedAt?.slice(0, 10) || "", params.from, params.to))
      .filter((item) => !params.q || searchableRecord({
        id: item.id,
        reservationId: item.reservationId,
        fields: item.fields,
        reservation: item.reservation,
        user: item.user
      }).includes(params.q))
      .sort((a, b) => String(b.submittedAt || "").localeCompare(String(a.submittedAt || "")));
    return paginate(items, params);
  }

  function adminUserList(db, searchParams) {
    const params = listParams(searchParams, 100);
    const items = db.users
      .map((user) => publicUser(user, db))
      .filter((user) => !params.role || user.role === params.role)
      .filter((user) => !params.status || user.approvalStatus === params.status)
      .filter((user) => !params.q || searchableRecord(user).includes(params.q))
      .sort((a, b) => {
        const approvalCompare = String(a.approvalStatus || "").localeCompare(String(b.approvalStatus || ""));
        if (approvalCompare) return approvalCompare;
        return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
      });
    return paginate(items, params);
  }

  return {
    hasListQuery,
    adminReservationList,
    adminReportList,
    adminUserList
  };
}
