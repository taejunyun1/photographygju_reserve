// Shared application core for both the Cloudflare Worker (worker.mjs) and the
// local dev server (server.js). Transport, storage, and CORS live in those
// adapters; everything else — data model, validation, routes — lives here.
// Relies on the Web Crypto + fetch globals available in Workers and Node 18+.

import {
  deleteAdminLectures,
  deleteAdminNotices,
  deleteAdminReports,
  deleteAdminReservations
} from "./core/admin-bulk-delete.mjs";
import { createAdminListHelpers } from "./core/admin-lists.mjs";
import { createMaintenanceHelpers } from "./core/maintenance.mjs";
import { createNotificationHelpers } from "./core/notifications.mjs";
import { buildOperationsInsights } from "./core/operations-insights.mjs";
import { favoriteGroupsForUser, reservationShortcuts, validateFavoriteGroups } from "./core/favorite-equipment.mjs";
import { findReservationRecommendations } from "./core/reservation-recommendations.mjs";
import {
  buildOfferingRecommendation,
  createCoursePlanningSeed,
  normalizeCoursePlanning,
  publicSurveyForStudent,
  summarizeSurvey,
  validateAnnualPlan,
  validateCourseDemandSurveyDefinition,
  validateCourseDemandResponse
} from "./core/course-demand.mjs";
import { reservationTiming } from "./core/reservation-timing.mjs";
import {
  darkroomChemicals,
  defaultSettings,
  createSettingsHelpers
} from "./core/settings.mjs";
import {
  FANTASY_LAB_INQUIRY_NOTE,
  createEquipmentHelpers
} from "./core/equipment.mjs";
import {
  PASSWORD_MIN_LENGTH,
  SESSION_TTL_MS,
  createAuthSessionHelpers
} from "./core/auth-session.mjs";
import {
  assertRequired,
  fail,
  ok,
  parseBody,
  requestPath,
  routeKey
} from "./core/router.mjs";
import { createReportsLecturesNoticesHelpers } from "./core/reports-lectures-notices.mjs";
import { createReservationValidationHelpers } from "./core/reservation-validation.mjs";
import { createReservationViewHelpers } from "./core/reservation-views.mjs";

const PRODUCTION_STUDENT_URL = "https://gjureserve.co.kr";
const LEGACY_STUDENT_URL = "https://photographygju.dothome.co.kr";
const LEGACY_ADMIN_URL = "https://admin.photographygju.dothome.co.kr";
const LEGACY_WRONG_STUDENT_URL = "https://gjupreserve.com";
const LEGACY_WRONG_WWW_URL = "https://www.gjupreserve.com";
const LEGACY_PUBLIC_URLS = [
  LEGACY_STUDENT_URL,
  LEGACY_ADMIN_URL,
  LEGACY_WRONG_STUDENT_URL,
  LEGACY_WRONG_WWW_URL
];
const RESERVATION_RETENTION_DAYS = 90;
const REPORT_HTML_RETENTION_DAYS = 183;
const loginAttempts = new Map();
const LIMIT_DURATION_DAYS = {
  week1: 7,
  week2: 14,
  month1: 30,
  semester: 120
};
const APPROVAL_STATUSES = new Set(["approval_pending", "approved", "rejected", "blocked"]);
const EQUIPMENT_RESERVATION_STATUSES = new Set([
  "pending_approval",
  "approved",
  "checked_out",
  "returned",
  "rejected",
  "cancelled"
]);
const EQUIPMENT_RESERVATION_STATUS_TRANSITIONS = {
  pending_approval: new Set(["approved", "rejected"]),
  approved: new Set(["checked_out", "cancelled"]),
  checked_out: new Set(["returned", "cancelled"]),
  returned: new Set(),
  rejected: new Set(),
  cancelled: new Set()
};
const RESERVATION_CANCELLATION_TERMINAL_STATUSES = new Set(["cancelled", "admin_cancelled", "returned", "completed", "rejected"]);
const REPORT_INELIGIBLE_RESERVATION_STATUSES = new Set(["cancelled", "admin_cancelled", "rejected"]);
const ADMIN_RESERVATION_STATUS_BY_TYPE = {
  equipment: EQUIPMENT_RESERVATION_STATUSES,
  studio: new Set(["completed", "admin_cancelled"]),
  darkroom: new Set(["completed", "admin_cancelled"]),
  print: new Set(["completed", "admin_cancelled"])
};
const WEEKDAY_INDEX = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
};
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_VALUE_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const seedEquipmentGroups = [
  ["department", "Body", "캐논 750D", 5, true, ""],
  ["department", "Body", "캐논 800D", 1, true, ""],
  ["department", "Body", "소니 A7M3", 3, true, ""],
  ["department", "Body", "캐논 EOS 5", 3, true, "필름"],
  ["department", "Body", "캐논 EOS 1", 1, true, "필름"],
  ["department", "Body", "니콘 FM2", 1, true, "필름"],
  ["department", "Body", "니콘 D800", 1, true, ""],
  ["department", "Body", "라이카 M6", 1, true, "필름"],
  ["department", "Lens", "캐논 EF-S 18-55", 5, true, ""],
  ["department", "Lens", "미확인 렌즈", 2, false, "원본 목록에 이름 없이 2pcs만 있음. 확인 필요"],
  ["department", "Lens", "캐논 EF 16-35", 1, true, ""],
  ["department", "Lens", "캐논 17-85", 1, true, ""],
  ["department", "Lens", "캐논 28-80", 1, true, "필카 가능"],
  ["department", "Lens", "캐논 28-105", 3, true, "필카 가능"],
  ["department", "Lens", "캐논 70-300", 1, true, ""],
  ["department", "Lens", "캐논 RF 85mm", 1, true, ""],
  ["department", "Lens", "캐논 100macro", 2, true, ""],
  ["department", "Lens", "니콘 105macro", 1, true, ""],
  ["department", "Lens", "니콘 135mm", 1, true, "수동"],
  ["department", "Lens", "니콘 50mm", 2, true, "수동"],
  ["department", "Lens", "니콘 16-35mm", 1, true, ""],
  ["department", "Lens", "니콘 85mm", 1, true, ""],
  ["department", "Lens", "니콘 시그마 70-200mm", 1, true, ""],
  ["department", "Lens", "소니 16-35GM", 1, true, ""],
  ["department", "Lens", "소니 24-70GM", 1, true, ""],
  ["department", "Lens", "소니 90macro", 1, true, ""],
  ["department", "Lens", "소니 28-70mm", 1, true, ""],
  ["department", "Lighting", "캐논 스피드라이트 430EX", 2, true, ""],
  ["department", "Lighting", "니콘 스피드라이트 SB-900", 1, true, ""],
  ["department", "Lighting", "프로포토 B10", 3, true, ""],
  ["department", "Lighting", "Aputure Light Dome MINI II", 2, true, ""],
  ["department", "Lighting", "Aputure LS 60X LED 조명 바이컬러", 2, true, ""],
  ["department", "Lighting", "Aputure LS 60D LED 조명 5600K", 1, true, ""],
  ["department", "Other", "노출계", 1, true, "수량 확인 필요"],
  ["department", "Other", "삼각대", 1, true, "수량 확인 필요"],
  ["department", "Other", "컬러미터", 1, true, "수량 확인 필요"],
  ["department", "Other", "스팟미터", 1, true, "수량 확인 필요"],
  ["department", "Other", "모니터 캘리브레이터 IOne", 1, true, ""],
  ["department", "Other", "ATOMOS Shogun 7", 2, true, "영상 프리뷰 모니터"],
  ["department", "Other", "펠리칸 케이스 1510 디바이어스", 1, true, ""],
  ["department", "Other", "DJI 로닌 RS2 Pro 짐벌", 1, true, ""],
  ["department", "Other", "BW 가변 ND 필터", 1, true, ""],
  ["department", "Audio", "Zoom H5 레코더", 3, true, ""],
  ["department", "Audio", "짓조 붐 마이크 폴", 1, true, ""],
  ["department", "Audio", "로데 붐 마이크 폴", 1, true, ""],
  ["department", "Audio", "젠하이저 샷건마이크", 1, true, ""],
  ["department", "Audio", "로데 샷건 마이크", 1, true, ""],
  ["department", "Audio", "로데 쇼크 마운트", 2, true, ""],
  ["department", "Audio", "로데 블림프", 1, true, ""],
  ["department", "Audio", "벨덴 XLR to XLR 케이블 1M", 4, true, ""],
  ["department", "Audio", "벨덴 XLR to XLR 케이블 3M", 4, true, ""],
  ["fantasy_lab", "Body", "소니 A7SII Body", 5, false, "영상용, 판타지랩 조교 문의"],
  ["fantasy_lab", "Body", "소니 A7MIII Body", 1, false, "판타지랩 조교 문의"],
  ["fantasy_lab", "Body", "소니 FX3 Body", 1, false, "영상용, 판타지랩 조교 문의"],
  ["fantasy_lab", "Body", "소니 PXW FS7", 1, false, "4K 비디오카메라, 판타지랩 조교 문의"],
  ["fantasy_lab", "Lens", "삼양 AF 35mm F2.8 Lens", 4, false, "판타지랩 조교 문의"],
  ["fantasy_lab", "Lens", "소니 FE 28-70mm F3.5-5.6 Lens", 1, false, "판타지랩 조교 문의"],
  ["fantasy_lab", "Lens", "소니 FE 24-70mm F2.8 Lens", 1, false, "판타지랩 조교 문의"],
  ["fantasy_lab", "Other", "DJI 오즈모 포켓", 2, false, "액션캠, 판타지랩 조교 문의"],
  ["fantasy_lab", "Drone", "DJI 스파크", 2, false, "판타지랩 조교 문의"],
  ["fantasy_lab", "Drone", "DJI 매빅 에어", 1, false, "판타지랩 조교 문의"],
  ["fantasy_lab", "Drone", "DJI 매빅2 프로", 3, false, "판타지랩 조교 문의"],
  ["fantasy_lab", "Drone", "DJI 매빅2 줌", 1, false, "판타지랩 조교 문의"],
  ["fantasy_lab", "Drone", "DJI 매빅3", 1, false, "판타지랩 조교 문의"],
  ["fantasy_lab", "Audio", "SONY UWP-D11 핀마이크", 3, false, "판타지랩 조교 문의"],
  ["fantasy_lab", "Audio", "RODE Stereo VideoMic Pro", 1, false, "지향성마이크, 판타지랩 조교 문의"],
  ["fantasy_lab", "Audio", "BSM200_1 채널 무선 핀마이크", 1, false, "판타지랩 조교 문의"],
  ["fantasy_lab", "Audio", "TASCAM DR-40x 보이스레코더", 1, false, "판타지랩 조교 문의"],
  ["fantasy_lab", "Audio", "하만 C214 마이크믹싱콘솔", 1, false, "판타지랩 조교 문의"],
  ["fantasy_lab", "Other", "세코닉 L-308DC", 1, false, "영상촬영용 노출계, 판타지랩 조교 문의"],
  ["fantasy_lab", "Other", "셔틀러", 4, false, "판타지랩 조교 문의"],
  ["fantasy_lab", "Other", "360도 촬영 카메라 어댑터 카메라고정용", 1, false, "판타지랩 조교 문의"],
  ["fantasy_lab", "Other", "360도 촬영 카메라 어댑터 삼각대고정용", 1, false, "판타지랩 조교 문의"],
  ["fantasy_lab", "Other", "DJI 오즈모 짐벌", 1, false, "판타지랩 조교 문의"],
  ["fantasy_lab", "Other", "DJI 로닌SC Pro 짐벌", 1, false, "판타지랩 조교 문의"],
  ["fantasy_lab", "Other", "호르스벤누 전동슬라이더", 1, false, "판타지랩 조교 문의"],
  ["fantasy_lab", "Lighting", "포맥스 LITEPAD BL2250", 8, false, "판타지랩 조교 문의"],
  ["fantasy_lab", "Lighting", "포맥스 LITEPAD LP260C", 3, false, "판타지랩 조교 문의"],
  ["fantasy_lab", "Other", "아토모스 쇼군7", 1, false, "프리뷰 모니터, 판타지랩 조교 문의"],
  ["fantasy_lab", "Lighting", "APUTURE 600X 바이컬러 조명", 2, false, "판타지랩 조교 문의"],
  ["fantasy_lab", "Lighting", "APUTURE LANTERN 26inch", 2, false, "조명 악세서리, 판타지랩 조교 문의"],
  ["fantasy_lab", "Lighting", "APUTURE Spotlight Mount", 2, false, "조명 악세서리, 판타지랩 조교 문의"],
  ["fantasy_lab", "Lighting", "APUTURE Barn doors F10", 2, false, "판타지랩 조교 문의"]
];

function nowIso() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}`;
}

const {
  assertApprovedStudentAccess,
  assertLoginAllowed,
  blockUntilForDuration,
  cleanMeta,
  cleanSessions,
  clearLoginFailures,
  getAuthSession,
  getAuthUser,
  hashPassword,
  publicAuditLog,
  publicSession,
  publicUser,
  randomHex,
  randomPassword,
  registerLoginFailure,
  requestMeta,
  requireAdmin,
  requireAdminWithoutSessionCleanup,
  requireApprovedStudent,
  requireUser,
  sessionDeviceLabel,
  userRecord,
  verifyPassword
} = createAuthSessionHelpers({ id, nowIso });

const {
  canCancelLectureApplication,
  hasNoticeListQuery,
  lectureApplicationCount,
  lectureDetail,
  lectureSummary,
  reportWithDetails,
  withLectureApplicationDetails
} = createReportsLecturesNoticesHelpers({ publicUser });

function normalizeStatusLabel(status) {
  const labels = {
    approval_pending: "승인 대기",
    approved: "승인 완료",
    rejected: "반려",
    blocked: "대여금지",
    pending_approval: "승인 대기",
    auto_confirmed: "자동 확정",
    cancelled: "취소",
    admin_cancelled: "관리자 취소",
    checked_out: "대여완료",
    returned: "반납완료",
    completed: "사용 완료",
    warning: "경고"
  };
  return labels[status] || status;
}

function maskPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 7) return phone || "";
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function coursePlanningForDb(db) {
  db.coursePlanning = normalizeCoursePlanning(db.coursePlanning);
  return db.coursePlanning;
}

function coursePlanningSemester(planning, semesterPlanId) {
  for (const annualPlan of planning.annualPlans || []) {
    const semesterPlan = (annualPlan.semesterPlans || []).find((item) => item.id === semesterPlanId);
    if (semesterPlan) return { annualPlan, semesterPlan };
  }
  return null;
}

function coursePlanningAnnualPlan(planning, planId) {
  return (planning.annualPlans || []).find((item) => item.id === planId) || null;
}

function normalizeCoursePlanningCourses(courses) {
  if (!Array.isArray(courses) || !courses.length) throw Object.assign(new Error("과목을 한 개 이상 등록하세요."), { status: 400 });
  const normalized = normalizeCoursePlanning({ courses }).courses;
  const ids = normalized.map((course) => course.id);
  if (new Set(ids).size !== ids.length) throw Object.assign(new Error("과목 ID가 중복되었습니다."), { status: 400 });
  const names = normalized.map((course) => course.name);
  if (new Set(names).size !== names.length) throw Object.assign(new Error("같은 과목명이 중복되었습니다."), { status: 400 });
  const fieldPractice4 = normalized.find((course) => course.name === "현장실습4");
  if (fieldPractice4 && (
    fieldPractice4.targetYears.length !== 1 || fieldPractice4.targetYears[0] !== 4 ||
    fieldPractice4.allowedTerms.length !== 1 || fieldPractice4.allowedTerms[0] !== "fall" ||
    fieldPractice4.studentCredit !== 15 || fieldPractice4.operatingCredit !== 0 || fieldPractice4.facultyRecognizedCredit !== 3
  )) {
    throw Object.assign(new Error("현장실습4는 4학년 2학기, 학생 15·운영 0·교수인정 3학점으로만 저장할 수 있습니다."), { status: 400 });
  }
  return normalized;
}

function coursePlanningSurveySnapshot(planning, semesterPlan, targetStudentYears = []) {
  const targetYears = new Set((targetStudentYears.length ? targetStudentYears : semesterPlan.targetYears || []).map(Number));
  return (planning.courses || [])
    .filter((course) => course.active !== false && course.isSurveyEligible !== false && (course.allowedTerms || []).includes(semesterPlan.term))
    .filter((course) => !targetYears.size || (course.targetYears || []).some((year) => targetYears.has(Number(year))))
    .map((course) => ({
      id: course.id,
      courseCode: course.courseCode || "",
      name: course.name,
      targetYears: course.targetYears || [],
      allowedTerms: course.allowedTerms || [],
      studentCredit: Number(course.studentCredit || 0)
    }));
}

function courseDemandByCourseId(planning, planId, db) {
  const scores = {};
  const semesterPlanIds = new Set((coursePlanningAnnualPlan(planning, planId)?.semesterPlans || []).map((item) => item.id));
  for (const survey of planning.surveys || []) {
    if (!semesterPlanIds.has(survey.semesterPlanId)) continue;
    const eligibleStudentCount = db.users.filter((user) => user.role === "student" && user.approvalStatus === "approved" && (survey.eligibleCurrentYears || []).map(Number).includes(coursePlanningStudentYear(user))).length;
    const summary = summarizeSurvey({ survey, responses: planning.responses.filter((response) => response.surveyId === survey.id), eligibleStudentCount });
    for (const course of summary.courses) scores[course.courseId] = Number(scores[course.courseId] || 0) + course.demandScore;
  }
  return scores;
}

function coursePlanningAuditDetail(planning) {
  return {
    curriculumVersionCount: planning.curriculumVersions.length,
    courseCount: planning.courses.length,
    annualPlanCount: planning.annualPlans.length,
    surveyCount: planning.surveys.length
  };
}

function coursePlanningStudentYear(user) {
  const raw = user?.studentYear ?? user?.year ?? user?.grade ?? user?.studentStatus ?? "";
  const year = Number(typeof raw === "string" ? raw.match(/\d+/)?.[0] : raw);
  return Number.isInteger(year) ? year : 0;
}

function coursePlanningDate(value, label = "날짜") {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) throw Object.assign(new Error(`${label}를 올바르게 입력하세요.`), { status: 400 });
  return date.toISOString();
}

export async function initialDb(adminPassword = "admin") {
  return {
    meta: { version: 1, createdAt: nowIso() },
    settings: defaultSettings,
    darkroomChemicals,
    users: [
      await userRecord({
        role: "admin",
        username: "admin",
        name: "admin",
        email: "admin@gju.local",
        studentStatus: "관리자",
        approvalStatus: "approved",
        password: adminPassword
      })
    ],
    sessions: [],
    equipment: equipmentHelpers.seedEquipment(),
    reservations: [],
    reports: [],
    lectures: [],
    lectureApplications: [],
    notices: [],
    warnings: [],
    slackLogs: [],
    auditLogs: [],
    importBatches: [],
    coursePlanning: createCoursePlanningSeed()
  };
}

function isValidDateKey(value) {
  const text = String(value || "");
  if (!DATE_KEY_RE.test(text)) return false;
  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function assertDateKey(value, label = "날짜") {
  if (!isValidDateKey(value)) {
    throw Object.assign(new Error(`${label}는 YYYY-MM-DD 형식으로 입력하세요.`), { status: 400 });
  }
}

function assertOptionalDateKey(value, label = "날짜") {
  if (value !== undefined && value !== null && value !== "") assertDateKey(value, label);
}

function isValidTimeValue(value) {
  return TIME_VALUE_RE.test(String(value || ""));
}

function assertTimeValue(value, label = "시간") {
  if (!isValidTimeValue(value)) {
    throw Object.assign(new Error(`${label}는 HH:MM 형식으로 입력하세요.`), { status: 400 });
  }
}

function sanitizeHttpUrl(value, label = "링크") {
  const text = String(value || "").trim();
  if (!text) return "";
  let url;
  try {
    url = new URL(text);
  } catch {
    throw Object.assign(new Error(`${label}는 http 또는 https URL만 입력하세요.`), { status: 400 });
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw Object.assign(new Error(`${label}는 http 또는 https URL만 입력하세요.`), { status: 400 });
  }
  return url.toString();
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw Object.assign(new Error(`${label} 값이 올바르지 않습니다.`), { status: 400 });
  }
}

const {
  sanitizeBlockedSchedule,
  sanitizeStringList,
  sanitizeSettingsPatch
} = createSettingsHelpers({
  assertPlainObject,
  assertDateKey,
  assertOptionalDateKey,
  assertTimeValue,
  sanitizeHttpUrl,
  id,
  nowIso
});

function reservationTitle(type) {
  return { equipment: "기자재", studio: "스튜디오", darkroom: "암실", print: "출력실" }[type] || type;
}

function reservationStatusForType(type) {
  return type === "equipment" ? "pending_approval" : "auto_confirmed";
}

function normalizeEquipmentReservationStatus(status) {
  if (status === "returned" || status === "completed") return "returned";
  if (status === "cancelled" || status === "admin_cancelled") return "cancelled";
  if (status === "auto_confirmed") return "approved";
  return EQUIPMENT_RESERVATION_STATUSES.has(status) ? status : "pending_approval";
}

function normalizeReservationStatus(reservation) {
  if (reservation?.type === "equipment") {
    const nextStatus = normalizeEquipmentReservationStatus(reservation.status);
    const changed = reservation.status !== nextStatus;
    reservation.status = nextStatus;
    return changed;
  }
  return false;
}

function isOperationalReservation(reservation) {
  return !RESERVATION_CANCELLATION_TERMINAL_STATUSES.has(reservation?.status);
}

function isStudioReportSubmitted(db, reservation) {
  return reservation?.type === "studio" &&
    (db.reports || []).some((report) => report.type === "studio" && report.reservationId === reservation.id);
}

function isStudioReportDue(db, reservation, today = todayKeySeoul()) {
  const reservedDate = String(reservation?.fields?.reservedDate || "");
  return reservation?.type === "studio" &&
    !isStudioReportSubmitted(db, reservation) &&
    !REPORT_INELIGIBLE_RESERVATION_STATUSES.has(reservation?.status) &&
    Boolean(reservedDate) &&
    reservedDate <= today;
}

function studioSpaces(fields = {}) {
  if (Array.isArray(fields.studioSpaces) && fields.studioSpaces.length) return fields.studioSpaces;
  return fields.studioSpace ? [fields.studioSpace] : [];
}

const {
  formatSlackMessage,
  postSlack
} = createNotificationHelpers({
  id,
  maskPhone,
  normalizeStatusLabel,
  reservationTitle,
  studioSpaces,
  nowIso
});

function addDaysToDateKey(key, days) {
  if (!isValidDateKey(key)) return "";
  const date = new Date(`${key}T00:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const equipmentHelpers = createEquipmentHelpers({
  seedEquipmentGroups,
  defaultSettings,
  id,
  nowIso,
  addDaysToDateKey
});

const {
  applyEquipmentPatch,
  codeBase,
  equipmentAuditDetail,
  equipmentReservationRange,
  equipmentReservableForStatus,
  isCameraBagEquipment,
  isHighValueEquipment,
  normalizeEquipmentStatus,
  printDateOutsideUploadWindow
} = equipmentHelpers;

const {
  reservationDateClosed,
  reservationDateClosedMessage,
  todayKeySeoul,
  validateReservation
} = createReservationValidationHelpers({
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
});

const {
  publicReservationSummary,
  withReservationDetails
} = createReservationViewHelpers({ publicUser, reservationTiming });

const {
  hasListQuery,
  adminReservationList,
  adminReportList,
  adminUserList,
  adminLectureList,
  adminNoticeList,
  filterAdminReservations,
  filterAdminReports,
  filterAdminLectures,
  filterAdminNotices
} = createAdminListHelpers({
  withReservationDetails,
  reportWithDetails,
  publicUser,
  lectureDetail,
  isStudioReportDue
});

function noticeWithActive(notice) {
  const active = typeof notice?.active === "boolean" ? notice.active : notice?.status === "published";
  return { ...notice, active, status: active ? "published" : "draft" };
}

function audit(db, actor, action, targetId, detail = {}) {
  db.auditLogs.push({ id: id("audit"), actorId: actor ? actor.id : null, action, targetId, detail, createdAt: nowIso() });
}

function deleteUserAccount(db, user, actor, action = "user.deleted", detail = {}) {
  if (!user) return null;
  if (user.role === "admin") {
    throw Object.assign(new Error("관리자 계정은 삭제할 수 없습니다."), { status: 400 });
  }
  const reservationIds = new Set((db.reservations || []).filter((item) => item.userId === user.id).map((item) => item.id));
  const summary = {
    id: user.id,
    removedReservations: reservationIds.size,
    removedReports: (db.reports || []).filter((item) => item.userId === user.id || reservationIds.has(item.reservationId)).length,
    removedLectureApplications: (db.lectureApplications || []).filter((item) => item.userId === user.id).length,
    removedWarnings: (db.warnings || []).filter((item) => item.userId === user.id).length,
    revokedSessions: (db.sessions || []).filter((item) => item.userId === user.id).length
  };
  db.reservations = (db.reservations || []).filter((item) => item.userId !== user.id);
  db.reports = (db.reports || []).filter((item) => item.userId !== user.id && !reservationIds.has(item.reservationId));
  db.warnings = (db.warnings || []).filter((item) => item.userId !== user.id);
  db.lectureApplications = (db.lectureApplications || []).filter((item) => item.userId !== user.id);
  db.sessions = (db.sessions || []).filter((item) => item.userId !== user.id);
  db.users = (db.users || []).filter((item) => item.id !== user.id);
  audit(db, actor, action, user.id, {
    ...summary,
    ...detail
  });
  return summary;
}

export function normalizeDb(db) {
  db.coursePlanning = normalizeCoursePlanning(db.coursePlanning);
  db.settings = { ...defaultSettings, ...(db.settings || {}) };
  if (db.settings.appName === "GJU-reserve") {
    db.settings.appName = defaultSettings.appName;
  }
  if (db.settings.googleDriveUrl) {
    try {
      db.settings.googleDriveUrl = sanitizeHttpUrl(db.settings.googleDriveUrl, "출력실 구글 드라이브 URL");
    } catch {
      db.settings.googleDriveUrl = "";
    }
  }
  if (LEGACY_PUBLIC_URLS.includes(db.settings.studentUrl)) {
    db.settings.studentUrl = PRODUCTION_STUDENT_URL;
  }
  if (LEGACY_PUBLIC_URLS.includes(db.settings.adminUrl)) {
    db.settings.adminUrl = db.settings.studentUrl || PRODUCTION_STUDENT_URL;
  }
  db.darkroomChemicals = db.darkroomChemicals || darkroomChemicals;
  db.importBatches = db.importBatches || [];
  db.reservations = db.reservations || [];
  db.reports = db.reports || [];
  db.lectures = db.lectures || [];
  db.lectureApplications = db.lectureApplications || [];
  db.slackLogs = db.slackLogs || [];
  db.auditLogs = db.auditLogs || [];
  db.sessions = db.sessions || [];
  db.warnings = db.warnings || [];
  db.users = db.users || [];
  for (const user of db.users) {
    user.preferences = user.preferences && typeof user.preferences === "object" && !Array.isArray(user.preferences)
      ? user.preferences
      : {};
    if (!Array.isArray(user.preferences.favoriteEquipmentGroups)) user.preferences.favoriteEquipmentGroups = [];
  }
  for (const reservation of db.reservations) normalizeReservationStatus(reservation);
  const seededTaUserIds = db.users
    .filter((user) => user.role === "admin" && user.username === "ta" && user.email === "ta@gju.local")
    .map((user) => user.id);
  if (seededTaUserIds.length) {
    db.users = db.users.filter((user) => !seededTaUserIds.includes(user.id));
    db.sessions = db.sessions.filter((session) => !seededTaUserIds.includes(session.userId));
  }
  db.equipment = db.equipment || [];
  for (const item of db.equipment) {
    item.status = normalizeEquipmentStatus(item.status);
    if (!equipmentReservableForStatus(item.status)) {
      item.reservable = false;
      item.inquiryOnly = true;
    }
    if (item.source === "fantasy_lab" || item.facility === "판타지랩") {
      item.source = "fantasy_lab";
      item.facility = "판타지랩";
      item.reservable = false;
      item.inquiryOnly = true;
      if (!item.notes) item.notes = FANTASY_LAB_INQUIRY_NOTE;
    }
  }
  return db;
}

export function capLogs(db) {
  if (Array.isArray(db.auditLogs) && db.auditLogs.length > 1000) db.auditLogs = db.auditLogs.slice(-1000);
  if (Array.isArray(db.slackLogs) && db.slackLogs.length > 500) db.slackLogs = db.slackLogs.slice(-500);
  return db;
}

const {
  cleanupExpiredData: cleanupExpiredDataImpl,
  closeSemesterData: closeSemesterDataImpl
} = createMaintenanceHelpers({
  normalizeDb,
  capLogs,
  id,
  reservationRetentionDays: RESERVATION_RETENTION_DAYS,
  reportHtmlRetentionDays: REPORT_HTML_RETENTION_DAYS
});

export const cleanupExpiredData = cleanupExpiredDataImpl;
export const closeSemesterData = closeSemesterDataImpl;

export function adminExportData(db) {
  normalizeDb(db);
  const exportedCoursePlanning = { ...db.coursePlanning };
  delete exportedCoursePlanning.responses;
  return {
    exportedAt: nowIso(),
    settings: db.settings,
    darkroomChemicals: db.darkroomChemicals,
    equipment: db.equipment,
    users: db.users.map(publicUser),
    sessions: db.sessions.map((session) => publicSession(db, session)).filter(Boolean),
    reservations: db.reservations.map((reservation) => withReservationDetails(db, reservation)),
    reports: db.reports.map((report) => ({
      ...report,
      reservation: db.reservations.find((reservation) => reservation.id === report.reservationId) || null,
      user: publicUser(db.users.find((user) => user.id === report.userId))
    })),
    notices: db.notices,
    lectures: db.lectures.map((lecture) => lectureDetail(db, lecture)),
    lectureApplications: db.lectureApplications,
    warnings: db.warnings,
    auditLogs: db.auditLogs,
    slackLogs: db.slackLogs,
    importBatches: db.importBatches,
    coursePlanning: exportedCoursePlanning
  };
}

// Adapter contract:
//   ctx = { method, pathname, searchParams, authorization, readText, db, saveDb, slackWebhook }
//   - readText(): Promise<string> resolving to the raw request body
//   - saveDb(): Promise that persists ctx.db
//   - slackWebhook: string | undefined
// Always resolves to { status, body }; thrown errors become a fail() result.
export async function handleApiRequest(ctx) {
  const { method, authorization = "", readText, db, slackWebhook } = ctx;
  const { pathname, searchParams } = requestPath(ctx);
  const saveDb = ctx.saveDb;
  const meta = requestMeta(ctx);

  try {
      if (routeKey(method, pathname) === "GET /api/bootstrap") {
        const user = getAuthUser(authorization, db);
        return ok({
          settings: db.settings,
          darkroomChemicals: db.darkroomChemicals,
          equipment: db.equipment.filter((item) => item.active),
          notices: db.notices.map(noticeWithActive).filter((notice) => notice.active),
          reservations: user
            ? db.reservations
              .filter(isOperationalReservation)
              .map((reservation) => publicReservationSummary(db, reservation))
            : []
        });
      }

      if (routeKey(method, pathname) === "GET /api/me") {
        const user = getAuthUser(authorization, db);
        return ok({ user: publicUser(user) });
      }

      if (routeKey(method, pathname) === "PATCH /api/me/password") {
        const user = requireUser(authorization, db);
        const body = await parseBody(readText);
        assertRequired(body, ["currentPassword", "newPassword"]);
        if (!(await verifyPassword(body.currentPassword, user.passwordHash))) {
          throw Object.assign(new Error("현재 비밀번호가 올바르지 않습니다."), { status: 401 });
        }
        if (String(body.newPassword).length < PASSWORD_MIN_LENGTH) {
          throw Object.assign(new Error(`새 비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상 입력하세요.`), { status: 400 });
        }
        user.passwordHash = await hashPassword(body.newPassword);
        user.updatedAt = nowIso();
        const revokedSessions = db.sessions.filter((session) => session.userId === user.id).length;
        db.sessions = db.sessions.filter((session) => session.userId !== user.id);
        audit(db, user, "user.password_changed", user.id, { ...meta, revokedSessions });
        await saveDb();
        return ok({ user: publicUser(user) });
      }

      if (routeKey(method, pathname) === "PATCH /api/me") {
        const user = requireUser(authorization, db);
        const body = await parseBody(readText);
        const next = {};
        if (body.name !== undefined) next.name = String(body.name).trim();
        if (body.phone !== undefined) next.phone = String(body.phone).trim();
        if (body.grade !== undefined) next.grade = String(body.grade).trim();
        if (body.email !== undefined) {
          const email = String(body.email).trim();
          if (email && db.users.some((item) => item.id !== user.id && item.email === email)) {
            throw Object.assign(new Error("이미 사용 중인 이메일입니다."), { status: 409 });
          }
          next.email = email;
        }
        if (next.name === "") throw Object.assign(new Error("이름을 입력하세요."), { status: 400 });
        Object.assign(user, next, { updatedAt: nowIso() });
        audit(db, user, "user.profile_updated", user.id, { fields: Object.keys(next) });
        await saveDb();
        return ok({ user: publicUser(user) });
      }

      if (routeKey(method, pathname) === "DELETE /api/me") {
        const user = requireUser(authorization, db);
        const body = await parseBody(readText);
        if (user.role === "admin") {
          throw Object.assign(new Error("관리자 계정은 이 화면에서 삭제할 수 없습니다."), { status: 400 });
        }
        assertRequired(body, ["currentPassword", "confirmText"]);
        if (!(await verifyPassword(body.currentPassword, user.passwordHash))) {
          throw Object.assign(new Error("현재 비밀번호가 올바르지 않습니다."), { status: 401 });
        }
        if (String(body.confirmText).trim() !== "계정 삭제") {
          throw Object.assign(new Error("확인 문구를 정확히 입력하세요."), { status: 400 });
        }
        const summary = deleteUserAccount(db, user, user, "user.account_deleted", meta);
        await saveDb();
        return ok(summary);
      }

      if (routeKey(method, pathname) === "POST /api/auth/signup") {
        const body = await parseBody(readText);
        assertRequired(body, ["name", "studentStatus", "phone", "email", "password"]);
        if (String(body.password).length < PASSWORD_MIN_LENGTH) {
          throw Object.assign(new Error(`비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상 입력하세요.`), { status: 400 });
        }
        if (db.users.some((user) => user.email === body.email)) throw Object.assign(new Error("이미 가입된 이메일입니다."), { status: 409 });
        if (body.studentId && db.users.some((user) => user.studentId === body.studentId)) throw Object.assign(new Error("이미 가입된 학번입니다."), { status: 409 });
        const user = await userRecord({
          name: body.name,
          email: body.email,
          phone: body.phone,
          studentId: body.studentId || "",
          grade: body.grade || "",
          studentStatus: body.studentStatus,
          approvalStatus: "approval_pending",
          password: body.password
        });
        db.users.push(user);
        await postSlack(slackWebhook, db, "student_signup", user);
        await saveDb();
        return ok({ user: publicUser(user) });
      }

      if (routeKey(method, pathname) === "POST /api/auth/login") {
        const body = await parseBody(readText);
        assertRequired(body, ["loginId", "password"]);
        try {
          assertLoginAllowed(body.loginId);
        } catch (error) {
          audit(db, null, "auth.login_blocked", "auth", { ...meta, loginId: cleanMeta(body.loginId, 120), reason: "too_many_attempts" });
          await saveDb();
          throw error;
        }
        const user = db.users.find((item) => {
          if (body.loginId === "admin" && item.username === "admin") return true;
          return item.email === body.loginId || item.studentId === body.loginId || item.username === body.loginId;
        });
        if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
          registerLoginFailure(body.loginId);
          audit(db, user || null, "auth.login_failed", user?.id || "auth", { ...meta, loginId: cleanMeta(body.loginId, 120), reason: "invalid_credentials" });
          await saveDb();
          throw Object.assign(new Error("아이디 또는 비밀번호가 올바르지 않습니다."), { status: 401 });
        }
        clearLoginFailures(body.loginId);
        const token = randomHex(32);
        const session = {
          id: id("session"),
          token,
          userId: user.id,
          ip: meta.ip,
          userAgent: meta.userAgent,
          device: sessionDeviceLabel(meta.userAgent),
          expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
          createdAt: nowIso(),
          lastSeenAt: nowIso()
        };
        db.sessions.push(session);
        audit(db, user, "auth.login_success", session.id, { ...meta, device: session.device });
        await saveDb();
        return ok({ token, user: publicUser(user) });
      }

      if (routeKey(method, pathname) === "POST /api/auth/logout") {
        const body = await parseBody(readText);
        const session = db.sessions.find((item) => item.token === body.token);
        const user = session ? db.users.find((item) => item.id === session.userId) : null;
        db.sessions = db.sessions.filter((item) => item.token !== body.token);
        if (session) audit(db, user || null, "auth.logout", session.id, { ...meta, ip: session.ip || meta.ip, device: session.device || sessionDeviceLabel(session.userAgent || meta.userAgent) });
        await saveDb();
        return ok();
      }

      if (routeKey(method, pathname) === "GET /api/reservations/my") {
        const user = requireUser(authorization, db);
        const reservations = db.reservations
          .filter((item) => item.userId === user.id)
          .map((item) => withReservationDetails(db, item));
        const lectureApplications = (db.lectureApplications || [])
          .filter((item) => item.userId === user.id)
          .map((item) => withLectureApplicationDetails(db, item));
        return ok([...reservations, ...lectureApplications]);
      }

      if (routeKey(method, pathname) === "GET /api/me/reservation-shortcuts") {
        const user = requireApprovedStudent(authorization, db);
        return ok({
          favoriteGroups: favoriteGroupsForUser(user, db.equipment),
          recentReservations: reservationShortcuts({ userId: user.id, reservations: db.reservations, equipment: db.equipment })
        });
      }

      if (routeKey(method, pathname) === "PUT /api/me/favorite-equipment-groups") {
        const user = requireApprovedStudent(authorization, db);
        const body = await parseBody(readText);
        const groups = validateFavoriteGroups(body.groups, db.equipment, { createId: id });
        user.preferences = { ...(user.preferences || {}), favoriteEquipmentGroups: groups };
        user.updatedAt = nowIso();
        audit(db, user, "favorite_groups.updated", user.id, { groupCount: groups.length });
        await saveDb();
        return ok({ favoriteGroups: favoriteGroupsForUser(user, db.equipment) });
      }

      if (routeKey(method, pathname) === "GET /api/me/course-demand-surveys") {
        const user = requireApprovedStudent(authorization, db);
        const planning = coursePlanningForDb(db);
        const surveys = planning.surveys
          .map((survey) => publicSurveyForStudent({
            survey,
            student: user,
            response: planning.responses.find((response) => response.surveyId === survey.id && response.studentId === user.id),
            now: new Date()
          }))
          .filter(Boolean)
          .sort((left, right) => String(right.closesAt || "").localeCompare(String(left.closesAt || "")));
        return ok(surveys);
      }

      const courseDemandResponseMatch = pathname.match(/^\/api\/me\/course-demand-surveys\/([^/]+)\/response$/);
      if (method === "PUT" && courseDemandResponseMatch) {
        const user = requireApprovedStudent(authorization, db);
        const planning = coursePlanningForDb(db);
        const survey = planning.surveys.find((item) => item.id === courseDemandResponseMatch[1]);
        if (!survey) throw Object.assign(new Error("수요조사를 찾을 수 없습니다."), { status: 404 });
        const body = await parseBody(readText);
        const rankings = validateCourseDemandResponse({ survey, student: user, rankings: body.rankings, now: new Date() });
        const existing = planning.responses.find((response) => response.surveyId === survey.id && response.studentId === user.id);
        const response = existing || { id: id("course_response"), surveyId: survey.id, studentId: user.id };
        response.rankings = rankings;
        response.submittedAt = nowIso();
        if (!existing) planning.responses.push(response);
        await saveDb();
        return ok(publicSurveyForStudent({ survey, student: user, response, now: new Date() }));
      }

      if (routeKey(method, pathname) === "GET /api/lectures") {
        const user = requireUser(authorization, db);
        const lectures = db.lectures
          .map((lecture) => lectureSummary(db, lecture, user))
          .sort((a, b) => String(a.lectureDate || "").localeCompare(String(b.lectureDate || "")));
        return ok(lectures);
      }

      const lectureApplyMatch = pathname.match(/^\/api\/lectures\/([^/]+)\/apply$/);
      if (method === "POST" && lectureApplyMatch) {
        const user = requireApprovedStudent(authorization, db);
        const lecture = db.lectures.find((item) => item.id === lectureApplyMatch[1]);
        if (!lecture) throw Object.assign(new Error("특강을 찾을 수 없습니다."), { status: 404 });
        if (lecture.status !== "모집중") throw Object.assign(new Error("모집중인 특강만 신청할 수 있습니다."), { status: 400 });
        if (db.lectureApplications.some((item) => item.lectureId === lecture.id && item.userId === user.id)) {
          throw Object.assign(new Error("이미 신청한 특강입니다."), { status: 409 });
        }
        const capacity = Number(lecture.capacity || 0);
        if (capacity > 0 && lectureApplicationCount(db, lecture) >= capacity) {
          throw Object.assign(new Error("모집 인원이 마감되었습니다."), { status: 409 });
        }
        const application = {
          id: id("lecture_app"),
          lectureId: lecture.id,
          userId: user.id,
          userName: user.name,
          studentId: user.studentId || "",
          studentStatus: user.studentStatus || "",
          phone: user.phone || "",
          email: user.email || "",
          appliedAt: nowIso()
        };
        db.lectureApplications.push(application);
        audit(db, user, "lecture.applied", lecture.id, { applicationId: application.id });
        await postSlack(slackWebhook, db, "lecture_apply", `[비교과 특강 신청]\n특강: ${lecture.title}\n일시: ${lecture.lectureDate} ${lecture.time || ""}\n신청자: ${user.name} / ${maskPhone(user.phone)}\n신분: ${user.studentStatus || "-"}`);
        await saveDb();
        return ok(lectureSummary(db, lecture, user));
      }

      if (method === "DELETE" && lectureApplyMatch) {
        const user = requireApprovedStudent(authorization, db);
        const lecture = db.lectures.find((item) => item.id === lectureApplyMatch[1]);
        if (!lecture) throw Object.assign(new Error("특강을 찾을 수 없습니다."), { status: 404 });
        const application = (db.lectureApplications || []).find((item) => item.lectureId === lecture.id && item.userId === user.id);
        if (!application) throw Object.assign(new Error("신청 내역이 없습니다."), { status: 404 });
        if (!canCancelLectureApplication(lecture)) {
          throw Object.assign(new Error("특강 시작 6시간 전부터는 신청을 취소할 수 없습니다."), { status: 400 });
        }
        db.lectureApplications = (db.lectureApplications || []).filter((item) => item.id !== application.id);
        audit(db, user, "lecture.cancelled", lecture.id, { applicationId: application.id });
        await saveDb();
        return ok(lectureSummary(db, lecture, user));
      }

      if (routeKey(method, pathname) === "POST /api/reservations/recommendations") {
        requireApprovedStudent(authorization, db);
        const body = await parseBody(readText);
        assertRequired(body, ["type", "fields"]);
        const sourceFields = { ...(body.fields || {}) };
        try {
          validateReservation(db, body.type, { ...sourceFields });
          return ok({ alternatives: [] });
        } catch {
          return ok({
            alternatives: findReservationRecommendations({
              db,
              type: body.type,
              fields: sourceFields,
              validateCandidate: (candidate) => validateReservation(db, body.type, candidate),
              now: new Date()
            })
          });
        }
      }

      if (routeKey(method, pathname) === "POST /api/reservations") {
        const user = requireApprovedStudent(authorization, db);
        const body = await parseBody(readText);
        assertRequired(body, ["type", "fields"]);
        validateReservation(db, body.type, body.fields);
        const status = reservationStatusForType(body.type);
        const reservation = {
          id: id("res"),
          type: body.type,
          userId: user.id,
          status,
          fields: { ...body.fields, studentStatus: user.studentStatus, phone: body.fields.phone || user.phone },
          history: [{ at: nowIso(), actorId: user.id, action: "created", status }],
          createdAt: nowIso(),
          updatedAt: nowIso()
        };
        db.reservations.push(reservation);
        audit(db, user, "reservation.created", reservation.id, { type: reservation.type });
        await postSlack(slackWebhook, db, "reservation_created", reservation);
        await saveDb();
        return ok(withReservationDetails(db, reservation));
      }

      const reservationCancelMatch = pathname.match(/^\/api\/reservations\/([^/]+)\/cancel$/);
      if (method === "POST" && reservationCancelMatch) {
        const user = requireUser(authorization, db);
        const reservation = db.reservations.find((item) => item.id === reservationCancelMatch[1]);
        if (!reservation) throw Object.assign(new Error("예약을 찾을 수 없습니다."), { status: 404 });
        if (user.role !== "admin" && reservation.userId !== user.id) throw Object.assign(new Error("본인의 예약만 취소할 수 있습니다."), { status: 403 });
        if (RESERVATION_CANCELLATION_TERMINAL_STATUSES.has(reservation.status)) {
          throw Object.assign(new Error("이미 종료되었거나 취소된 예약은 다시 취소할 수 없습니다."), { status: 409 });
        }
        const body = await parseBody(readText);
        reservation.status = reservation.type === "equipment" ? "cancelled" : (user.role === "admin" ? "admin_cancelled" : "cancelled");
        reservation.cancelReason = body.reason || "";
        reservation.updatedAt = nowIso();
        reservation.history.push({ at: nowIso(), actorId: user.id, action: "cancelled", reason: body.reason || "" });
        audit(db, user, "reservation.cancelled", reservation.id, { reason: body.reason || "" });
        await postSlack(slackWebhook, db, "reservation_cancelled", reservation);
        await saveDb();
        return ok(withReservationDetails(db, reservation));
      }

      const reservationPatchMatch = pathname.match(/^\/api\/reservations\/([^/]+)$/);
      if (method === "PATCH" && reservationPatchMatch) {
        const user = requireUser(authorization, db);
        const reservation = db.reservations.find((item) => item.id === reservationPatchMatch[1]);
        if (!reservation) throw Object.assign(new Error("예약을 찾을 수 없습니다."), { status: 404 });
        if (user.role !== "admin") {
          if (reservation.userId !== user.id) throw Object.assign(new Error("본인의 예약만 수정할 수 있습니다."), { status: 403 });
          assertApprovedStudentAccess(user);
        }
        const body = await parseBody(readText);
        const nextFields = { ...reservation.fields, ...(body.fields || {}) };
        validateReservation(db, reservation.type, nextFields, reservation.id);
        reservation.fields = nextFields;
        reservation.updatedAt = nowIso();
        reservation.history.push({ at: nowIso(), actorId: user.id, action: "updated" });
        audit(db, user, "reservation.updated", reservation.id);
        await postSlack(slackWebhook, db, "reservation_updated", reservation);
        await saveDb();
        return ok(withReservationDetails(db, reservation));
      }

      if (routeKey(method, pathname) === "POST /api/reports/studio") {
        const user = requireApprovedStudent(authorization, db);
        const body = await parseBody(readText);
        assertRequired(body, ["reservationId", "actualTime", "participants", "cleanupConfirmed"]);
        const reservation = db.reservations.find((item) => item.id === body.reservationId && item.type === "studio");
        if (!reservation) throw Object.assign(new Error("스튜디오 예약을 찾을 수 없습니다."), { status: 404 });
        if (user.role !== "admin" && reservation.userId !== user.id) throw Object.assign(new Error("본인의 스튜디오 예약 보고서만 제출할 수 있습니다."), { status: 403 });
        if (db.reports.some((item) => item.reservationId === reservation.id && item.type === "studio")) {
          throw Object.assign(new Error("이미 제출된 스튜디오 보고서입니다."), { status: 409 });
        }
        if (["cancelled", "admin_cancelled", "rejected"].includes(reservation.status)) {
          throw Object.assign(new Error("취소되었거나 반려된 스튜디오 예약에는 보고서를 제출할 수 없습니다."), { status: 400 });
        }
        const resultPhotoUrl = sanitizeHttpUrl(body.resultPhotoUrl || "", "결과 사진 링크");
        if (resultPhotoUrl.length > 500) {
          throw Object.assign(new Error("결과 사진 링크는 500자 이하로 입력하세요."), { status: 400 });
        }
        const report = {
          id: id("report"),
          type: "studio",
          reservationId: reservation.id,
          userId: user.id,
          fields: {
            ...body,
            resultPhotoUrl
          },
          htmlSnapshot: `<article><h1>스튜디오 보고서</h1><p>예약: ${escapeHtml(reservation.id)}</p><p>사용 시간: ${escapeHtml(body.actualTime)}</p><p>인원: ${escapeHtml(body.participants)}</p><p>결과 사진: ${escapeHtml(resultPhotoUrl || "-")}</p><p>파손/이상: ${escapeHtml(body.damageFound ? body.damageDescription || "있음" : "없음")}</p></article>`,
          submittedAt: nowIso(),
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 183).toISOString()
        };
        db.reports.push(report);
        reservation.fields.reportStatus = "submitted";
        reservation.updatedAt = nowIso();
        reservation.history.push({ at: nowIso(), actorId: user.id, action: "studio_report_submitted", reportId: report.id });
        audit(db, user, "studio_report.created", report.id, { reservationId: reservation.id });
        await postSlack(slackWebhook, db, "studio_report", reservation);
        await saveDb();
        return ok(report);
      }

      if (routeKey(method, pathname) === "GET /api/admin/course-planning") {
        requireAdmin(authorization, db);
        const planning = coursePlanningForDb(db);
        const annualPlans = planning.annualPlans.map((plan) => ({
          ...plan,
          validation: validateAnnualPlan({ plan, courses: planning.courses, history: planning.offeringHistory })
        }));
        const surveys = planning.surveys.map((survey) => {
          const eligibleStudentCount = db.users.filter((user) => user.role === "student" && user.approvalStatus === "approved" && (survey.eligibleCurrentYears || []).map(Number).includes(coursePlanningStudentYear(user))).length;
          return {
            id: survey.id,
            title: survey.title || "교과 수요조사",
            academicYear: survey.academicYear,
            term: survey.term,
            ...(survey.semesterPlanId ? { semesterPlanId: survey.semesterPlanId } : {}),
            eligibleCurrentYears: survey.eligibleCurrentYears || [],
            targetStudentYears: survey.targetStudentYears || [],
            opensAt: survey.opensAt,
            closesAt: survey.closesAt,
            status: survey.status,
            catalogCount: (survey.catalogSnapshot || []).length,
            catalogSnapshot: survey.catalogSnapshot || [],
            summary: summarizeSurvey({ survey, responses: planning.responses.filter((response) => response.surveyId === survey.id), eligibleStudentCount })
          };
        });
        return ok({ curriculumVersions: planning.curriculumVersions, courses: planning.courses, annualPlans, surveys });
      }

      if (routeKey(method, pathname) === "GET /api/admin/curriculum-versions") {
        requireAdmin(authorization, db);
        return ok(coursePlanningForDb(db).curriculumVersions);
      }

      if (routeKey(method, pathname) === "PUT /api/admin/curriculum-versions") {
        const admin = requireAdmin(authorization, db);
        const body = await parseBody(readText);
        if (!Array.isArray(body.curriculumVersions) || !body.curriculumVersions.length) throw Object.assign(new Error("교육과정 버전을 한 개 이상 등록하세요."), { status: 400 });
        const versions = body.curriculumVersions.map((version, index) => ({
          id: String(version.id || `curriculum_${version.academicYear || index + 1}`),
          academicYear: Number(version.academicYear),
          curriculumCreditLimit: Number(version.curriculumCreditLimit || 130),
          status: String(version.status || "draft")
        }));
        if (versions.some((version) => !Number.isInteger(version.academicYear) || version.curriculumCreditLimit !== 130)) {
          throw Object.assign(new Error("교육과정 편성학점은 130학점으로 저장해야 합니다."), { status: 400 });
        }
        const planning = coursePlanningForDb(db);
        planning.curriculumVersions = versions;
        audit(db, admin, "course_planning.curriculum_versions_updated", "course_planning", coursePlanningAuditDetail(planning));
        await saveDb();
        return ok(versions);
      }

      if (routeKey(method, pathname) === "GET /api/admin/courses") {
        requireAdmin(authorization, db);
        return ok(coursePlanningForDb(db).courses);
      }

      if (routeKey(method, pathname) === "PUT /api/admin/courses") {
        const admin = requireAdmin(authorization, db);
        const body = await parseBody(readText);
        const planning = coursePlanningForDb(db);
        planning.courses = normalizeCoursePlanningCourses(body.courses);
        audit(db, admin, "course_planning.courses_updated", "course_planning", coursePlanningAuditDetail(planning));
        await saveDb();
        return ok(planning.courses);
      }

      if (routeKey(method, pathname) === "GET /api/admin/annual-offering-plans") {
        requireAdmin(authorization, db);
        const planning = coursePlanningForDb(db);
        return ok(planning.annualPlans.map((plan) => ({ ...plan, validation: validateAnnualPlan({ plan, courses: planning.courses, history: planning.offeringHistory }) })));
      }

      if (routeKey(method, pathname) === "PUT /api/admin/annual-offering-plans") {
        const admin = requireAdmin(authorization, db);
        const body = await parseBody(readText);
        if (!Array.isArray(body.annualPlans)) throw Object.assign(new Error("연간 편성안 목록이 필요합니다."), { status: 400 });
        const planning = coursePlanningForDb(db);
        planning.annualPlans = body.annualPlans.map((plan, index) => ({
          id: String(plan.id || `annual_plan_${plan.academicYear || index + 1}`),
          academicYear: Number(plan.academicYear),
          operatingCreditLimit: Number(plan.operatingCreditLimit || 85),
          status: String(plan.status || "draft"),
          semesterPlans: Array.isArray(plan.semesterPlans) ? plan.semesterPlans.map((semesterPlan, semesterIndex) => ({
            id: String(semesterPlan.id || `${plan.id || "annual_plan"}_${semesterPlan.term || semesterIndex}`),
            term: String(semesterPlan.term || "spring"),
            targetYears: (semesterPlan.targetYears || []).map(Number).filter(Number.isInteger),
            optionalCreditTarget: semesterPlan.optionalCreditTarget === undefined ? null : Number(semesterPlan.optionalCreditTarget),
            offerings: Array.isArray(semesterPlan.offerings) ? semesterPlan.offerings.map((offering) => ({ courseId: String(offering.courseId || ""), source: String(offering.source || "manual"), overrideReason: String(offering.overrideReason || "") })) : []
          })) : []
        }));
        audit(db, admin, "course_planning.annual_plans_updated", "course_planning", coursePlanningAuditDetail(planning));
        await saveDb();
        return ok(planning.annualPlans);
      }

      if (routeKey(method, pathname) === "POST /api/admin/course-demand-surveys") {
        const admin = requireAdmin(authorization, db);
        const body = await parseBody(readText);
        const planning = coursePlanningForDb(db);
        const definition = validateCourseDemandSurveyDefinition({
          input: body,
          courses: planning.courses,
          existingSurveys: planning.surveys
        });
        const survey = {
          id: id("course_survey"),
          ...definition,
          createdAt: nowIso(),
          updatedAt: nowIso()
        };
        planning.surveys.push(survey);
        audit(db, admin, "course_demand.survey_created", survey.id, {
          academicYear: survey.academicYear,
          term: survey.term,
          eligibleCurrentYears: survey.eligibleCurrentYears,
          targetStudentYears: survey.targetStudentYears,
          catalogCount: survey.catalogSnapshot.length
        });
        await saveDb();
        return ok(survey);
      }

      const courseDemandSurveyMatch = pathname.match(/^\/api\/admin\/course-demand-surveys\/([^/]+)$/);
      if (method === "PUT" && courseDemandSurveyMatch) {
        const admin = requireAdmin(authorization, db);
        const body = await parseBody(readText);
        const planning = coursePlanningForDb(db);
        const survey = planning.surveys.find((item) => item.id === courseDemandSurveyMatch[1]);
        if (!survey) throw Object.assign(new Error("수요조사를 찾을 수 없습니다."), { status: 404 });
        if (survey.status === "closed") throw Object.assign(new Error("마감된 수요조사는 수정할 수 없습니다."), { status: 400 });
        if (survey.status === "open") {
          const allowedKeys = new Set(["status", "closesAt"]);
          if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
            throw Object.assign(new Error("공개된 수요조사의 후보와 대상 조건은 변경할 수 없습니다."), { status: 400 });
          }
          if (body.status !== undefined && body.status !== "closed") {
            throw Object.assign(new Error("공개된 수요조사는 마감만 할 수 있습니다."), { status: 400 });
          }
          if (body.closesAt !== undefined) {
            const closesAt = coursePlanningDate(body.closesAt, "설문 마감일");
            if (new Date(closesAt).getTime() <= new Date(survey.closesAt).getTime()) {
              throw Object.assign(new Error("설문 마감일은 기존 마감일보다 늦게 연장해야 합니다."), { status: 400 });
            }
            survey.closesAt = closesAt;
          }
          if (body.status === "closed") survey.status = "closed";
          survey.updatedAt = nowIso();
        } else {
          if (body.status === "closed") throw Object.assign(new Error("임시저장 설문은 공개 후 마감할 수 있습니다."), { status: 400 });
          const definition = validateCourseDemandSurveyDefinition({
            input: {
              ...survey,
              ...body,
              status: body.status || "draft",
              courseIds: body.courseIds || (survey.catalogSnapshot || []).map((course) => course.id)
            },
            courses: planning.courses,
            existingSurveys: planning.surveys,
            currentSurveyId: survey.id
          });
          Object.assign(survey, definition, { updatedAt: nowIso() });
        }
        audit(db, admin, "course_demand.survey_updated", survey.id, {
          status: survey.status,
          academicYear: survey.academicYear,
          term: survey.term,
          catalogCount: (survey.catalogSnapshot || []).length
        });
        await saveDb();
        return ok(survey);
      }

      const courseDemandSummaryMatch = pathname.match(/^\/api\/admin\/course-demand-surveys\/([^/]+)\/summary$/);
      if (method === "GET" && courseDemandSummaryMatch) {
        requireAdmin(authorization, db);
        const planning = coursePlanningForDb(db);
        const survey = planning.surveys.find((item) => item.id === courseDemandSummaryMatch[1]);
        if (!survey) throw Object.assign(new Error("수요조사를 찾을 수 없습니다."), { status: 404 });
        const eligibleStudentCount = db.users.filter((user) => user.role === "student" && user.approvalStatus === "approved" && (survey.eligibleCurrentYears || []).map(Number).includes(coursePlanningStudentYear(user))).length;
        return ok(summarizeSurvey({ survey, responses: planning.responses.filter((response) => response.surveyId === survey.id), eligibleStudentCount }));
      }

      const courseDemandRecommendationMatch = pathname.match(/^\/api\/admin\/annual-offering-plans\/([^/]+)\/recommendations$/);
      if (method === "POST" && courseDemandRecommendationMatch) {
        requireAdmin(authorization, db);
        const planning = coursePlanningForDb(db);
        const plan = coursePlanningAnnualPlan(planning, courseDemandRecommendationMatch[1]);
        if (!plan) throw Object.assign(new Error("연간 편성안을 찾을 수 없습니다."), { status: 404 });
        return ok(buildOfferingRecommendation({ plan, courses: planning.courses, history: planning.offeringHistory, demandByCourseId: courseDemandByCourseId(planning, plan.id, db) }));
      }

      const courseDemandPlanMatch = pathname.match(/^\/api\/admin\/annual-offering-plans\/([^/]+)$/);
      if (method === "PUT" && courseDemandPlanMatch) {
        const admin = requireAdmin(authorization, db);
        const body = await parseBody(readText);
        const planning = coursePlanningForDb(db);
        const existing = coursePlanningAnnualPlan(planning, courseDemandPlanMatch[1]);
        if (!existing) throw Object.assign(new Error("연간 편성안을 찾을 수 없습니다."), { status: 404 });
        const plan = { ...existing, ...(body.plan || {}), id: existing.id };
        const validation = validateAnnualPlan({ plan, courses: planning.courses, history: planning.offeringHistory });
        if (plan.status === "confirmed" && validation.errors.length) {
          throw Object.assign(new Error(validation.errors[0].message), { status: 400 });
        }
        const index = planning.annualPlans.findIndex((item) => item.id === existing.id);
        planning.annualPlans[index] = plan;
        if (plan.status === "confirmed") {
          const alreadyRecorded = new Set(planning.offeringHistory.filter((entry) => entry.academicYear === plan.academicYear && entry.status === "confirmed").map((entry) => `${entry.courseId}:${entry.term}`));
          for (const semesterPlan of plan.semesterPlans || []) {
            for (const offering of semesterPlan.offerings || []) {
              const key = `${offering.courseId}:${semesterPlan.term}`;
              if (alreadyRecorded.has(key)) continue;
              planning.offeringHistory.push({ id: id("course_history"), courseId: offering.courseId, academicYear: plan.academicYear, term: semesterPlan.term, status: "confirmed", confirmedAt: nowIso() });
              alreadyRecorded.add(key);
            }
          }
        }
        audit(db, admin, "course_planning.annual_plan_saved", plan.id, { status: plan.status, errors: validation.errors.length, warnings: validation.warnings.length });
        await saveDb();
        return ok({ ...plan, validation });
      }

      if (routeKey(method, pathname) === "GET /api/admin/summary") {
        requireAdmin(authorization, db);
        const detailedReservations = db.reservations.map((item) => withReservationDetails(db, item));
        const pendingUsers = db.users.filter((user) => user.role === "student" && user.approvalStatus === "approval_pending").length;
        const equipmentPendingApproval = db.reservations.filter((item) => item.type === "equipment" && item.status === "pending_approval").length;
        const equipmentApproved = db.reservations.filter((item) => item.type === "equipment" && item.status === "approved").length;
        const equipmentCheckedOut = db.reservations.filter((item) => item.type === "equipment" && item.status === "checked_out").length;
        const equipmentReturned = db.reservations.filter((item) => item.type === "equipment" && item.status === "returned").length;
        const equipmentCancelled = db.reservations.filter((item) => item.type === "equipment" && ["cancelled", "rejected"].includes(item.status)).length;
        const today = todayKeySeoul();
        const weekday = new Date(`${today}T00:00:00.000Z`).getUTCDay();
        const weekFrom = addDaysToDateKey(today, -(weekday === 0 ? 6 : weekday - 1));
        const weekTo = addDaysToDateKey(weekFrom, 6);
        const todaySchedule = detailedReservations
          .filter((item) => item.fields?.reservedDate === today && isOperationalReservation(item))
          .sort((left, right) => String(left.fields?.rentalTime || left.fields?.startTime || left.fields?.timeSlots?.[0] || "")
            .localeCompare(String(right.fields?.rentalTime || right.fields?.startTime || right.fields?.timeSlots?.[0] || "")));
        const seoulDateKey = (value) => {
          const date = new Date(value || "");
          if (Number.isNaN(date.getTime())) return "";
          return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(date);
        };
        const checkoutReturnQueue = detailedReservations
          .filter((item) => item.type === "equipment" && item.status === "checked_out")
          .flatMap((item) => {
            const entries = [];
            if (item.fields?.reservedDate === today) {
              entries.push({ ...item, queueAction: "checkout", queueAt: item.timing?.startAt || "" });
            }
            if (seoulDateKey(item.timing?.endAt) === today) {
              entries.push({ ...item, queueAction: "return", queueAt: item.timing?.endAt || "" });
            }
            return entries;
          })
          .sort((left, right) => String(left.queueAt || "").localeCompare(String(right.queueAt || "")));
        const todayReservations = todaySchedule.length;
        const missingReports = db.reservations.filter((item) => isStudioReportDue(db, item, today)).length;
        const activeEquipment = db.equipment.filter((item) => item.active !== false);
        const availableEquipment = activeEquipment.filter((item) => item.status === "가능").length;
        const repairEquipment = activeEquipment.filter((item) => item.status === "수리중").length;
        const cancelledReservations = db.reservations.filter((item) => ["cancelled", "admin_cancelled", "rejected"].includes(item.status)).length;
        const typeCounts = db.reservations.reduce((counts, item) => {
          const type = item.type || "unknown";
          counts[type] = Number(counts[type] || 0) + 1;
          return counts;
        }, {});
        const equipmentUse = new Map();
        for (const reservation of detailedReservations) {
          for (const item of reservation.equipmentItems || []) {
            const name = String(item.name || item.code || "").trim();
            if (name) equipmentUse.set(name, Number(equipmentUse.get(name) || 0) + 1);
          }
        }
        const popularEquipment = [...equipmentUse.entries()]
          .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "ko"))
          .slice(0, 5)
          .map(([name, count]) => ({ name, count }));
        const latestNotice = db.notices
          .map(noticeWithActive)
          .filter((notice) => notice.active)
          .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")))[0] || null;
        return ok({
          pendingUsers,
          pendingEquipment: equipmentPendingApproval,
          equipmentPendingApproval,
          equipmentApproved,
          equipmentCheckedOut,
          equipmentReturned,
          equipmentCancelled,
          todayReservations,
          missingReports,
          todaySchedule,
          checkoutReturnQueue,
          metrics: {
            weekReservations: db.reservations.filter((item) => {
              const reservedDate = String(item.fields?.reservedDate || "");
              return reservedDate >= weekFrom && reservedDate <= weekTo;
            }).length,
            activeEquipment: activeEquipment.length,
            availableEquipment,
            repairEquipment,
            equipmentAvailableRate: activeEquipment.length ? Math.round((availableEquipment / activeEquipment.length) * 100) : 0,
            cancelledReservations,
            reportQueueCount: db.reports.filter((report) => !["completed", "approved"].includes(report.status)).length,
            openLectures: db.lectures.filter((lecture) => lecture.status === "모집중").length,
            typeCounts,
            popularEquipment,
            latestNotice,
            insights: buildOperationsInsights({ reservations: detailedReservations, equipment: db.equipment, now: new Date() })
          }
        });
      }

      if (routeKey(method, pathname) === "GET /api/admin/export") {
        requireAdmin(authorization, db);
        return ok(adminExportData(db));
      }

      if (routeKey(method, pathname) === "POST /api/admin/maintenance/cleanup") {
        const admin = requireAdmin(authorization, db);
        const summary = cleanupExpiredData(db, new Date(), admin.id);
        if (summary.changed) await saveDb();
        return ok(summary);
      }

      if (routeKey(method, pathname) === "POST /api/admin/maintenance/semester-close") {
        const admin = requireAdminWithoutSessionCleanup(authorization, db);
        const body = await parseBody(readText);
        if (body.confirmText !== "학기 종료") {
          throw Object.assign(new Error("확인 문구가 일치하지 않습니다."), { status: 400 });
        }
        const snapshot = JSON.stringify(db);
        const summary = closeSemesterData(db, admin.id);
        try {
          await saveDb();
        } catch (error) {
          const restored = JSON.parse(snapshot);
          for (const key of Object.keys(db)) delete db[key];
          Object.assign(db, restored);
          throw error;
        }
        return ok(summary);
      }

      if (routeKey(method, pathname) === "GET /api/admin/sessions") {
        requireAdmin(authorization, db);
        cleanSessions(db);
        return ok(db.sessions
          .map((session) => publicSession(db, session))
          .filter(Boolean)
          .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))));
      }

      if (routeKey(method, pathname) === "GET /api/admin/logs") {
        requireAdmin(authorization, db);
        return ok((db.auditLogs || [])
          .slice(-400)
          .reverse()
          .map((log) => publicAuditLog(db, log)));
      }

      const sessionRevokeMatch = pathname.match(/^\/api\/admin\/sessions\/([^/]+)\/revoke$/);
      if (method === "POST" && sessionRevokeMatch) {
        const admin = requireAdmin(authorization, db);
        const currentSession = getAuthSession(authorization, db);
        const session = db.sessions.find((item) => item.id === sessionRevokeMatch[1]);
        if (!session) throw Object.assign(new Error("세션을 찾을 수 없습니다."), { status: 404 });
        if (currentSession?.id === session.id) {
          throw Object.assign(new Error("현재 로그인 중인 세션은 나가기 버튼으로 종료하세요."), { status: 400 });
        }
        const publicTarget = publicSession(db, session);
        db.sessions = db.sessions.filter((item) => item.id !== session.id);
        audit(db, admin, "session.revoked", session.id, {
          ...meta,
          targetUserId: session.userId,
          targetIp: session.ip || "",
          targetDevice: session.device || sessionDeviceLabel(session.userAgent || "")
        });
        await saveDb();
        return ok(publicTarget);
      }

      if (routeKey(method, pathname) === "GET /api/admin/users") {
        requireAdmin(authorization, db);
        if (hasListQuery(searchParams)) return ok(adminUserList(db, searchParams));
        return ok(db.users.map((user) => publicUser(user, db)));
      }

      const userApprovalMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/approval$/);
      if (method === "PATCH" && userApprovalMatch) {
        const admin = requireAdmin(authorization, db);
        const body = await parseBody(readText);
        const user = db.users.find((item) => item.id === userApprovalMatch[1]);
        if (!user) throw Object.assign(new Error("사용자를 찾을 수 없습니다."), { status: 404 });
        const nextApprovalStatus = body.approvalStatus || "approved";
        if (!APPROVAL_STATUSES.has(nextApprovalStatus)) {
          throw Object.assign(new Error("지원하지 않는 사용자 상태입니다."), { status: 400 });
        }
        user.approvalStatus = nextApprovalStatus;
        if (user.approvalStatus === "blocked") {
          user.blockDuration = body.limitDuration || "week1";
          user.blockedAt = nowIso();
          user.blockedUntil = blockUntilForDuration(user.blockDuration);
        } else {
          user.blockDuration = "";
          user.blockedAt = "";
          user.blockedUntil = "";
        }
        user.updatedAt = nowIso();
        audit(db, admin, "user.approval_changed", user.id, { approvalStatus: user.approvalStatus, blockDuration: user.blockDuration || "" });
        await saveDb();
        return ok(publicUser(user));
      }

      const userWarningMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/warning$/);
      if (method === "POST" && userWarningMatch) {
        const admin = requireAdmin(authorization, db);
        const body = await parseBody(readText);
        const user = db.users.find((item) => item.id === userWarningMatch[1]);
        if (!user) throw Object.assign(new Error("사용자를 찾을 수 없습니다."), { status: 404 });
        if (body.reset) {
          user.warningCount = 0;
          db.warnings = (db.warnings || []).filter((item) => item.userId !== user.id);
          user.updatedAt = nowIso();
          audit(db, admin, "user.warning_reset", user.id);
          await saveDb();
          return ok({ user: publicUser(user, db) });
        }
        user.warningCount = Math.max(0, Number(user.warningCount || 0)) + 1;
        const warning = {
          id: id("warning"),
          userId: user.id,
          reason: cleanMeta(body.reason || ""),
          count: user.warningCount,
          actorId: admin.id,
          createdAt: nowIso()
        };
        db.warnings.push(warning);
        user.updatedAt = nowIso();
        audit(db, admin, "user.warning_issued", user.id, { count: user.warningCount, reason: warning.reason });
        await saveDb();
        return ok({ user: publicUser(user, db), warning });
      }

      const userPasswordResetMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/password$/);
      if (method === "PATCH" && userPasswordResetMatch) {
        const admin = requireAdmin(authorization, db);
        const body = await parseBody(readText);
        const user = db.users.find((item) => item.id === userPasswordResetMatch[1]);
        if (!user) throw Object.assign(new Error("사용자를 찾을 수 없습니다."), { status: 404 });
        const generated = !body.newPassword;
        const newPassword = generated ? randomPassword(10) : String(body.newPassword);
        if (newPassword.length < PASSWORD_MIN_LENGTH) throw Object.assign(new Error(`새 비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`), { status: 400 });
        user.passwordHash = await hashPassword(newPassword);
        user.updatedAt = nowIso();
        db.sessions = (db.sessions || []).filter((session) => session.userId !== user.id);
        audit(db, admin, "user.password_reset", user.id, { generated });
        await saveDb();
        return ok({ user: publicUser(user), generatedPassword: generated ? newPassword : null });
      }

      const userDeleteMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
      if (method === "DELETE" && userDeleteMatch) {
        const admin = requireAdmin(authorization, db);
        const user = db.users.find((item) => item.id === userDeleteMatch[1]);
        if (!user) throw Object.assign(new Error("사용자를 찾을 수 없습니다."), { status: 404 });
        const summary = deleteUserAccount(db, user, admin, "user.deleted");
        await saveDb();
        return ok(summary);
      }

      if (routeKey(method, pathname) === "GET /api/admin/reservations") {
        requireAdmin(authorization, db);
        if (hasListQuery(searchParams)) return ok(adminReservationList(db, searchParams));
        return ok(db.reservations.map((item) => withReservationDetails(db, item)));
      }

      if (routeKey(method, pathname) === "DELETE /api/admin/reservations/bulk") {
        const admin = requireAdmin(authorization, db);
        const body = await parseBody(readText);
        const result = deleteAdminReservations(db, { ...body, admin, filterAdminReservations });
        audit(db, admin, "reservations.bulk_deleted", "reservations", result.audit);
        await saveDb();
        return ok(result.summary);
      }

      const adminReservationDeleteMatch = pathname.match(/^\/api\/admin\/reservations\/([^/]+)$/);
      if (method === "DELETE" && adminReservationDeleteMatch) {
        const admin = requireAdmin(authorization, db);
        const reservationId = adminReservationDeleteMatch[1];
        const reservation = db.reservations.find((item) => item.id === reservationId);
        if (!reservation) throw Object.assign(new Error("예약을 찾을 수 없습니다."), { status: 404 });
        const deletedReports = db.reports.filter((item) => item.reservationId === reservationId).length;
        db.reservations = db.reservations.filter((item) => item.id !== reservationId);
        db.reports = db.reports.filter((item) => item.reservationId !== reservationId);
        audit(db, admin, "reservation.deleted", reservationId, {
          type: reservation.type,
          deletedReservations: 1,
          deletedReports
        });
        await saveDb();
        return ok({ id: reservationId, deletedReservations: 1, deletedReports });
      }

      const adminReservationStatusMatch = pathname.match(/^\/api\/admin\/reservations\/([^/]+)\/status$/);
      if (method === "PATCH" && adminReservationStatusMatch) {
        const admin = requireAdmin(authorization, db);
        const body = await parseBody(readText);
        const reservation = db.reservations.find((item) => item.id === adminReservationStatusMatch[1]);
        if (!reservation) throw Object.assign(new Error("예약을 찾을 수 없습니다."), { status: 404 });
        assertRequired(body, ["status"]);
        const allowedStatuses = ADMIN_RESERVATION_STATUS_BY_TYPE[reservation.type];
        if (!allowedStatuses?.has(body.status)) {
          throw Object.assign(new Error(`${reservationTitle(reservation.type)} 예약에서 지원하지 않는 상태입니다.`), { status: 400 });
        }
        if (
          reservation.type === "equipment"
          && !EQUIPMENT_RESERVATION_STATUS_TRANSITIONS[reservation.status]?.has(body.status)
        ) {
          throw Object.assign(new Error("현재 기자재 예약 상태에서는 요청한 상태로 변경할 수 없습니다."), { status: 409 });
        }
        reservation.status = body.status;
        reservation.adminNote = body.adminNote || reservation.adminNote || "";
        reservation.updatedAt = nowIso();
        reservation.history.push({ at: nowIso(), actorId: admin.id, action: "status_changed", status: reservation.status });
        audit(db, admin, "reservation.status_changed", reservation.id, { status: reservation.status });
        await postSlack(slackWebhook, db, "reservation_status", reservation);
        await saveDb();
        return ok(withReservationDetails(db, reservation));
      }

      if (routeKey(method, pathname) === "GET /api/admin/equipment") {
        requireAdmin(authorization, db);
        return ok(db.equipment);
      }

      if (routeKey(method, pathname) === "POST /api/admin/equipment") {
        const admin = requireAdmin(authorization, db);
        const body = await parseBody(readText);
        assertRequired(body, ["name", "category"]);
        const quantity = Math.max(1, Number(body.quantity || 1));
        const requestedCodePrefix = String(body.codePrefix || body.code || "").trim();
        const base = requestedCodePrefix || codeBase(body.category, body.name, db.equipment.length + 1);
        const source = body.source || "department";
        const status = normalizeEquipmentStatus(body.status);
        const inquiryOnlyRequested = source === "fantasy_lab"
          || String(body.status || "").trim() === "문의"
          || body.inquiryOnly === true
          || body.inquiryOnly === "true"
          || body.reservable === false;
        const reservable = !inquiryOnlyRequested && equipmentReservableForStatus(status);
        const created = [];
        for (let index = 1; index <= quantity; index += 1) {
          created.push({
            id: id("eq"),
            facility: body.facility || (source === "fantasy_lab" ? "판타지랩" : "극기관"),
            source,
            category: body.category,
            name: body.name,
            brand: String(body.brand || ""),
            model: String(body.model || ""),
            code: requestedCodePrefix && quantity === 1 ? requestedCodePrefix : `${base}-${String(index).padStart(2, "0")}`,
            status,
            reservable,
            inquiryOnly: !reservable,
            notes: body.notes || (source === "fantasy_lab" ? FANTASY_LAB_INQUIRY_NOTE : ""),
            active: true,
            createdAt: nowIso(),
            updatedAt: nowIso()
          });
        }
        db.equipment.push(...created);
        audit(db, admin, "equipment.created", created.map((item) => item.id).join(","), { count: created.length });
        await saveDb();
        return ok(created);
      }

      if (routeKey(method, pathname) === "POST /api/admin/equipment/import") {
        const admin = requireAdmin(authorization, db);
        const body = await parseBody(readText);
        if (!Array.isArray(body.rows)) throw Object.assign(new Error("rows 배열이 필요합니다."), { status: 400 });
        const batch = {
          id: id("import"),
          filename: body.filename || "admin-import.csv",
          uploadedBy: admin.id,
          status: "applied",
          totalRows: body.rows.length,
          readyRows: 0,
          warningRows: 0,
          errorRows: 0,
          createdItemIds: [],
          createdAt: nowIso(),
          appliedAt: nowIso()
        };
        for (const row of body.rows) {
          if (!row.name) {
            batch.errorRows += 1;
            continue;
          }
          const quantity = Math.max(1, Number(row.quantity || 1));
          const category = row.category || "Other";
          const source = row.source || (row.facility === "판타지랩" ? "fantasy_lab" : "department");
          const status = normalizeEquipmentStatus(row.status);
          const inquiryOnlyRequested = source === "fantasy_lab"
            || String(row.status || "").trim() === "문의"
            || row.inquiryOnly === true
            || row.inquiryOnly === "true"
            || row.inquiry_only === "true"
            || row.reservable === false
            || row.reservable === "false";
          const reservable = !inquiryOnlyRequested && equipmentReservableForStatus(status);
          const requestedCodePrefix = String(row.code_prefix || row.codePrefix || row.code || "").trim();
          const base = requestedCodePrefix || codeBase(category, row.name, db.equipment.length + 1);
          for (let index = 1; index <= quantity; index += 1) {
            const item = {
              id: id("eq"),
              facility: row.facility || (source === "fantasy_lab" ? "판타지랩" : "극기관"),
              source,
              category,
              name: row.name,
              brand: row.brand || "",
              model: row.model || "",
              code: requestedCodePrefix && quantity === 1 ? requestedCodePrefix : `${base}-${String(index).padStart(2, "0")}`,
              status,
              reservable,
              inquiryOnly: !reservable,
              notes: row.notes || (source === "fantasy_lab" ? FANTASY_LAB_INQUIRY_NOTE : ""),
              active: true,
              importBatchId: batch.id,
              createdAt: nowIso(),
              updatedAt: nowIso()
            };
            db.equipment.push(item);
            batch.createdItemIds.push(item.id);
          }
          batch.readyRows += 1;
        }
        db.importBatches.push(batch);
        audit(db, admin, "equipment.imported", batch.id, { created: batch.createdItemIds.length });
        await saveDb();
        return ok(batch);
      }

      if (routeKey(method, pathname) === "PATCH /api/admin/equipment/bulk") {
        const admin = requireAdmin(authorization, db);
        const body = await parseBody(readText);
        const ids = Array.isArray(body.ids) ? [...new Set(body.ids.map((item) => String(item || "").trim()).filter(Boolean))] : [];
        if (!ids.length) throw Object.assign(new Error("변경할 기자재를 선택하세요."), { status: 400 });
        if (ids.length > 200) throw Object.assign(new Error("한 번에 변경할 수 있는 기자재는 200개까지입니다."), { status: 400 });
        if (!body.patch || typeof body.patch !== "object" || Array.isArray(body.patch)) {
          throw Object.assign(new Error("변경할 기자재 값을 입력하세요."), { status: 400 });
        }
        const items = ids.map((itemId) => {
          const item = db.equipment.find((eq) => eq.id === itemId);
          if (!item) throw Object.assign(new Error("기자재를 찾을 수 없습니다."), { status: 404 });
          return item;
        });
        const updated = items.map((item) => applyEquipmentPatch(item, body.patch));
        audit(db, admin, "equipment.updated", ids.join(","), equipmentAuditDetail(body.patch, { count: updated.length, bulk: true }));
        await saveDb();
        return ok(updated);
      }

      const equipmentPatchMatch = pathname.match(/^\/api\/admin\/equipment\/([^/]+)$/);
      if (method === "PATCH" && equipmentPatchMatch) {
        const admin = requireAdmin(authorization, db);
        const body = await parseBody(readText);
        const item = db.equipment.find((eq) => eq.id === equipmentPatchMatch[1]);
        if (!item) throw Object.assign(new Error("기자재를 찾을 수 없습니다."), { status: 404 });
        applyEquipmentPatch(item, body);
        audit(db, admin, "equipment.updated", item.id, equipmentAuditDetail(body));
        await saveDb();
        return ok(item);
      }

      if (routeKey(method, pathname) === "GET /api/admin/reports") {
        requireAdmin(authorization, db);
        if (hasListQuery(searchParams)) return ok(adminReportList(db, searchParams));
        return ok(db.reports.map((report) => reportWithDetails(db, report)));
      }

      if (routeKey(method, pathname) === "DELETE /api/admin/reports/bulk") {
        const admin = requireAdmin(authorization, db);
        const body = await parseBody(readText);
        const result = deleteAdminReports(db, { ...body, admin, filterAdminReports });
        audit(db, admin, "reports.bulk_deleted", "reports", result.audit);
        await saveDb();
        return ok(result.summary);
      }

      if (routeKey(method, pathname) === "GET /api/admin/lectures") {
        requireAdmin(authorization, db);
        if (hasListQuery(searchParams)) return ok(adminLectureList(db, searchParams));
        const lectures = db.lectures
          .map((lecture) => lectureDetail(db, lecture))
          .sort((a, b) => String(a.lectureDate || "").localeCompare(String(b.lectureDate || "")));
        return ok(lectures);
      }

      if (routeKey(method, pathname) === "POST /api/admin/lectures") {
        const admin = requireAdmin(authorization, db);
        const body = await parseBody(readText);
        assertRequired(body, ["title", "lectureDate", "time", "location", "instructorName", "description"]);
        assertDateKey(body.lectureDate, "특강일");
        const lecture = {
          id: id("lecture"),
          title: body.title,
          lectureDate: body.lectureDate,
          time: body.time,
          location: body.location,
          instructorName: body.instructorName,
          instructorAffiliation: body.instructorAffiliation || "",
          professor: body.professor || "",
          targetGrades: body.targetGrades || "",
          capacity: Math.max(0, Number(body.capacity || 0)),
          baseApplicationCount: Math.max(0, Number(body.baseApplicationCount || 0)),
          description: body.description,
          status: ["모집중", "진행완료", "취소"].includes(body.status) ? body.status : "모집중",
          notes: body.notes || "",
          createdAt: nowIso(),
          updatedAt: nowIso()
        };
        db.lectures.push(lecture);
        audit(db, admin, "lecture.created", lecture.id);
        await saveDb();
        return ok(lectureDetail(db, lecture));
      }

      const lecturePatchMatch = pathname.match(/^\/api\/admin\/lectures\/([^/]+)$/);
      if (method === "PATCH" && lecturePatchMatch) {
        const admin = requireAdmin(authorization, db);
        const body = await parseBody(readText);
        const lecture = db.lectures.find((item) => item.id === lecturePatchMatch[1]);
        if (!lecture) throw Object.assign(new Error("특강을 찾을 수 없습니다."), { status: 404 });
        if (body.lectureDate !== undefined) assertDateKey(body.lectureDate, "특강일");
        const editableFields = ["title", "lectureDate", "time", "location", "instructorName", "instructorAffiliation", "professor", "targetGrades", "description", "notes"];
        for (const field of editableFields) {
          if (body[field] !== undefined) lecture[field] = body[field];
        }
        if (body.capacity !== undefined) lecture.capacity = Math.max(0, Number(body.capacity || 0));
        if (body.baseApplicationCount !== undefined) lecture.baseApplicationCount = Math.max(0, Number(body.baseApplicationCount || 0));
        if (body.status !== undefined) lecture.status = ["모집중", "진행완료", "취소"].includes(body.status) ? body.status : lecture.status;
        lecture.updatedAt = nowIso();
        audit(db, admin, "lecture.updated", lecture.id, body);
        await saveDb();
        return ok(lectureDetail(db, lecture));
      }

      if (routeKey(method, pathname) === "DELETE /api/admin/lectures/bulk") {
        const admin = requireAdmin(authorization, db);
        const body = await parseBody(readText);
        const result = deleteAdminLectures(db, { ...body, admin, filterAdminLectures });
        audit(db, admin, "lectures.bulk_deleted", "lectures", result.audit);
        await saveDb();
        return ok(result.summary);
      }

      const lectureDeleteMatch = pathname.match(/^\/api\/admin\/lectures\/([^/]+)$/);
      if (method === "DELETE" && lectureDeleteMatch) {
        const admin = requireAdmin(authorization, db);
        const lecture = db.lectures.find((item) => item.id === lectureDeleteMatch[1]);
        if (!lecture) throw Object.assign(new Error("특강을 찾을 수 없습니다."), { status: 404 });
        const removedApplications = (db.lectureApplications || []).filter((item) => item.lectureId === lecture.id).length;
        db.lectureApplications = (db.lectureApplications || []).filter((item) => item.lectureId !== lecture.id);
        db.lectures = db.lectures.filter((item) => item.id !== lecture.id);
        audit(db, admin, "lecture.deleted", lecture.id, { title: lecture.title, removedApplications });
        await saveDb();
        return ok({ id: lecture.id, removedApplications });
      }

      if (routeKey(method, pathname) === "GET /api/admin/notices") {
        requireAdmin(authorization, db);
        if (hasNoticeListQuery(searchParams)) return ok(adminNoticeList(db, searchParams));
        return ok(db.notices.map(noticeWithActive));
      }

      if (routeKey(method, pathname) === "DELETE /api/admin/notices/bulk") {
        const admin = requireAdmin(authorization, db);
        const body = await parseBody(readText);
        const result = deleteAdminNotices(db, { ...body, admin, filterAdminNotices });
        audit(db, admin, "notices.bulk_deleted", "notices", result.audit);
        await saveDb();
        return ok(result.summary);
      }

      const noticeDeleteMatch = pathname.match(/^\/api\/admin\/notices\/([^/]+)$/);
      if (method === "DELETE" && noticeDeleteMatch) {
        const admin = requireAdmin(authorization, db);
        const noticeId = noticeDeleteMatch[1];
        const notice = db.notices.find((item) => item.id === noticeId);
        if (!notice) throw Object.assign(new Error("공지를 찾을 수 없습니다."), { status: 404 });
        db.notices = db.notices.filter((item) => item.id !== noticeId);
        audit(db, admin, "notice.deleted", noticeId, { title: notice.title });
        await saveDb();
        return ok({ id: noticeId, deletedNotices: 1 });
      }

      if (routeKey(method, pathname) === "POST /api/admin/notices") {
        const admin = requireAdmin(authorization, db);
        const body = await parseBody(readText);
        assertRequired(body, ["title", "body"]);
        const active = body.active !== false;
        const notice = {
          id: id("notice"),
          title: body.title,
          category: body.category || "일반",
          body: body.body,
          pinned: body.pinned === true,
          active,
          status: active ? "published" : "draft",
          link: sanitizeHttpUrl(body.link || "", "공지 링크"),
          createdAt: nowIso(),
          updatedAt: nowIso()
        };
        db.notices.push(notice);
        audit(db, admin, "notice.created", notice.id);
        await saveDb();
        return ok(notice);
      }

      if (routeKey(method, pathname) === "GET /api/admin/settings") {
        requireAdmin(authorization, db);
        return ok(db.settings);
      }

      if (routeKey(method, pathname) === "PATCH /api/admin/settings") {
        const admin = requireAdmin(authorization, db);
        const body = await parseBody(readText);
        db.settings = sanitizeSettingsPatch(db.settings, body);
        audit(db, admin, "settings.updated", "settings", body);
        await saveDb();
        return ok(db.settings);
      }

      throw Object.assign(new Error("API 경로를 찾을 수 없습니다."), { status: 404 });
    } catch (error) {
      return fail(error);
    }
}
