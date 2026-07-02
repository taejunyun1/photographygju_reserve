import { state } from "../state.js?v=20260702-admin-icon-header";
import { api } from "../api.js?v=20260702-admin-icon-header";
import { loadBootstrap, loadLectures, loadMyReservations } from "../data.js?v=20260702-admin-icon-header";
import { logout, openReport } from "../actions.js?v=20260702-admin-icon-header";
import {
  disableNativeReservationNotifications,
  enableNativeReservationNotifications,
  syncNativeReservationNotifications
} from "../native-notifications.js?v=20260702-admin-icon-header";
import { render, toast } from "../renderer.js?v=20260702-admin-icon-header";
import {
  renderAtTop,
  renderPreservingScroll,
  setReservationFlowStep,
  goReservationFlowStep,
  canAdvanceReservationFlow
} from "./shared.js?v=20260702-admin-icon-header";

export function setupStudentFlowClickHandlers() {
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
          renderPreservingScroll();
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
      if (target.dataset.studentView) {
        state.view = target.dataset.studentView;
        if (state.view === "mine") await loadMyReservations();
        if (state.view === "reports") await loadMyReservations();
        if (state.view === "lectures") await loadLectures();
        renderPreservingScroll();
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
        renderPreservingScroll();
        return;
      }
      if (target.dataset.reserveType) {
        state.reservationType = target.dataset.reserveType;
        if (state.reservationType === "equipment") {
          state.equipmentSelectionSheetOpen = false;
          state.equipmentRecommendationOpen = false;
        }
        if (state.reservationFlowStep?.[state.reservationType]) state.reservationFlowStep[state.reservationType] = "date";
        renderPreservingScroll();
        return;
      }
      if (target.dataset.action === "reserve-back") {
        state.reservationType = "";
        state.equipmentSelectionSheetOpen = false;
        state.equipmentRecommendationOpen = false;
        renderPreservingScroll();
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
        renderPreservingScroll();
        return;
      }
    } catch (error) {
      toast(error.message);
    }
  });
}
