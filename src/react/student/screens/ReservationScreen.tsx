import React from "react";

import { GjuButton, GjuCard } from "../../design-system";
import { FacilityCard, ScreenHeader } from "../components/StudentPrimitives";
import { ReservationControls } from "../components/ReservationControls";
import type { ReservationType, StudentActions, StudentState } from "../types";

export function ReservationScreen({ state, actions }: { state: StudentState; actions: StudentActions }) {
  if (state.user.approvalStatus !== "approved") {
    return <GjuCard title="예약 불가" className="notice"><p className="muted">학과 관리자 승인 후 예약할 수 있습니다.</p></GjuCard>;
  }

  if (!state.reservationType) {
    return (
      <section className="grid student-react-reservation-index">
        <ScreenHeader title="예약" description="공간과 장비 예약을 빠르게 신청합니다." />
        <div className="facility-grid">
          {(["equipment", "studio", "darkroom", "print"] as readonly ReservationType[]).map((type) => <FacilityCard key={type} type={type} onSelect={actions.startReservation} />)}
        </div>
      </section>
    );
  }

  return (
    <section className="grid student-react-reservation-page">
      <ScreenHeader
        title="예약 신청"
        description="필요한 정보를 단계별로 입력하세요."
        action={<GjuButton variant="ghost" onClick={() => actions.setView("reserve")}>예약 종류</GjuButton>}
      />
      <ReservationControls type={state.reservationType} state={state} actions={actions} />
    </section>
  );
}
