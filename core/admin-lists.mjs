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
    to: String(searchParams.get("to") || "").trim(),
    sort: String(searchParams.get("sort") || "").trim(),
    direction: ["asc", "desc"].includes(String(searchParams.get("direction") || "").trim().toLowerCase())
      ? String(searchParams.get("direction")).trim().toLowerCase()
      : ""
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

function compareValues(left, right) {
  if (typeof left === "number" && typeof right === "number") return left - right;
  if (typeof left === "boolean" && typeof right === "boolean") return Number(left) - Number(right);
  return String(left ?? "").localeCompare(String(right ?? ""), "ko", {
    numeric: true,
    sensitivity: "base"
  });
}

function stableIdCompare(left, right) {
  return String(left?.id || "").localeCompare(String(right?.id || ""), "ko", { numeric: true });
}

function sortList(items, params, { fields, defaultCompare, defaultDirections = {} }) {
  const accessor = fields[params.sort];
  if (!accessor) {
    return items.sort((left, right) => defaultCompare(left, right) || stableIdCompare(left, right));
  }
  const direction = params.direction || defaultDirections[params.sort] || "asc";
  const multiplier = direction === "desc" ? -1 : 1;
  return items.sort((left, right) => (
    compareValues(accessor(left), accessor(right)) * multiplier || stableIdCompare(left, right)
  ));
}

const RESERVATION_SORT_FIELDS = {
  createdAt: (item) => item.createdAt,
  reservedDate: reservationDate,
  status: (item) => item.status,
  type: (item) => item.type,
  name: (item) => item.user?.name,
  title: (item) => item.fields?.title || item.fields?.studioSpace || item.equipmentItems?.[0]?.name
};

const REPORT_SORT_FIELDS = {
  submittedAt: (item) => item.submittedAt,
  createdAt: (item) => item.createdAt,
  name: (item) => item.user?.name || item.reservation?.user?.name,
  title: (item) => item.title || item.projectTitle || item.fields?.projectTitle || item.reservation?.fields?.title,
  status: (item) => item.status || item.fields?.status || item.reservation?.fields?.reportStatus,
  semester: (item) => item.semester || reportDate(item)
};

const LECTURE_SORT_FIELDS = {
  lectureDate: (item) => item.lectureDate,
  createdAt: (item) => item.createdAt,
  title: (item) => item.title,
  instructorName: (item) => item.instructorName,
  status: (item) => item.status,
  applicationCount: (item) => Number(item.applicationCount || 0)
};

const NOTICE_SORT_FIELDS = {
  createdAt: (item) => item.createdAt,
  updatedAt: (item) => item.updatedAt,
  title: (item) => item.title,
  category: (item) => item.category,
  status: (item) => item.active === false ? "draft" : "published",
  pinned: (item) => Boolean(item.pinned)
};

const USER_SORT_FIELDS = {
  name: (item) => item.name,
  studentId: (item) => item.studentId,
  studentStatus: (item) => item.studentStatus,
  approvalStatus: (item) => item.approvalStatus,
  createdAt: (item) => item.createdAt
};

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
      .filter((item) => !params.status
        || (params.status === "cancelled_or_rejected"
          ? ["cancelled", "rejected"].includes(item.status)
          : item.status === params.status))
      .filter((item) => dateInRange(reservationDate(item), params.from, params.to))
      .filter((item) => !params.q || searchableRecord({
        id: item.id,
        type: item.type,
        status: item.status,
        fields: item.fields,
        user: item.user,
        equipmentItems: item.equipmentItems
      }).includes(params.q));
    sortList(items, params, {
      fields: RESERVATION_SORT_FIELDS,
      defaultCompare: (a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
      defaultDirections: { createdAt: "desc", reservedDate: "asc" }
    });
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
      }).includes(params.q));
    sortList(items, params, {
      fields: REPORT_SORT_FIELDS,
      defaultCompare: (a, b) => String(b.submittedAt || "").localeCompare(String(a.submittedAt || "")),
      defaultDirections: { submittedAt: "desc", createdAt: "desc" }
    });
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
      .filter((item) => !params.q || searchableRecord(item).includes(params.q));
    sortList(items, params, {
      fields: LECTURE_SORT_FIELDS,
      defaultCompare: (a, b) => String(a.lectureDate || "").localeCompare(String(b.lectureDate || "")),
      defaultDirections: { lectureDate: "asc", createdAt: "desc", applicationCount: "desc" }
    });
    return { items, semesterOptions, collectionTotal: source.length };
  }

  function adminLectureList(db, searchParams) {
    const params = listParams(searchParams, 100);
    const { items, semesterOptions, collectionTotal } = filterLectures(db, params);
    return paginate(items, params, { semesterOptions, collectionTotal });
  }

  function filterNotices(db, params) {
    const source = (db.notices || []).map((item) => {
      const active = typeof item.active === "boolean" ? item.active : item.status === "published";
      return { ...item, active, status: active ? "published" : "draft" };
    });
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
      }).includes(params.q));
    sortList(items, params, {
      fields: NOTICE_SORT_FIELDS,
      defaultCompare: (a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
      defaultDirections: { createdAt: "desc", updatedAt: "desc", pinned: "desc" }
    });
    return { items, collectionTotal: source.length };
  }

  function adminNoticeList(db, searchParams) {
    const params = listParams(searchParams, 100);
    const { items, collectionTotal } = filterNotices(db, params);
    return paginate(items, params, { collectionTotal });
  }

  function adminUserList(db, searchParams) {
    const params = listParams(searchParams, 100);
    const items = db.users
      .map((user) => publicUser(user, db))
      .filter((user) => !params.role || user.role === params.role)
      .filter((user) => !params.status || user.approvalStatus === params.status)
      .filter((user) => !params.q || searchableRecord(user).includes(params.q));
    sortList(items, params, {
      fields: USER_SORT_FIELDS,
      defaultCompare: (a, b) => {
        const approvalCompare = String(a.approvalStatus || "").localeCompare(String(b.approvalStatus || ""));
        if (approvalCompare) return approvalCompare;
        return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
      },
      defaultDirections: { approvalStatus: "asc", createdAt: "desc" }
    });
    return paginate(items, params);
  }

  return {
    hasListQuery,
    adminReservationList,
    adminReportList,
    adminUserList,
    adminLectureList,
    adminNoticeList,
    filterAdminReservations: (db, filters) => filterReservations(db, listParams(searchParamsFromFilters(filters), 100000)),
    filterAdminReports: (db, filters) => filterReports(db, listParams(searchParamsFromFilters(filters), 100000)),
    filterAdminLectures: (db, filters) => filterLectures(db, listParams(searchParamsFromFilters(filters), 100000)),
    filterAdminNotices: (db, filters) => filterNotices(db, listParams(searchParamsFromFilters(filters), 100000))
  };
}
