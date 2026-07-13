import React from "react";

import { GjuButton, GjuCard, GjuEmptyState, GjuStatusBadge } from "../../design-system";
import { FacilityCard, LectureSummary, NoticeList, ReservationCard, ScreenHeader } from "../components/StudentPrimitives";
import type { StudentActions, StudentState } from "../types";

const APPROVAL_LABELS: Record<string, string> = {
  approval_pending: "승인 대기",
  approved: "승인 완료",
  rejected: "반려",
  blocked: "대여금지"
};

export function HomeScreen({ state, actions }: { state: StudentState; actions: StudentActions }) {
  const nextReservation = state.myReservations
    .filter((item) => !["cancelled", "admin_cancelled", "rejected"].includes(item.status || ""))
    .slice()
    .sort((a, b) => String(a.fields.reservedDate || "").localeCompare(String(b.fields.reservedDate || "")))[0];
  const lectures = state.lectures.filter((lecture) => (lecture.status || "모집중") === "모집중").slice(0, 3);
  const notices = state.bootstrap.notices.slice(0, 3);
  const approved = state.user.approvalStatus === "approved";

  return (
    <section className="grid student-react-home">
      <ScreenHeader title={`안녕하세요, ${state.user.name}님`} description="오늘 확인할 예약과 공지를 정리했습니다." />
      {!approved ? (
        <GjuCard title="승인 대기" className="notice">
          <p className="muted">학과 관리자 승인 후 예약할 수 있습니다. 공지는 승인 전에도 확인할 수 있습니다.</p>
          <GjuStatusBadge tone="amber">{APPROVAL_LABELS[state.user.approvalStatus || ""] || "승인 대기"}</GjuStatusBadge>
        </GjuCard>
      ) : null}

      <section className="home-quick-actions" aria-label="예약 바로가기">
        <div className="home-section-label"><strong>예약</strong><span>바로가기</span></div>
        <div className="facility-grid">
          {(["equipment", "studio", "darkroom", "print"] as const).map((type) => <FacilityCard key={type} type={type} onSelect={actions.startReservation} />)}
        </div>
      </section>

      {nextReservation ? (
        <section className="surface-stack next-reservation-section">
          <h2>다음 예약</h2>
          <ReservationCard
            reservation={nextReservation}
            onCancel={actions.cancelReservation}
            onCancelLecture={actions.cancelLecture}
            onReport={actions.openReport}
            lectureCanCancel={nextReservation.type === "lecture"
              ? state.lectures.find((lecture) => lecture.id === nextReservation.lecture?.id)?.canCancelApplication
              : undefined}
            today={state.today}
          />
        </section>
      ) : (
        <GjuEmptyState title="예정된 예약이 없습니다." action={<GjuButton onClick={() => actions.setView("reserve")}>예약 시작</GjuButton>} />
      )}

      <GjuCard title="공지사항" actions={<GjuButton variant="ghost" onClick={() => actions.setView("notices")}>전체 보기</GjuButton>}>
        <NoticeList notices={notices} onOpen={(id) => {
          void actions.openNotice(id);
          void actions.setView("notices");
        }} />
      </GjuCard>

      <GjuCard title="모집중인 특강" actions={<GjuButton variant="ghost" onClick={() => actions.setView("lectures")}>전체 보기</GjuButton>}>
        {lectures.length ? lectures.map((lecture) => <LectureSummary key={lecture.id} lecture={lecture} onOpen={() => actions.setView("lectures")} />) : <p className="muted">현재 신청 가능한 특강이 없습니다.</p>}
      </GjuCard>
    </section>
  );
}
