import React from "react";

import { GjuButton, GjuCard, GjuIcon, GjuIconButton, GjuStatusBadge } from "../../design-system";
import { StudentFacilityBoard } from "../components/StudentFacilityBoard";
import { reservationDisplayMeta, reservationStatusLabel, statusTone } from "../components/StudentPrimitives";
import { isReportDue } from "../reporting";
import type { StudentActions, StudentState } from "../types";

const APPROVAL_LABELS: Record<string, string> = {
  approval_pending: "승인 대기",
  approved: "승인 완료",
  rejected: "반려",
  blocked: "대여금지"
};

const RESERVATION_TYPE_LABELS: Record<string, string> = {
  equipment: "기자재",
  studio: "스튜디오",
  darkroom: "암실",
  print: "출력실",
  lecture: "특강"
};

export function HomeScreen({ state, actions }: { state: StudentState; actions: StudentActions }) {
  const today = state.today || "";
  const activeReservations = state.myReservations
    .filter((item) => {
      if (["cancelled", "admin_cancelled", "rejected", "returned", "completed"].includes(item.status || "")) return false;
      if (item.status === "checked_out") return true;
      const date = item.fields.reservedDate || item.lecture?.lectureDate || "";
      const endAt = item.timing?.endAt ? new Date(item.timing.endAt).getTime() : NaN;
      const todayStart = today ? new Date(`${today}T00:00:00+09:00`).getTime() : NaN;
      return Number.isFinite(endAt) && Number.isFinite(todayStart) ? endAt >= todayStart : !date || !today || date >= today;
    })
    .slice()
    .sort((a, b) => {
      if (a.status === "checked_out" || b.status === "checked_out") {
        if (a.status !== b.status) return a.status === "checked_out" ? -1 : 1;
      }
      const aTime = String(a.timing?.startAt || a.fields.reservedDate || a.lecture?.lectureDate || "");
      const bTime = String(b.timing?.startAt || b.fields.reservedDate || b.lecture?.lectureDate || "");
      return (aTime || "\uffff").localeCompare(bTime || "\uffff");
    });
  const approved = state.user.approvalStatus === "approved";
  const reportCount = state.myReservations.filter((reservation) => isReportDue(reservation, today)).length;
  const notice = state.bootstrap.notices.slice().sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")))[0];

  return (
    <section className="grid student-react-home" aria-label="예약자 홈">
      <h1 className="sr-only">홈</h1>
      {!approved ? (
        <GjuCard title="계정 확인" className="notice">
          <GjuStatusBadge tone="amber">{APPROVAL_LABELS[state.user.approvalStatus || ""] || "승인 대기"}</GjuStatusBadge>
          <p className="muted">학과 관리자 승인 후 예약할 수 있습니다.</p>
        </GjuCard>
      ) : null}

      <section className="student-react-home-bookings" aria-label="내 예약">
        <div className="student-react-home-bookings__heading">
          <h2>내 예약 <span>{activeReservations.length}</span></h2>
          <div className="student-react-home-bookings__actions">
            <GjuButton icon="plus" disabled={!approved} onClick={() => actions.setView("reserve")}>새 예약</GjuButton>
            <GjuIconButton label="전체 예약 보기" icon="chevronRight" onClick={() => actions.setView("mine")} />
          </div>
        </div>
        {activeReservations.length ? (
          <div className="student-react-home-bookings__list">
            {activeReservations.slice(0, 2).map((reservation) => {
              const meta = reservationDisplayMeta(reservation);
              const typeLabel = RESERVATION_TYPE_LABELS[reservation.type] || "예약";
              const firstEquipment = reservation.equipmentItems?.[0];
              const title = String(reservation.fields.title || (
                reservation.type === "equipment" && firstEquipment
                  ? `${firstEquipment.name || firstEquipment.code}${reservation.equipmentItems!.length > 1 ? ` 외 ${reservation.equipmentItems!.length - 1}개` : ""}`
                  : reservation.type === "studio"
                    ? reservation.fields.studioSpace || reservation.fields.studioSpaces?.[0] || "스튜디오"
                    : reservation.type === "lecture" ? reservation.lecture?.title || "특강" : `${typeLabel} 예약`
              ));
              return (
                <article key={reservation.id} className="student-react-home-bookings__item">
                  <div className="student-react-home-bookings__item-heading">
                    <strong>{title}</strong>
                    <GjuStatusBadge tone={statusTone(reservation.status)}>{reservationStatusLabel(reservation.status)}</GjuStatusBadge>
                  </div>
                  {meta.date || meta.time ? <p>{[meta.date, meta.time].filter(Boolean).join(" · ")}</p> : null}
                  {meta.details ? <small>{meta.details}</small> : null}
                </article>
              );
            })}
          </div>
        ) : <p className="student-react-home-bookings__empty muted">예정된 예약 없음</p>}
      </section>

      {reportCount > 0 ? <button type="button" className="student-react-home-report-alert" aria-label={`작성할 보고서 ${reportCount}건`} onClick={() => actions.setView("reports")}>
        <GjuIcon name="fileText" /><span>보고서 <strong>{reportCount}</strong></span><GjuIcon name="chevronRight" />
      </button> : null}

      <StudentFacilityBoard state={state} actions={actions} />

      {notice ? <button type="button" className="student-react-home-notice" aria-label={`공지: ${notice.title}`} onClick={() => {
        void actions.openNotice(notice.id);
        void actions.setView("notices");
      }}>
        <GjuIcon name="info" /><span>{notice.title}</span><GjuIcon name="chevronRight" />
      </button> : null}
    </section>
  );
}
