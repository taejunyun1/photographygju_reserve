import React from "react";
import { Dialog as AstryxDialog } from "@astryxdesign/core/Dialog";

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
  const titleId = `gju-dialog-title-${React.useId()}`;

  if (!open) {
    return null;
  }

  return React.createElement(
    AstryxDialog,
    {
      isOpen: open,
      onOpenChange: (isOpen) => {
        if (!isOpen) {
          onCancel?.();
        }
      },
      width: "min(100%, 480px)",
      padding: 0,
      purpose: "info",
      className: cx("gju-dialog", motionClass.dialog),
      "aria-labelledby": titleId,
      children: React.createElement(
        "div",
        null,
        React.createElement("h2", { id: titleId, className: "gju-dialog__title" }, title),
        body ? React.createElement("div", { className: "gju-dialog__body" }, body) : null,
        React.createElement(
          "div",
          { className: "gju-dialog__actions" },
          React.createElement(GjuButton, { variant: "ghost", tone: "neutral", onClick: onCancel }, cancelLabel),
          React.createElement(GjuButton, { tone: tone === "danger" ? "danger" : "primary", onClick: onConfirm }, confirmLabel)
        )
      )
    }
  );
}
