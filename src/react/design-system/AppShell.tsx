import React from "react";

import { cx } from "./classes";
import { motionClass } from "./motion";

export type GjuAppShellProps = React.HTMLAttributes<HTMLDivElement> & {
  sidebar?: React.ReactNode;
  desktopNav?: React.ReactNode;
  header?: React.ReactNode;
  mobileHeader?: React.ReactNode;
  mobileBottomNav?: React.ReactNode;
};

export function GjuAppShell({
  sidebar,
  desktopNav,
  header,
  mobileHeader,
  mobileBottomNav,
  className,
  children,
  ...props
}: GjuAppShellProps) {
  const sidebarContent = desktopNav ?? sidebar;
  const headerContent = mobileHeader ?? header;

  return React.createElement(
    "div",
    {
      ...props,
      className: cx("gju-app-shell", motionClass.screen, className)
    },
    sidebarContent
      ? React.createElement("aside", { className: "gju-app-shell__sidebar" }, sidebarContent)
      : null,
    React.createElement(
      "div",
      { className: "gju-app-shell__main" },
      headerContent
        ? React.createElement("header", { className: "gju-app-shell__header" }, headerContent)
        : null,
      React.createElement("main", { className: "gju-app-shell__content" }, children),
      mobileBottomNav
        ? React.createElement("div", { className: "gju-app-shell__bottom-nav" }, mobileBottomNav)
        : null
    )
  );
}
