import React from "react";

import { cx } from "./classes";
import { motionClass } from "./motion";

export type GjuToastProps = React.HTMLAttributes<HTMLDivElement> & {
  message: React.ReactNode;
};

export function GjuToast({
  message,
  className,
  ...props
}: GjuToastProps) {
  return React.createElement(
    "div",
    {
      ...props,
      className: cx("gju-toast", motionClass.toast, className),
      role: "status",
      "aria-live": "polite"
    },
    React.createElement("span", { className: "gju-toast__message" }, message)
  );
}
