import { state } from "../state.js?v=20260702-admin-scroll-fix";
import {
  setAdminEquipmentSelection,
  setVisibleAdminEquipmentSelection,
  syncAdminEquipmentSelectionDom
} from "../admin-equipment.js?v=20260702-admin-scroll-fix";
import {
  renderPreservingScroll,
  setReservationFlowStep,
  applyPrintTimeSlot
} from "./shared.js?v=20260702-admin-scroll-fix";

export function setupReservationInputHandlers() {
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
      renderPreservingScroll();
      return;
    }
    if (target.name === "studioSlots") {
      if (target.checked && !state.selectedStudioSlots.includes(target.value)) {
        state.selectedStudioSlots.push(target.value);
      }
      if (!target.checked) {
        state.selectedStudioSlots = state.selectedStudioSlots.filter((slot) => slot !== target.value);
      }
      renderPreservingScroll();
      return;
    }
    if (target.name === "darkroomSlots") {
      if (target.checked && !state.selectedDarkroomSlots.includes(target.value)) {
        state.selectedDarkroomSlots.push(target.value);
      }
      if (!target.checked) {
        state.selectedDarkroomSlots = state.selectedDarkroomSlots.filter((slot) => slot !== target.value);
      }
      renderPreservingScroll();
      return;
    }
    if (target.name === "processTypes") {
      if (target.checked && !state.selectedDarkroomProcessTypes.includes(target.value)) {
        state.selectedDarkroomProcessTypes.push(target.value);
      }
      if (!target.checked) {
        state.selectedDarkroomProcessTypes = state.selectedDarkroomProcessTypes.filter((item) => item !== target.value);
      }
      renderPreservingScroll();
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
      renderPreservingScroll();
      return;
    }
    if (target.name === "printTypes") {
      if (target.checked && !state.selectedPrintTypes.includes(target.value)) state.selectedPrintTypes.push(target.value);
      if (!target.checked) state.selectedPrintTypes = state.selectedPrintTypes.filter((item) => item !== target.value);
      renderPreservingScroll();
      return;
    }
    if (target.name === "papers") {
      if (target.checked && !state.selectedPrintPapers.includes(target.value)) state.selectedPrintPapers.push(target.value);
      if (!target.checked) state.selectedPrintPapers = state.selectedPrintPapers.filter((item) => item !== target.value);
      renderPreservingScroll();
      return;
    }
    if (target.name === "sizes") {
      if (target.checked && !state.selectedPrintSizes.includes(target.value)) state.selectedPrintSizes.push(target.value);
      if (!target.checked) state.selectedPrintSizes = state.selectedPrintSizes.filter((item) => item !== target.value);
      renderPreservingScroll();
      return;
    }
    if (["period", "rentalTime", "returnTime"].includes(target.name) && target.closest("[data-type=\"equipment\"]")) {
      if (target.name === "rentalTime") state.selectedEquipmentRentalTime = target.value;
      if (target.name === "returnTime") state.selectedEquipmentReturnTime = target.value;
      if (target.name === "period") state.selectedEquipmentPeriod = target.value;
      state.equipmentSelectionSheetOpen = false;
      state.equipmentRecommendationOpen = false;
      setReservationFlowStep("equipment", "schedule");
      renderPreservingScroll();
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
}
