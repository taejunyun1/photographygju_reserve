import { state } from "./state.js?v=20260626-privacy-policy";
import { statusLabel, typeLabel } from "./constants.js?v=20260626-privacy-policy";
import { nativeNotificationPreferenceEnabled, plannedReservationNotifications } from "./native-notifications.js?v=20260626-privacy-policy";
import {
  addDaysToDateKey,
  areSlotsConsecutive,
  calendar,
  darkroomSlotBlocked,
  darkroomSlotRemaining,
  equipmentBrand,
  equipmentBrandLabel,
  equipmentIsCameraBag,
  equipmentIsHighValue,
  equipmentCategories,
  equipmentItemReservedInRange,
  equipmentRangeBlocked,
  equipmentRangeLabel,
  equipmentReservationRange,
  escapeHtml,
  isPastDate,
  isReservationDateClosed,
  minutesToTime,
  noticePreview,
  normalizeSearchText,
  printBucketBlocked,
  printBucketUsage,
  printCapacityBuckets,
  printDateOutsideUploadWindow,
  printUploadWindowLabel,
  searchableText,
  studioSlotBlocked,
  studioPairReservedOnDate,
  sortedNotices,
  tag,
  timeToMinutes,
  todayKey,
  reservationClosedMessage,
  relatedLensItemsForSelection
} from "./utils.js?v=20260626-privacy-policy";
import {
  actionRow,
  card,
  emptyState,
  icon,
  propertyList,
  searchField,
  sectionHeader,
  tabs
} from "./ui.js?v=20260626-privacy-policy";

export function authView() {
  const isLogin = state.authMode === "login";
  return `
    <main class="auth-shell">
      <section class="auth-panel">
        <div class="brand">
          <div class="brand-mark">G</div>
          <div>
            <h1>GJU Photography</h1>
            <p>사진영상미디어학과 예약</p>
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
                <button class="button primary full" type="submit">${icon("logIn")}접속</button>
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
                <button class="button primary full" type="submit">${icon("userPlus")}가입 신청</button>
                <p class="muted">승인 전에도 공지는 볼 수 있지만 예약은 불가합니다.</p>
              </form>`
        }
      </section>
    </main>
  `;
}

export function studentShell() {
  const pageCopy = {
    home: ["홈", "오늘 확인할 예약과 공지를 정리했습니다."],
    reserve: ["예약", "공간과 장비 예약을 빠르게 신청합니다."],
    mine: ["내 예약", "최근 예약과 지난 예약을 확인합니다."],
    reports: ["보고서", "스튜디오 사용 후 보고서를 제출합니다."],
    lectures: ["비교과 특강", "모집중인 비교과 특강을 확인하고 신청합니다."],
    notices: ["공지", "학과 공지를 한곳에서 확인합니다."],
    my: ["마이", "계정과 연락처 정보를 관리합니다."]
  };
  const [title, subtitle] = pageCopy[state.view] || ["GJU Photography Reservation", "사진영상미디어학과 예약 시스템입니다."];
  const navItems = [
    ["home", "홈"],
    ["mine", "내 예약"],
    ["reports", "보고서"],
    ["lectures", "특강"],
    ["notices", "공지"]
  ];
  const userStatus = statusLabel[state.user.approvalStatus] || state.user.approvalStatus || "-";
  return `
    <main class="student-shell">
      <header class="top-appbar">
        <div class="appbar-brand">
          <div class="brand-mark">G</div>
          <div>
            <strong>GJU Photography</strong>
            <span>사진영상미디어학과 예약</span>
          </div>
        </div>
        <nav class="desktop-nav">
          ${navItems.map(([key, label]) => `<button class="${state.view === key ? "active" : ""}" data-student-view="${key}">${label}</button>`).join("")}
        </nav>
        <div class="student-appbar-actions">
          <button class="student-status-chip ${state.view === "my" ? "active" : ""}" type="button" data-student-view="my" title="${escapeHtml(`${state.user.name} · ${state.user.studentStatus} · ${userStatus}`)}" aria-label="마이 페이지 열기">
            <strong>${escapeHtml(state.user.name)}</strong>
            <span>${escapeHtml(state.user.studentStatus)} · ${escapeHtml(userStatus)}</span>
          </button>
          <button class="button ghost compact" data-action="logout">${icon("logOut")}나가기</button>
        </div>
      </header>
      <section class="mobile-top">
        <div>
          <h1>${title}</h1>
          <p class="sr-only">${subtitle}</p>
        </div>
      </section>
      ${studentContent()}
      <nav class="mobile-nav">
        ${equipmentFloatingSelectionDock()}
        ${navItems.map(([key, label]) => `<button class="${state.view === key ? "active" : ""}" data-student-view="${key}"><span>${label}</span></button>`).join("")}
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

function facilityIconName(type) {
  return {
    equipment: "camera",
    studio: "spark",
    print: "printer",
    darkroom: "moon"
  }[type] || "calendar";
}

export function facilityCard(type, title, desc, code, statusText, tone = "blue") {
  return `
    <button class="facility-card" data-reserve-shortcut="${type}" data-reserve-type="${type}">
      <div class="facility-visual facility-${type}">
        <span class="facility-code">${icon(facilityIconName(type), "facility-symbol")}<b>${code}</b></span>
        <span class="availability ${tone}"><i></i>${statusText}</span>
      </div>
      <div class="facility-body">
        <div>
          <strong>${title}</strong>
          <p>${desc}</p>
        </div>
        <span class="reserve-label">예약${icon("arrowUpRight")}</span>
      </div>
    </button>
  `;
}

export function homeLecturesCard(lectures) {
  if (!lectures.length) return "";
  return card({
    title: "모집중인 특강",
    subtitle: "현재 신청 가능한 비교과 특강입니다.",
    actions: `<button class="button compact" data-student-view="lectures">전체 보기${icon("arrowRight")}</button>`,
    body: `
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
    `,
    className: "home-lectures-card"
  });
}

export function homeNoticeList(notices) {
  if (!notices.length) return "";
  return card({
    title: "공지사항",
    subtitle: "중요 공지를 먼저 확인하세요.",
    actions: `<button class="button compact" data-student-view="notices">전체 보기${icon("arrowRight")}</button>`,
    className: "notice notice-top-card",
    body: `
      <div class="notice-top-list">
        ${notices.map((notice) => noticeCard(notice, { compact: true })).join("")}
      </div>
    `
  });
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
      ${pending ? card({ title: "승인 대기", body: `<p class="muted">학과 관리자 승인 후 예약할 수 있습니다. 반려 시 학과 관리자에게 연락하세요.</p>`, className: "notice" }) : ""}
      <section class="home-quick-actions" aria-label="예약 바로가기">
        <div class="home-section-label">
          <strong>예약</strong>
          <span>바로가기</span>
        </div>
        <div class="facility-grid">
          ${facilityCard("equipment", "기자재", "카메라·렌즈·조명", "EQ", "승인", "yellow")}
          ${facilityCard("studio", "스튜디오", "A/B Front·Back", "ST", "자동", "green")}
          ${facilityCard("print", "출력실", "과제·작품 출력", "PR", "자동", "green")}
          ${facilityCard("darkroom", "암실", "현상·인화", "DR", "자동", "green")}
        </div>
      </section>
      <section class="surface-stack next-reservation-section">
        ${sectionHeader({ title: "다음 예약" })}
        ${next ? reservationCard(next) : emptyState({ title: "예정된 예약이 없습니다." })}
      </section>
      ${homeLecturesCard(recruitingLectures)}
    </section>
  `;
}

export function reserveView() {
  if (state.user.approvalStatus !== "approved") {
    return card({ title: "예약 불가", body: `<p class="muted">현재 계정은 ${statusLabel[state.user.approvalStatus]} 상태입니다. 학과 관리자 승인 후 예약할 수 있습니다.</p>`, className: "notice" });
  }
  if (!state.reservationType) {
    return `
      <section class="facility-grid">
        ${facilityCard("equipment", "기자재", "카메라·렌즈·조명", "EQ", "승인", "yellow")}
        ${facilityCard("studio", "스튜디오", "A/B Front·Back", "ST", "자동", "green")}
        ${facilityCard("print", "출력실", "과제·작품 출력", "PR", "자동", "green")}
        ${facilityCard("darkroom", "암실", "현상·인화", "DR", "자동", "green")}
      </section>
    `;
  }
  return `
    <button class="button ghost" data-action="reserve-back">${icon("chevronLeft")}예약 종류</button>
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

function pastDateMessage(type = "") {
  return `<p class="muted">${escapeHtml(reservationClosedMessage(type))} 캘린더의 기존 예약 기록만 확인할 수 있습니다.</p>`;
}

const BOOKING_STEPS = {
  equipment: [
    ["date", "날짜"],
    ["schedule", "기간"],
    ["select", "장비"],
    ["details", "확인"]
  ],
  studio: [
    ["date", "날짜"],
    ["select", "공간"],
    ["schedule", "시간"],
    ["details", "확인"]
  ],
  darkroom: [
    ["date", "날짜"],
    ["schedule", "시간"],
    ["process", "작업"],
    ["details", "확인"]
  ],
  print: [
    ["date", "날짜"],
    ["schedule", "시간"],
    ["options", "옵션"],
    ["details", "확인"]
  ]
};

function reservationFlowStep(type) {
  if (!state.reservationFlowStep) state.reservationFlowStep = { equipment: "date", studio: "date", darkroom: "date", print: "date" };
  const allowed = (BOOKING_STEPS[type] || []).map(([key]) => key);
  if (!allowed.includes(state.reservationFlowStep[type])) state.reservationFlowStep[type] = "date";
  return state.reservationFlowStep[type] || "date";
}

function normalizeEquipmentFlowStep({ selectedDate, closedDate, rangeBlocked, selectedItems }) {
  let step = reservationFlowStep("equipment");
  if (!selectedDate || closedDate) step = "date";
  if (rangeBlocked && ["select", "details"].includes(step)) step = "schedule";
  if (!selectedItems.length && step === "details") step = "select";
  state.reservationFlowStep.equipment = step;
  return step;
}

function normalizeStudioFlowStep({ selectedDate, closedDate }) {
  let step = reservationFlowStep("studio");
  if (!selectedDate || closedDate) step = "date";
  if (selectedDate && !closedDate && !state.selectedStudioSpace && ["schedule", "details"].includes(step)) step = "select";
  if (selectedDate && !closedDate && state.selectedStudioSpace && !state.selectedStudioSlots.length && step === "details") step = "schedule";
  state.reservationFlowStep.studio = step;
  return step;
}

function normalizeDarkroomFlowStep({ selectedDate, closedDate }) {
  let step = reservationFlowStep("darkroom");
  if (!selectedDate || closedDate) step = "date";
  if (selectedDate && !closedDate && !state.selectedDarkroomSlots.length && ["process", "details"].includes(step)) step = "schedule";
  if (selectedDate && !closedDate && state.selectedDarkroomSlots.length && !state.selectedDarkroomProcessTypes.length && step === "details") step = "process";
  state.reservationFlowStep.darkroom = step;
  return step;
}

function normalizePrintFlowStep({ selectedDate, closedDate, uploadWindowClosed }) {
  let step = reservationFlowStep("print");
  if (!selectedDate || closedDate || uploadWindowClosed) step = "date";
  if (selectedDate && !closedDate && !uploadWindowClosed && (!state.selectedPrintStartTime || !state.selectedPrintEndTime) && ["options", "details"].includes(step)) step = "schedule";
  if (selectedDate && !closedDate && !uploadWindowClosed && (!state.selectedPrintTypes.length || !state.selectedPrintPapers.length || !state.selectedPrintSizes.length) && step === "details") step = "options";
  state.reservationFlowStep.print = step;
  return step;
}

function flowStepOptions(type, step, activeStep, options = {}) {
  const order = (BOOKING_STEPS[type] || []).map(([key]) => key);
  const stepIndex = order.indexOf(step);
  const activeIndex = order.indexOf(activeStep);
  return {
    ...options,
    flowType: type,
    step,
    active: step === activeStep,
    complete: stepIndex >= 0 && activeIndex >= 0 && stepIndex < activeIndex
  };
}

function bookingProgress(type, activeStep) {
  const steps = BOOKING_STEPS[type] || [];
  const activeIndex = Math.max(0, steps.findIndex(([key]) => key === activeStep));
  return `
    <div class="booking-progress" aria-label="${escapeHtml(typeLabel[type] || type)} 예약 단계">
      ${steps.map(([key, label], index) => `
        <span class="${index < activeIndex ? "done" : ""} ${key === activeStep ? "active" : ""}">
          <i>${index + 1}</i>${escapeHtml(label)}
        </span>
      `).join("")}
    </div>
  `;
}

function bookingSummaryRows(type, activeStep, rows) {
  const content = rows
    .filter((row) => row.value && row.step !== activeStep)
    .map((row) => `
      <button class="booking-summary-row" type="button" data-reserve-step="${escapeHtml(type)}:${escapeHtml(row.step)}">
        <span>${escapeHtml(row.label)}</span>
        <strong>${escapeHtml(row.value)}</strong>
        <em>${icon("edit", "summary-icon")}수정</em>
      </button>
    `).join("");
  return content ? `<div class="booking-summary-stack">${content}</div>` : "";
}

function bookingDateContinue(type, activeStep, selectedDate, closedDate, nextStep) {
  if (activeStep !== "date" || !selectedDate || closedDate) return "";
  return `
    <div class="booking-date-continue">
      <button class="button primary full" type="button" data-reserve-next="${escapeHtml(type)}:${escapeHtml(nextStep)}">다음 단계${icon("arrowRight")}</button>
    </div>
  `;
}

function equipmentSelectionLabel(items = []) {
  if (!items.length) return "";
  const first = items[0];
  return `${first.name || first.code || "기자재"}${items.length > 1 ? ` 외 ${items.length - 1}개` : ""}`;
}

function equipmentRecommendationPanel(selectedItems, selectedDate, period) {
  const bodyBrands = [...new Set(selectedItems
    .filter((item) => String(item.category || "").toLowerCase() === "body")
    .map(equipmentBrand)
    .filter(Boolean))];
  if (!bodyBrands.length) {
    state.equipmentRecommendationOpen = false;
    return "";
  }
  const recommendations = relatedLensItemsForSelection(selectedItems, { reservedDate: selectedDate, period })
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ko"));
  if (!recommendations.length) {
    state.equipmentRecommendationOpen = false;
    return "";
  }
  const brandLabel = bodyBrands.map(equipmentBrandLabel).join(" · ");
  const isOpen = Boolean(state.equipmentRecommendationOpen);
  return `
    <section class="equipment-recommendation-rail ${isOpen ? "is-open" : ""}" aria-label="${escapeHtml(brandLabel)} 렌즈 추천">
      <button class="equipment-recommendation-toggle" type="button" data-equipment-recommend-toggle aria-expanded="${isOpen ? "true" : "false"}">
        <span>
          <strong>${escapeHtml(brandLabel)} 렌즈 추천 ${recommendations.length}개</strong>
          <small>같은 브랜드 렌즈만 연결해서 보여줍니다.</small>
        </span>
        <em>${isOpen ? "접기" : "보기"}</em>
      </button>
      ${isOpen ? `
        <div class="equipment-recommendation-list">
          ${recommendations.map((item) => `
            <article class="equipment-recommendation-item">
              <span>
                <strong>${escapeHtml(item.name)}</strong>
                <small>${escapeHtml(item.code)}${item.notes ? ` · ${escapeHtml(item.notes)}` : ""}</small>
              </span>
              <button class="button compact primary" type="button" data-equipment-recommend-add="${escapeHtml(item.id)}">${icon("plus")}담기</button>
            </article>
          `).join("")}
        </div>
      ` : ""}
    </section>
  `;
}

function equipmentPeriodStep(selectedDate, period, rentalTime, returnTime, closedDate, rangeBlocked, activeStep) {
  if (!selectedDate) {
    return reservationStep(2, "대여 기간/시간 선택", `<p class="muted">먼저 캘린더에서 대여 시작 날짜를 선택하세요.</p>`, flowStepOptions("equipment", "schedule", activeStep, { locked: true }));
  }
  if (closedDate) {
    return reservationStep(2, "대여 기간/시간 선택", pastDateMessage("equipment"), flowStepOptions("equipment", "schedule", activeStep, { locked: true }));
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
    <div class="reserve-bottom-cta">
      <button class="button primary full" type="button" data-reserve-next="equipment:select" ${rangeBlocked ? "disabled" : ""}>기자재 선택${icon("arrowRight")}</button>
    </div>
  `, flowStepOptions("equipment", "schedule", activeStep, rangeBlocked ? { note: "기간을 변경하거나 다른 날짜를 선택하세요." } : {}));
}

function equipmentPickerStep(selectedDate, period, categories, visibleItems, selectedItems, closedDate, rangeBlocked, activeStep) {
  if (!selectedDate) {
    return reservationStep(3, "기자재 선택", `<p class="muted">대여 시작 날짜를 선택하면 기자재 목록이 열립니다.</p>`, flowStepOptions("equipment", "select", activeStep, { locked: true }));
  }
  if (closedDate) {
    return reservationStep(3, "기자재 선택", pastDateMessage("equipment"), flowStepOptions("equipment", "select", activeStep, { locked: true }));
  }
  if (rangeBlocked) {
    return reservationStep(3, "기자재 선택", `<p class="muted">선택한 대여 기간에 기자재 차단 일정이 포함되어 있습니다. 다른 기간을 선택하세요.</p>`, flowStepOptions("equipment", "select", activeStep, { locked: true }));
  }
  return reservationStep(3, "기자재 선택", `
    <div class="list-control-panel compact">
      ${searchField({ value: state.equipmentSearch || "", placeholder: "장비명·코드·비고 검색", dataset: "data-equipment-search", label: "기자재 검색" })}
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
      ${visibleItems.length ? visibleItems.map((item) => {
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
      }).join("") : emptyState({ title: "검색 결과가 없습니다.", body: "검색어를 지우거나 다른 카테고리를 선택하세요." })}
    </div>
    ${equipmentSelectionDock(selectedItems, "inline")}
    <div class="reserve-bottom-cta">
      <button class="button primary full" type="button" data-reserve-next="equipment:details" ${selectedItems.length ? "" : "disabled"}>${icon("check")}선택 완료</button>
    </div>
  `, flowStepOptions("equipment", "select", activeStep, { note: "카테고리로 좁혀보고 필요한 장비는 여러 개 담을 수 있습니다." }));
}

function cameraBagConsent(selectedItems) {
  const highValueItems = selectedItems.filter(equipmentIsHighValue);
  if (!highValueItems.length) return "";
  const hasCameraBag = selectedItems.some(equipmentIsCameraBag);
  const notice = state.bootstrap.settings.equipmentCameraBagNotice || "고가장비(카메라)를 선택 시 카메라 가방을 지참하겠습니다";
  return `
    <div class="camera-bag-panel ${hasCameraBag ? "is-satisfied" : ""}">
      <div>
        <strong>카메라 가방 확인</strong>
        <p>${hasCameraBag ? "펠리컨 가방이 함께 선택되어 별도 확인이 필요 없습니다." : "카메라 바디 또는 렌즈 선택 시 가방 지참 확인이 필요합니다."}</p>
      </div>
      <span class="tag ${hasCameraBag ? "green" : "yellow"}">${hasCameraBag ? "펠리컨 선택됨" : "확인 필요"}</span>
      <input type="hidden" name="cameraBagConfirmationRequired" value="true" />
      <input type="hidden" name="pelicanBagReserved" value="${hasCameraBag ? "true" : "false"}" />
      <label class="field consent">
        <span>
          <input type="checkbox" name="cameraBagConfirmed" value="true" ${hasCameraBag ? "checked disabled" : "required"} />
          ${escapeHtml(notice)}
        </span>
      </label>
      <p class="muted">적용 대상: ${escapeHtml(highValueItems.map((item) => item.code || item.name).join(", "))}</p>
    </div>
  `;
}

function equipmentDetailStep(selectedItems, closedDate, rangeBlocked, activeStep) {
  if (closedDate) {
    return reservationStep(4, "나머지 정보 입력", pastDateMessage("equipment"), flowStepOptions("equipment", "details", activeStep, { locked: true }));
  }
  if (rangeBlocked) {
    return reservationStep(4, "나머지 정보 입력", `<p class="muted">차단 일정과 겹치는 기간에는 승인 요청을 보낼 수 없습니다.</p>`, flowStepOptions("equipment", "details", activeStep, { locked: true }));
  }
  if (!selectedItems.length) {
    return reservationStep(4, "나머지 정보 입력", `<p class="muted">기자재를 1개 이상 선택하면 연락처, 목적, 요청사항 입력란이 열립니다.</p>`, flowStepOptions("equipment", "details", activeStep, { locked: true }));
  }
  return reservationStep(4, "나머지 정보 입력", `
    ${cameraBagConsent(selectedItems)}
    <div class="field"><label>연락처</label><input class="input" name="phone" value="${escapeHtml(state.user.phone)}" required /></div>
    <div class="field"><label>스탠드/소프트박스 요청</label><input class="input" name="standRequest" placeholder="예약 후 조교와 직접 확인" /></div>
    <div class="field"><label>사용 목적</label><textarea class="textarea" name="purpose" placeholder="촬영 목적을 간단히 입력"></textarea></div>
    <label class="field consent"><span><input type="checkbox" required /> 파손/분실 자가부담 및 대리 대여/반납 불가에 동의합니다.</span></label>
    <button class="button primary full" type="submit">${icon("send")}승인 요청</button>
  `, flowStepOptions("equipment", "details", activeStep));
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
    <details class="reservation-step inquiry-equipment-step">
      <summary class="step-heading inquiry-equipment-summary">
        <span>!</span>
        <div>
          <strong>온라인 예약불가 기자재</strong>
          <p>판타지랩 기자재는 목록 확인만 가능하며, 예약과 대여는 판타지랩 조교에게 직접 문의해야 합니다.</p>
        </div>
      </summary>
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
    </details>
  `;
}

export function equipmentForm() {
  const reservable = state.bootstrap.equipment.filter((item) => item.active !== false && item.reservable && item.status === "가능");
  const categories = equipmentCategories().filter((cat) => reservable.some((item) => item.category === cat));
  if (!categories.includes(state.equipmentCategoryFilter)) state.equipmentCategoryFilter = categories[0] || "Other";
  const selectedDate = state.selectedDates.equipment || "";
  const closedDate = isReservationDateClosed("equipment", selectedDate);
  const period = selectedEquipmentPeriod(selectedDate);
  const rentalTime = selectedEquipmentTime("selectedEquipmentRentalTime", "equipmentRentalTimes");
  const returnTime = selectedEquipmentTime("selectedEquipmentReturnTime", "equipmentReturnTimes");
  const rangeBlocked = Boolean(selectedDate && !closedDate && equipmentRangeBlocked(selectedDate, period).length);
  if (closedDate) {
    state.selectedEquipmentItemIds = [];
  } else if (rangeBlocked) {
    state.selectedEquipmentItemIds = [];
  } else if (selectedDate) {
    state.selectedEquipmentItemIds = state.selectedEquipmentItemIds.filter((itemId) => !equipmentItemReservedInRange(itemId, selectedDate, period));
  }
  const equipmentQuery = normalizeSearchText(state.equipmentSearch).trim();
  const visibleItems = reservable
    .filter((item) => item.category === state.equipmentCategoryFilter)
    .filter((item) => !equipmentQuery || searchableText([item.code, item.name, item.category, item.brand, item.model, item.notes]).includes(equipmentQuery));
  const selectedItems = state.selectedEquipmentItemIds
    .map((itemId) => reservable.find((item) => item.id === itemId))
    .filter(Boolean);
  const activeStep = normalizeEquipmentFlowStep({ selectedDate, closedDate, rangeBlocked, selectedItems });
  const scheduleLabel = selectedDate && !closedDate
    ? `${equipmentRangeLabel(selectedDate, period)} · ${rentalTime || "-"} / ${returnTime || "-"}`
    : "";
  return `
    <form class="reservation-layout booking-flow" data-form="reservation" data-type="equipment" data-active-step="${escapeHtml(activeStep)}">
      <div class="booking-calendar-step ${activeStep === "date" ? "is-active" : selectedDate ? "is-complete" : ""}" data-booking-step="date">
        ${calendar("equipment")}
      </div>
      <section class="reservation-panel">
        <div class="form-head">
          <div>
            <p class="eyebrow">Approval required</p>
            <h2 class="card-title">기자재 예약</h2>
          </div>
          <span class="tag yellow">조교 승인</span>
        </div>
        ${bookingProgress("equipment", activeStep)}
        ${bookingSummaryRows("equipment", activeStep, [
          { step: "date", label: "날짜", value: selectedDate },
          { step: "schedule", label: "기간/시간", value: scheduleLabel },
          { step: "select", label: "선택 장비", value: equipmentSelectionLabel(selectedItems) }
        ])}
        ${bookingDateContinue("equipment", activeStep, selectedDate, closedDate, "schedule")}
        ${reservationStep(1, "날짜 선택", `<p class="selected-date">대여 시작 날짜: <strong>${selectedDate || "캘린더에서 날짜를 선택하세요"}</strong></p>`, flowStepOptions("equipment", "date", activeStep))}
        ${equipmentPeriodStep(selectedDate, period, rentalTime, returnTime, closedDate, rangeBlocked, activeStep)}
        ${equipmentPickerStep(selectedDate, period, categories, visibleItems, selectedItems, closedDate, rangeBlocked, activeStep)}
        ${equipmentDetailStep(selectedItems, closedDate, rangeBlocked, activeStep)}
        ${fantasyLabEquipmentSection()}
        <p class="reservation-bottom-note">카메라 Body, Lens, 조명, 음향 장비를 한 번에 여러 개 담을 수 있습니다. 사용일 전날 23:59까지만 예약 가능하며, 당일 예약은 접수되지 않습니다.</p>
      </section>
    </form>
  `;
}

export function equipmentSelectionSheet(items) {
  if (!items.length) {
    state.equipmentSelectionSheetOpen = false;
    state.equipmentRecommendationOpen = false;
    return "";
  }
  const selectedDate = state.selectedDates.equipment || "";
  const period = selectedDate ? selectedEquipmentPeriod(selectedDate) : state.selectedEquipmentPeriod;
  const rangeLabel = selectedDate ? equipmentRangeLabel(selectedDate, period) : "날짜 미선택";
  const selectedLabel = equipmentSelectionLabel(items) || "아직 선택 없음";
  const isOpen = Boolean(items.length && state.equipmentSelectionSheetOpen);
  if (!isOpen) state.equipmentRecommendationOpen = false;
  const brandLabels = [...new Set(items
    .filter((item) => String(item.category || "").toLowerCase() === "body")
    .map(equipmentBrand)
    .filter(Boolean)
    .map(equipmentBrandLabel))];
  const recommendationSummary = brandLabels.length ? ` · ${brandLabels.join(" · ")} 렌즈 추천` : "";
  return `
    <aside class="equipment-selection-panel ${items.length ? "active" : ""} ${isOpen ? "is-open" : "is-collapsed"}">
      <button class="selection-sheet-toggle" type="button" data-equipment-selection-toggle aria-expanded="${isOpen ? "true" : "false"}">
        <span>
          <strong>선택한 기자재 ${items.length}개</strong>
          <small>${escapeHtml(`${selectedLabel} · ${rangeLabel}${recommendationSummary}`)}</small>
        </span>
        <em>${isOpen ? "간단히" : "자세히"}</em>
      </button>
      <div class="selection-sheet-body">
        <p>선택 목록과 같은 브랜드 추천 렌즈를 확인할 수 있습니다.</p>
        <dl class="equipment-selection-record">
          <div><dt>기간</dt><dd>${escapeHtml(rangeLabel)}</dd></div>
          <div><dt>선택</dt><dd>${escapeHtml(selectedLabel)}</dd></div>
          ${brandLabels.length ? `<div><dt>추천</dt><dd>${escapeHtml(brandLabels.join(" · "))} 렌즈</dd></div>` : ""}
        </dl>
        <div class="selected-equipment-list">
          ${items.map((item) => `
            <span class="selected-pill">${escapeHtml(item.code)} · ${escapeHtml(item.name)} <button type="button" data-equipment-remove="${item.id}">×</button></span>
          `).join("")}
        </div>
        ${equipmentRecommendationPanel(items, selectedDate, period)}
      </div>
    </aside>
  `;
}

function equipmentSelectionDock(items, mode = "inline") {
  return `
    <div class="equipment-selection-dock equipment-selection-dock-${mode}">
      ${equipmentSelectionSheet(items)}
    </div>
  `;
}

export function currentSelectedEquipmentItems() {
  const reservable = state.bootstrap.equipment.filter((item) => item.active !== false && item.reservable && item.status === "가능");
  return state.selectedEquipmentItemIds.map((itemId) => reservable.find((item) => item.id === itemId)).filter(Boolean);
}

export function equipmentFloatingSelectionDock() {
  if (state.view !== "reserve" || state.reservationType !== "equipment") return "";
  const items = currentSelectedEquipmentItems();
  if (!items.length) return "";
  return equipmentSelectionDock(items, "floating");
}

export function syncEquipmentSelectionSheet() {
  const sheets = document.querySelectorAll(".equipment-selection-panel");
  if (!sheets.length) return;
  for (const sheet of sheets) {
    sheet.outerHTML = equipmentSelectionSheet(currentSelectedEquipmentItems());
  }
}

function reservationStep(index, title, body, options = {}) {
  const flowAttrs = options.step ? ` data-booking-step="${escapeHtml(options.step)}"` : "";
  const flowClass = options.active ? "is-active" : options.complete ? "is-complete" : "";
  return `
    <section class="reservation-step ${options.locked ? "is-locked" : ""} ${flowClass}"${flowAttrs}>
      <div class="step-heading">
        <span>${index}</span>
        <div>
          <strong>${escapeHtml(title)}</strong>
        </div>
      </div>
      ${body}
      ${options.note ? `<p class="step-help">${escapeHtml(options.note)}</p>` : ""}
    </section>
  `;
}

function studioSpaceStep(selectedDate, closedDate, activeStep) {
  if (!selectedDate) {
    return reservationStep(2, "공간 1개 선택", `<p class="muted">먼저 캘린더에서 예약 날짜를 선택하세요.</p>`, flowStepOptions("studio", "select", activeStep, { locked: true }));
  }
  if (closedDate) {
    return reservationStep(2, "공간 1개 선택", pastDateMessage("studio"), flowStepOptions("studio", "select", activeStep, { locked: true }));
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
    flowStepOptions("studio", "select", activeStep, { note: "선택한 날짜에 시간대가 남아 있는 공간만 선택할 수 있습니다." })
  );
}

function studioTimeStep(selectedDate, closedDate, activeStep) {
  if (!selectedDate) {
    return reservationStep(3, "사용 가능한 시간 선택", `<p class="muted">날짜와 공간을 선택하면 사용 가능한 시간만 표시됩니다.</p>`, flowStepOptions("studio", "schedule", activeStep, { locked: true }));
  }
  if (closedDate) {
    return reservationStep(3, "사용 가능한 시간 선택", pastDateMessage("studio"), flowStepOptions("studio", "schedule", activeStep, { locked: true }));
  }
  if (!state.selectedStudioSpace) {
    return reservationStep(3, "사용 가능한 시간 선택", `<p class="muted">공간을 1개 선택하면 해당 공간의 남은 시간만 표시됩니다.</p>`, flowStepOptions("studio", "schedule", activeStep, { locked: true }));
  }
  const maxSlots = Number(state.bootstrap.settings.studioMaxSlots || 3);
  const availableSlots = state.bootstrap.settings.studioSlots.filter((slot) => !studioPairReservedOnDate(selectedDate, state.selectedStudioSpace, slot) && !studioSlotBlocked(selectedDate, state.selectedStudioSpace, slot));
  if (!availableSlots.length) {
    return reservationStep(
      3,
      "사용 가능한 시간 선택",
      `<p class="empty-calendar-note">선택한 날짜와 공간에는 예약 가능한 시간이 없습니다.</p>`,
      flowStepOptions("studio", "schedule", activeStep, { note: `${state.selectedStudioSpace} · ${selectedDate}` })
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
      <div class="reserve-bottom-cta">
        <button class="button primary full" type="button" data-reserve-next="studio:details" ${state.selectedStudioSlots.length ? "" : "disabled"}>${icon("check")}시간 선택 완료</button>
      </div>
    `,
    flowStepOptions("studio", "schedule", activeStep, { note: "이미 예약된 시간은 목록에 표시하지 않습니다." })
  );
}

function studioDetailStep(closedDate, activeStep) {
  if (closedDate) {
    return reservationStep(4, "나머지 정보 입력", pastDateMessage("studio"), flowStepOptions("studio", "details", activeStep, { locked: true }));
  }
  if (!state.selectedStudioSlots.length) {
    return reservationStep(4, "나머지 정보 입력", `<p class="muted">사용 시간을 선택하면 명단, 필요 장비, 목적, 연락처 입력란이 열립니다.</p>`, flowStepOptions("studio", "details", activeStep, { locked: true }));
  }
  return reservationStep(4, "나머지 정보 입력", `
    <div class="field"><label>사용 명단</label><input class="input" name="participants" placeholder="대표자 및 팀원" value="${escapeHtml(state.user.name)}" required /></div>
    <div class="field"><label>필요 장비</label><textarea class="textarea" name="requiredEquipment" placeholder="포멕스 E1000 2개, C스탠드 4개 등"></textarea></div>
    <div class="field"><label>사용 목적</label><textarea class="textarea" name="purpose"></textarea></div>
    <div class="field"><label>연락처</label><input class="input" name="phone" value="${escapeHtml(state.user.phone)}" required /></div>
    <label class="field consent"><span><input type="checkbox" required /> 사용 후 정리정돈과 보고서 제출 규정을 확인했습니다.</span></label>
    <button class="button primary full" type="submit">${icon("check")}예약 확정</button>
  `, flowStepOptions("studio", "details", activeStep));
}

function printTimeSlotChoice(bucket, selectedDate) {
  const capacity = Number(state.bootstrap.settings.printCapacityPerWindow || 4);
  const count = selectedDate && bucket ? printBucketUsage(selectedDate, bucket) : 0;
  const blocked = selectedDate && bucket && printBucketBlocked(selectedDate, bucket);
  const full = selectedDate && bucket && (count >= capacity || blocked);
  const start = minutesToTime(bucket.start);
  const end = minutesToTime(bucket.end);
  const selected = state.selectedPrintStartTime === start && state.selectedPrintEndTime === end;
  const remaining = Math.max(0, capacity - count);
  return `
    <label class="choice-card compact-choice print-slot-choice ${full ? "is-unavailable" : ""}">
      <input type="checkbox" name="printTimeSlot" value="${escapeHtml(`${start}|${end}`)}" ${selected ? "checked" : ""} ${full ? "disabled" : ""} />
      <span>
        <strong>${escapeHtml(start)}-${escapeHtml(end)}</strong>
        <small>${blocked ? "사용 불가" : full ? "마감" : `${remaining}명 가능`}</small>
      </span>
    </label>
  `;
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
  const closedDate = isReservationDateClosed("studio", selectedDate);
  if (!selectedDate || closedDate) {
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
  const activeStep = normalizeStudioFlowStep({ selectedDate, closedDate });
  const timeLabel = state.selectedStudioSlots.length
    ? `${state.selectedStudioSlots.join(", ")} · ${state.selectedStudioSlots.length}타임`
    : "";
  return `
    <form class="reservation-layout booking-flow" data-form="reservation" data-type="studio" data-active-step="${escapeHtml(activeStep)}">
      <div class="booking-calendar-step ${activeStep === "date" ? "is-active" : selectedDate ? "is-complete" : ""}" data-booking-step="date">
        ${calendar("studio")}
      </div>
      <section class="reservation-panel">
        <div class="form-head">
          <div>
            <p class="eyebrow">Auto confirmed</p>
            <h2 class="card-title">스튜디오 예약</h2>
          </div>
          <span class="tag green">자동 확정</span>
        </div>
        ${bookingProgress("studio", activeStep)}
        ${bookingSummaryRows("studio", activeStep, [
          { step: "date", label: "날짜", value: selectedDate },
          { step: "select", label: "공간", value: state.selectedStudioSpace },
          { step: "schedule", label: "시간", value: timeLabel }
        ])}
        ${bookingDateContinue("studio", activeStep, selectedDate, closedDate, "select")}
        ${reservationStep(1, "날짜 선택", `<p class="selected-date">선택한 날짜: <strong>${selectedDate || "캘린더에서 날짜를 선택하세요"}</strong></p>`, flowStepOptions("studio", "date", activeStep))}
        ${studioSpaceStep(selectedDate, closedDate, activeStep)}
        ${studioTimeStep(selectedDate, closedDate, activeStep)}
        ${studioDetailStep(closedDate, activeStep)}
        <p class="reservation-bottom-note">사용일 전날 23:59까지만 예약 가능하며, 당일 예약은 접수되지 않습니다. 날짜를 선택한 뒤 공간 1개를 고르면 실제 사용 가능한 시간만 표시됩니다.</p>
      </section>
    </form>
  `;
}

export function darkroomForm() {
  const selectedDate = state.selectedDates.darkroom || "";
  const closedDate = isReservationDateClosed("darkroom", selectedDate);
  const canReserve = Boolean(selectedDate && !closedDate);
  const activeStep = normalizeDarkroomFlowStep({ selectedDate, closedDate });
  state.selectedDarkroomSlots = state.selectedDarkroomSlots.filter((slot) => state.bootstrap.settings.darkroomSlots.includes(slot));
  state.selectedDarkroomProcessTypes = state.selectedDarkroomProcessTypes.filter((item) => ["현상", "인화"].includes(item));
  const timeLabel = state.selectedDarkroomSlots.length ? `${state.selectedDarkroomSlots.join(", ")} · ${state.selectedDarkroomSlots.length}타임` : "";
  const processLabel = state.selectedDarkroomProcessTypes.length ? state.selectedDarkroomProcessTypes.join(", ") : "";
  const slotStep = canReserve
    ? reservationStep(2, "사용 가능한 시간 선택", `<div class="choice-grid">${state.bootstrap.settings.darkroomSlots.map((slot) => {
      const remaining = darkroomSlotRemaining(selectedDate, slot);
      const blocked = darkroomSlotBlocked(selectedDate, slot);
      const full = remaining <= 0 || blocked;
      return `<label class="choice-card compact-choice ${full ? "is-unavailable" : ""}"><input type="checkbox" name="darkroomSlots" value="${slot}" ${state.selectedDarkroomSlots.includes(slot) ? "checked" : ""} ${full ? "disabled" : ""} /><span><strong>${slot}</strong><small>${blocked ? "사용 불가" : `잔여 ${remaining}명`}</small></span></label>`;
    }).join("")}</div>
      <div class="reserve-bottom-cta">
        <button class="button primary full" type="button" data-reserve-next="darkroom:process" ${state.selectedDarkroomSlots.length ? "" : "disabled"}>${icon("check")}시간 선택 완료</button>
      </div>`, flowStepOptions("darkroom", "schedule", activeStep, { note: "정원이 찬 시간은 선택할 수 없습니다." }))
    : reservationStep(2, "사용 가능한 시간 선택", selectedDate ? pastDateMessage("darkroom") : `<p class="muted">먼저 캘린더에서 암실 사용 날짜를 선택하세요.</p>`, flowStepOptions("darkroom", "schedule", activeStep, { locked: true }));
  const processStep = canReserve
    ? reservationStep(3, "작업/약품 정보 입력", `
      <div class="field"><label>사용 인원</label><input class="input" name="participantCount" type="number" min="1" max="${state.bootstrap.settings.darkroomCapacity}" value="${escapeHtml(state.selectedDarkroomParticipantCount || "1")}" /></div>
      <div class="field"><label>작업 유형 멀티 선택</label><div class="choice-grid">${["현상", "인화"].map((item) => `<label class="choice-card compact-choice"><input type="checkbox" name="processTypes" value="${item}" ${state.selectedDarkroomProcessTypes.includes(item) ? "checked" : ""} /><span><strong>${item}</strong></span></label>`).join("")}</div></div>
      <div class="field"><label>사용 약품 및 예정량</label><div class="chemical-grid">${state.bootstrap.darkroomChemicals.map((chem) => `<div class="field"><label>${chem.name}</label><select class="select" name="chem-${chem.id}"><option value="">사용 안 함</option>${chem.options.map((option) => `<option ${state.selectedDarkroomChemicals?.[chem.id] === option ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}</select></div>`).join("")}</div></div>
      <div class="reserve-bottom-cta">
        <button class="button primary full" type="button" data-reserve-next="darkroom:details" ${state.selectedDarkroomProcessTypes.length ? "" : "disabled"}>${icon("arrowRight")}정보 입력</button>
      </div>
    `, flowStepOptions("darkroom", "process", activeStep))
    : reservationStep(3, "작업/약품 정보 입력", selectedDate ? pastDateMessage("darkroom") : `<p class="muted">날짜를 선택하면 작업 유형과 약품 입력란이 열립니다.</p>`, flowStepOptions("darkroom", "process", activeStep, { locked: true }));
  const detailStep = canReserve
    ? reservationStep(4, "나머지 정보 입력", `
      <div class="field"><label>사용 목적</label><textarea class="textarea" name="purpose"></textarea></div>
      <div class="field"><label>연락처</label><input class="input" name="phone" value="${escapeHtml(state.user.phone)}" required /></div>
      <label class="field consent"><span><input type="checkbox" required /> 약품 폐수 분리, 청소, 취식 금지 규정을 확인했습니다.</span></label>
      <button class="button primary full" type="submit">${icon("check")}예약 확정</button>
    `, flowStepOptions("darkroom", "details", activeStep))
    : reservationStep(4, "나머지 정보 입력", selectedDate ? pastDateMessage("darkroom") : `<p class="muted">날짜를 선택하면 목적, 연락처, 동의 항목이 열립니다.</p>`, flowStepOptions("darkroom", "details", activeStep, { locked: true }));
  return `
    <form class="reservation-layout booking-flow" data-form="reservation" data-type="darkroom" data-active-step="${escapeHtml(activeStep)}">
      <div class="booking-calendar-step ${activeStep === "date" ? "is-active" : selectedDate ? "is-complete" : ""}" data-booking-step="date">
        ${calendar("darkroom")}
      </div>
      <section class="reservation-panel">
        <div class="form-head">
          <div>
            <p class="eyebrow">Auto confirmed</p>
            <h2 class="card-title">암실 예약</h2>
          </div>
          <span class="tag green">자동 확정</span>
        </div>
        ${bookingProgress("darkroom", activeStep)}
        ${bookingSummaryRows("darkroom", activeStep, [
          { step: "date", label: "날짜", value: selectedDate },
          { step: "schedule", label: "시간", value: timeLabel },
          { step: "process", label: "작업", value: processLabel }
        ])}
        ${bookingDateContinue("darkroom", activeStep, selectedDate, closedDate, "schedule")}
        ${reservationStep(1, "날짜 선택", `<p class="selected-date">사용 날짜: <strong>${selectedDate || "캘린더에서 날짜를 선택하세요"}</strong></p>`, flowStepOptions("darkroom", "date", activeStep))}
        ${slotStep}
        ${processStep}
        ${detailStep}
        <p class="reservation-bottom-note">24시간 2시간 단위 예약입니다. 월/화 14:00-18:00은 사용 불가이며, 최대 ${state.bootstrap.settings.darkroomCapacity}명까지 가능합니다.</p>
      </section>
    </form>
  `;
}

function printDrivePanel() {
  const driveUrl = state.bootstrap.settings.googleDriveUrl || "";
  return `
    <div class="print-drive-panel">
      <div>
        <strong>출력 파일 업로드</strong>
        <p>${driveUrl ? "구글 드라이브에 출력 파일을 업로드한 뒤 예약 정보를 입력하세요." : "관리자가 구글 드라이브 링크를 등록하면 이곳에서 바로 이동할 수 있습니다."}</p>
      </div>
      ${driveUrl
        ? `<a class="button primary compact" href="${escapeHtml(driveUrl)}" target="_blank" rel="noopener noreferrer">${icon("external")}구글 드라이브 열기</a>`
        : `<span class="tag gray">링크 등록 필요</span>`}
    </div>
  `;
}

export function printForm() {
  const selectedDate = state.selectedDates.print || "";
  const closedDate = isReservationDateClosed("print", selectedDate);
  const uploadWindowClosed = printDateOutsideUploadWindow(selectedDate);
  const canReserve = Boolean(selectedDate && !closedDate && !uploadWindowClosed);
  const printBuckets = printCapacityBuckets();
  const selectedBucketAvailable = printBuckets.some((bucket) => {
    const start = minutesToTime(bucket.start);
    const end = minutesToTime(bucket.end);
    return state.selectedPrintStartTime === start && state.selectedPrintEndTime === end;
  });
  if (!selectedBucketAvailable) {
    state.selectedPrintStartTime = "";
    state.selectedPrintEndTime = "";
  }
  state.selectedPrintTypes = state.selectedPrintTypes.filter((item) => state.bootstrap.settings.printTypes.includes(item));
  state.selectedPrintPapers = state.selectedPrintPapers.filter((item) => state.bootstrap.settings.printPapers.includes(item));
  state.selectedPrintSizes = state.selectedPrintSizes.filter((item) => state.bootstrap.settings.printSizes.includes(item));
  const activeStep = normalizePrintFlowStep({ selectedDate, closedDate, uploadWindowClosed });
  const timeLabel = state.selectedPrintStartTime && state.selectedPrintEndTime ? `${state.selectedPrintStartTime}-${state.selectedPrintEndTime}` : "";
  const optionLabel = [state.selectedPrintTypes.join(", "), state.selectedPrintPapers.join(", "), state.selectedPrintSizes.join(", ")].filter(Boolean).join(" · ");
  const printClosedMessage = uploadWindowClosed
    ? `<p class="muted">출력 업로드 가능 기간(${escapeHtml(printUploadWindowLabel())}) 밖의 날짜입니다. 관리자 설정에서 기간을 조정할 수 있습니다.</p>`
    : pastDateMessage("print");
  const timeStep = canReserve
    ? reservationStep(2, "사용 시간 선택", `
      <div class="field">
        <label>사용 시간 1개 선택</label>
        <div class="choice-grid print-slot-grid">
          ${printBuckets.map((bucket) => printTimeSlotChoice(bucket, selectedDate)).join("")}
        </div>
      </div>
      <div class="reserve-bottom-cta">
        <button class="button primary full" type="button" data-reserve-next="print:options" ${state.selectedPrintStartTime && state.selectedPrintEndTime ? "" : "disabled"}>${icon("check")}시간 선택 완료</button>
      </div>
    `, flowStepOptions("print", "schedule", activeStep, { note: "사용 시간은 한 구간만 선택할 수 있습니다." }))
    : reservationStep(2, "사용 시간 선택", selectedDate ? printClosedMessage : `<p class="muted">먼저 캘린더에서 출력 날짜를 선택하세요.</p>`, flowStepOptions("print", "schedule", activeStep, { locked: true }));
  const optionStep = canReserve
    ? reservationStep(3, "출력 옵션 선택", `
      <div class="field"><label>출력 종류 멀티 선택</label><div class="choice-grid">${state.bootstrap.settings.printTypes.map((item) => `<label class="choice-card compact-choice"><input type="checkbox" name="printTypes" value="${escapeHtml(item)}" ${state.selectedPrintTypes.includes(item) ? "checked" : ""} /><span><strong>${escapeHtml(item)}</strong></span></label>`).join("")}</div></div>
      <div class="field"><label>용지 멀티 선택</label><div class="choice-grid">${state.bootstrap.settings.printPapers.map((item) => `<label class="choice-card compact-choice"><input type="checkbox" name="papers" value="${escapeHtml(item)}" ${state.selectedPrintPapers.includes(item) ? "checked" : ""} /><span><strong>${escapeHtml(item)}</strong></span></label>`).join("")}</div></div>
      <div class="field"><label>사이즈 멀티 선택</label><div class="choice-grid">${state.bootstrap.settings.printSizes.map((item) => `<label class="choice-card compact-choice"><input type="checkbox" name="sizes" value="${escapeHtml(item)}" ${state.selectedPrintSizes.includes(item) ? "checked" : ""} /><span><strong>${escapeHtml(item)}</strong></span></label>`).join("")}</div></div>
      <div class="reserve-bottom-cta">
        <button class="button primary full" type="button" data-reserve-next="print:details" ${state.selectedPrintTypes.length && state.selectedPrintPapers.length && state.selectedPrintSizes.length ? "" : "disabled"}>${icon("arrowRight")}정보 입력</button>
      </div>
    `, flowStepOptions("print", "options", activeStep))
    : reservationStep(3, "출력 옵션 선택", selectedDate ? printClosedMessage : `<p class="muted">날짜를 선택하면 출력 종류, 용지, 사이즈 선택란이 열립니다.</p>`, flowStepOptions("print", "options", activeStep, { locked: true }));
  const detailStep = canReserve
    ? reservationStep(4, "나머지 정보 입력", `
      <div class="field"><label>매수</label><input class="input" name="count" type="number" min="1" value="1" /></div>
      <div class="field"><label>메모</label><textarea class="textarea" name="memo" placeholder="파일 준비 상태, 기타 요청사항"></textarea></div>
      <div class="field"><label>연락처</label><input class="input" name="phone" value="${escapeHtml(state.user.phone)}" required /></div>
      <div class="info-strip"><strong>출력비 계좌</strong><span>${escapeHtml(state.bootstrap.settings.printBankAccount)}</span></div>
      <button class="button primary full" type="submit">${icon("check")}예약 확정</button>
    `, flowStepOptions("print", "details", activeStep))
    : reservationStep(4, "나머지 정보 입력", selectedDate ? printClosedMessage : `<p class="muted">날짜를 선택하면 매수, 메모, 연락처 입력란이 열립니다.</p>`, flowStepOptions("print", "details", activeStep, { locked: true }));
  return `
    <form class="reservation-layout booking-flow" data-form="reservation" data-type="print" data-active-step="${escapeHtml(activeStep)}">
      <div class="booking-calendar-step ${activeStep === "date" ? "is-active" : selectedDate ? "is-complete" : ""}" data-booking-step="date">
        ${calendar("print")}
      </div>
      <section class="reservation-panel">
        <div class="form-head">
          <div>
            <p class="eyebrow">Auto confirmed</p>
            <h2 class="card-title">출력실 예약</h2>
          </div>
          <span class="tag green">자동 확정</span>
        </div>
        ${printDrivePanel()}
        ${bookingProgress("print", activeStep)}
        ${bookingSummaryRows("print", activeStep, [
          { step: "date", label: "날짜", value: selectedDate },
          { step: "schedule", label: "시간", value: timeLabel },
          { step: "options", label: "옵션", value: optionLabel }
        ])}
        ${bookingDateContinue("print", activeStep, selectedDate, closedDate || uploadWindowClosed, "schedule")}
        ${reservationStep(1, "날짜 선택", `<p class="selected-date">출력 날짜: <strong>${selectedDate || "캘린더에서 날짜를 선택하세요"}</strong></p>`, flowStepOptions("print", "date", activeStep))}
        ${timeStep}
        ${optionStep}
        ${detailStep}
        <p class="reservation-bottom-note">실제 사용 가능 시간은 ${state.bootstrap.settings.printAvailableStart}-${state.bootstrap.settings.printAvailableEnd}입니다. 출력 업로드 가능 기간은 ${escapeHtml(printUploadWindowLabel())}입니다.</p>
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
    <article class="card ui-card reservation-summary-card">
      <div class="chips">${tag(reservation.status)}<span class="tag">${title}</span></div>
      <h3 class="card-title card-title-spaced">${escapeHtml(date)}</h3>
      <p class="muted">${escapeHtml(meta)}</p>
      ${actionRow(`
        ${!["cancelled", "admin_cancelled", "returned", "completed"].includes(reservation.status) ? `<button class="button danger" data-cancel-res="${reservation.id}">${icon("x")}취소</button>` : ""}
        ${reservation.type === "studio" && reservation.fields.reportStatus !== "submitted" ? `<button class="button" data-report-res="${reservation.id}">${icon("fileText")}보고서</button>` : ""}
      `)}
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
    <article class="card ui-card reservation-summary-card">
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

const myReservationCategories = [
  { key: "all", label: "전체" },
  { key: "equipment", label: "기자재" },
  { key: "studio", label: "스튜디오" },
  { key: "print", label: "출력실" },
  { key: "darkroom", label: "암실" },
  { key: "lecture", label: "비교과" }
];

function activeMyReservationCategory() {
  const selected = state.myReservationCategory || "all";
  return myReservationCategories.some((item) => item.key === selected) ? selected : "all";
}

function myReservationCategoryLabel(key) {
  return myReservationCategories.find((item) => item.key === key)?.label || "전체";
}

function myReservationCategoryTabs() {
  return myReservationCategories.map((item) => ({
    key: item.key,
    label: item.label,
    count: item.key === "all"
      ? state.myReservations.length
      : state.myReservations.filter((reservation) => reservation.type === item.key).length
  }));
}

function myReservationSearchText(reservation) {
  const f = reservation.fields || {};
  return searchableText([
    reservation.id,
    typeLabel[reservation.type] || reservation.type,
    reservation.status,
    f,
    reservation.equipmentItems
  ]);
}

function filteredMyReservations() {
  const active = activeMyReservationCategory();
  const query = normalizeSearchText(state.myReservationSearch).trim();
  return state.myReservations
    .filter((reservation) => active === "all" || reservation.type === active)
    .filter((reservation) => !query || myReservationSearchText(reservation).includes(query));
}

function myReservationGroups(reservations = state.myReservations) {
  const cutoff = addDaysToDateKey(todayKey(), -5);
  return sortReservationsForMine(reservations).reduce((groups, reservation) => {
    const date = reservationTimelineDate(reservation);
    if (date && date < cutoff) groups.past.push(reservation);
    else groups.recent.push(reservation);
    return groups;
  }, { recent: [], past: [] });
}

export function myReservationsView() {
  if (!state.myReservations.length) {
    return `<section class="grid">${emptyState({ title: "예약 내역이 없습니다." })}</section>`;
  }
  const activeCategory = activeMyReservationCategory();
  const categoryLabel = myReservationCategoryLabel(activeCategory);
  const visibleReservations = filteredMyReservations();
  const { recent, past } = myReservationGroups(visibleReservations);
  const pastOpen = Boolean(state.pastReservationsOpen);
  const title = activeCategory === "all" ? "최근 예약·비교과" : `${categoryLabel} 내역`;
  const subtitle = activeCategory === "all"
    ? "최근 기록과 예정 예약, 신청한 비교과 특강을 함께 표시합니다."
    : `${categoryLabel} 예약과 신청 내역만 표시합니다.`;
  const emptyRecentTitle = activeCategory === "all"
    ? "최근 5일 이내 예약 내역이 없습니다."
    : `최근 5일 이내 ${categoryLabel} 내역이 없습니다.`;
  const emptyPastTitle = activeCategory === "all"
    ? "지난 예약 내역이 없습니다."
    : `지난 ${categoryLabel} 내역이 없습니다.`;
  const searched = Boolean((state.myReservationSearch || "").trim());
  const pastTitle = activeCategory === "all" ? "지난 예약·비교과" : `지난 ${categoryLabel}`;
  const pastSummary = activeCategory === "all" ? `5일 이전 예약·비교과 ${past.length}건` : `5일 이전 ${categoryLabel} ${past.length}건`;
  return `
    <section class="grid">
      <div class="list-control-panel">
        ${searchField({ value: state.myReservationSearch || "", placeholder: "날짜·종류·상태·장비·장소 검색", dataset: "data-my-reservation-search", label: "내 예약 검색" })}
        ${tabs(myReservationCategoryTabs(), { active: activeCategory, dataset: "my-reservation-category", className: "wrap my-reservation-tabs", ariaLabel: "내 예약 카테고리" })}
      </div>
      <div class="reservation-section-head">
        ${sectionHeader({ title, subtitle })}
        <span class="tag blue">${recent.length}건</span>
      </div>
      ${recent.length ? recent.map(reservationCard).join("") : emptyState({ title: searched ? "검색 결과가 없습니다." : emptyRecentTitle, body: searched ? "검색어를 지우거나 카테고리를 변경하세요." : "" })}
      <div class="past-reservation-panel ${pastOpen ? "open" : ""}">
        <button class="past-reservation-toggle" type="button" data-past-reservations-toggle aria-expanded="${pastOpen ? "true" : "false"}">
          <span>
            <strong>${pastTitle}</strong>
            <em>${pastSummary}</em>
          </span>
          <b>${pastOpen ? "접기" : "펼치기"}</b>
        </button>
        ${pastOpen ? `<div class="past-reservation-list">${past.length ? past.map(reservationCard).join("") : emptyState({ title: emptyPastTitle })}</div>` : ""}
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
  const query = normalizeSearchText(state.reportSearch).trim();
  const reportSearchText = (reservation) => searchableText([
    reservation.id,
    reservation.status,
    reservation.fields,
    reservation.equipmentItems
  ]);
  const allPending = state.myReservations.filter(isReportDue);
  const allSubmitted = state.myReservations.filter((item) => item.type === "studio" && item.fields?.reportStatus === "submitted");
  const pending = allPending.filter((item) => !query || reportSearchText(item).includes(query));
  const submitted = allSubmitted.filter((item) => !query || reportSearchText(item).includes(query));
  const pendingSection = pending.length
    ? pending.map(reportRequestCard).join("")
    : submitted.length
      ? ""
      : emptyState({
        title: query ? "검색 결과가 없습니다." : "작성할 스튜디오 보고서가 없습니다.",
        body: query ? "검색어를 지우면 전체 보고서 내역을 볼 수 있습니다." : ""
      });
  return `
    <section class="grid">
      ${card({
        title: "스튜디오 보고서",
        body: `
          <p class="muted">스튜디오 사용 후 48시간 이내 작성합니다. 날짜, 시간, 장소는 예약 데이터로 자동 연동됩니다.</p>
          <div class="report-policy-panel">
            <strong>보고서/패널티 기준</strong>
            <span>결과 사진은 구글 드라이브에 업로드한 뒤 링크를 보고서에 입력합니다. 미제출 및 이상 내용은 기존 자체 패널티 규칙을 유지합니다.</span>
            ${state.bootstrap.settings.googleDriveUrl ? `<a class="button compact" href="${escapeHtml(state.bootstrap.settings.googleDriveUrl)}" target="_blank" rel="noopener noreferrer">${icon("external")}구글 드라이브 열기</a>` : ""}
          </div>
        `
      })}
      <div class="list-control-panel">
        ${searchField({ value: state.reportSearch || "", placeholder: "사용일·시간·공간·상태 검색", dataset: "data-report-search", label: "보고서 검색" })}
      </div>
      ${pendingSection}
      ${submitted.length ? card({ title: "제출 완료", body: submitted.map((reservation) => `<p class="muted">${escapeHtml(reservation.fields.reservedDate)} · ${(reservation.fields.timeSlots || []).join(", ")} · 보고서 제출완료</p>`).join("") }) : ""}
    </section>
  `;
}

export function reportRequestCard(reservation) {
  const f = reservation.fields || {};
  const active = state.activeReportReservationId === reservation.id;
  return `
    <article class="card ui-card report-card">
      <div class="chips"><span class="tag blue">스튜디오</span><span class="tag yellow">보고서 필요</span></div>
      <h3 class="card-title card-title-spaced">${escapeHtml(f.reservedDate || "-")}</h3>
      <p class="muted">${escapeHtml((f.timeSlots || []).join(", "))} · ${escapeHtml((f.studioSpaces || [f.studioSpace]).filter(Boolean).join(", "))}</p>
      ${active ? studioReportForm(reservation) : `<button class="button primary" data-report-open="${reservation.id}">${icon("fileText")}보고서 작성</button>`}
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
      <div class="field"><label>결과 사진 링크</label><input class="input" name="resultPhotoUrl" type="url" placeholder="구글 드라이브 결과 사진 URL" /></div>
      <label class="field consent"><span><input type="checkbox" name="cleanupConfirmed" value="true" required /> 정리정돈을 완료했습니다.</span></label>
      <label class="field consent"><span><input type="checkbox" name="damageFound" value="true" /> 파손 또는 이상이 있습니다.</span></label>
      <div class="field"><label>파손/이상 내용</label><textarea class="textarea" name="damageDescription" placeholder="없으면 비워두세요."></textarea></div>
      <div class="field"><label>비고</label><textarea class="textarea" name="notes"></textarea></div>
      <div class="row-actions">
        <button class="button primary" type="submit">${icon("send")}보고서 제출</button>
        <button class="button ghost" type="button" data-report-close>${icon("x")}닫기</button>
      </div>
    </form>
  `;
}

export function lecturesView() {
  const lectures = state.lectures || [];
  const query = normalizeSearchText(state.lectureSearch).trim();
  const years = [...new Set(lectures.map(lectureYear).filter(Boolean))].sort((a, b) => b.localeCompare(a));
  const activeYear = years.includes(state.lectureYearFilter) ? state.lectureYearFilter : "all";
  const filteredLectures = lectures.filter((lecture) => {
    const yearMatched = activeYear === "all" || lectureYear(lecture) === activeYear;
    const queryMatched = !query || lectureSearchText(lecture).includes(query);
    return yearMatched && queryMatched;
  });
  const recruiting = filteredLectures.filter((lecture) => (lecture.status || "모집중") === "모집중").length;
  const applied = filteredLectures.filter((lecture) => lecture.applied).length;
  const yearTabs = [
    { key: "all", label: "전체", count: lectures.length },
    ...years.map((year) => ({
      key: year,
      label: `${year}년`,
      count: lectures.filter((lecture) => lectureYear(lecture) === year).length
    }))
  ];
  return `
    <section class="lecture-page">
      ${card({
        title: "특강 신청",
        subtitle: "모집 상태와 정원을 확인하고 필요한 특강을 신청하세요.",
        className: "lecture-summary-card",
        body: `
          <div class="lecture-filter-panel">
            ${searchField({ value: state.lectureSearch || "", placeholder: "특강명·강사·장소·연도 검색", dataset: "data-lecture-search", label: "특강 검색" })}
            ${yearTabs.length > 1 ? tabs(yearTabs, { active: activeYear, dataset: "lecture-year-filter", className: "wrap lecture-year-tabs", ariaLabel: "특강 연도 필터" }) : ""}
          </div>
          <div class="lecture-metrics" aria-label="비교과 특강 요약">
            <div class="lecture-metric"><span>표시 특강</span><strong>${escapeHtml(filteredLectures.length)}</strong></div>
            <div class="lecture-metric"><span>모집중</span><strong>${escapeHtml(recruiting)}</strong></div>
            <div class="lecture-metric"><span>신청완료</span><strong>${escapeHtml(applied)}</strong></div>
          </div>
        `
      })}
      <div class="lecture-card-list">
        ${filteredLectures.length ? filteredLectures.map(lectureCard).join("") : emptyState({
          title: lectures.length ? "조건에 맞는 비교과 특강이 없습니다." : "등록된 비교과 특강이 없습니다.",
          body: lectures.length ? "검색어나 연도 필터를 조정해 주세요." : ""
        })}
      </div>
    </section>
  `;
}

function lectureYear(lecture) {
  const match = String(lecture.lectureDate || "").match(/^(\d{4})/);
  return match ? match[1] : "";
}

function lectureSearchText(lecture) {
  return [
    lecture.title,
    lecture.lectureDate,
    lecture.time,
    lecture.location,
    lecture.instructorName,
    lecture.instructorAffiliation,
    lecture.professor,
    lecture.targetGrades,
    lecture.status,
    lecture.description,
    lecture.notes
  ].filter(Boolean).join(" ").toLowerCase();
}

export function lectureCard(lecture) {
  const lectureStatus = lecture.status || "모집중";
  const canApply = lectureStatus === "모집중" && !lecture.applied && state.user?.approvalStatus === "approved";
  const canCancelApplication = Boolean(lecture.applied && lecture.canCancelApplication);
  const count = Number(lecture.applicationCount || 0);
  const capacity = Number(lecture.capacity || 0);
  const countLabel = capacity ? `${count}/${capacity}` : `${count}`;
  const dateParts = lectureDateParts(lecture.lectureDate);
  const statusTone = lectureStatus === "모집중" ? "green" : lectureStatus === "취소" ? "red" : "gray";
  const capacityTone = capacity && count >= capacity ? "is-full" : "";
  const subMeta = [
    lecture.time || "",
    lecture.targetGrades ? `대상 ${lecture.targetGrades}` : "",
    lecture.professor ? `담당 ${lecture.professor}` : ""
  ].filter(Boolean).join(" · ");
  const actionMarkup = lecture.applied
    ? `
      <button class="button danger" data-lecture-cancel="${lecture.id}" ${canCancelApplication ? "" : "disabled"}>${icon("x")}신청 취소</button>
      ${canCancelApplication ? "" : `<span class="lecture-action-help">시작 6시간 전까지만 취소 가능</span>`}
    `
    : canApply
      ? `<button class="button primary" data-lecture-apply="${lecture.id}">${icon("check")}신청</button>`
      : "";
  const detailLabel = lectureDetailLabel(lecture.description);
  return `
    <article class="card ui-card lecture-card">
      <div class="lecture-card-main">
        <div class="lecture-card-header">
          <div class="lecture-date-block" aria-label="${escapeHtml(lecture.lectureDate || "-")}">
            <span>${escapeHtml(dateParts.year)}</span>
            <strong>${escapeHtml(dateParts.day)}</strong>
            <em>${escapeHtml(dateParts.weekday)}</em>
          </div>
          <div class="lecture-card-kpis">
            ${tag(lectureStatus, statusTone)}
            ${lecture.applied ? tag("신청완료", "blue") : ""}
            <span class="lecture-capacity ${capacityTone}">${escapeHtml(countLabel)}명</span>
          </div>
        </div>
        <div class="lecture-card-content">
          <div class="lecture-title-row">
            <div>
              <h3>${escapeHtml(lecture.title)}</h3>
              ${subMeta ? `<p>${escapeHtml(subMeta)}</p>` : ""}
            </div>
          </div>
          <div class="lecture-meta-grid">
            <div class="lecture-meta-item"><b>강사</b><span>${escapeHtml(lecture.instructorName || "-")}</span></div>
            <div class="lecture-meta-item"><b>장소</b><span>${escapeHtml(lecture.location || "-")}</span></div>
            <div class="lecture-meta-item"><b>정원</b><span>${escapeHtml(countLabel)}</span></div>
            <div class="lecture-meta-item"><b>상태</b><span>${escapeHtml(lectureStatus)}</span></div>
          </div>
          ${lecture.description ? `
            <details class="lecture-details">
              <summary>${escapeHtml(detailLabel)}</summary>
              <p class="lecture-desc">${escapeHtml(lecture.description)}</p>
            </details>
          ` : ""}
          ${lecture.notes ? `<p class="lecture-note">비고: ${escapeHtml(lecture.notes)}</p>` : ""}
        </div>
        ${actionMarkup ? `<div class="lecture-action-panel">${actionMarkup}</div>` : ""}
      </div>
    </article>
  `;
}

function lectureDetailLabel(value) {
  const matches = String(value || "").match(/\d+회차/g) || [];
  return matches.length ? `상세 일정 ${matches.length}회차 더보기` : "상세 일정 더보기";
}

function lectureDateParts(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return { year: "-", day: raw || "-", weekday: "" };
  }
  const [, year, month, day] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00`);
  const weekday = Number.isNaN(date.getTime()) ? "" : `${["일", "월", "화", "수", "목", "금", "토"][date.getDay()]}요일`;
  return { year, day: `${month}.${day}`, weekday };
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
  const query = normalizeSearchText(state.noticeSearch).trim();
  const notices = sortedNotices(state.bootstrap.notices || [])
    .filter((notice) => !query || searchableText([notice.title, notice.category, notice.body, notice.link, notice.createdAt]).includes(query));
  return `
    <section class="grid">
      ${card({
        title: "공지사항",
        body: `
          <p class="muted">공지를 누르면 전체 내용을 확인할 수 있습니다.</p>
          <div class="list-control-panel compact">
            ${searchField({ value: state.noticeSearch || "", placeholder: "제목·분류·본문 검색", dataset: "data-notice-search", label: "공지 검색" })}
          </div>
        `
      })}
      ${notices.length ? notices.map((notice) => noticeCard(notice)).join("") : emptyState({
        title: query ? "검색 결과가 없습니다." : "등록된 공지사항이 없습니다.",
        body: query ? "검색어를 지우면 전체 공지를 볼 수 있습니다." : ""
      })}
    </section>
  `;
}

export function myPageView() {
  return `
    <section class="grid">
      ${card({
        title: state.user.name,
        body: propertyList([
          ["승인", tag(state.user.approvalStatus)],
          ["학번", escapeHtml(state.user.studentId || "-")],
          ["학년", escapeHtml(state.user.grade || "-")],
          ["신분", escapeHtml(state.user.studentStatus)]
        ])
      })}
      ${nativeNotificationSettingsCard()}
      ${card({
        title: "개인정보 수정",
        body: `<form class="report-form" data-form="profile-edit">
          <div class="field"><label>이름</label><input class="input" name="name" value="${escapeHtml(state.user.name || "")}" required /></div>
          <div class="field"><label>연락처</label><input class="input" name="phone" value="${escapeHtml(state.user.phone || "")}" /></div>
          <button class="button primary full" type="submit">${icon("check")}개인정보 저장</button>
        </form>`
      })}
      ${card({
        title: "비밀번호 변경",
        body: `<form class="report-form" data-form="password-change">
          <div class="field"><label>현재 비밀번호</label><input class="input" name="currentPassword" type="password" autocomplete="current-password" required /></div>
          <div class="field"><label>새 비밀번호</label><input class="input" name="newPassword" type="password" autocomplete="new-password" minlength="8" required /></div>
          <div class="field"><label>새 비밀번호 확인</label><input class="input" name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required /></div>
          <button class="button primary full" type="submit">${icon("check")}비밀번호 변경</button>
        </form>`
      })}
      ${card({
        title: "계정 삭제",
        subtitle: "삭제하면 예약, 보고서, 특강 신청, 알림 설정이 함께 정리됩니다.",
        body: `<form class="report-form account-delete-form" data-form="account-delete">
          <p class="muted warning-text">App Store 계정 관리 기준에 따라 앱 안에서 직접 계정 삭제를 시작할 수 있습니다. 삭제 후에는 같은 학번/이메일로 다시 가입 신청해야 합니다.</p>
          <div class="field"><label>현재 비밀번호</label><input class="input" name="currentPassword" type="password" autocomplete="current-password" required /></div>
          <div class="field"><label>확인 문구</label><input class="input" name="confirmText" placeholder="계정 삭제" autocomplete="off" required /></div>
          <button class="button danger full" type="submit">${icon("trash")}계정 삭제</button>
        </form>`,
        className: "account-delete-card"
      })}
      ${card({
        title: "개인정보 및 데이터",
        body: `<div class="action-row">
          <a class="button ghost full" href="/privacy.html" target="_blank" rel="noopener noreferrer">${icon("external")}개인정보 처리방침</a>
          <a class="button ghost full" href="/account-deletion.html" target="_blank" rel="noopener noreferrer">${icon("external")}계정 및 데이터 삭제 안내</a>
        </div>`
      })}
      <button class="button danger full" data-action="logout">${icon("logOut")}로그아웃</button>
    </section>
  `;
}

function nativeNotificationSettingsCard() {
  const status = state.nativeNotifications || {};
  const enabled = nativeNotificationPreferenceEnabled();
  const planned = status.supported ? plannedReservationNotifications().length : 0;
  const permissionLabel = {
    granted: "허용됨",
    denied: "거부됨",
    prompt: "허용 필요",
    "prompt-with-rationale": "허용 필요",
    unavailable: "플러그인 없음",
    web: "웹 미지원",
    unknown: "확인 중"
  }[status.permission] || status.permission || "확인 중";
  const actions = status.supported
    ? enabled
      ? `
        <button class="button compact" type="button" data-native-notifications="sync">${icon("check")}동기화</button>
        <button class="button ghost compact" type="button" data-native-notifications="disable">${icon("x")}끄기</button>
      `
      : `<button class="button primary compact" type="button" data-native-notifications="enable">${icon("check")}알림 켜기</button>`
    : "";
  return card({
    title: "네이티브 예약 알림",
    subtitle: status.supported
      ? "예약 접수, 사용 24시간·1시간·10분 전, 사용 시작, 스튜디오 보고서 미작성 알림을 보냅니다."
      : "iOS/Android 앱에서 설치 후 사용할 수 있습니다.",
    actions,
    body: `
      <div class="native-notification-grid">
        <div><span>권한</span><strong>${escapeHtml(permissionLabel)}</strong></div>
        <div><span>상태</span><strong>${enabled ? "켜짐" : "꺼짐"}</strong></div>
        <div><span>예정 알림</span><strong>${escapeHtml(String(planned))}개</strong></div>
      </div>
      ${status.error ? `<p class="muted warning-text">${escapeHtml(status.error)}</p>` : ""}
      <p class="muted">예약 취소, 보고서 제출, 로그아웃, 내 예약 새로고침 시 기존 알림은 다시 정리됩니다.</p>
    `,
    className: "native-notification-card"
  });
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
          <button class="button ghost compact" type="button" data-notice-close>${icon("x")}닫기</button>
        </div>
        <p class="notice-body">${escapeHtml(notice.body)}</p>
        ${notice.link ? `<a class="button primary full" href="${escapeHtml(notice.link)}" target="_blank" rel="noopener noreferrer">${icon("external")}신청 링크 열기</a>` : ""}
      </section>
    </div>
  `;
}

export function warningPopup() {
  const user = state.user;
  if (!user || user.role === "admin" || state.warningPopupDismissed) return "";
  const count = Number(user.warningCount || 0);
  const blocked = user.approvalStatus === "blocked";
  if (!blocked) return "";
  const until = user.blockedUntil ? escapeHtml(String(user.blockedUntil).slice(0, 10)) : "";
  return `
    <div class="bottom-sheet-layer" role="presentation">
      <button class="sheet-backdrop" type="button" data-warning-popup-close aria-label="닫기"></button>
      <section class="bottom-sheet" role="dialog" aria-modal="true" aria-label="대여금지 안내">
        <div class="sheet-handle"></div>
        <div class="sheet-head">
          <div>
            <div class="chips"><span class="tag red">대여금지</span></div>
            <h2 class="card-title card-title-spaced">현재 예약이 제한된 상태입니다</h2>
          </div>
          <button class="button ghost compact" type="button" data-warning-popup-close>${icon("check")}확인</button>
        </div>
        <div class="notice-body">
          <p>관리자에 의해 대여금지가 적용되어 예약을 진행할 수 없습니다.</p>
          ${until ? `<p><strong>해제 예정일: ${until}</strong></p>` : ""}
          ${count ? `<p>관리자 경고 메모 기록: <strong>${count}건</strong></p>` : ""}
        </div>
        <button class="button primary full" type="button" data-warning-popup-close>${icon("check")}확인했습니다</button>
      </section>
    </div>
  `;
}
