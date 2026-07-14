import { $app, state } from "./state.js?v=20260714-full-flow-ux-r3";
import { loadAdminData, loadBootstrap, loadLectures, loadMe, loadMyReservations } from "./data.js?v=20260714-full-flow-ux-r3";
import { setupEventHandlers } from "./events.js?v=20260714-full-flow-ux-r3";
import { createNativeAppResumeLifecycle } from "./native-app-lifecycle.js?v=20260711-native-resume";
import { handleNativeNotificationResume, initializeNativeNotifications } from "./native-notifications.js?v=20260714-full-flow-ux-r3";
import { render } from "./renderer.js?v=20260714-full-flow-ux-r3";
import { escapeHtml } from "./utils.js?v=20260714-full-flow-ux-r3";

async function reloadActiveAccount() {
  await loadBootstrap();
  await loadMe();
  if (state.user?.role === "admin") await loadAdminData();
  if (state.user?.role === "student") {
    await Promise.all([loadMyReservations(), loadLectures()]);
  }
}

async function refreshAfterNativeResume() {
  await reloadActiveAccount();
  await handleNativeNotificationResume();
  render();
}

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
