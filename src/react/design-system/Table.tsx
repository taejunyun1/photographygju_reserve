import React from "react";

import { cx } from "./classes";

export type GjuTableProps = React.TableHTMLAttributes<HTMLTableElement>;

export function GjuTable({ className, children, ...props }: GjuTableProps) {
  return React.createElement(
    "div",
    { className: "gju-table" },
    React.createElement(
      "table",
      {
        ...props,
        className: cx("gju-table__element", className)
      },
      children
    )
  );
}
