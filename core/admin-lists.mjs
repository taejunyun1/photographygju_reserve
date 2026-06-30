import {
  academicSemesterOptionsFromDates,
  dateMatchesAcademicSemester
} from "./academic-semester.mjs";

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
    semester: String(searchParams.get("semester") || "").trim(),
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

function searchParamsFromFilters(filters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters || {})) {
    if (value !== undefined && value !== null && value !== "" && value !== "all") params.set(key, String(value));
  }
  return params;
}

function paginate(items, params, extra = {}) {
  const total = items.length;
  const start = (params.page - 1) * params.pageSize;
  const pageItems = items.slice(start, start + params.pageSize);
  return {
    items: pageItems,
    total,
    page: params.page,
    pageSize: params.pageSize,
    hasMore: start + pageItems.length < total,
    ...extra
  };
}

function dateInRange(value, from, to) {
  if (from && (!value || value < from)) return false;
  if (to && (!value || value > to)) return false;
  return true;
}

function reservationDate(item) {
  return item.fields?.reservedDate || "";
}

function reportDate(item) {
  return item.reservation?.fields?.reservedDate || item.submittedAt?.slice(0, 10) || "";
}

export function createAdminListHelpers({ withReservationDetails, reportWithDetails, publicUser, lectureDetail }) {
  function hasListQuery(searchParams) {
    return Boolean(searchParams && [...searchParams.keys()].length);
  }

  function filterReservations(db, params) {
    const source = db.reservations.map((item) => withReservationDetails(db, item));
    const semesterOptions = academicSemesterOptionsFromDates(source.map(reservationDate));
    const items = source
      .filter((item) => !params.semester || params.semester === "all" || dateMatchesAcademicSemester(reservationDate(item), params.semester))
      .filter((item) => !params.type || item.type === params.type)
      .filter((item) => !params.status || item.status === params.status)
      .filter((item) => dateInRange(reservationDate(item), params.from, params.to))
      .filter((item) => !params.q || searchableRecord({
        id: item.id,
        type: item.type,
        status: item.status,
        fields: item.fields,
        user: item.user,
        equipmentItems: item.equipmentItems
      }).includes(params.q))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return { items, semesterOptions, collectionTotal: source.length };
  }

  function adminReservationList(db, searchParams) {
    const params = listParams(searchParams, 100);
    const { items, semesterOptions, collectionTotal } = filterReservations(db, params);
    return paginate(items, params, { semesterOptions, collectionTotal });
  }

  function filterReports(db, params) {
    const source = db.reports.map((item) => reportWithDetails(db, item));
    const semesterOptions = academicSemesterOptionsFromDates(source.map(reportDate));
    const items = source
      .filter((item) => !params.semester || params.semester === "all" || dateMatchesAcademicSemester(reportDate(item), params.semester))
      .filter((item) => !params.type || item.type === params.type)
      .filter((item) => dateInRange(reportDate(item), params.from, params.to))
      .filter((item) => !params.q || searchableRecord({
        id: item.id,
        reservationId: item.reservationId,
        fields: item.fields,
        reservation: item.reservation,
        user: item.user
      }).includes(params.q))
      .sort((a, b) => String(b.submittedAt || "").localeCompare(String(a.submittedAt || "")));
    return { items, semesterOptions, collectionTotal: source.length };
  }

  function adminReportList(db, searchParams) {
    const params = listParams(searchParams, 100);
    const { items, semesterOptions, collectionTotal } = filterReports(db, params);
    return paginate(items, params, { semesterOptions, collectionTotal });
  }

  function filterLectures(db, params) {
    const source = db.lectures.map((lecture) => lectureDetail(db, lecture));
    const semesterOptions = academicSemesterOptionsFromDates(source.map((item) => item.lectureDate || ""));
    const items = source
      .filter((item) => !params.semester || params.semester === "all" || dateMatchesAcademicSemester(item.lectureDate || "", params.semester))
      .filter((item) => dateInRange(item.lectureDate || "", params.from, params.to))
      .filter((item) => !params.q || searchableRecord(item).includes(params.q))
      .sort((a, b) => String(a.lectureDate || "").localeCompare(String(b.lectureDate || "")));
    return { items, semesterOptions, collectionTotal: source.length };
  }

  function adminLectureList(db, searchParams) {
    const params = listParams(searchParams, 100);
    const { items, semesterOptions, collectionTotal } = filterLectures(db, params);
    return paginate(items, params, { semesterOptions, collectionTotal });
  }

  function filterNotices(db, params) {
    const source = db.notices || [];
    const items = source
      .filter((item) => !params.type || item.category === params.type)
      .filter((item) => !params.status || item.status === params.status)
      .filter((item) => dateInRange(String(item.createdAt || "").slice(0, 10), params.from, params.to))
      .filter((item) => !params.q || searchableRecord({
        title: item.title,
        category: item.category,
        body: item.body,
        link: item.link,
        createdAt: item.createdAt
      }).includes(params.q))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return { items, collectionTotal: source.length };
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
    adminUserList,
    adminLectureList,
    filterAdminReservations: (db, filters) => filterReservations(db, listParams(searchParamsFromFilters(filters), 100000)),
    filterAdminReports: (db, filters) => filterReports(db, listParams(searchParamsFromFilters(filters), 100000)),
    filterAdminLectures: (db, filters) => filterLectures(db, listParams(searchParamsFromFilters(filters), 100000)),
    filterAdminNotices: (db, filters) => filterNotices(db, listParams(searchParamsFromFilters(filters), 100000))
  };
}
