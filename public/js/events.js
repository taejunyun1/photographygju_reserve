import { state } from "./state.js?v=20260616-feat1";
import { api } from "./api.js?v=20260616-feat1";
import { loadAdminData, loadBootstrap, loadLectures, loadMyReservations } from "./data.js?v=20260616-feat1";
import {
  changePassword,
  downloadAdminBackup,
  downloadLectureCsv,
  login,
  logout,
  openReport,
  signup,
  submitReservation
} from "./actions.js?v=20260616-feat1";
import { render, toast } from "./renderer.js?v=20260616-feat1";
import {
  patchAdminEquipment,
  setAdminEquipmentSelection,
  setVisibleAdminEquipmentSelection,
  syncAdminEquipmentDom,
  syncAdminEquipmentSelectionDom
} from "./admin-equipment.js?v=20260616-feat1";
import {
  equipmentCategories,
  formData,
  parseCsv
} from "./utils.js?v=20260616-feat1";

function scrollToPageTop() {
  requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  });
}

function renderAtTop() {
  render();
  scrollToPageTop();
}

export function setupEventHandlers() {
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
        render();
        return;
      }
      if (target.dataset.action === "logout") await logout();
      if (target.dataset.equipmentCategory) {
        state.equipmentCategoryFilter = target.dataset.equipmentCategory;
        renderAtTop();
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
        renderAtTop();
        return;
      }
      if (target.dataset.reserveType) {
        state.reservationType = target.dataset.reserveType;
        renderAtTop();
        return;
      }
      if (target.dataset.action === "reserve-back") {
        state.reservationType = "";
        renderAtTop();
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
        await loadLectures();
        toast("특강 신청이 완료되었습니다.");
        render();
        return;
      }
      if (target.dataset.adminView) {
        if (target.dataset.adminReservationTab) state.adminReservationTab = target.dataset.adminReservationTab;
        state.adminView = target.dataset.adminView;
        renderAtTop();
        return;
      }
      if (target.dataset.adminReservationTab && !target.dataset.adminView) {
        state.adminReservationTab = target.dataset.adminReservationTab;
        renderAtTop();
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
      if (target.dataset.userWarn) {
        const reason = prompt("경고 사유를 입력하세요. (경고 2회 → 자동 1주일, 3회 → 자동 한 학기 제한)", "");
        if (reason === null) return;
        const result = await api(`/api/admin/users/${target.dataset.userWarn}/warning`, { method: "POST", body: { reason: reason.trim() } });
        await loadAdminData();
        if (result.autoBlock === "semester") {
          alert(`경고 ${result.user.warningCount}회 누적 → 자동 ‘한 학기’ 예약 제한이 적용되었습니다.`);
        } else if (result.autoBlock === "week1") {
          alert(`경고 ${result.user.warningCount}회 누적 → 자동 ‘1주일’ 예약 제한이 적용되었습니다.`);
        } else {
          toast(`경고를 부여했습니다. (누적 ${result.user.warningCount}회)`);
        }
        return;
      }
      if (target.dataset.userWarnReset) {
        if (!confirm("이 학생의 경고 누적과 예약 제한을 모두 해제할까요?")) return;
        await api(`/api/admin/users/${target.dataset.userWarnReset}/warning`, { method: "POST", body: { reset: true } });
        await loadAdminData();
        toast("경고를 초기화했습니다.");
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
      render();
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
    if (["period", "rentalTime", "returnTime"].includes(target.name) && target.closest("[data-type=\"equipment\"]")) {
      if (target.name === "period") state.selectedEquipmentPeriod = target.value;
      if (target.name === "rentalTime") state.selectedEquipmentRentalTime = target.value;
      if (target.name === "returnTime") state.selectedEquipmentReturnTime = target.value;
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
      render();
    }
  });

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (target.dataset && target.dataset.adminReservationSearch !== undefined) {
      state.adminReservationSearch = target.value;
      const caret = target.selectionStart;
      render();
      const next = document.querySelector("[data-admin-reservation-search]");
      if (next) {
        next.focus();
        try { next.setSelectionRange(caret, caret); } catch (error) { /* noop */ }
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
}
