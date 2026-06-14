import { $app, state } from "./state.js?v=20260614-security1";
import { escapeHtml } from "./utils.js?v=20260614-security1";
import { adminShell } from "./views-admin.js?v=20260614-security1";
import { authView, noticeBottomSheet, studentShell } from "./views-student.js?v=20260614-security1";

document.addEventListener("gju-loading-change", () => render());

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
  $app.innerHTML = `<div class="app">${body}${noticeBottomSheet()}${loadingOverlay()}${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}</div>`;
}

let toastTimer = null;

export function toast(message) {
  if (toastTimer) clearTimeout(toastTimer);
  state.toast = message;
  render();
  toastTimer = setTimeout(() => {
    state.toast = "";
    toastTimer = null;
    render();
  }, 2600);
}
