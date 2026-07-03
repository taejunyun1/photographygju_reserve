import React from "react";
import { Dialog as AstryxDialog } from "@astryxdesign/core/Dialog";

import { GjuButton, GjuIconButton } from "./Button";
import { cx } from "./classes";
import { motionClass } from "./motion";

export type GjuDialogProps = {
  open: boolean;
  title: React.ReactNode;
  body?: React.ReactNode;
  children?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  onClose?: () => void;
  tone?: "neutral" | "danger";
};

export function GjuDialog({
  open,
  title,
  body,
  children,
  confirmLabel = "확인",
  cancelLabel = "취소",
  onConfirm,
  onCancel,
  onClose,
  tone = "neutral"
}: GjuDialogProps) {
  const titleId = `gju-dialog-title-${React.useId()}`;
  const dialogBody = body ?? children;
  const handleClose = () => {
    onCancel?.();
    if (onClose && onClose !== onCancel) {
      onClose();
    }
  };

  if (!open) {
    return null;
  }

  return React.createElement(
    AstryxDialog,
    {
      isOpen: open,
      onOpenChange: (isOpen) => {
        if (!isOpen) {
          handleClose();
        }
      },
      width: "min(100%, 480px)",
      padding: 0,
      purpose: "info",
      role: "dialog",
      className: cx("gju-dialog", motionClass.dialog),
      "aria-labelledby": titleId,
      children: React.createElement(
        "div",
        null,
        React.createElement(
          "div",
          { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" } },
          React.createElement("h2", { id: titleId, className: "gju-dialog__title" }, title),
          React.createElement(GjuIconButton, {
            label: "닫기",
            icon: "x",
            onClick: handleClose
          })
        ),
        dialogBody ? React.createElement("div", { className: "gju-dialog__body" }, dialogBody) : null,
        React.createElement(
          "div",
          { className: "gju-dialog__actions" },
          React.createElement(GjuButton, { variant: "ghost", tone: "neutral", onClick: handleClose }, cancelLabel),
          React.createElement(GjuButton, { tone: tone === "danger" ? "danger" : "primary", onClick: onConfirm }, confirmLabel)
        )
      )
    }
  );
}
