import React from "react";

import { GjuButton, GjuCard, GjuEmptyState, GjuStatusBadge } from "../../design-system";
import { ReportForm } from "../components/ReportForm";
import { ScreenHeader } from "../components/StudentPrimitives";
import { isReportDue, reportDeadlineLabel } from "../reporting";
import type { StudentActions, StudentState } from "../types";

export { isReportDue } from "../reporting";

export function ReportsScreen({ state, actions }: { state: StudentState; actions: StudentActions }) {
  const pending = state.myReservations.filter((reservation) => isReportDue(reservation, state.today));
  const submitted = state.myReservations.filter((item) => item.type === "studio" && item.fields.reportStatus === "submitted");
  const deadlineHours = Math.max(1, Number(state.bootstrap.settings.studioReportDeadlineHours || 48));
  const driveUrl = String(state.bootstrap.settings.googleDriveUrl || "").trim();
  const active = driveUrl && state.activeReportReservationId
    ? pending.find((item) => item.id === state.activeReportReservationId)
    : undefined;

  return (
    <section className="grid student-react-reports">
      <ScreenHeader title="보고서" description="스튜디오 사용 후 보고서를 제출합니다." />
      <GjuCard title="보고서 제출 기한">
        <p className="muted">스튜디오 사용 종료 후 {deadlineHours}시간 이내 제출합니다. 결과 사진은 구글 드라이브에 업로드한 뒤 공유 링크를 입력하세요.</p>
        {driveUrl ? <a className="button primary compact" href={driveUrl} target="_blank" rel="noopener noreferrer">구글 드라이브 열기</a> : (
          <div className="student-react-drive-panel__missing" role="alert">
            <GjuStatusBadge tone="amber">드라이브 링크 등록 필요</GjuStatusBadge>
            <span>보고서 작성을 시작할 수 없습니다. 관리자 설정에서 링크를 등록해 주세요.</span>
          </div>
        )}
      </GjuCard>
      {active ? <ReportForm key={active.id} reservation={active} actions={actions} /> : null}
      <GjuCard title="제출이 필요한 보고서">
        {pending.length ? pending.map((reservation) => (
          <div key={reservation.id} className="student-react-report-row">
            <div>
              <div className="chips"><strong>{reservation.fields.reservedDate || "사용일 미정"}</strong><GjuStatusBadge tone="amber">{reportDeadlineLabel(reservation, deadlineHours, state.today)}</GjuStatusBadge></div>
              <p className="muted">{(reservation.fields.timeSlots || []).join(", ")} · {(reservation.fields.studioSpaces || [reservation.fields.studioSpace]).filter(Boolean).join(", ")}</p>
            </div>
            <GjuButton icon="fileText" disabled={!driveUrl} onClick={() => actions.openReport(reservation.id)}>작성</GjuButton>
          </div>
        )) : <GjuEmptyState title="제출할 보고서가 없습니다." message="스튜디오 예약 후 보고서 작성 버튼이 표시됩니다." />}
      </GjuCard>
      <GjuCard title="제출 완료">
        {submitted.length ? submitted.map((reservation) => (
          <div key={reservation.id} className="student-react-report-row"><span>{reservation.fields.reservedDate || "사용일 미정"}</span><GjuStatusBadge tone="green">제출완료</GjuStatusBadge></div>
        )) : <p className="muted">제출 완료된 보고서가 없습니다.</p>}
      </GjuCard>
    </section>
  );
}
