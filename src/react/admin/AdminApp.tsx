import React from "react";

import { GjuAppShell, GjuIconButton } from "../design-system";
import { adminHeaderActions } from "../platform/adminActions";
import { adminNavItems, adminTitle, type AdminNavKey } from "../platform/adminNav";
import type { ReactAdminMountOptions } from "../platform/types";
import { LegacyAdminPanel } from "./LegacyAdminPanel";
import { AdminDashboard } from "./screens/AdminDashboard";

type AdminAppProps = Omit<ReactAdminMountOptions, "root">;

function handleAction(action: () => Promise<void> | void) {
  return () => {
    void action();
  };
}

function renderNavigation(
  view: string,
  onChange: (nextView: AdminNavKey) => void,
  className: string
) {
  return React.createElement(
    "nav",
    { className, "aria-label": "관리자 메뉴" },
    ...adminNavItems.map(([key, label]) =>
      React.createElement(
        "button",
        {
          key,
          type: "button",
          className: "gju-admin-nav__item",
          "aria-current": view === key ? "page" : undefined,
          "data-active": view === key ? "true" : undefined,
          onClick: () => onChange(key)
        },
        label
      )
    )
  );
}

function renderHeader(title: string, actions: ReturnType<typeof adminHeaderActions>) {
  return React.createElement(
    "div",
    { className: "gju-admin-header" },
    React.createElement("h1", { className: "gju-admin-header__title" }, title),
    React.createElement(
      "div",
      { className: "gju-admin-header__actions" },
      ...actions.map((action) =>
        React.createElement(GjuIconButton, {
          key: action.key,
          label: action.label,
          icon: action.icon,
          tone: action.tone,
          disabled: action.disabled,
          "aria-busy": action.ariaBusy ? "true" : undefined,
          onClick: handleAction(action.onSelect)
        })
      )
    )
  );
}

export function AdminApp({
  state,
  actions,
  legacyRenderAdminContent
}: AdminAppProps) {
  const view = state.adminView || "dashboard";
  const headerActions = adminHeaderActions(actions, {
    refreshing: Boolean(state.adminRefresh?.refreshing)
  });
  const title = adminTitle(view);
  const navigate = (nextView: AdminNavKey) => {
    void actions.setAdminView(nextView);
  };

  return React.createElement(
    GjuAppShell,
    {
      desktopNav: renderNavigation(view, navigate, "gju-admin-nav gju-admin-nav--sidebar"),
      header: renderHeader(title, headerActions),
      mobileHeader: renderHeader(title, headerActions),
      mobileBottomNav: renderNavigation(view, navigate, "gju-admin-nav gju-admin-nav--bottom")
    },
    view === "dashboard"
      ? React.createElement(AdminDashboard, { state, actions })
      : React.createElement(LegacyAdminPanel, { renderHtml: legacyRenderAdminContent })
  );
}
