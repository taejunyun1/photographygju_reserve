import { $app, state } from "./state.js?v=20260703-equipment-weekend-rules";
import { escapeHtml } from "./utils.js?v=20260703-equipment-weekend-rules";
import { adminShell } from "./views-admin.js?v=20260703-equipment-weekend-rules";
import { authView, noticeBottomSheet, studentShell, warningPopup } from "./views-student.js?v=20260703-equipment-weekend-rules";
import { captureScrollState, restoreScrollState } from "./events/scroll-state.js?v=20260703-equipment-weekend-rules";

document.addEventListener("gju-loading-change", () => {
  const scrollState = captureScrollState();
  render();
  restoreScrollState(scrollState);
});

function loadingOverlay() {
  if (!state.loadingCount) return "";
  return `
    <div class="loading-overlay" role="status" aria-live="polite">
      <div class="loading-panel">
        <span class="loading-spinner" aria-hidden="true"></span>
        <strong>로딩중</strong>
      </div>
    </div>
  `;
}

export function render() {
  if (!state.bootstrap) {
    $app.innerHTML = `<main class="auth-shell"><div class="auth-panel loading-initial">${loadingOverlay() || "<strong>로딩중</strong>"}</div></main>`;
    return;
  }
  const body = !state.user ? authView() : state.user.role === "admin" ? adminShell() : studentShell();
  $app.innerHTML = `<div class="app">${body}${noticeBottomSheet()}${warningPopup()}${loadingOverlay()}${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}</div>`;
}

let toastTimer = null;

export function toast(message, options = {}) {
  if (toastTimer) clearTimeout(toastTimer);
  const scrollState = options.scrollState || (options.preserveScroll ? captureScrollState() : null);
  state.toast = message;
  render();
  if (scrollState) restoreScrollState(scrollState);
  toastTimer = setTimeout(() => {
    const hideScrollState = options.preserveScroll ? captureScrollState() : null;
    state.toast = "";
    toastTimer = null;
    render();
    if (hideScrollState) restoreScrollState(hideScrollState);
  }, 2600);
}
