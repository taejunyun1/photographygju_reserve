import { state } from "../state.js?v=20260704-admin-mobile-overflow";
import { render, toast } from "../renderer.js?v=20260704-admin-mobile-overflow";
import { captureScrollState, refreshAdminDataPreservingScroll, restoreScrollState } from "./shared.js?v=20260704-admin-mobile-overflow";

let adminRefreshHandlersBound = false;
let pendingRefreshScrollState = null;

function refreshButtonFromEvent(event) {
  const target = event.target instanceof Element ? event.target.closest("button") : null;
  if (!target || target.dataset.action !== "admin-refresh") return null;
  if (!state.user || state.user.role !== "admin") return null;
  return target;
}

async function runRefresh(scrollState = captureScrollState()) {
  if (state.adminRefresh?.refreshing) return;
  state.adminRefresh = { ...(state.adminRefresh || {}), refreshing: true };
  render();
  restoreScrollState(scrollState);
  try {
    await refreshAdminDataPreservingScroll({ includeBootstrap: true, scrollState });
    toast("최신 데이터를 불러왔습니다.", { scrollState });
  } catch (error) {
    toast(error.message || "데이터 새로고침에 실패했습니다.", { scrollState });
  } finally {
    state.adminRefresh = { ...(state.adminRefresh || {}), refreshing: false };
    render();
    restoreScrollState(scrollState);
  }
}

export function setupAdminRefreshHandlers() {
  if (adminRefreshHandlersBound) return;
  adminRefreshHandlersBound = true;

  document.addEventListener("pointerdown", (event) => {
    if (!refreshButtonFromEvent(event)) return;
    pendingRefreshScrollState = captureScrollState();
  }, { capture: true, passive: true });

  document.addEventListener("click", async (event) => {
    const target = refreshButtonFromEvent(event);
    if (!target) return;
    event.preventDefault();
    const scrollState = pendingRefreshScrollState || captureScrollState();
    pendingRefreshScrollState = null;
    await runRefresh(scrollState);
  });

  document.addEventListener("gju-react-admin-refresh", async () => {
    const scrollState = captureScrollState();
    await runRefresh(scrollState);
  });
}
