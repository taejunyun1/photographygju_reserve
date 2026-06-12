const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const DB_PATH = path.join(ROOT, "data", "db.json");

function nowIso() {
  return new Date().toISOString();
}

// Must match core.mjs hashPassword (PBKDF2-SHA256, 100000 iters, pbkdf2: prefix).
function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256").toString("hex");
  return `pbkdf2:${salt}:${hash}`;
}

function upsertUser(db, user, password) {
  const existing = db.users.find((item) => {
    if (item.id === user.id) return true;
    if (user.username && item.username === user.username) return true;
    if (user.email && item.email === user.email) return true;
    if (user.studentId && item.studentId === user.studentId) return true;
    return false;
  });
  if (existing) {
    Object.assign(existing, user, {
      id: existing.id,
      passwordHash: password ? hashPassword(password) : existing.passwordHash,
      updatedAt: nowIso()
    });
    return existing;
  }

  const next = {
    id: user.id,
    ...user,
    passwordHash: hashPassword(password),
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  db.users.push(next);
  return next;
}

if (!fs.existsSync(DB_PATH)) {
  console.error("data/db.json이 없습니다. 먼저 npm run dev를 한 번 실행해서 DB를 생성하세요.");
  process.exit(1);
}

const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));

upsertUser(db, {
  id: "user_admin",
  role: "admin",
  username: "admin",
  name: "admin",
  email: "admin@gju.local",
  phone: "",
  studentId: "",
  grade: "",
  studentStatus: "관리자",
  approvalStatus: "approved"
}, "admin");

upsertUser(db, {
  id: "user_ta_demo",
  role: "admin",
  username: "ta",
  name: "조교 데모",
  email: "ta@gju.local",
  phone: "010-0000-1000",
  studentId: "",
  grade: "",
  studentStatus: "관리자",
  approvalStatus: "approved"
}, "ta1234");

const students = [
  ["user_student_01", "김현석", "20260001", "1학년", "재학생", "010-3954-6412", "student01@gju.local", "approved"],
  ["user_student_02", "박찬희", "20260002", "2학년", "재학생", "010-2715-6779", "student02@gju.local", "approved"],
  ["user_student_03", "정예은", "20260003", "3학년", "휴학생", "010-9874-1976", "student03@gju.local", "approved"],
  ["user_student_04", "오승훈", "20260004", "4학년", "졸업생", "010-1111-2222", "student04@gju.local", "approved"],
  ["user_student_05", "임효주", "20260005", "대학원", "대학원생", "010-3333-4444", "student05@gju.local", "approved"],
  ["user_student_pending", "민서연", "20260006", "1학년", "재학생", "010-5555-6666", "pending@gju.local", "approval_pending"]
];

for (const [id, name, studentId, grade, studentStatus, phone, email, approvalStatus] of students) {
  upsertUser(db, {
    id,
    role: "student",
    username: "",
    name,
    email,
    phone,
    studentId,
    grade,
    studentStatus,
    approvalStatus
  }, "student1234");
}

db.sessions = [];

fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

console.log("Demo accounts seeded.");
console.log("admin / admin");
console.log("ta / ta1234");
console.log("20260001-20260006 / student1234");
