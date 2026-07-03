import { $app, state } from "./state.js?v=20260704-admin-reservation-fit";
import { escapeHtml } from "./utils.js?v=20260704-admin-reservation-fit";
import { adminContent, adminShell } from "./views-admin.js?v=20260704-admin-reservation-fit";
import { authView, noticeBottomSheet, studentShell, warningPopup } from "./views-student.js?v=20260704-admin-reservation-fit";
import { captureScrollState, restoreScrollState } from "./events/scroll-state.js?v=20260704-admin-reservation-fit";

document.addEventListener("gju-loading-change", () => {
  const scrollState = captureScrollState();
  render();
  restoreScrollState(scrollState);
});

let reactAdminMounted = false;
let lastReactAdminContent = "";

function unmountReactAdmin() {
  if (!reactAdminMounted) return;
  window.GJUReactAdmin?.unmount?.();
  reactAdminMounted = false;
  lastReactAdminContent = "";
}

function canUseReactAdmin() {
  return state.user?.role === "admin" && state.reactAdminEnabled !== false && typeof window.GJUReactAdmin?.mount === "function";
}

function renderReactAdminShell() {
  return `<div id="react-admin-root"></div>`;
}

function renderAppChrome() {
  return `${noticeBottomSheet()}${warningPopup()}${loadingOverlay()}${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}`;
}

function renderReactAdminFrame() {
  return `<div class="app">${renderReactAdminShell()}<div id="react-admin-chrome">${renderAppChrome()}</div></div>`;
}

function hasReactAdminFrame() {
  return reactAdminMounted && Boolean(document.querySelector("#react-admin-root")) && Boolean(document.querySelector("#react-admin-chrome"));
}

function updateReactAdminChrome() {
  const chrome = document.querySelector("#react-admin-chrome");
  if (!chrome) return false;
  chrome.innerHTML = renderAppChrome();
  return true;
}

function mountReactAdmin(root, adminMarkup) {
  window.GJUReactAdmin?.mount?.({
    root,
    state,
    actions: reactAdminActions,
    legacyRenderAdminContent: () => adminMarkup
  });
  reactAdminMounted = true;
  lastReactAdminContent = adminMarkup;
}

function updateReactAdmin(root, adminMarkup) {
  window.GJUReactAdmin?.update?.({
    root,
    state,
    actions: reactAdminActions,
    legacyRenderAdminContent: () => adminMarkup
  });
  lastReactAdminContent = adminMarkup;
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
  if (useReactAdmin) {
    const adminMarkup = adminContent();
    if (!hasReactAdminFrame()) {
      $app.innerHTML = renderReactAdminFrame();
    } else {
      updateReactAdminChrome();
    }
    const root = document.querySelector("#react-admin-root");
    if (root) {
      if (!reactAdminMounted) {
        mountReactAdmin(root, adminMarkup);
      } else if (typeof window.GJUReactAdmin?.update === "function") {
        updateReactAdmin(root, adminMarkup);
      } else if (lastReactAdminContent !== adminMarkup) {
        mountReactAdmin(root, adminMarkup);
      }
    }
    return;
  }
  unmountReactAdmin();
  const body = !state.user ? authView() : state.user.role === "admin" ? adminShell() : studentShell();
  $app.innerHTML = `<div class="app">${body}${renderAppChrome()}</div>`;
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
