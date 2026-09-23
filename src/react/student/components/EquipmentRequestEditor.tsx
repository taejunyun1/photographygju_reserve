import React from "react";

import { GjuButton } from "../../design-system";
import type { StudentEquipmentRequest } from "../types";

const EMPTY_REQUEST: StudentEquipmentRequest = { name: "", quantity: 1, note: "" };

export function EquipmentRequestEditor({
  rows,
  onChange,
  title,
  description,
  idPrefix
}: {
  rows: readonly StudentEquipmentRequest[];
  onChange: (rows: StudentEquipmentRequest[]) => void;
  title: string;
  description: string;
  idPrefix: string;
}) {
  const visibleRows = rows.length ? rows : [EMPTY_REQUEST];

  function updateRow(index: number, patch: Partial<StudentEquipmentRequest>) {
    onChange(visibleRows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : { ...row }));
  }

  return (
    <section className="student-react-equipment-request-editor" aria-label={title}>
      <div className="student-react-equipment-request-editor__heading">
        <h3>{title}</h3>
        <p className="muted">{description}</p>
      </div>
      <div className="student-react-equipment-request-editor__rows">
        {visibleRows.map((row, index) => (
          <div className="student-react-equipment-request-editor__row" key={`${idPrefix}-${index}`}>
            <div className="student-react-equipment-request-editor__row-heading">
              <strong>요청 장비 {index + 1}</strong>
              {rows.length ? <button type="button" className="student-react-equipment-request-editor__remove" onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))} aria-label={`요청 장비 ${index + 1} 삭제`}>삭제</button> : null}
            </div>
            <div className="student-react-equipment-request-editor__fields">
              <div className="field">
                <label htmlFor={`${idPrefix}-name-${index}`}>장비명</label>
                <input id={`${idPrefix}-name-${index}`} className="input" maxLength={120} value={row.name} placeholder="예: 무선 마이크" onChange={(event) => updateRow(index, { name: event.target.value })} />
              </div>
              <div className="field">
                <label htmlFor={`${idPrefix}-quantity-${index}`}>수량</label>
                <input id={`${idPrefix}-quantity-${index}`} className="input" type="number" min={1} max={99} step={1} value={row.quantity} onChange={(event) => updateRow(index, { quantity: Number(event.target.value) })} />
              </div>
            </div>
            <div className="field">
              <label htmlFor={`${idPrefix}-note-${index}`}>추가 설명</label>
              <textarea id={`${idPrefix}-note-${index}`} className="textarea" maxLength={500} value={row.note} placeholder="규격이나 사용 목적을 적어 주세요" onChange={(event) => updateRow(index, { note: event.target.value })} />
            </div>
          </div>
        ))}
      </div>
      <GjuButton variant="outline" disabled={visibleRows.length >= 20 || !visibleRows[visibleRows.length - 1].name.trim()} onClick={() => onChange([...visibleRows.map((row) => ({ ...row })), { ...EMPTY_REQUEST }])}>요청 장비 추가</GjuButton>
      <p className="muted student-react-equipment-request-editor__hint">요청 장비의 제공 여부는 관리자 확인이 필요합니다.</p>
    </section>
  );
}
