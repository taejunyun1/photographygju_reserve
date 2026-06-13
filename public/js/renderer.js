import { $app, state } from "./state.js?v=20260613-studioflow1";
import { escapeHtml } from "./utils.js?v=20260613-studioflow1";
import { adminShell } from "./views-admin.js?v=20260613-studioflow1";
import { authView, noticeBottomSheet, studentShell } from "./views-student.js?v=20260613-studioflow1";

export function render() {
  if (!state.bootstrap) {
    $app.innerHTML = `<main class="auth-shell"><div class="auth-panel">불러오는 중...</div></main>`;
    return;
  }
  const body = !state.user ? authView() : state.user.role === "admin" ? adminShell() : studentShell();
  $app.innerHTML = `<div class="app">${body}${noticeBottomSheet()}${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}</div>`;
}

export function toast(message) {
  state.toast = message;
  render();
  setTimeout(() => {
    state.toast = "";
    render();
  }, 2600);
}
