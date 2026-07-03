import React from "react";

import { cx } from "./classes";
import { motionClass } from "./motion";

export type GjuCardProps = React.HTMLAttributes<HTMLElement> & {
  title?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
};

export function GjuCard({
  title,
  eyebrow,
  actions,
  className,
  children,
  ...props
}: GjuCardProps) {
  const hasHeader = title || eyebrow || actions;

  return React.createElement(
    "section",
    {
      ...props,
      className: cx("gju-card", motionClass.panel, className)
    },
    hasHeader
      ? React.createElement(
          "header",
          { className: "gju-card__header" },
          React.createElement(
            "div",
            { className: "gju-card__heading" },
            eyebrow ? React.createElement("div", { className: "gju-card__eyebrow" }, eyebrow) : null,
            title ? React.createElement("h2", { className: "gju-card__title" }, title) : null
          ),
          actions ? React.createElement("div", { className: "gju-card__actions" }, actions) : null
        )
      : null,
    React.createElement("div", { className: "gju-card__body" }, children)
  );
}
