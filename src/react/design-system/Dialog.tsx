import React from "react";

import { GjuButton } from "./Button";
import { cx } from "./classes";
import { motionClass } from "./motion";

export type GjuDialogProps = {
  open: boolean;
  title: React.ReactNode;
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  tone?: "neutral" | "danger";
};

export function GjuDialog({
  open,
  title,
  body,
  confirmLabel = "확인",
  cancelLabel = "취소",
  onConfirm,
  onCancel,
  tone = "neutral"
}: GjuDialogProps) {
  if (!open) {
    return null;
  }

  return React.createElement(
    "div",
    { className: "gju-dialog-backdrop" },
    React.createElement(
      "div",
      {
        className: cx("gju-dialog", motionClass.dialog),
        role: "dialog",
        "aria-modal": true,
        "aria-labelledby": "gju-dialog-title"
      },
      React.createElement("h2", { id: "gju-dialog-title", className: "gju-dialog__title" }, title),
      body ? React.createElement("div", { className: "gju-dialog__body" }, body) : null,
      React.createElement(
        "div",
        { className: "gju-dialog__actions" },
        React.createElement(GjuButton, { variant: "ghost", tone: "neutral", onClick: onCancel }, cancelLabel),
        React.createElement(GjuButton, { tone: tone === "danger" ? "danger" : "primary", onClick: onConfirm }, confirmLabel)
      )
    )
  );
}
