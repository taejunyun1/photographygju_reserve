import React, { useEffect, useRef, useState } from "react";

import { GjuButton, GjuCard } from "../../design-system";
import { ReportDamageSection } from "./ReportDamageSection";
import { ReportPhotoPicker } from "./ReportPhotoPicker";
import type { StudentActions, StudentReportPayload, StudentReportPhoto, StudentReservation } from "../types";
import { dataUrlToFile, loadReportDraftLocal, saveReportDraftLocal } from "../reportDraftStorage";

const EMPTY_REPORT: StudentReportPayload = {
  actualTime: "",
  participants: "",
  usedEquipment: "",
  resultPhotoUrl: "",
  cleanupConfirmed: false,
  returnReadyConfirmed: false,
  studioDamageAnswer: undefined,
  equipmentDamageAnswer: undefined,
  damageDescription: "",
  equipmentDamageDescription: "",
  notes: "",
  photos: []
};

function currentPhotos(payload: StudentReportPayload) {
  return Array.isArray(payload.photos) ? [...payload.photos] : [];
}

export function ReportForm({ reservation, actions }: { reservation: StudentReservation; actions: StudentActions }) {
  const formRef = useRef<HTMLDivElement>(null);
  const isEquipment = reservation.type === "equipment";
  const [form, setForm] = useState<StudentReportPayload>({
    ...EMPTY_REPORT,
    ...(reservation.reportDraft?.fields || {}),
    actualTime: String(reservation.reportDraft?.fields?.actualTime || (reservation.fields.timeSlots || []).join(", ")),
    participants: String(reservation.reportDraft?.fields?.participants || reservation.fields.participants || reservation.fields.participantCount || ""),
    photos: (reservation.reportDraft?.photos || []).map((photo) => ({ ...photo, status: photo.status || "uploaded" }))
  });
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving_local" | "local_saved" | "saving_server" | "server_saved" | "failed">("idle");
  const [error, setError] = useState("");
  const [restoredLocal, setRestoredLocal] = useState(false);

  function setField<Key extends keyof StudentReportPayload>(key: Key, value: StudentReportPayload[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function setPhotos(photos: StudentReportPhoto[]) {
    setForm((current) => ({ ...current, photos }));
  }

  useEffect(() => {
    const heading = formRef.current?.querySelector<HTMLElement>("h2");
    if (!heading) return;
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }, [reservation.id]);

  useEffect(() => {
    let cancelled = false;
    const userId = String(reservation.userId || "current");
    void (async () => {
      const local = await loadReportDraftLocal(userId, reservation.id).catch(() => null);
      if (cancelled || !local) return;
      const serverUpdatedAt = Date.parse(String(reservation.reportDraft?.updatedAt || "")) || 0;
      const localUpdatedAt = Date.parse(local.updatedAt) || 0;
      if (localUpdatedAt <= serverUpdatedAt) return;
      const photos = await Promise.all((local.photos || []).map(async (photo) => ({
        ...photo,
        file: photo.dataUrl ? await dataUrlToFile(photo.dataUrl, `${photo.id || "report-photo"}.jpg`) : undefined,
        status: photo.status || "local"
      })));
      if (cancelled) return;
      setForm((current) => ({ ...current, ...local.fields, photos }));
      setRestoredLocal(true);
    })();
    return () => { cancelled = true; };
  }, [reservation.id, reservation.reportDraft?.updatedAt, reservation.userId]);

  useEffect(() => {
    const timer = globalThis.setTimeout(() => {
      setSaveState("saving_local");
      void saveReportDraftLocal(String(reservation.userId || "current"), reservation.id, form, Number(reservation.reportDraft?.revision || 0))
        .then(() => setSaveState("local_saved"))
        .catch(() => setSaveState("failed"));
    }, 800);
    return () => globalThis.clearTimeout(timer);
  }, [form, reservation.id, reservation.reportDraft?.revision, reservation.userId]);

  const allPhotos = currentPhotos(form);
  const hasRentalEquipment = isEquipment || Boolean(
    reservation.fields.requiredEquipment ||
    reservation.fields.equipmentItemIds?.length ||
    reservation.equipmentItems?.length ||
    form.equipmentDamageAnswer
  );
  const damageChecks = isEquipment
    ? [{ kind: "equipment" as const, answer: form.equipmentDamageAnswer || "", description: form.equipmentDamageDescription || "", category: "equipment_damage" }]
    : [
      { kind: "studio" as const, answer: form.studioDamageAnswer || "", description: form.damageDescription || "", category: "studio_damage" },
      ...(hasRentalEquipment ? [{ kind: "equipment" as const, answer: form.equipmentDamageAnswer || "", description: form.equipmentDamageDescription || "", category: "equipment_damage" }] : [])
    ];

  async function saveDraft() {
    if (!actions.saveReportDraft || saving) return;
    setSaving(true);
    setError("");
    setSaveState("saving_server");
    try {
      await actions.saveReportDraft(reservation.id, form);
      setSaveState("server_saved");
    } catch (caught) {
      setSaveState("failed");
      setError(caught instanceof Error ? caught.message : "임시저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={formRef}>
      <GjuCard title={`${isEquipment ? "기자재" : "스튜디오"} 사용 보고서`} className="student-react-report-form-card">
        <div className="report-reservation-summary">
          <strong>{reservation.fields.reservedDate || "사용일 미정"}</strong>
          <span>{isEquipment ? reservation.equipmentItems?.map((item) => [item.code, item.name].filter(Boolean).join(" · ")).join(", ") : (reservation.fields.studioSpaces || [reservation.fields.studioSpace]).filter(Boolean).join(", ")}</span>
        </div>
        <p className="muted" role="status">
          {restoredLocal ? "기기에서 저장한 내용을 복구했습니다. " : ""}
          {saveState === "saving_local" ? "기기에 저장 중…" : saveState === "local_saved" ? "기기에 저장됨" : saveState === "saving_server" ? "서버에 저장 중…" : saveState === "server_saved" ? "서버에 저장됨" : saveState === "failed" ? "저장 실패 · 다시 시도하세요" : "입력 내용은 잠시 후 기기에 자동 저장됩니다."}
        </p>
        <form
          className="report-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (submitting) return;
            setError("");
            if (damageChecks.some((check) => !check.answer)) { setError(hasRentalEquipment ? "스튜디오와 대여 기자재의 파손·이상 여부를 모두 선택하세요." : "파손·이상 여부를 선택하세요."); return; }
            if (damageChecks.some((check) => check.answer === "yes" && (!check.description.trim() || allPhotos.filter((photo) => photo.category === check.category).length < 1))) { setError("파손·이상 상세와 사진을 1장 이상 입력하세요."); return; }
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
          {!isEquipment ? <>
            <div className="field"><label htmlFor="report-actual-time">실제 사용 시간</label><input id="report-actual-time" className="input" required value={form.actualTime || ""} onChange={(event) => setField("actualTime", event.target.value)} /></div>
            <div className="field"><label htmlFor="report-participants">실제 사용 인원</label><input id="report-participants" className="input" required value={form.participants || ""} onChange={(event) => setField("participants", event.target.value)} /></div>
            <div className="field"><label htmlFor="report-used-equipment">사용 장비</label><textarea id="report-used-equipment" className="textarea" value={form.usedEquipment || ""} onChange={(event) => setField("usedEquipment", event.target.value)} /></div>
          </> : null}

          {damageChecks.map((check) => {
            const photos = allPhotos.filter((photo) => photo.category === check.category);
            const otherPhotoCount = allPhotos.length - photos.length;
            return <React.Fragment key={check.kind}>
              <ReportDamageSection reservation={reservation} kind={check.kind} answer={check.answer as "yes" | "no" | ""} description={check.description} onChange={(patch) => setForm((current) => ({ ...current, ...patch }))} />
              <ReportPhotoPicker category={check.category} maxPhotos={5 - otherPhotoCount} photos={photos} onChange={(nextPhotos) => setPhotos([...currentPhotos(form).filter((photo) => photo.category !== check.category), ...nextPhotos])} />
            </React.Fragment>;
          })}

          <label className="field consent"><span><input type="checkbox" checked={Boolean(isEquipment ? form.returnReadyConfirmed : form.cleanupConfirmed)} required onChange={(event) => setField(isEquipment ? "returnReadyConfirmed" : "cleanupConfirmed", event.target.checked)} /> {isEquipment ? "반납할 기자재의 상태와 구성품을 확인했습니다." : "정리정돈을 완료했습니다."}</span></label>
          <div className="field"><label htmlFor="report-notes">비고</label><textarea id="report-notes" className="textarea" maxLength={2000} value={form.notes || ""} onChange={(event) => setField("notes", event.target.value)} /></div>
          {error ? <p className="student-react-submit-error" role="alert">{error}</p> : null}
          <div className="row-actions">
            {actions.saveReportDraft ? <GjuButton type="button" variant="outline" icon="fileText" loading={saving} disabled={submitting} onClick={() => void saveDraft()}>임시저장</GjuButton> : null}
            <GjuButton type="submit" icon="check" loading={submitting}>보고서 제출</GjuButton>
            <GjuButton type="button" variant="ghost" disabled={submitting} onClick={() => actions.openReport(null)}>닫기</GjuButton>
          </div>
        </form>
      </GjuCard>
    </div>
  );
}
