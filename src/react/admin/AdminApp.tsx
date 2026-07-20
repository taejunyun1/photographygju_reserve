import React from "react";

import { GjuAppShell, GjuDialog, GjuIconButton } from "../design-system";
import { adminHeaderActions } from "../platform/adminActions";
import { adminNavItems, adminTitle, type AdminNavKey } from "../platform/adminNav";
import type { ReactAdminMountOptions } from "../platform/types";
import { AdminAccount } from "./screens/AdminAccount";
import { AdminDashboard } from "./screens/AdminDashboard";
import { AdminEquipment } from "./screens/AdminEquipment";
import { AdminCourseDemand } from "./screens/AdminCourseDemand";
import { AdminLectures } from "./screens/AdminLectures";
import { AdminLogs } from "./screens/AdminLogs";
import { AdminNotices } from "./screens/AdminNotices";
import { AdminReports } from "./screens/AdminReports";
import { AdminReservations } from "./screens/AdminReservations";
import { AdminSettings } from "./screens/AdminSettings";
import { AdminUsers } from "./screens/AdminUsers";

type AdminAppProps = Omit<ReactAdminMountOptions, "root">;

function handleAction(action: () => Promise<void> | void) {
  return () => {
    void action();
  };
}

const MOBILE_PRIMARY_NAV = [
  ["dashboard", "대시보드", "fileText"],
  ["users", "학생", "user"],
  ["reservations", "예약", "check"],
  ["equipment", "기자재", "camera"]
] as const;

const MORE_NAV = [
  ["reports", "보고서"],
  ["lectures", "비교과 특강"],
  ["course-demand", "교과 수요조사"],
  ["notices", "공지사항"],
  ["logs", "로그/세션"],
  ["settings", "설정"]
] as const;

function renderDesktopNavigation(
  view: string,
  onChange: (nextView: AdminNavKey) => void
) {
  return React.createElement(
    "nav",
    { className: "gju-admin-nav gju-admin-nav--sidebar", "aria-label": "관리자 메뉴" },
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

function renderMoreSheet(
  open: boolean,
  view: string,
  onChange: (nextView: AdminNavKey) => void,
  onClose: () => void
) {
  return React.createElement(
    GjuDialog,
    {
      open,
      title: "더보기",
      cancelLabel: "닫기",
      confirmLabel: "닫기",
      onClose,
      onCancel: onClose,
      onConfirm: onClose,
      showActions: false
    },
    React.createElement(
      "nav",
      { className: "gju-mobile-more-nav", "aria-label": "추가 관리자 메뉴" },
      ...MORE_NAV.map(([key, label]) =>
        React.createElement(
          "button",
          {
            key,
            type: "button",
            className: "gju-mobile-more-nav__item",
            "aria-current": view === key ? "page" : undefined,
            onClick: () => {
              onChange(key);
              onClose();
            }
          },
          label
        )
      )
    )
  );
}

function renderMobileBottomNavigation(
  view: string,
  onChange: (nextView: AdminNavKey) => void,
  moreOpen: boolean,
  onOpenMore: () => void,
  onCloseMore: () => void
) {
  const moreActive = MORE_NAV.some(([key]) => key === view);
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      "nav",
      { className: "gju-admin-nav gju-admin-nav--bottom", "aria-label": "관리자 모바일 메뉴" },
      ...MOBILE_PRIMARY_NAV.map(([key, label, icon]) =>
        React.createElement(GjuIconButton, {
          key,
          label,
          icon,
          className: "gju-admin-nav__item gju-admin-nav__item--icon",
          "aria-current": view === key ? "page" : undefined,
          onClick: () => onChange(key)
        })
      ),
      React.createElement(GjuIconButton, {
        key: "more",
        label: "더보기",
        icon: "plus",
        className: "gju-admin-nav__item gju-admin-nav__item--icon",
        "aria-current": moreActive ? "page" : undefined,
        "aria-haspopup": "dialog",
        "aria-expanded": moreOpen ? "true" : "false",
        onClick: onOpenMore
      })
    ),
    renderMoreSheet(moreOpen, view, onChange, onCloseMore)
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
  actions
}: AdminAppProps) {
  const [moreOpen, setMoreOpen] = React.useState(false);
  const view = state.adminView || "dashboard";
  const headerActions = adminHeaderActions(actions, {
    refreshing: Boolean(state.adminRefresh?.refreshing)
  });
  const title = adminTitle(view);
  const navigate = (nextView: AdminNavKey) => {
    void actions.setAdminView(nextView);
  };

  let content: React.ReactNode;
  if (view === "dashboard") {
    content = React.createElement(AdminDashboard, { state, actions });
  } else if (view === "users") {
    content = React.createElement(AdminUsers, { state, actions });
  } else if (view === "reservations") {
    content = React.createElement(AdminReservations, { state, actions });
  } else if (view === "equipment") {
    content = React.createElement(AdminEquipment, { state, actions });
  } else if (view === "reports") {
    content = React.createElement(AdminReports, { state, actions });
  } else if (view === "lectures") {
    content = React.createElement(AdminLectures, { state, actions });
  } else if (view === "course-demand") {
    content = React.createElement(AdminCourseDemand, { state, actions });
  } else if (view === "notices") {
    content = React.createElement(AdminNotices, { state, actions });
  } else if (view === "logs") {
    content = React.createElement(AdminLogs, { state, actions });
  } else if (view === "settings") {
    content = React.createElement(AdminSettings, { state, actions });
  } else if (view === "account") {
    content = React.createElement(AdminAccount, { state, actions });
  } else {
    content = React.createElement(AdminDashboard, { state, actions });
  }

  return React.createElement(
    GjuAppShell,
    {
      desktopNav: renderDesktopNavigation(view, navigate),
      header: renderHeader(title, headerActions),
      mobileHeader: renderHeader(title, headerActions),
      mobileBottomNav: renderMobileBottomNavigation(
        view,
        navigate,
        moreOpen,
        () => setMoreOpen(true),
        () => setMoreOpen(false)
      )
    },
    content
  );
}
