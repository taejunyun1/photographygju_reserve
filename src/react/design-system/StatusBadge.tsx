import React from "react";

import { cx } from "./classes";

type GjuStatusBadgeTone = "green" | "amber" | "red" | "blue" | "neutral";

export type GjuStatusBadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: GjuStatusBadgeTone;
};

export function GjuStatusBadge({
  tone = "neutral",
  className,
  children,
  ...props
}: GjuStatusBadgeProps) {
  return React.createElement(
    "span",
    {
      ...props,
      className: cx("gju-status-badge", className),
      "data-tone": tone
    },
    children
  );
}
