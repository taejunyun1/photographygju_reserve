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

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;
const PASSWORD_ITERATIONS = 100000;
const PASSWORD_MIN_LENGTH = 8;
const LECTURE_CANCEL_LIMIT_MS = 1000 * 60 * 60 * 6;
const LOGIN_MAX_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LOCK_MS = 5 * 60 * 1000;
const PRODUCTION_STUDENT_URL = "https://gjupreserve.com";
const LEGACY_STUDENT_URL = "https://photographygju.dothome.co.kr";
const LEGACY_ADMIN_URL = "https://admin.photographygju.dothome.co.kr";
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
const RESERVATION_STATUSES = new Set(["pending_approval", "auto_confirmed", "approved", "cancelled", "admin_cancelled", "checked_out", "returned", "completed", "rejected"]);
const EQUIPMENT_RESERVATION_STATUSES = new Set(["checked_out", "returned", "cancelled"]);
const EQUIPMENT_STATUSES = new Set(["가능", "수리중", "파손", "available", "rented", "maintenance", "repair", "lost", "사용 가능", "대여 중", "점검 중", "수리 중", "분실", "damaged", "broken"]);
const FANTASY_LAB_INQUIRY_NOTE = "온라인 예약불가. 판타지랩 조교에게 직접 문의";
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
const SETTING_FACILITY_TYPES = new Set(["studio", "darkroom", "equipment", "print"]);
const NOTICE_LIST_QUERY_KEYS = new Set(["q", "type", "status", "from", "to", "page", "pageSize"]);

const defaultSettings = {
  appName: "GJU Photography Reservation",
  departmentName: "광주대학교 사진영상미디어학과",
  studentUrl: PRODUCTION_STUDENT_URL,
  adminUrl: PRODUCTION_STUDENT_URL,
  slackChannel: "#예약_현황automatic",
  phoneMasking: true,
  reservationWindowDays: 30,
  equipmentFacility: "사진영상미디어학과 기자재실",
  equipmentCategories: ["Body", "Lens", "Lighting", "Audio", "Drone", "Other"],
  equipmentRentalTimes: ["10:15", "12:00", "17:30"],
  equipmentReturnTimes: ["10:15", "12:00", "17:10"],
  equipmentPeriods: ["당일", "1박2일", "2박3일", "주말사용"],
  studioSpaces: ["Studio A Front", "Studio A Back", "Studio B Front", "Studio B Back"],
  studioSlots: [
    "10:30-12:00",
    "12:00-14:00",
    "14:00-16:00",
    "16:00-18:00",
    "18:00-20:00 (야간)",
    "20:00-22:00 (야간)",
    "22:00-24:00 (야간)",
    "00:00-02:00 (야간)",
    "02:00-04:00 (야간)",
    "04:00-06:00 (야간)"
  ],
  studioMaxSlots: 3,
  studioReportDeadlineHours: 48,
  darkroomCapacity: 6,
  darkroomSlots: [
    "00:00-02:00",
    "02:00-04:00",
    "04:00-06:00",
    "06:00-08:00",
    "08:00-10:00",
    "10:00-12:00",
    "12:00-14:00",
    "14:00-16:00",
    "16:00-18:00",
    "18:00-20:00",
    "20:00-22:00",
    "22:00-24:00"
  ],
  darkroomBlockedRules: [
    { day: "monday", label: "월요일", start: "14:00", end: "18:00" },
    { day: "tuesday", label: "화요일", start: "14:00", end: "18:00" }
  ],
  printAvailableStart: "10:00",
  printAvailableEnd: "19:00",
  printTimeUnitMinutes: 60,
  printCapacityWindowMinutes: 120,
  printCapacityPerWindow: 4,
  printTypes: ["과제", "개인 작품"],
  printPapers: ["글로시", "매트"],
  printSizes: ["소형", "중형", "대형"],
  printBankAccount: "Admin 설정에서 출력비 계좌를 입력하세요.",
  printUploadStartDate: "",
  printUploadEndDate: "",
  googleDriveUrl: "",
  equipmentHighValueCategories: ["Body", "Lens"],
  equipmentBagKeywords: ["펠리컨", "Pelican"],
  equipmentCameraBagNotice: "고가장비(카메라)를 선택 시 카메라 가방을 지참하겠습니다",
  vacationMode: false,
  vacationRanges: [],
  blockedSchedules: [],
  noticesPinnedFirst: true
};

const darkroomChemicals = [
  { id: "chem-d76", process: "현상", name: "Kodak D-76", options: ["500ml", "1000ml", "2000ml", "직접 입력"] },
  { id: "chem-stopbath", process: "정지", name: "ILFORD indicator stopbath", options: ["500ml", "1000ml", "2000ml", "직접 입력"] },
  { id: "chem-fixer", process: "정착", name: "ILFORD Hypam Rapid Fixer", options: ["500ml", "1000ml", "2000ml", "직접 입력"] },
  { id: "chem-developer", process: "인화 현상", name: "ILFORD multigrade paper Developer", options: ["500ml", "1000ml", "2000ml", "직접 입력"] },
  { id: "lens-schneider-50", process: "확대기 렌즈", name: "Schneider componon-s 50mm f2.8", options: ["1개", "직접 입력"] }
];

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

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function randomHex(bytes = 16) {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return [...values].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function randomPassword(length = 8) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return [...values].map((value) => alphabet[value % alphabet.length]).join("");
}

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

async function hashPassword(password, salt = randomHex(16)) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: PASSWORD_ITERATIONS },
    key,
    256
  );
  return `pbkdf2:${salt}:${toHex(bits)}`;
}

async function verifyPassword(password, stored) {
  if (!stored) return false;
  const [type, salt, expected] = stored.split(":");
  if (type !== "pbkdf2" || !salt || !expected) return false;
  const next = await hashPassword(password, salt);
  return safeEqual(next, stored);
}

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

function categoryPrefix(category) {
  return {
    Body: "CAM",
    Lens: "LEN",
    Lighting: "LGT",
    Audio: "AUD",
    Drone: "DRN",
    Other: "ETC"
  }[category] || "ETC";
}

function codeBase(category, name, fallbackIndex) {
  const ascii = String(name || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .join("");
  return `${categoryPrefix(category)}-${ascii || `ITEM${String(fallbackIndex).padStart(3, "0")}`}`;
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
  if (nextStatus && !EQUIPMENT_STATUSES.has(nextStatus)) {
    throw Object.assign(new Error("지원하지 않는 기자재 상태입니다."), { status: 400 });
  }
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
    item.reservable = equipmentReservableForStatus(item.status);
    item.inquiryOnly = !item.reservable;
  } else if (patch.reservable !== undefined) {
    item.inquiryOnly = !item.reservable;
  }
  return item;
}

function seedEquipment() {
  const items = [];
  let groupIndex = 0;
  for (const [source, category, name, quantity, reservable, notes] of seedEquipmentGroups) {
    groupIndex += 1;
    const base = codeBase(category, name, groupIndex);
    for (let i = 1; i <= quantity; i += 1) {
      items.push({
        id: id("eq"),
        facility: source === "fantasy_lab" ? "판타지랩" : defaultSettings.equipmentFacility,
        source,
        category,
        name,
        code: `${base}-${String(i).padStart(2, "0")}`,
        status: "가능",
        reservable,
        inquiryOnly: !reservable,
        notes,
        active: true,
        createdAt: nowIso(),
        updatedAt: nowIso()
      });
    }
  }
  return items;
}

async function userRecord({ role = "student", username = "", name, email, phone = "", studentId = "", grade = "", studentStatus, approvalStatus, password }) {
  return {
    id: username === "admin" ? "user_admin" : id("user"),
    role,
    username,
    name,
    email,
    phone,
    studentId,
    grade,
    studentStatus,
    approvalStatus,
    passwordHash: await hashPassword(password),
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
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
    equipment: seedEquipment(),
    reservations: [],
    reports: [],
    lectures: [],
    lectureApplications: [],
    notices: [],
    warnings: [],
    slackLogs: [],
    auditLogs: [],
    importBatches: []
  };
}

function userWarningRecords(db, userId, limit = 3) {
  return (db?.warnings || [])
    .filter((item) => item.userId === userId)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      reason: item.reason || "",
      count: Math.max(0, Number(item.count || 0)),
      createdAt: item.createdAt || ""
    }));
}

function publicUser(user, db = null) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return {
    ...rest,
    warningCount: Math.max(0, Number(user.warningCount || 0)),
    warningRecords: db ? userWarningRecords(db, user.id) : [],
    approvalStatus: effectiveApprovalStatus(user)
  };
}

function cleanMeta(value, max = 240) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function requestMeta(ctx) {
  return {
    ip: cleanMeta(ctx.clientIp || "", 80),
    userAgent: cleanMeta(ctx.userAgent || "", 240)
  };
}

function sessionDeviceLabel(userAgent = "") {
  const ua = String(userAgent);
  const os = /iPhone|iPad|iPod/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X|Macintosh/.test(ua)
        ? "Mac"
        : /Windows/.test(ua)
          ? "Windows"
          : "기기";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Safari\//.test(ua)
        ? "Safari"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : "Browser";
  return `${os} / ${browser}`;
}

function publicSession(db, session) {
  if (!session) return null;
  const user = db.users.find((item) => item.id === session.userId);
  return {
    id: session.id,
    userId: session.userId,
    user: publicUser(user),
    ip: session.ip || "",
    userAgent: session.userAgent || "",
    device: session.device || sessionDeviceLabel(session.userAgent || ""),
    createdAt: session.createdAt,
    lastSeenAt: session.lastSeenAt || session.createdAt,
    expiresAt: session.expiresAt
  };
}

function publicAuditLog(db, log) {
  return {
    ...log,
    actor: publicUser(db.users.find((user) => user.id === log.actorId))
  };
}

function effectiveApprovalStatus(user) {
  if (!user || user.approvalStatus !== "blocked") return user?.approvalStatus;
  if (!user.blockedUntil) return "blocked";
  return new Date(user.blockedUntil).getTime() > Date.now() ? "blocked" : "approved";
}

function blockUntilForDuration(duration) {
  const days = LIMIT_DURATION_DAYS[duration] || LIMIT_DURATION_DAYS.week1;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function blockEndLabel(value) {
  if (!value) return "";
  return value.slice(0, 10);
}

function authToken(authorization) {
  const auth = authorization || "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : "";
}

function cleanSessions(db) {
  const now = Date.now();
  db.sessions = (db.sessions || []).filter((session) => new Date(session.expiresAt).getTime() > now);
}

function getAuthSession(authorization, db) {
  const token = authToken(authorization);
  if (!token) return null;
  cleanSessions(db);
  return db.sessions.find((item) => item.token === token) || null;
}

function getAuthUser(authorization, db) {
  const session = getAuthSession(authorization, db);
  if (!session) return null;
  return db.users.find((user) => user.id === session.userId) || null;
}

function requireUser(authorization, db) {
  const user = getAuthUser(authorization, db);
  if (!user) throw Object.assign(new Error("로그인이 필요합니다."), { status: 401 });
  return user;
}

function requireAdmin(authorization, db) {
  const user = requireUser(authorization, db);
  if (user.role !== "admin") throw Object.assign(new Error("관리자 권한이 필요합니다."), { status: 403 });
  return user;
}

function assertApprovedStudentAccess(user) {
  if (user.role !== "admin" && effectiveApprovalStatus(user) !== "approved") {
    const message = user.approvalStatus === "blocked"
      ? `대여금지 상태입니다.${user.blockedUntil ? ` 해제 예정: ${blockEndLabel(user.blockedUntil)}` : ""}`
      : "관리자 승인 후 예약할 수 있습니다.";
    throw Object.assign(new Error(message), { status: 403 });
  }
}

function requireApprovedStudent(authorization, db) {
  const user = requireUser(authorization, db);
  assertApprovedStudentAccess(user);
  return user;
}

async function parseBody(readText) {
  const text = await readText();
  if (!text) return {};
  if (text.length > 1024 * 1024) {
    throw Object.assign(new Error("요청 본문이 너무 큽니다."), { status: 413 });
  }
  try {
    return JSON.parse(text);
  } catch {
    throw Object.assign(new Error("JSON 형식이 올바르지 않습니다."), { status: 400 });
  }
}

function ok(data = null) {
  return { status: 200, body: { ok: true, data } };
}

function fail(error) {
  return { status: error.status || 500, body: { ok: false, error: error.message || "서버 오류가 발생했습니다." } };
}

function assertRequired(body, fields) {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      throw Object.assign(new Error(`${field} 값이 필요합니다.`), { status: 400 });
    }
  }
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

function reservationTitle(type) {
  return { equipment: "기자재", studio: "스튜디오", darkroom: "암실", print: "출력실" }[type] || type;
}

function reservationStatusForType(type) {
  return type === "equipment" ? "checked_out" : "auto_confirmed";
}

function normalizeEquipmentReservationStatus(status) {
  if (status === "returned" || status === "completed") return "returned";
  if (status === "cancelled" || status === "admin_cancelled" || status === "rejected") return "cancelled";
  if (status === "checked_out" || status === "pending_approval" || status === "approved" || status === "auto_confirmed") return "checked_out";
  return EQUIPMENT_RESERVATION_STATUSES.has(status) ? status : "checked_out";
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

function isBlockingReservation(reservation) {
  return !["cancelled", "admin_cancelled", "rejected", "returned", "completed"].includes(reservation.status);
}

function addDaysToDateKey(key, days) {
  if (!isValidDateKey(key)) return "";
  const date = new Date(`${key}T00:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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
  return requiresPreviousDayReservation(type)
    ? reservedDate <= today
    : reservedDate < today;
}

function reservationDateClosedMessage(type) {
  if (requiresPreviousDayReservation(type)) {
    return `${reservationTitle(type)} 예약은 사용일 전날 23:59까지만 가능합니다. 당일 예약은 시스템에서 접수할 수 없습니다.`;
  }
  return "오늘 이전 날짜는 예약할 수 없습니다. 기록 확인만 가능합니다.";
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
  const haystack = [item?.name, item?.code, item?.category, item?.notes, item?.model, item?.brand]
    .map(normalizedText)
    .join(" ");
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

function dateRangesOverlap(a, b) {
  if (!a || !b) return false;
  return a.start <= b.end && b.start <= a.end;
}

function timeToMinutes(value) {
  const match = String(value || "").match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
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

function sanitizeBlockedSchedule(rule = {}) {
  assertPlainObject(rule, "차단 일정");
  const type = String(rule.type || "").trim();
  const day = String(rule.day || "").trim();
  if (!SETTING_FACILITY_TYPES.has(type)) {
    throw Object.assign(new Error("지원하지 않는 차단 시설입니다."), { status: 400 });
  }
  if (!(day in WEEKDAY_INDEX)) {
    throw Object.assign(new Error("차단 요일이 올바르지 않습니다."), { status: 400 });
  }
  assertDateKey(rule.from, "차단 시작일");
  assertDateKey(rule.to, "차단 종료일");
  if (String(rule.from) > String(rule.to)) {
    throw Object.assign(new Error("차단 종료일은 시작일 이후여야 합니다."), { status: 400 });
  }
  assertTimeValue(rule.start, "차단 시작 시간");
  assertTimeValue(rule.end, "차단 종료 시간");
  return {
    id: String(rule.id || id("block")).trim().slice(0, 80),
    type,
    day,
    from: String(rule.from),
    to: String(rule.to),
    start: String(rule.start),
    end: String(rule.end),
    target: String(rule.target || "").trim().slice(0, 120)
  };
}

function sanitizeStringList(value, maxItems = 80, maxLength = 80) {
  const source = Array.isArray(value)
    ? value
    : String(value || "").split(",");
  return [...new Set(source
    .map((item) => String(item || "").trim().slice(0, maxLength))
    .filter(Boolean))]
    .slice(0, maxItems);
}

function sanitizeSettingsPatch(current, body = {}) {
  assertPlainObject(body, "설정");
  const patch = {};
  if (body.printBankAccount !== undefined) patch.printBankAccount = String(body.printBankAccount || "").trim().slice(0, 240);
  if (body.googleDriveUrl !== undefined) {
    const googleDriveUrl = sanitizeHttpUrl(body.googleDriveUrl || "", "출력실 구글 드라이브 URL");
    if (googleDriveUrl.length > 500) {
      throw Object.assign(new Error("출력실 구글 드라이브 URL은 500자 이하로 입력하세요."), { status: 400 });
    }
    patch.googleDriveUrl = googleDriveUrl;
  }
  if (body.printUploadStartDate !== undefined) {
    assertOptionalDateKey(body.printUploadStartDate, "출력 업로드 시작일");
    patch.printUploadStartDate = String(body.printUploadStartDate || "");
  }
  if (body.printUploadEndDate !== undefined) {
    assertOptionalDateKey(body.printUploadEndDate, "출력 업로드 종료일");
    patch.printUploadEndDate = String(body.printUploadEndDate || "");
  }
  if (body.darkroomCapacity !== undefined) {
    const capacity = Number(body.darkroomCapacity);
    if (!Number.isFinite(capacity) || capacity < 1 || capacity > 200) {
      throw Object.assign(new Error("암실 최대 인원은 1-200 사이로 입력하세요."), { status: 400 });
    }
    patch.darkroomCapacity = Math.floor(capacity);
  }
  if (body.printAvailableStart !== undefined) {
    assertTimeValue(body.printAvailableStart, "출력실 시작 시간");
    patch.printAvailableStart = String(body.printAvailableStart);
  }
  if (body.printAvailableEnd !== undefined) {
    assertTimeValue(body.printAvailableEnd, "출력실 종료 시간");
    patch.printAvailableEnd = String(body.printAvailableEnd);
  }
  if (body.equipmentCategories !== undefined) {
    if (!Array.isArray(body.equipmentCategories)) {
      throw Object.assign(new Error("기자재 카테고리는 배열이어야 합니다."), { status: 400 });
    }
    patch.equipmentCategories = sanitizeStringList(body.equipmentCategories, 80, 60);
  }
  if (body.equipmentHighValueCategories !== undefined) patch.equipmentHighValueCategories = sanitizeStringList(body.equipmentHighValueCategories, 40, 60);
  if (body.equipmentBagKeywords !== undefined) patch.equipmentBagKeywords = sanitizeStringList(body.equipmentBagKeywords, 40, 60);
  if (body.equipmentCameraBagNotice !== undefined) patch.equipmentCameraBagNotice = String(body.equipmentCameraBagNotice || "").trim().slice(0, 160) || defaultSettings.equipmentCameraBagNotice;
  if (body.blockedSchedules !== undefined) {
    if (!Array.isArray(body.blockedSchedules) || body.blockedSchedules.length > 400) {
      throw Object.assign(new Error("차단 일정은 400개 이하 배열이어야 합니다."), { status: 400 });
    }
    patch.blockedSchedules = body.blockedSchedules.map(sanitizeBlockedSchedule);
  }
  if (body.vacationMode !== undefined) patch.vacationMode = body.vacationMode === true;
  const next = { ...current, ...patch };
  if (next.printUploadStartDate && next.printUploadEndDate && next.printUploadStartDate > next.printUploadEndDate) {
    throw Object.assign(new Error("출력 업로드 종료일은 시작일 이후여야 합니다."), { status: 400 });
  }
  return { ...next, updatedAt: nowIso() };
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
  for (let cursor = start; cursor < end; cursor += windowMinutes) {
    buckets.push({ start: cursor, end: Math.min(cursor + windowMinutes, end) });
  }
  return buckets;
}

function validateReservation(db, type, fields, editingId = null) {
  if (!["equipment", "studio", "darkroom", "print"].includes(type)) {
    throw Object.assign(new Error("지원하지 않는 예약 종류입니다."), { status: 400 });
  }
  assertOptionalDateKey(fields.reservedDate, "예약일");
  if (reservationDateClosed(type, fields.reservedDate)) {
    throw Object.assign(new Error(reservationDateClosedMessage(type)), { status: 400 });
  }

  if (type === "equipment") {
    assertRequired(fields, ["reservedDate", "period", "rentalTime", "returnTime", "phone"]);
    // 2박3일(주말)·주말 대여는 금요일(금→일) 시작만 허용한다.
    if ((String(fields.period).includes("2박3일") || String(fields.period).includes("주말")) && dayIndexForDateKey(fields.reservedDate) !== 5) {
      throw Object.assign(new Error("2박3일(주말) 대여는 금요일에만 가능합니다."), { status: 400 });
    }
    if (!Array.isArray(fields.equipmentItemIds) || fields.equipmentItemIds.length === 0) {
      throw Object.assign(new Error("기자재를 1개 이상 선택해야 합니다."), { status: 400 });
    }
    const requestedRange = equipmentReservationRange(fields);
    const blockedDate = dateKeysInRange(requestedRange).find((key) => blockingSchedulesFor(db, "equipment", key).length);
    if (blockedDate) {
      throw Object.assign(new Error(`${blockedDate}은 기자재 예약 차단 일정이 있어 예약할 수 없습니다.`), { status: 409 });
    }
    const selectedEquipmentItems = [];
    for (const itemId of fields.equipmentItemIds) {
      const item = db.equipment.find((eq) => eq.id === itemId);
      if (!item || !item.active || !item.reservable || !equipmentReservableForStatus(item.status)) {
        throw Object.assign(new Error("예약할 수 없는 기자재가 포함되어 있습니다."), { status: 400 });
      }
      selectedEquipmentItems.push(item);
      const conflict = db.reservations.find((reservation) => {
        if (reservation.id === editingId || reservation.type !== "equipment") return false;
        if (!isBlockingReservation(reservation)) return false;
        if (!Array.isArray(reservation.fields.equipmentItemIds) || !reservation.fields.equipmentItemIds.includes(itemId)) return false;
        return dateRangesOverlap(equipmentReservationRange(reservation.fields), requestedRange);
      });
      if (conflict) {
        throw Object.assign(new Error(`${item.code} 기자재가 해당 기간에 이미 예약되어 있습니다.`), { status: 409 });
      }
    }
    const hasHighValueEquipment = selectedEquipmentItems.some((item) => isHighValueEquipment(item, db.settings));
    const hasCameraBagEquipment = selectedEquipmentItems.some((item) => isCameraBagEquipment(item, db.settings));
    if (hasHighValueEquipment && !hasCameraBagEquipment && fields.cameraBagConfirmed !== true && fields.cameraBagConfirmed !== "true") {
      throw Object.assign(new Error(db.settings.equipmentCameraBagNotice || defaultSettings.equipmentCameraBagNotice), { status: 400 });
    }
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
        const blocked = blockingSchedulesFor(db, "studio", fields.reservedDate, timeRangeFromLabel(slot), space);
        if (blocked.length) {
          throw Object.assign(new Error(`${space} ${slot}은 차단 일정(${blockLabel(blocked[0])})이 있어 예약할 수 없습니다.`), { status: 409 });
        }
      }
    }
    const conflict = db.reservations.find((reservation) => {
      if (reservation.id === editingId || reservation.type !== "studio") return false;
      if (!isBlockingReservation(reservation)) return false;
      return reservation.fields.reservedDate === fields.reservedDate &&
        hasOverlap(studioSpaces(reservation.fields), selectedSpaces) &&
        hasOverlap(reservation.fields.timeSlots, fields.timeSlots);
    });
    if (conflict) throw Object.assign(new Error("선택한 스튜디오와 시간에 이미 예약이 있습니다."), { status: 409 });
  }

  if (type === "darkroom") {
    assertRequired(fields, ["reservedDate", "phone"]);
    if (!Array.isArray(fields.timeSlots) || fields.timeSlots.length === 0) throw Object.assign(new Error("암실 사용 시간을 선택해야 합니다."), { status: 400 });
    const participantCount = Math.max(1, Number(fields.participantCount || 1));
    for (const slot of fields.timeSlots) {
      const blocked = [
        ...darkroomBlockedRulesFor(db, fields.reservedDate, slot),
        ...blockingSchedulesFor(db, "darkroom", fields.reservedDate, timeRangeFromLabel(slot))
      ];
      if (blocked.length) {
        throw Object.assign(new Error(`${slot}은 암실 차단 일정(${blockLabel(blocked[0])})이 있어 예약할 수 없습니다.`), { status: 409 });
      }
      const reservedCount = db.reservations
        .filter((reservation) => reservation.id !== editingId)
        .filter((reservation) => reservation.type === "darkroom")
        .filter(isBlockingReservation)
        .filter((reservation) => reservation.fields.reservedDate === fields.reservedDate)
        .filter((reservation) => Array.isArray(reservation.fields.timeSlots) && reservation.fields.timeSlots.includes(slot))
        .reduce((sum, reservation) => sum + Math.max(1, Number(reservation.fields.participantCount || 1)), 0);
      if (reservedCount + participantCount > db.settings.darkroomCapacity) {
        throw Object.assign(new Error(`${slot} 암실 정원 ${db.settings.darkroomCapacity}명을 초과합니다.`), { status: 409 });
      }
    }
  }

  if (type === "print") {
    assertRequired(fields, ["reservedDate", "startTime", "endTime", "phone", "printType", "paper", "size"]);
    if (printDateOutsideUploadWindow(db.settings, fields.reservedDate)) {
      const startLabel = db.settings.printUploadStartDate || "제한 없음";
      const endLabel = db.settings.printUploadEndDate || "제한 없음";
      throw Object.assign(new Error(`출력 업로드 가능 기간(${startLabel} ~ ${endLabel}) 밖의 날짜입니다.`), { status: 400 });
    }
    const start = timeToMinutes(fields.startTime);
    const end = timeToMinutes(fields.endTime);
    const availableStart = timeToMinutes(db.settings.printAvailableStart);
    const availableEnd = timeToMinutes(db.settings.printAvailableEnd);
    if (start === null || end === null || end <= start) {
      throw Object.assign(new Error("출력실 시작/종료 시간을 올바르게 선택하세요."), { status: 400 });
    }
    if (start < availableStart || end > availableEnd) {
      throw Object.assign(new Error(`출력실 사용 가능 시간은 ${db.settings.printAvailableStart}-${db.settings.printAvailableEnd}입니다.`), { status: 400 });
    }
    const blocked = blockingSchedulesFor(db, "print", fields.reservedDate, { start, end });
    if (blocked.length) {
      throw Object.assign(new Error(`${fields.startTime}-${fields.endTime}은 출력실 차단 일정(${blockLabel(blocked[0])})이 있어 예약할 수 없습니다.`), { status: 409 });
    }
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
            return reservationStart !== null &&
              reservationEnd !== null &&
              intervalsOverlap(reservationStart, reservationEnd, bucket.start, bucket.end);
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

function withReservationDetails(db, reservation) {
  const user = db.users.find((item) => item.id === reservation.userId);
  const equipmentItems = reservation.type === "equipment"
    ? (reservation.fields.equipmentItemIds || []).map((itemId) => db.equipment.find((item) => item.id === itemId)).filter(Boolean)
    : [];
  return { ...reservation, user: user ? publicUser(user) : null, equipmentItems };
}

function reportWithDetails(db, report) {
  return {
    ...report,
    reservation: db.reservations.find((item) => item.id === report.reservationId) || null,
    user: publicUser(db.users.find((item) => item.id === report.userId))
  };
}

const {
  hasListQuery,
  adminReservationList,
  adminReportList,
  adminUserList,
  adminLectureList,
  filterAdminReservations,
  filterAdminReports,
  filterAdminLectures,
  filterAdminNotices
} = createAdminListHelpers({
  withReservationDetails,
  reportWithDetails,
  publicUser,
  lectureDetail
});

function hasNoticeListQuery(searchParams) {
  return Boolean(searchParams && [...searchParams.keys()].some((key) => NOTICE_LIST_QUERY_KEYS.has(key)));
}

function publicReservationSummary(db, reservation) {
  const user = db.users.find((item) => item.id === reservation.userId);
  const equipmentItems = reservation.type === "equipment"
    ? (reservation.fields.equipmentItemIds || []).map((itemId) => db.equipment.find((item) => item.id === itemId)).filter(Boolean)
    : [];
  const fields = reservation.fields || {};
  return {
    id: reservation.id,
    type: reservation.type,
    status: reservation.status,
    userId: reservation.userId,
    userName: user?.name || "예약자",
    userStatus: user?.studentStatus || "",
    fields: {
      reservedDate: fields.reservedDate || "",
      period: fields.period || "",
      rentalTime: fields.rentalTime || "",
      returnTime: fields.returnTime || "",
      timeSlots: fields.timeSlots || [],
      studioSpaces: fields.studioSpaces || [],
      studioSpace: fields.studioSpace || "",
      processTypes: fields.processTypes || [],
      participantCount: fields.participantCount || "",
      printType: fields.printType || "",
      startTime: fields.startTime || "",
      endTime: fields.endTime || "",
      cameraBagConfirmationRequired: Boolean(fields.cameraBagConfirmationRequired),
      cameraBagConfirmed: Boolean(fields.cameraBagConfirmed),
      pelicanBagReserved: Boolean(fields.pelicanBagReserved)
    },
    equipmentItems: equipmentItems.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      category: item.category
    }))
  };
}

function lectureApplicationCount(db, lecture) {
  const internalCount = (db.lectureApplications || []).filter((item) => item.lectureId === lecture.id).length;
  return internalCount + Number(lecture.baseApplicationCount || 0);
}

function lectureStartTimestamp(lecture) {
  const date = String(lecture?.lectureDate || "").trim();
  const timeMatch = String(lecture?.time || "").match(/(\d{1,2}):(\d{2})/);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !timeMatch) return null;
  const hour = String(timeMatch[1]).padStart(2, "0");
  const minute = String(timeMatch[2]).padStart(2, "0");
  const timestamp = Date.parse(`${date}T${hour}:${minute}:00+09:00`);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function canCancelLectureApplication(lecture, now = Date.now()) {
  const startAt = lectureStartTimestamp(lecture);
  if (!startAt) return true;
  return startAt - now > LECTURE_CANCEL_LIMIT_MS;
}

function lectureSummary(db, lecture, user = null) {
  const applications = (db.lectureApplications || []).filter((item) => item.lectureId === lecture.id);
  const applied = user ? applications.some((item) => item.userId === user.id) : false;
  return {
    ...lecture,
    applicationCount: lectureApplicationCount(db, lecture),
    applied,
    canCancelApplication: applied ? canCancelLectureApplication(lecture) : false
  };
}

function lectureDetail(db, lecture) {
  const applications = (db.lectureApplications || [])
    .filter((item) => item.lectureId === lecture.id)
    .map((item) => {
      const user = db.users.find((candidate) => candidate.id === item.userId) || {};
      return {
        ...item,
        userName: item.userName || user.name || "",
        studentId: item.studentId || user.studentId || "",
        studentStatus: item.studentStatus || user.studentStatus || "",
        phone: item.phone || user.phone || "",
        email: item.email || user.email || ""
      };
    });
  return {
    ...lectureSummary(db, lecture),
    applications
  };
}

function withLectureApplicationDetails(db, application) {
  const lecture = db.lectures.find((item) => item.id === application.lectureId) || {};
  return {
    id: application.id,
    type: "lecture",
    status: lecture.status === "취소" ? "cancelled" : "lecture_applied",
    userId: application.userId,
    fields: {
      reservedDate: lecture.lectureDate || "",
      title: lecture.title || "비교과 특강",
      time: lecture.time || "",
      location: lecture.location || "",
      instructorName: lecture.instructorName || "",
      instructorAffiliation: lecture.instructorAffiliation || "",
      professor: lecture.professor || "",
      targetGrades: lecture.targetGrades || "",
      description: lecture.description || "",
      notes: lecture.notes || "",
      appliedAt: application.appliedAt || ""
    },
    lecture: lecture.id ? lectureSummary(db, lecture, null) : null,
    application,
    createdAt: application.appliedAt || "",
    updatedAt: application.appliedAt || ""
  };
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

function loginThrottleKey(loginId) {
  return String(loginId || "").toLowerCase().slice(0, 120);
}

function assertLoginAllowed(loginId) {
  const rec = loginAttempts.get(loginThrottleKey(loginId));
  if (rec && rec.lockedUntil > Date.now()) {
    const seconds = Math.ceil((rec.lockedUntil - Date.now()) / 1000);
    throw Object.assign(new Error(`로그인 시도가 너무 많습니다. ${seconds}초 후 다시 시도하세요.`), { status: 429 });
  }
}

function registerLoginFailure(loginId) {
  if (loginAttempts.size > 10000) loginAttempts.clear();
  const key = loginThrottleKey(loginId);
  const now = Date.now();
  const rec = loginAttempts.get(key) || { count: 0, first: now, lockedUntil: 0 };
  if (now - rec.first > LOGIN_WINDOW_MS) {
    rec.count = 0;
    rec.first = now;
    rec.lockedUntil = 0;
  }
  rec.count += 1;
  if (rec.count >= LOGIN_MAX_ATTEMPTS) rec.lockedUntil = now + LOGIN_LOCK_MS;
  loginAttempts.set(key, rec);
}

function clearLoginFailures(loginId) {
  loginAttempts.delete(loginThrottleKey(loginId));
}

function routeKey(method, pathname) {
  return `${method} ${pathname}`;
}

export function normalizeDb(db) {
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
  if ([LEGACY_STUDENT_URL, LEGACY_ADMIN_URL].includes(db.settings.studentUrl)) {
    db.settings.studentUrl = PRODUCTION_STUDENT_URL;
  }
  if ([LEGACY_STUDENT_URL, LEGACY_ADMIN_URL].includes(db.settings.adminUrl)) {
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

const { cleanupExpiredData: cleanupExpiredDataImpl } = createMaintenanceHelpers({
  normalizeDb,
  capLogs,
  id,
  reservationRetentionDays: RESERVATION_RETENTION_DAYS,
  reportHtmlRetentionDays: REPORT_HTML_RETENTION_DAYS
});

export const cleanupExpiredData = cleanupExpiredDataImpl;

export function adminExportData(db) {
  normalizeDb(db);
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
    importBatches: db.importBatches
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
  let pathname = ctx.pathname || "/";
  let searchParams = ctx.searchParams || new URLSearchParams();
  if (pathname.includes("?")) {
    const parsed = new URL(pathname, "https://gju-reserve.local");
    pathname = parsed.pathname;
    if (!ctx.searchParams) searchParams = parsed.searchParams;
  }
  const saveDb = ctx.saveDb;
  const meta = requestMeta(ctx);

  try {
      if (routeKey(method, pathname) === "GET /api/bootstrap") {
        const user = getAuthUser(authorization, db);
        return ok({
          settings: db.settings,
          darkroomChemicals: db.darkroomChemicals,
          equipment: db.equipment.filter((item) => item.active),
          notices: db.notices.filter((notice) => notice.status === "published"),
          reservations: user
            ? db.reservations
              .filter((reservation) => !["cancelled", "admin_cancelled", "rejected", "returned", "completed"].includes(reservation.status))
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

      if (routeKey(method, pathname) === "GET /api/admin/summary") {
        requireAdmin(authorization, db);
        const pendingUsers = db.users.filter((user) => user.role === "student" && user.approvalStatus === "approval_pending").length;
        const equipmentCheckedOut = db.reservations.filter((item) => item.type === "equipment" && item.status === "checked_out").length;
        const equipmentReturned = db.reservations.filter((item) => item.type === "equipment" && item.status === "returned").length;
        const equipmentCancelled = db.reservations.filter((item) => item.type === "equipment" && item.status === "cancelled").length;
        const today = todayKeySeoul();
        const todayReservations = db.reservations.filter((item) => item.fields.reservedDate === today).length;
        const missingReports = db.reservations.filter((item) => item.type === "studio" && item.status !== "cancelled" && item.fields.reportStatus !== "submitted").length;
        return ok({
          pendingUsers,
          pendingEquipment: equipmentCheckedOut,
          equipmentCheckedOut,
          equipmentReturned,
          equipmentCancelled,
          todayReservations,
          missingReports
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

      const adminReservationStatusMatch = pathname.match(/^\/api\/admin\/reservations\/([^/]+)\/status$/);
      if (method === "PATCH" && adminReservationStatusMatch) {
        const admin = requireAdmin(authorization, db);
        const body = await parseBody(readText);
        const reservation = db.reservations.find((item) => item.id === adminReservationStatusMatch[1]);
        if (!reservation) throw Object.assign(new Error("예약을 찾을 수 없습니다."), { status: 404 });
        assertRequired(body, ["status"]);
        if (!RESERVATION_STATUSES.has(body.status)) {
          throw Object.assign(new Error("지원하지 않는 예약 상태입니다."), { status: 400 });
        }
        reservation.status = reservation.type === "equipment" ? normalizeEquipmentReservationStatus(body.status) : body.status;
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
        const base = body.codePrefix || codeBase(body.category, body.name, db.equipment.length + 1);
        const source = body.source || "department";
        const status = normalizeEquipmentStatus(body.status);
        const reservable = source === "fantasy_lab" ? false : body.reservable !== false && equipmentReservableForStatus(status);
        const created = [];
        for (let index = 1; index <= quantity; index += 1) {
          created.push({
            id: id("eq"),
            facility: body.facility || (source === "fantasy_lab" ? "판타지랩" : "극기관"),
            source,
            category: body.category,
            name: body.name,
            code: `${base}-${String(index).padStart(2, "0")}`,
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
          const reservable = source === "fantasy_lab"
            ? false
            : equipmentReservableForStatus(status) && (row.reservable === true || row.reservable === "true" || row.inquiry_only !== "true");
          const base = row.code_prefix || row.codePrefix || codeBase(category, row.name, db.equipment.length + 1);
          for (let index = 1; index <= quantity; index += 1) {
            const item = {
              id: id("eq"),
              facility: row.facility || (source === "fantasy_lab" ? "판타지랩" : "극기관"),
              source,
              category,
              name: row.name,
              brand: row.brand || "",
              model: row.model || "",
              code: `${base}-${String(index).padStart(2, "0")}`,
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
        if (hasNoticeListQuery(searchParams)) {
          const { items, collectionTotal } = filterAdminNotices(db, Object.fromEntries(searchParams.entries()));
          return ok({
            items,
            total: items.length,
            page: 1,
            pageSize: items.length,
            hasMore: false,
            collectionTotal
          });
        }
        return ok(db.notices);
      }

      if (routeKey(method, pathname) === "DELETE /api/admin/notices/bulk") {
        const admin = requireAdmin(authorization, db);
        const body = await parseBody(readText);
        const result = deleteAdminNotices(db, { ...body, admin, filterAdminNotices });
        audit(db, admin, "notices.bulk_deleted", "notices", result.audit);
        await saveDb();
        return ok(result.summary);
      }

      if (routeKey(method, pathname) === "POST /api/admin/notices") {
        const admin = requireAdmin(authorization, db);
        const body = await parseBody(readText);
        assertRequired(body, ["title", "body"]);
        const notice = {
          id: id("notice"),
          title: body.title,
          category: body.category || "일반",
          body: body.body,
          pinned: body.pinned === true,
          status: "published",
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
