import { state } from "../state.js?v=20260714-mobile-dock-r5";
import { logout } from "../actions.js?v=20260714-mobile-dock-r5";
import { render, toast } from "../renderer.js?v=20260714-mobile-dock-r5";
import { loadAdminData, loadBootstrap, loadMe } from "../data.js?v=20260714-mobile-dock-r5";
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
} from "../utils.js?v=20260714-mobile-dock-r5";
import {
  captureScrollState,
  restoreScrollState,
  scrollToPageTop,
  SCROLL_RESTORE_TARGET_SELECTOR
} from "./scroll-state.js?v=20260714-mobile-dock-r5";

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
let sharedEventHandlersBound = false;
let dialogTriggerFocusState = null;
let dialogWasOpen = false;

const FOCUS_IDENTITY_ATTRIBUTES = [
  "data-focus-key",
  "data-student-view",
  "data-admin-view",
  "data-auth-mode",
  "data-action",
  "data-notice-open",
  "data-admin-queue-sheet",
  "data-reserve-shortcut",
  "data-reserve-type"
];

function attributeSelector(name, value) {
  const escaped = typeof CSS !== "undefined" && typeof CSS.escape === "function"
    ? CSS.escape(String(value))
    : String(value).replace(/["\\]/g, "\\$&");
  return `[${name}="${escaped}"]`;
}

function visibleElement(elements) {
  return [...elements].find((element) => element.getClientRects().length && !element.hidden && !element.disabled) || null;
}

function focusWithoutScrolling(element) {
  if (!(element instanceof HTMLElement) || !element.isConnected || element.hidden || element.disabled) return false;
  if (!element.hasAttribute("tabindex") && !element.matches("a[href], button, input, select, textarea, summary")) {
    element.setAttribute("tabindex", "-1");
  }
  element.focus({ preventScroll: true });
  return document.activeElement === element;
}

function restoreFocusAcrossRenders(elementId, root = document.querySelector("#app")) {
  if (!elementId || !root || typeof MutationObserver === "undefined") return;
  let quietTimer = null;
  const refocus = () => focusWithoutScrolling(document.getElementById(elementId));
  const observer = new MutationObserver(() => {
    refocus();
    clearTimeout(quietTimer);
    quietTimer = setTimeout(() => observer.disconnect(), 1500);
  });
  observer.observe(root, { childList: true, subtree: true });
  setTimeout(() => {
    observer.disconnect();
    clearTimeout(quietTimer);
  }, 5000);
}

function firstVisibleForSelectorList(selectorList) {
  for (const selector of String(selectorList || "").split(",").map((item) => item.trim()).filter(Boolean)) {
    const target = visibleElement(document.querySelectorAll(selector));
    if (target) return target;
  }
  return null;
}

export function captureFocusState() {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || active === document.body) return null;
  if (active.id) return { id: active.id };
  for (const attribute of FOCUS_IDENTITY_ATTRIBUTES) {
    if (active.hasAttribute(attribute)) {
      return { selector: attributeSelector(attribute, active.getAttribute(attribute)) };
    }
  }
  if (active.getAttribute("name")) {
    return { selector: `${active.tagName.toLowerCase()}${attributeSelector("name", active.getAttribute("name"))}` };
  }
  return null;
}

export function focusPageHeading(selector = "main [data-page-heading], main h1, main") {
  const target = firstVisibleForSelectorList(selector) || document.querySelector("main");
  return focusWithoutScrolling(target);
}

export function restoreFocusState(focusState, { fallbackSelector = "main [data-page-heading], main h1, main" } = {}) {
  let target = null;
  if (focusState?.id) target = document.getElementById(focusState.id);
  if (!target && focusState?.selector) target = visibleElement(document.querySelectorAll(focusState.selector));
  if (focusWithoutScrolling(target)) return true;
  return focusPageHeading(fallbackSelector);
}

function visibleDialog() {
  return visibleElement(document.querySelectorAll('[role="dialog"][aria-modal="true"]'));
}

function focusDialog(dialog) {
  if (!(dialog instanceof HTMLElement)) return false;
  if (dialog.contains(document.activeElement)) return true;
  const target = visibleElement(dialog.querySelectorAll([
    "button:not([disabled])",
    "a[href]",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])"
  ].join(","))) || dialog;
  return focusWithoutScrolling(target);
}

function updateDialogFocus() {
  const dialog = visibleDialog();
  if (dialog) {
    dialogWasOpen = true;
    focusDialog(dialog);
    return;
  }
  if (!dialogWasOpen) return;
  dialogWasOpen = false;
  const trigger = dialogTriggerFocusState;
  dialogTriggerFocusState = null;
  restoreFocusState(trigger);
}

function setupDialogFocusManagement() {
  document.addEventListener("click", (event) => {
    const opener = event.target.closest?.('[data-notice-open], [data-admin-queue-sheet], [aria-haspopup="dialog"]');
    if (opener && !visibleDialog()) dialogTriggerFocusState = captureFocusState();
  }, true);

  document.addEventListener("keydown", (event) => {
    const dialog = visibleDialog();
    if (!dialog) return;
    if (event.key === "Escape") {
      const close = visibleElement(dialog.parentElement?.querySelectorAll?.("[data-notice-close], [data-warning-popup-close], [data-admin-queue-sheet-close]") || []);
      if (close) {
        event.preventDefault();
        close.click();
      }
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...dialog.querySelectorAll("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])")]
      .filter((element) => element.getClientRects().length);
    if (!focusable.length) {
      event.preventDefault();
      focusWithoutScrolling(dialog);
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      focusWithoutScrolling(last);
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      focusWithoutScrolling(first);
    }
  });

  if (typeof MutationObserver !== "undefined") {
    const observer = new MutationObserver(() => {
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(updateDialogFocus);
      else setTimeout(updateDialogFocus, 0);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  updateDialogFocus();
}

export function renderAtTop(options = {}) {
  const focusState = options.restoreFocus === false ? null : captureFocusState();
  render();
  scrollToPageTop();
  if (options.focusSelector) focusPageHeading(options.focusSelector);
  else if (options.restoreFocus !== false) restoreFocusState(focusState);
}

export function renderForNavigation({ focusSelector = "main [data-page-heading], main h1, main", preserveScroll = false } = {}) {
  const scrollState = preserveScroll ? captureScrollState() : null;
  render();
  if (scrollState) restoreScrollState(scrollState);
  else scrollToPageTop();
  focusPageHeading(focusSelector);
}

export function setupSharedEventHandlers() {
  if (sharedEventHandlersBound) return;
  sharedEventHandlersBound = true;
  setupDialogFocusManagement();

  document.addEventListener("keydown", (event) => {
    const tab = event.target.closest?.('[role="tab"][data-roving-tab]');
    const tablist = tab?.closest?.('[role="tablist"][data-roving-tablist]');
    if (!tab || !tablist) return;

    const orientation = tablist.getAttribute("aria-orientation") || "horizontal";
    const previousKey = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";
    const nextKey = orientation === "vertical" ? "ArrowDown" : "ArrowRight";
    if (![previousKey, nextKey, "Home", "End"].includes(event.key)) return;

    const tabs = [...tablist.querySelectorAll('[role="tab"][data-roving-tab]:not([disabled])')];
    const currentIndex = tabs.indexOf(tab);
    if (currentIndex < 0 || !tabs.length) return;
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : (currentIndex + (event.key === nextKey ? 1 : -1) + tabs.length) % tabs.length;
    const nextTab = tabs[nextIndex];
    event.preventDefault();
    tabs.forEach((candidate) => {
      const selected = candidate === nextTab;
      candidate.setAttribute("tabindex", selected ? "0" : "-1");
      candidate.setAttribute("aria-selected", String(selected));
      candidate.classList.toggle("active", selected);
    });
    focusWithoutScrolling(nextTab);
    restoreFocusAcrossRenders(nextTab.id);
    nextTab.click();
  });

  document.addEventListener("gju-react-admin-logout", async () => {
    await logout();
  });
  document.addEventListener("gju-react-student-logout", async () => {
    await logout();
  });
}

export { captureScrollState, restoreScrollState, scrollToPageTop, SCROLL_RESTORE_TARGET_SELECTOR };

export function renderPreservingScroll() {
  const options = arguments[0] || {};
  const scrollState = lastEquipmentInteractionScrollState || captureScrollState();
  const focusState = options.restoreFocus === false ? null : captureFocusState();
  lastEquipmentInteractionScrollState = null;
  render();
  restoreScrollState(scrollState);
  if (options.focusSelector) focusPageHeading(options.focusSelector);
  else if (options.restoreFocus !== false) restoreFocusState(focusState);
}

export async function refreshAdminDataPreservingScroll(options = {}) {
  const { includeBootstrap = false, includeMe = false, scrollState = captureScrollState() } = options;
  const focusState = options.restoreFocus === false ? null : captureFocusState();
  const jobs = [loadAdminData()];
  if (includeBootstrap) jobs.unshift(loadBootstrap());
  if (includeMe) jobs.push(loadMe());
  await Promise.all(jobs);
  render();
  restoreScrollState(scrollState);
  if (options.focusSelector) focusPageHeading(options.focusSelector);
  else if (options.restoreFocus !== false) restoreFocusState(focusState);
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
