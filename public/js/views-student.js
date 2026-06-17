import { state } from "./state.js?v=20260616-feat5";
import { statusLabel, typeLabel } from "./constants.js?v=20260616-feat5";
import {
  addDaysToDateKey,
  areSlotsConsecutive,
  calendar,
  darkroomSlotBlocked,
  darkroomSlotRemaining,
  equipmentCategories,
  equipmentItemReservedInRange,
  equipmentRangeBlocked,
  equipmentRangeLabel,
  equipmentReservationRange,
  escapeHtml,
  isPastDate,
  minutesToTime,
  noticePreview,
  printBucketBlocked,
  printBucketUsage,
  printCapacityBuckets,
  studioSlotBlocked,
  studioPairReservedOnDate,
  sortedNotices,
  tag,
  timeToMinutes,
  todayKey
} from "./utils.js?v=20260616-feat5";

export function authView() {
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
                <div class="field"><label>아이디</label><input class="input" name="loginId" placeholder="이메일/학번" autocomplete="username" required /></div>
                <div class="field"><label>비밀번호</label><input class="input" name="password" type="password" autocomplete="current-password" required /></div>
                <label class="field consent"><span><input type="checkbox" name="rememberLogin" value="true" checked /> 로그인 유지하기</span></label>
                <button class="button primary full" type="submit">접속</button>
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
                <div class="field"><label>비밀번호</label><input class="input" name="password" type="password" autocomplete="new-password" minlength="8" required /></div>
                <button class="button primary full" type="submit">가입 신청</button>
                <p class="muted">승인 전에도 공지는 볼 수 있지만 예약은 불가합니다.</p>
              </form>`
        }
      </section>
    </main>
  `;
}

export function studentShell() {
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

export function studentContent() {
  if (state.view === "reserve") return reserveView();
  if (state.view === "mine") return myReservationsView();
  if (state.view === "reports") return reportsView();
  if (state.view === "lectures") return lecturesView();
  if (state.view === "notices") return noticesView();
  if (state.view === "my") return myPageView();
  return homeView();
}

export function facilityCard(type, title, desc, code, statusText, tone = "blue") {
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

export function homeLecturesCard(lectures) {
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

export function homeNoticeList(notices) {
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

export function homeView() {
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

export function reserveView() {
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

export function reservationForm(type) {
  if (type === "equipment") return equipmentForm();
  if (type === "studio") return studioForm();
  if (type === "darkroom") return darkroomForm();
  return printForm();
}

function isFridayDateKey(dateKey) {
  return Boolean(dateKey) && new Date(`${dateKey}T00:00:00`).getDay() === 5;
}

// "2박3일"은 화면에서 "2박3일(주말)"로 표기한다.
const EQUIPMENT_PERIOD_LABELS = { "2박3일": "2박3일(주말)" };
function equipmentPeriodLabel(value) {
  return EQUIPMENT_PERIOD_LABELS[value] || value;
}

// 평일에는 주말 옵션을 숨긴다: "주말사용" 항목은 항상 제거하고, "2박3일(주말)"은 금요일 시작만 노출.
function equipmentPeriodOptions(selectedDate) {
  const periods = state.bootstrap.settings.equipmentPeriods || ["당일"];
  const friday = isFridayDateKey(selectedDate);
  return periods.filter((item) => {
    if (String(item).includes("주말사용")) return false;
    if (String(item).includes("2박3일")) return friday;
    return true;
  });
}

function selectedEquipmentPeriod(selectedDate) {
  const periods = equipmentPeriodOptions(selectedDate);
  if (!state.selectedEquipmentPeriod || !periods.includes(state.selectedEquipmentPeriod)) {
    state.selectedEquipmentPeriod = periods[0] || "당일";
  }
  return state.selectedEquipmentPeriod;
}

function selectedEquipmentTime(stateKey, settingKey) {
  const options = state.bootstrap.settings[settingKey] || [];
  if (!state[stateKey] || !options.includes(state[stateKey])) {
    state[stateKey] = options[0] || "";
  }
  return state[stateKey];
}

function pastDateMessage() {
  return `<p class="muted">오늘 이전 날짜는 예약할 수 없습니다. 캘린더의 기존 예약 기록만 확인할 수 있습니다.</p>`;
}

function equipmentPeriodStep(selectedDate, period, rentalTime, returnTime, pastDate, rangeBlocked) {
  if (!selectedDate) {
    return reservationStep(2, "대여 기간/시간 선택", `<p class="muted">먼저 캘린더에서 대여 시작 날짜를 선택하세요.</p>`, { locked: true });
  }
  if (pastDate) {
    return reservationStep(2, "대여 기간/시간 선택", pastDateMessage(), { locked: true });
  }
  return reservationStep(2, "대여 기간/시간 선택", `
    <div class="studio-time-summary">
      <strong>${escapeHtml(equipmentRangeLabel(selectedDate, period))}</strong>
      <span>${rangeBlocked ? "선택 기간에 차단 일정이 포함되어 예약할 수 없습니다." : "선택한 기간 전체에 겹치는 장비는 다음 단계에서 자동으로 제외됩니다."}</span>
    </div>
    <div class="grid two control-grid">
      <div class="field"><label>대여기간</label><select class="select" name="period">${equipmentPeriodOptions(selectedDate).map((item) => `<option value="${escapeHtml(item)}" ${item === period ? "selected" : ""}>${escapeHtml(equipmentPeriodLabel(item))}</option>`).join("")}</select>${isFridayDateKey(selectedDate) ? "" : `<small class="muted">2박3일(주말) 대여는 금요일 시작만 선택할 수 있습니다.</small>`}</div>
      <div class="field"><label>대여 시간</label><select class="select" name="rentalTime">${state.bootstrap.settings.equipmentRentalTimes.map((item) => `<option ${item === rentalTime ? "selected" : ""}>${escapeHtml(item)}</option>`).join("")}</select></div>
      <div class="field"><label>반납 시간</label><select class="select" name="returnTime">${state.bootstrap.settings.equipmentReturnTimes.map((item) => `<option ${item === returnTime ? "selected" : ""}>${escapeHtml(item)}</option>`).join("")}</select></div>
    </div>
  `, rangeBlocked ? { note: "기간을 변경하거나 다른 날짜를 선택하세요." } : {});
}

function equipmentPickerStep(selectedDate, period, categories, visibleItems, selectedItems, pastDate, rangeBlocked) {
  if (!selectedDate) {
    return reservationStep(3, "기자재 선택", `<p class="muted">대여 시작 날짜를 선택하면 기자재 목록이 열립니다.</p>`, { locked: true });
  }
  if (pastDate) {
    return reservationStep(3, "기자재 선택", pastDateMessage(), { locked: true });
  }
  if (rangeBlocked) {
    return reservationStep(3, "기자재 선택", `<p class="muted">선택한 대여 기간에 기자재 차단 일정이 포함되어 있습니다. 다른 기간을 선택하세요.</p>`, { locked: true });
  }
  return reservationStep(3, "기자재 선택", `
    <div class="equipment-picker-head">
      <strong>선택 기간 ${escapeHtml(equipmentRangeLabel(selectedDate, period))}</strong>
      <span>이미 겹치는 장비는 선택 불가</span>
    </div>
    <div class="tab-row wrap equipment-tabs">
      ${categories.map((cat) => {
        const count = state.bootstrap.equipment.filter((item) => item.active !== false && item.reservable && item.status === "가능" && item.category === cat).length;
        const selectedCount = selectedItems.filter((item) => item.category === cat).length;
        return `<button class="tab-button ${state.equipmentCategoryFilter === cat ? "active" : ""}" type="button" data-equipment-category="${escapeHtml(cat)}">${escapeHtml(cat)} <span>${selectedCount ? `${selectedCount}/` : ""}${count}</span></button>`;
      }).join("")}
    </div>
    <div class="equipment-picker-head">
      <strong>${escapeHtml(state.equipmentCategoryFilter)}</strong>
      <span>${visibleItems.length}개 중 ${selectedItems.filter((item) => item.category === state.equipmentCategoryFilter).length}개 선택</span>
    </div>
    <div class="choice-grid equipment-choice-grid">
      ${visibleItems.map((item) => {
        const unavailable = equipmentItemReservedInRange(item.id, selectedDate, period);
        return `
          <label class="choice-card equipment-choice ${unavailable ? "is-unavailable" : ""}">
            <input type="checkbox" name="equipmentItemIds" value="${item.id}" ${state.selectedEquipmentItemIds.includes(item.id) ? "checked" : ""} ${unavailable ? "disabled" : ""} />
            <span>
              <strong>${escapeHtml(item.name)}</strong>
              <small>${escapeHtml(item.code)}${item.notes ? ` · ${escapeHtml(item.notes)}` : ""}${unavailable ? ` · ${escapeHtml(equipmentRangeLabel(selectedDate, period))} 예약됨` : ""}</small>
            </span>
          </label>
        `;
      }).join("")}
    </div>
    ${equipmentSelectionSheet(selectedItems)}
  `, { note: "카테고리로 좁혀보고 필요한 장비는 여러 개 담을 수 있습니다." });
}

function equipmentDetailStep(selectedItems, pastDate, rangeBlocked) {
  if (pastDate) {
    return reservationStep(4, "나머지 정보 입력", pastDateMessage(), { locked: true });
  }
  if (rangeBlocked) {
    return reservationStep(4, "나머지 정보 입력", `<p class="muted">차단 일정과 겹치는 기간에는 승인 요청을 보낼 수 없습니다.</p>`, { locked: true });
  }
  if (!selectedItems.length) {
    return reservationStep(4, "나머지 정보 입력", `<p class="muted">기자재를 1개 이상 선택하면 연락처, 목적, 요청사항 입력란이 열립니다.</p>`, { locked: true });
  }
  return reservationStep(4, "나머지 정보 입력", `
    <div class="field"><label>연락처</label><input class="input" name="phone" value="${escapeHtml(state.user.phone)}" required /></div>
    <div class="field"><label>스탠드/소프트박스 요청</label><input class="input" name="standRequest" placeholder="예약 후 조교와 직접 확인" /></div>
    <div class="field"><label>사용 목적</label><textarea class="textarea" name="purpose" placeholder="촬영 목적을 간단히 입력"></textarea></div>
    <label class="field consent"><span><input type="checkbox" required /> 파손/분실 자가부담 및 대리 대여/반납 불가에 동의합니다.</span></label>
    <button class="button primary full" type="submit">승인 요청</button>
  `);
}

function fantasyLabEquipmentSection() {
  const items = state.bootstrap.equipment.filter((item) => item.active !== false && item.source === "fantasy_lab");
  if (!items.length) return "";
  const groupedMap = new Map();
  for (const item of items) {
    const key = `${item.category || "Other"}|${item.name}|${item.notes || ""}`;
    const group = groupedMap.get(key) || {
      category: item.category || "Other",
      name: item.name,
      notes: item.notes || "",
      count: 0
    };
    group.count += 1;
    groupedMap.set(key, group);
  }
  const grouped = [...groupedMap.values()].sort((a, b) => {
    const categorySort = equipmentCategories().indexOf(a.category) - equipmentCategories().indexOf(b.category);
    return categorySort || a.name.localeCompare(b.name, "ko");
  });
  const categoryCounts = grouped.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.count;
    return acc;
  }, {});
  return `
    <section class="reservation-step inquiry-equipment-step">
      <div class="step-heading">
        <span>!</span>
        <div>
          <strong>온라인 예약불가 기자재</strong>
          <p>판타지랩 기자재는 목록 확인만 가능하며, 예약과 대여는 판타지랩 조교에게 직접 문의해야 합니다.</p>
        </div>
      </div>
      <div class="info-strip">
        <strong>판타지랩 장비 안내</strong>
        <span>아래 장비는 이 사이트에서 선택하거나 예약할 수 없습니다. 필요 시 판타지랩 담당 조교와 일정, 수량, 반납 조건을 별도로 확인하세요.</span>
      </div>
      <div class="tab-row wrap">
        ${Object.entries(categoryCounts).map(([category, count]) => `<span class="tag yellow">${escapeHtml(category)} ${count}</span>`).join("")}
      </div>
      <div class="choice-grid equipment-choice-grid">
        ${grouped.map((item) => `
          <article class="choice-card equipment-choice is-unavailable">
            ${tag("예약불가", "yellow")}
            <span>
              <strong>${escapeHtml(item.name)}</strong>
              <small>${escapeHtml(item.category)} · ${item.count}개${item.notes ? ` · ${escapeHtml(item.notes)}` : ""}</small>
            </span>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

export function equipmentForm() {
  const reservable = state.bootstrap.equipment.filter((item) => item.active !== false && item.reservable && item.status === "가능");
  const categories = equipmentCategories().filter((cat) => reservable.some((item) => item.category === cat));
  if (!categories.includes(state.equipmentCategoryFilter)) state.equipmentCategoryFilter = categories[0] || "Other";
  const selectedDate = state.selectedDates.equipment || "";
  const pastDate = isPastDate(selectedDate);
  const period = selectedEquipmentPeriod(selectedDate);
  const rentalTime = selectedEquipmentTime("selectedEquipmentRentalTime", "equipmentRentalTimes");
  const returnTime = selectedEquipmentTime("selectedEquipmentReturnTime", "equipmentReturnTimes");
  const rangeBlocked = Boolean(selectedDate && !pastDate && equipmentRangeBlocked(selectedDate, period).length);
  if (pastDate) {
    state.selectedEquipmentItemIds = [];
  } else if (rangeBlocked) {
    state.selectedEquipmentItemIds = [];
  } else if (selectedDate) {
    state.selectedEquipmentItemIds = state.selectedEquipmentItemIds.filter((itemId) => !equipmentItemReservedInRange(itemId, selectedDate, period));
  }
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
        ${reservationStep(1, "날짜 선택", `<p class="selected-date">대여 시작 날짜: <strong>${selectedDate || "캘린더에서 날짜를 선택하세요"}</strong></p>`)}
        ${equipmentPeriodStep(selectedDate, period, rentalTime, returnTime, pastDate, rangeBlocked)}
        ${equipmentPickerStep(selectedDate, period, categories, visibleItems, selectedItems, pastDate, rangeBlocked)}
        ${equipmentDetailStep(selectedItems, pastDate, rangeBlocked)}
        ${fantasyLabEquipmentSection()}
      </section>
    </form>
  `;
}

export function equipmentSelectionSheet(items) {
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

export function currentSelectedEquipmentItems() {
  const reservable = state.bootstrap.equipment.filter((item) => item.active !== false && item.reservable && item.status === "가능");
  return state.selectedEquipmentItemIds.map((itemId) => reservable.find((item) => item.id === itemId)).filter(Boolean);
}

export function syncEquipmentSelectionSheet() {
  const sheet = document.querySelector(".selection-sheet");
  if (!sheet) return;
  sheet.outerHTML = equipmentSelectionSheet(currentSelectedEquipmentItems());
}

function reservationStep(index, title, body, options = {}) {
  return `
    <section class="reservation-step ${options.locked ? "is-locked" : ""}">
      <div class="step-heading">
        <span>${index}</span>
        <div>
          <strong>${escapeHtml(title)}</strong>
          ${options.note ? `<p>${escapeHtml(options.note)}</p>` : ""}
        </div>
      </div>
      ${body}
    </section>
  `;
}

function studioSpaceStep(selectedDate, pastDate) {
  if (!selectedDate) {
    return reservationStep(2, "공간 1개 선택", `<p class="muted">먼저 캘린더에서 예약 날짜를 선택하세요.</p>`, { locked: true });
  }
  if (pastDate) {
    return reservationStep(2, "공간 1개 선택", pastDateMessage(), { locked: true });
  }
  return reservationStep(
    2,
    "공간 1개 선택",
    `<div class="choice-grid">${state.bootstrap.settings.studioSpaces.map((space) => {
      const availableSlots = state.bootstrap.settings.studioSlots.filter((slot) => !studioPairReservedOnDate(selectedDate, space, slot) && !studioSlotBlocked(selectedDate, space, slot));
      const full = availableSlots.length === 0;
      return `
        <label class="choice-card compact-choice ${full ? "is-unavailable" : ""}">
          <input type="radio" name="studioSpace" value="${escapeHtml(space)}" ${state.selectedStudioSpace === space ? "checked" : ""} ${full ? "disabled" : ""} />
          <span>
            <strong>${escapeHtml(space)}</strong>
            <small>${full ? "해당 날짜 예약 불가" : `선택 가능 시간 ${availableSlots.length}개`}</small>
          </span>
        </label>
      `;
    }).join("")}</div>`,
    { note: "선택한 날짜에 시간대가 남아 있는 공간만 선택할 수 있습니다." }
  );
}

function studioTimeStep(selectedDate, pastDate) {
  if (!selectedDate) {
    return reservationStep(3, "사용 가능한 시간 선택", `<p class="muted">날짜와 공간을 선택하면 사용 가능한 시간만 표시됩니다.</p>`, { locked: true });
  }
  if (pastDate) {
    return reservationStep(3, "사용 가능한 시간 선택", pastDateMessage(), { locked: true });
  }
  if (!state.selectedStudioSpace) {
    return reservationStep(3, "사용 가능한 시간 선택", `<p class="muted">공간을 1개 선택하면 해당 공간의 남은 시간만 표시됩니다.</p>`, { locked: true });
  }
  const maxSlots = Number(state.bootstrap.settings.studioMaxSlots || 3);
  const availableSlots = state.bootstrap.settings.studioSlots.filter((slot) => !studioPairReservedOnDate(selectedDate, state.selectedStudioSpace, slot) && !studioSlotBlocked(selectedDate, state.selectedStudioSpace, slot));
  if (!availableSlots.length) {
    return reservationStep(
      3,
      "사용 가능한 시간 선택",
      `<p class="empty-calendar-note">선택한 날짜와 공간에는 예약 가능한 시간이 없습니다.</p>`,
      { note: `${state.selectedStudioSpace} · ${selectedDate}` }
    );
  }
  return reservationStep(
    3,
    "사용 가능한 시간 선택",
    `
      <div class="studio-time-summary">
        <strong>${escapeHtml(state.selectedStudioSpace)}</strong>
        <span>${escapeHtml(selectedDate)} · 최대 ${maxSlots}타임 연속 선택</span>
      </div>
      <div class="choice-grid">${availableSlots.map((slot) => {
        const checked = state.selectedStudioSlots.includes(slot);
        const maxed = state.selectedStudioSlots.length >= maxSlots && !checked;
        return `
          <label class="choice-card compact-choice ${maxed ? "is-unavailable" : ""}">
            <input type="checkbox" name="studioSlots" value="${escapeHtml(slot)}" ${checked ? "checked" : ""} ${maxed ? "disabled" : ""} />
            <span><strong>${escapeHtml(slot)}</strong><small>${checked ? "선택됨" : "예약 가능"}</small></span>
          </label>
        `;
      }).join("")}</div>
    `,
    { note: "이미 예약된 시간은 목록에 표시하지 않습니다." }
  );
}

function studioDetailStep(pastDate) {
  if (pastDate) {
    return reservationStep(4, "나머지 정보 입력", pastDateMessage(), { locked: true });
  }
  if (!state.selectedStudioSlots.length) {
    return reservationStep(4, "나머지 정보 입력", `<p class="muted">사용 시간을 선택하면 명단, 필요 장비, 목적, 연락처 입력란이 열립니다.</p>`, { locked: true });
  }
  return reservationStep(4, "나머지 정보 입력", `
    <div class="field"><label>사용 명단</label><input class="input" name="participants" placeholder="대표자 및 팀원" value="${escapeHtml(state.user.name)}" required /></div>
    <div class="field"><label>필요 장비</label><textarea class="textarea" name="requiredEquipment" placeholder="포멕스 E1000 2개, C스탠드 4개 등"></textarea></div>
    <div class="field"><label>사용 목적</label><textarea class="textarea" name="purpose"></textarea></div>
    <div class="field"><label>연락처</label><input class="input" name="phone" value="${escapeHtml(state.user.phone)}" required /></div>
    <label class="field consent"><span><input type="checkbox" required /> 사용 후 정리정돈과 보고서 제출 규정을 확인했습니다.</span></label>
    <button class="button primary full" type="submit">예약 확정</button>
  `);
}

function printStartOption(time, selectedDate) {
  const minute = timeToMinutes(time);
  const capacity = Number(state.bootstrap.settings.printCapacityPerWindow || 4);
  const bucket = printCapacityBuckets().find((item) => minute !== null && minute >= item.start && minute < item.end);
  const count = selectedDate && bucket ? printBucketUsage(selectedDate, bucket) : 0;
  const blocked = selectedDate && bucket && printBucketBlocked(selectedDate, bucket);
  const full = selectedDate && bucket && (count >= capacity || blocked);
  return `<option ${full ? "disabled" : ""}>${escapeHtml(time)}${blocked ? " 차단" : full ? " 마감" : ""}</option>`;
}

function printAvailabilityPanel(selectedDate) {
  const capacity = Number(state.bootstrap.settings.printCapacityPerWindow || 4);
  if (!selectedDate) {
    return `<div class="availability-panel"><strong>출력실 예약 가능 현황</strong><p class="muted">날짜를 선택하면 2시간 단위 잔여 인원이 표시됩니다.</p></div>`;
  }
  return `
    <div class="availability-panel">
      <strong>출력실 예약 가능 현황</strong>
      <div class="availability-chip-grid">
        ${printCapacityBuckets().map((bucket) => {
          const count = printBucketUsage(selectedDate, bucket);
          const blocked = printBucketBlocked(selectedDate, bucket);
          const full = count >= capacity || blocked;
          return `<span class="availability-chip ${full ? "blocked" : "open"}">${minutesToTime(bucket.start)}-${minutesToTime(bucket.end)} · ${blocked ? "차단" : `${Math.max(0, capacity - count)}명 가능`}</span>`;
        }).join("")}
      </div>
    </div>
  `;
}

export function studioForm() {
  const selectedDate = state.selectedDates.studio || "";
  const pastDate = isPastDate(selectedDate);
  if (!selectedDate || pastDate) {
    state.selectedStudioSpace = "";
    state.selectedStudioSlots = [];
  }
  if (selectedDate && state.selectedStudioSpace) {
    const spaceAvailable = state.bootstrap.settings.studioSlots.some((slot) => !studioPairReservedOnDate(selectedDate, state.selectedStudioSpace, slot) && !studioSlotBlocked(selectedDate, state.selectedStudioSpace, slot));
    if (!spaceAvailable) {
      state.selectedStudioSpace = "";
      state.selectedStudioSlots = [];
    }
  }
  if (selectedDate && state.selectedStudioSpace) {
    state.selectedStudioSlots = state.selectedStudioSlots.filter((slot) => !studioPairReservedOnDate(selectedDate, state.selectedStudioSpace, slot) && !studioSlotBlocked(selectedDate, state.selectedStudioSpace, slot));
  }
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
        <p class="muted">날짜를 선택한 뒤 공간 1개를 고르면, 그 공간에서 실제로 사용 가능한 시간만 표시됩니다. 연속된 시간만 최대 3타임까지 선택 가능합니다.</p>
        ${reservationStep(1, "날짜 선택", `<p class="selected-date">선택한 날짜: <strong>${selectedDate || "캘린더에서 날짜를 선택하세요"}</strong></p>`)}
        ${studioSpaceStep(selectedDate, pastDate)}
        ${studioTimeStep(selectedDate, pastDate)}
        ${studioDetailStep(pastDate)}
      </section>
    </form>
  `;
}

export function darkroomForm() {
  const selectedDate = state.selectedDates.darkroom || "";
  const pastDate = isPastDate(selectedDate);
  const canReserve = Boolean(selectedDate && !pastDate);
  const slotStep = canReserve
    ? reservationStep(2, "사용 가능한 시간 선택", `<div class="choice-grid">${state.bootstrap.settings.darkroomSlots.map((slot) => {
      const remaining = darkroomSlotRemaining(selectedDate, slot);
      const blocked = darkroomSlotBlocked(selectedDate, slot);
      const full = remaining <= 0 || blocked;
      return `<label class="choice-card compact-choice ${full ? "is-unavailable" : ""}"><input type="checkbox" name="darkroomSlots" value="${slot}" ${full ? "disabled" : ""} /><span><strong>${slot}</strong><small>${blocked ? "사용 불가" : `잔여 ${remaining}명`}</small></span></label>`;
    }).join("")}</div>`, { note: "정원이 찬 시간은 선택할 수 없습니다." })
    : reservationStep(2, "사용 가능한 시간 선택", selectedDate ? pastDateMessage() : `<p class="muted">먼저 캘린더에서 암실 사용 날짜를 선택하세요.</p>`, { locked: true });
  const processStep = canReserve
    ? reservationStep(3, "작업/약품 정보 입력", `
      <div class="field"><label>사용 인원</label><input class="input" name="participantCount" type="number" min="1" max="${state.bootstrap.settings.darkroomCapacity}" value="1" /></div>
      <div class="field"><label>작업 유형 멀티 선택</label><div class="choice-grid">${["현상", "인화"].map((item) => `<label class="choice-card compact-choice"><input type="checkbox" name="processTypes" value="${item}" /><span><strong>${item}</strong></span></label>`).join("")}</div></div>
      <div class="field"><label>사용 약품 및 예정량</label><div class="chemical-grid">${state.bootstrap.darkroomChemicals.map((chem) => `<div class="field"><label>${chem.name}</label><select class="select" name="chem-${chem.id}"><option value="">사용 안 함</option>${chem.options.map((option) => `<option>${escapeHtml(option)}</option>`).join("")}</select></div>`).join("")}</div></div>
    `)
    : reservationStep(3, "작업/약품 정보 입력", selectedDate ? pastDateMessage() : `<p class="muted">날짜를 선택하면 작업 유형과 약품 입력란이 열립니다.</p>`, { locked: true });
  const detailStep = canReserve
    ? reservationStep(4, "나머지 정보 입력", `
      <div class="field"><label>사용 목적</label><textarea class="textarea" name="purpose"></textarea></div>
      <div class="field"><label>연락처</label><input class="input" name="phone" value="${escapeHtml(state.user.phone)}" required /></div>
      <label class="field consent"><span><input type="checkbox" required /> 약품 폐수 분리, 청소, 취식 금지 규정을 확인했습니다.</span></label>
      <button class="button primary full" type="submit">예약 확정</button>
    `)
    : reservationStep(4, "나머지 정보 입력", selectedDate ? pastDateMessage() : `<p class="muted">날짜를 선택하면 목적, 연락처, 동의 항목이 열립니다.</p>`, { locked: true });
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
        ${reservationStep(1, "날짜 선택", `<p class="selected-date">사용 날짜: <strong>${selectedDate || "캘린더에서 날짜를 선택하세요"}</strong></p>`)}
        ${slotStep}
        ${processStep}
        ${detailStep}
      </section>
    </form>
  `;
}

export function printForm() {
  const selectedDate = state.selectedDates.print || "";
  const pastDate = isPastDate(selectedDate);
  const canReserve = Boolean(selectedDate && !pastDate);
  const hours = [];
  for (let h = 10; h <= 19; h += 1) hours.push(`${String(h).padStart(2, "0")}:00`);
  const timeStep = canReserve
    ? reservationStep(2, "사용 시간 선택", `
      <div class="grid two control-grid">
        <div class="field"><label>시작</label><select class="select" name="startTime">${hours.slice(0, -1).map((item) => printStartOption(item, selectedDate)).join("")}</select></div>
        <div class="field"><label>종료</label><select class="select" name="endTime">${hours.slice(1).map((item) => `<option>${escapeHtml(item)}</option>`).join("")}</select></div>
      </div>
      ${printAvailabilityPanel(selectedDate)}
    `, { note: "2시간 구간에 4명 이상 겹치면 예약할 수 없습니다." })
    : reservationStep(2, "사용 시간 선택", selectedDate ? pastDateMessage() : `<p class="muted">먼저 캘린더에서 출력 날짜를 선택하세요.</p>`, { locked: true });
  const optionStep = canReserve
    ? reservationStep(3, "출력 옵션 선택", `
      <div class="field"><label>출력 종류 멀티 선택</label><div class="choice-grid">${state.bootstrap.settings.printTypes.map((item) => `<label class="choice-card compact-choice"><input type="checkbox" name="printTypes" value="${escapeHtml(item)}" /><span><strong>${escapeHtml(item)}</strong></span></label>`).join("")}</div></div>
      <div class="field"><label>용지 멀티 선택</label><div class="choice-grid">${state.bootstrap.settings.printPapers.map((item) => `<label class="choice-card compact-choice"><input type="checkbox" name="papers" value="${escapeHtml(item)}" /><span><strong>${escapeHtml(item)}</strong></span></label>`).join("")}</div></div>
      <div class="field"><label>사이즈 멀티 선택</label><div class="choice-grid">${state.bootstrap.settings.printSizes.map((item) => `<label class="choice-card compact-choice"><input type="checkbox" name="sizes" value="${escapeHtml(item)}" /><span><strong>${escapeHtml(item)}</strong></span></label>`).join("")}</div></div>
    `)
    : reservationStep(3, "출력 옵션 선택", selectedDate ? pastDateMessage() : `<p class="muted">날짜를 선택하면 출력 종류, 용지, 사이즈 선택란이 열립니다.</p>`, { locked: true });
  const detailStep = canReserve
    ? reservationStep(4, "나머지 정보 입력", `
      <div class="field"><label>매수</label><input class="input" name="count" type="number" min="1" value="1" /></div>
      <div class="field"><label>메모</label><textarea class="textarea" name="memo" placeholder="파일 준비 상태, 기타 요청사항"></textarea></div>
      <div class="field"><label>연락처</label><input class="input" name="phone" value="${escapeHtml(state.user.phone)}" required /></div>
      <div class="info-strip"><strong>출력비 계좌</strong><span>${escapeHtml(state.bootstrap.settings.printBankAccount)}</span></div>
      <button class="button primary full" type="submit">예약 확정</button>
    `)
    : reservationStep(4, "나머지 정보 입력", selectedDate ? pastDateMessage() : `<p class="muted">날짜를 선택하면 매수, 메모, 연락처 입력란이 열립니다.</p>`, { locked: true });
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
        ${reservationStep(1, "날짜 선택", `<p class="selected-date">출력 날짜: <strong>${selectedDate || "캘린더에서 날짜를 선택하세요"}</strong></p>`)}
        ${timeStep}
        ${optionStep}
        ${detailStep}
      </section>
    </form>
  `;
}

export function reservationCard(reservation) {
  if (reservation.type === "lecture") return lectureReservationCard(reservation);
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
      <h3 class="card-title card-title-spaced">${escapeHtml(date)}</h3>
      <p class="muted">${escapeHtml(meta)}</p>
      <div class="row-actions">
        ${!["cancelled", "admin_cancelled", "returned", "completed"].includes(reservation.status) ? `<button class="button danger" data-cancel-res="${reservation.id}">취소</button>` : ""}
        ${reservation.type === "studio" && reservation.fields.reportStatus !== "submitted" ? `<button class="button" data-report-res="${reservation.id}">보고서</button>` : ""}
      </div>
    </article>
  `;
}

export function lectureReservationCard(reservation) {
  const f = reservation.fields || {};
  const meta = [
    f.time,
    f.location,
    f.instructorName ? `강사 ${f.instructorName}` : "",
    f.professor ? `담당 ${f.professor}` : ""
  ].filter(Boolean).join(" · ");
  return `
    <article class="card">
      <div class="chips">${tag(reservation.status)}<span class="tag">${escapeHtml(typeLabel.lecture)}</span></div>
      <h3 class="card-title card-title-spaced">${escapeHtml(f.reservedDate || "-")} · ${escapeHtml(f.title || "비교과 특강")}</h3>
      <p class="muted">${escapeHtml(meta || "특강 신청")}</p>
      ${f.targetGrades ? `<p class="muted">대상 ${escapeHtml(f.targetGrades)}</p>` : ""}
      ${f.appliedAt ? `<p class="muted">신청일 ${escapeHtml(f.appliedAt.slice(0, 10))}</p>` : ""}
    </article>
  `;
}

function reservationTimelineDate(reservation) {
  const fields = reservation.fields || {};
  if (reservation.type === "equipment") {
    return equipmentReservationRange(fields)?.end || fields.reservedDate || "";
  }
  return fields.reservedDate || fields.appliedAt?.slice(0, 10) || reservation.createdAt?.slice(0, 10) || "";
}

function sortReservationsForMine(reservations = []) {
  return [...reservations].sort((a, b) => {
    const dateCompare = reservationTimelineDate(b).localeCompare(reservationTimelineDate(a));
    if (dateCompare) return dateCompare;
    return String(b.createdAt || b.fields?.appliedAt || "").localeCompare(String(a.createdAt || a.fields?.appliedAt || ""));
  });
}

function myReservationGroups() {
  const cutoff = addDaysToDateKey(todayKey(), -5);
  return sortReservationsForMine(state.myReservations).reduce((groups, reservation) => {
    const date = reservationTimelineDate(reservation);
    if (date && date < cutoff) groups.past.push(reservation);
    else groups.recent.push(reservation);
    return groups;
  }, { recent: [], past: [] });
}

export function myReservationsView() {
  if (!state.myReservations.length) {
    return `<section class="grid"><p class="empty">예약 내역이 없습니다.</p></section>`;
  }
  const { recent, past } = myReservationGroups();
  const pastOpen = Boolean(state.pastReservationsOpen);
  return `
    <section class="grid">
      <div class="reservation-section-head">
        <div>
          <h2 class="card-title">최근 예약</h2>
          <p class="muted">최근 5일 이내 기록과 예정 예약을 표시합니다.</p>
        </div>
        <span class="tag blue">${recent.length}건</span>
      </div>
      ${recent.length ? recent.map(reservationCard).join("") : `<p class="empty">최근 5일 이내 예약 내역이 없습니다.</p>`}
      <div class="past-reservation-panel ${pastOpen ? "open" : ""}">
        <button class="past-reservation-toggle" type="button" data-past-reservations-toggle aria-expanded="${pastOpen ? "true" : "false"}">
          <span>
            <strong>지난 예약</strong>
            <em>5일 이전 예약 ${past.length}건</em>
          </span>
          <b>${pastOpen ? "접기" : "펼치기"}</b>
        </button>
        ${pastOpen ? `<div class="past-reservation-list">${past.length ? past.map(reservationCard).join("") : `<p class="empty">지난 예약 내역이 없습니다.</p>`}</div>` : ""}
      </div>
    </section>
  `;
}

export function isReportDue(reservation) {
  if (reservation.type !== "studio") return false;
  if (reservation.fields?.reportStatus === "submitted") return false;
  if (["cancelled", "admin_cancelled", "rejected"].includes(reservation.status)) return false;
  return String(reservation.fields?.reservedDate || "") <= todayKey();
}

export function reportsView() {
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

export function reportRequestCard(reservation) {
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

export function studioReportForm(reservation) {
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

export function lecturesView() {
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

export function lectureCard(lecture) {
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

export function noticeCard(notice, options = {}) {
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

export function noticesView() {
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

export function myPageView() {
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
          <div class="field"><label>연락처</label><input class="input" name="phone" value="${escapeHtml(state.user.phone || "")}" /></div>
          <button class="button primary full" type="submit">개인정보 저장</button>
        </form>
      </div>
      <div class="card">
        <h2 class="card-title">비밀번호 변경</h2>
        <form class="report-form" data-form="password-change">
          <div class="field"><label>현재 비밀번호</label><input class="input" name="currentPassword" type="password" autocomplete="current-password" required /></div>
          <div class="field"><label>새 비밀번호</label><input class="input" name="newPassword" type="password" autocomplete="new-password" minlength="8" required /></div>
          <div class="field"><label>새 비밀번호 확인</label><input class="input" name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required /></div>
          <button class="button primary full" type="submit">비밀번호 변경</button>
        </form>
      </div>
      <button class="button danger full" data-action="logout">로그아웃</button>
    </section>
  `;
}

export function activeNotice() {
  if (!state.activeNoticeId) return null;
  const notices = [
    ...(state.bootstrap?.notices || []),
    ...(state.adminNotices || [])
  ];
  return notices.find((notice) => notice.id === state.activeNoticeId) || null;
}

export function noticeBottomSheet() {
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

export function warningPopup() {
  const user = state.user;
  if (!user || user.role === "admin" || state.warningPopupDismissed) return "";
  const count = Number(user.warningCount || 0);
  const blocked = user.approvalStatus === "blocked";
  if (!count && !blocked) return "";
  const until = user.blockedUntil ? escapeHtml(String(user.blockedUntil).slice(0, 10)) : "";
  return `
    <div class="bottom-sheet-layer" role="presentation">
      <button class="sheet-backdrop" type="button" data-warning-popup-close aria-label="닫기"></button>
      <section class="bottom-sheet" role="dialog" aria-modal="true" aria-label="경고 안내">
        <div class="sheet-handle"></div>
        <div class="sheet-head">
          <div>
            <div class="chips"><span class="tag ${blocked ? "red" : "orange"}">${blocked ? "예약 제한" : "경고 누적"}</span></div>
            <h2 class="card-title card-title-spaced">경고 ${count}회 누적</h2>
          </div>
          <button class="button ghost compact" type="button" data-warning-popup-close>확인</button>
        </div>
        <div class="notice-body">
          <p>예약 규정 위반 시 경고가 누적되며 자동으로 예약이 제한됩니다.</p>
          <ul>
            <li>경고 <strong>2회</strong> → <strong>1주일</strong> 예약 제한</li>
            <li>경고 <strong>3회</strong> → <strong>한 학기</strong> 예약 제한</li>
          </ul>
          ${blocked
            ? `<p><strong>현재 예약이 제한된 상태입니다.${until ? ` 해제 예정일: ${until}` : ""}</strong></p>`
            : `<p>현재 누적 경고는 <strong>${count}회</strong>입니다. 규정을 준수해 주세요.</p>`}
        </div>
        <button class="button primary full" type="button" data-warning-popup-close>확인했습니다</button>
      </section>
    </div>
  `;
}
