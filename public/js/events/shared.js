import { state } from "../state.js?v=20260627-admin-lecture-nav";
import { render, toast } from "../renderer.js?v=20260627-admin-lecture-nav";
import {
  equipmentPeriodDays,
  equipmentRangeBlocked,
  isReservationDateClosed,
  printDateOutsideUploadWindow,
  printSelectionBlocked,
  printSelectionConflicts,
  timeToMinutes
} from "../utils.js?v=20260627-admin-lecture-nav";

export const EQUIPMENT_SCROLL_INTERACTION_SELECTOR = [
  "[data-equipment-category]",
  "[data-equipment-remove]",
  "[data-equipment-selection-toggle]",
  "[data-equipment-recommend-toggle]",
  "[data-equipment-recommend-add]",
  ".equipment-choice",
  "input[name=\"equipmentItemIds\"]"
].join(",");

const SCROLL_RESTORE_TARGET_SELECTOR = ".student-shell, .admin-main, .auth-shell, .mobile-nav, .admin-mobile-nav, .desktop-nav, .side-nav, .admin-inner-tabs, .lecture-year-tabs";

let lastEquipmentInteractionScrollState = null;

export function scrollToPageTop() {
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

export function renderAtTop() {
  render();
  scrollToPageTop();
}

function captureScrollState() {
  return {
    windowX: window.scrollX || 0,
    windowY: window.scrollY || 0,
    targets: [...document.querySelectorAll(SCROLL_RESTORE_TARGET_SELECTOR)].map((target) => ({
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

export function renderPreservingScroll() {
  const scrollState = lastEquipmentInteractionScrollState || captureScrollState();
  lastEquipmentInteractionScrollState = null;
  render();
  restoreScrollState(scrollState);
}

export function captureEquipmentInteractionScroll(event) {
  if (!(event.target instanceof Element)) return;
  if (!event.target.closest(EQUIPMENT_SCROLL_INTERACTION_SELECTOR)) return;
  lastEquipmentInteractionScrollState = captureScrollState();
}

export function resetAdminPage(key) {
  state[key] = { ...(state[key] || {}), page: 1 };
}

export function setAdminPage(key, page) {
  state[key] = { ...(state[key] || {}), page: Math.max(1, Number(page) || 1) };
}

export function setReservationFlowStep(type, step) {
  if (!state.reservationFlowStep) state.reservationFlowStep = { equipment: "date", studio: "date", darkroom: "date", print: "date" };
  state.reservationFlowStep[type] = step;
}

export function goReservationFlowStep(type, step) {
  setReservationFlowStep(type, step);
  renderPreservingScroll();
}

export function checkedValues(name) {
  return [...document.querySelectorAll(`[name="${name}"]:checked`)].map((item) => item.value);
}

export function applyPrintTimeSlot(value) {
  const [startTime = "", endTime = ""] = String(value || "").split("|");
  state.selectedPrintStartTime = startTime;
  state.selectedPrintEndTime = endTime;
}

export function equipmentTimeRangeValid(period, rentalTime, returnTime) {
  if (!rentalTime || !returnTime) return false;
  if (equipmentPeriodDays(period) > 0) return true;
  const rentalMinutes = timeToMinutes(rentalTime);
  const returnMinutes = timeToMinutes(returnTime);
  return rentalMinutes !== null && returnMinutes !== null && returnMinutes > rentalMinutes;
}

export function syncReservationDraftFromDom(type) {
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

export function canAdvanceReservationFlow(type, nextStep) {
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
  if (type === "equipment" && nextStep === "select" && !equipmentTimeRangeValid(state.selectedEquipmentPeriod, state.selectedEquipmentRentalTime, state.selectedEquipmentReturnTime)) {
    toast("반납 시간은 대여 시간보다 늦어야 합니다.");
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
