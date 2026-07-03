import React from "react";

import { cx } from "./classes";

export type GjuEmptyStateProps = React.HTMLAttributes<HTMLDivElement> & {
  title: React.ReactNode;
  message?: React.ReactNode;
  action?: React.ReactNode;
};

export function GjuEmptyState({
  title,
  message,
  action,
  className,
  ...props
}: GjuEmptyStateProps) {
  return React.createElement(
    "div",
    {
      ...props,
      className: cx("gju-empty-state", className)
    },
    React.createElement("h2", { className: "gju-empty-state__title" }, title),
    message ? React.createElement("p", { className: "gju-empty-state__message" }, message) : null,
    action ? React.createElement("div", { className: "gju-empty-state__action" }, action) : null
  );
}
