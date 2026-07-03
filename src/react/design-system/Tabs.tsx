import React from "react";

import { cx } from "./classes";

export type GjuTabItem = {
  key: string;
  label: React.ReactNode;
  disabled?: boolean;
};

export type GjuTabsProps = {
  items: GjuTabItem[];
  activeKey: string;
  onChange?: (key: string) => void;
  className?: string;
};

export function GjuTabs({ items, activeKey, onChange, className }: GjuTabsProps) {
  return React.createElement(
    "div",
    {
      className: cx("gju-tabs", className),
      role: "tablist"
    },
    ...items.map((item) =>
      React.createElement(
        "button",
        {
          key: item.key,
          type: "button",
          role: "tab",
          disabled: item.disabled,
          className: "gju-tabs__tab",
          "aria-selected": item.key === activeKey,
          "data-active": item.key === activeKey ? "true" : undefined,
          onClick: () => onChange?.(item.key)
        },
        item.label
      )
    )
  );
}
