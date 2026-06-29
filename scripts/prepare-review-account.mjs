import process from "node:process";

const DEFAULT_API_BASE = "https://photographygju-reserve.taejunyun.workers.dev";
const REVIEW_TAG = "app-review-2026";

function env(name, fallback = "") {
  return process.env[name] || fallback;
}

const apiBase = env("GJU_REVIEW_API_BASE", DEFAULT_API_BASE).replace(/\/+$/, "");
const adminLoginId = env("GJU_REVIEW_ADMIN_ID", "admin");
const adminPassword = env("GJU_REVIEW_ADMIN_PASSWORD", env("ADMIN_PASSWORD"));
const studentEmail = env("GJU_REVIEW_STUDENT_EMAIL", "appreview-student@gju.local");
const studentId = env("GJU_REVIEW_STUDENT_ID", "APPREVIEW2026");
const studentPassword = env("GJU_REVIEW_STUDENT_PASSWORD");
const studentName = env("GJU_REVIEW_STUDENT_NAME", "App Review Student");
const studentPhone = env("GJU_REVIEW_STUDENT_PHONE", "01000000000");
const studentStatus = env("GJU_REVIEW_STUDENT_STATUS", "재학생");
const studentGrade = env("GJU_REVIEW_STUDENT_GRADE", "4");

function usage() {
  console.error(`Usage:
  GJU_REVIEW_ADMIN_PASSWORD='...' GJU_REVIEW_STUDENT_PASSWORD='...' npm run review:prepare-account

Optional:
  GJU_REVIEW_API_BASE='${DEFAULT_API_BASE}'
  GJU_REVIEW_ADMIN_ID='admin'
  GJU_REVIEW_STUDENT_EMAIL='${studentEmail}'
  GJU_REVIEW_STUDENT_ID='${studentId}'
  GJU_REVIEW_STUDENT_NAME='${studentName}'

The script never prints passwords. Put the review account password only in App Store Connect review notes.`);
}

if (!adminPassword || !studentPassword) {
  usage();
  process.exit(1);
}

async function api(method, path, body = undefined, token = "") {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let payload = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { ok: false, error: text };
    }
  }
  return { response, status: response.status, ok: response.ok && payload.ok !== false, payload };
}

function dataOrThrow(result, label) {
  if (!result.ok) {
    const detail = result.payload?.error || result.response.statusText || "Request failed";
    throw new Error(`${label} failed (${result.status}): ${detail}`);
  }
  return result.payload?.data;
}

function dateKey(daysFromNow) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + daysFromNow);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function login(loginId, password, label) {
  const result = await api("POST", "/api/auth/login", { loginId, password });
  return dataOrThrow(result, `${label} login`);
}

async function findReviewUser(adminToken) {
  const query = encodeURIComponent(studentEmail);
  const users = dataOrThrow(
    await api("GET", `/api/admin/users?page=1&pageSize=100&role=student&q=${query}`, undefined, adminToken),
    "Find review student"
  );
  const items = Array.isArray(users) ? users : users.items || [];
  return items.find((user) => user.email === studentEmail || user.studentId === studentId) || null;
}

async function ensureReviewStudent(adminToken) {
  let user = await findReviewUser(adminToken);
  if (!user) {
    const signup = await api("POST", "/api/auth/signup", {
      name: studentName,
      studentStatus,
      phone: studentPhone,
      email: studentEmail,
      studentId,
      grade: studentGrade,
      password: studentPassword
    });
    if (signup.status !== 409) dataOrThrow(signup, "Create review student");
    user = await findReviewUser(adminToken);
  }
  if (!user) throw new Error("Review student was not found after signup.");
  if (user.approvalStatus !== "approved") {
    user = dataOrThrow(
      await api("PATCH", `/api/admin/users/${user.id}/approval`, { approvalStatus: "approved" }, adminToken),
      "Approve review student"
    );
  }
  return user;
}

function hasReviewReservation(items, type) {
  return items.some((item) => item.type === type && item.fields?.reviewTag === REVIEW_TAG && !["cancelled", "admin_cancelled", "rejected"].includes(item.status));
}

async function createWithFallback(studentToken, type, makeFields, label) {
  for (let offset = 7; offset <= 45; offset += 1) {
    const result = await api("POST", "/api/reservations", {
      type,
      fields: makeFields(dateKey(offset))
    }, studentToken);
    if (result.ok) return result.payload.data;
    if (![400, 409].includes(result.status)) dataOrThrow(result, label);
  }
  throw new Error(`${label} failed: no available future date found.`);
}

async function ensureReviewReservations(studentToken) {
  const bootstrap = dataOrThrow(await api("GET", "/api/bootstrap", undefined, studentToken), "Load bootstrap");
  const myReservations = dataOrThrow(await api("GET", "/api/reservations/my", undefined, studentToken), "Load my reservations");
  const created = [];

  if (!hasReviewReservation(myReservations, "studio")) {
    created.push(await createWithFallback(studentToken, "studio", (reservedDate) => ({
      reservedDate,
      phone: studentPhone,
      studioSpace: "Studio A Front",
      studioSpaces: ["Studio A Front"],
      timeSlots: ["10:30-12:00"],
      participants: studentName,
      requiredEquipment: "-",
      purpose: "App Review sample reservation",
      reviewTag: REVIEW_TAG
    }), "Create review studio reservation"));
  }

  if (!hasReviewReservation(myReservations, "print")) {
    created.push(await createWithFallback(studentToken, "print", (reservedDate) => ({
      reservedDate,
      startTime: "10:00",
      endTime: "11:00",
      phone: studentPhone,
      printType: "과제",
      paper: "글로시",
      size: "소형",
      request: "App Review sample print reservation",
      reviewTag: REVIEW_TAG
    }), "Create review print reservation"));
  }

  if (!hasReviewReservation(myReservations, "equipment")) {
    const item = (bootstrap.equipment || []).find((candidate) => candidate.active !== false && candidate.reservable !== false);
    if (!item) throw new Error("No reservable equipment item is available for the review account.");
    created.push(await createWithFallback(studentToken, "equipment", (reservedDate) => ({
      reservedDate,
      period: "당일",
      rentalTime: "10:15",
      returnTime: "17:10",
      phone: studentPhone,
      equipmentItemIds: [item.id],
      purpose: "App Review sample equipment reservation",
      cameraBagConfirmed: true,
      reviewTag: REVIEW_TAG
    }), "Create review equipment reservation"));
  }

  return created;
}

async function ensureReviewLecture(adminToken, studentToken) {
  const lectures = dataOrThrow(await api("GET", "/api/admin/lectures", undefined, adminToken), "Load admin lectures");
  let lecture = lectures.find((item) => item.notes === REVIEW_TAG || item.title === "App Review 샘플 특강");
  if (!lecture) {
    lecture = dataOrThrow(await api("POST", "/api/admin/lectures", {
      title: "App Review 샘플 특강",
      lectureDate: dateKey(21),
      time: "14:00-16:00",
      location: "사진영상미디어학과",
      instructorName: "GJU Review",
      instructorAffiliation: "GJU Photography",
      professor: "App Review",
      targetGrades: "전체",
      capacity: 30,
      description: "App Review 계정에서 비교과 특강 신청 상태를 확인하기 위한 사전 생성 데이터입니다.",
      status: "모집중",
      notes: REVIEW_TAG
    }, adminToken), "Create review lecture");
  }

  const studentLectures = dataOrThrow(await api("GET", "/api/lectures", undefined, studentToken), "Load student lectures");
  const studentLecture = studentLectures.find((item) => item.id === lecture.id);
  if (studentLecture && !studentLecture.applied && studentLecture.status === "모집중") {
    await dataOrThrow(await api("POST", `/api/lectures/${lecture.id}/apply`, {}, studentToken), "Apply review lecture");
  }
  return lecture;
}

const admin = await login(adminLoginId, adminPassword, "Admin");
const student = await ensureReviewStudent(admin.token);
const studentSession = await login(studentEmail, studentPassword, "Review student");
const createdReservations = await ensureReviewReservations(studentSession.token);
const lecture = await ensureReviewLecture(admin.token, studentSession.token);
const finalReservations = dataOrThrow(await api("GET", "/api/reservations/my", undefined, studentSession.token), "Reload review reservations");

console.log("App Review account is ready.");
console.log(`API: ${apiBase}`);
console.log(`ID: ${studentEmail}`);
console.log("Password: use GJU_REVIEW_STUDENT_PASSWORD value; not printed here.");
console.log(`Account status: ${student.approvalStatus === "approved" ? "approved" : "check App Store notes"}`);
console.log(`Pre-populated reservations: ${finalReservations.filter((item) => item.fields?.reviewTag === REVIEW_TAG).length}`);
console.log(`Created reservations this run: ${createdReservations.length}`);
console.log(`Review lecture: ${lecture.title} (${lecture.lectureDate})`);
