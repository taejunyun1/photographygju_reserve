import React from "react";

import { cx } from "./classes";
import { GjuIcon, type GjuIconName } from "./icons";

type GjuButtonVariant = "solid" | "outline" | "ghost";
type GjuButtonTone = "primary" | "neutral" | "danger" | "success";

export type GjuButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  variant?: GjuButtonVariant;
  tone?: GjuButtonTone;
  icon?: GjuIconName;
  loading?: boolean;
  children?: React.ReactNode;
};

export type GjuIconButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> & {
  label: string;
  icon: GjuIconName;
  tone?: GjuButtonTone;
};

function renderButtonIcon(icon: GjuIconName) {
  return React.createElement(
    "span",
    { className: "gju-button__icon", "aria-hidden": true },
    React.createElement(GjuIcon, { name: icon })
  );
}

function renderLoadingIndicator() {
  return React.createElement("span", {
    className: "gju-button__spinner",
    "aria-hidden": true
  });
}

export function GjuButton({
  variant = "solid",
  tone = "primary",
  icon,
  loading = false,
  className,
  disabled,
  children,
  type = "button",
  ...props
}: GjuButtonProps) {
  return React.createElement(
    "button",
    {
      ...props,
      type,
      disabled: disabled || loading,
      className: cx("gju-button", className),
      "data-variant": variant,
      "data-tone": tone,
      "data-loading": loading ? "true" : undefined
    },
    loading ? renderLoadingIndicator() : icon ? renderButtonIcon(icon) : null,
    children ? React.createElement("span", { className: "gju-button__label" }, children) : null
  );
}

export function GjuIconButton({
  label,
  icon,
  tone = "neutral",
  className,
  type = "button",
  disabled,
  ...props
}: GjuIconButtonProps) {
  return React.createElement(
    "button",
    {
      ...props,
      type,
      disabled,
      className: cx("gju-icon-button", className),
      "data-tone": tone,
      "aria-label": label,
      title: label
    },
    React.createElement(GjuIcon, { name: icon })
  );
}
