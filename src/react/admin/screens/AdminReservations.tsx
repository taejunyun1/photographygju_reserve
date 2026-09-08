import React, { useState } from "react";

import {
  GjuCard,
  GjuDialog,
  GjuEmptyState,
  GjuIconButton,
  GjuStatusBadge,
  GjuTable,
  GjuTabs,
  type GjuIconName
} from "../../design-system";
import type {
  AdminEquipmentInspectionInput,
  AdminEquipmentInspectionOutcome,
  AdminReservationRecord,
  LegacyState,
  ReactAdminActions
} from "../../platform/types";
import {
  bulkDeleteAvailability,
  formatDate,
  formatDateTime,
  property,
  renderPager,
  runAdminAction,
  semesterOptions,
  stopSubmit,
  userLabel
} from "./adminScreenUtils";

type AdminReservationsProps = {
  state: LegacyState;
  actions: ReactAdminActions;
};

const RESERVATION_TABS = [
  ["all", "전체"],
  ["equipment", "기자재"],
  ["darkroom", "암실"],
  ["studio", "스튜디오"],
  ["print", "출력"]
] as const;

const EQUIPMENT_STATUS_FILTERS = [
  ["all", "전체"],
  ["pending_approval", "승인 대기"],
  ["approved", "승인 완료"],
  ["checked_out", "대여 중"],
  ["returned", "반납 완료"],
  ["cancelled_or_rejected", "취소/반려"]
] as const;

const EQUIPMENT_STATUS_ACTIONS = {
  pending_approval: [["approved", "승인"], ["rejected", "반려"]],
  approved: [["checked_out", "대여 처리"], ["cancelled", "예약 취소"]],
  checked_out: [["cancelled", "예약 취소"]]
} as const;

const FACILITY_STATUS_ACTIONS = [
  ["completed", "완료"],
  ["admin_cancelled", "관리자 취소"]
] as const;

type ReservationSortField = "title" | "name" | "reservedDate" | "status";

function reservationSortState(state: LegacyState) {
  const sort = state.adminReservationSort || {};
  return {
    field: String(sort.field || "createdAt"),
    direction: sort.direction === "asc" ? "asc" as const : "desc" as const
  };
}

function sortButton(
  label: string,
  field: ReservationSortField,
  current: ReturnType<typeof reservationSortState>,
  onSort: (field: ReservationSortField) => void
) {
  const active = current.field === field;
  return (
    <button className={`table-sort ${active ? "active" : ""}`} type="button" onClick={() => onSort(field)}>
      {label}{active ? current.direction === "asc" ? " ↑" : " ↓" : ""}
    </button>
  );
}

function reservationStatusLabel(status: string) {
  return {
    pending: "대기",
    pending_approval: "승인 대기",
    auto_confirmed: "자동 확정",
    approved: "승인 완료",
    checked_out: "대여 중",
    returned: "반납 완료",
    completed: "완료",
    cancelled: "취소",
    admin_cancelled: "관리자 취소",
    rejected: "반려"
  }[status] || status || "미정";
}

function reservationTone(status: string) {
  if (status === "approved" || status === "auto_confirmed" || status === "returned" || status === "completed") return "green" as const;
  if (status === "pending" || status === "pending_approval" || status === "checked_out") return "amber" as const;
  if (status === "cancelled" || status === "admin_cancelled" || status === "rejected") return "red" as const;
  return "neutral" as const;
}

function reservationTypeLabel(type: string) {
  return {
    studio: "스튜디오",
    equipment: "기자재",
    darkroom: "암실",
    print: "출력"
  }[type] || type || "-";
}

function reservationTitle(reservation: AdminReservationRecord) {
  return reservation.title
    || String(reservation.fields?.title || reservation.fields?.studioSpace || "")
    || reservation.equipment?.name
    || reservation.equipmentName
    || reservation.equipmentItems?.map((item) => item.name).filter(Boolean).join(", ")
    || (reservation.type === "darkroom" ? reservation.fields?.processTypes?.join(", ") : "")
    || (reservation.type === "print" ? reservation.fields?.printType : "")
    || reservation.place
    || reservation.room
    || reservation.id;
}

function reservationDate(reservation: AdminReservationRecord) {
  const range = [reservation.startDate || reservation.date || reservation.fields?.reservedDate, reservation.endDate].filter(Boolean);
  const dates = range.map(formatDate).join(" - ");
  const times = [reservation.startTime || reservation.fields?.startTime, reservation.endTime || reservation.fields?.endTime].filter(Boolean).join(" - ");
  return [dates, times].filter(Boolean).join(" · ") || "-";
}

function detailList(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean).join(", ") : String(value || "");
}

function reservationDetailRows(reservation: AdminReservationRecord): Array<[string, string]> {
  const fields = reservation.fields || {};
  if (reservation.type === "equipment") {
    const equipment = (reservation.equipmentItems || [])
      .map((item) => [item.code, item.name].filter(Boolean).join(" "))
      .filter(Boolean)
      .join(", ");
    const bag = fields.cameraBagConfirmationRequired
      ? fields.pelicanBagReserved ? "펠리컨 가방 예약됨" : fields.cameraBagConfirmed ? "지참 확인" : "확인 필요"
      : "대상 아님";
    return [
      ["대여/반납", `${fields.rentalTime || "-"} / ${fields.returnTime || "-"}`],
      ["기간", String(fields.period || "-")],
      ["장비", equipment || "-"],
      ["가방 확인", bag],
      ["연락처", String(fields.phone || reservation.user?.phone || "-")],
      ["목적", String(fields.purpose || "-")]
    ];
  }
  if (reservation.type === "studio") {
    return [
      ["시간", detailList(fields.timeSlots) || "-"],
      ["공간", detailList(fields.studioSpaces || (fields.studioSpace ? [fields.studioSpace] : [])) || "-"],
      ["명단", String(fields.participants || "-")],
      ["필요 장비", String(fields.requiredEquipment || "-")]
    ];
  }
  if (reservation.type === "darkroom") {
    const chemicals = (fields.chemicals || [])
      .map((item) => [item.name, item.amount].filter(Boolean).join(" "))
      .filter(Boolean)
      .join(", ");
    return [
      ["시간", detailList(fields.timeSlots) || "-"],
      ["작업", detailList(fields.processTypes) || "-"],
      ["인원", `${Number(fields.participantCount || 1)}명`],
      ["약품", chemicals || "-"]
    ];
  }
  return [
    ["시간", `${fields.startTime || "-"}-${fields.endTime || "-"}`],
    ["출력", `${fields.printType || "-"} / ${fields.paper || "-"} / ${fields.size || "-"}`],
    ["매수", String(fields.count || "-")],
    ["메모", String(fields.memo || "-")]
  ];
}

function reservationDetails(reservation: AdminReservationRecord) {
  return (
    <dl className="property-list compact admin-reservation-detail-list">
      {reservationDetailRows(reservation).map(([label, value]) => property(label, value))}
    </dl>
  );
}

function statusActionsFor(reservation: AdminReservationRecord) {
  if (reservation.type !== "equipment") return FACILITY_STATUS_ACTIONS;
  const status = String(reservation.status || "") as keyof typeof EQUIPMENT_STATUS_ACTIONS;
  return EQUIPMENT_STATUS_ACTIONS[status] || [];
}

function reservationStatusIcon(status: string): GjuIconName {
  return status === "cancelled" || status === "admin_cancelled" || status === "rejected" ? "x" : "check";
}

function updateReservationStatus(actions: ReactAdminActions, reservation: AdminReservationRecord, status: string) {
  runAdminAction(() => actions.updateReservationStatus(reservation.id, status));
}

function renderReservationStatusActions(
  reservation: AdminReservationRecord,
  actions: ReactAdminActions,
  disableCurrent = false,
  onReturnInspection?: (reservation: AdminReservationRecord) => void
) {
  const currentStatus = String(reservation.status || "");
  return (
    <>
      {reservation.type === "equipment" && currentStatus === "checked_out" ? (
        <GjuIconButton
          label="반납 점검"
          icon="check"
          tone="success"
          onClick={() => onReturnInspection?.(reservation)}
        />
      ) : null}
      {statusActionsFor(reservation).map(([nextStatus, label]) => (
        <GjuIconButton
          key={nextStatus}
          label={label}
          icon={reservationStatusIcon(nextStatus)}
          tone={nextStatus === "cancelled" || nextStatus === "admin_cancelled" || nextStatus === "rejected" ? "danger" : "success"}
          disabled={disableCurrent && nextStatus === currentStatus}
          aria-pressed={nextStatus === currentStatus ? "true" : "false"}
          onClick={() => updateReservationStatus(actions, reservation, nextStatus)}
        />
      ))}
    </>
  );
}

function renderReservationDeleteAction(reservation: AdminReservationRecord, actions: ReactAdminActions) {
  return (
    <GjuIconButton
      label="예약 삭제"
      icon="trash"
      tone="danger"
      onClick={() => runAdminAction(() => actions.deleteReservation(reservation.id, reservationTitle(reservation)))}
    />
  );
}

function activeReservationFilters(state: LegacyState) {
  const q = String(state.adminReservationSearch || "").trim();
  const type = q ? "all" : String(state.adminReservationTab || "all");
  return {
    type,
    status: q
      ? "all"
      : type === "equipment" || ["cancelled_or_rejected", "operational"].includes(state.adminEquipmentReservationStatusFilter || "")
        ? String(state.adminEquipmentReservationStatusFilter || "all")
        : "all",
    semester: state.adminReservationSemesterFilter || "all",
    time: state.adminReservationTimeFilter || "",
    dateBasis: state.adminReservationDateBasis || "reserved",
    from: state.adminReservationDateFrom || "",
    to: state.adminReservationDateTo || "",
    q
  };
}

function bulkDeleteReservations(state: LegacyState, actions: ReactAdminActions) {
  runAdminAction(() => actions.bulkDeleteReservations(activeReservationFilters(state)));
}

function renderReservationCard(
  reservation: AdminReservationRecord,
  actions: ReactAdminActions,
  onReturnInspection: (reservation: AdminReservationRecord) => void
) {
  const status = String(reservation.status || "");
  return (
    <article key={reservation.id} className="admin-react-list-card admin-reservation-card">
      <div className="reservation-card-head">
        <div>
          <strong>{reservationTitle(reservation)}</strong>
          <span>{userLabel(reservation.user || reservation.student)}</span>
        </div>
        <GjuStatusBadge tone={reservationTone(status)}>{reservationStatusLabel(status)}</GjuStatusBadge>
      </div>
      <dl className="property-list">
        {property("유형", reservationTypeLabel(String(reservation.type || "")))}
        {property("일정", reservationDate(reservation))}
        {property("신청일", formatDateTime(reservation.createdAt))}
        {property("사유", reservation.reason || "-")}
      </dl>
      {reservationDetails(reservation)}
      <div className="admin-react-action-row" aria-label={`${reservationTitle(reservation)} 상태 변경`}>
        {renderReservationStatusActions(reservation, actions, false, onReturnInspection)}
        {renderReservationDeleteAction(reservation, actions)}
      </div>
    </article>
  );
}

type ReturnInspectionItem = {
  id: string;
  code: string;
  name: string;
};

type ReturnInspectionDraft = Record<string, {
  outcome: AdminEquipmentInspectionOutcome;
  note: string;
}>;

const RETURN_OUTCOMES: Array<{
  value: AdminEquipmentInspectionOutcome;
  label: string;
}> = [
  { value: "normal", label: "정상" },
  { value: "needs_inspection", label: "점검 필요" },
  { value: "needs_repair", label: "수리 필요" }
];

function returnInspectionItems(reservation: AdminReservationRecord): ReturnInspectionItem[] {
  const equipmentItems = reservation.equipmentItems?.length
    ? reservation.equipmentItems
    : reservation.equipment
      ? [reservation.equipment]
      : [];
  return equipmentItems
    .filter((item): item is typeof item & { id: string } => Boolean(item.id))
    .map((item) => ({
      id: String(item.id),
      code: String(item.code || "코드 없음"),
      name: String(item.name || item.code || item.id)
    }));
}

function EquipmentReturnInspectionDialog({
  reservation,
  actions,
  onClose
}: {
  reservation: AdminReservationRecord;
  actions: ReactAdminActions;
  onClose: () => void;
}) {
  const items = returnInspectionItems(reservation);
  const [draft, setDraft] = useState<ReturnInspectionDraft>(() =>
    Object.fromEntries(items.map((item) => [
      item.id,
      { outcome: "normal" as const, note: "" }
    ]))
  );
  const inspections: AdminEquipmentInspectionInput[] = items.map((item) => ({
    equipmentId: item.id,
    outcome: draft[item.id]?.outcome || "normal",
    note: String(draft[item.id]?.note || "").trim()
  }));
  const missingRepairNote = inspections.some((item) =>
    item.outcome === "needs_repair" && !item.note
  );
  const canSubmit = inspections.length > 0 && !missingRepairNote;
  const updateDraft = (
    equipmentId: string,
    patch: Partial<ReturnInspectionDraft[string]>
  ) => {
    setDraft((current) => ({
      ...current,
      [equipmentId]: {
        outcome: current[equipmentId]?.outcome || "normal",
        note: current[equipmentId]?.note || "",
        ...patch
      }
    }));
  };
  const submit = () => {
    if (!canSubmit) {
      actions.notify(
        inspections.length ? "수리 필요 장비의 점검 메모를 입력하세요." : "점검할 장비 정보를 확인하세요.",
        "error"
      );
      return;
    }
    void actions.returnEquipmentReservation(reservation.id, inspections)
      .then(onClose)
      .catch(() => undefined);
  };
  const resultCounts = RETURN_OUTCOMES.map(({ value, label }) => ({
    label,
    count: inspections.filter((item) => item.outcome === value).length
  }));
  const borrower = userLabel(reservation.user || reservation.student);
  const contact = String(
    reservation.user?.phone
    || reservation.student?.phone
    || reservation.fields?.phone
    || "-"
  );

  return (
    <GjuDialog
      open
      title={`반납 점검 · ${borrower}`}
      onClose={onClose}
      showActions={false}
      className="equipment-return-dialog"
    >
      <div className="equipment-return-dialog__intro">
        <strong>{reservationTitle(reservation)}</strong>
        <span>연락처 {contact} · {items.length}개 장비를 각각 확인해 주세요.</span>
      </div>
      {items.length ? (
        <div className="equipment-return-list">
          {items.map((item) => {
            const itemDraft = draft[item.id] || { outcome: "normal", note: "" };
            const showNote = itemDraft.outcome !== "normal";
            const noteErrorId = `equipment-return-note-error-${item.id}`;
            const hasNoteError = itemDraft.outcome === "needs_repair" && !itemDraft.note.trim();
            return (
              <fieldset className="equipment-return-item" key={item.id}>
                <legend>
                  <code>{item.code}</code>
                  <strong>{item.name}</strong>
                </legend>
                <label>
                  <span>점검 결과</span>
                  <select
                    className="select"
                    aria-label={`${item.name} 점검 결과`}
                    value={itemDraft.outcome}
                    onChange={(event) => {
                      const outcome = event.currentTarget.value as AdminEquipmentInspectionOutcome;
                      updateDraft(item.id, { outcome });
                    }}
                  >
                    {RETURN_OUTCOMES.map((outcome) => (
                      <option key={outcome.value} value={outcome.value}>{outcome.label}</option>
                    ))}
                  </select>
                </label>
                {showNote ? (
                  <label>
                    <span>
                      점검 메모
                      {itemDraft.outcome === "needs_repair" ? " · 필수" : " · 선택"}
                    </span>
                    <textarea
                      className="textarea"
                      rows={2}
                      aria-label={`${item.name} 점검 메모`}
                      aria-describedby={hasNoteError ? noteErrorId : undefined}
                      placeholder="이상 증상이나 확인할 내용을 입력하세요."
                      value={itemDraft.note}
                      onChange={(event) => {
                        const note = event.currentTarget.value;
                        updateDraft(item.id, { note });
                      }}
                    />
                    {hasNoteError ? (
                      <small id={noteErrorId} className="equipment-return-dialog__error">
                        수리 필요 사유를 입력하세요.
                      </small>
                    ) : null}
                  </label>
                ) : null}
              </fieldset>
            );
          })}
        </div>
      ) : (
        <GjuEmptyState
          title="점검할 장비 정보가 없습니다."
          message="예약의 기자재 연결 정보를 먼저 확인하세요."
        />
      )}
      <div className="equipment-return-summary" aria-label="점검 결과 요약">
        {resultCounts.map((item) => (
          <span className="tag" key={item.label}>{item.label} {item.count}</span>
        ))}
      </div>
      {missingRepairNote ? (
        <p className="equipment-return-dialog__error" role="status">
          수리 필요 장비에는 점검 메모가 필요합니다.
        </p>
      ) : null}
      <div className="gju-dialog__actions equipment-return-dialog__actions">
        <button className="button ghost" type="button" onClick={onClose}>취소</button>
        <button className="button primary" type="button" disabled={!canSubmit} onClick={submit}>
          반납 점검 완료
        </button>
      </div>
    </GjuDialog>
  );
}

export function AdminReservations({ state, actions }: AdminReservationsProps) {
  const [returnInspectionReservation, setReturnInspectionReservation] =
    useState<AdminReservationRecord | null>(null);
  const tab = String(state.adminReservationTab || "all");
  const statusFilter = String(state.adminEquipmentReservationStatusFilter || "all");
  const semesterFilter = String(state.adminReservationSemesterFilter || "all");
  const semesters = semesterOptions(state.adminReservationSemesters);
  const sort = reservationSortState(state);
  const reservations = state.adminReservations || [];
  const deleteFilters = activeReservationFilters(state);
  const deleteAvailability = bulkDeleteAvailability(state.adminReservationsPage, deleteFilters);

  const submitSearch = stopSubmit((form) => {
    const q = String(new FormData(form).get("q") || "").trim();
    void actions.setAdminFilters("reservations", {
      q,
      ...(q ? { type: "all", status: "all" } : {}),
      page: 1
    });
  });

  const setTab = (nextTab: string) => {
    void actions.setAdminFilters("reservations", {
      type: nextTab,
      status: nextTab === "equipment" ? statusFilter : "all",
      page: 1
    });
  };

  const setStatusFilter = (nextStatus: string) => {
    void actions.setAdminFilters("reservations", { status: nextStatus, page: 1 });
  };
  const setSort = (field: ReservationSortField) => {
    const direction = sort.field === field && sort.direction === "asc" ? "desc" : "asc";
    void actions.setAdminFilters("reservations", { sort: field, direction, page: 1 });
  };

  return (
    <section className="grid admin-react-screen">
      <GjuCard
        title="예약 관리"
        actions={<span className="tag blue">{state.adminReservationsPage?.total ?? reservations.length}건 · 현재 표시 {reservations.length}건</span>}
        surface="workspace"
      >
        {(state.adminReservationDateFrom || state.adminReservationDateTo || state.adminReservationTimeFilter) && (
          <p className="muted">{state.adminReservationDateBasis === "created" ? "접수일" : "예약일"} 기준 {state.adminReservationDateFrom || "전체"} ~ {state.adminReservationDateTo || "전체"}{state.adminReservationTimeFilter ? ` · ${state.adminReservationTimeFilter}` : ""}{statusFilter === "operational" ? " · 취소·반려 제외" : ""}</p>
        )}
        <form className="list-control-panel compact admin-react-toolbar" onSubmit={submitSearch}>
          <label>
            <span className="sr-only">예약 검색</span>
            <input
              className="input"
              name="q"
              defaultValue={String(state.adminReservationSearch || "")}
              placeholder="예약자·공간·기자재·상태 검색"
            />
          </label>
          <button className="button primary compact" type="submit">
            검색
          </button>
        </form>
        <GjuTabs
          id="admin-reservation-type-tabs"
          ariaLabel="예약 유형"
          className="admin-inner-tabs"
          tabClassName="tab-button"
          items={RESERVATION_TABS.map(([key, label]) => ({ key, label }))}
          activeKey={tab}
          onChange={setTab}
        />
        <GjuTabs
          id="admin-reservation-semester-tabs"
          ariaLabel="예약 학기"
          className="tab-row wrap"
          tabClassName="tab-button"
          items={[{ key: "all", label: "전체 학기" }, ...semesters]}
          activeKey={semesterFilter}
          onChange={(semester) => void actions.setAdminFilters("reservations", { semester, page: 1 })}
        />
        {tab === "equipment" ? (
          <GjuTabs
            id="admin-reservation-status-tabs"
            ariaLabel="기자재 예약 상태"
            className="tab-row"
            tabClassName="tab-button"
            items={EQUIPMENT_STATUS_FILTERS.map(([key, label]) => ({ key, label }))}
            activeKey={statusFilter}
            onChange={setStatusFilter}
          />
        ) : null}
        {deleteAvailability.collectionTotal > 0 ? <div className="admin-react-danger-row">
          <button className="button danger compact" type="button" disabled={deleteAvailability.filteredDisabled} onClick={() => bulkDeleteReservations(state, actions)}>
            필터 결과 예약 삭제
          </button>
          <button className="button danger compact" type="button" disabled={deleteAvailability.allDisabled} onClick={() => runAdminAction(() => actions.deleteAllReservations(deleteAvailability.collectionTotal))}>
            전체 예약 삭제
          </button>
        </div> : null}
        <div className="table-wrap embedded admin-react-desktop-table">
          <GjuTable>
            <thead>
              <tr>
                <th>{sortButton("예약", "title", sort, setSort)}</th>
                <th>{sortButton("예약자", "name", sort, setSort)}</th>
                <th>{sortButton("일정", "reservedDate", sort, setSort)}</th>
                <th>{sortButton("상태", "status", sort, setSort)}</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {reservations.length ? (
                reservations.map((reservation) => {
                  const status = String(reservation.status || "");
                  return (
                    <tr key={reservation.id}>
                      <td>
                        <strong>{reservationTitle(reservation)}</strong>
                        <br />
                        <span className="muted">{reservationTypeLabel(String(reservation.type || ""))}</span>
                        {reservationDetails(reservation)}
                      </td>
                      <td>{userLabel(reservation.user || reservation.student)}</td>
                      <td>{reservationDate(reservation)}</td>
                      <td>
                        <GjuStatusBadge tone={reservationTone(status)}>{reservationStatusLabel(status)}</GjuStatusBadge>
                      </td>
                      <td>
                        <div className="admin-react-action-row">
                          {renderReservationStatusActions(
                            reservation,
                            actions,
                            true,
                            setReturnInspectionReservation
                          )}
                          {renderReservationDeleteAction(reservation, actions)}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5}>
                    <GjuEmptyState title="예약이 없습니다." message="검색어와 필터를 확인하세요." />
                  </td>
                </tr>
              )}
            </tbody>
          </GjuTable>
        </div>
        <div className="admin-react-card-list" aria-label="예약 목록">
          {reservations.length
            ? reservations.map((reservation) =>
                renderReservationCard(reservation, actions, setReturnInspectionReservation)
              )
            : <GjuEmptyState title="예약이 없습니다." message="검색어와 필터를 확인하세요." />}
        </div>
        {renderPager(actions, state.adminReservationsPage, "reservations", "예약 페이지 이동")}
      </GjuCard>
      {returnInspectionReservation ? (
        <EquipmentReturnInspectionDialog
          key={returnInspectionReservation.id}
          reservation={returnInspectionReservation}
          actions={actions}
          onClose={() => setReturnInspectionReservation(null)}
        />
      ) : null}
    </section>
  );
}
