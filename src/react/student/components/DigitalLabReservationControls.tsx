import React, { useState } from "react";

import { GjuButton, GjuCard, GjuStatusBadge } from "../../design-system";
import { digitalLabSeatLabel, digitalLabSelectionAvailability, digitalLabTimeSlots } from "../availability";
import { submitReservationDraft } from "../reservationDraft";
import type { DigitalLabSeatAvailability, StudentActions, StudentState } from "../types";
import { RESERVATION_TYPE_LABELS } from "./StudentPrimitives";

const TYPE = "digital_lab";

function seatStatus(seat: DigitalLabSeatAvailability) {
  if (seat.isMine) return "내 예약";
  if (seat.available) return "예약 가능";
  if (seat.reasonCode === "seat_reserved") return "예약 있음";
  if (seat.reasonCode === "class_blocked") return "수업 차단";
  return "예약 불가";
}

export function DigitalLabReservationControls({ state, actions, children }: {
  state: StudentState;
  actions: StudentActions;
  children?: React.ReactNode;
}) {
  const step = state.reservationFlowStep[TYPE];
  const date = state.selectedDates[TYPE];
  const { selectedDigitalLabStartTime: start, selectedDigitalLabEndTime: end, selectedDigitalLabSeatId: seatId } = state;
  const editing = state.digitalLabEditing;
  const resource = state.digitalLabAvailability;
  const [purpose, setPurpose] = useState(() => String(editing?.fields.purpose || state.rebookingDetails?.fields.purpose || ""));
  const [phone, setPhone] = useState(() => String(editing?.fields.phone || state.user.phone || ""));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await submitReservationDraft(TYPE, state, { purpose, phone }, actions);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "예약을 저장하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  const errorMessage = error ? <p className="student-react-submit-error" role="alert">{error}</p> : null;
  const retry = resource?.error ? (
    <GjuButton variant="outline" onClick={() => void actions.loadDigitalLabAvailability()}>다시 조회</GjuButton>
  ) : null;

  if (step === "date") return <>{children}{errorMessage}</>;

  if (step === "schedule") {
    const slots = digitalLabTimeSlots(state.bootstrap.settings, date);
    const endOptions = start && slots.some((slot) => slot.available && slot.startTime === start)
      ? slots.filter((slot) => slot.available && slot.startTime >= start).map((slot) => slot.endTime) : [];
    return (
      <div className="student-react-digital-lab">
        <fieldset className="field">
          <legend>시작 구간</legend>
          <p className="muted">한국 시간 기준으로 시작 구간을 선택하세요. 종료 시간을 늦추면 연속으로 예약할 수 있습니다.</p>
          <div className="student-react-digital-lab__choices student-react-digital-lab__choices--time">
            {slots.map((slot) => (
              <button
                key={slot.startTime}
                type="button"
                aria-pressed={start === slot.startTime}
                disabled={!slot.available}
                onClick={() => {
                  if (start === slot.startTime || Date.parse(`${date}T${slot.startTime}:00+09:00`) < Date.now()) return;
                  setError("");
                  void actions.updateReservationSelection({ type: TYPE, digitalLabStartTime: slot.startTime, digitalLabEndTime: slot.endTime });
                }}
              >{slot.startTime}–{slot.endTime}</button>
            ))}
          </div>
          {slots.every((slot) => !slot.available) ? <p className="muted">선택할 수 있는 시간이 없습니다. 다른 날짜를 선택하세요.</p> : null}
        </fieldset>
        {endOptions.length ? (
          <div className="field">
            <label htmlFor="digital-lab-end-time">종료 시간</label>
            <select
              id="digital-lab-end-time"
              className="input"
              value={end || ""}
              onChange={(event) => {
                setError("");
                void actions.updateReservationSelection({ type: TYPE, digitalLabEndTime: event.target.value });
              }}
            >
              {endOptions.map((time) => <option key={time} value={time}>{time}</option>)}
            </select>
          </div>
        ) : null}
        {retry}
        {errorMessage}
      </div>
    );
  }

  if (step === "select") {
    const seats = resource?.data?.seats || [];
    const slotReason = seats.find((seat) => seat.reasonCode && seat.reasonCode !== "seat_reserved");
    return (
      <div className="student-react-digital-lab" aria-busy={resource?.loading || undefined}>
        <p className="muted">{date} · {start}–{end}</p>
        {errorMessage}
        {slotReason && seats.every((seat) => !seat.available) && slotReason.reason !== error ? (
          <p className="student-react-flow-reason" role="status">{slotReason.reason}</p>
        ) : null}
        {([["mac", "Mac"], ["pc", "PC"]] as const).map(([computerType, label]) => {
          const group = seats.filter((seat) => seat.computerType === computerType);
          if (!group.length) return null;
          return (
            <fieldset className="field" key={computerType}>
              <legend>{label} {group.length}석</legend>
              <div className="student-react-digital-lab__choices">
                {group.map((seat) => {
                  const selected = seat.id === seatId;
                  return (
                    <button
                      key={seat.id}
                      type="button"
                      aria-pressed={selected}
                      disabled={!seat.available}
                      title={seat.reason || undefined}
                      onClick={() => {
                        setError("");
                        void actions.updateReservationSelection({ type: TYPE, digitalLabSeatId: seat.id });
                      }}
                    >
                      <strong>{seat.label}</strong>
                      <small>{seatStatus(seat)}{selected ? " · 선택" : ""}</small>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
        {retry}
      </div>
    );
  }

  const selection = digitalLabSelectionAvailability(state, true);
  const seat = resource?.data?.seats.find((item) => item.id === seatId);
  return (
    <form className="student-react-details-form" onSubmit={submit}>
      <GjuCard title="예약 내용 확인" className="student-react-reservation-review">
        <div className="property-list student-react-review-properties">
          <div><span className="student-react-review-properties__label">시설</span><strong>{RESERVATION_TYPE_LABELS[TYPE]}</strong></div>
          <div><span className="student-react-review-properties__label">사용일</span><strong>{date}</strong></div>
          <div><span className="student-react-review-properties__label">좌석 · 시간</span><strong>{seat?.label || digitalLabSeatLabel(seatId)} · {start}–{end}</strong></div>
          <div><span className="student-react-review-properties__label">상태</span><GjuStatusBadge tone="blue">{editing ? "변경 전" : "제출 전"}</GjuStatusBadge></div>
        </div>
      </GjuCard>
      <div className="field"><label htmlFor="digital-lab-purpose">사용 목적</label><textarea id="digital-lab-purpose" className="textarea" required value={purpose} onChange={(event) => setPurpose(event.target.value)} /></div>
      <div className="field"><label htmlFor="digital-lab-phone">연락처</label><input id="digital-lab-phone" className="input" type="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} /></div>
      {errorMessage}
      {!selection.available && selection.reason !== error ? <p className="student-react-flow-reason" role="status">{selection.reason}</p> : null}
      <div className="row-actions student-react-flow-actions">
        <GjuButton variant="ghost" disabled={submitting} onClick={() => void actions.setReservationStep(TYPE, "select")}>이전</GjuButton>
        <GjuButton type="submit" icon="check" loading={submitting} disabled={!selection.available}>{editing ? "변경 저장" : "예약 신청"}</GjuButton>
      </div>
    </form>
  );
}
