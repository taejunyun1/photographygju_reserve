import { $app, state } from "./state.js?v=20260910-reliability-r1";
import { loadAdminData, loadAdminView, loadBootstrap, loadLectures, loadMe, loadMyReservations } from "./data.js?v=20260910-reliability-r1";
import { configureAdminRefreshLifecycle, requestAdminRefresh } from "./admin-refresh-lifecycle.js?v=20260910-reliability-r1";
import { setupEventHandlers } from "./events.js?v=20260910-reliability-r1";
import { createNativeAppResumeLifecycle } from "./native-app-lifecycle.js?v=20260910-reliability-r1";
import { handleNativeNotificationResume, initializeNativeNotifications } from "./native-notifications.js?v=20260910-reliability-r1";
import { render } from "./renderer.js?v=20260910-reliability-r1";
import { escapeHtml } from "./utils.js?v=20260910-reliability-r1";

async function reloadActiveAccount() {
  await loadBootstrap();
  await loadMe();
  if (state.user?.role === "admin") await loadAdminData();
  if (state.user?.role === "student") {
    await Promise.all([loadMyReservations(), loadLectures()]);
  }
}

async function refreshAfterNativeResume() {
  if (state.user?.role === "admin") await requestAdminRefresh();
  else await reloadActiveAccount();
  await handleNativeNotificationResume();
  render();
}

const adminRefreshLifecycle = configureAdminRefreshLifecycle({
  canRefresh: () => Boolean(state.token && state.user?.role === "admin"),
  async refresh() {
    state.adminRefresh = { ...(state.adminRefresh || {}), refreshing: true, error: "" };
    render();
    try {
      await loadBootstrap();
      await loadAdminView(state.adminView || "dashboard", { force: true });
      state.adminRefresh = { ...(state.adminRefresh || {}), lastSucceededAt: new Date().toISOString(), error: "" };
    } catch (error) {
      state.adminRefresh = { ...(state.adminRefresh || {}), error: error.message || "데이터 새로고침에 실패했습니다." };
      throw error;
    } finally {
      state.adminRefresh = { ...(state.adminRefresh || {}), refreshing: false };
      render();
    }
  }
});

function requestBackgroundAdminRefresh() {
  adminRefreshLifecycle.request().catch(() => {});
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") requestBackgroundAdminRefresh();
});
window.addEventListener("focus", requestBackgroundAdminRefresh);

async function setupNativeAppResumeLifecycle() {
  const appPlugin = globalThis.window?.Capacitor?.Plugins?.App;
  const lifecycle = createNativeAppResumeLifecycle({
    isNative: Boolean(globalThis.window?.GJU_NATIVE_APP),
    appPlugin,
    onResume: refreshAfterNativeResume,
    onError(error) {
      state.nativeNotifications = {
        ...(state.nativeNotifications || {}),
        error: error.message || "앱 복귀 후 예약 알림을 동기화하지 못했습니다."
      };
      render();
    }
  });
  await lifecycle.setup();
}

async function init() {
  await reloadActiveAccount();
  await initializeNativeNotifications(render);
  await handleNativeNotificationResume();
  await setupNativeAppResumeLifecycle();
  render();
}

setupEventHandlers();
render();

init().catch((error) => {
  $app.innerHTML = `<main class="auth-shell"><div class="auth-panel">초기화 실패: ${escapeHtml(error.message)}</div></main>`;
});
