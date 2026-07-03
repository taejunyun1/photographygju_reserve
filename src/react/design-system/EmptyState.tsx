import React from "react";
import { EmptyState as AstryxEmptyState } from "@astryxdesign/core/EmptyState";

import { cx } from "./classes";

export type GjuEmptyStateProps = React.HTMLAttributes<HTMLDivElement> & {
  title: React.ReactNode;
  message?: React.ReactNode;
  action?: React.ReactNode;
};

function textFromNode(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map((entry) => textFromNode(entry)).join("");
  }

  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return textFromNode(node.props.children);
  }

  return "";
}

export function GjuEmptyState({
  title,
  message,
  action,
  className,
  ...props
}: GjuEmptyStateProps) {
  return React.createElement(
    AstryxEmptyState,
    {
      ...props,
      title: textFromNode(title).trim() || "상태",
      description: message ? textFromNode(message).trim() || undefined : undefined,
      actions: action ? React.createElement("div", { className: "gju-empty-state__action" }, action) : undefined,
      headingLevel: 2,
      className: cx("gju-empty-state", className)
    }
  );
}
