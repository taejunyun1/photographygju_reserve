import React, { useEffect, useRef, useState } from "react";

import { GjuButton, GjuCard } from "../../design-system";
import type { StudentActions, StudentReportPayload, StudentReservation } from "../types";

const EMPTY_REPORT: StudentReportPayload = {
  actualTime: "",
  participants: "",
  usedEquipment: "",
  resultPhotoUrl: "",
  cleanupConfirmed: false,
  damageFound: false,
  damageDescription: "",
  notes: ""
};

export function ReportForm({ reservation, actions }: { reservation: StudentReservation; actions: StudentActions }) {
  const formRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState<StudentReportPayload>({
    ...EMPTY_REPORT,
    actualTime: (reservation.fields.timeSlots || []).join(", "),
    participants: String(reservation.fields.participants || "")
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function setField<Key extends keyof StudentReportPayload>(key: Key, value: StudentReportPayload[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  useEffect(() => {
    const heading = formRef.current?.querySelector<HTMLElement>("h2");
    if (!heading) return;
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }, [reservation.id]);

  return (
    <div ref={formRef}>
    <GjuCard title="스튜디오 보고서" className="student-react-report-form-card">
      <form
        className="report-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (submitting) return;
          setError("");
          setSubmitting(true);
          try {
            await actions.submitReport(reservation.id, form);
          } catch (submissionError) {
            setError(submissionError instanceof Error ? submissionError.message : "보고서를 제출하지 못했습니다.");
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <div className="field"><label htmlFor="report-actual-time">실제 사용 시간</label><input id="report-actual-time" className="input" required value={form.actualTime} onChange={(event) => setField("actualTime", event.target.value)} /></div>
        <div className="field"><label htmlFor="report-participants">실제 사용 인원</label><input id="report-participants" className="input" required value={form.participants} onChange={(event) => setField("participants", event.target.value)} /></div>
        <div className="field"><label htmlFor="report-used-equipment">사용 장비</label><textarea id="report-used-equipment" className="textarea" value={form.usedEquipment} onChange={(event) => setField("usedEquipment", event.target.value)} /></div>
        <div className="field"><label htmlFor="report-photo-url">결과 사진 링크</label><input id="report-photo-url" className="input" type="url" value={form.resultPhotoUrl} onChange={(event) => setField("resultPhotoUrl", event.target.value)} /></div>
        <label className="field consent"><span><input type="checkbox" checked={form.cleanupConfirmed} required onChange={(event) => setField("cleanupConfirmed", event.target.checked)} /> 정리정돈을 완료했습니다.</span></label>
        <label className="field consent"><span><input type="checkbox" checked={form.damageFound} onChange={(event) => setField("damageFound", event.target.checked)} /> 파손 또는 이상이 있습니다.</span></label>
        <div className="field"><label htmlFor="report-damage-description">파손/이상 내용</label><textarea id="report-damage-description" className="textarea" value={form.damageDescription} onChange={(event) => setField("damageDescription", event.target.value)} /></div>
        <div className="field"><label htmlFor="report-notes">비고</label><textarea id="report-notes" className="textarea" value={form.notes} onChange={(event) => setField("notes", event.target.value)} /></div>
        {error ? <p className="student-react-submit-error" role="alert">{error}</p> : null}
        <div className="row-actions">
          <GjuButton type="submit" icon="check" loading={submitting}>보고서 제출</GjuButton>
          <GjuButton type="button" variant="ghost" disabled={submitting} onClick={() => actions.openReport(null)}>닫기</GjuButton>
        </div>
      </form>
    </GjuCard>
    </div>
  );
}
