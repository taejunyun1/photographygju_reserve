import React from "react";
import { FacilityBoard } from "../../shared/facility-board/FacilityBoard";
import { kstDate } from "../../shared/facility-board/model";
import type { FacilityTimelineResource } from "../../shared/facility-board/types";
import type { LegacyState, ReactAdminActions } from "../../platform/types";

export function AdminFacilityBoard({ state, actions }: { state: LegacyState; actions: ReactAdminActions }) {
  const initial = state.summary?.operationsBoard;
  const resource: FacilityTimelineResource = state.facilityTimeline || {
    date: initial?.date || "",
    data: initial || null,
    loading: false,
    error: "",
    lastSucceededAt: initial?.generatedAt || ""
  };
  const safeResource = resource.data && resource.data.viewer !== "admin" ? { ...resource, data: null } : resource;
  const dashboardResource = !state.summary && !safeResource.data ? { ...safeResource, date: safeResource.date || kstDate(), loading: true } : safeResource;
  return <FacilityBoard
    viewer="admin"
    lifecycleRefresh="admin-summary-today"
    resource={dashboardResource}
    onLoad={(date, options) => actions.loadFacilityTimeline?.(date, options)}
    onOpenReservation={(id) => { void actions.setAdminView("reservations", { q: id, page: 1 }); }}
    onOpenEquipment={(id) => {
      const equipment = safeResource.data?.equipment.find((item) => item.equipmentId === id);
      void actions.setAdminView("equipment", { q: equipment?.code || equipment?.name || id || "" });
    }}
  />;
}
