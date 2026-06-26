import { $app, state } from "./state.js?v=20260626-admin-dashboard-status-tags";
import { loadAdminData, loadBootstrap, loadLectures, loadMe, loadMyReservations } from "./data.js?v=20260626-admin-dashboard-status-tags";
import { setupEventHandlers } from "./events.js?v=20260626-admin-dashboard-status-tags";
import { refreshNativeNotificationState, setupNativeNotificationListeners, syncNativeReservationNotifications } from "./native-notifications.js?v=20260626-admin-dashboard-status-tags";
import { render } from "./renderer.js?v=20260626-admin-dashboard-status-tags";
import { escapeHtml } from "./utils.js?v=20260626-admin-dashboard-status-tags";

async function init() {
  await loadBootstrap();
  await loadMe();
  await refreshNativeNotificationState();
  await setupNativeNotificationListeners(render);
  if (state.user?.role === "admin") await loadAdminData();
  if (state.user?.role === "student") {
    await loadMyReservations();
    await loadLectures();
    await syncNativeReservationNotifications({ silent: true });
  }
  render();
}

setupEventHandlers();
render();

init().catch((error) => {
  $app.innerHTML = `<main class="auth-shell"><div class="auth-panel">초기화 실패: ${escapeHtml(error.message)}</div></main>`;
});
