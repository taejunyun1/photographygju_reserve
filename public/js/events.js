import { state } from "./state.js?v=20260626-watch-release";
import { api } from "./api.js?v=20260626-watch-release";
import { loadAdminData, loadBootstrap, loadLectures, loadMyReservations } from "./data.js?v=20260626-watch-release";
import {
  changePassword,
  deleteAccount,
  downloadAdminBackup,
  downloadLectureCsv,
  login,
  logout,
  openReport,
  signup,
  submitReservation
} from "./actions.js?v=20260626-watch-release";
import {
  disableNativeReservationNotifications,
  enableNativeReservationNotifications,
  syncNativeReservationNotifications
} from "./native-notifications.js?v=20260626-watch-release";
import { render, toast } from "./renderer.js?v=20260626-watch-release";
import {
  patchAdminEquipment,
  setAdminEquipmentSelection,
  setVisibleAdminEquipmentSelection,
  syncAdminEquipmentDom,
  syncAdminEquipmentSelectionDom
} from "./admin-equipment.js?v=20260626-watch-release";
import {
  equipmentCategories,
  equipmentRangeBlocked,
  formData,
  isReservationDateClosed,
  normalizeUnicodeText,
  parseCsv,
  printDateOutsideUploadWindow,
  printSelectionBlocked,
  printSelectionConflicts,
  timeToMinutes
} from "./utils.js?v=20260626-watch-release";

const EQUIPMENT_SCROLL_INTERACTION_SELECTOR = [
  "[data-equipment-category]",
  "[data-equipment-remove]",
  "[data-equipment-selection-toggle]",
  "[data-equipment-recommend-toggle]",
  "[data-equipment-recommend-add]",
  ".equipment-choice",
  "input[name=\"equipmentItemIds\"]"
].join(",");

let lastEquipmentInteractionScrollState = null;

function scrollToPageTop() {
  requestAnimationFrame(() => {
    for (const target of document.querySelectorAll(".student-shell, .admin-main, .auth-shell")) {
      target.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
      target.scrollTop = 0;
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  });
}

function renderAtTop() {
  render();
  scrollToPageTop();
}

function captureScrollState() {
  return {
    windowX: window.scrollX || 0,
    windowY: window.scrollY || 0,
    targets: [...document.querySelectorAll(".student-shell, .admin-main, .auth-shell")].map((target) => ({
      className: [...target.classList].join("."),
      scrollTop: target.scrollTop || 0,
      scrollLeft: target.scrollLeft || 0
    }))
  };
}

function restoreScrollState(snapshot) {
  const restore = () => {
    for (const item of snapshot.targets || []) {
      if (!item.className) continue;
      const target = document.querySelector(`.${item.className}`);
      if (!target) continue;
      target.scrollTo?.({ top: item.scrollTop, left: item.scrollLeft, behavior: "auto" });
      target.scrollTop = item.scrollTop;
      target.scrollLeft = item.scrollLeft;
    }
    window.scrollTo({ top: snapshot.windowY || 0, left: snapshot.windowX || 0, behavior: "auto" });
    document.documentElement.scrollTop = snapshot.windowY || 0;
    document.body.scrollTop = snapshot.windowY || 0;
  };
  requestAnimationFrame(() => {
    restore();
    requestAnimationFrame(restore);
  });
  setTimeout(restore, 0);
  setTimeout(restore, 80);
}

function renderPreservingScroll() {
  const scrollState = lastEquipmentInteractionScrollState || captureScrollState();
  lastEquipmentInteractionScrollState = null;
  render();
  restoreScrollState(scrollState);
}

function captureEquipmentInteractionScroll(event) {
  if (!(event.target instanceof Element)) return;
  if (!event.target.closest(EQUIPMENT_SCROLL_INTERACTION_SELECTOR)) return;
  lastEquipmentInteractionScrollState = captureScrollState();
}

function resetAdminPage(key) {
  state[key] = { ...(state[key] || {}), page: 1 };
}

function setAdminPage(key, page) {
  state[key] = { ...(state[key] || {}), page: Math.max(1, Number(page) || 1) };
}

function setReservationFlowStep(type, step) {
  if (!state.reservationFlowStep) state.reservationFlowStep = { equipment: "date", studio: "date", darkroom: "date", print: "date" };
  state.reservationFlowStep[type] = step;
}

function goReservationFlowStep(type, step) {
  setReservationFlowStep(type, step);
  renderAtTop();
}

function checkedValues(name) {
  return [...document.querySelectorAll(`[name="${name}"]:checked`)].map((item) => item.value);
}

function applyPrintTimeSlot(value) {
  const [startTime = "", endTime = ""] = String(value || "").split("|");
  state.selectedPrintStartTime = startTime;
  state.selectedPrintEndTime = endTime;
}

function syncReservationDraftFromDom(type) {
  if (type === "darkroom") {
    state.selectedDarkroomSlots = checkedValues("darkroomSlots");
    state.selectedDarkroomProcessTypes = checkedValues("processTypes");
    const participantCount = document.querySelector("[name=\"participantCount\"]")?.value;
    if (participantCount) state.selectedDarkroomParticipantCount = participantCount;
    state.selectedDarkroomChemicals = Object.fromEntries((state.bootstrap?.darkroomChemicals || []).map((chem) => [
      chem.id,
      document.querySelector(`[name="chem-${chem.id}"]`)?.value || ""
    ]));
  }
  if (type === "print") {
    const selectedPrintTimeSlot = document.querySelector("[name=\"printTimeSlot\"]:checked")?.value;
    if (selectedPrintTimeSlot) applyPrintTimeSlot(selectedPrintTimeSlot);
    state.selectedPrintTypes = checkedValues("printTypes");
    state.selectedPrintPapers = checkedValues("papers");
    state.selectedPrintSizes = checkedValues("sizes");
  }
}

function canAdvanceReservationFlow(type, nextStep) {
  syncReservationDraftFromDom(type);
  const selectedDate = state.selectedDates[type] || "";
  if (!selectedDate) {
    toast("먼저 예약 날짜를 선택하세요.");
    return false;
  }
  if (isReservationDateClosed(type, selectedDate)) {
    toast("선택한 날짜는 예약 마감되어 다음 단계로 이동할 수 없습니다.");
    return false;
  }
  if (type === "equipment" && nextStep === "select" && equipmentRangeBlocked(selectedDate, state.selectedEquipmentPeriod).length) {
    toast("선택한 대여 기간에 차단 일정이 포함되어 있습니다.");
    return false;
  }
  if (type === "equipment" && nextStep === "details" && !state.selectedEquipmentItemIds.length) {
    toast("기자재를 1개 이상 선택하세요.");
    return false;
  }
  if (type === "studio" && nextStep === "schedule" && !state.selectedStudioSpace) {
    toast("스튜디오 공간을 선택하세요.");
    return false;
  }
  if (type === "studio" && nextStep === "details" && !state.selectedStudioSlots.length) {
    toast("사용 시간을 1개 이상 선택하세요.");
    return false;
  }
  if (type === "darkroom" && nextStep === "process" && !state.selectedDarkroomSlots.length) {
    toast("암실 사용 시간을 1개 이상 선택하세요.");
    return false;
  }
  if (type === "darkroom" && nextStep === "details" && !state.selectedDarkroomProcessTypes.length) {
    toast("암실 작업 유형을 선택하세요.");
    return false;
  }
  if (type === "print" && nextStep === "options") {
    if (printDateOutsideUploadWindow(selectedDate)) {
      toast("출력 업로드 가능 기간 밖의 날짜입니다.");
      return false;
    }
    if (!state.selectedPrintStartTime || !state.selectedPrintEndTime || timeToMinutes(state.selectedPrintStartTime) >= timeToMinutes(state.selectedPrintEndTime)) {
      toast("출력실 사용 시작/종료 시간을 확인하세요.");
      return false;
    }
    if (printSelectionBlocked(selectedDate, state.selectedPrintStartTime, state.selectedPrintEndTime).length) {
      toast("선택한 출력실 시간이 차단 일정과 겹칩니다.");
      return false;
    }
    if (printSelectionConflicts(selectedDate, state.selectedPrintStartTime, state.selectedPrintEndTime).length) {
      toast("선택한 출력실 시간대는 예약 가능 인원이 가득 찼습니다.");
      return false;
    }
  }
  if (type === "print" && nextStep === "details" && (!state.selectedPrintTypes.length || !state.selectedPrintPapers.length || !state.selectedPrintSizes.length)) {
    toast("출력 종류, 용지, 사이즈를 각각 1개 이상 선택하세요.");
    return false;
  }
  return true;
}

export function setupEventHandlers() {
  document.addEventListener("pointerdown", captureEquipmentInteractionScroll, { capture: true, passive: true });

  document.addEventListener("click", async (event) => {
    const target = event.target.closest("button, a");
    if (!target) return;
    try {
      if (target.dataset.authMode) {
        state.authMode = target.dataset.authMode;
        renderAtTop();
        return;
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
      if (target.dataset.pastReservationsToggle !== undefined) {
        state.pastReservationsOpen = !state.pastReservationsOpen;
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
        if (type === "studio") {
          state.selectedStudioSpace = "";
          state.selectedStudioSlots = [];
        }
        if (type === "equipment") {
          state.equipmentSelectionSheetOpen = false;
          state.equipmentRecommendationOpen = false;
        }
        if (type === "darkroom") {
          state.selectedDarkroomSlots = [];
          state.selectedDarkroomProcessTypes = [];
          state.selectedDarkroomParticipantCount = "1";
          state.selectedDarkroomChemicals = {};
        }
        if (type === "print") {
          state.selectedPrintStartTime = "";
          state.selectedPrintEndTime = "";
          state.selectedPrintTypes = [];
          state.selectedPrintPapers = [];
          state.selectedPrintSizes = [];
        }
        if (["equipment", "studio", "darkroom", "print"].includes(type)) {
          setReservationFlowStep(type, type === "studio" ? "select" : "schedule");
          renderAtTop();
          return;
        }
        render();
        return;
      }
      if (target.dataset.action === "logout") await logout();
      if (target.dataset.nativeNotifications === "enable") {
        toast("알림 권한을 확인합니다.");
        await enableNativeReservationNotifications();
        toast("예약 알림을 켰습니다.");
        render();
        return;
      }
      if (target.dataset.nativeNotifications === "sync") {
        const result = await syncNativeReservationNotifications({ force: true });
        toast(`예약 알림 ${result.scheduled || 0}개를 동기화했습니다.`);
        render();
        return;
      }
      if (target.dataset.nativeNotifications === "disable") {
        await disableNativeReservationNotifications();
        toast("예약 알림을 껐습니다.");
        render();
        return;
      }
      if (target.dataset.equipmentCategory) {
        state.equipmentCategoryFilter = target.dataset.equipmentCategory;
        renderPreservingScroll();
        return;
      }
      if (target.dataset.equipmentRemove) {
        state.selectedEquipmentItemIds = state.selectedEquipmentItemIds.filter((itemId) => itemId !== target.dataset.equipmentRemove);
        if (!state.selectedEquipmentItemIds.length) {
          state.equipmentSelectionSheetOpen = false;
          state.equipmentRecommendationOpen = false;
        }
        renderPreservingScroll();
        return;
      }
      if (target.dataset.equipmentSelectionToggle !== undefined) {
        state.equipmentSelectionSheetOpen = !state.equipmentSelectionSheetOpen;
        if (!state.equipmentSelectionSheetOpen) state.equipmentRecommendationOpen = false;
        renderPreservingScroll();
        return;
      }
      if (target.dataset.equipmentRecommendToggle !== undefined) {
        state.equipmentRecommendationOpen = !state.equipmentRecommendationOpen;
        renderPreservingScroll();
        return;
      }
      if (target.dataset.equipmentRecommendAdd) {
        if (!state.selectedEquipmentItemIds.includes(target.dataset.equipmentRecommendAdd)) {
          state.selectedEquipmentItemIds.push(target.dataset.equipmentRecommendAdd);
        }
        state.equipmentSelectionSheetOpen = true;
        state.equipmentRecommendationOpen = true;
        setReservationFlowStep("equipment", "select");
        renderPreservingScroll();
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
      if (target.dataset.action === "admin-export") {
        await downloadAdminBackup();
        toast("백업 JSON을 내려받았습니다.");
        return;
      }
      if (target.dataset.action === "admin-cleanup") {
        if (!confirm("만료된 세션을 삭제하고 오래된 개인정보/보고서 HTML을 정리할까요?")) return;
        const result = await api("/api/admin/maintenance/cleanup", { method: "POST" });
        await loadAdminData();
        toast(`정리 완료: 예약 익명화 ${result.anonymizedReservations}건, 보고서 HTML 삭제 ${result.deletedReportHtmlSnapshots}건, 세션 삭제 ${result.deletedExpiredSessions}건`);
        render();
        return;
      }
      if (target.dataset.studentView) {
        state.view = target.dataset.studentView;
        if (state.view === "mine") await loadMyReservations();
        if (state.view === "reports") await loadMyReservations();
        if (state.view === "lectures") await loadLectures();
        renderAtTop();
        return;
      }
      if (target.dataset.reserveShortcut) {
        state.view = "reserve";
        state.reservationType = target.dataset.reserveShortcut;
        if (state.reservationType === "equipment") {
          state.equipmentSelectionSheetOpen = false;
          state.equipmentRecommendationOpen = false;
        }
        if (state.reservationFlowStep?.[state.reservationType]) state.reservationFlowStep[state.reservationType] = "date";
        renderAtTop();
        return;
      }
      if (target.dataset.reserveType) {
        state.reservationType = target.dataset.reserveType;
        if (state.reservationType === "equipment") {
          state.equipmentSelectionSheetOpen = false;
          state.equipmentRecommendationOpen = false;
        }
        if (state.reservationFlowStep?.[state.reservationType]) state.reservationFlowStep[state.reservationType] = "date";
        renderAtTop();
        return;
      }
      if (target.dataset.action === "reserve-back") {
        state.reservationType = "";
        state.equipmentSelectionSheetOpen = false;
        state.equipmentRecommendationOpen = false;
        renderAtTop();
        return;
      }
      if (target.dataset.reserveStep) {
        const [type, step] = target.dataset.reserveStep.split(":");
        if (type && step) goReservationFlowStep(type, step);
        return;
      }
      if (target.dataset.reserveNext) {
        const [type, step] = target.dataset.reserveNext.split(":");
        if (type && step && canAdvanceReservationFlow(type, step)) goReservationFlowStep(type, step);
        return;
      }
      if (target.dataset.cancelRes) {
        if (!confirm("예약을 취소할까요?")) return;
        toast("예약 취소를 처리 중입니다.");
        const cancelled = await api(`/api/reservations/${target.dataset.cancelRes}/cancel`, { method: "POST", body: { reason: "학생 취소" } });
        state.myReservations = state.myReservations.map((reservation) => reservation.id === cancelled.id ? cancelled : reservation);
        if (state.bootstrap?.reservations) {
          state.bootstrap.reservations = state.bootstrap.reservations.filter((reservation) => reservation.id !== cancelled.id);
        }
        toast("예약이 취소되었습니다.");
        Promise.all([loadBootstrap(), loadMyReservations()])
          .then(() => render())
          .catch((error) => toast(`취소는 처리됐지만 최신 목록을 다시 불러오지 못했습니다: ${error.message}`));
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
        await Promise.all([loadLectures(), loadMyReservations()]);
        toast("특강 신청이 완료되었습니다.");
        render();
        return;
      }
      if (target.dataset.lectureCancel) {
        if (!confirm("특강 신청을 취소할까요?")) return;
        await api(`/api/lectures/${target.dataset.lectureCancel}/apply`, { method: "DELETE" });
        await Promise.all([loadLectures(), loadMyReservations()]);
        toast("특강 신청을 취소했습니다.");
        render();
        return;
      }
      if (target.dataset.lectureYearFilter) {
        state.lectureYearFilter = target.dataset.lectureYearFilter;
        render();
        return;
      }
      if (target.dataset.myReservationCategory) {
        state.myReservationCategory = target.dataset.myReservationCategory;
        state.pastReservationsOpen = false;
        render();
        return;
      }
      if (target.dataset.adminView) {
        if (target.dataset.adminReservationTab) {
          state.adminReservationTab = target.dataset.adminReservationTab;
          resetAdminPage("adminReservationsPage");
          await loadAdminData();
        }
        state.adminView = target.dataset.adminView;
        renderAtTop();
        return;
      }
      if (target.dataset.adminReservationTab && !target.dataset.adminView) {
        state.adminReservationTab = target.dataset.adminReservationTab;
        resetAdminPage("adminReservationsPage");
        await loadAdminData();
        renderAtTop();
        return;
      }
      if (target.dataset.adminEquipmentReservationStatus) {
        state.adminEquipmentReservationStatusFilter = target.dataset.adminEquipmentReservationStatus;
        resetAdminPage("adminReservationsPage");
        await loadAdminData();
        render();
        return;
      }
      if (target.dataset.adminUserStatusFilter) {
        state.adminUserStatusFilter = target.dataset.adminUserStatusFilter;
        resetAdminPage("adminUsersPage");
        await loadAdminData();
        render();
        return;
      }
      if (target.dataset.adminUsersPage) {
        setAdminPage("adminUsersPage", target.dataset.adminUsersPage);
        await loadAdminData();
        renderAtTop();
        return;
      }
      if (target.dataset.adminReservationsPage) {
        setAdminPage("adminReservationsPage", target.dataset.adminReservationsPage);
        await loadAdminData();
        renderAtTop();
        return;
      }
      if (target.dataset.adminReportsPage) {
        setAdminPage("adminReportsPage", target.dataset.adminReportsPage);
        await loadAdminData();
        renderAtTop();
        return;
      }
      if (target.dataset.adminSessionSort) {
        state.adminSessionSort = target.dataset.adminSessionSort;
        render();
        return;
      }
      if (target.dataset.adminLogActionFilter) {
        state.adminLogActionFilter = target.dataset.adminLogActionFilter;
        render();
        return;
      }
      if (target.dataset.adminLogSort) {
        state.adminLogSort = target.dataset.adminLogSort;
        render();
        return;
      }
      if (target.dataset.adminEquipmentTab) {
        state.adminEquipmentTab = target.dataset.adminEquipmentTab;
        renderAtTop();
        return;
      }
      if (target.dataset.adminEquipmentCategoryTab) {
        state.adminEquipmentCategoryTab = target.dataset.adminEquipmentCategoryTab;
        renderAtTop();
        return;
      }
      if (target.dataset.lectureUpdate) {
        const status = document.querySelector(`[data-lecture-status="${target.dataset.lectureUpdate}"]`)?.value || "모집중";
        await api(`/api/admin/lectures/${target.dataset.lectureUpdate}`, { method: "PATCH", body: { status } });
        await loadAdminData();
        toast("특강 상태를 저장했습니다.");
      }
      if (target.dataset.lectureEdit) {
        state.editingLectureId = target.dataset.lectureEdit;
        renderAtTop();
        return;
      }
      if (target.dataset.lectureEditCancel !== undefined) {
        state.editingLectureId = "";
        render();
        return;
      }
      if (target.dataset.lectureDelete) {
        const title = target.dataset.lectureTitle || "이 특강";
        if (!confirm(`'${title}' 특강을 삭제할까요?\n신청 내역도 함께 삭제되며 되돌릴 수 없습니다.`)) return;
        const result = await api(`/api/admin/lectures/${target.dataset.lectureDelete}`, { method: "DELETE" });
        if (state.editingLectureId === target.dataset.lectureDelete) state.editingLectureId = "";
        await loadAdminData();
        toast(`특강을 삭제했습니다.${result.removedApplications ? ` (신청 ${result.removedApplications}건 포함)` : ""}`);
        return;
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
      if (target.dataset.adminReportSort) {
        const field = target.dataset.adminReportSort;
        const defaultDirection = field === "name" ? "asc" : "desc";
        state.adminReportSort = {
          field,
          direction: state.adminReportSort.field === field
            ? (state.adminReportSort.direction === "asc" ? "desc" : "asc")
            : defaultDirection
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
      if (target.dataset.userWarn) {
        const reason = prompt("관리자용 경고 메모를 입력하세요. 학생 상태는 변경되지 않습니다.", "");
        if (reason === null) return;
        const result = await api(`/api/admin/users/${target.dataset.userWarn}/warning`, { method: "POST", body: { reason: reason.trim() } });
        await loadAdminData();
        toast(`경고 메모를 저장했습니다. (기록 ${result.user.warningCount}건)`);
        return;
      }
      if (target.dataset.userWarnReset) {
        if (!confirm("이 학생의 경고 메모 기록을 초기화할까요? 대여금지 상태는 변경되지 않습니다.")) return;
        await api(`/api/admin/users/${target.dataset.userWarnReset}/warning`, { method: "POST", body: { reset: true } });
        await loadAdminData();
        toast("경고 메모를 초기화했습니다.");
        return;
      }
      if (target.dataset.userDelete) {
        const name = target.dataset.userName || "이 학생";
        if (!confirm(`${name} 계정을 삭제할까요?\n해당 학생의 예약·보고서·경고 기록도 함께 삭제되며 되돌릴 수 없습니다.`)) return;
        const result = await api(`/api/admin/users/${target.dataset.userDelete}`, { method: "DELETE" });
        await loadBootstrap();
        await loadAdminData();
        toast(`학생을 삭제했습니다.${result.removedReservations ? ` (예약 ${result.removedReservations}건 포함)` : ""}`);
        return;
      }
      if (target.dataset.warningPopupClose !== undefined) {
        state.warningPopupDismissed = true;
        render();
        return;
      }
      if (target.dataset.sessionRevoke) {
        if (!confirm("이 기기를 원격 로그아웃할까요?")) return;
        await api(`/api/admin/sessions/${target.dataset.sessionRevoke}/revoke`, { method: "POST" });
        state.adminSessions = state.adminSessions.filter((session) => session.id !== target.dataset.sessionRevoke);
        await loadAdminData();
        toast("해당 기기를 로그아웃했습니다.");
        return;
      }
      if (target.dataset.resStatus) {
        toast("예약 상태를 처리 중입니다.");
        const updated = await api(`/api/admin/reservations/${target.dataset.resStatus}/status`, { method: "PATCH", body: { status: target.dataset.status } });
        state.adminReservations = state.adminReservations.map((reservation) => reservation.id === updated.id ? updated : reservation);
        toast("예약 상태를 변경했습니다.");
        Promise.all([loadBootstrap(), loadAdminData()])
          .then(() => render())
          .catch((error) => toast(`상태는 변경됐지만 최신 목록을 다시 불러오지 못했습니다: ${error.message}`));
      }
      if (target.dataset.equipmentStatusAction) {
        const itemId = target.dataset.equipmentStatusAction;
        const status = target.dataset.status;
        if (!status) return;
        target.disabled = true;
        let updated;
        try {
          updated = await patchAdminEquipment([itemId], { status });
        } finally {
          target.disabled = false;
        }
        syncAdminEquipmentDom(updated);
        toast("기자재 상태를 변경했습니다.");
        return;
      }
      if (target.dataset.equipmentBulkStatus) {
        const ids = [...state.selectedAdminEquipmentIds];
        if (!ids.length) {
          toast("선택된 기자재가 없습니다.");
          return;
        }
        const updated = await patchAdminEquipment(ids, { status: target.dataset.equipmentBulkStatus });
        syncAdminEquipmentDom(updated);
        toast(`선택 기자재 ${updated.length}개의 상태를 변경했습니다.`);
        return;
      }
      if (target.dataset.equipmentRemoveAdmin) {
        if (!confirm("이 기자재를 제거할까요? 목록에서 숨겨지고 학생 예약에서도 제외됩니다.")) return;
        const updated = await patchAdminEquipment([target.dataset.equipmentRemoveAdmin], { active: false });
        syncAdminEquipmentDom(updated);
        toast("기자재를 제거했습니다.");
        return;
      }
      if (target.dataset.equipmentBulkRemove !== undefined) {
        const ids = [...state.selectedAdminEquipmentIds];
        if (!ids.length) {
          toast("선택된 기자재가 없습니다.");
          return;
        }
        if (!confirm(`선택한 기자재 ${ids.length}개를 제거할까요? 목록에서 숨겨지고 학생 예약에서도 제외됩니다.`)) return;
        const updated = await patchAdminEquipment(ids, { active: false });
        syncAdminEquipmentDom(updated);
        toast(`선택 기자재 ${updated.length}개를 제거했습니다.`);
        return;
      }
    } catch (error) {
      toast(error.message);
    }
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (target.dataset.equipmentSelectAll !== undefined) {
      setVisibleAdminEquipmentSelection(target.checked);
      syncAdminEquipmentSelectionDom();
      return;
    }
    if (target.dataset.equipmentSelect) {
      setAdminEquipmentSelection(target.dataset.equipmentSelect, target.checked);
      syncAdminEquipmentSelectionDom();
      return;
    }
    if (target.name === "studioSpace") {
      state.selectedStudioSpace = target.value;
      state.selectedStudioSlots = [];
      setReservationFlowStep("studio", "schedule");
      renderAtTop();
      return;
    }
    if (target.name === "studioSlots") {
      if (target.checked && !state.selectedStudioSlots.includes(target.value)) {
        state.selectedStudioSlots.push(target.value);
      }
      if (!target.checked) {
        state.selectedStudioSlots = state.selectedStudioSlots.filter((slot) => slot !== target.value);
      }
      render();
      return;
    }
    if (target.name === "darkroomSlots") {
      if (target.checked && !state.selectedDarkroomSlots.includes(target.value)) {
        state.selectedDarkroomSlots.push(target.value);
      }
      if (!target.checked) {
        state.selectedDarkroomSlots = state.selectedDarkroomSlots.filter((slot) => slot !== target.value);
      }
      render();
      return;
    }
    if (target.name === "processTypes") {
      if (target.checked && !state.selectedDarkroomProcessTypes.includes(target.value)) {
        state.selectedDarkroomProcessTypes.push(target.value);
      }
      if (!target.checked) {
        state.selectedDarkroomProcessTypes = state.selectedDarkroomProcessTypes.filter((item) => item !== target.value);
      }
      render();
      return;
    }
    if (target.name === "participantCount") {
      state.selectedDarkroomParticipantCount = target.value;
      return;
    }
    if (target.name?.startsWith("chem-")) {
      state.selectedDarkroomChemicals = {
        ...state.selectedDarkroomChemicals,
        [target.name.replace("chem-", "")]: target.value
      };
      return;
    }
    if (target.name === "printTimeSlot") {
      if (target.checked) {
        applyPrintTimeSlot(target.value);
      } else if (target.value === `${state.selectedPrintStartTime}|${state.selectedPrintEndTime}`) {
        state.selectedPrintStartTime = "";
        state.selectedPrintEndTime = "";
      }
      render();
      return;
    }
    if (target.name === "printTypes") {
      if (target.checked && !state.selectedPrintTypes.includes(target.value)) state.selectedPrintTypes.push(target.value);
      if (!target.checked) state.selectedPrintTypes = state.selectedPrintTypes.filter((item) => item !== target.value);
      render();
      return;
    }
    if (target.name === "papers") {
      if (target.checked && !state.selectedPrintPapers.includes(target.value)) state.selectedPrintPapers.push(target.value);
      if (!target.checked) state.selectedPrintPapers = state.selectedPrintPapers.filter((item) => item !== target.value);
      render();
      return;
    }
    if (target.name === "sizes") {
      if (target.checked && !state.selectedPrintSizes.includes(target.value)) state.selectedPrintSizes.push(target.value);
      if (!target.checked) state.selectedPrintSizes = state.selectedPrintSizes.filter((item) => item !== target.value);
      render();
      return;
    }
    if (["period", "rentalTime", "returnTime"].includes(target.name) && target.closest("[data-type=\"equipment\"]")) {
      // 대여/반납 시간은 가용성에 영향이 없으므로 상태만 저장하고 재렌더하지 않는다(입력 끊김 방지).
      if (target.name === "rentalTime") { state.selectedEquipmentRentalTime = target.value; return; }
      if (target.name === "returnTime") { state.selectedEquipmentReturnTime = target.value; return; }
      state.selectedEquipmentPeriod = target.value; // 기간 변경은 가용 장비가 달라지므로 재렌더
      state.equipmentSelectionSheetOpen = false;
      state.equipmentRecommendationOpen = false;
      setReservationFlowStep("equipment", "schedule");
      render();
      return;
    }
    if (target.name === "equipmentItemIds") {
      if (target.checked && !state.selectedEquipmentItemIds.includes(target.value)) {
        state.selectedEquipmentItemIds.push(target.value);
      }
      if (!target.checked) {
        state.selectedEquipmentItemIds = state.selectedEquipmentItemIds.filter((itemId) => itemId !== target.value);
      }
      if (!state.selectedEquipmentItemIds.length) {
        state.equipmentSelectionSheetOpen = false;
        state.equipmentRecommendationOpen = false;
      }
      renderPreservingScroll();
    }
  });

  function rerenderSearch(selector, { restoreFocus = true } = {}) {
    searchRenderInProgress = true;
    try {
      render();
      const next = document.querySelector(selector);
      if (restoreFocus && next) {
        next.focus();
        const end = next.value.length;
        try { next.setSelectionRange(end, end); } catch (error) { /* noop */ }
      }
    } finally {
      setTimeout(() => { searchRenderInProgress = false; }, 0);
    }
  }

  const searchBindings = [
    ["myReservationSearch", "myReservationSearch", "[data-my-reservation-search]"],
    ["reportSearch", "reportSearch", "[data-report-search]"],
    ["noticeSearch", "noticeSearch", "[data-notice-search]"],
    ["equipmentSearch", "equipmentSearch", "[data-equipment-search]"],
    ["lectureSearch", "lectureSearch", "[data-lecture-search]"],
    ["adminUserSearch", "adminUserSearch", "[data-admin-user-search]"],
    ["adminReservationSearch", "adminReservationSearch", "[data-admin-reservation-search]"],
    ["adminEquipmentSearch", "adminEquipmentSearch", "[data-admin-equipment-search]"],
    ["adminReportSearch", "adminReportSearch", "[data-admin-report-search]"],
    ["adminLectureSearch", "adminLectureSearch", "[data-admin-lecture-search]"],
    ["adminNoticeSearch", "adminNoticeSearch", "[data-admin-notice-search]"],
    ["adminSessionSearch", "adminSessionSearch", "[data-admin-session-search]"],
    ["adminLogSearch", "adminLogSearch", "[data-admin-log-search]"],
    ["adminBlockedSearch", "adminBlockedScheduleSearch", "[data-admin-blocked-search]"]
  ].map(([datasetKey, stateKey, selector]) => ({ datasetKey, stateKey, selector }));
  const adminServerSearchStateKeys = new Set(["adminUserSearch", "adminReservationSearch", "adminReportSearch"]);

  function searchBindingForTarget(target) {
    if (!target.dataset) return null;
    return searchBindings.find((binding) => target.dataset[binding.datasetKey] !== undefined) || null;
  }

  let activeSearchComposition = false;
  let activeSearchSelector = "";
  let searchRenderTimer = null;
  let searchRenderInProgress = false;
  const hangulSearchPattern = /[가-힣ㄱ-ㅎㅏ-ㅣ\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\ud7b0-\ud7ff]/;

  function clearSearchRenderTimer() {
    if (searchRenderTimer) {
      clearTimeout(searchRenderTimer);
      searchRenderTimer = null;
    }
  }

  function normalizedSearchInputValue(target, { preserveComposition = false } = {}) {
    const value = String(target?.value || "");
    return preserveComposition ? value : normalizeUnicodeText(value);
  }

  function hasHangulSearchInput(target) {
    return hangulSearchPattern.test(String(target?.value || ""));
  }

  function markSearchComposition(target, binding) {
    activeSearchComposition = true;
    activeSearchSelector = binding.selector;
    target.dataset.searchComposing = "true";
    clearSearchRenderTimer();
  }

  function unmarkSearchComposition(target) {
    activeSearchComposition = false;
    activeSearchSelector = "";
    if (target?.dataset) delete target.dataset.searchComposing;
  }

  function isSearchCompositionEvent(event, target) {
    const inputType = String(event.inputType || "");
    return Boolean(
      event.isComposing ||
      target.dataset.searchComposing === "true" ||
      (activeSearchComposition && (!activeSearchSelector || document.querySelector(activeSearchSelector) === target)) ||
      inputType.toLowerCase().includes("composition")
    );
  }

  function scheduleSearchRender(selector, delay = 120, options = {}) {
    clearSearchRenderTimer();
    searchRenderTimer = setTimeout(() => {
      searchRenderTimer = null;
      rerenderSearch(selector, options);
    }, delay);
  }

  function resetAdminSearchPage(stateKey) {
    if (stateKey === "adminUserSearch") resetAdminPage("adminUsersPage");
    if (stateKey === "adminReservationSearch") resetAdminPage("adminReservationsPage");
    if (stateKey === "adminReportSearch") resetAdminPage("adminReportsPage");
  }

  async function commitSearchInput(target, binding, { restoreFocus = true } = {}) {
    unmarkSearchComposition(target);
    const normalized = normalizedSearchInputValue(target);
    state[binding.stateKey] = normalized;
    if (target && target.value !== normalized) target.value = normalized;
    clearSearchRenderTimer();
    if (adminServerSearchStateKeys.has(binding.stateKey)) {
      resetAdminSearchPage(binding.stateKey);
      await loadAdminData();
      rerenderSearch(binding.selector, { restoreFocus });
      return;
    }
    rerenderSearch(binding.selector, { restoreFocus });
  }

  document.addEventListener("beforeinput", (event) => {
    const target = event.target;
    const binding = searchBindingForTarget(target);
    if (!binding) return;
    if (event.isComposing || String(event.inputType || "").toLowerCase().includes("composition")) {
      markSearchComposition(target, binding);
    }
  });

  document.addEventListener("compositionstart", (event) => {
    const target = event.target;
    const binding = searchBindingForTarget(target);
    if (!binding) return;
    markSearchComposition(target, binding);
  });

  document.addEventListener("input", (event) => {
    const target = event.target;
    const binding = searchBindingForTarget(target);
    if (!binding) return;
    const composing = isSearchCompositionEvent(event, target);
    state[binding.stateKey] = normalizedSearchInputValue(target, { preserveComposition: composing });
    // 한글 IME는 iOS/WKWebView에서 isComposing이 누락되는 경우가 있다.
    // 한글 입력값이 있으면 입력 중 전체 렌더를 막고, Enter/완료/포커스 아웃에서만 검색 결과를 갱신한다.
    if (composing || hasHangulSearchInput(target)) return;
    scheduleSearchRender(binding.selector);
  });

  document.addEventListener("compositionend", (event) => {
    const target = event.target;
    const binding = searchBindingForTarget(target);
    if (!binding) return;
    unmarkSearchComposition(target);
    state[binding.stateKey] = normalizedSearchInputValue(target);
    if (!hasHangulSearchInput(target)) scheduleSearchRender(binding.selector, 0);
  });

  document.addEventListener("keydown", async (event) => {
    const target = event.target;
    const binding = searchBindingForTarget(target);
    if (!binding) return;
    if (event.key === "Enter") {
      event.preventDefault();
      await commitSearchInput(target, binding);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      target.value = "";
      await commitSearchInput(target, binding);
    }
  });

  document.addEventListener("focusout", async (event) => {
    const target = event.target;
    const binding = searchBindingForTarget(target);
    if (!binding) return;
    if (searchRenderInProgress) return;
    await commitSearchInput(target, binding, { restoreFocus: false });
  });

  document.addEventListener("change", async (event) => {
    const target = event.target;
    if (target.dataset && target.dataset.userLimitDuration !== undefined) {
      const userId = target.dataset.userLimitDuration;
      const limitDuration = target.value;
      if (!limitDuration) return;
      const body = limitDuration === "unblock"
        ? { approvalStatus: "approved" }
        : { approvalStatus: "blocked", limitDuration };
      try {
        await api(`/api/admin/users/${userId}/approval`, {
          method: "PATCH",
          body
        });
        await loadAdminData();
        toast(limitDuration === "unblock" ? "대여금지를 해제했습니다." : "대여금지를 적용했습니다.");
        render();
      } catch (error) {
        toast(error.message || "대여금지 설정 변경에 실패했습니다.");
        await loadAdminData();
        render();
      }
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
      if (form.dataset.form === "account-delete") {
        await deleteAccount(form);
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
        await api("/api/admin/lectures", { method: "POST", body: data });
        form.reset();
        await loadAdminData();
        toast("특강을 등록했습니다.");
      }
      if (form.dataset.form === "lecture-edit") {
        const data = formData(form);
        data.capacity = Number(data.capacity || 0);
        await api(`/api/admin/lectures/${form.dataset.lectureId}`, { method: "PATCH", body: data });
        state.editingLectureId = "";
        await loadAdminData();
        toast("특강을 수정했습니다.");
        render();
        return;
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
        data.equipmentHighValueCategories = String(data.equipmentHighValueCategories || "").split(",").map((item) => item.trim()).filter(Boolean);
        data.equipmentBagKeywords = String(data.equipmentBagKeywords || "").split(",").map((item) => item.trim()).filter(Boolean);
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
}
