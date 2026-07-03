import { $app, state } from "./state.js?v=20260703-icon-only-actions";
import { escapeHtml } from "./utils.js?v=20260703-icon-only-actions";
import { adminContent, adminShell } from "./views-admin.js?v=20260703-icon-only-actions";
import { authView, noticeBottomSheet, studentShell, warningPopup } from "./views-student.js?v=20260703-icon-only-actions";
import { captureScrollState, restoreScrollState } from "./events/scroll-state.js?v=20260703-icon-only-actions";

document.addEventListener("gju-loading-change", () => {
  const scrollState = captureScrollState();
  render();
  restoreScrollState(scrollState);
});

let reactAdminMounted = false;

function unmountReactAdmin() {
  if (!reactAdminMounted) return;
  window.GJUReactAdmin?.unmount?.();
  reactAdminMounted = false;
}

function canUseReactAdmin() {
  return state.user?.role === "admin" && state.reactAdminEnabled !== false && typeof window.GJUReactAdmin?.mount === "function";
}

function renderReactAdminShell() {
  return `<div id="react-admin-root"></div>`;
}

const reactAdminActions = {
  async setAdminView(view) {
    state.adminView = view;
    render();
  },
  async refreshAdminData() {
    document.dispatchEvent(new CustomEvent("gju-react-admin-refresh"));
  },
  logout() {
    document.dispatchEvent(new CustomEvent("gju-react-admin-logout"));
  },
  render
};

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
    unmountReactAdmin();
    $app.innerHTML = `<main class="auth-shell"><div class="auth-panel loading-initial">${loadingOverlay() || "<strong>로딩중</strong>"}</div></main>`;
    return;
  }
  const useReactAdmin = canUseReactAdmin();
  const body = !state.user ? authView() : state.user.role === "admin" ? (useReactAdmin ? renderReactAdminShell() : adminShell()) : studentShell();
  $app.innerHTML = `<div class="app">${body}${noticeBottomSheet()}${warningPopup()}${loadingOverlay()}${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}</div>`;
  if (useReactAdmin) {
    const root = document.querySelector("#react-admin-root");
    if (root) {
      window.GJUReactAdmin?.mount?.({
        root,
        state,
        actions: reactAdminActions,
        legacyRenderAdminContent: adminContent
      });
      reactAdminMounted = true;
    }
    return;
  }
  unmountReactAdmin();
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
