import React from "react";

import { GjuButton, GjuCard, GjuEmptyState, GjuStatusBadge } from "../../design-system";
import { ReportForm } from "../components/ReportForm";
import { ScreenHeader } from "../components/StudentPrimitives";
import { isReportDue, reportDeadlineLabel } from "../reporting";
import type { StudentActions, StudentState } from "../types";

export { isReportDue } from "../reporting";

export function ReportsScreen({ state, actions }: { state: StudentState; actions: StudentActions }) {
  const pending = state.myReservations.filter((reservation) => isReportDue(reservation, state.today));
  const submitted = state.myReservations.filter((item) => ["studio", "equipment"].includes(item.type) && item.fields.reportStatus === "submitted");
  const deadlineHours = Math.max(1, Number(state.bootstrap.settings.studioReportDeadlineHours || 48));
  const active = state.activeReportReservationId
    ? pending.find((item) => item.id === state.activeReportReservationId)
    : undefined;

  return (
    <section className="grid student-react-reports">
      <ScreenHeader title="보고서" description="스튜디오 사용과 기자재 대여 후 사용 상태를 기록합니다." />
      <GjuCard title="보고서 제출 기한">
        <p className="muted">스튜디오는 사용 종료 후 {deadlineHours}시간, 기자재는 반납 후 {Math.max(1, Number(state.bootstrap.settings.equipmentReportDeadlineHours || 48))}시간 이내 제출해 주세요. 파손이 있으면 상세 내용과 사진이 필요합니다.</p>
      </GjuCard>
      {active ? <ReportForm key={active.id} reservation={active} actions={actions} /> : null}
      <GjuCard title="제출이 필요한 보고서">
        {pending.length ? pending.map((reservation) => (
          <div key={reservation.id} className="student-react-report-row">
            <div>
              <div className="chips"><strong>{reservation.fields.reservedDate || "사용일 미정"}</strong><GjuStatusBadge tone="amber">{reportDeadlineLabel(reservation, deadlineHours, state.today)}</GjuStatusBadge></div>
              <p className="muted">{reservation.type === "equipment" ? reservation.equipmentItems?.map((item) => [item.code, item.name].filter(Boolean).join(" · ")).join(", ") : `${(reservation.fields.timeSlots || []).join(", ")} · ${(reservation.fields.studioSpaces || [reservation.fields.studioSpace]).filter(Boolean).join(", ")}`}</p>
            </div>
            <GjuButton icon="fileText" onClick={() => actions.openReport(reservation.id)}>작성</GjuButton>
          </div>
        )) : <GjuEmptyState title="제출할 보고서가 없습니다." message="사용 종료 또는 기자재 반납 후 보고서 작성 버튼이 표시됩니다." />}
      </GjuCard>
      <GjuCard title="제출 완료">
        {submitted.length ? submitted.map((reservation) => (
          <div key={reservation.id} className="student-react-report-row"><span>{reservation.fields.reservedDate || "사용일 미정"}</span><GjuStatusBadge tone="green">제출완료</GjuStatusBadge></div>
        )) : <p className="muted">제출 완료된 보고서가 없습니다.</p>}
      </GjuCard>
    </section>
  );
}
