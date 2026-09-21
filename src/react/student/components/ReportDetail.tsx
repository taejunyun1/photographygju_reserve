import React, { useState } from "react";

import { GjuButton, GjuCard, GjuStatusBadge } from "../../design-system";
import type { StudentActions, StudentReportSummary, StudentReservation } from "../types";

function answerLabel(answer: unknown) {
  return answer === "yes" ? "있음 (O)" : answer === "no" ? "없음 (X)" : answer === "not_applicable" ? "해당 없음" : "미응답";
}

export function ReportDetail({ reservation, report, actions, onClose }: { reservation: StudentReservation; report: StudentReportSummary; actions: StudentActions; onClose?: () => void }) {
  const [activePhotoId, setActivePhotoId] = useState("");
  const [photoData, setPhotoData] = useState<{ id: string; data: string } | null>(null);
  const [photoError, setPhotoError] = useState("");
  const fields = report.fields || {};
  const checks = (fields.checks || {}) as { studio?: { answer?: string; description?: string }; equipment?: { answer?: string; description?: string } };
  const photos = Array.isArray(report.photos) ? report.photos : [];

  async function openPhoto(photoId: string) {
    if (!actions.loadReportPhoto) return;
    setActivePhotoId(photoId);
    setPhotoError("");
    try {
      const result = await actions.loadReportPhoto(report.id, photoId);
      setPhotoData({ id: photoId, data: result.data });
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "사진을 불러오지 못했습니다.");
    }
  }

  return <GjuCard title="제출 내용" actions={onClose ? <GjuButton variant="ghost" onClick={onClose}>닫기</GjuButton> : null}>
    <div className="report-reservation-summary">
      <strong>{reservation.fields.reservedDate || "사용일 미정"}</strong>
      <span>{report.type === "equipment" ? reservation.equipmentItems?.map((item) => [item.code, item.name].filter(Boolean).join(" · ")).join(", ") : (reservation.fields.studioSpaces || [reservation.fields.studioSpace]).filter(Boolean).join(", ")}</span>
    </div>
    <div className="chips">
      <GjuStatusBadge tone={report.status === "reviewed" ? "green" : "blue"}>{report.status === "reviewed" ? "관리자 확인 완료" : "제출 완료"}</GjuStatusBadge>
      <span className="muted">{report.submittedAt ? new Date(report.submittedAt).toLocaleString("ko-KR") : "제출 시각 미상"}</span>
    </div>
    <dl className="property-list compact">
      {report.type === "studio" ? <>
        <div><dt>실제 사용 시간</dt><dd>{String(fields.actualTime || "-")}</dd></div>
        <div><dt>사용 인원</dt><dd>{String(fields.participants || "-")}</dd></div>
        <div><dt>정리정돈</dt><dd>{fields.cleanupConfirmed === true ? "확인" : "미확인"}</dd></div>
      </> : <div><dt>반납 상태</dt><dd>{fields.returnReadyConfirmed === true ? "구성품 확인" : "미확인"}</dd></div>}
      {checks.studio ? <div><dt>스튜디오 점검</dt><dd>{answerLabel(checks.studio.answer)}{checks.studio.description ? ` · ${checks.studio.description}` : ""}</dd></div> : null}
      {checks.equipment ? <div><dt>대여 기자재 점검</dt><dd>{answerLabel(checks.equipment.answer)}{checks.equipment.description ? ` · ${checks.equipment.description}` : ""}</dd></div> : null}
      <div><dt>비고</dt><dd>{String(fields.notes || "-")}</dd></div>
    </dl>
    <div className="report-photo-picker">
      <div className="report-photo-picker__head"><strong>첨부 사진 {photos.length}장</strong><span className="muted">사진을 누르면 크게 볼 수 있습니다.</span></div>
      <div className="report-photo-picker__grid">
        {photos.map((photo) => <button key={photo.id} type="button" className="report-photo-thumb" onClick={() => photo.id && void openPhoto(photo.id)} disabled={!actions.loadReportPhoto}>
          {photoData && photoData.id === photo.id ? <img src={photoData.data} alt="제출 사진" /> : <span>{photo.category || "첨부"}</span>}
        </button>)}
      </div>
      {activePhotoId && photoError ? <p className="student-react-submit-error" role="alert">{photoError}</p> : null}
      {photoData ? <div className="report-photo-lightbox" role="dialog" aria-label="제출 사진 크게 보기" onClick={() => { setPhotoData(null); setActivePhotoId(""); }}><img src={photoData.data} alt="제출 사진 크게 보기" /></div> : null}
    </div>
  </GjuCard>;
}
