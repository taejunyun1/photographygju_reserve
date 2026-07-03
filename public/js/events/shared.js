import { state } from "../state.js?v=20260703-icon-only-actions";
import { render, toast } from "../renderer.js?v=20260703-icon-only-actions";
import { loadAdminData, loadBootstrap, loadMe } from "../data.js?v=20260703-icon-only-actions";
import {
  equipmentPeriodDays,
  equipmentRangeBlocked,
  isReservationDateClosed,
  reservationDateUnavailable,
  reservationDateUnavailableMessage,
  printDateOutsideUploadWindow,
  printSelectionBlocked,
  printSelectionConflicts,
  timeToMinutes
} from "../utils.js?v=20260703-icon-only-actions";
import {
  captureScrollState,
  restoreScrollState,
  scrollToPageTop,
  SCROLL_RESTORE_TARGET_SELECTOR
} from "./scroll-state.js?v=20260703-icon-only-actions";

export const EQUIPMENT_SCROLL_INTERACTION_SELECTOR = [
  "[data-equipment-category]",
  "[data-equipment-remove]",
  "[data-equipment-selection-toggle]",
  "[data-equipment-recommend-toggle]",
  "[data-equipment-recommend-add]",
  ".equipment-choice",
  "input[name=\"equipmentItemIds\"]"
].join(",");

let lastEquipmentInteractionScrollState = null;

export function renderAtTop() {
  render();
  scrollToPageTop();
}

export { captureScrollState, restoreScrollState, scrollToPageTop, SCROLL_RESTORE_TARGET_SELECTOR };

export function renderPreservingScroll() {
  const scrollState = lastEquipmentInteractionScrollState || captureScrollState();
  lastEquipmentInteractionScrollState = null;
  render();
  restoreScrollState(scrollState);
}

export async function refreshAdminDataPreservingScroll(options = {}) {
  const { includeBootstrap = false, includeMe = false, scrollState = captureScrollState() } = options;
  const jobs = [loadAdminData()];
  if (includeBootstrap) jobs.unshift(loadBootstrap());
  if (includeMe) jobs.push(loadMe());
  await Promise.all(jobs);
  render();
  restoreScrollState(scrollState);
  return scrollState;
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
  if (reservationDateUnavailable(type, selectedDate)) {
    toast(reservationDateUnavailableMessage(type));
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
