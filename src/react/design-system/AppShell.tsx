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

  return React.createElement(
    "div",
    {
      ...props,
      className: cx("gju-app-shell", motionClass.screen, className)
    },
    sidebarContent
      ? React.createElement(
          "aside",
          { className: "gju-app-shell__sidebar gju-app-shell__desktop-only" },
          sidebarContent
        )
      : null,
    React.createElement(
      "div",
      { className: "gju-app-shell__main" },
      header
        ? React.createElement("header", { className: "gju-app-shell__header gju-app-shell__desktop-header" }, header)
        : null,
      mobileHeader
        ? React.createElement(
            "header",
            { className: "gju-app-shell__header gju-app-shell__mobile-header gju-app-shell__mobile-only" },
            mobileHeader
          )
        : null,
      React.createElement(
        "main",
        {
          className: cx(
            "gju-app-shell__content",
            mobileBottomNav ? "gju-app-shell__content--with-mobile-bottom-nav" : null
          )
        },
        children
      ),
      mobileBottomNav
        ? React.createElement(
            "div",
            { className: "gju-app-shell__bottom-nav gju-app-shell__mobile-only" },
            mobileBottomNav
          )
        : null
    )
  );
}
