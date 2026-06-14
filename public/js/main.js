import { $app, state } from "./state.js?v=20260614-scrolltop1";
import { loadAdminData, loadBootstrap, loadLectures, loadMe, loadMyReservations } from "./data.js?v=20260614-scrolltop1";
import { setupEventHandlers } from "./events.js?v=20260614-scrolltop1";
import { render } from "./renderer.js?v=20260614-scrolltop1";
import { escapeHtml } from "./utils.js?v=20260614-scrolltop1";

async function init() {
  await loadBootstrap();
  await loadMe();
  if (state.user?.role === "admin") await loadAdminData();
  if (state.user?.role === "student") {
    await loadMyReservations();
    await loadLectures();
  }
  render();
}

setupEventHandlers();
render();

init().catch((error) => {
  $app.innerHTML = `<main class="auth-shell"><div class="auth-panel">초기화 실패: ${escapeHtml(error.message)}</div></main>`;
});
