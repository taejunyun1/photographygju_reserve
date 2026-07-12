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
  tabClassName?: string;
  ariaLabel?: string;
  id?: string;
  panelId?: string;
  orientation?: "horizontal" | "vertical";
};

function idToken(value: string) {
  return String(value || "tab")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "tab";
}

export function gjuTabId(id: string, key: string) {
  return `${id}-tab-${idToken(key)}`;
}

export function GjuTabs({
  items,
  activeKey,
  onChange,
  className,
  tabClassName,
  ariaLabel = "탭",
  id,
  panelId,
  orientation = "horizontal"
}: GjuTabsProps) {
  const generatedId = React.useId().replace(/[^a-z0-9_-]+/gi, "-");
  const tablistId = id || `gju-tabs-${generatedId}`;
  const buttonRefs = React.useRef(new Map<string, HTMLButtonElement>());

  const moveFocus = (currentKey: string, event: React.KeyboardEvent<HTMLButtonElement>) => {
    const enabled = items.filter((item) => !item.disabled);
    const currentIndex = enabled.findIndex((item) => item.key === currentKey);
    if (currentIndex < 0 || !enabled.length) return;
    const previousKey = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";
    const nextKey = orientation === "vertical" ? "ArrowDown" : "ArrowRight";
    if (![previousKey, nextKey, "Home", "End"].includes(event.key)) return;
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? enabled.length - 1
        : (currentIndex + (event.key === nextKey ? 1 : -1) + enabled.length) % enabled.length;
    const next = enabled[nextIndex];
    event.preventDefault();
    buttonRefs.current.get(next.key)?.focus({ preventScroll: true });
    onChange?.(next.key);
  };

  return React.createElement(
    "div",
    {
      className: cx("gju-tabs", className),
      role: "tablist",
      id: tablistId,
      "aria-label": ariaLabel,
      "aria-orientation": orientation
    },
    ...items.map((item) =>
      React.createElement(
        "button",
        {
          key: item.key,
          type: "button",
          role: "tab",
          id: gjuTabId(tablistId, item.key),
          disabled: item.disabled,
          className: cx("gju-tabs__tab", tabClassName, item.key === activeKey && "active"),
          "aria-selected": item.key === activeKey,
          "aria-controls": panelId,
          tabIndex: item.key === activeKey ? 0 : -1,
          "data-active": item.key === activeKey ? "true" : undefined,
          ref: (element: HTMLButtonElement | null) => {
            if (element) buttonRefs.current.set(item.key, element);
            else buttonRefs.current.delete(item.key);
          },
          onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => moveFocus(item.key, event),
          onClick: () => onChange?.(item.key)
        },
        item.label
      )
    )
  );
}
