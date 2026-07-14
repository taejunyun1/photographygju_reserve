import React, { useState } from "react";

import {
  GjuButton,
  GjuEmptyState,
  GjuIcon,
  GjuIconButton,
  GjuStatusBadge
} from "../../design-system";
import type {
  ReservationType,
  StudentLecture,
  StudentNotice,
  StudentReservation
} from "../types";
import { isReportDue } from "../reporting";

const TYPE_LABELS: Record<ReservationType | "lecture", string> = {
  equipment: "기자재",
  studio: "스튜디오",
  darkroom: "암실",
  print: "출력실",
  lecture: "특강"
};

const TYPE_ICONS: Record<ReservationType, "camera" | "fileText" | "plus" | "refresh"> = {
  equipment: "camera",
  studio: "plus",
  darkroom: "refresh",
  print: "fileText"
};

const RESERVATION_STATUS_LABELS: Record<string, string> = {
  approval_pending: "승인 대기",
  pending_approval: "승인 대기",
  auto_confirmed: "자동 확정",
  approved: "승인 완료",
  rejected: "반려",
  blocked: "대여금지",
  cancelled: "취소",
  admin_cancelled: "관리자 취소",
  checked_out: "대여 중",
  returned: "반납 완료",
  completed: "사용 완료",
  lecture_applied: "신청완료"
};

function statusTone(status = "") {
  if (["approved", "auto_confirmed", "completed", "returned", "모집중"].includes(status)) return "green" as const;
  if (["pending_approval", "approval_pending", "checked_out", "진행완료"].includes(status)) return "amber" as const;
  if (["rejected", "cancelled", "admin_cancelled", "취소"].includes(status)) return "red" as const;
  return "blue" as const;
}

function reservationStatusLabel(status = "") {
  return RESERVATION_STATUS_LABELS[status] || status || "접수";
}

function formatReservationDate(value: unknown) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return String(value || "");
  const [, year, month, day] = match;
  const weekday = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    weekday: "short"
  }).format(new Date(`${year}-${month}-${day}T00:00:00+09:00`));
  return `${Number(year)}. ${Number(month)}. ${Number(day)}. (${weekday})`;
}

function reservationDisplayMeta(reservation: StudentReservation) {
  const fields = reservation.fields;
  const date = formatReservationDate(fields.reservedDate || reservation.lecture?.lectureDate);
  const time = fields.rentalTime && fields.returnTime
    ? `${fields.rentalTime}–${fields.returnTime}`
    : fields.startTime && fields.endTime
      ? `${fields.startTime}–${fields.endTime}`
      : (fields.timeSlots || []).join(", ") || String(reservation.lecture?.time || "");
  const equipment = (reservation.equipmentItems || [])
    .map((item) => item.code || item.name)
    .filter(Boolean);
  const equipmentSummary = equipment.length > 2
    ? `${equipment.slice(0, 2).join(", ")} 외 ${equipment.length - 2}개`
    : equipment.join(", ");
  const details = [
    fields.period,
    reservation.type === "lecture" ? reservation.lecture?.title : "",
    fields.studioSpace || (fields.studioSpaces || []).join(", "),
    equipmentSummary
  ].filter(Boolean).map(String);
  return {
    date,
    time,
    details: details.join(" · "),
    fallback: !date && !time && !details.length ? "상세 정보 없음" : ""
  };
}

export function ScreenHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <header className="student-react-screen-header">
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="student-react-screen-header__action">{action}</div> : null}
    </header>
  );
}

export function FacilityCard({ type, onSelect }: { type: ReservationType; onSelect: (type: ReservationType) => void }) {
  const labels: Record<ReservationType, [string, string, string]> = {
    equipment: ["기자재", "카메라 · 렌즈 · 조명", "승인 후 예약"],
    studio: ["스튜디오", "Front · Back 공간", "자동 확정"],
    darkroom: ["암실", "현상 · 인화 작업", "시간 선택"],
    print: ["출력실", "과제 · 작품 출력", "시간 선택"]
  };
  const [title, description, status] = labels[type];

  return (
    <button type="button" className="facility-card student-react-facility-card" onClick={() => onSelect(type)}>
      <div className={`facility-visual facility-${type}`}>
        <span className="facility-code">
          <GjuIcon name={TYPE_ICONS[type]} className="facility-symbol" />
          <b>{type.slice(0, 2).toUpperCase()}</b>
        </span>
        <span className="availability blue"><i />{status}</span>
      </div>
      <span className="facility-body">
        <span>
          <strong>{title}</strong>
          <small>{description}</small>
        </span>
        <span className="reserve-label">예약 <GjuIcon name="plus" /></span>
      </span>
    </button>
  );
}

export function ReservationCard({
  reservation,
  onCancel,
  onCancelLecture,
  onReport,
  lectureCanCancel,
  today
}: {
  reservation: StudentReservation;
  onCancel?: (id: string) => Promise<void> | void;
  onCancelLecture?: (lectureId: string) => Promise<void> | void;
  onReport?: (id: string) => void;
  lectureCanCancel?: boolean;
  today?: string;
}) {
  const label = TYPE_LABELS[reservation.type];
  const canCancel = !["cancelled", "admin_cancelled", "rejected", "returned", "completed"].includes(reservation.status || "");
  const reportDue = isReportDue(reservation, today);
  const lectureId = reservation.type === "lecture" ? reservation.lecture?.id : undefined;
  const displayMeta = reservationDisplayMeta(reservation);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  async function runCancellation(action: (id: string) => Promise<void> | void, id: string) {
    if (cancelling) return;
    setCancelError("");
    setCancelling(true);
    try {
      await action(id);
    } catch (error) {
      setCancelError(error instanceof Error ? error.message : "예약 취소 요청을 처리하지 못했습니다.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <article className="card ui-card student-react-reservation-card" aria-busy={cancelling || undefined}>
      <div className="student-react-reservation-card__head">
        <div className="chips">
          <GjuStatusBadge tone="blue">{label}</GjuStatusBadge>
          <GjuStatusBadge tone={statusTone(reservation.status)}>{reservationStatusLabel(reservation.status)}</GjuStatusBadge>
        </div>
        {reservation.type !== "lecture" && onCancel && canCancel ? (
          <GjuIconButton label="예약 취소" icon="x" tone="danger" disabled={cancelling} onClick={() => void runCancellation(onCancel, reservation.id)} />
        ) : reservation.type === "lecture" && lectureId && onCancelLecture && canCancel && (lectureCanCancel ?? reservation.lecture?.canCancelApplication) ? (
          <GjuIconButton label="특강 신청 취소" icon="x" tone="danger" disabled={cancelling} onClick={() => void runCancellation(onCancelLecture, lectureId)} />
        ) : null}
      </div>
      <h2>{String(reservation.fields.title || `${label} 예약`)}</h2>
      {displayMeta.date || displayMeta.time ? (
        <dl className="student-react-reservation-card__schedule">
          {displayMeta.date ? (
            <div className="student-react-reservation-card__schedule-item">
              <dt>날짜</dt>
              <dd>{displayMeta.date}</dd>
            </div>
          ) : null}
          {displayMeta.time ? (
            <div className="student-react-reservation-card__schedule-item">
              <dt>시간</dt>
              <dd>{displayMeta.time}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {displayMeta.details ? <p className="student-react-reservation-card__equipment">{displayMeta.details}</p> : null}
      {displayMeta.fallback ? <p className="muted student-react-reservation-card__fallback">{displayMeta.fallback}</p> : null}
      {cancelError ? <p className="student-react-submit-error" role="alert">{cancelError}</p> : null}
      {onReport && reportDue ? (
        <div className="student-react-reservation-card__actions">
          <GjuButton icon="fileText" variant="outline" onClick={() => onReport(reservation.id)}>보고서 작성</GjuButton>
        </div>
      ) : null}
    </article>
  );
}

export function NoticeList({ notices, onOpen }: { notices: readonly StudentNotice[]; onOpen: (id: string) => void }) {
  if (!notices.length) {
    return <GjuEmptyState title="등록된 공지사항이 없습니다." />;
  }

  return (
    <div className="student-react-notice-list">
      {notices.map((notice) => (
        <button key={notice.id} type="button" className="notice-strip-row" onClick={() => onOpen(notice.id)}>
          <span className="chips"><GjuStatusBadge tone="blue">{notice.category || "공지"}</GjuStatusBadge></span>
          <strong>{notice.title}</strong>
          <small>{notice.createdAt || ""}</small>
        </button>
      ))}
    </div>
  );
}

export function LectureSummary({ lecture, onOpen }: { lecture: StudentLecture; onOpen: () => void }) {
  const count = lecture.capacity ? `${lecture.applicationCount || 0}/${lecture.capacity}` : `${lecture.applicationCount || 0}`;
  return (
    <button type="button" className="lecture-mini-row" onClick={onOpen}>
      <span className="lecture-date">{lecture.lectureDate || "-"}</span>
      <span>
        <strong>{lecture.title}</strong>
        <small>{lecture.time || ""}{lecture.location ? ` · ${lecture.location}` : ""}</small>
      </span>
      <GjuStatusBadge tone="green">{count}</GjuStatusBadge>
    </button>
  );
}
