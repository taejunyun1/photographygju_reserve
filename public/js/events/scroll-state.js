export const SCROLL_RESTORE_TARGET_SELECTOR = ".student-shell, .admin-main, .auth-shell, .mobile-nav, .admin-mobile-nav, .desktop-nav, .side-nav, .admin-inner-tabs, .lecture-year-tabs";

export function scrollToPageTop() {
  requestAnimationFrame(() => {
    for (const target of document.querySelectorAll(".student-shell, .admin-main, .auth-shell")) {
      target.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
      target.scrollTop = 0;
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  });
}

export function captureScrollState() {
  return {
    windowX: window.scrollX || 0,
    windowY: window.scrollY || 0,
    targets: [...document.querySelectorAll(SCROLL_RESTORE_TARGET_SELECTOR)].map((target) => ({
      className: [...target.classList].join("."),
      scrollTop: target.scrollTop || 0,
      scrollLeft: target.scrollLeft || 0
    }))
  };
}

export function restoreScrollState(snapshot) {
  const restore = () => {
    for (const item of snapshot?.targets || []) {
      if (!item.className) continue;
      const target = document.querySelector(`.${item.className}`);
      if (!target) continue;
      target.scrollTo?.({ top: item.scrollTop, left: item.scrollLeft, behavior: "auto" });
      target.scrollTop = item.scrollTop;
      target.scrollLeft = item.scrollLeft;
    }
    window.scrollTo({ top: snapshot?.windowY || 0, left: snapshot?.windowX || 0, behavior: "auto" });
    document.documentElement.scrollTop = snapshot?.windowY || 0;
    document.body.scrollTop = snapshot?.windowY || 0;
  };
  requestAnimationFrame(() => {
    restore();
    requestAnimationFrame(restore);
  });
  setTimeout(restore, 0);
  setTimeout(restore, 80);
}
