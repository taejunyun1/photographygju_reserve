import React from "react";
import { Table as AstryxTable } from "@astryxdesign/core/Table";

import { cx } from "./classes";

export type GjuTableProps = React.TableHTMLAttributes<HTMLTableElement>;

export function GjuTable({ className, children, ...props }: GjuTableProps) {
  return React.createElement(
    "div",
    { className: "gju-table" },
    React.createElement(
      AstryxTable as React.ComponentType<any>,
      {
        ...props,
        className: cx("gju-table__element", className)
      },
      children
    )
  );
}
