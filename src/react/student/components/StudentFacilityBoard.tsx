import React from "react";
import { FacilityBoard } from "../../shared/facility-board/FacilityBoard";
import type { FacilityTimelineResource } from "../../shared/facility-board/types";
import type { StudentActions, StudentState } from "../types";

export function StudentFacilityBoard({ state, actions }: { state: StudentState; actions: StudentActions }) {
  const resource: FacilityTimelineResource = state.facilityTimeline || {
    date: state.today || "", data: null, loading: false, error: "", lastSucceededAt: ""
  };
  const safeResource = resource.data && resource.data.viewer !== "student" ? { ...resource, data: null } : resource;
  return <FacilityBoard
    viewer="student"
    approved={state.user.approvalStatus === "approved"}
    resource={safeResource}
    onLoad={(date, options) => actions.loadFacilityTimeline?.(date, options)}
    onOpenReservation={() => { void actions.setView("mine"); }}
    onReserve={(intent) => actions.startFacilityReservation?.(intent)}
  />;
}
