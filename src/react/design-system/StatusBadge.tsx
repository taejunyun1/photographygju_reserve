import React from "react";
import { Badge as AstryxBadge } from "@astryxdesign/core/Badge";

import { cx } from "./classes";

type GjuStatusBadgeTone = "green" | "amber" | "red" | "blue" | "neutral";

export type GjuStatusBadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: GjuStatusBadgeTone;
};

function mapBadgeVariant(tone: GjuStatusBadgeTone) {
  switch (tone) {
    case "green":
      return "success" as const;
    case "amber":
      return "warning" as const;
    case "red":
      return "error" as const;
    case "blue":
      return "info" as const;
    default:
      return "neutral" as const;
  }
}

export function GjuStatusBadge({
  tone = "neutral",
  className,
  children,
  ...props
}: GjuStatusBadgeProps) {
  return React.createElement(
    AstryxBadge,
    {
      ...props,
      label: children,
      variant: mapBadgeVariant(tone),
      className: cx("gju-status-badge", className),
      "data-tone": tone
    }
  );
}
