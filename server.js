const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (!key || process.env[key] !== undefined) continue;
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(path.join(__dirname, ".env.local"));
loadEnvFile(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT || 5173);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "db.json");

const ADMIN_DEFAULT_PASSWORD = process.env.ADMIN_PASSWORD || "admin";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const defaultSettings = {
  appName: "GJU-reserve",
  departmentName: "광주대학교 사진영상미디어학과",
  studentUrl: "https://photographygju.dothome.co.kr",
  adminUrl: "https://admin.photographygju.dothome.co.kr",
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
  printTypes: ["과제", "개인 작품"],
  printPapers: ["글로시", "매트"],
  printSizes: ["소형", "중형", "대형"],
  printBankAccount: "Admin 설정에서 출력비 계좌를 입력하세요.",
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
  ["fantasy_lab", "Lighting", "APUTURE Barn doors F10", 2, false, "조명 악세서리, 판타지랩 조교 문의"]
];

function nowIso() {
  return new Date().toISOString();
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function id(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}`;
}

function normalizeStatusLabel(status) {
  const labels = {
    approval_pending: "승인 대기",
    approved: "승인 완료",
    rejected: "반려",
    blocked: "이용 제한",
    pending_approval: "승인 대기",
    auto_confirmed: "자동 확정",
    cancelled: "취소",
    admin_cancelled: "관리자 취소",
    checked_out: "대여 완료",
    returned: "반납 완료",
    completed: "사용 완료",
    warning: "경고"
  };
  return labels[status] || status;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt] = stored.split(":");
  return crypto.timingSafeEqual(Buffer.from(hashPassword(password, salt)), Buffer.from(stored));
}

function maskPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 7) return phone || "";
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
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
        status: "available",
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

function initialDb() {
  return {
    meta: { version: 1, createdAt: nowIso() },
    settings: defaultSettings,
    darkroomChemicals,
    users: [
      {
        id: "user_admin",
        role: "admin",
        username: "admin",
        name: "admin",
        email: "admin@gju.local",
        phone: "",
        studentId: "",
        grade: "",
        studentStatus: "관리자",
        approvalStatus: "approved",
        passwordHash: hashPassword(ADMIN_DEFAULT_PASSWORD),
        createdAt: nowIso(),
        updatedAt: nowIso()
      }
    ],
    sessions: [],
    equipment: seedEquipment(),
    reservations: [],
    reports: [],
    notices: [
      {
        id: id("notice"),
        title: "GJU-reserve 시범 운영 안내",
        category: "긴급",
        body: "학생은 회원가입 후 admin 승인 전까지 예약할 수 없습니다. 기자재 예약은 조교 승인 후 확정됩니다.",
        pinned: true,
        status: "published",
        link: "",
        createdAt: nowIso(),
        updatedAt: nowIso()
      }
    ],
    warnings: [],
    slackLogs: [],
    auditLogs: [],
    importBatches: []
  };
}

function readDb() {
  ensureDir(DATA_DIR);
  if (!fs.existsSync(DB_PATH)) {
    const db = initialDb();
    writeDb(db);
    return db;
  }
  const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  db.settings = { ...defaultSettings, ...(db.settings || {}) };
  db.darkroomChemicals = db.darkroomChemicals || darkroomChemicals;
  db.importBatches = db.importBatches || [];
  return db;
}

function writeDb(db) {
  ensureDir(DATA_DIR);
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}

function cleanSessions(db) {
  const now = Date.now();
  db.sessions = db.sessions.filter((session) => new Date(session.expiresAt).getTime() > now);
}

function getAuthUser(req, db) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  cleanSessions(db);
  const session = db.sessions.find((item) => item.token === token);
  if (!session) return null;
  return db.users.find((user) => user.id === session.userId) || null;
}

function requireUser(req, db) {
  const user = getAuthUser(req, db);
  if (!user) throw Object.assign(new Error("로그인이 필요합니다."), { status: 401 });
  return user;
}

function requireAdmin(req, db) {
  const user = requireUser(req, db);
  if (user.role !== "admin") throw Object.assign(new Error("관리자 권한이 필요합니다."), { status: 403 });
  return user;
}

function requireApprovedStudent(req, db) {
  const user = requireUser(req, db);
  if (user.role !== "admin" && user.approvalStatus !== "approved") {
    throw Object.assign(new Error("관리자 승인 후 예약할 수 있습니다."), { status: 403 });
  }
  return user;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024 * 4) {
        reject(Object.assign(new Error("요청 본문이 너무 큽니다."), { status: 413 }));
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(Object.assign(new Error("JSON 형식이 올바르지 않습니다."), { status: 400 }));
      }
    });
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendOk(res, data = null) {
  sendJson(res, 200, { ok: true, data });
}

function sendError(res, error) {
  const status = error.status || 500;
  sendJson(res, status, { ok: false, error: error.message || "서버 오류가 발생했습니다." });
}

function assertRequired(body, fields) {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      throw Object.assign(new Error(`${field} 값이 필요합니다.`), { status: 400 });
    }
  }
}

function reservationTitle(type) {
  return {
    equipment: "기자재",
    studio: "스튜디오",
    darkroom: "암실",
    print: "출력실"
  }[type] || type;
}

function reservationStatusForType(type) {
  return type === "equipment" ? "pending_approval" : "auto_confirmed";
}

function slotSet(value) {
  return new Set(Array.isArray(value) ? value : []);
}

function hasOverlap(a, b) {
  const bSet = slotSet(b);
  return [...slotSet(a)].some((slot) => bSet.has(slot));
}

function studioSpaces(fields = {}) {
  if (Array.isArray(fields.studioSpaces) && fields.studioSpaces.length) return fields.studioSpaces;
  return fields.studioSpace ? [fields.studioSpace] : [];
}

function validateReservation(db, type, fields, editingId = null) {
  if (!["equipment", "studio", "darkroom", "print"].includes(type)) {
    throw Object.assign(new Error("지원하지 않는 예약 종류입니다."), { status: 400 });
  }

  if (type === "equipment") {
    assertRequired(fields, ["reservedDate", "period", "rentalTime", "returnTime", "phone"]);
    if (!Array.isArray(fields.equipmentItemIds) || fields.equipmentItemIds.length === 0) {
      throw Object.assign(new Error("기자재를 1개 이상 선택해야 합니다."), { status: 400 });
    }
    for (const itemId of fields.equipmentItemIds) {
      const item = db.equipment.find((eq) => eq.id === itemId);
      if (!item || !item.active || !item.reservable) {
        throw Object.assign(new Error("예약할 수 없는 기자재가 포함되어 있습니다."), { status: 400 });
      }
      const conflict = db.reservations.find((reservation) => {
        if (reservation.id === editingId || reservation.type !== "equipment") return false;
        if (["cancelled", "admin_cancelled", "rejected", "returned"].includes(reservation.status)) return false;
        if (reservation.fields.reservedDate !== fields.reservedDate) return false;
        return Array.isArray(reservation.fields.equipmentItemIds) && reservation.fields.equipmentItemIds.includes(itemId);
      });
      if (conflict) {
        throw Object.assign(new Error(`${item.code} 기자재가 해당 날짜에 이미 예약되어 있습니다.`), { status: 409 });
      }
    }
  }

  if (type === "studio") {
    assertRequired(fields, ["reservedDate", "phone"]);
    if (!Array.isArray(fields.timeSlots) || fields.timeSlots.length === 0) {
      throw Object.assign(new Error("사용 시간을 선택해야 합니다."), { status: 400 });
    }
    if (studioSpaces(fields).length === 0) {
      throw Object.assign(new Error("사용 장소를 1개 이상 선택해야 합니다."), { status: 400 });
    }
    if (fields.timeSlots.length > db.settings.studioMaxSlots) {
      throw Object.assign(new Error(`스튜디오는 최대 ${db.settings.studioMaxSlots}타임까지 예약할 수 있습니다.`), { status: 400 });
    }
    const selectedSpaces = studioSpaces(fields);
    const conflict = db.reservations.find((reservation) => {
      if (reservation.id === editingId || reservation.type !== "studio") return false;
      if (["cancelled", "admin_cancelled", "rejected"].includes(reservation.status)) return false;
      return reservation.fields.reservedDate === fields.reservedDate &&
        hasOverlap(studioSpaces(reservation.fields), selectedSpaces) &&
        hasOverlap(reservation.fields.timeSlots, fields.timeSlots);
    });
    if (conflict) {
      throw Object.assign(new Error("선택한 스튜디오와 시간에 이미 예약이 있습니다."), { status: 409 });
    }
  }

  if (type === "darkroom") {
    assertRequired(fields, ["reservedDate", "phone"]);
    if (!Array.isArray(fields.timeSlots) || fields.timeSlots.length === 0) {
      throw Object.assign(new Error("암실 사용 시간을 선택해야 합니다."), { status: 400 });
    }
    const participantCount = Math.max(1, Number(fields.participantCount || 1));
    for (const slot of fields.timeSlots) {
      const reservedCount = db.reservations
        .filter((reservation) => reservation.id !== editingId)
        .filter((reservation) => reservation.type === "darkroom")
        .filter((reservation) => !["cancelled", "admin_cancelled", "rejected"].includes(reservation.status))
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
    if (fields.startTime < db.settings.printAvailableStart || fields.endTime > db.settings.printAvailableEnd) {
      throw Object.assign(new Error(`출력실 사용 가능 시간은 ${db.settings.printAvailableStart}-${db.settings.printAvailableEnd}입니다.`), { status: 400 });
    }
  }
}

function withReservationDetails(db, reservation) {
  const user = db.users.find((item) => item.id === reservation.userId);
  const equipmentItems = reservation.type === "equipment"
    ? (reservation.fields.equipmentItemIds || []).map((itemId) => db.equipment.find((item) => item.id === itemId)).filter(Boolean)
    : [];
  return {
    ...reservation,
    user: user ? publicUser(user) : null,
    equipmentItems
  };
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
      endTime: fields.endTime || ""
    },
    equipmentItems: equipmentItems.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      category: item.category
    }))
  };
}

function formatSlackMessage(db, event, reservation) {
  const user = db.users.find((item) => item.id === reservation.userId) || {};
  const title = {
    student_signup: "[학생 가입 승인 요청]",
    reservation_created: `[${reservationTitle(reservation.type)} 예약 ${reservation.type === "equipment" ? "승인 요청" : "확정"}]`,
    reservation_updated: `[${reservationTitle(reservation.type)} 예약 수정]`,
    reservation_cancelled: `[${reservationTitle(reservation.type)} 예약 취소]`,
    reservation_status: `[${reservationTitle(reservation.type)} 상태 변경]`,
    studio_report: "[스튜디오 보고서 제출]"
  }[event] || "[GJU-reserve]";

  if (event === "student_signup") {
    return `${title}\n이름: ${reservation.name}\n학번: ${reservation.studentId || "-"}\n신분: ${reservation.studentStatus}\n연락처: ${maskPhone(reservation.phone)}\n상태: 승인 대기`;
  }

  const fields = reservation.fields || {};
  const detailUrl = `${db.settings.adminUrl}/reservations/${reservation.id}`;
  const lines = [
    title,
    `예약자: ${user.name || "-"} / ${maskPhone(fields.phone || user.phone)}`,
    `신분: ${fields.studentStatus || user.studentStatus || "-"}`,
    `사용일: ${fields.reservedDate || "-"}`,
    `상태: ${normalizeStatusLabel(reservation.status)}`
  ];

  if (reservation.type === "equipment") {
    const items = (fields.equipmentItemIds || [])
      .map((itemId) => db.equipment.find((item) => item.id === itemId))
      .filter(Boolean)
      .map((item) => item.code)
      .join(", ");
    lines.splice(4, 0, `대여시간: ${fields.rentalTime}`, `반납시간: ${fields.returnTime}`, `품목: ${items || fields.detailEquipment || "-"}`);
  }
  if (reservation.type === "studio") {
    lines.splice(4, 0, `시간: ${(fields.timeSlots || []).join(", ")}`, `장소: ${studioSpaces(fields).join(", ")}`, `필요 장비: ${fields.requiredEquipment || "-"}`);
  }
  if (reservation.type === "darkroom") {
    const chemicals = (fields.chemicals || []).map((item) => `${item.name} ${item.amount}`).join(", ");
    lines.splice(4, 0, `시간: ${(fields.timeSlots || []).join(", ")}`, `작업: ${(fields.processTypes || []).join(", ")}`, `사용 약품: ${chemicals || "-"}`);
  }
  if (reservation.type === "print") {
    lines.splice(4, 0, `시간: ${fields.startTime}-${fields.endTime}`, `출력: ${fields.printType} / ${fields.paper} / ${fields.size}`, `매수: ${fields.count || "-"}`);
  }

  lines.push(`상세: ${detailUrl}`);
  return lines.join("\n");
}

async function postSlack(db, event, payload) {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  const log = {
    id: id("slack"),
    event,
    status: "skipped",
    message: "",
    createdAt: nowIso()
  };
  const text = typeof payload === "string" ? payload : formatSlackMessage(db, event, payload);
  log.message = text;

  if (!webhook) {
    db.slackLogs.push(log);
    return log;
  }

  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text })
    });
    const body = await response.text();
    log.status = response.ok ? "sent" : "failed";
    log.response = body;
  } catch (error) {
    log.status = "failed";
    log.response = error.message;
  }
  db.slackLogs.push(log);
  return log;
}

function audit(db, actor, action, targetId, detail = {}) {
  db.auditLogs.push({
    id: id("audit"),
    actorId: actor ? actor.id : null,
    action,
    targetId,
    detail,
    createdAt: nowIso()
  });
}

function routeKey(method, pathname) {
  return `${method} ${pathname}`;
}

async function handleApi(req, res, pathname) {
  const db = readDb();
  const method = req.method || "GET";

  try {
    if (routeKey(method, pathname) === "GET /api/bootstrap") {
      sendOk(res, {
        settings: db.settings,
        darkroomChemicals: db.darkroomChemicals,
        equipment: db.equipment.filter((item) => item.active),
        notices: db.notices.filter((notice) => notice.status === "published"),
        reservations: db.reservations
          .filter((reservation) => !["cancelled", "admin_cancelled", "rejected", "returned", "completed"].includes(reservation.status))
          .map((reservation) => publicReservationSummary(db, reservation))
      });
      return;
    }

    if (routeKey(method, pathname) === "GET /api/me") {
      const user = getAuthUser(req, db);
      sendOk(res, { user: publicUser(user) });
      return;
    }

    if (routeKey(method, pathname) === "POST /api/auth/signup") {
      const body = await parseBody(req);
      assertRequired(body, ["name", "studentStatus", "phone", "email", "password"]);
      if (db.users.some((user) => user.email === body.email)) {
        throw Object.assign(new Error("이미 가입된 이메일입니다."), { status: 409 });
      }
      if (body.studentId && db.users.some((user) => user.studentId === body.studentId)) {
        throw Object.assign(new Error("이미 가입된 학번입니다."), { status: 409 });
      }
      const user = {
        id: id("user"),
        role: "student",
        username: "",
        name: body.name,
        email: body.email,
        phone: body.phone,
        studentId: body.studentId || "",
        grade: body.grade || "",
        studentStatus: body.studentStatus,
        approvalStatus: "approval_pending",
        passwordHash: hashPassword(body.password),
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
      db.users.push(user);
      await postSlack(db, "student_signup", user);
      writeDb(db);
      sendOk(res, { user: publicUser(user) });
      return;
    }

    if (routeKey(method, pathname) === "POST /api/auth/login") {
      const body = await parseBody(req);
      assertRequired(body, ["loginId", "password"]);
      const user = db.users.find((item) => {
        if (body.loginId === "admin" && item.username === "admin") return true;
        return item.email === body.loginId || item.studentId === body.loginId || item.username === body.loginId;
      });
      if (!user || !verifyPassword(body.password, user.passwordHash)) {
        throw Object.assign(new Error("아이디 또는 비밀번호가 올바르지 않습니다."), { status: 401 });
      }
      const token = crypto.randomBytes(32).toString("hex");
      db.sessions.push({
        id: id("session"),
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
        createdAt: nowIso()
      });
      writeDb(db);
      sendOk(res, { token, user: publicUser(user) });
      return;
    }

    if (routeKey(method, pathname) === "POST /api/auth/logout") {
      const body = await parseBody(req);
      db.sessions = db.sessions.filter((session) => session.token !== body.token);
      writeDb(db);
      sendOk(res);
      return;
    }

    if (routeKey(method, pathname) === "GET /api/reservations/my") {
      const user = requireUser(req, db);
      sendOk(res, db.reservations.filter((item) => item.userId === user.id).map((item) => withReservationDetails(db, item)));
      return;
    }

    if (routeKey(method, pathname) === "POST /api/reservations") {
      const user = requireApprovedStudent(req, db);
      const body = await parseBody(req);
      assertRequired(body, ["type", "fields"]);
      validateReservation(db, body.type, body.fields);
      const reservation = {
        id: id("res"),
        type: body.type,
        userId: user.id,
        status: reservationStatusForType(body.type),
        fields: {
          ...body.fields,
          studentStatus: user.studentStatus,
          phone: body.fields.phone || user.phone
        },
        history: [
          { at: nowIso(), actorId: user.id, action: "created", status: reservationStatusForType(body.type) }
        ],
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
      db.reservations.push(reservation);
      audit(db, user, "reservation.created", reservation.id, { type: reservation.type });
      await postSlack(db, "reservation_created", reservation);
      writeDb(db);
      sendOk(res, withReservationDetails(db, reservation));
      return;
    }

    const reservationCancelMatch = pathname.match(/^\/api\/reservations\/([^/]+)\/cancel$/);
    if (method === "POST" && reservationCancelMatch) {
      const user = requireUser(req, db);
      const reservation = db.reservations.find((item) => item.id === reservationCancelMatch[1]);
      if (!reservation) throw Object.assign(new Error("예약을 찾을 수 없습니다."), { status: 404 });
      if (user.role !== "admin" && reservation.userId !== user.id) {
        throw Object.assign(new Error("본인의 예약만 취소할 수 있습니다."), { status: 403 });
      }
      const body = await parseBody(req);
      reservation.status = user.role === "admin" ? "admin_cancelled" : "cancelled";
      reservation.cancelReason = body.reason || "";
      reservation.updatedAt = nowIso();
      reservation.history.push({ at: nowIso(), actorId: user.id, action: "cancelled", reason: body.reason || "" });
      audit(db, user, "reservation.cancelled", reservation.id, { reason: body.reason || "" });
      await postSlack(db, "reservation_cancelled", reservation);
      writeDb(db);
      sendOk(res, withReservationDetails(db, reservation));
      return;
    }

    const reservationPatchMatch = pathname.match(/^\/api\/reservations\/([^/]+)$/);
    if (method === "PATCH" && reservationPatchMatch) {
      const user = requireUser(req, db);
      const reservation = db.reservations.find((item) => item.id === reservationPatchMatch[1]);
      if (!reservation) throw Object.assign(new Error("예약을 찾을 수 없습니다."), { status: 404 });
      if (user.role !== "admin" && reservation.userId !== user.id) {
        throw Object.assign(new Error("본인의 예약만 수정할 수 있습니다."), { status: 403 });
      }
      const body = await parseBody(req);
      const nextFields = { ...reservation.fields, ...(body.fields || {}) };
      validateReservation(db, reservation.type, nextFields, reservation.id);
      reservation.fields = nextFields;
      reservation.updatedAt = nowIso();
      reservation.history.push({ at: nowIso(), actorId: user.id, action: "updated" });
      audit(db, user, "reservation.updated", reservation.id);
      await postSlack(db, "reservation_updated", reservation);
      writeDb(db);
      sendOk(res, withReservationDetails(db, reservation));
      return;
    }

    if (routeKey(method, pathname) === "POST /api/reports/studio") {
      const user = requireApprovedStudent(req, db);
      const body = await parseBody(req);
      assertRequired(body, ["reservationId", "actualTime", "participants", "cleanupConfirmed"]);
      const reservation = db.reservations.find((item) => item.id === body.reservationId && item.type === "studio");
      if (!reservation) throw Object.assign(new Error("스튜디오 예약을 찾을 수 없습니다."), { status: 404 });
      if (user.role !== "admin" && reservation.userId !== user.id) {
        throw Object.assign(new Error("본인의 스튜디오 예약 보고서만 제출할 수 있습니다."), { status: 403 });
      }
      const report = {
        id: id("report"),
        type: "studio",
        reservationId: reservation.id,
        userId: user.id,
        fields: body,
        htmlSnapshot: `<article><h1>스튜디오 보고서</h1><p>예약: ${reservation.id}</p><p>사용 시간: ${body.actualTime}</p><p>인원: ${body.participants}</p><p>파손/이상: ${body.damageFound ? body.damageDescription || "있음" : "없음"}</p></article>`,
        submittedAt: nowIso(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 183).toISOString()
      };
      db.reports.push(report);
      reservation.fields.reportStatus = "submitted";
      reservation.updatedAt = nowIso();
      reservation.history.push({ at: nowIso(), actorId: user.id, action: "studio_report_submitted", reportId: report.id });
      audit(db, user, "studio_report.created", report.id, { reservationId: reservation.id });
      await postSlack(db, "studio_report", reservation);
      writeDb(db);
      sendOk(res, report);
      return;
    }

    if (routeKey(method, pathname) === "GET /api/admin/summary") {
      requireAdmin(req, db);
      const pendingUsers = db.users.filter((user) => user.role === "student" && user.approvalStatus === "approval_pending").length;
      const pendingEquipment = db.reservations.filter((item) => item.type === "equipment" && item.status === "pending_approval").length;
      const today = new Date().toISOString().slice(0, 10);
      const todayReservations = db.reservations.filter((item) => item.fields.reservedDate === today).length;
      const missingReports = db.reservations.filter((item) => item.type === "studio" && item.status !== "cancelled" && item.fields.reportStatus !== "submitted").length;
      sendOk(res, { pendingUsers, pendingEquipment, todayReservations, missingReports });
      return;
    }

    if (routeKey(method, pathname) === "GET /api/admin/users") {
      requireAdmin(req, db);
      sendOk(res, db.users.map(publicUser));
      return;
    }

    const userApprovalMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/approval$/);
    if (method === "PATCH" && userApprovalMatch) {
      const admin = requireAdmin(req, db);
      const body = await parseBody(req);
      const user = db.users.find((item) => item.id === userApprovalMatch[1]);
      if (!user) throw Object.assign(new Error("사용자를 찾을 수 없습니다."), { status: 404 });
      user.approvalStatus = body.approvalStatus || "approved";
      user.updatedAt = nowIso();
      audit(db, admin, "user.approval_changed", user.id, { approvalStatus: user.approvalStatus });
      writeDb(db);
      sendOk(res, publicUser(user));
      return;
    }

    if (routeKey(method, pathname) === "GET /api/admin/reservations") {
      requireAdmin(req, db);
      sendOk(res, db.reservations.map((item) => withReservationDetails(db, item)));
      return;
    }

    const adminReservationStatusMatch = pathname.match(/^\/api\/admin\/reservations\/([^/]+)\/status$/);
    if (method === "PATCH" && adminReservationStatusMatch) {
      const admin = requireAdmin(req, db);
      const body = await parseBody(req);
      const reservation = db.reservations.find((item) => item.id === adminReservationStatusMatch[1]);
      if (!reservation) throw Object.assign(new Error("예약을 찾을 수 없습니다."), { status: 404 });
      assertRequired(body, ["status"]);
      reservation.status = body.status;
      reservation.adminNote = body.adminNote || reservation.adminNote || "";
      reservation.updatedAt = nowIso();
      reservation.history.push({ at: nowIso(), actorId: admin.id, action: "status_changed", status: body.status });
      audit(db, admin, "reservation.status_changed", reservation.id, { status: body.status });
      await postSlack(db, "reservation_status", reservation);
      writeDb(db);
      sendOk(res, withReservationDetails(db, reservation));
      return;
    }

    if (routeKey(method, pathname) === "GET /api/admin/equipment") {
      requireAdmin(req, db);
      sendOk(res, db.equipment);
      return;
    }

    if (routeKey(method, pathname) === "POST /api/admin/equipment") {
      const admin = requireAdmin(req, db);
      const body = await parseBody(req);
      assertRequired(body, ["name", "category"]);
      const quantity = Math.max(1, Number(body.quantity || 1));
      const base = body.codePrefix || codeBase(body.category, body.name, db.equipment.length + 1);
      const source = body.source || "department";
      const created = [];
      for (let index = 1; index <= quantity; index += 1) {
        created.push({
          id: id("eq"),
          facility: body.facility || (source === "fantasy_lab" ? "판타지랩" : "극기관"),
          source,
          category: body.category,
          name: body.name,
          code: `${base}-${String(index).padStart(2, "0")}`,
          status: body.status || "available",
          reservable: body.reservable !== false,
          inquiryOnly: body.inquiryOnly === true,
          notes: body.notes || "",
          active: true,
          createdAt: nowIso(),
          updatedAt: nowIso()
        });
      }
      db.equipment.push(...created);
      audit(db, admin, "equipment.created", created.map((item) => item.id).join(","), { count: created.length });
      writeDb(db);
      sendOk(res, created);
      return;
    }

    if (routeKey(method, pathname) === "POST /api/admin/equipment/import") {
      const admin = requireAdmin(req, db);
      const body = await parseBody(req);
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
        const reservable = row.reservable === true || row.reservable === "true" || (source !== "fantasy_lab" && row.inquiry_only !== "true");
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
            status: row.status || "available",
            reservable,
            inquiryOnly: !reservable,
            notes: row.notes || "",
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
      writeDb(db);
      sendOk(res, batch);
      return;
    }

    const equipmentPatchMatch = pathname.match(/^\/api\/admin\/equipment\/([^/]+)$/);
    if (method === "PATCH" && equipmentPatchMatch) {
      const admin = requireAdmin(req, db);
      const body = await parseBody(req);
      const item = db.equipment.find((eq) => eq.id === equipmentPatchMatch[1]);
      if (!item) throw Object.assign(new Error("기자재를 찾을 수 없습니다."), { status: 404 });
      Object.assign(item, body, { updatedAt: nowIso() });
      audit(db, admin, "equipment.updated", item.id, body);
      writeDb(db);
      sendOk(res, item);
      return;
    }

    if (routeKey(method, pathname) === "GET /api/admin/reports") {
      requireAdmin(req, db);
      sendOk(res, db.reports.map((report) => ({
        ...report,
        reservation: db.reservations.find((item) => item.id === report.reservationId),
        user: publicUser(db.users.find((item) => item.id === report.userId))
      })));
      return;
    }

    if (routeKey(method, pathname) === "GET /api/admin/notices") {
      requireAdmin(req, db);
      sendOk(res, db.notices);
      return;
    }

    if (routeKey(method, pathname) === "POST /api/admin/notices") {
      const admin = requireAdmin(req, db);
      const body = await parseBody(req);
      assertRequired(body, ["title", "body"]);
      const notice = {
        id: id("notice"),
        title: body.title,
        category: body.category || "일반",
        body: body.body,
        pinned: body.pinned === true,
        status: "published",
        link: body.link || "",
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
      db.notices.push(notice);
      audit(db, admin, "notice.created", notice.id);
      writeDb(db);
      sendOk(res, notice);
      return;
    }

    if (routeKey(method, pathname) === "GET /api/admin/settings") {
      requireAdmin(req, db);
      sendOk(res, db.settings);
      return;
    }

    if (routeKey(method, pathname) === "PATCH /api/admin/settings") {
      const admin = requireAdmin(req, db);
      const body = await parseBody(req);
      db.settings = { ...db.settings, ...body, updatedAt: nowIso() };
      audit(db, admin, "settings.updated", "settings", body);
      writeDb(db);
      sendOk(res, db.settings);
      return;
    }

    throw Object.assign(new Error("API 경로를 찾을 수 없습니다."), { status: 404 });
  } catch (error) {
    writeDb(db);
    sendError(res, error);
  }
}

function serveStatic(req, res, pathname) {
  let filePath = pathname === "/" ? path.join(PUBLIC_DIR, "index.html") : path.join(PUBLIC_DIR, pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(PUBLIC_DIR, "index.html");
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { "content-type": MIME_TYPES[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) {
    await handleApi(req, res, url.pathname);
    return;
  }
  serveStatic(req, res, url.pathname);
});

server.listen(PORT, "127.0.0.1", () => {
  readDb();
  console.log(`GJU-reserve dev server running at http://localhost:${PORT}`);
  console.log("Admin login: admin / admin (development default; change before production)");
});
