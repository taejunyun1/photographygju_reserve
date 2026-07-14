import { state } from "./state.js?v=20260704-student-icon-nav";
import {
  adminNavItems,
  equipmentAdminStatusOptions,
  equipmentReservationStatuses,
  equipmentReservationStatusLabel,
  equipmentStatusOptions,
  lectureStatusOptions,
  sourceLabel,
  statusLabel,
  typeLabel,
  userLimitOptions,
  weekdayLabel
} from "./constants.js?v=20260704-student-icon-nav";
import {
  addMonths,
  adminGuide,
  blockedItemsForDate,
  dateKey,
  equipmentCategories,
  escapeHtml,
  formatDateTime,
  monthTitle,
  normalizeSearchText,
  reservationStatusTag,
  searchableText,
  sortedAdminUsers,
  tag,
  todayKey,
  userSortButton,
  userStatusCell
} from "./utils.js?v=20260704-student-icon-nav";
import {
  card,
  emptyState,
  icon,
  pagination,
  propertyList,
  searchField,
  sectionHeader,
  tabs
} from "./ui.js?v=20260704-student-icon-nav";
import { nativeNotificationPreferenceEnabled, plannedAdminNotifications } from "./native-notifications.js?v=20260704-student-icon-nav";
import { noticeCard } from "./views-student.js?v=20260704-student-icon-nav";
import {
  equipmentReservableTag,
  equipmentStatusButtons,
  selectedAdminEquipmentSet,
  visibleAdminEquipmentItems
} from "./admin-equipment.js?v=20260704-student-icon-nav";

export function adminShell() {
  return `
    <main class="admin-shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">G</div>
          <div>
            <h1>GJU Photography</h1>
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
              <strong>${adminTitle()}</strong>
              <span>Photography Reservation Admin</span>
            </div>
          </div>
          <div class="header-actions">
            ${adminRefreshButton({ compact: true })}
            <button class="button ghost compact admin-icon-button ${state.adminView === "account" ? "active" : ""}" type="button" data-admin-view="account" aria-label="내 정보" title="내 정보">${icon("user")}</button>
            <button class="button ghost compact admin-icon-button" type="button" data-action="logout" aria-label="나가기" title="나가기">${icon("logOut")}</button>
          </div>
        </header>
        <header class="admin-header">
          <div><h1 class="page-title">${adminTitle()}</h1></div>
          <div class="header-actions">
            ${adminRefreshButton()}
            <button class="button ghost admin-icon-button ${state.adminView === "account" ? "active" : ""}" type="button" data-admin-view="account" aria-label="내 정보" title="내 정보">${icon("user")}</button>
            <button class="button ghost admin-icon-button" type="button" data-action="logout" aria-label="나가기" title="나가기">${icon("logOut")}</button>
          </div>
        </header>
        ${adminContent()}
      </section>
      <nav class="admin-mobile-nav">
        ${adminNavItems.map(([key, label]) => `<button class="${state.adminView === key ? "active" : ""}" data-admin-view="${key}">${label}</button>`).join("")}
      </nav>
      ${adminQueueBottomSheet()}
    </main>
  `;
}

function adminRefreshButton({ compact = false } = {}) {
  const refresh = state.adminRefresh || {};
  const label = refresh.refreshing ? "새로고침 중" : "새로고침";
  return `<button class="button ghost ${compact ? "compact " : ""}admin-icon-button admin-header-refresh" type="button" data-action="admin-refresh" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}" ${refresh.refreshing ? 'disabled aria-busy="true"' : ""}>${icon("refresh")}</button>`;
}

export function adminTitle() {
  return {
    dashboard: "대시보드",
    users: "학생 승인",
    reservations: "예약 관리",
    equipment: "기자재 관리",
    reports: "보고서",
    lectures: "비교과 특강",
    notices: "공지사항",
    logs: "로그/세션",
    settings: "설정",
    account: "내 정보"
  }[state.adminView];
}

function adminPageScopeNote(page, loadedCount, filteredCount, query) {
  const total = Number(page?.total || loadedCount || 0);
  if (!total) return "";
  const shown = Math.min(Number(loadedCount || 0), total);
  const filtered = Number(filteredCount || 0);
  const scope = `현재 ${shown}건 표시 / 전체 ${total}건`;
  const queryText = query ? ` · 검색 결과 ${filtered}건(현재 표시 데이터 기준)` : "";
  const moreText = page?.hasMore ? " · 다음 페이지에 기록이 더 있습니다" : "";
  return `<p class="muted list-page-summary">${scope}${queryText}${moreText}</p>`;
}

function adminTotalPages(page) {
  const total = Number(page?.total || 0);
  const pageSize = Number(page?.pageSize || 100) || 100;
  return Math.max(1, Math.ceil(total / pageSize));
}

function adminPager(page, dataset) {
  const totalPages = adminTotalPages(page);
  if (totalPages <= 1) return "";
  return pagination({ page: Number(page?.page || 1), totalPages, dataset, className: "admin-list-pagination" });
}

function semesterTabs(options = [], active = "all", dataset = "") {
  const items = [{ key: "all", label: "전체" }, ...(options || [])];
  if (items.length <= 1) return "";
  return tabs(items, { active, dataset, className: "wrap admin-semester-tabs", ariaLabel: "학기 필터" });
}

function adminCollectionTotal(page, fallback = 0) {
  if (page?.collectionTotal !== undefined && page?.collectionTotal !== null) return Number(page.collectionTotal || 0);
  return Number(page?.total || fallback || 0);
}

function iconOnlyAction(label, iconName, attrs = "", options = {}) {
  const safeLabel = escapeHtml(label);
  const attrsText = attrs ? ` ${attrs}` : "";
  const disabledText = options.disabled ? " disabled" : "";
  const className = `${options.className || "button danger compact"} icon-only-action`;
  return `<button class="${className}" type="${options.type || "button"}"${attrsText}${disabledText} aria-label="${safeLabel}" title="${safeLabel}">${icon(iconName)}</button>`;
}

function bulkDeletePanel(kind, filteredCount, totalCount, filterLabel, options = {}) {
  const count = Math.max(0, Number(filteredCount || 0));
  const total = Math.max(0, Number(totalCount || 0));
  const filteredEnabled = Boolean(options.filteredEnabled) && count !== total;
  return `
    <div class="bulk-danger-zone">
      <span class="muted">${escapeHtml(filterLabel)}</span>
      <div class="row-actions">
        ${iconOnlyAction("현재 필터 결과 삭제", "trash", `data-admin-bulk-delete="${kind}:filtered"`, { disabled: !(filteredEnabled && count) })}
        ${iconOnlyAction("전체 삭제", "trash", `data-admin-bulk-delete="${kind}:all"`, { className: "button ghost danger compact", disabled: !total })}
      </div>
    </div>
  `;
}

function activeReservationBulkFilter(query) {
  return Boolean(
    query ||
    state.adminReservationSemesterFilter !== "all" ||
    state.adminReservationTab !== "all" ||
    (state.adminReservationTab === "equipment" && state.adminEquipmentReservationStatusFilter !== "all")
  );
}

function activeReportBulkFilter(query) {
  return Boolean(query || state.adminReportSemesterFilter !== "all");
}

function activeLectureBulkFilter(query) {
  return Boolean(query || state.adminLectureSemesterFilter !== "all");
}

function activeSemesterLabel(options = [], active = "all") {
  if (!active || active === "all") return "전체 학기";
  return options.find((item) => item?.key === active)?.label || active;
}

function reservationBulkFilterLabel(query, renderedCount) {
  if (query) return `현재 검색 결과 ${renderedCount}건 · ${activeSemesterLabel(state.adminReservationSemesters, state.adminReservationSemesterFilter)}`;
  const type = state.adminReservationTab === "all" ? "전체 예약" : `${typeLabel[state.adminReservationTab] || state.adminReservationTab} 예약`;
  const status = state.adminReservationTab === "equipment" && state.adminEquipmentReservationStatusFilter !== "all"
    ? ` · ${equipmentReservationStatusLabel[state.adminEquipmentReservationStatusFilter] || state.adminEquipmentReservationStatusFilter}`
    : "";
  return `${activeSemesterLabel(state.adminReservationSemesters, state.adminReservationSemesterFilter)} · ${type}${status} · 현재 ${renderedCount}건`;
}

function reportBulkFilterLabel(query, renderedCount) {
  if (query) return `현재 검색 결과 ${renderedCount}건 · ${activeSemesterLabel(state.adminReportSemesters, state.adminReportSemesterFilter)}`;
  return `${activeSemesterLabel(state.adminReportSemesters, state.adminReportSemesterFilter)} · 현재 ${renderedCount}건`;
}

function lectureBulkFilterLabel(query, renderedCount) {
  if (query) return `현재 검색 결과 ${renderedCount}건 · ${activeSemesterLabel(state.adminLectureSemesters, state.adminLectureSemesterFilter)}`;
  return `${activeSemesterLabel(state.adminLectureSemesters, state.adminLectureSemesterFilter)} · 현재 ${renderedCount}건`;
}

export function adminContent() {
  if (state.adminView === "account") return adminAccountView();
  if (state.adminView === "users") return adminUsersView();
  if (state.adminView === "reservations") return adminReservationsView();
  if (state.adminView === "equipment") return adminEquipmentView();
  if (state.adminView === "reports") return adminReportsView();
  if (state.adminView === "lectures") return adminLecturesView();
  if (state.adminView === "notices") return adminNoticesView();
  if (state.adminView === "logs") return adminLogsView();
  if (state.adminView === "settings") return adminSettingsView();
  return adminDashboardView();
}

export function adminAccountView() {
  const u = state.user || {};
  return `
    <section class="grid">
      <div class="card">
        <h2 class="card-title">개인정보 수정</h2>
        <form class="report-form" data-form="profile-edit">
          <div class="field"><label>이름</label><input class="input" name="name" value="${escapeHtml(u.name || "")}" required /></div>
          <div class="field"><label>이메일</label><input class="input" name="email" type="email" value="${escapeHtml(u.email || "")}" /></div>
          <div class="field"><label>연락처</label><input class="input" name="phone" value="${escapeHtml(u.phone || "")}" /></div>
          <button class="button primary full" type="submit">${icon("check")}개인정보 저장</button>
        </form>
      </div>
      <div class="card">
        <h2 class="card-title">비밀번호 변경</h2>
        <form class="report-form" data-form="password-change">
          <div class="field"><label>현재 비밀번호</label><input class="input" name="currentPassword" type="password" autocomplete="current-password" required /></div>
          <div class="field"><label>새 비밀번호</label><input class="input" name="newPassword" type="password" autocomplete="new-password" minlength="8" required /></div>
          <div class="field"><label>새 비밀번호 확인</label><input class="input" name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required /></div>
          <button class="button primary full" type="submit">${icon("check")}비밀번호 변경</button>
        </form>
      </div>
      ${adminGuide("내 정보 사용 가이드", "관리자 계정의 이름, 이메일, 연락처와 비밀번호를 직접 변경할 수 있습니다. 비밀번호는 현재 비밀번호 확인 후 변경됩니다.")}
    </section>
  `;
}

export function adminDashboardView() {
  const metrics = adminDashboardMetrics();
  return `
    <section class="grid">
      <section class="admin-dashboard-section">
        ${sectionHeader({ title: "오늘 처리할 일", subtitle: "학생 승인과 기자재 승인·대여 흐름을 우선 확인합니다." })}
        <div class="stat-grid admin-dashboard-grid">
          ${adminActionCard({ label: "가입 승인 대기", value: metrics.pendingUsers, caption: "학생 승인으로 이동", attrs: `data-admin-view="users"`, tone: "blue", iconName: "userPlus" })}
          ${adminActionCard({ label: "기자재 승인 대기", value: metrics.equipmentPendingApproval, caption: "승인 요청 확인", attrs: `data-admin-view="reservations" data-admin-reservation-tab="equipment" data-admin-equipment-reservation-status="pending_approval"`, tone: "yellow", iconName: "camera" })}
          ${adminActionCard({ label: "승인 완료", value: metrics.equipmentApproved, caption: "인계 전 예약", attrs: `data-admin-view="reservations" data-admin-reservation-tab="equipment" data-admin-equipment-reservation-status="approved"`, tone: "blue", iconName: "check" })}
          ${adminActionCard({ label: "대여 중", value: metrics.equipmentCheckedOut, caption: "반납 대기 장비", attrs: `data-admin-view="reservations" data-admin-reservation-tab="equipment" data-admin-equipment-reservation-status="checked_out"`, tone: "yellow", iconName: "camera" })}
          ${adminActionCard({ label: "반납 완료", value: metrics.equipmentReturned, caption: "기자재 반납 상태", attrs: `data-admin-view="reservations" data-admin-reservation-tab="equipment" data-admin-equipment-reservation-status="returned"`, tone: "green", iconName: "check" })}
          ${adminActionCard({ label: "취소/반려", value: metrics.equipmentCancelled, caption: "기자재 종료 상태", attrs: `data-admin-view="reservations" data-admin-reservation-tab="equipment" data-admin-equipment-reservation-status="cancelled_or_rejected"`, tone: "gray", iconName: "x" })}
          ${adminActionCard({ label: "보고서 확인 필요", value: metrics.missingReports, caption: "보고서로 이동", attrs: `data-admin-view="reports"`, tone: "red", iconName: "fileText" })}
        </div>
      </section>
      ${adminOperationsQueue()}
      ${adminDashboardMetricSection(metrics)}
      ${adminGuide("대시보드 사용 가이드", "오늘 처리해야 할 승인, 예약, 보고서 현황을 빠르게 보는 화면입니다. 카드를 누르면 해당 관리 페이지로 이동합니다.")}
    </section>
  `;
}

function adminActionCard({ label, value, caption = "", attrs = "", tone = "blue", iconName = "spark" }) {
  const toneClass = tone ? ` tone-${tone}` : "";
  return `
    <button class="stat stat-button ui-stat-card admin-action-card${toneClass}" type="button" ${attrs}>
      <span class="admin-action-top">
        <span class="admin-action-icon" aria-hidden="true">${icon(iconName, "action-icon-svg")}</span>
        <span class="muted">${escapeHtml(label)}</span>
      </span>
      <strong>${escapeHtml(String(value))}</strong>
      ${caption ? `<em>${escapeHtml(caption)}</em>` : ""}
    </button>
  `;
}

function adminReservationDate(reservation) {
  const fields = reservation?.fields || {};
  return fields.reservedDate || fields.date || fields.returnDate || "";
}

function adminReservationTime(reservation) {
  const fields = reservation?.fields || {};
  if (fields.rentalTime) return fields.rentalTime;
  if (fields.startTime) return fields.startTime;
  if (Array.isArray(fields.timeSlots) && fields.timeSlots.length) return fields.timeSlots[0];
  return "";
}

function activeAdminEquipment() {
  return (state.adminEquipment || []).filter((item) => item.active !== false);
}

function reservationStatusIn(reservation, statuses) {
  return statuses.includes(reservation?.status);
}

function todayAdminReservations() {
  const today = todayKey();
  return (state.adminReservations || []).filter((reservation) => adminReservationDate(reservation) === today);
}

function checkoutReturnReservations() {
  const today = todayKey();
  return (state.adminReservations || []).filter((reservation) => {
    if (reservation.type !== "equipment") return false;
    const fields = reservation.fields || {};
    const dueToday = fields.returnDate === today || fields.reservedDate === today;
    return dueToday && reservationStatusIn(reservation, ["checked_out"]);
  });
}

function adminReservationTypeCounts(reservations) {
  return reservations.reduce((acc, reservation) => {
    const key = reservation.type || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function adminPopularEquipmentNames(reservations) {
  const counts = new Map();
  for (const reservation of reservations) {
    const fields = reservation.fields || {};
    const names = [
      ...(Array.isArray(fields.equipmentItems) ? fields.equipmentItems : []),
      ...(Array.isArray(fields.equipmentItemNames) ? fields.equipmentItemNames : []),
      ...(Array.isArray(fields.selectedEquipmentNames) ? fields.selectedEquipmentNames : [])
    ].map((item) => typeof item === "string" ? item : item?.name || item?.label || "").filter(Boolean);
    for (const name of names) counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));
}

export function adminDashboardMetrics() {
  const s = state.summary || {};
  const reservations = state.adminReservations || [];
  const equipment = activeAdminEquipment();
  const availableEquipment = equipment.filter((item) => item.status === "가능").length;
  const repairEquipment = equipment.filter((item) => item.status === "수리중").length;
  const equipmentPendingApproval = Number(s.equipmentPendingApproval ?? s.pendingEquipment ?? reservations.filter((reservation) => reservation.type === "equipment" && reservation.status === "pending_approval").length);
  const equipmentApproved = Number(s.equipmentApproved ?? reservations.filter((reservation) => reservation.type === "equipment" && reservation.status === "approved").length);
  const equipmentCheckedOut = Number(s.equipmentCheckedOut ?? reservations.filter((reservation) => reservation.type === "equipment" && reservation.status === "checked_out").length);
  const equipmentReturned = Number(s.equipmentReturned ?? reservations.filter((reservation) => reservation.type === "equipment" && reservation.status === "returned").length);
  const equipmentCancelled = Number(s.equipmentCancelled ?? reservations.filter((reservation) => reservation.type === "equipment" && ["cancelled", "rejected"].includes(reservation.status)).length);
  const cancelledReservations = reservations.filter((reservation) => reservationStatusIn(reservation, ["cancelled", "admin_cancelled", "rejected"])).length;
  const checkoutReturnNeeded = equipmentCheckedOut;
  const typeCounts = adminReservationTypeCounts(reservations);
  const latestNotice = [...(state.adminNotices || [])].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))[0] || null;
  return {
    pendingUsers: Number(s.pendingUsers || 0),
    pendingEquipment: equipmentPendingApproval,
    equipmentPendingApproval,
    equipmentApproved,
    todayReservations: Number(s.todayReservations || todayAdminReservations().length || 0),
    missingReports: Number(s.missingReports || 0),
    checkoutReturnNeeded,
    equipmentCheckedOut,
    equipmentReturned,
    equipmentCancelled,
    weekReservations: reservations.length,
    activeEquipment: equipment.length,
    availableEquipment,
    repairEquipment,
    equipmentAvailableRate: equipment.length ? Math.round((availableEquipment / equipment.length) * 100) : 0,
    cancelledReservations,
    reportQueueCount: (state.adminReports || []).filter((report) => !["completed", "approved"].includes(report.status)).length,
    openLectures: (state.adminLectures || []).filter((lecture) => lecture.status === "모집중").length,
    latestNotice,
    typeCounts,
    popularEquipment: adminPopularEquipmentNames(reservations)
  };
}

function adminOperationsQueue() {
  const todayReservations = todayAdminReservations();
  const checkoutItems = checkoutReturnReservations();
  const nextToday = todayReservations[0];
  const nextCheckout = checkoutItems[0];
  return `
    <section class="admin-dashboard-section">
      ${sectionHeader({ title: "운영 큐", subtitle: "오늘 흐름은 눌러서 내역으로 확인합니다." })}
      <div class="admin-queue-sheet-grid">
        ${adminQueueSheetCard({
          key: "today",
          title: "오늘 예약 타임라인",
          count: todayReservations.length,
          caption: nextToday ? `${typeLabel[nextToday.type] || "예약"} · ${nextToday.user?.name || "학생"} · ${adminReservationTime(nextToday) || "시간 미정"}` : "오늘 예약 상세 데이터가 없습니다.",
          tone: "green"
        })}
        ${adminQueueSheetCard({
          key: "checkout",
          title: "대여/반납 큐",
          count: checkoutItems.length,
          caption: nextCheckout ? `${nextCheckout.user?.name || "학생"} · ${adminReservationTime(nextCheckout) || "시간 미정"}` : "오늘 처리할 대여/반납 항목이 없습니다.",
          tone: "yellow"
        })}
      </div>
    </section>
  `;
}

function adminQueueSheetCard({ key, title, count, caption, tone = "blue" }) {
  return `
    <button class="admin-queue-sheet-card tone-${tone}" type="button" data-admin-queue-sheet="${key}" aria-haspopup="dialog">
      <span>
        <strong>${escapeHtml(title)}</strong>
        <em>${escapeHtml(caption)}</em>
      </span>
      <b>${escapeHtml(String(count))}</b>
    </button>
  `;
}

function adminQueueSheetItems(kind) {
  return kind === "checkout" ? checkoutReturnReservations() : todayAdminReservations();
}

function adminQueueSheetTitle(kind) {
  return kind === "checkout" ? "대여/반납 큐" : "오늘 예약 타임라인";
}

function adminQueueBottomSheet() {
  const kind = state.activeAdminQueueSheet;
  if (!kind) return "";
  const reservations = adminQueueSheetItems(kind);
  const rows = reservations.length
    ? reservations.map((reservation) => {
      const detail = adminReservationDetail(reservation)
        .slice(0, 3)
        .map(([key, value]) => `<span>${escapeHtml(key)} ${escapeHtml(value)}</span>`)
        .join("");
      return `
        <li>
          <div>
            <strong>${escapeHtml(reservation.user?.name || "학생")} · ${escapeHtml(typeLabel[reservation.type] || reservation.type || "예약")}</strong>
            <p>${escapeHtml(adminReservationDate(reservation) || "-")} · ${escapeHtml(adminReservationTime(reservation) || "시간 미정")}</p>
            <div class="admin-queue-sheet-meta">${detail}</div>
          </div>
          ${reservationStatusTag(reservation)}
        </li>
      `;
    }).join("")
    : `<li class="empty-inline">${kind === "checkout" ? "오늘 처리할 대여/반납 항목이 없습니다." : "오늘 예약 상세 데이터가 없습니다."}</li>`;
  return `
    <div class="bottom-sheet-layer" role="presentation">
      <button class="sheet-backdrop" type="button" data-admin-queue-sheet-close aria-label="운영 큐 닫기"></button>
      <section class="bottom-sheet admin-queue-sheet" role="dialog" aria-modal="true" aria-label="${escapeHtml(adminQueueSheetTitle(kind))}">
        <div class="sheet-handle"></div>
        <div class="sheet-head">
          <div>
            <div class="chips"><span class="tag blue">운영 큐</span><span class="tag">${escapeHtml(String(reservations.length))}건</span></div>
            <h2 class="card-title card-title-spaced">${escapeHtml(adminQueueSheetTitle(kind))}</h2>
          </div>
          <button class="button ghost compact" type="button" data-admin-queue-sheet-close>${icon("x")}닫기</button>
        </div>
        <ul class="admin-queue-sheet-list">${rows}</ul>
      </section>
    </div>
  `;
}

function adminDashboardMetricSection(metrics) {
  const typeTotal = Object.values(metrics.typeCounts).reduce((sum, value) => sum + value, 0);
  const typeRows = typeTotal
    ? Object.entries(metrics.typeCounts).map(([type, count]) => {
      const percent = Math.round((count / typeTotal) * 100);
      const shareStep = Math.min(20, Math.max(0, Math.round(percent / 5)));
      return `
        <div class="admin-type-share">
          <span>${escapeHtml(typeLabel[type] || type)}</span>
          <strong>${percent}%</strong>
          <i class="share-step-${shareStep}"></i>
        </div>
      `;
    }).join("")
    : `<p class="muted">최근 예약 데이터가 없습니다.</p>`;
  const popularRows = metrics.popularEquipment.length
    ? metrics.popularEquipment.map((item) => `<li><span>${escapeHtml(item.name)}</span><strong>${escapeHtml(String(item.count))}회</strong></li>`).join("")
    : `<li class="empty-inline">선택 기자재 데이터 없음</li>`;
  return `
    <section class="admin-dashboard-section">
      ${sectionHeader({ title: "운영 지표", subtitle: "현재 로드된 관리자 데이터 기준입니다." })}
      <div class="admin-metric-grid">
        <div class="admin-metric-card">
          <span>이번 주 예약 수</span>
          <strong>${escapeHtml(String(metrics.weekReservations))}</strong>
          <small>최근 로드 예약 기준</small>
        </div>
        <div class="admin-metric-card">
          <span>기자재 가용률</span>
          <strong>${escapeHtml(String(metrics.equipmentAvailableRate))}%</strong>
          <small>가능 ${escapeHtml(String(metrics.availableEquipment))} / 전체 ${escapeHtml(String(metrics.activeEquipment))}</small>
        </div>
        <div class="admin-metric-card">
          <span>수리중 기자재</span>
          <strong>${escapeHtml(String(metrics.repairEquipment))}</strong>
          <small>예약 가능 목록에서 제외</small>
        </div>
        <div class="admin-metric-card">
          <span>취소/반려 예약</span>
          <strong>${escapeHtml(String(metrics.cancelledReservations))}</strong>
          <small>최근 로드 예약 기준</small>
        </div>
      </div>
      <div class="admin-dashboard-insight-grid">
        <div class="admin-insight-panel">
          <h3>예약 유형별 비중</h3>
          ${typeRows}
        </div>
        <div class="admin-insight-panel">
          <h3>인기 기자재 Top 5</h3>
          <ul>${popularRows}</ul>
        </div>
        <div class="admin-insight-panel">
          <h3>공지/특강 상태</h3>
          <p><strong>${escapeHtml(String(metrics.openLectures))}</strong>개 특강 모집중</p>
          <p>${metrics.latestNotice ? `최근 공지 · ${escapeHtml(metrics.latestNotice.title || "제목 없음")}` : "최근 공지 없음"}</p>
        </div>
      </div>
    </section>
  `;
}

function adminNotificationSettingsCard() {
  const status = state.nativeNotifications || {};
  const enabled = nativeNotificationPreferenceEnabled();
  const planned = status.supported ? plannedAdminNotifications().length : 0;
  const syncedLabel = status.syncedAt ? formatDateTime(status.syncedAt) : "동기화 전";
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
    title: "운영 알림",
    subtitle: status.supported
      ? "승인 대기, 오늘 예약, 보고서 확인 필요 건을 오전/오후 운영 체크 알림으로 보냅니다."
      : "iOS/Android 앱에서 설치 후 사용할 수 있습니다.",
    actions,
    body: `
      <div class="native-notification-grid">
        <div><span>권한</span><strong>${escapeHtml(permissionLabel)}</strong></div>
        <div><span>상태</span><strong>${enabled ? "켜짐" : "꺼짐"}</strong></div>
        <div><span>예정 알림</span><strong>${escapeHtml(String(planned))}개</strong></div>
        <div><span>마지막 동기화</span><strong>${escapeHtml(syncedLabel)}</strong></div>
      </div>
      ${status.error ? `<p class="muted warning-text">${escapeHtml(status.error)}</p>` : ""}
      <p class="muted">관리자 데이터 새로고침, 로그아웃, 알림 동기화 시 기존 운영 알림은 다시 정리됩니다.</p>
    `,
    className: "native-notification-card"
  });
}

export function adminUsersView() {
  const query = normalizeSearchText(state.adminUserSearch).trim();
  const users = sortedAdminUsers().filter((user) => !query || searchableText([
    user.name,
    user.email,
    user.studentId,
    user.grade,
    user.studentStatus,
    user.phone,
    user.approvalStatus,
    statusLabel[user.approvalStatus],
    user.blockedUntil,
    user.warningRecords
  ]).includes(query));
  const nonAdminUsers = state.adminUsers.filter((user) => user.role !== "admin");
  const statusFilters = [
    ["all", "전체"],
    ["approval_pending", "승인대기"],
    ["approved", "승인완료"],
    ["rejected", "반려"],
    ["blocked", "대여금지"]
  ];
  return `
    <section class="grid">
      <div class="list-control-panel">
        ${searchField({ value: state.adminUserSearch || "", placeholder: "이름·학번·연락처·이메일·메모 검색", dataset: "data-admin-user-search", label: "학생 검색" })}
        ${tabs(statusFilters.map(([key, label]) => ({
          key,
          label
        })), { active: state.adminUserStatusFilter, dataset: "admin-user-status-filter", ariaLabel: "학생 승인 상태 필터" })}
      </div>
      ${adminPageScopeNote(state.adminUsersPage, nonAdminUsers.length, users.length, query)}
      ${query ? `<p class="muted">"${escapeHtml(state.adminUserSearch)}" 검색 결과 ${users.length}건</p>` : ""}
      <div class="table-wrap admin-user-table-wrap">
        <table class="admin-user-table">
          <thead><tr><th class="admin-user-name-head">${userSortButton("name", "이름")}</th><th>${userSortButton("studentId", "학번")}</th><th>${userSortButton("studentStatus", "신분")}</th><th>연락처</th><th class="admin-user-status-head">${userSortButton("approvalStatus", "상태")}</th></tr></thead>
          <tbody>
            ${users.length ? users.map((user) => `
              <tr class="admin-user-info-row">
                <td class="admin-user-identity" data-label="이름">
                  <strong class="admin-user-name" title="${escapeHtml(user.name)}">${escapeHtml(user.name)}</strong>
                  <span class="admin-user-email" title="${escapeHtml(user.email || "")}">${escapeHtml(user.email || "")}</span>
                </td>
                <td data-label="학번">${escapeHtml(user.studentId || "-")}</td>
                <td data-label="신분">${escapeHtml(user.studentStatus)}</td>
                <td data-label="연락처">${escapeHtml(user.phone)}</td>
                <td class="admin-user-status-cell" data-label="상태">${userStatusCell(user)}</td>
              </tr>
              <tr class="admin-user-actions-row">
                <td colspan="5">
                  <div class="admin-user-action-panel">
                    <div class="admin-user-action-group admin-user-core-group">
                      ${userApprovalButton(user)}
                    </div>
                    <div class="admin-user-action-group admin-user-limit-group">
                      <select class="select compact-select" data-user-limit-duration="${user.id}" aria-label="${escapeHtml(user.name)} 대여금지 기간">
                        <option value="">대여금지 설정</option>
                        ${user.approvalStatus === "blocked" ? `<option value="unblock">대여금지 해제</option>` : ""}
                        ${Object.entries(userLimitOptions).map(([value, label]) => `<option value="${value}" ${user.approvalStatus === "blocked" && user.blockDuration === value ? "selected" : ""}>${label}</option>`).join("")}
                      </select>
                    </div>
                    ${userWarningMemo(user)}
                    <div class="admin-user-action-group admin-user-secondary-group">
                      <button class="button compact admin-user-small-action" data-user-reset="${user.id}">비번 리셋</button>
                      ${iconOnlyAction("삭제", "trash", `data-user-delete="${user.id}" data-user-name="${escapeHtml(user.name)}"`, { className: "button danger compact admin-user-delete-button" })}
                    </div>
                  </div>
                </td>
              </tr>`).join("") : `<tr><td colspan="5">${emptyState({ title: query ? "검색 결과가 없습니다." : `${statusLabel[state.adminUserStatusFilter] || "선택한 상태"} 학생이 없습니다.`, body: query ? "검색어를 지우거나 상태 필터를 변경하세요." : "" })}</td></tr>`}
          </tbody>
        </table>
      </div>
      ${adminPager(state.adminUsersPage, "admin-users-page")}
      ${adminGuide("학생 승인 사용 가이드", "가입 학생의 이름·학번·연락처를 확인하고 승인/반려를 처리합니다. 대여금지는 드롭다운에서 기간을 선택하면 바로 적용됩니다. 경고는 학생 상태를 바꾸지 않고 관리자용 메모 기록으로 남습니다.")}
    </section>
  `;
}

function userApprovalButton(user) {
  const approvedLike = user.approvalStatus === "approved" || user.approvalStatus === "blocked";
  if (approvedLike) {
    return `<button class="button danger compact" data-user-approval="${user.id}" data-status="rejected">${icon("x")}반려</button>`;
  }
  return `<button class="button primary compact" data-user-approval="${user.id}" data-status="approved">${icon("check")}승인</button>`;
}

function userWarningMemo(user) {
  const records = Array.isArray(user.warningRecords) ? user.warningRecords : [];
  if (!records.length) {
    return `
      <div class="admin-user-warning-memo is-empty">
        <div class="admin-user-warning-memo-head">
          <strong>경고 메모 기록 없음</strong>
          <button class="button warn compact admin-user-memo-add" data-user-warn="${user.id}">${icon("plus")}메모 추가</button>
        </div>
        <span>저장된 메모가 없습니다.</span>
      </div>
    `;
  }
  const latest = records[0];
  const date = latest.createdAt ? formatDateTime(latest.createdAt) : "";
  return `
    <div class="admin-user-warning-memo">
      <div class="admin-user-warning-memo-head">
        <strong>최근 경고 메모 ${escapeHtml(user.warningCount || records.length)}건</strong>
        <div class="admin-user-warning-actions">
          <button class="button warn compact admin-user-memo-add" data-user-warn="${user.id}">${icon("plus")}메모 추가</button>
          <button class="button ghost compact admin-user-memo-reset" data-user-warn-reset="${user.id}">초기화</button>
        </div>
      </div>
      <span>${escapeHtml(date)}${date ? " · " : ""}${escapeHtml(latest.reason || "사유 없음")}</span>
    </div>
  `;
}

function reservationSearchText(reservation) {
  const f = reservation.fields || {};
  return [
    reservation.user?.name,
    reservation.user?.studentId,
    reservation.user?.phone,
    f.reservedDate,
    f.studioSpace,
    ...(Array.isArray(f.studioSpaces) ? f.studioSpaces : []),
    f.printType,
    typeLabel[reservation.type] || reservation.type,
    ...(Array.isArray(reservation.equipmentItems) ? reservation.equipmentItems.flatMap((item) => [item.code, item.name]) : [])
  ].filter(Boolean).join(" ").toLowerCase();
}

export function adminReservationsView() {
  const reservationTabs = [["all", "전체"], ["equipment", "기자재"], ["darkroom", "암실"], ["studio", "스튜디오"], ["print", "출력"]];
  const equipmentStatusFilters = [["all", "전체"], ...equipmentReservationStatuses.map((status) => [status, equipmentReservationStatusLabel[status]])];
  const query = normalizeSearchText(state.adminReservationSearch).trim();
  const isEquipmentTab = state.adminReservationTab === "equipment";
  const equipmentStatusFilter = state.adminEquipmentReservationStatusFilter || "all";
  const tabReservations = state.adminReservationTab === "all"
    ? state.adminReservations
    : state.adminReservations.filter((reservation) => reservation.type === state.adminReservationTab);
  const equipmentReservations = state.adminReservations.filter((reservation) => reservation.type === "equipment");
  const statusFilteredReservations = isEquipmentTab && equipmentStatusFilter !== "all"
    ? tabReservations.filter((reservation) => equipmentStatusFilter === "cancelled_or_rejected"
      ? ["cancelled", "rejected"].includes(reservation.status)
      : reservation.status === equipmentStatusFilter)
    : tabReservations;
  // 최신순(예약 생성일 내림차순)으로 정렬해 최근 예약을 위에 노출
  const reservations = query
    ? state.adminReservations.slice().sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    : statusFilteredReservations.slice().sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const reservationSemesterControls = semesterTabs(state.adminReservationSemesters, state.adminReservationSemesterFilter, "admin-reservation-semester");
  const reservationTotal = adminCollectionTotal(state.adminReservationsPage, state.adminReservations.length);
  const currentReservationTab = query ? "all" : state.adminReservationTab;
  const currentEquipmentStatusFilter = query ? "all" : equipmentStatusFilter;
  return `
    <section class="grid">
      ${searchField({ value: state.adminReservationSearch || "", placeholder: "전체 검색 (이름·학번·날짜·기자재·스튜디오)", dataset: "data-admin-reservation-search" })}
      ${reservationSemesterControls}
      <div ${query ? "hidden" : ""}>
        ${tabs(reservationTabs.map(([key, label]) => ({
          key,
          label
        })), { active: currentReservationTab, dataset: "admin-reservation-tab", className: "admin-reservation-type-tabs", ariaLabel: "예약 종류 필터" })}
      </div>
      ${!query && isEquipmentTab ? `
        ${tabs(equipmentStatusFilters.map(([key, label]) => ({
          key,
          label
        })), { active: currentEquipmentStatusFilter, dataset: "admin-equipment-reservation-status", className: "admin-reservation-status-tabs", ariaLabel: "기자재 예약 상태 필터" })}
      ` : ""}
      ${bulkDeletePanel("reservations", reservations.length, reservationTotal, reservationBulkFilterLabel(query, reservations.length), { filteredEnabled: activeReservationBulkFilter(query) })}
      ${adminPageScopeNote(state.adminReservationsPage, state.adminReservations.length, reservations.length, query)}
      ${query ? `<p class="muted">"${escapeHtml(state.adminReservationSearch)}" 검색 결과 ${Number(state.adminReservationsPage?.total || reservations.length || 0)}건 · 현재 표시 ${reservations.length}건</p>` : ""}
      <div class="admin-reservation-grid">
        ${reservations.length ? reservations.map(adminReservationCard).join("") : emptyState({ title: query ? "검색 결과가 없습니다." : "해당 탭의 예약이 없습니다." })}
      </div>
      ${adminPager(state.adminReservationsPage, "admin-reservations-page")}
      ${adminGuide("예약관리 사용 가이드", "최신 예약이 위에 표시됩니다. 기자재는 승인 대기, 승인 완료, 대여 중, 반납 완료 순서로 처리하며 반려와 예약 취소는 종료 상태로 관리합니다.")}
    </section>
  `;
}

export function adminReservationDetail(reservation) {
  const f = reservation.fields || {};
  if (reservation.type === "equipment") {
    return [
      ["대여/반납", `${f.rentalTime || "-"} / ${f.returnTime || "-"}`],
      ["기간", f.period || "-"],
      ["장비", (reservation.equipmentItems || []).map((item) => `${item.code} ${item.name}`).join(", ") || "-"],
      ["가방 확인", f.cameraBagConfirmationRequired ? (f.pelicanBagReserved ? "펠리컨 가방 예약됨" : f.cameraBagConfirmed ? "지참 확인" : "확인 필요") : "대상 아님"],
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

export function adminReservationCard(reservation) {
  const f = reservation.fields || {};
  const rows = adminReservationDetail(reservation);
  const completionButton = reservation.type === "equipment" ? "" : `<button class="button" data-res-status="${reservation.id}" data-status="completed">${icon("check")}완료</button>`;
  const equipmentStatusAction = (status, label, iconName, danger = false) => `<button class="button${danger ? " danger" : ""}" data-res-status="${reservation.id}" data-status="${status}">${icon(iconName)}${label}</button>`;
  const equipmentTransitions = {
    pending_approval: [["approved", "승인", "check", false], ["rejected", "반려", "x", true]],
    approved: [["checked_out", "대여 처리", "check", false], ["cancelled", "예약 취소", "x", true]],
    checked_out: [["returned", "반납 처리", "check", false], ["cancelled", "예약 취소", "x", true]]
  };
  const equipmentActions = (equipmentTransitions[reservation.status] || [])
    .map(([status, label, iconName, danger]) => equipmentStatusAction(status, label, iconName, danger))
    .join("");
  return `
    <article class="admin-reservation-card">
      <div class="reservation-card-head">
        <div>
          <div class="chips"><span class="tag blue">${typeLabel[reservation.type]}</span>${reservationStatusTag(reservation)}</div>
          <h3>${escapeHtml(reservation.user?.name || "-")}</h3>
          <p>${escapeHtml(f.reservedDate || "-")} · ${escapeHtml(f.phone || reservation.user?.phone || "")}</p>
        </div>
      </div>
      <div class="property-list compact">
        ${rows.map(([key, value]) => `<div class="prop"><span class="key">${escapeHtml(key)}</span><span>${escapeHtml(value)}</span></div>`).join("")}
      </div>
      <div class="row-actions">
        ${reservation.type === "equipment" ? equipmentActions : ""}
        ${completionButton}
        ${reservation.type === "equipment" ? "" : `<button class="button danger" data-res-status="${reservation.id}" data-status="admin_cancelled">${icon("x")}취소</button>`}
      </div>
    </article>
  `;
}

export function adminEquipmentView() {
  const categories = equipmentCategories();
  const sourceTabs = [["department", "극기관"], ["fantasy_lab", "판타지랩"], ["all", "전체"]];
  const filtered = visibleAdminEquipmentItems();
  const query = normalizeSearchText(state.adminEquipmentSearch).trim();
  const selected = selectedAdminEquipmentSet();
  const visibleSelectedCount = filtered.filter((item) => selected.has(item.id)).length;
  const allVisibleSelected = filtered.length > 0 && visibleSelectedCount === filtered.length;
  const panelTab = state.adminEquipmentPanelTab || "manage";
  return `
    <section class="grid">
      <div class="admin-inner-tabs" role="tablist" aria-label="기자재 관리 탭">
        <button class="tab-button ${panelTab === "add" ? "active" : ""}" type="button" data-admin-equipment-panel-tab="add">장비추가</button>
        <button class="tab-button ${panelTab === "manage" ? "active" : ""}" type="button" data-admin-equipment-panel-tab="manage">장비관리</button>
      </div>
      ${panelTab === "add" ? `
      <div class="card admin-equipment-add-card">
        <h2 class="card-title">장비 추가</h2>
        <form class="grid two" data-form="equipment-add">
          <div class="field"><label>장비명</label><input class="input" name="name" required /></div>
          <div class="field"><label>카테고리</label><select class="select" name="category">${categories.map((item) => `<option>${escapeHtml(item)}</option>`).join("")}</select></div>
          <div class="field"><label>수량</label><input class="input" name="quantity" type="number" min="1" value="1" /></div>
          <div class="field"><label>코드 prefix</label><input class="input" name="codePrefix" placeholder="CAM-SONY-A7M3" /></div>
          <div class="field"><label>관리처</label><select class="select" name="source"><option value="department">극기관</option><option value="fantasy_lab">판타지랩</option></select></div>
          <div class="field"><label>상태</label><select class="select" name="status">${equipmentStatusOptions.map((status) => `<option value="${status}">${status}</option>`).join("")}</select></div>
          <div class="field"><label>비고</label><input class="input" name="notes" /></div>
          <button class="button primary" type="submit">${icon("plus")}추가</button>
        </form>
      </div>
      <div class="card admin-equipment-add-card">
        <h2 class="card-title">카테고리 추가</h2>
        <p class="muted">학생 예약 화면과 Admin 장비 등록 선택지에 같이 반영됩니다.</p>
        <form class="inline-form" data-form="equipment-category-add">
          <input class="input" name="categoryName" placeholder="예: Tripod, Monitor, Battery" required />
          <button class="button primary" type="submit">${icon("plus")}카테고리 추가</button>
        </form>
      </div>
      <div class="card admin-equipment-add-card">
        <h2 class="card-title">CSV 업로드</h2>
        <p class="muted">컬럼: facility,source,category,name,brand,model,quantity,code_prefix,reservable,inquiry_only,status,notes</p>
        <form data-form="equipment-import">
          <textarea class="textarea" name="csv" placeholder="CSV 내용을 붙여넣기"></textarea>
          <div class="row-actions">
            <button class="button" type="button" data-action="csv-preview">미리보기</button>
            <button class="button primary" type="submit">${icon("check")}미리보기 내용 등록</button>
          </div>
        </form>
        ${state.csvPreviewRows.length ? csvPreviewTable(state.csvPreviewRows) : `<p class="empty">CSV를 붙여넣고 미리보기를 누르면 임시 표가 표시됩니다.</p>`}
      </div>
      ` : ""}
      ${panelTab === "manage" ? `
      <div class="card admin-equipment-list-card compact">
        <div class="form-head">
          <div>
            <h2 class="card-title">등록된 전체 기자재</h2>
            <p class="muted">관리처와 카테고리 탭으로 나눠 확인합니다.</p>
          </div>
          <span class="tag blue" data-admin-equipment-count>${filtered.length}개</span>
        </div>
        <div class="list-control-panel compact">
          ${searchField({ value: state.adminEquipmentSearch || "", placeholder: "코드·장비명·카테고리·상태 검색", dataset: "data-admin-equipment-search", label: "기자재 검색" })}
        </div>
        <div class="tab-row">
          ${sourceTabs.map(([key, label]) => `<button class="tab-button ${state.adminEquipmentTab === key ? "active" : ""}" data-admin-equipment-tab="${key}">${label}</button>`).join("")}
        </div>
        ${state.adminEquipmentTab === "fantasy_lab" ? `
          <div class="info-strip">
            <strong>판타지랩 기자재는 온라인 예약불가</strong>
            <span>학생 화면에는 확인용 목록으로만 표시됩니다. 이 관리처로 등록하거나 CSV 업로드한 장비는 자동으로 문의 처리됩니다.</span>
          </div>
        ` : ""}
        <div class="tab-row wrap">
          <button class="tab-button ${state.adminEquipmentCategoryTab === "all" ? "active" : ""}" data-admin-equipment-category-tab="all">전체</button>
          ${categories.map((cat) => `<button class="tab-button ${state.adminEquipmentCategoryTab === cat ? "active" : ""}" data-admin-equipment-category-tab="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`).join("")}
        </div>
        <div class="equipment-bulk-bar">
          <label class="table-check">
            <input type="checkbox" data-equipment-select-all ${allVisibleSelected ? "checked" : ""} />
            <span>전체 선택</span>
          </label>
          <span class="tag" data-admin-equipment-selected-count>${selected.size}개 선택</span>
          <div class="bulk-actions" aria-label="선택 기자재 상태 변경">
            ${equipmentAdminStatusOptions.map((status) => `<button class="button compact" type="button" data-equipment-bulk-status="${status}" ${selected.size ? "" : "disabled"}>${status}</button>`).join("")}
            ${iconOnlyAction("선택 기자재 제거", "trash", "data-equipment-bulk-remove", { disabled: !selected.size })}
          </div>
        </div>
        <div class="table-wrap embedded admin-equipment-scroll-region">
          <table>
            <thead><tr><th class="check-col"><span class="sr-only">선택</span></th><th>코드</th><th>장비</th><th>분류</th><th>관리처</th><th>상태</th><th>예약</th><th>작업</th></tr></thead>
            <tbody>${filtered.length ? filtered.map((item) => `
              <tr data-equipment-row="${item.id}" data-status="${escapeHtml(item.status || "")}" class="${selected.has(item.id) ? "selected" : ""}">
                <td class="check-col"><input type="checkbox" data-equipment-select="${item.id}" ${selected.has(item.id) ? "checked" : ""} aria-label="${escapeHtml(`${item.code} ${item.name} 선택`)}" /></td>
                <td>${escapeHtml(item.code)}</td>
                <td>${escapeHtml(item.name)}<br><span class="muted">${escapeHtml(item.notes || "")}</span></td>
                <td>${escapeHtml(item.category)}</td>
                <td>${escapeHtml(sourceLabel[item.source] || item.facility || "-")}</td>
                <td>${equipmentStatusButtons(item)}</td>
                <td data-equipment-reservable-cell="${item.id}">${equipmentReservableTag(item)}</td>
                <td>${iconOnlyAction("기자재 제거", "trash", `data-equipment-remove-admin="${item.id}"`, { className: "button danger compact" })}</td>
              </tr>`).join("") : `<tr><td colspan="8">${emptyState({ title: query ? "검색 결과가 없습니다." : "등록된 기자재가 없습니다.", body: query ? "검색어를 지우거나 탭 필터를 변경하세요." : "" })}</td></tr>`}</tbody>
          </table>
        </div>
      </div>
      ` : ""}
      ${adminGuide("기자재 사용 가이드", "카테고리와 관리처를 먼저 정리한 뒤 장비를 등록합니다. CSV는 바로 등록하지 말고 미리보기로 행이 제대로 읽혔는지 확인한 다음 등록하세요.")}
    </section>
  `;
}

export function csvPreviewTable(rows) {
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

function reportSearchText(report) {
  const reservation = report.reservation || {};
  const reservationFields = reservation.fields || {};
  const reportFields = report.fields || {};
  return [
    report.id,
    report.reservationId,
    report.user?.name,
    report.user?.studentId,
    report.user?.phone,
    reservationFields.phone,
    reservationFields.reservedDate,
    reservationFields.studioSpace,
    ...(Array.isArray(reservationFields.studioSpaces) ? reservationFields.studioSpaces : []),
    ...(Array.isArray(reservationFields.timeSlots) ? reservationFields.timeSlots : []),
    reservationFields.participants,
    reservationFields.requiredEquipment,
    reservationFields.purpose,
    reportFields.actualTime,
    reportFields.participants,
    reportFields.resultPhotoUrl,
    reportFields.damageFound ? "파손 있음" : "파손 없음",
    reportFields.damageDescription,
    report.submittedAt
  ].filter(Boolean).join(" ").toLowerCase();
}

function reportSortValue(report, field) {
  const reservationFields = report.reservation?.fields || {};
  if (field === "reservedDate") return reservationFields.reservedDate || "";
  if (field === "name") return report.user?.name || "";
  if (field === "damageFound") return report.fields?.damageFound ? "1" : "0";
  return report.submittedAt || "";
}

function sortedAdminReports(reports) {
  const { field, direction } = state.adminReportSort;
  const multiplier = direction === "asc" ? 1 : -1;
  return reports.slice().sort((a, b) => {
    const aValue = String(reportSortValue(a, field)).toLocaleLowerCase();
    const bValue = String(reportSortValue(b, field)).toLocaleLowerCase();
    return aValue.localeCompare(bValue, "ko", { numeric: true }) * multiplier;
  });
}

export function adminReportsView() {
  const query = normalizeSearchText(state.adminReportSearch).trim();
  const reports = sortedAdminReports(state.adminReports);
  const sortDirection = state.adminReportSort.direction === "asc" ? "↑" : "↓";
  const reportSortOptions = [
    ["submittedAt", "제출일"],
    ["reservedDate", "사용일"],
    ["name", "이름"],
    ["damageFound", "파손"]
  ].map(([key, label]) => ({
    key,
    label: state.adminReportSort.field === key ? `${label} ${sortDirection}` : label
  }));
  const reportSemesterControls = semesterTabs(state.adminReportSemesters, state.adminReportSemesterFilter, "admin-report-semester");
  const reportTotal = adminCollectionTotal(state.adminReportsPage, state.adminReports.length);
  return `
    <section class="grid">
      ${searchField({ value: state.adminReportSearch || "", placeholder: "전체 검색 (이름·학번·날짜·스튜디오·예약ID)", dataset: "data-admin-report-search" })}
      ${reportSemesterControls}
      ${tabs(reportSortOptions, { active: state.adminReportSort.field, dataset: "admin-report-sort", ariaLabel: "보고서 정렬" })}
      ${bulkDeletePanel("reports", reports.length, reportTotal, reportBulkFilterLabel(query, reports.length), { filteredEnabled: activeReportBulkFilter(query) })}
      ${adminPageScopeNote(state.adminReportsPage, state.adminReports.length, reports.length, query)}
      ${query ? `<p class="muted">"${escapeHtml(state.adminReportSearch)}" 검색 결과 ${Number(state.adminReportsPage?.total || reports.length || 0)}건 · 현재 표시 ${reports.length}건</p>` : ""}
      ${reports.length ? reports.map((report) => `
        <article class="card ui-card">
          <div class="chips"><span class="tag blue">스튜디오 보고서</span><span class="tag green">제출완료</span></div>
          <h3 class="card-title card-title-spaced">${escapeHtml(report.user?.name || "-")}</h3>
          ${propertyList([
            ["예약", escapeHtml(report.reservationId)],
            ["사용일", escapeHtml(report.reservation?.fields?.reservedDate || "-")],
            ["공간", escapeHtml((report.reservation?.fields?.studioSpaces || [report.reservation?.fields?.studioSpace]).filter(Boolean).join(", ") || "-")],
            ["사용 시간", escapeHtml(report.fields.actualTime)],
            ["인원", escapeHtml(report.fields.participants)],
            ["결과 사진", report.fields.resultPhotoUrl ? `<a href="${escapeHtml(report.fields.resultPhotoUrl)}" target="_blank" rel="noopener noreferrer">링크 열기</a>` : "-"],
            ["파손", report.fields.damageFound ? escapeHtml(report.fields.damageDescription || "있음") : "없음"],
            ["제출일", formatDateTime(report.submittedAt)]
          ])}
        </article>`).join("") : emptyState({ title: query ? "검색 결과가 없습니다." : "제출된 보고서가 없습니다." })}
      ${adminPager(state.adminReportsPage, "admin-reports-page")}
      ${adminGuide("보고서 사용 가이드", "스튜디오 사용 후 학생이 제출한 보고서를 확인하는 화면입니다. 결과 사진 링크를 확인하고, 미제출 및 이상 내용은 기존 자체 패널티 기준으로 처리합니다.")}
    </section>
  `;
}

function lectureEditForm(lecture) {
  return `
    <div class="card">
      <div class="form-head">
        <div><h2 class="card-title">특강 수정</h2><p class="muted">${escapeHtml(lecture.title || "")}</p></div>
        <button class="button ghost compact" type="button" data-lecture-edit-cancel>${icon("x")}닫기</button>
      </div>
      <form class="grid two" data-form="lecture-edit" data-lecture-id="${lecture.id}">
        <div class="field"><label>특강명</label><input class="input" name="title" value="${escapeHtml(lecture.title || "")}" required /></div>
        <div class="field"><label>특강일</label><input class="input" name="lectureDate" type="date" value="${escapeHtml(lecture.lectureDate || "")}" required /></div>
        <div class="field"><label>시간</label><input class="input" name="time" value="${escapeHtml(lecture.time || "")}" required /></div>
        <div class="field"><label>장소</label><input class="input" name="location" value="${escapeHtml(lecture.location || "")}" required /></div>
        <div class="field"><label>강사명</label><input class="input" name="instructorName" value="${escapeHtml(lecture.instructorName || "")}" required /></div>
        <div class="field"><label>강사 소속</label><input class="input" name="instructorAffiliation" value="${escapeHtml(lecture.instructorAffiliation || "")}" /></div>
        <div class="field"><label>담당교수</label><input class="input" name="professor" value="${escapeHtml(lecture.professor || "")}" /></div>
        <div class="field"><label>대상 학년</label>${lectureTargetGradeSelect(lecture.targetGrades || "전체")}</div>
        <div class="field"><label>모집인원</label><input class="input" name="capacity" type="number" min="0" value="${Number(lecture.capacity || 0)}" /></div>
        <div class="field"><label>진행상태</label><select class="select" name="status">${lectureStatusOptions.map((item) => `<option value="${item}" ${lecture.status === item ? "selected" : ""}>${item}</option>`).join("")}</select></div>
        <div class="field"><label>비고</label><input class="input" name="notes" value="${escapeHtml(lecture.notes || "")}" /></div>
        <div class="field span-two"><label>특강 내용</label><textarea class="textarea" name="description" required>${escapeHtml(lecture.description || "")}</textarea></div>
        <button class="button primary" type="submit">${icon("check")}수정 저장</button>
      </form>
    </div>
  `;
}

const lectureTargetGradeOptions = ["전체", "1학년", "2학년", "3학년", "4학년", "1-2학년", "2-3학년", "3-4학년", "2-4학년"];

function lectureTargetGradeSelect(value = "전체") {
  const selected = String(value || "전체").trim();
  const options = selected && !lectureTargetGradeOptions.includes(selected)
    ? [...lectureTargetGradeOptions, selected]
    : lectureTargetGradeOptions;
  return `<select class="select" name="targetGrades">${options.map((item) => `<option value="${escapeHtml(item)}" ${item === selected ? "selected" : ""}>${escapeHtml(item)}</option>`).join("")}</select>`;
}

function lectureTextPreview(value = "", maxLength = 150) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function lectureStatusTone(status = "") {
  if (status === "진행완료") return "green";
  if (status === "취소") return "gray";
  return "blue";
}

function lectureCreateForm() {
  return `
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
          <div class="field"><label>대상 학년</label>${lectureTargetGradeSelect("전체")}</div>
          <div class="field"><label>모집인원</label><input class="input" name="capacity" type="number" min="0" value="0" /></div>
          <div class="field"><label>진행상태</label><select class="select" name="status">${lectureStatusOptions.map((item) => `<option>${item}</option>`).join("")}</select></div>
          <div class="field"><label>비고</label><input class="input" name="notes" /></div>
          <div class="field span-two"><label>특강 내용</label><textarea class="textarea" name="description" required></textarea></div>
          <button class="button primary" type="submit">${icon("plus")}특강 등록</button>
        </form>
      </div>`;
}

export function adminLecturesView() {
  const editing = state.editingLectureId ? state.adminLectures.find((item) => item.id === state.editingLectureId) : null;
  const query = normalizeSearchText(state.adminLectureSearch).trim();
  const lectures = state.adminLectures || [];
  const panelTab = editing ? "add" : (state.adminLecturePanelTab || "list");
  const lectureSemesterControls = semesterTabs(state.adminLectureSemesters, state.adminLectureSemesterFilter, "admin-lecture-semester");
  const lectureTotal = adminCollectionTotal(state.adminLecturesPage, state.adminLectures.length);
  return `
    <section class="grid">
      <div class="admin-inner-tabs" role="tablist" aria-label="비교과 특강 관리 탭">
        <button class="tab-button ${panelTab === "add" ? "active" : ""}" type="button" data-admin-lecture-panel-tab="add">특강 등록</button>
        <button class="tab-button ${panelTab === "list" ? "active" : ""}" type="button" data-admin-lecture-panel-tab="list">특강 리스트</button>
      </div>
      ${panelTab === "add" ? (editing ? lectureEditForm(editing) : lectureCreateForm()) : ""}
      ${panelTab === "list" ? `
      <div class="card admin-lecture-list-card">
        <div class="form-head">
          <div>
            <h2 class="card-title">특강 리스트</h2>
            <p class="muted">날짜, 특강명, 강사명, 장소, 신청인원, 진행상태를 기준으로 확인합니다.</p>
          </div>
          <button class="button" data-action="lecture-export">${icon("download")}CSV 내보내기</button>
        </div>
        <div class="list-control-panel compact">
          ${searchField({ value: state.adminLectureSearch || "", placeholder: "날짜·특강명·강사·장소·신청자 검색", dataset: "data-admin-lecture-search", label: "특강 검색" })}
          ${lectureSemesterControls}
          ${bulkDeletePanel("lectures", lectures.length, lectureTotal, lectureBulkFilterLabel(query, lectures.length), { filteredEnabled: activeLectureBulkFilter(query) })}
        </div>
        ${query ? `<p class="muted">"${escapeHtml(state.adminLectureSearch)}" 검색 결과 ${lectures.length}건</p>` : ""}
        ${lectures.length ? adminLectureTable(lectures) : emptyState({ title: query ? "검색 결과가 없습니다." : "등록된 비교과 특강이 없습니다.", body: query ? "검색어를 지우면 전체 특강을 볼 수 있습니다." : "" })}
      </div>
      ` : ""}
      ${adminGuide("비교과 특강 사용 가이드", "특강을 등록하면 학생 화면에 리스트가 표시됩니다. 리스트의 ‘수정’으로 내용을 고치고, ‘삭제’로 특강과 신청 내역을 함께 제거할 수 있습니다. 결과는 CSV로 내려받을 수 있습니다.")}
    </section>
  `;
}

export function adminLectureTable(lectures) {
  return `
    <div class="admin-lecture-card-list">
      ${lectures.map((lecture) => {
        const count = Number(lecture.applicationCount || 0);
        const capacity = Number(lecture.capacity || 0);
        const descriptionPreview = lectureTextPreview(lecture.description || "");
        const applicantText = (lecture.applications || []).map((app) => `${app.userName || app.name || ""} ${app.studentId || ""}`.trim()).filter(Boolean).join(", ") || "신청자 없음";
        return `
          <article class="admin-lecture-item-card">
            <div class="admin-lecture-item-main">
              <div class="admin-lecture-date">
                <strong>${escapeHtml(lecture.lectureDate || "-")}</strong>
                <span>${escapeHtml(lecture.time || "")}</span>
              </div>
              <div class="admin-lecture-title-cell">
                <strong title="${escapeHtml(lecture.title || "")}">${escapeHtml(lecture.title || "-")}</strong>
                ${descriptionPreview ? `<span class="muted admin-lecture-preview" title="${escapeHtml(descriptionPreview)}">${escapeHtml(descriptionPreview)}</span>` : ""}
              </div>
              <div class="admin-lecture-meta-grid">
                <div><span>강사명</span><strong>${escapeHtml(lecture.instructorName || "-")}</strong>${lecture.instructorAffiliation ? `<small>${escapeHtml(lecture.instructorAffiliation)}</small>` : ""}</div>
                <div><span>장소</span><strong>${escapeHtml(lecture.location || "-")}</strong></div>
                <div><span>신청인원</span><strong>${capacity ? `${count}/${capacity}` : count}</strong></div>
                <div>
                  <span>진행상태</span>
                  <strong class="admin-lecture-status-chip ${lectureStatusTone(lecture.status)}">
                    <i class="admin-lecture-status-dot" aria-hidden="true"></i>
                    ${escapeHtml(lecture.status || "-")}
                  </strong>
                </div>
              </div>
            </div>
            <div class="admin-lecture-action-bar">
              <select class="select compact-select" data-lecture-status="${lecture.id}" aria-label="${escapeHtml(lecture.title || "특강")} 진행상태">
                ${lectureStatusOptions.map((item) => `<option value="${item}" ${lecture.status === item ? "selected" : ""}>${item}</option>`).join("")}
              </select>
              <button class="button compact" data-lecture-update="${lecture.id}">${icon("check")}상태 저장</button>
              <button class="button compact" data-lecture-edit="${lecture.id}">${icon("edit")}수정</button>
              ${iconOnlyAction("삭제", "trash", `data-lecture-delete="${lecture.id}" data-lecture-title="${escapeHtml(lecture.title || "")}"`)}
              <span class="admin-lecture-applicants">${escapeHtml(applicantText)}</span>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

export function adminNoticesView() {
  const query = normalizeSearchText(state.adminNoticeSearch).trim();
  const notices = state.adminNotices || [];
  const noticeTotal = adminCollectionTotal(state.adminNoticesPage, notices.length);
  return `
    <section class="grid">
      <div class="card">
        <h2 class="card-title">공지 작성</h2>
        <form data-form="notice-add">
          <div class="field"><label>제목</label><input class="input" name="title" required /></div>
          <div class="field"><label>카테고리</label><select class="select" name="category">${["일반", "비교과", "특강", "장비/시설", "긴급"].map((item) => `<option>${item}</option>`).join("")}</select></div>
          <div class="field"><label>본문</label><textarea class="textarea" name="body" required></textarea></div>
          <div class="field"><label>신청/참고 링크</label><input class="input" name="link" /></div>
          <label class="field"><span><input type="checkbox" name="pinned" value="true" /> 상단 고정</span></label>
          <button class="button primary" type="submit">${icon("send")}게시</button>
        </form>
      </div>
      <div class="list-control-panel">
        ${searchField({ value: state.adminNoticeSearch || "", placeholder: "제목·분류·본문 검색", dataset: "data-admin-notice-search", label: "공지 검색" })}
      </div>
      ${bulkDeletePanel("notices", notices.length, noticeTotal, query ? `현재 검색 결과 ${notices.length}건` : `전체 공지 ${notices.length}건`, { filteredEnabled: Boolean(query) })}
      ${query ? `<p class="muted">"${escapeHtml(state.adminNoticeSearch)}" 검색 결과 ${notices.length}건</p>` : ""}
      ${notices.length ? notices.map(noticeCard).join("") : emptyState({ title: query ? "검색 결과가 없습니다." : "등록된 공지사항이 없습니다.", body: query ? "검색어를 지우면 전체 공지를 볼 수 있습니다." : "" })}
      ${adminGuide("공지사항 사용 가이드", "비교과, 특강, 장비/시설 안내를 학생 화면에 공지합니다. 중요한 내용은 상단 고정으로 설정하고, 신청은 Slack 링크나 외부 링크를 넣으면 됩니다.")}
    </section>
  `;
}

function auditActionLabel(action) {
  return {
    "auth.login_success": "로그인",
    "auth.login_failed": "로그인 실패",
    "auth.login_blocked": "로그인 차단",
    "auth.logout": "로그아웃",
    "session.revoked": "원격 로그아웃",
    "reservation.created": "예약 생성",
    "reservation.cancelled": "예약 취소",
    "reservation.updated": "예약 수정",
    "reservation.status_changed": "예약 상태 변경",
    "lecture.applied": "특강 신청",
    "lecture.cancelled": "특강 신청 취소",
    "studio_report.created": "보고서 제출",
    "user.password_changed": "비밀번호 변경",
    "user.password_reset": "비밀번호 리셋",
    "user.approval_changed": "학생 상태 변경",
    "user.warning_issued": "경고 메모 저장",
    "user.warning_reset": "경고 메모 초기화",
    "user.profile_updated": "개인정보 수정",
    "equipment.created": "장비 등록",
    "equipment.imported": "장비 CSV 등록",
    "equipment.updated": "장비 수정",
    "notice.created": "공지 작성",
    "settings.updated": "설정 변경",
    "maintenance.cleanup": "보관정책 정리",
    "maintenance.semester_close": "학기 종료 데이터 정리"
  }[action] || action;
}

function auditDetailText(log) {
  const d = log.detail || {};
  const parts = [];
  if (d.loginId) parts.push(`ID ${d.loginId}`);
  if (d.ip || d.targetIp) parts.push(`IP ${d.ip || d.targetIp}`);
  if (d.device || d.targetDevice) parts.push(d.device || d.targetDevice);
  if (d.status) parts.push(`상태 ${d.status}`);
  if (d.type && typeLabel[d.type]) parts.push(typeLabel[d.type]);
  if (d.reason) parts.push(`사유 ${d.reason}`);
  if (d.revokedSessions !== undefined) parts.push(`세션 종료 ${d.revokedSessions}개`);
  if (d.targetUserId) parts.push(`대상 ${d.targetUserId}`);
  return parts.join(" · ") || "-";
}

function sessionUserText(session) {
  return [
    session.user?.name,
    session.user?.studentId,
    session.user?.email,
    session.userId
  ].filter(Boolean).join(" ");
}

function sessionSearchText(session) {
  return searchableText([
    session.id,
    session.userId,
    session.user,
    session.ip,
    session.device,
    session.userAgent,
    session.createdAt,
    session.expiresAt
  ]);
}

function sortedAdminSessions(sessions) {
  const sort = state.adminSessionSort || "createdAt";
  return [...sessions].sort((a, b) => {
    if (sort === "expiresAt") {
      return String(a.expiresAt || "").localeCompare(String(b.expiresAt || ""));
    }
    if (sort === "user") {
      return sessionUserText(a).localeCompare(sessionUserText(b), "ko");
    }
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
}

function logActionGroup(action = "") {
  if (action.startsWith("auth.") || action.startsWith("session.")) return "auth";
  if (action.startsWith("reservation.")) return "reservation";
  if (action.startsWith("user.")) return "user";
  if (action.startsWith("equipment.")) return "equipment";
  if (action.startsWith("lecture.")) return "lecture";
  if (action.startsWith("studio_report.")) return "studio_report";
  if (action.startsWith("notice.")) return "notice";
  if (action.startsWith("settings.") || action.startsWith("maintenance.")) return "settings";
  return "other";
}

function filteredSortedAdminLogs(logs) {
  const filter = state.adminLogActionFilter || "all";
  const direction = state.adminLogSort || "desc";
  return logs
    .filter((log) => filter === "all" || logActionGroup(log.action) === filter)
    .slice()
    .sort((a, b) => {
      const result = String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
      return direction === "asc" ? result : -result;
    });
}

function logSearchText(log) {
  return searchableText([
    log.id,
    log.action,
    auditActionLabel(log.action),
    log.actor,
    log.targetId,
    log.detail,
    auditDetailText(log),
    log.createdAt
  ]);
}

export function adminLogsView() {
  const rawSessions = state.adminSessions || [];
  const rawLogs = state.adminLogs || [];
  const sessionQuery = normalizeSearchText(state.adminSessionSearch).trim();
  const logQuery = normalizeSearchText(state.adminLogSearch).trim();
  const searchedSessions = rawSessions.filter((session) => !sessionQuery || sessionSearchText(session).includes(sessionQuery));
  const searchedLogs = rawLogs.filter((log) => !logQuery || logSearchText(log).includes(logQuery));
  const sessions = sortedAdminSessions(searchedSessions);
  const logs = filteredSortedAdminLogs(searchedLogs);
  const logFilters = [
    ["all", "전체"],
    ["auth", "로그인"],
    ["reservation", "예약"],
    ["user", "학생"],
    ["equipment", "기자재"],
    ["lecture", "특강"],
    ["studio_report", "보고서"],
    ["notice", "공지"],
    ["settings", "설정"]
  ];
  return `
    <section class="grid">
      <div class="card">
        <h2 class="card-title">현재 로그인 세션</h2>
        <div class="list-control-panel compact">
          ${searchField({ value: state.adminSessionSearch || "", placeholder: "사용자·IP·기기 검색", dataset: "data-admin-session-search", label: "세션 검색" })}
        </div>
        ${tabs([
          ["createdAt", "최근 로그인"],
          ["expiresAt", "만료 임박"],
          ["user", "사용자명"]
        ], { active: state.adminSessionSort, dataset: "admin-session-sort", ariaLabel: "세션 정렬" })}
        <div class="table-wrap embedded">
          <table>
            <thead><tr><th>사용자</th><th>IP</th><th>기기</th><th>로그인</th><th>만료</th><th>작업</th></tr></thead>
            <tbody>
              ${sessions.length ? sessions.map((session) => `
                <tr>
                  <td><strong>${escapeHtml(session.user?.name || "-")}</strong><br><span class="muted">${escapeHtml(session.user?.studentId || session.user?.email || session.userId || "")}</span></td>
                  <td>${escapeHtml(session.ip || "-")}</td>
                  <td><strong>${escapeHtml(session.device || "-")}</strong><br><span class="muted">${escapeHtml(session.userAgent || "-")}</span></td>
                  <td>${formatDateTime(session.createdAt)}</td>
                  <td>${formatDateTime(session.expiresAt)}</td>
                  <td>${iconOnlyAction("로그아웃", "logOut", `data-session-revoke="${session.id}"`)}</td>
                </tr>
              `).join("") : `<tr><td colspan="6" class="empty">${sessionQuery ? "검색 결과가 없습니다." : "현재 로그인 세션이 없습니다."}</td></tr>`}
            </tbody>
          </table>
        </div>
        <p class="card-helper-note">IP는 Cloudflare/브라우저 요청 기준입니다. 같은 기기라도 브라우저나 네트워크가 바뀌면 별도 세션으로 보일 수 있습니다.</p>
      </div>
      <div class="card">
        <h2 class="card-title">활동 로그</h2>
        <div class="list-control-panel compact">
          ${searchField({ value: state.adminLogSearch || "", placeholder: "작업·사용자·대상·상세 검색", dataset: "data-admin-log-search", label: "로그 검색" })}
        </div>
        ${tabs(logFilters.map(([key, label]) => ({
          key,
          label,
          count: key === "all" ? searchedLogs.length : searchedLogs.filter((log) => logActionGroup(log.action) === key).length
        })), { active: state.adminLogActionFilter || "all", dataset: "admin-log-action-filter", ariaLabel: "활동 로그 작업 필터" })}
        ${tabs([["desc", "최신순"], ["asc", "오래된순"]], { active: state.adminLogSort || "desc", dataset: "admin-log-sort", ariaLabel: "활동 로그 정렬" })}
        <div class="table-wrap embedded">
          <table>
            <thead><tr><th>시간</th><th>작업</th><th>사용자</th><th>대상</th><th>상세</th></tr></thead>
            <tbody>
              ${logs.length ? logs.map((log) => `
                <tr>
                  <td>${formatDateTime(log.createdAt)}</td>
                  <td><strong>${escapeHtml(auditActionLabel(log.action))}</strong></td>
                  <td>${escapeHtml(log.actor?.name || "-")}<br><span class="muted">${escapeHtml(log.actor?.studentId || log.actor?.email || "")}</span></td>
                  <td>${escapeHtml(log.targetId || "-")}</td>
                  <td>${escapeHtml(auditDetailText(log))}</td>
                </tr>
              `).join("") : `<tr><td colspan="5" class="empty">${logQuery ? "검색 결과가 없습니다." : "기록된 로그가 없습니다."}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
      ${adminGuide("로그/세션 사용 가이드", "학생과 관리자의 로그인 위치, 로그인 실패, 예약 생성/취소, 상태 변경 기록을 확인합니다. 세션은 최근 로그인 또는 만료 임박 순으로 보고, 로그는 작업 분류와 최신/오래된순을 함께 사용하세요.")}
    </section>
  `;
}

export function adminSettingsView() {
  const settings = state.bootstrap.settings;
  const blockedQuery = normalizeSearchText(state.adminBlockedScheduleSearch).trim();
  const blockedSchedules = settings.blockedSchedules || [];
  const filteredBlockedSchedules = blockedSchedules.filter((item) => !blockedQuery || searchableText([
    typeLabel[item.type] || item.type,
    weekdayLabel[item.day] || item.day,
    item.start,
    item.end,
    item.from,
    item.to,
    item.target
  ]).includes(blockedQuery));
  return `
    <section class="grid">
      ${adminBlockedCalendar(blockedSchedules)}
      <div class="card admin-settings-card">
        <h2 class="card-title">수업/학기 차단 일정</h2>
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
          <button class="button primary" type="submit">${icon("plus")}차단 일정 추가</button>
        </form>
        <p class="card-helper-note">예: 월요일 10:30-17:00 Studio A/B 사용 불가. 등록 후 아래 캘린더에 표시됩니다.</p>
        <div class="list-control-panel compact">
          ${searchField({ value: state.adminBlockedScheduleSearch || "", placeholder: "시설·요일·시간·공간 검색", dataset: "data-admin-blocked-search", label: "차단 일정 검색" })}
        </div>
        ${blockedQuery ? `<p class="muted">"${escapeHtml(state.adminBlockedScheduleSearch)}" 검색 결과 ${filteredBlockedSchedules.length}건</p>` : ""}
        ${blockedScheduleList(filteredBlockedSchedules, { emptyTitle: blockedQuery ? "검색 결과가 없습니다." : "등록된 차단 일정이 없습니다." })}
      </div>
      <div class="card admin-settings-card admin-settings-card-primary">
        <h2 class="card-title">운영 설정</h2>
        <form data-form="settings-save">
          <div class="field"><label>출력비 계좌 안내</label><input class="input" name="printBankAccount" value="${escapeHtml(settings.printBankAccount)}" /></div>
          <div class="field"><label>출력실 구글 드라이브 URL</label><input class="input" name="googleDriveUrl" type="url" inputmode="url" value="${escapeHtml(settings.googleDriveUrl || "")}" placeholder="https://drive.google.com/..." /></div>
          <div class="field"><label>암실 최대 인원</label><input class="input" name="darkroomCapacity" type="number" min="1" value="${settings.darkroomCapacity}" /></div>
          <div class="field"><label>출력실 시작</label><input class="input" name="printAvailableStart" value="${escapeHtml(settings.printAvailableStart)}" /></div>
          <div class="field"><label>출력실 종료</label><input class="input" name="printAvailableEnd" value="${escapeHtml(settings.printAvailableEnd)}" /></div>
          <div class="grid two control-grid">
            <div class="field"><label>출력 업로드 시작일</label><input class="input" name="printUploadStartDate" type="date" value="${escapeHtml(settings.printUploadStartDate || "")}" /></div>
            <div class="field"><label>출력 업로드 종료일</label><input class="input" name="printUploadEndDate" type="date" value="${escapeHtml(settings.printUploadEndDate || "")}" /></div>
          </div>
          <div class="field"><label>고가장비 카테고리</label><input class="input" name="equipmentHighValueCategories" value="${escapeHtml((settings.equipmentHighValueCategories || ["Body", "Lens"]).join(", "))}" placeholder="Body, Lens" /></div>
          <div class="field"><label>카메라 가방 키워드</label><input class="input" name="equipmentBagKeywords" value="${escapeHtml((settings.equipmentBagKeywords || ["펠리컨", "Pelican"]).join(", "))}" placeholder="펠리컨, Pelican" /></div>
          <div class="field"><label>카메라 가방 확인 문구</label><input class="input" name="equipmentCameraBagNotice" value="${escapeHtml(settings.equipmentCameraBagNotice || "고가장비(카메라)를 선택 시 카메라 가방을 지참하겠습니다")}" /></div>
          <button class="button primary" type="submit">${icon("check")}저장</button>
        </form>
      </div>
      ${adminNotificationSettingsCard()}
      <div class="card admin-settings-card admin-settings-note-card"><h2 class="card-title">Slack</h2><p class="muted">Webhook URL은 코드가 아니라 서버 환경변수 SLACK_WEBHOOK_URL에 저장합니다.</p></div>
      <div class="card admin-settings-card admin-settings-danger-card">
        <h2 class="card-title">보안 / 데이터 관리</h2>
        <p class="muted">조교 교체 전에는 백업 JSON을 내려받으세요. 보관정책 정리는 오래된 예약 개인정보를 익명화하고 만료된 보고서 HTML과 세션을 삭제합니다.</p>
        <p class="muted"><strong>학기 종료 데이터 정리</strong>는 모든 예약과 연결된 보고서, 모든 로그인 세션을 삭제합니다. 이 작업은 되돌릴 수 없습니다.</p>
        <div class="button-row">
          <button class="button" data-action="admin-export">${icon("download")}백업 JSON</button>
          <button class="button danger" data-action="admin-cleanup">${icon("trash")}보관정책 정리</button>
          <button class="button danger" data-action="admin-semester-close">${icon("trash")}학기 종료 데이터 정리</button>
        </div>
      </div>
      ${adminGuide("설정 사용 가이드", "학기별 수업 시간, 출력실 시간, 암실 정원처럼 예약 규칙에 영향을 주는 값을 관리합니다. 차단 일정은 캘린더에 표시되어 조교가 학기 운영 상황을 빠르게 확인할 수 있습니다.")}
    </section>
  `;
}

export function blockedScheduleList(items, options = {}) {
  if (!items.length) return `<p class="empty">${escapeHtml(options.emptyTitle || "등록된 차단 일정이 없습니다.")}</p>`;
  return `
    <div class="blocked-list">
      ${items.map((item) => `
        <div class="blocked-item">
          <span class="tag blue">${typeLabel[item.type] || item.type}</span>
          <strong>${weekdayLabel[item.day] || item.day}요일 ${escapeHtml(item.start)}-${escapeHtml(item.end)}</strong>
          <span>${escapeHtml(item.from)} ~ ${escapeHtml(item.to)} · ${escapeHtml(item.target || "전체")}</span>
          ${iconOnlyAction("삭제", "trash", `data-blocked-remove="${item.id}"`)}
        </div>
      `).join("")}
    </div>
  `;
}

export function adminBlockedCalendar(items) {
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
        <div class="row-actions calendar-month-actions">
          <button class="button compact" type="button" data-calendar-month="${addMonths(monthKey, -1)}" aria-label="이전 달" title="이전 달">‹</button>
          <button class="button compact" type="button" data-calendar-month="${todayKey().slice(0, 7)}" aria-label="오늘" title="오늘">오늘</button>
          <button class="button compact" type="button" data-calendar-month="${addMonths(monthKey, 1)}" aria-label="다음 달" title="다음 달">›</button>
        </div>
      </div>
      <div class="calendar-weekdays">${["일", "월", "화", "수", "목", "금", "토"].map((item) => `<span>${item}</span>`).join("")}</div>
      <div class="calendar-grid-large">
        ${days.map((day) => `
          <button class="calendar-day ${day.currentMonth ? "" : "outside"} ${day.blocked.length ? "blocked" : ""}" type="button" data-admin-blocked-date="${day.key}" aria-label="${day.key} 차단 일정 입력">
            <span>${day.day}</span>
            ${day.blocked.slice(0, 2).map((item) => `<small>${typeLabel[item.type] || item.type} ${escapeHtml(item.start)}-${escapeHtml(item.end)}</small>`).join("")}
          </button>
        `).join("")}
      </div>
    </section>
  `;
}
