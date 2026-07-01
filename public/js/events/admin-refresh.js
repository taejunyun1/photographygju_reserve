import { state } from "../state.js?v=20260702-admin-scroll-fix";
import { render, toast } from "../renderer.js?v=20260702-admin-scroll-fix";
import { refreshAdminDataPreservingScroll } from "./shared.js?v=20260702-admin-scroll-fix";

const THRESHOLD = 72;
const MAX_DISTANCE = 120;
const DRAG_ACTIVATION_PX = 6;
let startY = 0;
let tracking = false;
let adminRefreshHandlersBound = false;

function setRefreshState(patch) {
  state.adminRefresh = { ...(state.adminRefresh || {}), ...patch };
  render();
}

function resetRefreshState() {
  setRefreshState({ pulling: false, refreshing: false, distance: 0, message: "당겨서 새로고침" });
}

function cancelRefreshTracking(options = {}) {
  tracking = false;
  startY = 0;
  if (options.resetPulling) resetRefreshState();
}

function canStartRefresh(event) {
  if (!(event.target instanceof Element)) return false;
  if (!state.user || state.user.role !== "admin") return false;
  if (state.adminRefresh?.refreshing) return false;
  if (event.target.closest("input, textarea, select, button, a, form")) return false;
  const main = event.target.closest(".admin-main");
  return Boolean(main && main.scrollTop <= 0);
}

async function runRefresh() {
  setRefreshState({ pulling: false, refreshing: true, distance: THRESHOLD, message: "새로고침 중" });
  try {
    await refreshAdminDataPreservingScroll({ includeBootstrap: true });
    toast("최신 데이터를 불러왔습니다.", { preserveScroll: true });
  } catch (error) {
    toast(error.message || "데이터 새로고침에 실패했습니다.", { preserveScroll: true });
  } finally {
    resetRefreshState();
  }
}

export function setupAdminRefreshHandlers() {
  if (adminRefreshHandlersBound) return;
  adminRefreshHandlersBound = true;

  document.addEventListener("pointerdown", (event) => {
    if (!canStartRefresh(event)) return;
    tracking = true;
    startY = event.clientY || 0;
  }, { passive: true });

  document.addEventListener("pointermove", (event) => {
    if (!tracking || state.adminRefresh?.refreshing) return;
    const deltaY = (event.clientY || 0) - startY;
    if (deltaY < -DRAG_ACTIVATION_PX) {
      cancelRefreshTracking({ resetPulling: state.adminRefresh?.pulling });
      return;
    }
    if (deltaY < DRAG_ACTIVATION_PX) {
      if (state.adminRefresh?.pulling && deltaY <= 0) resetRefreshState();
      return;
    }
    const distance = Math.max(0, Math.min(MAX_DISTANCE, deltaY));
    setRefreshState({
      pulling: true,
      distance,
      message: distance >= THRESHOLD ? "놓으면 새로고침" : "당겨서 새로고침"
    });
  }, { passive: true });

  document.addEventListener("pointerup", () => {
    if (!tracking) return;
    if (state.adminRefresh?.refreshing) {
      cancelRefreshTracking();
      return;
    }
    cancelRefreshTracking();
    if (Number(state.adminRefresh?.distance || 0) >= THRESHOLD) {
      runRefresh();
      return;
    }
    resetRefreshState();
  }, { passive: true });

  document.addEventListener("pointercancel", () => {
    if (state.adminRefresh?.refreshing) {
      cancelRefreshTracking();
      return;
    }
    cancelRefreshTracking();
    resetRefreshState();
  }, { passive: true });
}
