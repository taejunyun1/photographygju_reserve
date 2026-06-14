import { $app, state } from "./state.js?v=20260614-logs1";
import { escapeHtml } from "./utils.js?v=20260614-logs1";
import { adminShell } from "./views-admin.js?v=20260614-logs1";
import { authView, noticeBottomSheet, studentShell } from "./views-student.js?v=20260614-logs1";

export function render() {
  if (!state.bootstrap) {
    $app.innerHTML = `<main class="auth-shell"><div class="auth-panel">불러오는 중...</div></main>`;
    return;
  }
  const body = !state.user ? authView() : state.user.role === "admin" ? adminShell() : studentShell();
  $app.innerHTML = `<div class="app">${body}${noticeBottomSheet()}${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}</div>`;
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
