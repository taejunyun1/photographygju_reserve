export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;
export const PASSWORD_MIN_LENGTH = 8;

const PASSWORD_ITERATIONS = 100000;
const LOGIN_MAX_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LOCK_MS = 5 * 60 * 1000;
const LIMIT_DURATION_DAYS = { week1: 7, week2: 14, month1: 30, semester: 120 };

export function createAuthSessionHelpers({ id, nowIso }) {
  const loginAttempts = new Map();

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

  function cleanMeta(value, max = 240) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
  }

  function requestMeta(ctx) {
    return { ip: cleanMeta(ctx.clientIp || "", 80), userAgent: cleanMeta(ctx.userAgent || "", 240) };
  }

  function sessionDeviceLabel(userAgent = "") {
    const ua = String(userAgent);
    const os = /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X|Macintosh/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "기기";
    const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "Browser";
    return `${os} / ${browser}`;
  }

  function userWarningRecords(db, userId, limit = 3) {
    return (db?.warnings || [])
      .filter((item) => item.userId === userId)
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .slice(0, limit)
      .map((item) => ({ id: item.id, reason: item.reason || "", count: Math.max(0, Number(item.count || 0)), createdAt: item.createdAt || "" }));
  }

  function effectiveApprovalStatus(user) {
    if (!user || user.approvalStatus !== "blocked") return user?.approvalStatus;
    if (!user.blockedUntil) return "blocked";
    return new Date(user.blockedUntil).getTime() > Date.now() ? "blocked" : "approved";
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
    return { ...log, actor: publicUser(db.users.find((user) => user.id === log.actorId)) };
  }

  function userRecord({ role = "student", username = "", name, email, phone = "", studentId = "", grade = "", studentStatus, approvalStatus, password }) {
    return hashPassword(password).then((passwordHash) => ({
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
      passwordHash,
      createdAt: nowIso(),
      updatedAt: nowIso()
    }));
  }

  function blockUntilForDuration(duration) {
    const days = LIMIT_DURATION_DAYS[duration] || LIMIT_DURATION_DAYS.week1;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  }

  function blockEndLabel(value) {
    return value ? value.slice(0, 10) : "";
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
    return session ? db.users.find((user) => user.id === session.userId) || null : null;
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

  function requireAdminWithoutSessionCleanup(authorization, db) {
    const token = authToken(authorization);
    const session = token ? (db.sessions || []).find((item) => item.token === token) : null;
    if (!session || !(new Date(session.expiresAt).getTime() > Date.now())) throw Object.assign(new Error("로그인이 필요합니다."), { status: 401 });
    const user = db.users.find((item) => item.id === session.userId);
    if (!user) throw Object.assign(new Error("로그인이 필요합니다."), { status: 401 });
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

  return {
    assertApprovedStudentAccess,
    assertLoginAllowed,
    authToken,
    blockEndLabel,
    blockUntilForDuration,
    cleanMeta,
    cleanSessions,
    clearLoginFailures,
    effectiveApprovalStatus,
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
  };
}
