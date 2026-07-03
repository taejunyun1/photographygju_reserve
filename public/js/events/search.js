import { state } from "../state.js?v=20260703-equipment-inquiry-status";
import { loadAdminData } from "../data.js?v=20260703-equipment-inquiry-status";
import { render } from "../renderer.js?v=20260703-equipment-inquiry-status";
import { normalizeUnicodeText } from "../utils.js?v=20260703-equipment-inquiry-status";
import { resetAdminPage } from "./shared.js?v=20260703-equipment-inquiry-status";

export function setupSearchEventHandlers() {
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
  const adminServerSearchStateKeys = new Set(["adminUserSearch", "adminReservationSearch", "adminReportSearch", "adminLectureSearch", "adminNoticeSearch"]);

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
    if (stateKey === "adminLectureSearch") resetAdminPage("adminLecturesPage");
    if (stateKey === "adminNoticeSearch") resetAdminPage("adminNoticesPage");
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

  document.addEventListener("focusout", (event) => {
    const target = event.target;
    const binding = searchBindingForTarget(target);
    if (!binding) return;
    if (searchRenderInProgress) return;
    setTimeout(() => {
      if (searchRenderInProgress) return;
      commitSearchInput(target, binding, { restoreFocus: false });
    }, 0);
  });
}
