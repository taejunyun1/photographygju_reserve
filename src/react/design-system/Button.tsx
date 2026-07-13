import React from "react";
import { Button as AstryxButton } from "@astryxdesign/core/Button";
import { IconButton as AstryxIconButton } from "@astryxdesign/core/IconButton";

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

function resolveButtonLabel(children: React.ReactNode, ariaLabel?: string) {
  const label = textFromNode(children).trim();
  return label || ariaLabel || "Action";
}

function mapButtonVariant(variant: GjuButtonVariant, tone: GjuButtonTone) {
  if (tone === "danger") {
    return "destructive" as const;
  }

  if (variant === "ghost") {
    return "ghost" as const;
  }

  if (variant === "outline") {
    return "secondary" as const;
  }

  return tone === "neutral" ? "secondary" : "primary";
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
  const ariaLabel = typeof props["aria-label"] === "string" ? props["aria-label"] : undefined;

  return React.createElement(
    AstryxButton,
    {
      ...props,
      type,
      label: resolveButtonLabel(children, ariaLabel),
      variant: mapButtonVariant(variant, tone),
      isLoading: loading,
      isDisabled: disabled || loading,
      icon: icon ? renderButtonIcon(icon) : undefined,
      className: cx("gju-button", className),
      "data-variant": variant,
      "data-tone": tone,
      "data-loading": loading ? "true" : undefined
    },
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
  const busyState = props["aria-busy"];
  const iconButtonProps = {
    ...props,
    type,
    variant: tone === "danger" ? "destructive" as const : "ghost" as const,
    isDisabled: disabled,
    className: cx("gju-icon-button", className),
    "data-tone": tone,
    "aria-label": label,
    title: props.title || label,
    label,
    icon: React.createElement(GjuIcon, { name: icon })
  };
  const button = React.createElement(AstryxIconButton, iconButtonProps, null);

  if (!busyState) {
    return button;
  }

  return React.createElement("span", { className: "gju-icon-button__busy", "aria-busy": busyState }, button);
}
