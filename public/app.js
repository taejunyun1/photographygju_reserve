const $app = document.querySelector("#app");

const state = {
  token: localStorage.getItem("gju_token") || "",
  user: null,
  bootstrap: null,
  view: "home",
  authMode: "login",
  reservationType: "",
  calendarMonth: "",
  selectedDates: {
    equipment: "",
    studio: "",
    darkroom: "",
    print: ""
  },
  activeNoticeId: "",
  activeReportReservationId: "",
  selectedEquipmentItemIds: [],
  equipmentCategoryFilter: "Body",
  adminView: "dashboard",
  adminReservationTab: "equipment",
  adminEquipmentTab: "department",
  adminEquipmentCategoryTab: "all",
  adminUserSort: {
    field: "approvalStatus",
    direction: "asc"
  },
  csvPreviewRows: [],
  myReservations: [],
  adminUsers: [],
  adminReservations: [],
  adminEquipment: [],
  adminReports: [],
  adminNotices: [],
  lectures: [],
  adminLectures: [],
  summary: null,
  toast: ""
};

const statusColor = {
  approval_pending: "yellow",
  pending_approval: "yellow",
  auto_confirmed: "blue",
  approved: "green",
  rejected: "red",
  cancelled: "gray",
  admin_cancelled: "gray",
  checked_out: "purple",
  returned: "green",
  completed: "green",
  warning: "orange",
  blocked: "red"
};

const statusLabel = {
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

const typeLabel = {
  equipment: "기자재",
  studio: "스튜디오",
  darkroom: "암실",
  print: "출력실"
};

const adminNavItems = [
  ["dashboard", "대시보드"],
  ["users", "학생 승인"],
  ["reservations", "예약 관리"],
  ["equipment", "기자재"],
  ["reports", "보고서"],
  ["lectures", "비교과 특강"],
  ["notices", "공지사항"],
  ["settings", "설정"]
];

const lectureStatusOptions = ["모집중", "진행완료", "취소"];

const sourceLabel = {
  department: "극기관",
  fantasy_lab: "판타지랩"
};

const weekdayLabel = {
  sunday: "일",
  monday: "월",
  tuesday: "화",
  wednesday: "수",
  thursday: "목",
  friday: "금",
  saturday: "토"
};

const weekdayIndex = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
};

const userLimitOptions = {
  week1: "1주일",
  week2: "2주일",
  month1: "1달",
  semester: "1학기"
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function tag(value, color = "") {
  return `<span class="tag ${color || statusColor[value] || "gray"}">${escapeHtml(statusLabel[value] || value)}</span>`;
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function userStatusCell(user) {
  const blockedUntil = user.approvalStatus === "blocked" && user.blockedUntil ? `<small class="status-note">제한 종료 ${escapeHtml(formatDateTime(user.blockedUntil))}</small>` : "";
  return `<div class="status-cell">${tag(user.approvalStatus)}${blockedUntil}</div>`;
}

function userSortValue(user, field) {
  if (field === "name") return user.name || "";
  if (field === "studentId") return user.studentId || "";
  if (field === "studentStatus") return user.studentStatus || "";
  if (field === "approvalStatus") return statusLabel[user.approvalStatus] || user.approvalStatus || "";
  return user[field] || "";
}

function sortedAdminUsers() {
  const { field, direction } = state.adminUserSort;
  const multiplier = direction === "desc" ? -1 : 1;
  return state.adminUsers
    .filter((user) => user.role !== "admin")
    .sort((a, b) => {
      const aValue = String(userSortValue(a, field)).toLocaleLowerCase();
      const bValue = String(userSortValue(b, field)).toLocaleLowerCase();
      return aValue.localeCompare(bValue, "ko") * multiplier;
    });
}

function userSortButton(field, label) {
  const active = state.adminUserSort.field === field;
  const direction = active ? state.adminUserSort.direction : "";
  return `<button class="table-sort ${active ? "active" : ""}" data-user-sort="${field}">${label}${active ? (direction === "asc" ? " ↑" : " ↓") : ""}</button>`;
}

function toast(message) {
  state.toast = message;
  render();
  setTimeout(() => {
    state.toast = "";
    render();
  }, 2600);
}

async function api(path, options = {}) {
  const apiBase = String(window.GJU_API_BASE || "").replace(/\/$/, "");
  const url = path.startsWith("http") ? path : `${apiBase}${path}`;
  const headers = {
    "content-type": "application/json",
    ...(options.headers || {})
  };
  if (state.token) headers.authorization = `Bearer ${state.token}`;
  const response = await fetch(url, {
    ...options,
    headers,
    body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body
  });
  const payload = await response.json().catch(() => ({ ok: false, error: "서버 응답을 읽을 수 없습니다." }));
  if (!payload.ok) throw new Error(payload.error || "요청 실패");
  return payload.data;
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function getChecked(name) {
  return [...document.querySelectorAll(`[name="${name}"]:checked`)].map((item) => item.value);
}

function equipmentCategories() {
  const fromSettings = state.bootstrap?.settings?.equipmentCategories || ["Body", "Lens", "Lighting", "Audio", "Drone", "Other"];
  const fromEquipment = (state.bootstrap?.equipment || []).map((item) => item.category).filter(Boolean);
  return [...new Set([...fromSettings, ...fromEquipment])];
}

function adminGuide(title, body) {
  return `
    <section class="guide-card">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(body)}</p>
    </section>
  `;
}

function sortedNotices(notices = []) {
  return [...notices].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
}

function noticePreview(body = "") {
  const compact = String(body).replace(/\s+/g, " ").trim();
  if (compact.length <= 74) return compact;
  return `${compact.slice(0, 74)}...`;
}

function areSlotsConsecutive(selectedSlots, orderedSlots) {
  const unique = [...new Set(selectedSlots)];
  if (unique.length !== selectedSlots.length) return false;
  const indices = unique.map((slot) => orderedSlots.indexOf(slot)).sort((a, b) => a - b);
  if (indices.some((index) => index < 0)) return false;
  return indices.every((index, position) => position === 0 || index === indices[position - 1] + 1);
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayKey() {
  return dateKey(new Date());
}

function addMonths(monthKey, offset) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return dateKey(date).slice(0, 7);
}

function monthTitle(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return `${year}년 ${month}월`;
}

function reservationDate(reservation) {
  return reservation?.fields?.reservedDate || "";
}

function sharedReservations(type, key) {
  return (state.bootstrap?.reservations || [])
    .filter((item) => item.type === type)
    .filter((item) => reservationDate(item) === key);
}

function isMineReservation(reservation) {
  return Boolean(state.user?.id && reservation.userId === state.user.id);
}

function calendarReservationMeta(reservation) {
  const f = reservation.fields || {};
  if (reservation.type === "equipment") {
    const items = (reservation.equipmentItems || []).map((item) => item.code || item.name).join(", ");
    return `${f.rentalTime || "-"} 대여 · ${items || "기자재"}`;
  }
  if (reservation.type === "studio") {
    return `${(f.timeSlots || []).join(", ") || "-"} · ${(f.studioSpaces || [f.studioSpace]).filter(Boolean).join(", ") || "-"}`;
  }
  if (reservation.type === "darkroom") {
    return `${(f.timeSlots || []).join(", ") || "-"} · ${(f.processTypes || []).join(", ") || "작업"}`;
  }
  return `${f.startTime || "-"}-${f.endTime || "-"} · ${f.printType || "출력"}`;
}

function calendarDayDetails(type, selected) {
  if (!selected) return "";
  const reservations = sharedReservations(type, selected);
  if (!reservations.length) {
    return `<div class="calendar-reservations empty-calendar-note">선택한 날짜에 공유된 ${typeLabel[type]} 예약이 없습니다.</div>`;
  }
  return `
    <div class="calendar-reservations">
      ${reservations.map((reservation) => {
        const mine = isMineReservation(reservation);
        return `
          <div class="calendar-reservation-row ${mine ? "mine" : "other"}">
            <span>${mine ? "내 예약" : "타인 예약"}</span>
            <strong>${escapeHtml(reservation.userName || "예약자")}</strong>
            <em>${escapeHtml(calendarReservationMeta(reservation))}</em>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function calendar(type) {
  const monthKey = state.calendarMonth || todayKey().slice(0, 7);
  state.calendarMonth = monthKey;

  const [year, month] = monthKey.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const selected = state.selectedDates[type] || "";
  const today = todayKey();
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    const key = dateKey(day);
    const reservations = sharedReservations(type, key);
    const ownCount = reservations.filter(isMineReservation).length;
    const otherCount = reservations.length - ownCount;
    const blocked = blockedItemsForDate(state.bootstrap.settings.blockedSchedules || [], key).filter((item) => item.type === type);
    return {
      key,
      day: day.getDate(),
      currentMonth: day.getMonth() === month - 1,
      selected: key === selected,
      today: key === today,
      ownCount,
      otherCount,
      blocked
    };
  });

  return `
    <section class="calendar-card" data-calendar="${type}">
      <input type="hidden" name="reservedDate" value="${escapeHtml(selected)}" />
      <div class="calendar-head">
        <div>
          <p class="eyebrow">예약 일자</p>
          <h2>${monthTitle(monthKey)}</h2>
        </div>
        <div class="row-actions">
          <button class="button compact" type="button" data-calendar-month="${addMonths(monthKey, -1)}">이전</button>
          <button class="button compact" type="button" data-calendar-month="${today.slice(0, 7)}">오늘</button>
          <button class="button compact" type="button" data-calendar-month="${addMonths(monthKey, 1)}">다음</button>
        </div>
      </div>
      <div class="calendar-weekdays">
        ${["일", "월", "화", "수", "목", "금", "토"].map((item) => `<span>${item}</span>`).join("")}
      </div>
      <div class="calendar-legend">
        <span><i class="legend-dot mine"></i>내 예약</span>
        <span><i class="legend-dot other"></i>타인 예약</span>
        <span><i class="legend-dot blocked"></i>차단</span>
      </div>
      <div class="calendar-grid-large">
        ${days.map((day) => `
          <button class="calendar-day ${day.currentMonth ? "" : "outside"} ${day.selected ? "selected" : ""} ${day.today ? "today" : ""} ${day.ownCount ? "has-own" : ""} ${day.otherCount ? "has-other" : ""} ${day.blocked.length ? "blocked" : ""}" type="button" data-calendar-day="${day.key}">
            <span>${day.day}</span>
            <div class="calendar-markers">
              ${day.ownCount ? `<small class="calendar-marker mine">내 ${day.ownCount}</small>` : ""}
              ${day.otherCount ? `<small class="calendar-marker other">타인 ${day.otherCount}</small>` : ""}
              ${day.blocked.length ? `<small class="calendar-marker blocked">차단</small>` : ""}
            </div>
          </button>
        `).join("")}
      </div>
      <p class="selected-date">선택한 날짜: <strong data-calendar-selected>${selected || "날짜를 선택하세요"}</strong></p>
      <div data-calendar-details>${calendarDayDetails(type, selected)}</div>
    </section>
  `;
}

async function loadBootstrap() {
  state.bootstrap = await api("/api/bootstrap");
}

async function loadMe() {
  if (!state.token) return;
  const data = await api("/api/me");
  state.user = data.user;
  if (!state.user) {
    state.token = "";
    localStorage.removeItem("gju_token");
  }
}

async function init() {
  await loadBootstrap();
  await loadMe();
  if (state.user?.role === "admin") await loadAdminData();
  if (state.user?.role === "student") {
    await loadMyReservations();
    await loadLectures();
  }
  render();
}

async function login(form) {
  const data = formData(form);
  const result = await api("/api/auth/login", { method: "POST", body: data });
  state.token = result.token;
  state.user = result.user;
  localStorage.setItem("gju_token", state.token);
  if (state.user.role === "admin") await loadAdminData();
  if (state.user.role === "student") {
    await loadMyReservations();
    await loadLectures();
  }
  toast("로그인되었습니다.");
}

async function signup(form) {
  const data = formData(form);
  await api("/api/auth/signup", { method: "POST", body: data });
  state.authMode = "login";
  toast("가입 신청이 접수되었습니다. 학과 관리자 승인 후 예약할 수 있습니다.");
}

async function logout() {
  await api("/api/auth/logout", { method: "POST", body: { token: state.token } }).catch(() => null);
  state.token = "";
  state.user = null;
  state.myReservations = [];
  state.lectures = [];
  state.activeNoticeId = "";
  localStorage.removeItem("gju_token");
  render();
}

async function loadMyReservations() {
  state.myReservations = await api("/api/reservations/my");
}

async function loadLectures() {
  state.lectures = await api("/api/lectures");
}

async function loadAdminData() {
  const [summary, users, reservations, equipment, reports, notices, lectures] = await Promise.all([
    api("/api/admin/summary"),
    api("/api/admin/users"),
    api("/api/admin/reservations"),
    api("/api/admin/equipment"),
    api("/api/admin/reports"),
    api("/api/admin/notices"),
    api("/api/admin/lectures")
  ]);
  Object.assign(state, {
    summary,
    adminUsers: users,
    adminReservations: reservations,
    adminEquipment: equipment,
    adminReports: reports,
    adminNotices: notices,
    adminLectures: lectures
  });
}

function authView() {
  const isLogin = state.authMode === "login";
  return `
    <main class="auth-shell">
      <section class="auth-panel">
        <div class="brand">
          <div class="brand-mark">G</div>
          <div>
            <h1>GJU-reserve</h1>
            <p>광주대학교 사진영상미디어학과 예약 시스템</p>
          </div>
        </div>
        <div class="segmented">
          <button class="${isLogin ? "active" : ""}" data-auth-mode="login">로그인</button>
          <button class="${!isLogin ? "active" : ""}" data-auth-mode="signup">학생 신청</button>
        </div>
        ${
          isLogin
            ? `<form data-form="login">
                <div class="field"><label>아이디</label><input class="input" name="loginId" placeholder="admin 또는 이메일/학번" required /></div>
                <div class="field"><label>비밀번호</label><input class="input" name="password" type="password" required /></div>
                <button class="button primary full" type="submit">접속</button>
                <p class="muted">개발 기본 Admin: admin / admin. 프로덕션에서는 반드시 변경합니다.</p>
              </form>`
            : `<form data-form="signup">
                <div class="field"><label>이름</label><input class="input" name="name" required /></div>
                <div class="field"><label>학번</label><input class="input" name="studentId" placeholder="교수(강사)는 소속명 입력 가능" /></div>
                <div class="field"><label>학년</label><input class="input" name="grade" placeholder="1학년, 2학년..." /></div>
                <div class="field"><label>재학상태</label><select class="select" name="studentStatus" required>
                  ${["재학생", "휴학생", "졸업생", "대학원생", "교수(강사)"].map((item) => `<option>${item}</option>`).join("")}
                </select></div>
                <div class="field"><label>연락처</label><input class="input" name="phone" inputmode="tel" required /></div>
                <div class="field"><label>이메일</label><input class="input" name="email" type="email" required /></div>
                <div class="field"><label>비밀번호</label><input class="input" name="password" type="password" minlength="4" required /></div>
                <button class="button primary full" type="submit">가입 신청</button>
                <p class="muted">승인 전에도 공지는 볼 수 있지만 예약은 불가합니다.</p>
              </form>`
        }
      </section>
    </main>
  `;
}

function studentShell() {
  const title = {
    home: "홈",
    reserve: "예약",
    mine: "내 예약",
    reports: "보고서",
    lectures: "비교과 특강",
    notices: "공지",
    my: "마이"
  }[state.view] || "GJU-reserve";
  const navItems = [
    ["home", "홈"],
    ["reserve", "예약"],
    ["mine", "내 예약"],
    ["reports", "보고서"],
    ["lectures", "특강"],
    ["notices", "공지"],
    ["my", "마이"]
  ];
  const userStatus = statusLabel[state.user.approvalStatus] || state.user.approvalStatus || "-";
  return `
    <main class="student-shell">
      <header class="top-appbar">
        <div class="appbar-brand">
          <div class="brand-mark">G</div>
          <div>
            <strong>GJU-reserve</strong>
            <span>사진영상미디어학과</span>
          </div>
        </div>
        <nav class="desktop-nav">
          ${navItems.map(([key, label]) => `<button class="${state.view === key ? "active" : ""}" data-student-view="${key}">${label}</button>`).join("")}
        </nav>
        <div class="student-appbar-actions">
          <div class="student-status-chip" title="${escapeHtml(`${state.user.name} · ${state.user.studentStatus} · ${userStatus}`)}">
            <strong>${escapeHtml(state.user.name)}</strong>
            <span>${escapeHtml(state.user.studentStatus)} · ${escapeHtml(userStatus)}</span>
          </div>
          <button class="button ghost compact" data-action="logout">나가기</button>
        </div>
      </header>
      <section class="mobile-top">
        <div>
          <p class="eyebrow">Centralized Booking</p>
          <h1>${title}</h1>
        </div>
      </section>
      ${studentContent()}
      <nav class="mobile-nav">
        ${navItems.map(([key, label]) => `<button class="${state.view === key ? "active" : ""}" data-student-view="${key}">${label}</button>`).join("")}
      </nav>
    </main>
  `;
}

function studentContent() {
  if (state.view === "reserve") return reserveView();
  if (state.view === "mine") return myReservationsView();
  if (state.view === "reports") return reportsView();
  if (state.view === "lectures") return lecturesView();
  if (state.view === "notices") return noticesView();
  if (state.view === "my") return myPageView();
  return homeView();
}

function facilityCard(type, title, desc, code, statusText, tone = "blue") {
  return `
    <button class="facility-card" data-reserve-shortcut="${type}" data-reserve-type="${type}">
      <div class="facility-visual facility-${type}">
        <span class="facility-code">${code}</span>
        <span class="availability ${tone}"><i></i>${statusText}</span>
      </div>
      <div class="facility-body">
        <div>
          <strong>${title}</strong>
          <p>${desc}</p>
        </div>
        <span class="reserve-label">RESERVE</span>
      </div>
    </button>
  `;
}

function homeLecturesCard(lectures) {
  if (!lectures.length) return "";
  return `
    <div class="card">
      <div class="form-head">
        <div>
          <h2 class="card-title">모집중인 특강</h2>
          <p class="muted">현재 신청 가능한 비교과 특강입니다.</p>
        </div>
        <button class="button compact" data-student-view="lectures">전체 보기</button>
      </div>
      <div class="lecture-mini-list">
        ${lectures.map((lecture) => {
          const count = Number(lecture.applicationCount || 0);
          const capacity = Number(lecture.capacity || 0);
          const countLabel = capacity ? `${count}/${capacity}` : `${count}`;
          return `
            <button class="lecture-mini-row" data-student-view="lectures">
              <span class="lecture-date">${escapeHtml(lecture.lectureDate || "-")}</span>
              <span>
                <strong>${escapeHtml(lecture.title)}</strong>
                <small>${escapeHtml(lecture.time || "")}${lecture.location ? ` · ${escapeHtml(lecture.location)}` : ""}</small>
              </span>
              <span class="tag green">${escapeHtml(countLabel)}</span>
            </button>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function homeNoticeList(notices) {
  if (!notices.length) return "";
  return `
    <section class="card notice notice-top-card">
      <div class="form-head">
        <div>
          <h2 class="card-title">공지사항</h2>
          <p class="muted">중요 공지를 먼저 확인하세요.</p>
        </div>
        <button class="button compact" data-student-view="notices">전체 보기</button>
      </div>
      <div class="notice-top-list">
        ${notices.map((notice) => noticeCard(notice, { compact: true })).join("")}
      </div>
    </section>
  `;
}

function homeView() {
  const pending = state.user.approvalStatus !== "approved";
  const next = state.myReservations
    .filter((item) => !["cancelled", "admin_cancelled", "rejected"].includes(item.status))
    .sort((a, b) => String(a.fields.reservedDate).localeCompare(String(b.fields.reservedDate)))[0];
  const homeNotices = sortedNotices(state.bootstrap.notices || []).slice(0, 3);
  const recruitingLectures = (state.lectures || [])
    .filter((lecture) => lecture.status === "모집중")
    .sort((a, b) => String(a.lectureDate || "").localeCompare(String(b.lectureDate || "")))
    .slice(0, 3);
  return `
    <section class="grid">
      ${homeNoticeList(homeNotices)}
      ${pending ? `<div class="card notice"><h2 class="card-title">승인 대기</h2><p class="muted">학과 관리자 승인 후 예약할 수 있습니다. 반려 시 학과 관리자에게 연락하세요.</p></div>` : ""}
      <div class="facility-grid">
        ${facilityCard("equipment", "기자재", "카메라, 렌즈, 조명, 음향 장비", "EQ", "APPROVAL", "yellow")}
        ${facilityCard("studio", "스튜디오", "Studio A/B Front·Back", "ST", "AUTO", "green")}
        ${facilityCard("print", "출력실", "과제 및 개인 작품 출력", "PR", "AUTO", "green")}
        ${facilityCard("darkroom", "암실", "현상, 인화, 약품 사용량 기록", "DR", "AUTO", "green")}
      </div>
      <div class="card">
        <h2 class="card-title">다음 예약</h2>
        ${next ? reservationCard(next) : `<p class="empty">예정된 예약이 없습니다.</p>`}
      </div>
      ${homeLecturesCard(recruitingLectures)}
    </section>
  `;
}

function reserveView() {
  if (state.user.approvalStatus !== "approved") {
    return `<div class="card notice"><h2 class="card-title">예약 불가</h2><p class="muted">현재 계정은 ${statusLabel[state.user.approvalStatus]} 상태입니다. 학과 관리자 승인 후 예약할 수 있습니다.</p></div>`;
  }
  if (!state.reservationType) {
    return `
      <section class="facility-grid">
        ${facilityCard("equipment", "기자재", "승인 후 확정", "EQ", "APPROVAL", "yellow")}
        ${facilityCard("studio", "스튜디오", "자동 확정", "ST", "AUTO", "green")}
        ${facilityCard("print", "출력실", "자동 확정", "PR", "AUTO", "green")}
        ${facilityCard("darkroom", "암실", "자동 확정", "DR", "AUTO", "green")}
      </section>
    `;
  }
  return `
    <button class="button ghost" data-action="reserve-back">← 예약 종류</button>
    <div class="section-gap"></div>
    ${reservationForm(state.reservationType)}
  `;
}

function reservationForm(type) {
  if (type === "equipment") return equipmentForm();
  if (type === "studio") return studioForm();
  if (type === "darkroom") return darkroomForm();
  return printForm();
}

function equipmentForm() {
  const reservable = state.bootstrap.equipment.filter((item) => item.active !== false && item.reservable);
  const categories = equipmentCategories().filter((cat) => reservable.some((item) => item.category === cat));
  if (!categories.includes(state.equipmentCategoryFilter)) state.equipmentCategoryFilter = categories[0] || "Other";
  const visibleItems = reservable.filter((item) => item.category === state.equipmentCategoryFilter);
  const selectedItems = state.selectedEquipmentItemIds
    .map((itemId) => reservable.find((item) => item.id === itemId))
    .filter(Boolean);
  return `
    <form class="reservation-layout" data-form="reservation" data-type="equipment">
      ${calendar("equipment")}
      <section class="reservation-panel">
        <div class="form-head">
          <div>
            <p class="eyebrow">Approval required</p>
            <h2 class="card-title">기자재 예약</h2>
          </div>
          <span class="tag yellow">조교 승인</span>
        </div>
        <p class="muted">카메라 Body, Lens, 조명, 음향 장비를 한 번에 여러 개 담을 수 있습니다. 카메라/렌즈 대여 시 가방 또는 케이스를 지참해야 합니다.</p>
        <div class="grid two control-grid">
          <div class="field"><label>대여기간</label><select class="select" name="period">${state.bootstrap.settings.equipmentPeriods.map((item) => `<option>${item}</option>`).join("")}</select></div>
          <div class="field"><label>대여 시간</label><select class="select" name="rentalTime">${state.bootstrap.settings.equipmentRentalTimes.map((item) => `<option>${item}</option>`).join("")}</select></div>
          <div class="field"><label>반납 시간</label><select class="select" name="returnTime">${state.bootstrap.settings.equipmentReturnTimes.map((item) => `<option>${item}</option>`).join("")}</select></div>
          <div class="field"><label>연락처</label><input class="input" name="phone" value="${escapeHtml(state.user.phone)}" required /></div>
        </div>
        <div class="field">
          <label>기자재 멀티 선택</label>
          <div class="tab-row wrap equipment-tabs">
            ${categories.map((cat) => {
              const count = reservable.filter((item) => item.category === cat).length;
              const selectedCount = selectedItems.filter((item) => item.category === cat).length;
              return `<button class="tab-button ${state.equipmentCategoryFilter === cat ? "active" : ""}" type="button" data-equipment-category="${escapeHtml(cat)}">${escapeHtml(cat)} <span>${selectedCount ? `${selectedCount}/` : ""}${count}</span></button>`;
            }).join("")}
          </div>
          <div class="equipment-picker-head">
            <strong>${escapeHtml(state.equipmentCategoryFilter)}</strong>
            <span>${visibleItems.length}개 중 ${selectedItems.filter((item) => item.category === state.equipmentCategoryFilter).length}개 선택</span>
          </div>
          <div class="choice-grid equipment-choice-grid">
            ${visibleItems.map((item) => `
              <label class="choice-card equipment-choice">
                <input type="checkbox" name="equipmentItemIds" value="${item.id}" ${state.selectedEquipmentItemIds.includes(item.id) ? "checked" : ""} />
                <span>
                  <strong>${escapeHtml(item.name)}</strong>
                  <small>${escapeHtml(item.code)}${item.notes ? ` · ${escapeHtml(item.notes)}` : ""}</small>
                </span>
              </label>
            `).join("")}
          </div>
        </div>
        <div class="field"><label>스탠드/소프트박스 요청</label><input class="input" name="standRequest" placeholder="예약 후 조교와 직접 확인" /></div>
        <div class="field"><label>사용 목적</label><textarea class="textarea" name="purpose" placeholder="촬영 목적을 간단히 입력"></textarea></div>
        <label class="field consent"><span><input type="checkbox" required /> 파손/분실 자가부담 및 대리 대여/반납 불가에 동의합니다.</span></label>
        <button class="button primary full" type="submit">승인 요청</button>
        ${equipmentSelectionSheet(selectedItems)}
      </section>
    </form>
  `;
}

function equipmentSelectionSheet(items) {
  return `
    <aside class="selection-sheet ${items.length ? "active" : ""}">
      <div>
        <strong>선택한 기자재 ${items.length}개</strong>
        <p>${items.length ? "선택 목록을 확인하고 승인 요청하세요." : "장비를 선택하면 여기에 모입니다."}</p>
      </div>
      <div class="selected-equipment-list">
        ${items.length ? items.map((item) => `
          <span class="selected-pill">${escapeHtml(item.code)} · ${escapeHtml(item.name)} <button type="button" data-equipment-remove="${item.id}">×</button></span>
        `).join("") : `<span class="muted">아직 선택한 장비가 없습니다.</span>`}
      </div>
    </aside>
  `;
}

function currentSelectedEquipmentItems() {
  const reservable = state.bootstrap.equipment.filter((item) => item.active !== false && item.reservable);
  return state.selectedEquipmentItemIds.map((itemId) => reservable.find((item) => item.id === itemId)).filter(Boolean);
}

function syncEquipmentSelectionSheet() {
  const sheet = document.querySelector(".selection-sheet");
  if (!sheet) return;
  sheet.outerHTML = equipmentSelectionSheet(currentSelectedEquipmentItems());
}

function studioForm() {
  return `
    <form class="reservation-layout" data-form="reservation" data-type="studio">
      ${calendar("studio")}
      <section class="reservation-panel">
        <div class="form-head">
          <div>
            <p class="eyebrow">Auto confirmed</p>
            <h2 class="card-title">스튜디오 예약</h2>
          </div>
          <span class="tag green">자동 확정</span>
        </div>
        <p class="muted">연속된 시간만 최대 3타임까지 선택 가능합니다. 사용 후 48시간 이내 보고서를 제출해야 합니다.</p>
        <div class="field"><label>사용 시간 멀티 선택</label><div class="choice-grid">${state.bootstrap.settings.studioSlots.map((slot) => `<label class="choice-card compact-choice"><input type="checkbox" name="studioSlots" value="${slot}" /><span><strong>${slot}</strong></span></label>`).join("")}</div></div>
        <div class="field"><label>사용 공간 멀티 선택</label><div class="choice-grid">${state.bootstrap.settings.studioSpaces.map((item) => `<label class="choice-card compact-choice"><input type="checkbox" name="studioSpaces" value="${item}" /><span><strong>${item}</strong></span></label>`).join("")}</div></div>
        <div class="field"><label>사용 명단</label><input class="input" name="participants" placeholder="대표자 및 팀원" value="${escapeHtml(state.user.name)}" required /></div>
        <div class="field"><label>필요 장비</label><textarea class="textarea" name="requiredEquipment" placeholder="포멕스 E1000 2개, C스탠드 4개 등"></textarea></div>
        <div class="field"><label>사용 목적</label><textarea class="textarea" name="purpose"></textarea></div>
        <div class="field"><label>연락처</label><input class="input" name="phone" value="${escapeHtml(state.user.phone)}" required /></div>
        <label class="field consent"><span><input type="checkbox" required /> 사용 후 정리정돈과 보고서 제출 규정을 확인했습니다.</span></label>
        <button class="button primary full" type="submit">예약 확정</button>
      </section>
    </form>
  `;
}

function darkroomForm() {
  return `
    <form class="reservation-layout" data-form="reservation" data-type="darkroom">
      ${calendar("darkroom")}
      <section class="reservation-panel">
        <div class="form-head">
          <div>
            <p class="eyebrow">Auto confirmed</p>
            <h2 class="card-title">암실 예약</h2>
          </div>
          <span class="tag green">자동 확정</span>
        </div>
        <p class="muted">24시간 2시간 단위 예약입니다. 월/화 14:00-18:00은 사용 불가이며, 최대 ${state.bootstrap.settings.darkroomCapacity}명까지 가능합니다.</p>
        <div class="field"><label>사용 시간 멀티 선택</label><div class="choice-grid">${state.bootstrap.settings.darkroomSlots.map((slot) => `<label class="choice-card compact-choice"><input type="checkbox" name="darkroomSlots" value="${slot}" /><span><strong>${slot}</strong></span></label>`).join("")}</div></div>
        <div class="field"><label>사용 인원</label><input class="input" name="participantCount" type="number" min="1" max="${state.bootstrap.settings.darkroomCapacity}" value="1" /></div>
        <div class="field"><label>작업 유형 멀티 선택</label><div class="choice-grid">${["현상", "인화"].map((item) => `<label class="choice-card compact-choice"><input type="checkbox" name="processTypes" value="${item}" /><span><strong>${item}</strong></span></label>`).join("")}</div></div>
        <div class="field"><label>사용 약품 및 예정량</label><div class="chemical-grid">${state.bootstrap.darkroomChemicals.map((chem) => `<div class="field"><label>${chem.name}</label><select class="select" name="chem-${chem.id}"><option value="">사용 안 함</option>${chem.options.map((option) => `<option>${option}</option>`).join("")}</select></div>`).join("")}</div></div>
        <div class="field"><label>사용 목적</label><textarea class="textarea" name="purpose"></textarea></div>
        <div class="field"><label>연락처</label><input class="input" name="phone" value="${escapeHtml(state.user.phone)}" required /></div>
        <label class="field consent"><span><input type="checkbox" required /> 약품 폐수 분리, 청소, 취식 금지 규정을 확인했습니다.</span></label>
        <button class="button primary full" type="submit">예약 확정</button>
      </section>
    </form>
  `;
}

function printForm() {
  const hours = [];
  for (let h = 10; h <= 19; h += 1) hours.push(`${String(h).padStart(2, "0")}:00`);
  return `
    <form class="reservation-layout" data-form="reservation" data-type="print">
      ${calendar("print")}
      <section class="reservation-panel">
        <div class="form-head">
          <div>
            <p class="eyebrow">Auto confirmed</p>
            <h2 class="card-title">출력실 예약</h2>
          </div>
          <span class="tag green">자동 확정</span>
        </div>
        <p class="muted">실제 사용 가능 시간은 ${state.bootstrap.settings.printAvailableStart}-${state.bootstrap.settings.printAvailableEnd}입니다. 가격은 현장에서 확인합니다.</p>
        <div class="grid two control-grid">
          <div class="field"><label>시작</label><select class="select" name="startTime">${hours.slice(0, -1).map((item) => `<option>${item}</option>`).join("")}</select></div>
          <div class="field"><label>종료</label><select class="select" name="endTime">${hours.slice(1).map((item) => `<option>${item}</option>`).join("")}</select></div>
        </div>
        <div class="field"><label>출력 종류 멀티 선택</label><div class="choice-grid">${state.bootstrap.settings.printTypes.map((item) => `<label class="choice-card compact-choice"><input type="checkbox" name="printTypes" value="${item}" /><span><strong>${item}</strong></span></label>`).join("")}</div></div>
        <div class="field"><label>용지 멀티 선택</label><div class="choice-grid">${state.bootstrap.settings.printPapers.map((item) => `<label class="choice-card compact-choice"><input type="checkbox" name="papers" value="${item}" /><span><strong>${item}</strong></span></label>`).join("")}</div></div>
        <div class="field"><label>사이즈 멀티 선택</label><div class="choice-grid">${state.bootstrap.settings.printSizes.map((item) => `<label class="choice-card compact-choice"><input type="checkbox" name="sizes" value="${item}" /><span><strong>${item}</strong></span></label>`).join("")}</div></div>
        <div class="field"><label>매수</label><input class="input" name="count" type="number" min="1" value="1" /></div>
        <div class="field"><label>메모</label><textarea class="textarea" name="memo" placeholder="파일 준비 상태, 기타 요청사항"></textarea></div>
        <div class="field"><label>연락처</label><input class="input" name="phone" value="${escapeHtml(state.user.phone)}" required /></div>
        <div class="info-strip"><strong>출력비 계좌</strong><span>${escapeHtml(state.bootstrap.settings.printBankAccount)}</span></div>
        <button class="button primary full" type="submit">예약 확정</button>
      </section>
    </form>
  `;
}

function reservationCard(reservation) {
  const f = reservation.fields || {};
  const title = typeLabel[reservation.type];
  const date = f.reservedDate || "-";
  const meta = reservation.type === "studio"
    ? `${(f.timeSlots || []).join(", ")} · ${(f.studioSpaces || [f.studioSpace]).filter(Boolean).join(", ")}`
    : reservation.type === "equipment"
      ? `${f.rentalTime} 대여 · ${(reservation.equipmentItems || []).map((item) => item.code).join(", ")}`
      : reservation.type === "darkroom"
        ? `${(f.timeSlots || []).join(", ")} · ${(f.processTypes || []).join(", ")}`
        : `${f.startTime}-${f.endTime} · ${f.printType}`;
  return `
    <article class="card">
      <div class="chips">${tag(reservation.status)}<span class="tag">${title}</span></div>
      <h3 class="card-title card-title-spaced">${date}</h3>
      <p class="muted">${escapeHtml(meta)}</p>
      <div class="row-actions">
        ${!["cancelled", "admin_cancelled", "returned", "completed"].includes(reservation.status) ? `<button class="button danger" data-cancel-res="${reservation.id}">취소</button>` : ""}
        ${reservation.type === "studio" && reservation.fields.reportStatus !== "submitted" ? `<button class="button" data-report-res="${reservation.id}">보고서</button>` : ""}
      </div>
    </article>
  `;
}

function myReservationsView() {
  return `<section class="grid">${state.myReservations.length ? state.myReservations.map(reservationCard).join("") : `<p class="empty">예약 내역이 없습니다.</p>`}</section>`;
}

function isReportDue(reservation) {
  if (reservation.type !== "studio") return false;
  if (reservation.fields?.reportStatus === "submitted") return false;
  if (["cancelled", "admin_cancelled", "rejected"].includes(reservation.status)) return false;
  return String(reservation.fields?.reservedDate || "") <= todayKey();
}

function reportsView() {
  const pending = state.myReservations.filter(isReportDue);
  const submitted = state.myReservations.filter((item) => item.type === "studio" && item.fields?.reportStatus === "submitted");
  return `
    <section class="grid">
      <div class="card">
        <h2 class="card-title">스튜디오 보고서</h2>
        <p class="muted">스튜디오 사용 후 48시간 이내 작성합니다. 제출하면 Admin 보고서 화면에 바로 표시됩니다.</p>
      </div>
      ${pending.length ? pending.map(reportRequestCard).join("") : `<p class="empty">작성할 스튜디오 보고서가 없습니다.</p>`}
      ${submitted.length ? `<div class="card"><h2 class="card-title">제출 완료</h2>${submitted.map((reservation) => `<p class="muted">${escapeHtml(reservation.fields.reservedDate)} · ${(reservation.fields.timeSlots || []).join(", ")} · 보고서 제출완료</p>`).join("")}</div>` : ""}
    </section>
  `;
}

function reportRequestCard(reservation) {
  const f = reservation.fields || {};
  const active = state.activeReportReservationId === reservation.id;
  return `
    <article class="card report-card">
      <div class="chips"><span class="tag blue">스튜디오</span><span class="tag yellow">보고서 필요</span></div>
      <h3 class="card-title card-title-spaced">${escapeHtml(f.reservedDate || "-")}</h3>
      <p class="muted">${escapeHtml((f.timeSlots || []).join(", "))} · ${escapeHtml((f.studioSpaces || [f.studioSpace]).filter(Boolean).join(", "))}</p>
      ${active ? studioReportForm(reservation) : `<button class="button primary" data-report-open="${reservation.id}">보고서 작성</button>`}
    </article>
  `;
}

function studioReportForm(reservation) {
  const f = reservation.fields || {};
  return `
    <form class="report-form" data-form="studio-report" data-reservation-id="${reservation.id}">
      <div class="field"><label>실제 사용 시간</label><input class="input" name="actualTime" value="${escapeHtml((f.timeSlots || []).join(", "))}" required /></div>
      <div class="field"><label>실제 사용 인원</label><input class="input" name="participants" value="${escapeHtml(f.participants || state.user.name)}" required /></div>
      <div class="field"><label>사용 장비</label><textarea class="textarea" name="usedEquipment" placeholder="사용한 조명/스탠드/배경지 등"></textarea></div>
      <label class="field consent"><span><input type="checkbox" name="cleanupConfirmed" value="true" required /> 정리정돈을 완료했습니다.</span></label>
      <label class="field consent"><span><input type="checkbox" name="damageFound" value="true" /> 파손 또는 이상이 있습니다.</span></label>
      <div class="field"><label>파손/이상 내용</label><textarea class="textarea" name="damageDescription" placeholder="없으면 비워두세요."></textarea></div>
      <div class="field"><label>비고</label><textarea class="textarea" name="notes"></textarea></div>
      <div class="row-actions">
        <button class="button primary" type="submit">보고서 제출</button>
        <button class="button ghost" type="button" data-report-close>닫기</button>
      </div>
    </form>
  `;
}

function lecturesView() {
  return `
    <section class="grid">
      <div class="card">
        <h2 class="card-title">비교과 특강</h2>
        <p class="muted">모집중인 특강은 내부 신청으로 바로 접수할 수 있습니다.</p>
      </div>
      ${state.lectures.length ? state.lectures.map(lectureCard).join("") : `<p class="empty">등록된 비교과 특강이 없습니다.</p>`}
    </section>
  `;
}

function lectureCard(lecture) {
  const canApply = lecture.status === "모집중" && !lecture.applied && state.user?.approvalStatus === "approved";
  const count = Number(lecture.applicationCount || 0);
  const capacity = Number(lecture.capacity || 0);
  const countLabel = capacity ? `${count}/${capacity}` : `${count}`;
  return `
    <article class="card lecture-card">
      <div class="lecture-list-row">
        <span>${escapeHtml(lecture.lectureDate || "-")}</span>
        <strong>${escapeHtml(lecture.title)}</strong>
        <em>${escapeHtml(lecture.instructorName || "-")}</em>
        <em>${escapeHtml(lecture.location || "-")}</em>
        <span>${escapeHtml(countLabel)}</span>
        ${tag(lecture.status || "모집중", lecture.status === "모집중" ? "green" : lecture.status === "취소" ? "red" : "gray")}
      </div>
      <p class="muted">${escapeHtml(lecture.time || "")}${lecture.targetGrades ? ` · 대상 ${escapeHtml(lecture.targetGrades)}` : ""}${lecture.professor ? ` · 담당 ${escapeHtml(lecture.professor)}` : ""}</p>
      ${lecture.description ? `<p class="lecture-desc">${escapeHtml(lecture.description)}</p>` : ""}
      ${lecture.notes ? `<p class="muted">비고: ${escapeHtml(lecture.notes)}</p>` : ""}
      <div class="row-actions">
        ${lecture.applied ? `<span class="tag blue">신청완료</span>` : canApply ? `<button class="button primary" data-lecture-apply="${lecture.id}">신청</button>` : ""}
      </div>
    </article>
  `;
}

function noticeCard(notice, options = {}) {
  const preview = options.compact ? noticePreview(notice.body) : noticePreview(notice.body);
  return `
    <button class="${options.compact ? "notice-strip-row" : "card notice notice-card-button"}" type="button" data-notice-open="${notice.id}">
      <div class="chips"><span class="tag blue">${escapeHtml(notice.category)}</span>${notice.pinned ? `<span class="tag yellow">고정</span>` : ""}</div>
      <h3 class="card-title card-title-spaced">${escapeHtml(notice.title)}</h3>
      <p class="muted notice-preview">${escapeHtml(preview)}</p>
      <span class="notice-more">자세히 보기</span>
    </button>
  `;
}

function noticesView() {
  const notices = sortedNotices(state.bootstrap.notices || []);
  return `
    <section class="grid">
      <div class="card">
        <h2 class="card-title">공지사항</h2>
        <p class="muted">공지를 누르면 전체 내용을 확인할 수 있습니다.</p>
      </div>
      ${notices.map((notice) => noticeCard(notice)).join("")}
    </section>
  `;
}

function myPageView() {
  return `
    <section class="grid">
      <div class="card">
        <h2 class="card-title">${escapeHtml(state.user.name)}</h2>
        <div class="property-list">
          <div class="prop"><span class="key">승인</span><span>${tag(state.user.approvalStatus)}</span></div>
          <div class="prop"><span class="key">학번</span><span>${escapeHtml(state.user.studentId || "-")}</span></div>
          <div class="prop"><span class="key">학년</span><span>${escapeHtml(state.user.grade || "-")}</span></div>
          <div class="prop"><span class="key">신분</span><span>${escapeHtml(state.user.studentStatus)}</span></div>
        </div>
      </div>
      <div class="card">
        <h2 class="card-title">개인정보 수정</h2>
        <form class="report-form" data-form="profile-edit">
          <div class="field"><label>이름</label><input class="input" name="name" value="${escapeHtml(state.user.name || "")}" required /></div>
          <div class="field"><label>이메일</label><input class="input" name="email" type="email" value="${escapeHtml(state.user.email || "")}" /></div>
          <div class="field"><label>연락처</label><input class="input" name="phone" value="${escapeHtml(state.user.phone || "")}" /></div>
          <button class="button primary full" type="submit">개인정보 저장</button>
        </form>
      </div>
      <div class="card">
        <h2 class="card-title">비밀번호 변경</h2>
        <form class="report-form" data-form="password-change">
          <div class="field"><label>현재 비밀번호</label><input class="input" name="currentPassword" type="password" autocomplete="current-password" required /></div>
          <div class="field"><label>새 비밀번호</label><input class="input" name="newPassword" type="password" autocomplete="new-password" minlength="4" required /></div>
          <div class="field"><label>새 비밀번호 확인</label><input class="input" name="confirmPassword" type="password" autocomplete="new-password" minlength="4" required /></div>
          <button class="button primary full" type="submit">비밀번호 변경</button>
        </form>
      </div>
      <button class="button danger full" data-action="logout">로그아웃</button>
    </section>
  `;
}

function activeNotice() {
  if (!state.activeNoticeId) return null;
  const notices = [
    ...(state.bootstrap?.notices || []),
    ...(state.adminNotices || [])
  ];
  return notices.find((notice) => notice.id === state.activeNoticeId) || null;
}

function noticeBottomSheet() {
  const notice = activeNotice();
  if (!notice) return "";
  return `
    <div class="bottom-sheet-layer" role="presentation">
      <button class="sheet-backdrop" type="button" data-notice-close aria-label="공지 닫기"></button>
      <section class="bottom-sheet" role="dialog" aria-modal="true" aria-label="공지사항 상세">
        <div class="sheet-handle"></div>
        <div class="sheet-head">
          <div>
            <div class="chips"><span class="tag blue">${escapeHtml(notice.category)}</span>${notice.pinned ? `<span class="tag yellow">고정</span>` : ""}</div>
            <h2 class="card-title card-title-spaced">${escapeHtml(notice.title)}</h2>
          </div>
          <button class="button ghost compact" type="button" data-notice-close>닫기</button>
        </div>
        <p class="notice-body">${escapeHtml(notice.body)}</p>
        ${notice.link ? `<a class="button primary full" href="${escapeHtml(notice.link)}" target="_blank" rel="noreferrer">신청 링크 열기</a>` : ""}
      </section>
    </div>
  `;
}

function adminShell() {
  return `
    <main class="admin-shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">G</div>
          <div>
            <h1>GJU-reserve</h1>
            <p>Admin</p>
          </div>
        </div>
        <nav class="side-nav">
          ${adminNavItems.map(([key, label]) => `<button class="${state.adminView === key ? "active" : ""}" data-admin-view="${key}">${label}</button>`).join("")}
        </nav>
      </aside>
      <section class="admin-main">
        <header class="admin-mobile-header">
          <div class="appbar-brand">
            <div class="brand-mark">G</div>
            <div>
              <strong>GJU-reserve</strong>
              <span>${adminTitle()}</span>
            </div>
          </div>
          <div class="header-actions">
            <button class="button ghost compact ${state.adminView === "account" ? "active" : ""}" data-admin-view="account">내 정보</button>
            <button class="button ghost compact" data-action="logout">나가기</button>
          </div>
        </header>
        <header class="admin-header">
          <div><h1 class="page-title">${adminTitle()}</h1><p class="muted">admin 통합 관리 계정</p></div>
          <div class="header-actions">
            <button class="button ghost ${state.adminView === "account" ? "active" : ""}" data-admin-view="account">내 정보</button>
            <button class="button ghost" data-action="logout">로그아웃</button>
          </div>
        </header>
        ${adminContent()}
      </section>
      <nav class="admin-mobile-nav">
        ${adminNavItems.map(([key, label]) => `<button class="${state.adminView === key ? "active" : ""}" data-admin-view="${key}">${label}</button>`).join("")}
      </nav>
    </main>
  `;
}

function adminTitle() {
  return {
    dashboard: "대시보드",
    users: "학생 승인",
    reservations: "예약 관리",
    equipment: "기자재 관리",
    reports: "보고서",
    lectures: "비교과 특강",
    notices: "공지사항",
    settings: "설정",
    account: "내 정보"
  }[state.adminView];
}

function adminContent() {
  if (state.adminView === "account") return adminAccountView();
  if (state.adminView === "users") return adminUsersView();
  if (state.adminView === "reservations") return adminReservationsView();
  if (state.adminView === "equipment") return adminEquipmentView();
  if (state.adminView === "reports") return adminReportsView();
  if (state.adminView === "lectures") return adminLecturesView();
  if (state.adminView === "notices") return adminNoticesView();
  if (state.adminView === "settings") return adminSettingsView();
  return adminDashboardView();
}

function adminAccountView() {
  const u = state.user || {};
  return `
    <section class="grid">
      ${adminGuide("내 정보 사용 가이드", "관리자 계정의 이름, 이메일, 연락처와 비밀번호를 직접 변경할 수 있습니다. 비밀번호는 현재 비밀번호 확인 후 변경됩니다.")}
      <div class="card">
        <h2 class="card-title">개인정보 수정</h2>
        <form class="report-form" data-form="profile-edit">
          <div class="field"><label>이름</label><input class="input" name="name" value="${escapeHtml(u.name || "")}" required /></div>
          <div class="field"><label>이메일</label><input class="input" name="email" type="email" value="${escapeHtml(u.email || "")}" /></div>
          <div class="field"><label>연락처</label><input class="input" name="phone" value="${escapeHtml(u.phone || "")}" /></div>
          <button class="button primary full" type="submit">개인정보 저장</button>
        </form>
      </div>
      <div class="card">
        <h2 class="card-title">비밀번호 변경</h2>
        <form class="report-form" data-form="password-change">
          <div class="field"><label>현재 비밀번호</label><input class="input" name="currentPassword" type="password" autocomplete="current-password" required /></div>
          <div class="field"><label>새 비밀번호</label><input class="input" name="newPassword" type="password" autocomplete="new-password" minlength="4" required /></div>
          <div class="field"><label>새 비밀번호 확인</label><input class="input" name="confirmPassword" type="password" autocomplete="new-password" minlength="4" required /></div>
          <button class="button primary full" type="submit">비밀번호 변경</button>
        </form>
      </div>
    </section>
  `;
}

function adminDashboardView() {
  const s = state.summary || {};
  return `
    <section class="grid">
      ${adminGuide("대시보드 사용 가이드", "오늘 처리해야 할 승인, 예약, 보고서 현황을 빠르게 보는 화면입니다. 카드를 누르면 해당 관리 페이지로 이동합니다.")}
      <div class="stat-grid">
        <button class="stat stat-button" data-admin-view="users"><span class="muted">가입 승인 대기</span><strong>${s.pendingUsers || 0}</strong><em>학생 승인으로 이동</em></button>
        <button class="stat stat-button" data-admin-view="reservations" data-admin-reservation-tab="equipment"><span class="muted">기자재 승인 대기</span><strong>${s.pendingEquipment || 0}</strong><em>기자재 예약 확인</em></button>
        <button class="stat stat-button" data-admin-view="reservations" data-admin-reservation-tab="all"><span class="muted">오늘 예약</span><strong>${s.todayReservations || 0}</strong><em>전체 예약 보기</em></button>
        <button class="stat stat-button" data-admin-view="reports"><span class="muted">보고서 확인 필요</span><strong>${s.missingReports || 0}</strong><em>보고서로 이동</em></button>
      </div>
      <div class="card"><h2 class="card-title">운영 순서</h2><p class="muted">신규 가입 승인 → 기자재 승인 → 오늘 대여/반납 → 스튜디오 보고서 확인 → 공지 관리</p></div>
    </section>
  `;
}

function adminUsersView() {
  return `
    <section class="grid">
      ${adminGuide("학생 승인 사용 가이드", "가입 신청 학생의 이름, 학번, 연락처를 확인한 뒤 바로 승인/반려/제한을 누릅니다. 제한은 1주일, 2주일, 1달, 1학기 중 선택할 수 있고 제한 기간 동안 학생은 예약할 수 없습니다.")}
      <div class="table-wrap">
        <table>
          <thead><tr><th>${userSortButton("name", "이름")}</th><th>${userSortButton("studentId", "학번")}</th><th>${userSortButton("studentStatus", "신분")}</th><th>연락처</th><th>${userSortButton("approvalStatus", "상태")}</th><th>작업</th></tr></thead>
          <tbody>
            ${sortedAdminUsers().map((user) => `
              <tr>
                <td><strong>${escapeHtml(user.name)}</strong><br><span class="muted">${escapeHtml(user.email || "")}</span></td>
                <td>${escapeHtml(user.studentId || "-")}</td>
                <td>${escapeHtml(user.studentStatus)}</td>
                <td>${escapeHtml(user.phone)}</td>
                <td>${userStatusCell(user)}</td>
                <td>
                  <div class="row-actions">
                    <button class="button primary" data-user-approval="${user.id}" data-status="approved">승인</button>
                    <button class="button danger" data-user-approval="${user.id}" data-status="rejected">반려</button>
                    <button class="button" data-user-reset="${user.id}">비번 리셋</button>
                  </div>
                  <div class="limit-actions">
                    <select class="select compact-select" data-user-limit-duration="${user.id}">
                      ${Object.entries(userLimitOptions).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}
                    </select>
                    <button class="button" data-user-approval="${user.id}" data-status="blocked">제한</button>
                  </div>
                </td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function adminReservationsView() {
  const tabs = [["all", "전체"], ["equipment", "기자재"], ["darkroom", "암실"], ["studio", "스튜디오"], ["print", "출력"]];
  const reservations = state.adminReservationTab === "all"
    ? state.adminReservations
    : state.adminReservations.filter((reservation) => reservation.type === state.adminReservationTab);
  return `
    <section class="grid">
      ${adminGuide("예약관리 사용 가이드", "예약 종류별 탭에서 학생 예약을 확인합니다. 기자재는 승인→대여→반납 순서로 처리하고, 스튜디오/암실/출력은 현장 상황에 맞게 완료 또는 취소 처리합니다.")}
      <div class="tab-row">
        ${tabs.map(([key, label]) => {
          const count = key === "all" ? state.adminReservations.length : state.adminReservations.filter((item) => item.type === key).length;
          return `<button class="tab-button ${state.adminReservationTab === key ? "active" : ""}" data-admin-reservation-tab="${key}">${label} <span>${count}</span></button>`;
        }).join("")}
      </div>
      <div class="admin-reservation-grid">
        ${reservations.length ? reservations.map(adminReservationCard).join("") : `<p class="empty">해당 탭의 예약이 없습니다.</p>`}
      </div>
    </section>
  `;
}

function adminReservationDetail(reservation) {
  const f = reservation.fields || {};
  if (reservation.type === "equipment") {
    return [
      ["대여/반납", `${f.rentalTime || "-"} / ${f.returnTime || "-"}`],
      ["기간", f.period || "-"],
      ["장비", (reservation.equipmentItems || []).map((item) => `${item.code} ${item.name}`).join(", ") || "-"],
      ["목적", f.purpose || "-"]
    ];
  }
  if (reservation.type === "studio") {
    return [
      ["시간", (f.timeSlots || []).join(", ") || "-"],
      ["공간", (f.studioSpaces || [f.studioSpace]).filter(Boolean).join(", ") || "-"],
      ["명단", f.participants || "-"],
      ["필요 장비", f.requiredEquipment || "-"]
    ];
  }
  if (reservation.type === "darkroom") {
    const chemicals = (f.chemicals || []).map((item) => `${item.name} ${item.amount}`).join(", ");
    return [
      ["시간", (f.timeSlots || []).join(", ") || "-"],
      ["작업", (f.processTypes || []).join(", ") || "-"],
      ["인원", `${f.participantCount || 1}명`],
      ["약품", chemicals || "-"]
    ];
  }
  return [
    ["시간", `${f.startTime || "-"}-${f.endTime || "-"}`],
    ["출력", `${f.printType || "-"} / ${f.paper || "-"} / ${f.size || "-"}`],
    ["매수", f.count || "-"],
    ["메모", f.memo || "-"]
  ];
}

function adminReservationCard(reservation) {
  const f = reservation.fields || {};
  const rows = adminReservationDetail(reservation);
  return `
    <article class="admin-reservation-card">
      <div class="reservation-card-head">
        <div>
          <div class="chips"><span class="tag blue">${typeLabel[reservation.type]}</span>${tag(reservation.status)}</div>
          <h3>${escapeHtml(reservation.user?.name || "-")}</h3>
          <p>${escapeHtml(f.reservedDate || "-")} · ${escapeHtml(f.phone || reservation.user?.phone || "")}</p>
        </div>
      </div>
      <div class="property-list compact">
        ${rows.map(([key, value]) => `<div class="prop"><span class="key">${escapeHtml(key)}</span><span>${escapeHtml(value)}</span></div>`).join("")}
      </div>
      <div class="row-actions">
        ${reservation.type === "equipment" && reservation.status === "pending_approval" ? `<button class="button primary" data-res-status="${reservation.id}" data-status="approved">승인</button>` : ""}
        ${reservation.type === "equipment" ? `<button class="button" data-res-status="${reservation.id}" data-status="checked_out">대여</button><button class="button" data-res-status="${reservation.id}" data-status="returned">반납</button>` : ""}
        <button class="button" data-res-status="${reservation.id}" data-status="completed">완료</button>
        <button class="button danger" data-res-status="${reservation.id}" data-status="admin_cancelled">취소</button>
      </div>
    </article>
  `;
}

function adminEquipmentView() {
  const active = state.adminEquipment.filter((item) => item.active !== false);
  const categories = equipmentCategories();
  const sourceTabs = [["department", "극기관"], ["fantasy_lab", "판타지랩"], ["all", "전체"]];
  const filtered = active
    .filter((item) => state.adminEquipmentTab === "all" || item.source === state.adminEquipmentTab)
    .filter((item) => state.adminEquipmentCategoryTab === "all" || item.category === state.adminEquipmentCategoryTab);
  return `
    <section class="grid">
      ${adminGuide("기자재 사용 가이드", "카테고리와 관리처를 먼저 정리한 뒤 장비를 등록합니다. CSV는 바로 등록하지 말고 미리보기로 행이 제대로 읽혔는지 확인한 다음 등록하세요.")}
      <div class="card">
        <h2 class="card-title">장비 추가</h2>
        <form class="grid two" data-form="equipment-add">
          <div class="field"><label>장비명</label><input class="input" name="name" required /></div>
          <div class="field"><label>카테고리</label><select class="select" name="category">${categories.map((item) => `<option>${escapeHtml(item)}</option>`).join("")}</select></div>
          <div class="field"><label>수량</label><input class="input" name="quantity" type="number" min="1" value="1" /></div>
          <div class="field"><label>코드 prefix</label><input class="input" name="codePrefix" placeholder="CAM-SONY-A7M3" /></div>
          <div class="field"><label>관리처</label><select class="select" name="source"><option value="department">극기관</option><option value="fantasy_lab">판타지랩</option></select></div>
          <div class="field"><label>비고</label><input class="input" name="notes" /></div>
          <button class="button primary" type="submit">추가</button>
        </form>
      </div>
      <div class="card">
        <h2 class="card-title">카테고리 추가</h2>
        <p class="muted">학생 예약 화면과 Admin 장비 등록 선택지에 같이 반영됩니다.</p>
        <form class="inline-form" data-form="equipment-category-add">
          <input class="input" name="categoryName" placeholder="예: Tripod, Monitor, Battery" required />
          <button class="button primary" type="submit">카테고리 추가</button>
        </form>
      </div>
      <div class="card">
        <h2 class="card-title">CSV 업로드</h2>
        <p class="muted">컬럼: facility,source,category,name,brand,model,quantity,code_prefix,reservable,inquiry_only,status,notes</p>
        <form data-form="equipment-import">
          <textarea class="textarea" name="csv" placeholder="CSV 내용을 붙여넣기"></textarea>
          <div class="row-actions">
            <button class="button" type="button" data-action="csv-preview">미리보기</button>
            <button class="button primary" type="submit">미리보기 내용 등록</button>
          </div>
        </form>
        ${state.csvPreviewRows.length ? csvPreviewTable(state.csvPreviewRows) : `<p class="empty">CSV를 붙여넣고 미리보기를 누르면 임시 표가 표시됩니다.</p>`}
      </div>
      <div class="card">
        <div class="form-head">
          <div>
            <h2 class="card-title">등록된 전체 기자재</h2>
            <p class="muted">관리처와 카테고리 탭으로 나눠 확인합니다.</p>
          </div>
          <span class="tag blue">${filtered.length}개</span>
        </div>
        <div class="tab-row">
          ${sourceTabs.map(([key, label]) => `<button class="tab-button ${state.adminEquipmentTab === key ? "active" : ""}" data-admin-equipment-tab="${key}">${label}</button>`).join("")}
        </div>
        <div class="tab-row wrap">
          <button class="tab-button ${state.adminEquipmentCategoryTab === "all" ? "active" : ""}" data-admin-equipment-category-tab="all">전체</button>
          ${categories.map((cat) => `<button class="tab-button ${state.adminEquipmentCategoryTab === cat ? "active" : ""}" data-admin-equipment-category-tab="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`).join("")}
        </div>
        <div class="table-wrap embedded">
          <table>
            <thead><tr><th>코드</th><th>장비</th><th>분류</th><th>관리처</th><th>상태</th><th>예약</th><th>작업</th></tr></thead>
            <tbody>${filtered.map((item) => `
              <tr>
                <td>${escapeHtml(item.code)}</td>
                <td>${escapeHtml(item.name)}<br><span class="muted">${escapeHtml(item.notes || "")}</span></td>
                <td>${escapeHtml(item.category)}</td>
                <td>${escapeHtml(sourceLabel[item.source] || item.facility || "-")}</td>
                <td>${escapeHtml(item.status)}</td>
                <td>${item.reservable ? tag("가능", "green") : tag("문의전용", "yellow")}</td>
                <td><button class="button danger" data-equipment-disable="${item.id}">비활성</button></td>
              </tr>`).join("")}</tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}

function csvPreviewTable(rows) {
  const preview = rows.slice(0, 8);
  return `
    <div class="preview-box">
      <div class="form-head"><strong>임시 미리보기</strong><span class="tag yellow">${rows.length}행</span></div>
      <div class="table-wrap embedded">
        <table>
          <thead><tr><th>관리처</th><th>카테고리</th><th>장비명</th><th>수량</th><th>예약</th><th>비고</th></tr></thead>
          <tbody>${preview.map((row) => `
            <tr>
              <td>${escapeHtml(row.facility || sourceLabel[row.source] || row.source || "-")}</td>
              <td>${escapeHtml(row.category || "Other")}</td>
              <td>${escapeHtml(row.name || "(장비명 없음)")}</td>
              <td>${escapeHtml(row.quantity || "1")}</td>
              <td>${escapeHtml(row.reservable || row.inquiry_only || "-")}</td>
              <td>${escapeHtml(row.notes || "")}</td>
            </tr>
          `).join("")}</tbody>
        </table>
      </div>
      ${rows.length > preview.length ? `<p class="muted">표시는 ${preview.length}행까지만 보여주고, 등록은 전체 ${rows.length}행을 사용합니다.</p>` : ""}
    </div>
  `;
}

function adminReportsView() {
  return `
    <section class="grid">
      ${adminGuide("보고서 사용 가이드", "스튜디오 사용 후 학생이 제출한 보고서를 확인하는 화면입니다. 파손/이상 여부와 실제 사용 인원을 확인하고 필요한 경우 예약 상태를 완료 처리하세요.")}
      ${state.adminReports.length ? state.adminReports.map((report) => `
        <article class="card">
          <div class="chips"><span class="tag blue">스튜디오 보고서</span><span class="tag green">제출완료</span></div>
          <h3 class="card-title card-title-spaced">${escapeHtml(report.user?.name || "-")}</h3>
          <div class="property-list">
            <div class="prop"><span class="key">예약</span><span>${escapeHtml(report.reservationId)}</span></div>
            <div class="prop"><span class="key">사용 시간</span><span>${escapeHtml(report.fields.actualTime)}</span></div>
            <div class="prop"><span class="key">인원</span><span>${escapeHtml(report.fields.participants)}</span></div>
            <div class="prop"><span class="key">파손</span><span>${report.fields.damageFound ? escapeHtml(report.fields.damageDescription || "있음") : "없음"}</span></div>
          </div>
        </article>`).join("") : `<p class="empty">제출된 보고서가 없습니다.</p>`}
    </section>
  `;
}

function adminLecturesView() {
  return `
    <section class="grid">
      ${adminGuide("비교과 특강 사용 가이드", "특강 정보를 등록하면 학생 화면에 리스트가 표시됩니다. 모집중 상태인 특강은 학생이 직접 신청할 수 있고, 결과는 CSV로 내려받아 엑셀에서 열 수 있습니다.")}
      <div class="card">
        <h2 class="card-title">특강 등록</h2>
        <form class="grid two" data-form="lecture-add">
          <div class="field"><label>특강명</label><input class="input" name="title" required /></div>
          <div class="field"><label>특강일</label><input class="input" name="lectureDate" type="date" required /></div>
          <div class="field"><label>시간</label><input class="input" name="time" placeholder="14:00-16:00" required /></div>
          <div class="field"><label>장소</label><input class="input" name="location" required /></div>
          <div class="field"><label>강사명</label><input class="input" name="instructorName" required /></div>
          <div class="field"><label>강사 소속</label><input class="input" name="instructorAffiliation" /></div>
          <div class="field"><label>담당교수</label><input class="input" name="professor" /></div>
          <div class="field"><label>대상 학년</label><input class="input" name="targetGrades" placeholder="예: 2-4학년" /></div>
          <div class="field"><label>모집인원</label><input class="input" name="capacity" type="number" min="0" value="0" /></div>
          <div class="field"><label>신청인원</label><input class="input" name="baseApplicationCount" type="number" min="0" value="0" /></div>
          <div class="field"><label>진행상태</label><select class="select" name="status">${lectureStatusOptions.map((item) => `<option>${item}</option>`).join("")}</select></div>
          <div class="field"><label>비고</label><input class="input" name="notes" /></div>
          <div class="field span-two"><label>특강 내용</label><textarea class="textarea" name="description" required></textarea></div>
          <button class="button primary" type="submit">특강 등록</button>
        </form>
      </div>
      <div class="card">
        <div class="form-head">
          <div>
            <h2 class="card-title">특강 리스트</h2>
            <p class="muted">날짜, 특강명, 강사명, 장소, 신청인원, 진행상태를 기준으로 확인합니다.</p>
          </div>
          <button class="button" data-action="lecture-export">CSV 내보내기</button>
        </div>
        ${state.adminLectures.length ? adminLectureTable(state.adminLectures) : `<p class="empty">등록된 비교과 특강이 없습니다.</p>`}
      </div>
    </section>
  `;
}

function adminLectureTable(lectures) {
  return `
    <div class="table-wrap embedded">
      <table>
        <thead><tr><th>날짜</th><th>특강명</th><th>강사명</th><th>장소</th><th>신청인원</th><th>진행상태</th><th>작업</th></tr></thead>
        <tbody>${lectures.map((lecture) => {
          const count = Number(lecture.applicationCount || 0);
          const capacity = Number(lecture.capacity || 0);
          return `
            <tr>
              <td>${escapeHtml(lecture.lectureDate || "-")}<br><span class="muted">${escapeHtml(lecture.time || "")}</span></td>
              <td><strong>${escapeHtml(lecture.title)}</strong><br><span class="muted">${escapeHtml(lecture.description || "")}</span></td>
              <td>${escapeHtml(lecture.instructorName || "-")}<br><span class="muted">${escapeHtml(lecture.instructorAffiliation || "")}</span></td>
              <td>${escapeHtml(lecture.location || "-")}</td>
              <td>${capacity ? `${count}/${capacity}` : count}</td>
              <td><select class="select compact-select" data-lecture-status="${lecture.id}">${lectureStatusOptions.map((item) => `<option value="${item}" ${lecture.status === item ? "selected" : ""}>${item}</option>`).join("")}</select></td>
              <td>
                <button class="button compact" data-lecture-update="${lecture.id}">상태 저장</button>
                <div class="muted">${(lecture.applications || []).map((app) => `${app.userName || app.name || ""} ${app.studentId || ""}`).filter(Boolean).join(", ") || "신청자 없음"}</div>
              </td>
            </tr>
          `;
        }).join("")}</tbody>
      </table>
    </div>
  `;
}

function adminNoticesView() {
  return `
    <section class="grid">
      ${adminGuide("공지사항 사용 가이드", "비교과, 특강, 장비/시설 안내를 학생 화면에 공지합니다. 중요한 내용은 상단 고정으로 설정하고, 신청은 Slack 링크나 외부 링크를 넣으면 됩니다.")}
      <div class="card">
        <h2 class="card-title">공지 작성</h2>
        <form data-form="notice-add">
          <div class="field"><label>제목</label><input class="input" name="title" required /></div>
          <div class="field"><label>카테고리</label><select class="select" name="category">${["일반", "비교과", "특강", "장비/시설", "긴급"].map((item) => `<option>${item}</option>`).join("")}</select></div>
          <div class="field"><label>본문</label><textarea class="textarea" name="body" required></textarea></div>
          <div class="field"><label>신청/참고 링크</label><input class="input" name="link" /></div>
          <label class="field"><span><input type="checkbox" name="pinned" value="true" /> 상단 고정</span></label>
          <button class="button primary" type="submit">게시</button>
        </form>
      </div>
      ${state.adminNotices.map(noticeCard).join("")}
    </section>
  `;
}

function adminSettingsView() {
  const settings = state.bootstrap.settings;
  return `
    <section class="grid">
      ${adminGuide("설정 사용 가이드", "학기별 수업 시간, 출력실 시간, 암실 정원처럼 예약 규칙에 영향을 주는 값을 관리합니다. 차단 일정은 캘린더에 표시되어 조교가 학기 운영 상황을 빠르게 확인할 수 있습니다.")}
      <div class="card">
        <h2 class="card-title">운영 설정</h2>
        <form data-form="settings-save">
          <div class="field"><label>출력비 계좌 안내</label><input class="input" name="printBankAccount" value="${escapeHtml(settings.printBankAccount)}" /></div>
          <div class="field"><label>암실 최대 인원</label><input class="input" name="darkroomCapacity" type="number" min="1" value="${settings.darkroomCapacity}" /></div>
          <div class="field"><label>출력실 시작</label><input class="input" name="printAvailableStart" value="${escapeHtml(settings.printAvailableStart)}" /></div>
          <div class="field"><label>출력실 종료</label><input class="input" name="printAvailableEnd" value="${escapeHtml(settings.printAvailableEnd)}" /></div>
          <button class="button primary" type="submit">저장</button>
        </form>
      </div>
      <div class="card">
        <h2 class="card-title">수업/학기 차단 일정</h2>
        <p class="muted">예: 월요일 10:30-17:00 Studio A/B 사용 불가. 등록 후 아래 캘린더에 표시됩니다.</p>
        <form class="grid two" data-form="blocked-schedule-add">
          <div class="field"><label>시설</label><select class="select" name="type">
            <option value="studio">스튜디오</option>
            <option value="darkroom">암실</option>
            <option value="equipment">기자재</option>
            <option value="print">출력실</option>
          </select></div>
          <div class="field"><label>요일</label><select class="select" name="day">
            ${Object.entries(weekdayLabel).map(([key, label]) => `<option value="${key}">${label}요일</option>`).join("")}
          </select></div>
          <div class="field"><label>시작일</label><input class="input" name="from" type="date" required /></div>
          <div class="field"><label>종료일</label><input class="input" name="to" type="date" required /></div>
          <div class="field"><label>시작 시간</label><input class="input" name="start" placeholder="10:30" required /></div>
          <div class="field"><label>종료 시간</label><input class="input" name="end" placeholder="17:00" required /></div>
          <div class="field"><label>공간/메모</label><input class="input" name="target" placeholder="Studio A,B / 수업명" /></div>
          <button class="button primary" type="submit">차단 일정 추가</button>
        </form>
        ${blockedScheduleList(settings.blockedSchedules || [])}
      </div>
      ${adminBlockedCalendar(settings.blockedSchedules || [])}
      <div class="card"><h2 class="card-title">Slack</h2><p class="muted">Webhook URL은 코드가 아니라 서버 환경변수 SLACK_WEBHOOK_URL에 저장합니다.</p></div>
    </section>
  `;
}

function blockedScheduleList(items) {
  if (!items.length) return `<p class="empty">등록된 차단 일정이 없습니다.</p>`;
  return `
    <div class="blocked-list">
      ${items.map((item) => `
        <div class="blocked-item">
          <span class="tag blue">${typeLabel[item.type] || item.type}</span>
          <strong>${weekdayLabel[item.day] || item.day}요일 ${escapeHtml(item.start)}-${escapeHtml(item.end)}</strong>
          <span>${escapeHtml(item.from)} ~ ${escapeHtml(item.to)} · ${escapeHtml(item.target || "전체")}</span>
          <button class="button danger compact" data-blocked-remove="${item.id}">삭제</button>
        </div>
      `).join("")}
    </div>
  `;
}

function blockedItemsForDate(items, key) {
  const day = new Date(`${key}T00:00:00`).getDay();
  return items.filter((item) => {
    if (weekdayIndex[item.day] !== day) return false;
    if (item.from && key < item.from) return false;
    if (item.to && key > item.to) return false;
    return true;
  });
}

function adminBlockedCalendar(items) {
  const monthKey = state.calendarMonth || todayKey().slice(0, 7);
  const [year, month] = monthKey.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    const key = dateKey(day);
    const blocked = blockedItemsForDate(items, key);
    return { key, day: day.getDate(), currentMonth: day.getMonth() === month - 1, blocked };
  });
  return `
    <section class="calendar-card">
      <div class="calendar-head">
        <div>
          <p class="eyebrow">학기 차단 캘린더</p>
          <h2>${monthTitle(monthKey)}</h2>
        </div>
        <div class="row-actions">
          <button class="button compact" type="button" data-calendar-month="${addMonths(monthKey, -1)}">이전</button>
          <button class="button compact" type="button" data-calendar-month="${todayKey().slice(0, 7)}">오늘</button>
          <button class="button compact" type="button" data-calendar-month="${addMonths(monthKey, 1)}">다음</button>
        </div>
      </div>
      <div class="calendar-weekdays">${["일", "월", "화", "수", "목", "금", "토"].map((item) => `<span>${item}</span>`).join("")}</div>
      <div class="calendar-grid-large">
        ${days.map((day) => `
          <div class="calendar-day ${day.currentMonth ? "" : "outside"} ${day.blocked.length ? "blocked" : ""}">
            <span>${day.day}</span>
            ${day.blocked.slice(0, 2).map((item) => `<small>${typeLabel[item.type] || item.type} ${escapeHtml(item.start)}-${escapeHtml(item.end)}</small>`).join("")}
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function render() {
  if (!state.bootstrap) {
    $app.innerHTML = `<main class="auth-shell"><div class="auth-panel">불러오는 중...</div></main>`;
    return;
  }
  const body = !state.user ? authView() : state.user.role === "admin" ? adminShell() : studentShell();
  $app.innerHTML = `<div class="app">${body}${noticeBottomSheet()}${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}</div>`;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((item) => item.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((item) => item.trim());
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });
    return row;
  });
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadLectureCsv() {
  const headers = ["특강명", "특강일", "시간", "장소", "강사명", "강사 소속", "담당교수", "대상 학년", "모집인원", "신청인원", "진행상태", "신청자", "학번", "신분", "연락처", "신청일", "비고"];
  const rows = state.adminLectures.flatMap((lecture) => {
    const applications = lecture.applications || [];
    const base = [
      lecture.title,
      lecture.lectureDate,
      lecture.time,
      lecture.location,
      lecture.instructorName,
      lecture.instructorAffiliation,
      lecture.professor,
      lecture.targetGrades,
      lecture.capacity,
      lecture.applicationCount,
      lecture.status
    ];
    if (!applications.length) {
      return [[...base, "", "", "", "", "", lecture.notes || ""]];
    }
    return applications.map((app) => [
      ...base,
      app.userName,
      app.studentId,
      app.studentStatus,
      app.phone,
      formatDateTime(app.appliedAt),
      lecture.notes || ""
    ]);
  });
  const csv = "\uFEFF" + [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `gju-lectures-${todayKey()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function submitReservation(form) {
  const type = form.dataset.type;
  const data = formData(form);
  let fields = { ...data };
  if (!fields.reservedDate) {
    throw new Error("캘린더에서 예약 날짜를 선택하세요.");
  }
  if (type === "equipment") {
    const visibleChecked = getChecked("equipmentItemIds");
    state.selectedEquipmentItemIds = [...new Set([...state.selectedEquipmentItemIds, ...visibleChecked])];
    fields.equipmentItemIds = state.selectedEquipmentItemIds;
    if (!fields.equipmentItemIds.length) throw new Error("기자재를 1개 이상 선택하세요.");
  }
  if (type === "studio") {
    fields.timeSlots = getChecked("studioSlots");
    fields.studioSpaces = getChecked("studioSpaces");
    fields.studioSpace = fields.studioSpaces.join(", ");
    fields.reportStatus = "required";
    if (!fields.timeSlots.length) throw new Error("스튜디오 사용 시간을 선택하세요.");
    if (!fields.studioSpaces.length) throw new Error("스튜디오 사용 공간을 선택하세요.");
    if (fields.timeSlots.length > state.bootstrap.settings.studioMaxSlots) {
      throw new Error(`스튜디오는 최대 ${state.bootstrap.settings.studioMaxSlots}타임까지 예약할 수 있습니다.`);
    }
    if (!areSlotsConsecutive(fields.timeSlots, state.bootstrap.settings.studioSlots)) {
      throw new Error("스튜디오는 연속된 시간만 예약할 수 있습니다.");
    }
  }
  if (type === "darkroom") {
    fields.timeSlots = getChecked("darkroomSlots");
    fields.processTypes = getChecked("processTypes");
    fields.chemicals = state.bootstrap.darkroomChemicals.map((chem) => ({
      id: chem.id,
      name: chem.name,
      amount: data[`chem-${chem.id}`]
    })).filter((item) => item.amount);
    if (!fields.timeSlots.length) throw new Error("암실 사용 시간을 선택하세요.");
    if (!fields.processTypes.length) throw new Error("암실 작업 유형을 선택하세요.");
  }
  if (type === "print") {
    fields.printTypes = getChecked("printTypes");
    fields.papers = getChecked("papers");
    fields.sizes = getChecked("sizes");
    fields.printType = fields.printTypes.join(", ");
    fields.paper = fields.papers.join(", ");
    fields.size = fields.sizes.join(", ");
    if (!fields.printTypes.length) throw new Error("출력 종류를 선택하세요.");
    if (!fields.papers.length) throw new Error("용지를 선택하세요.");
    if (!fields.sizes.length) throw new Error("사이즈를 선택하세요.");
  }
  await api("/api/reservations", { method: "POST", body: { type, fields } });
  state.reservationType = "";
  if (type === "equipment") state.selectedEquipmentItemIds = [];
  state.view = "mine";
  await loadBootstrap();
  await loadMyReservations();
  toast(type === "equipment" ? "기자재 예약 승인 요청이 접수되었습니다." : "예약이 확정되었습니다.");
}

async function openReport(reservationId) {
  state.view = "reports";
  state.activeReportReservationId = reservationId;
  render();
}

async function changePassword(form) {
  const data = formData(form);
  if (data.newPassword !== data.confirmPassword) {
    throw new Error("새 비밀번호 확인이 일치하지 않습니다.");
  }
  await api("/api/me/password", {
    method: "PATCH",
    body: {
      currentPassword: data.currentPassword,
      newPassword: data.newPassword
    }
  });
  form.reset();
  toast("비밀번호가 변경되었습니다.");
}

document.addEventListener("click", async (event) => {
  const target = event.target.closest("button, a");
  if (!target) return;
  try {
    if (target.dataset.authMode) {
      state.authMode = target.dataset.authMode;
      render();
    }
    if (target.dataset.noticeOpen) {
      state.activeNoticeId = target.dataset.noticeOpen;
      render();
      return;
    }
    if (target.dataset.noticeClose !== undefined) {
      state.activeNoticeId = "";
      render();
      return;
    }
    if (target.dataset.calendarMonth) {
      state.calendarMonth = target.dataset.calendarMonth;
      render();
      return;
    }
    if (target.dataset.calendarDay) {
      const widget = target.closest("[data-calendar]");
      const type = widget?.dataset.calendar || state.reservationType;
      state.selectedDates[type] = target.dataset.calendarDay;
      widget?.querySelectorAll(".calendar-day").forEach((button) => button.classList.toggle("selected", button === target));
      const input = widget?.querySelector('input[name="reservedDate"]');
      if (input) input.value = target.dataset.calendarDay;
      const selectedLabel = widget?.querySelector("[data-calendar-selected]");
      if (selectedLabel) selectedLabel.textContent = target.dataset.calendarDay;
      const details = widget?.querySelector("[data-calendar-details]");
      if (details) details.innerHTML = calendarDayDetails(type, target.dataset.calendarDay);
      return;
    }
    if (target.dataset.action === "logout") await logout();
    if (target.dataset.equipmentCategory) {
      state.equipmentCategoryFilter = target.dataset.equipmentCategory;
      render();
      return;
    }
    if (target.dataset.equipmentRemove) {
      state.selectedEquipmentItemIds = state.selectedEquipmentItemIds.filter((itemId) => itemId !== target.dataset.equipmentRemove);
      render();
      return;
    }
    if (target.dataset.action === "csv-preview") {
      const form = target.closest("form");
      state.csvPreviewRows = parseCsv(formData(form).csv || "");
      render();
      return;
    }
    if (target.dataset.action === "lecture-export") {
      downloadLectureCsv();
      return;
    }
    if (target.dataset.studentView) {
      state.view = target.dataset.studentView;
      if (state.view === "mine") await loadMyReservations();
      if (state.view === "reports") await loadMyReservations();
      if (state.view === "lectures") await loadLectures();
      render();
    }
    if (target.dataset.reserveShortcut) {
      state.view = "reserve";
      state.reservationType = target.dataset.reserveShortcut;
      render();
    }
    if (target.dataset.reserveType) {
      state.reservationType = target.dataset.reserveType;
      render();
    }
    if (target.dataset.action === "reserve-back") {
      state.reservationType = "";
      render();
    }
    if (target.dataset.cancelRes) {
      if (!confirm("예약을 취소할까요?")) return;
      await api(`/api/reservations/${target.dataset.cancelRes}/cancel`, { method: "POST", body: { reason: "학생 취소" } });
      await loadBootstrap();
      await loadMyReservations();
      toast("예약이 취소되었습니다.");
    }
    if (target.dataset.reportRes) await openReport(target.dataset.reportRes);
    if (target.dataset.reportOpen) {
      state.activeReportReservationId = target.dataset.reportOpen;
      render();
      return;
    }
    if (target.dataset.reportClose !== undefined) {
      state.activeReportReservationId = "";
      render();
      return;
    }
    if (target.dataset.lectureApply) {
      await api(`/api/lectures/${target.dataset.lectureApply}/apply`, { method: "POST" });
      await loadLectures();
      toast("특강 신청이 완료되었습니다.");
      render();
      return;
    }
    if (target.dataset.adminView) {
      if (target.dataset.adminReservationTab) state.adminReservationTab = target.dataset.adminReservationTab;
      state.adminView = target.dataset.adminView;
      render();
    }
    if (target.dataset.adminReservationTab && !target.dataset.adminView) {
      state.adminReservationTab = target.dataset.adminReservationTab;
      render();
    }
    if (target.dataset.adminEquipmentTab) {
      state.adminEquipmentTab = target.dataset.adminEquipmentTab;
      render();
    }
    if (target.dataset.adminEquipmentCategoryTab) {
      state.adminEquipmentCategoryTab = target.dataset.adminEquipmentCategoryTab;
      render();
    }
    if (target.dataset.lectureUpdate) {
      const status = document.querySelector(`[data-lecture-status="${target.dataset.lectureUpdate}"]`)?.value || "모집중";
      await api(`/api/admin/lectures/${target.dataset.lectureUpdate}`, { method: "PATCH", body: { status } });
      await loadAdminData();
      toast("특강 상태를 저장했습니다.");
    }
    if (target.dataset.blockedRemove) {
      const settings = state.bootstrap.settings;
      const blockedSchedules = (settings.blockedSchedules || []).filter((item) => item.id !== target.dataset.blockedRemove);
      await api("/api/admin/settings", { method: "PATCH", body: { blockedSchedules } });
      await loadBootstrap();
      toast("차단 일정을 삭제했습니다.");
    }
    if (target.dataset.userSort) {
      const field = target.dataset.userSort;
      state.adminUserSort = {
        field,
        direction: state.adminUserSort.field === field && state.adminUserSort.direction === "asc" ? "desc" : "asc"
      };
      render();
      return;
    }
    if (target.dataset.userApproval) {
      const body = { approvalStatus: target.dataset.status };
      if (target.dataset.status === "blocked") {
        body.limitDuration = document.querySelector(`[data-user-limit-duration="${target.dataset.userApproval}"]`)?.value || "week1";
      }
      await api(`/api/admin/users/${target.dataset.userApproval}/approval`, { method: "PATCH", body });
      await loadAdminData();
      toast("사용자 상태를 변경했습니다.");
    }
    if (target.dataset.userReset) {
      const input = prompt("새 비밀번호를 입력하세요. 비워두면 임시 비밀번호가 자동 생성됩니다.", "");
      if (input === null) return;
      const body = input.trim() ? { newPassword: input.trim() } : {};
      const result = await api(`/api/admin/users/${target.dataset.userReset}/password`, { method: "PATCH", body });
      if (result.generatedPassword) {
        alert(`임시 비밀번호: ${result.generatedPassword}\n학생에게 전달한 뒤 첫 로그인에서 변경하도록 안내하세요.`);
      } else {
        toast("비밀번호를 변경했습니다.");
      }
      return;
    }
    if (target.dataset.resStatus) {
      await api(`/api/admin/reservations/${target.dataset.resStatus}/status`, { method: "PATCH", body: { status: target.dataset.status } });
      await loadAdminData();
      toast("예약 상태를 변경했습니다.");
    }
    if (target.dataset.equipmentDisable) {
      await api(`/api/admin/equipment/${target.dataset.equipmentDisable}`, { method: "PATCH", body: { active: false } });
      await loadAdminData();
      toast("장비를 비활성화했습니다.");
    }
  } catch (error) {
    toast(error.message);
  }
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (target.name === "equipmentItemIds") {
    if (target.checked && !state.selectedEquipmentItemIds.includes(target.value)) {
      state.selectedEquipmentItemIds.push(target.value);
    }
    if (!target.checked) {
      state.selectedEquipmentItemIds = state.selectedEquipmentItemIds.filter((itemId) => itemId !== target.value);
    }
    syncEquipmentSelectionSheet();
  }
});

document.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  try {
    if (form.dataset.form === "login") await login(form);
    if (form.dataset.form === "signup") await signup(form);
    if (form.dataset.form === "password-change") {
      await changePassword(form);
      return;
    }
    if (form.dataset.form === "profile-edit") {
      const result = await api("/api/me", { method: "PATCH", body: formData(form) });
      state.user = result.user;
      toast("개인정보를 저장했습니다.");
      render();
      return;
    }
    if (form.dataset.form === "reservation") await submitReservation(form);
    if (form.dataset.form === "equipment-add") {
      const data = formData(form);
      data.quantity = Number(data.quantity || 1);
      await api("/api/admin/equipment", { method: "POST", body: data });
      await loadBootstrap();
      await loadAdminData();
      toast("장비를 추가했습니다.");
    }
    if (form.dataset.form === "equipment-category-add") {
      const data = formData(form);
      const next = [...new Set([...(state.bootstrap.settings.equipmentCategories || equipmentCategories()), data.categoryName.trim()].filter(Boolean))];
      await api("/api/admin/settings", { method: "PATCH", body: { equipmentCategories: next } });
      await loadBootstrap();
      toast("카테고리를 추가했습니다.");
    }
    if (form.dataset.form === "equipment-import") {
      const rows = state.csvPreviewRows.length ? state.csvPreviewRows : parseCsv(formData(form).csv || "");
      await api("/api/admin/equipment/import", { method: "POST", body: { rows } });
      state.csvPreviewRows = [];
      await loadBootstrap();
      await loadAdminData();
      toast("CSV 장비를 등록했습니다.");
    }
    if (form.dataset.form === "notice-add") {
      const data = formData(form);
      data.pinned = data.pinned === "true";
      await api("/api/admin/notices", { method: "POST", body: data });
      await loadAdminData();
      toast("공지사항을 게시했습니다.");
    }
    if (form.dataset.form === "lecture-add") {
      const data = formData(form);
      data.capacity = Number(data.capacity || 0);
      data.baseApplicationCount = Number(data.baseApplicationCount || 0);
      await api("/api/admin/lectures", { method: "POST", body: data });
      form.reset();
      await loadAdminData();
      toast("특강을 등록했습니다.");
    }
    if (form.dataset.form === "studio-report") {
      const data = formData(form);
      data.reservationId = form.dataset.reservationId;
      data.cleanupConfirmed = data.cleanupConfirmed === "true";
      data.damageFound = data.damageFound === "true";
      await api("/api/reports/studio", { method: "POST", body: data });
      state.activeReportReservationId = "";
      await loadBootstrap();
      await loadMyReservations();
      toast("스튜디오 보고서가 제출되었습니다.");
      render();
    }
    if (form.dataset.form === "settings-save") {
      const data = formData(form);
      data.darkroomCapacity = Number(data.darkroomCapacity || 6);
      await api("/api/admin/settings", { method: "PATCH", body: data });
      await loadBootstrap();
      toast("설정을 저장했습니다.");
    }
    if (form.dataset.form === "blocked-schedule-add") {
      const data = formData(form);
      const blockedSchedules = [
        ...(state.bootstrap.settings.blockedSchedules || []),
        {
          id: `block_${Date.now()}`,
          type: data.type,
          day: data.day,
          from: data.from,
          to: data.to,
          start: data.start,
          end: data.end,
          target: data.target || ""
        }
      ];
      await api("/api/admin/settings", { method: "PATCH", body: { blockedSchedules } });
      await loadBootstrap();
      toast("차단 일정을 추가했습니다.");
    }
  } catch (error) {
    toast(error.message);
  }
});

init().catch((error) => {
  $app.innerHTML = `<main class="auth-shell"><div class="auth-panel">초기화 실패: ${escapeHtml(error.message)}</div></main>`;
});
