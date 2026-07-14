import React, { useState } from "react";
import { createPortal } from "react-dom";

import { GjuIconButton } from "../../design-system";
import type { StudentEquipment } from "../types";

type EquipmentSelectionSurfaceProps = {
  items: readonly StudentEquipment[];
  onRemove(id: string): void;
  portalTarget?: Element | null;
};

function SelectionItems({ items, onRemove }: EquipmentSelectionSurfaceProps) {
  if (!items.length) return <p className="muted">선택한 장비가 없습니다.</p>;
  return (
    <div className="student-react-equipment-manifest__items">
      {items.map((item) => (
        <span key={item.id} className="student-react-equipment-manifest__item">
          <span>
            <strong>{item.name || item.code || "기자재"}</strong>
            <small>{item.code || item.category || ""}</small>
          </span>
          <GjuIconButton
            label={`${item.name || item.code || "기자재"} 선택 해제`}
            icon="x"
            onClick={() => onRemove(item.id)}
          />
        </span>
      ))}
    </div>
  );
}

export function EquipmentSelectionSurface({ items, onRemove, portalTarget }: EquipmentSelectionSurfaceProps) {
  const [open, setOpen] = useState(false);
  const panelId = "student-equipment-selection-panel";

  const dock = (
    <aside
      className={`student-react-equipment-dock${open ? " is-open" : ""}`}
      aria-live="polite"
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      {open ? (
        <div id={panelId} className="student-react-equipment-dock__panel" role="region" aria-label="선택한 장비 목록">
          <div className="student-react-equipment-dock__head">
            <strong>선택한 장비</strong>
            <span>{items.length}개</span>
          </div>
          <SelectionItems items={items} onRemove={onRemove} />
        </div>
      ) : null}
      <button
        type="button"
        className="student-react-equipment-dock__toggle"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`선택 장비 ${items.length}개 · ${open ? "목록 닫기" : "목록 보기"}`}
        onClick={() => setOpen((current) => !current)}
      >
        <span><strong>선택 장비</strong><b>{items.length}개</b></span>
        <span>{open ? "목록 닫기" : "목록 보기"}<i aria-hidden="true" /></span>
      </button>
    </aside>
  );

  return (
    <>
      <aside className="student-react-equipment-manifest student-react-equipment-manifest--inline" aria-live="polite">
        <div className="student-react-equipment-manifest__head">
          <strong>선택 목록</strong>
          <span>{items.length}개 선택</span>
        </div>
        <SelectionItems items={items} onRemove={onRemove} />
      </aside>
      {portalTarget ? createPortal(dock, portalTarget) : null}
    </>
  );
}
