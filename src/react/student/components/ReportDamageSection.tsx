import React from "react";

import type { StudentReportPayload, StudentReservation } from "../types";

type ReportDamageSectionProps = {
  reservation: StudentReservation;
  kind: "studio" | "equipment";
  answer: "yes" | "no" | "";
  description: string;
  onChange: (patch: Partial<StudentReportPayload>) => void;
};

export function ReportDamageSection({ reservation, kind, answer, description, onChange }: ReportDamageSectionProps) {
  const isStudio = kind === "studio";
  const label = isStudio ? "스튜디오 기자재·시설" : "대여 기자재";
  const fieldName = isStudio ? "studioDamageAnswer" : "equipmentDamageAnswer";
  return (
    <fieldset className="report-damage-section">
      <legend>{label} 파손·이상 여부</legend>
      <div className="report-choice-group" role="radiogroup" aria-label={`${label} 파손·이상 여부`}>
        <label className={answer === "no" ? "report-choice selected" : "report-choice"}>
          <input
            type="radio"
            name={fieldName}
            value="no"
            checked={answer === "no"}
            onChange={() => onChange(isStudio ? { studioDamageAnswer: "no" } : { equipmentDamageAnswer: "no" })}
          />
          없음 (X)
        </label>
        <label className={answer === "yes" ? "report-choice selected" : "report-choice"}>
          <input
            type="radio"
            name={fieldName}
            value="yes"
            checked={answer === "yes"}
            onChange={() => onChange(isStudio ? { studioDamageAnswer: "yes" } : { equipmentDamageAnswer: "yes" })}
          />
          있음 (O)
        </label>
      </div>
      {answer === "yes" ? (
        <div className="field report-damage-detail">
          <label htmlFor={`report-${kind}-damage-description`}>파손·이상 상세</label>
          <textarea
            id={`report-${kind}-damage-description`}
            className="textarea"
            maxLength={2000}
            required
            value={description}
            onChange={(event) => onChange(isStudio ? { studioDamageAnswer: "yes", damageDescription: event.target.value } : { equipmentDamageAnswer: "yes", equipmentDamageDescription: event.target.value })}
            placeholder={isStudio ? "시설명·위치와 상태를 적어 주세요." : "장비명·코드와 상태를 적어 주세요."}
          />
          {!isStudio && reservation.equipmentItems?.length ? <p className="muted">대여 장비: {reservation.equipmentItems.map((item) => [item.code, item.name].filter(Boolean).join(" · ")).join(", ")}</p> : null}
        </div>
      ) : null}
    </fieldset>
  );
}

