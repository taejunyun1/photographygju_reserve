import React from "react";

import { cx } from "./classes";
import { motionClass } from "./motion";

export type GjuAppShellProps = React.HTMLAttributes<HTMLDivElement> & {
  sidebar?: React.ReactNode;
  header?: React.ReactNode;
};

export function GjuAppShell({
  sidebar,
  header,
  className,
  children,
  ...props
}: GjuAppShellProps) {
  return React.createElement(
    "div",
    {
      ...props,
      className: cx("gju-app-shell", motionClass.screen, className)
    },
    sidebar ? React.createElement("aside", { className: "gju-app-shell__sidebar" }, sidebar) : null,
    React.createElement(
      "div",
      { className: "gju-app-shell__main" },
      header ? React.createElement("header", { className: "gju-app-shell__header" }, header) : null,
      React.createElement("main", { className: "gju-app-shell__content" }, children)
    )
  );
}
