import React, { useEffect, useMemo, useRef, useState } from "react";

import { GjuButton, GjuCard, GjuIconButton, GjuStatusBadge, GjuTabs } from "../../design-system";
import {
  darkroomSlotAvailability,
  equipmentItemAvailability,
  equipmentScheduleAvailability,
  isCameraBagEquipment,
  isHighValueEquipment,
  printBucketAvailability,
  printCapacityBuckets,
  reservationDateAvailability,
  reservationSelectionPatchForDate,
  studioSelectionAvailability,
  studioSlotAvailability,
  type AvailabilityResult
} from "../availability";
import {
  submitReservationDraft,
  type DarkroomReservationDetails,
  type EquipmentReservationDetails,
  type PrintReservationDetails,
  type ReservationDetails,
  type StudioReservationDetails
} from "../reservationDraft";
import type {
  ReservationStep,
  ReservationType,
  StudentActions,
  StudentReservationSelectionPatch,
  StudentState
} from "../types";

type ReservationControlsProps = {
  type: ReservationType;
  state: StudentState;
  actions: StudentActions;
};

const STEP_LABELS: Record<ReservationStep, string> = {
  date: "날짜",
  schedule: "시간",
  select: "선택",
  process: "작업",
  options: "옵션",
  details: "확인"
};

const FLOW_STEPS: Record<ReservationType, readonly ReservationStep[]> = {
  equipment: ["date", "schedule", "select", "details"],
  studio: ["date", "select", "schedule", "details"],
  darkroom: ["date", "schedule", "process", "details"],
  print: ["date", "schedule", "options", "details"]
};

const EQUIPMENT_RESULT_PAGE_SIZE = 20;

function values(items: readonly string[] | undefined, fallback: readonly string[] = []) {
  return items?.length ? items : fallback;
}

function update(
  actions: StudentActions,
  type: ReservationType,
  patch: Omit<StudentReservationSelectionPatch, "type">
) {
  void actions.updateReservationSelection({ type, ...patch });
}

function stepIndex(type: ReservationType, step: ReservationStep) {
  return Math.max(0, FLOW_STEPS[type].indexOf(step));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
}

function StepProgress({ type, state, actions }: ReservationControlsProps) {
  const activeStep = state.reservationFlowStep[type] || "date";
  const activeIndex = stepIndex(type, activeStep);
  return (
    <div className="booking-progress student-react-booking-progress" aria-label="예약 단계">
      {FLOW_STEPS[type].map((step, index) => (
        <button
          key={step}
          type="button"
          className={index === activeIndex ? "active" : index < activeIndex ? "complete" : ""}
          aria-current={index === activeIndex ? "step" : undefined}
          onClick={() => {
            if (index <= activeIndex) void actions.setReservationStep(type, step);
          }}
          disabled={index > activeIndex}
        >
          <span>{index + 1}</span>{STEP_LABELS[step]}
        </button>
      ))}
    </div>
  );
}

function DateStep({ type, state, actions }: ReservationControlsProps) {
  const value = state.selectedDates[type] || "";
  const result = value
    ? reservationDateAvailability(type, value, state.bootstrap.settings, state.today)
    : undefined;
  return (
    <div className="field">
      <label htmlFor={`student-reservation-date-${type}`}>사용일</label>
      <input
        id={`student-reservation-date-${type}`}
        className="input"
        type="date"
        value={value}
        onChange={(event) => {
          void actions.updateReservationSelection(reservationSelectionPatchForDate(type, event.target.value));
        }}
        aria-describedby={result && !result.available ? `student-reservation-date-error-${type}` : undefined}
      />
      <p className="muted">
        {type === "equipment" || type === "studio"
          ? "사용일 전날 23:59까지 예약할 수 있습니다."
          : "오늘 예약도 가능하며 지난 날짜는 선택할 수 없습니다."}
      </p>
      {result && !result.available ? <p id={`student-reservation-date-error-${type}`} className="student-react-field-error" role="alert">{result.reason}</p> : null}
    </div>
  );
}

type ChoiceItem = {
  value: string;
  label?: string;
  description?: string;
  disabled?: boolean;
};

function ChoiceGrid({
  items,
  selected,
  onChange,
  name,
  label,
  single = false
}: {
  items: readonly ChoiceItem[];
  selected: readonly string[];
  onChange: (value: string, checked: boolean) => void;
  name: string;
  label: string;
  single?: boolean;
}) {
  return (
    <fieldset className="field">
      <legend>{label}</legend>
      <div className="choice-grid">
        {items.map((item) => (
          <label key={item.value} className={`choice-card compact-choice${item.disabled ? " is-unavailable" : ""}`}>
            <input
              type={single ? "radio" : "checkbox"}
              name={name}
              value={item.value}
              checked={selected.includes(item.value)}
              disabled={item.disabled}
              onChange={(event) => onChange(item.value, event.target.checked)}
            />
            <span>
              <strong>{item.label || item.value}</strong>
              {item.description ? <small>{item.description}</small> : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function SelectField({
  label,
  value,
  items,
  onChange,
  id
}: {
  label: string;
  value: string;
  items: readonly string[];
  onChange: (value: string) => void;
  id: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} className="select" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">선택하세요</option>
        {items.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </div>
  );
}

function EquipmentScheduleStep({ state, actions }: Omit<ReservationControlsProps, "type">) {
  const settings = state.bootstrap.settings;
  const date = state.selectedDates.equipment;
  const friday = date ? new Date(`${date}T00:00:00`).getDay() === 5 : false;
  const periods = values(settings.equipmentPeriods, ["당일"]).filter((period) => (
    friday || (!period.includes("2박3일") && !period.includes("주말"))
  ));
  const result = equipmentScheduleAvailability(
    state.bootstrap,
    date,
    state.selectedEquipmentPeriod || "",
    state.selectedEquipmentRentalTime || "",
    state.selectedEquipmentReturnTime || "",
    state.today
  );
  return (
    <>
      <div className="student-react-form-grid">
        <SelectField label="사용 기간" id="equipment-period" value={state.selectedEquipmentPeriod || ""} items={periods} onChange={(value) => update(actions, "equipment", { equipmentPeriod: value, equipmentItemIds: [] })} />
        <SelectField label="대여 시간" id="equipment-rental-time" value={state.selectedEquipmentRentalTime || ""} items={values(settings.equipmentRentalTimes)} onChange={(value) => update(actions, "equipment", { equipmentRentalTime: value })} />
        <SelectField label="반납 시간" id="equipment-return-time" value={state.selectedEquipmentReturnTime || ""} items={values(settings.equipmentReturnTimes)} onChange={(value) => update(actions, "equipment", { equipmentReturnTime: value })} />
      </div>
      {!result.available && state.selectedEquipmentPeriod && state.selectedEquipmentRentalTime && state.selectedEquipmentReturnTime
        ? <p className="student-react-field-error" role="alert">{result.reason}</p>
        : null}
    </>
  );
}

function EquipmentStep({ state, actions }: Omit<ReservationControlsProps, "type">) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [visibleLimit, setVisibleLimit] = useState(EQUIPMENT_RESULT_PAGE_SIZE);
  const equipment = (state.bootstrap.equipment || []).filter((item) => item.active !== false);
  const inquiryEquipment = equipment.filter((item) => item.source === "fantasy_lab" || item.inquiryOnly);
  const onlineEquipment = equipment.filter((item) => item.source !== "fantasy_lab" && !item.inquiryOnly);
  const selected = state.selectedEquipmentItemIds;
  const scheduleResult = equipmentScheduleAvailability(
    state.bootstrap,
    state.selectedDates.equipment,
    state.selectedEquipmentPeriod || "",
    state.selectedEquipmentRentalTime || "",
    state.selectedEquipmentReturnTime || "",
    state.today
  );
  const categories = useMemo(() => [
    ...new Set([
      ...(state.bootstrap.settings.equipmentCategories || []),
      ...onlineEquipment.map((item) => item.category || "Other")
    ])
  ].filter(Boolean), [onlineEquipment, state.bootstrap.settings.equipmentCategories]);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleEquipment = onlineEquipment.filter((item) => {
    const matchesCategory = category === "all" || item.category === category;
    const haystack = [item.code, item.name, item.category, item.brand, item.model, item.notes].filter(Boolean).join(" ").toLowerCase();
    return matchesCategory && (!normalizedQuery || haystack.includes(normalizedQuery));
  });
  const items = visibleEquipment.map((item) => {
    const result = scheduleResult.available
      ? equipmentItemAvailability(
          state.bootstrap,
          item,
          state.selectedDates.equipment,
          state.selectedEquipmentPeriod || ""
        )
      : scheduleResult;
    return {
      value: item.id,
      label: item.name || item.code || "기자재",
      description: result.available
        ? [item.code, item.category, item.brand].filter(Boolean).join(" · ")
        : result.reason,
      disabled: !result.available && !selected.includes(item.id)
    };
  });
  const selectedItems = selected
    .map((id) => onlineEquipment.find((item) => item.id === id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  useEffect(() => {
    setVisibleLimit(EQUIPMENT_RESULT_PAGE_SIZE);
  }, [category, query]);
  const selectedBodyBrands = [...new Set(selectedItems
    .filter((item) => String(item.category || "").toLowerCase() === "body")
    .map((item) => String(item.brand || "").trim().toLowerCase())
    .filter(Boolean))];
  const recommendedLenses = onlineEquipment.filter((item) => (
    String(item.category || "").toLowerCase() === "lens"
    && selectedBodyBrands.includes(String(item.brand || "").trim().toLowerCase())
    && !selected.includes(item.id)
    && equipmentItemAvailability(state.bootstrap, item, state.selectedDates.equipment, state.selectedEquipmentPeriod || "").available
  ));
  const recommendationBrands = [...new Set(recommendedLenses.map((item) => item.brand).filter(Boolean))].join(" · ");
  return (
    <div className="student-react-equipment-picker">
      <p className="muted">필요한 장비를 여러 개 선택할 수 있습니다.</p>
      <aside className="student-react-equipment-manifest" aria-live="polite">
        <div className="student-react-equipment-manifest__head">
          <strong>선택 목록</strong>
          <span>{selectedItems.length}개 선택</span>
        </div>
        {selectedItems.length ? (
          <div className="student-react-equipment-manifest__items">
            {selectedItems.map((item) => (
              <span key={item.id} className="student-react-equipment-manifest__item">
                <span><strong>{item.name || item.code || "기자재"}</strong><small>{item.code || item.category || ""}</small></span>
                <GjuIconButton
                  label={`${item.name || item.code || "기자재"} 선택 해제`}
                  icon="x"
                  onClick={() => update(actions, "equipment", { equipmentItemIds: selected.filter((id) => id !== item.id) })}
                />
              </span>
            ))}
          </div>
        ) : <p className="muted">목록에서 필요한 장비를 선택하세요.</p>}
      </aside>
      <div className="field">
        <label htmlFor="student-equipment-search">기자재 검색</label>
        <input
          id="student-equipment-search"
          className="input"
          type="search"
          value={query}
          placeholder="장비명·코드·브랜드·비고 검색"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <GjuTabs
        id="student-equipment-category"
        panelId="student-equipment-results"
        ariaLabel="기자재 카테고리"
        items={[{ key: "all", label: "전체" }, ...categories.map((value) => ({ key: value, label: value }))]}
        activeKey={category}
        onChange={setCategory}
        className="student-react-filter-tabs"
      />
      <div id="student-equipment-results" role="tabpanel">
        <p className="student-react-equipment-result-count">검색 결과 {items.length}개 · {Math.min(items.length, visibleLimit)}개 표시</p>
        <ChoiceGrid
          label="기자재 선택 결과"
          name="equipmentItemIds"
          items={items.slice(0, visibleLimit)}
          selected={selected}
          onChange={(value, checked) => update(actions, "equipment", {
            equipmentItemIds: checked ? [...selected, value] : selected.filter((id) => id !== value)
          })}
        />
        {visibleLimit < items.length ? (
          <GjuButton variant="outline" onClick={() => setVisibleLimit((current) => current + EQUIPMENT_RESULT_PAGE_SIZE)}>
            더 보기 ({items.length - visibleLimit}개)
          </GjuButton>
        ) : null}
        {!items.length ? <p className="muted">검색 조건에 맞는 기자재가 없습니다.</p> : null}
      </div>
      {recommendedLenses.length ? (
        <section className="student-react-equipment-recommendations" aria-label={`${recommendationBrands} 렌즈 추천`}>
          <div>
            <strong>{recommendationBrands} 렌즈 추천</strong>
            <p className="muted">선택한 카메라 바디와 같은 브랜드의 예약 가능한 렌즈입니다.</p>
          </div>
          <div className="student-react-equipment-recommendation-list">
            {recommendedLenses.map((item) => (
              <GjuButton
                key={item.id}
                variant="outline"
                icon="plus"
                onClick={() => update(actions, "equipment", { equipmentItemIds: [...selected, item.id] })}
              >
                {item.name || item.code || "렌즈"}
              </GjuButton>
            ))}
          </div>
        </section>
      ) : null}
      {inquiryEquipment.length ? (
        <details className="student-react-inquiry-equipment">
          <summary>온라인 예약불가 기자재</summary>
          <p className="muted">판타지랩 및 문의 전용 기자재는 담당 조교에게 일정과 대여 조건을 직접 확인하세요.</p>
          <div className="student-react-inquiry-equipment-list">
            {inquiryEquipment.map((item) => (
              <article key={item.id}>
                <strong>{item.name || item.code || "문의 기자재"}</strong>
                <span>{[item.category, item.code, item.notes].filter(Boolean).join(" · ")}</span>
              </article>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function PrintDrivePanel({ state }: { state: StudentState }) {
  const driveUrl = String(state.bootstrap.settings.googleDriveUrl || "").trim();
  return (
    <aside className="student-react-drive-panel">
      <div>
        <strong>출력 파일 업로드</strong>
        <p className="muted">구글 드라이브에 출력 파일을 업로드한 뒤 예약 정보를 입력하세요.</p>
      </div>
      {driveUrl ? (
        <a className="button primary compact" href={driveUrl} target="_blank" rel="noopener noreferrer">구글 드라이브 열기</a>
      ) : (
        <div className="student-react-drive-panel__missing" role="alert">
          <GjuStatusBadge tone="amber">링크 등록 필요</GjuStatusBadge>
          <span>관리자 설정에서 드라이브 링크를 등록해 주세요.</span>
        </div>
      )}
    </aside>
  );
}

function StudioSpaceStep({ state, actions }: Omit<ReservationControlsProps, "type">) {
  const date = state.selectedDates.studio;
  const selected = state.selectedStudioSpace ? [state.selectedStudioSpace] : [];
  const slots = values(state.bootstrap.settings.studioSlots);
  const items = values(state.bootstrap.settings.studioSpaces).map((space) => {
    const availableSlots = slots.filter((slot) => studioSlotAvailability(state.bootstrap, date, space, slot).available);
    return {
      value: space,
      description: availableSlots.length ? `선택 가능 시간 ${availableSlots.length}개` : "해당 날짜 예약 불가",
      disabled: availableSlots.length === 0
    };
  });
  return (
    <ChoiceGrid
      single
      label="공간 1개 선택"
      name="studio-space"
      items={items}
      selected={selected}
      onChange={(value, checked) => {
        if (checked) update(actions, "studio", { studioSpace: value, studioSlots: [] });
      }}
    />
  );
}

function StudioTimeStep({ state, actions }: Omit<ReservationControlsProps, "type">) {
  const date = state.selectedDates.studio;
  const space = state.selectedStudioSpace || "";
  const selected = state.selectedStudioSlots;
  const items = values(state.bootstrap.settings.studioSlots).map((slot) => {
    const checked = selected.includes(slot);
    const base = studioSlotAvailability(state.bootstrap, date, space, slot);
    const candidate = checked
      ? base
      : studioSelectionAvailability(state.bootstrap, date, space, [...selected, slot]);
    return {
      value: slot,
      description: checked && !base.available ? base.reason : candidate.available ? "예약 가능" : candidate.reason,
      disabled: !checked && !candidate.available
    };
  });
  return (
    <ChoiceGrid
      label={`사용 시간 (최대 ${Number(state.bootstrap.settings.studioMaxSlots || 3)}타임 연속)`}
      name="studio-slots"
      items={items}
      selected={selected}
      onChange={(value, checked) => update(actions, "studio", {
        studioSlots: checked ? [...selected, value] : selected.filter((slot) => slot !== value)
      })}
    />
  );
}

function DarkroomTimeStep({ state, actions }: Omit<ReservationControlsProps, "type">) {
  const date = state.selectedDates.darkroom;
  const selected = state.selectedDarkroomSlots;
  const participants = Math.max(1, Number(state.selectedDarkroomParticipantCount || 1));
  const items = values(state.bootstrap.settings.darkroomSlots).map((slot) => {
    const result = darkroomSlotAvailability(state.bootstrap, date, slot, participants);
    const checked = selected.includes(slot);
    return {
      value: slot,
      description: result.available ? `잔여 ${result.remaining}명` : result.reason,
      disabled: !checked && !result.available
    };
  });
  return (
    <ChoiceGrid
      label="사용 시간"
      name="darkroom-slots"
      items={items}
      selected={selected}
      onChange={(value, checked) => update(actions, "darkroom", {
        darkroomSlots: checked ? [...selected, value] : selected.filter((slot) => slot !== value)
      })}
    />
  );
}

function DarkroomProcessStep({ state, actions }: Omit<ReservationControlsProps, "type">) {
  const selected = state.selectedDarkroomProcessTypes;
  const chemicals = state.bootstrap.darkroomChemicals || [];
  const selectedChemicals = state.selectedDarkroomChemicals;
  const chemicalSupplies = chemicals.filter((chemical) => chemical.process !== "확대기 렌즈");
  const enlargerLenses = chemicals.filter((chemical) => chemical.process === "확대기 렌즈");
  const participantCount = state.selectedDarkroomParticipantCount || "1";
  const invalidSlot = state.selectedDarkroomSlots
    .map((slot) => ({ slot, result: darkroomSlotAvailability(state.bootstrap, state.selectedDates.darkroom, slot, Number(participantCount)) }))
    .find(({ result }) => !result.available);
  return (
    <>
      <div className="field">
        <label htmlFor="darkroom-participants">사용 인원</label>
        <input
          id="darkroom-participants"
          className="input"
          type="number"
          min={1}
          max={state.bootstrap.settings.darkroomCapacity || 6}
          value={participantCount}
          onChange={(event) => update(actions, "darkroom", { darkroomParticipantCount: event.target.value })}
        />
      </div>
      {invalidSlot ? <p className="student-react-field-error" role="alert">{invalidSlot.slot}: {invalidSlot.result.reason}</p> : null}
      <ChoiceGrid
        label="작업 종류"
        name="darkroom-process"
        items={values(state.bootstrap.settings.darkroomProcessTypes, ["현상", "인화"]).map((value) => ({ value }))}
        selected={selected}
        onChange={(value, checked) => update(actions, "darkroom", {
          darkroomProcessTypes: checked ? [...selected, value] : selected.filter((item) => item !== value)
        })}
      />
      <fieldset className="field">
        <legend>사용 약품 및 기자재</legend>
        <div className="student-react-chemical-grid">
          {chemicalSupplies.map((chemical) => (
            <SelectField
              key={chemical.id}
              id={`darkroom-chemical-${chemical.id}`}
              label={chemical.name}
              value={selectedChemicals[chemical.id] || ""}
              items={chemical.options}
              onChange={(amount) => update(actions, "darkroom", {
                darkroomChemicals: { ...selectedChemicals, [chemical.id]: amount }
              })}
            />
          ))}
        </div>
        {enlargerLenses.length ? (
          <div className="student-react-darkroom-equipment-group">
            <h3>확대기 렌즈</h3>
            <p className="muted">약품과 구분해 사용할 렌즈 수량을 선택하세요.</p>
            <div className="student-react-chemical-grid">
              {enlargerLenses.map((chemical) => (
                <SelectField
                  key={chemical.id}
                  id={`darkroom-chemical-${chemical.id}`}
                  label={chemical.name}
                  value={selectedChemicals[chemical.id] || ""}
                  items={chemical.options}
                  onChange={(amount) => update(actions, "darkroom", {
                    darkroomChemicals: { ...selectedChemicals, [chemical.id]: amount }
                  })}
                />
              ))}
            </div>
          </div>
        ) : null}
      </fieldset>
    </>
  );
}

function PrintTimeStep({ state, actions }: Omit<ReservationControlsProps, "type">) {
  const buckets = printCapacityBuckets(state.bootstrap.settings);
  const selectedValue = state.selectedPrintStartTime && state.selectedPrintEndTime
    ? `${state.selectedPrintStartTime}|${state.selectedPrintEndTime}`
    : "";
  const items = buckets.map((bucket) => {
    const result = printBucketAvailability(state.bootstrap, state.selectedDates.print, bucket);
    return {
      value: `${bucket.startTime}|${bucket.endTime}`,
      label: `${bucket.startTime}-${bucket.endTime}`,
      description: result.available ? `${result.remaining}명 가능` : result.reason,
      disabled: !result.available && selectedValue !== `${bucket.startTime}|${bucket.endTime}`
    };
  });
  return (
    <ChoiceGrid
      single
      label="사용 시간 1개 선택"
      name="print-bucket"
      items={items}
      selected={selectedValue ? [selectedValue] : []}
      onChange={(value, checked) => {
        if (!checked) return;
        const [startTime, endTime] = value.split("|");
        update(actions, "print", { printStartTime: startTime, printEndTime: endTime });
      }}
    />
  );
}

function PrintOptionsStep({ state, actions }: Omit<ReservationControlsProps, "type">) {
  return (
    <>
      <ChoiceGrid label="출력 종류" name="print-types" items={values(state.bootstrap.settings.printTypes).map((value) => ({ value }))} selected={state.selectedPrintTypes} onChange={(value, checked) => update(actions, "print", { printTypes: checked ? [...state.selectedPrintTypes, value] : state.selectedPrintTypes.filter((item) => item !== value) })} />
      <ChoiceGrid label="용지" name="print-papers" items={values(state.bootstrap.settings.printPapers).map((value) => ({ value }))} selected={state.selectedPrintPapers} onChange={(value, checked) => update(actions, "print", { printPapers: checked ? [...state.selectedPrintPapers, value] : state.selectedPrintPapers.filter((item) => item !== value) })} />
      <ChoiceGrid label="사이즈" name="print-sizes" items={values(state.bootstrap.settings.printSizes).map((value) => ({ value }))} selected={state.selectedPrintSizes} onChange={(value, checked) => update(actions, "print", { printSizes: checked ? [...state.selectedPrintSizes, value] : state.selectedPrintSizes.filter((item) => item !== value) })} />
    </>
  );
}

function currentStepAvailability(type: ReservationType, step: ReservationStep, state: StudentState): AvailabilityResult {
  if (step === "date") {
    return reservationDateAvailability(type, state.selectedDates[type], state.bootstrap.settings, state.today);
  }
  if (type === "equipment" && step === "schedule") {
    return equipmentScheduleAvailability(
      state.bootstrap,
      state.selectedDates.equipment,
      state.selectedEquipmentPeriod || "",
      state.selectedEquipmentRentalTime || "",
      state.selectedEquipmentReturnTime || "",
      state.today
    );
  }
  if (type === "equipment" && step === "select") {
    const schedule = equipmentScheduleAvailability(
      state.bootstrap,
      state.selectedDates.equipment,
      state.selectedEquipmentPeriod || "",
      state.selectedEquipmentRentalTime || "",
      state.selectedEquipmentReturnTime || "",
      state.today
    );
    if (!schedule.available) return schedule;
    if (!state.selectedEquipmentItemIds.length) return { available: false, reason: "기자재를 1개 이상 선택하세요." };
    for (const itemId of state.selectedEquipmentItemIds) {
      const item = (state.bootstrap.equipment || []).find((candidate) => candidate.id === itemId);
      if (!item) return { available: false, reason: "선택한 기자재 정보를 다시 확인하세요." };
      const result = equipmentItemAvailability(state.bootstrap, item, state.selectedDates.equipment, state.selectedEquipmentPeriod || "");
      if (!result.available) return result;
    }
    return { available: true };
  }
  if (type === "studio" && step === "select") {
    if (!state.selectedStudioSpace) return { available: false, reason: "공간을 1개 선택하세요." };
    const hasSlot = values(state.bootstrap.settings.studioSlots).some((slot) => (
      studioSlotAvailability(state.bootstrap, state.selectedDates.studio, state.selectedStudioSpace || "", slot).available
    ));
    return hasSlot ? { available: true } : { available: false, reason: "선택한 공간에 예약 가능한 시간이 없습니다." };
  }
  if (type === "studio" && step === "schedule") {
    return studioSelectionAvailability(state.bootstrap, state.selectedDates.studio, state.selectedStudioSpace || "", state.selectedStudioSlots);
  }
  if (type === "darkroom" && step === "schedule") {
    if (!state.selectedDarkroomSlots.length) return { available: false, reason: "암실 사용 시간을 선택하세요." };
    for (const slot of state.selectedDarkroomSlots) {
      const result = darkroomSlotAvailability(state.bootstrap, state.selectedDates.darkroom, slot, Number(state.selectedDarkroomParticipantCount || 1));
      if (!result.available) return result;
    }
    return { available: true };
  }
  if (type === "darkroom" && step === "process") {
    if (!state.selectedDarkroomProcessTypes.length) return { available: false, reason: "작업 종류를 선택하세요." };
    const participants = Number(state.selectedDarkroomParticipantCount || 1);
    if (!Number.isFinite(participants) || participants < 1) return { available: false, reason: "사용 인원을 확인하세요." };
    for (const slot of state.selectedDarkroomSlots) {
      const result = darkroomSlotAvailability(state.bootstrap, state.selectedDates.darkroom, slot, participants);
      if (!result.available) return result;
    }
    return { available: true };
  }
  if (type === "print" && step === "schedule") {
    const bucket = printCapacityBuckets(state.bootstrap.settings).find((candidate) => (
      candidate.startTime === state.selectedPrintStartTime && candidate.endTime === state.selectedPrintEndTime
    ));
    return bucket
      ? printBucketAvailability(state.bootstrap, state.selectedDates.print, bucket)
      : { available: false, reason: "출력실 사용 시간을 선택하세요." };
  }
  if (type === "print" && step === "options") {
    if (!state.selectedPrintTypes.length) return { available: false, reason: "출력 종류를 선택하세요." };
    if (!state.selectedPrintPapers.length) return { available: false, reason: "용지를 선택하세요." };
    if (!state.selectedPrintSizes.length) return { available: false, reason: "사이즈를 선택하세요." };
  }
  return { available: true };
}

function FlowActions({ type, step, state, actions }: ReservationControlsProps & { step: ReservationStep }) {
  const index = stepIndex(type, step);
  const next = FLOW_STEPS[type][index + 1];
  const result = currentStepAvailability(type, step, state);
  return (
    <>
      {!result.available ? <p className="student-react-flow-reason" role="status">{result.reason}</p> : null}
      <div className="row-actions student-react-flow-actions">
        {index > 0 ? <GjuButton variant="ghost" onClick={() => void actions.setReservationStep(type, FLOW_STEPS[type][index - 1])}>이전</GjuButton> : null}
        <GjuButton icon="plus" disabled={!result.available || !next} onClick={() => {
          if (result.available && next) void actions.setReservationStep(type, next);
        }}>다음</GjuButton>
      </div>
    </>
  );
}

function ReservationReview({ type, state }: { type: ReservationType; state: StudentState }) {
  const labels: Record<ReservationType, string> = {
    equipment: `${state.selectedEquipmentItemIds.length}개 기자재`,
    studio: `${state.selectedStudioSpace || "공간 미선택"} · ${state.selectedStudioSlots.join(", ")}`,
    darkroom: `${state.selectedDarkroomSlots.join(", ")} · ${state.selectedDarkroomProcessTypes.join(", ")}`,
    print: `${state.selectedPrintStartTime || "-"}-${state.selectedPrintEndTime || "-"}`
  };
  return (
    <GjuCard title="예약 내용 확인" className="student-react-reservation-review">
      <div className="property-list student-react-review-properties">
        <div><span className="student-react-review-properties__label">사용일</span><strong>{state.selectedDates[type] || "-"}</strong></div>
        <div><span className="student-react-review-properties__label">예약 대상</span><strong>{labels[type]}</strong></div>
        <div><span className="student-react-review-properties__label">상태</span><GjuStatusBadge tone="blue">제출 전</GjuStatusBadge></div>
      </div>
    </GjuCard>
  );
}

function useReservationSubmission(
  type: ReservationType,
  state: StudentState,
  actions: StudentActions,
  details: ReservationDetails
) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await submitReservationDraft(type, state, details, actions);
    } catch (submissionError) {
      setError(errorMessage(submissionError));
    } finally {
      setSubmitting(false);
    }
  }
  return { error, submitting, submit };
}

function DetailActions({ type, actions, submitting }: { type: ReservationType; actions: StudentActions; submitting: boolean }) {
  const steps = FLOW_STEPS[type];
  return (
    <div className="row-actions student-react-flow-actions">
      <GjuButton variant="ghost" disabled={submitting} onClick={() => void actions.setReservationStep(type, steps[steps.length - 2])}>이전</GjuButton>
      <GjuButton type="submit" icon="check" loading={submitting}>{type === "equipment" ? "승인 요청" : "예약 신청"}</GjuButton>
    </div>
  );
}

function EquipmentDetailsForm({ state, actions }: Omit<ReservationControlsProps, "type">) {
  const selectedItems = state.selectedEquipmentItemIds
    .map((id) => (state.bootstrap.equipment || []).find((item) => item.id === id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const highValue = selectedItems.some((item) => isHighValueEquipment(item, state.bootstrap.settings));
  const cameraBag = selectedItems.some((item) => isCameraBagEquipment(item, state.bootstrap.settings));
  const [details, setDetails] = useState<EquipmentReservationDetails>({
    cameraBagConfirmed: cameraBag,
    equipmentPolicyConfirmed: false,
    phone: state.user.phone || "",
    purpose: "",
    standRequest: ""
  });
  const submission = useReservationSubmission("equipment", state, actions, details);
  return (
    <form className="student-react-details-form" onSubmit={submission.submit}>
      <ReservationReview type="equipment" state={state} />
      {highValue ? (
        <label className="field consent"><span>
          <input type="checkbox" required={!cameraBag} checked={cameraBag || details.cameraBagConfirmed} disabled={cameraBag} onChange={(event) => setDetails((current) => ({ ...current, cameraBagConfirmed: event.target.checked }))} />
          {cameraBag ? "펠리컨 가방이 함께 선택되었습니다." : state.bootstrap.settings.equipmentCameraBagNotice || "카메라 가방을 지참하겠습니다."}
        </span></label>
      ) : null}
      <div className="field"><label htmlFor="equipment-phone">연락처</label><input id="equipment-phone" className="input" required value={details.phone} onChange={(event) => setDetails((current) => ({ ...current, phone: event.target.value }))} /></div>
      <div className="field"><label htmlFor="equipment-stand-request">스탠드/소프트박스 요청</label><input id="equipment-stand-request" className="input" value={details.standRequest} onChange={(event) => setDetails((current) => ({ ...current, standRequest: event.target.value }))} /></div>
      <div className="field"><label htmlFor="equipment-purpose">사용 목적</label><textarea id="equipment-purpose" className="textarea" value={details.purpose} onChange={(event) => setDetails((current) => ({ ...current, purpose: event.target.value }))} /></div>
      <label className="field consent"><span><input type="checkbox" required checked={details.equipmentPolicyConfirmed} onChange={(event) => setDetails((current) => ({ ...current, equipmentPolicyConfirmed: event.target.checked }))} /> 파손/분실 자가부담 및 대리 대여/반납 불가에 동의합니다.</span></label>
      {submission.error ? <p className="student-react-submit-error" role="alert">{submission.error}</p> : null}
      <DetailActions type="equipment" actions={actions} submitting={submission.submitting} />
    </form>
  );
}

function StudioDetailsForm({ state, actions }: Omit<ReservationControlsProps, "type">) {
  const [details, setDetails] = useState<StudioReservationDetails>({
    participants: state.user.name,
    requiredEquipment: "",
    purpose: "",
    phone: state.user.phone || "",
    studioPolicyConfirmed: false
  });
  const submission = useReservationSubmission("studio", state, actions, details);
  return (
    <form className="student-react-details-form" onSubmit={submission.submit}>
      <ReservationReview type="studio" state={state} />
      <div className="field"><label htmlFor="studio-participants">사용 명단</label><input id="studio-participants" className="input" required value={details.participants} onChange={(event) => setDetails((current) => ({ ...current, participants: event.target.value }))} /></div>
      <div className="field"><label htmlFor="studio-equipment">필요 장비</label><textarea id="studio-equipment" className="textarea" value={details.requiredEquipment} onChange={(event) => setDetails((current) => ({ ...current, requiredEquipment: event.target.value }))} /></div>
      <div className="field"><label htmlFor="studio-purpose">사용 목적</label><textarea id="studio-purpose" className="textarea" value={details.purpose} onChange={(event) => setDetails((current) => ({ ...current, purpose: event.target.value }))} /></div>
      <div className="field"><label htmlFor="studio-phone">연락처</label><input id="studio-phone" className="input" required value={details.phone} onChange={(event) => setDetails((current) => ({ ...current, phone: event.target.value }))} /></div>
      <label className="field consent"><span><input type="checkbox" required checked={details.studioPolicyConfirmed} onChange={(event) => setDetails((current) => ({ ...current, studioPolicyConfirmed: event.target.checked }))} /> 사용 후 정리정돈과 보고서 제출 규정을 확인했습니다.</span></label>
      {submission.error ? <p className="student-react-submit-error" role="alert">{submission.error}</p> : null}
      <DetailActions type="studio" actions={actions} submitting={submission.submitting} />
    </form>
  );
}

function DarkroomDetailsForm({ state, actions }: Omit<ReservationControlsProps, "type">) {
  const [details, setDetails] = useState<DarkroomReservationDetails>({
    purpose: "",
    phone: state.user.phone || "",
    darkroomPolicyConfirmed: false
  });
  const submission = useReservationSubmission("darkroom", state, actions, details);
  return (
    <form className="student-react-details-form" onSubmit={submission.submit}>
      <ReservationReview type="darkroom" state={state} />
      <div className="field"><label htmlFor="darkroom-purpose">사용 목적</label><textarea id="darkroom-purpose" className="textarea" value={details.purpose} onChange={(event) => setDetails((current) => ({ ...current, purpose: event.target.value }))} /></div>
      <div className="field"><label htmlFor="darkroom-phone">연락처</label><input id="darkroom-phone" className="input" required value={details.phone} onChange={(event) => setDetails((current) => ({ ...current, phone: event.target.value }))} /></div>
      <label className="field consent"><span><input type="checkbox" required checked={details.darkroomPolicyConfirmed} onChange={(event) => setDetails((current) => ({ ...current, darkroomPolicyConfirmed: event.target.checked }))} /> 약품 폐수 분리, 청소, 취식 금지 규정을 확인했습니다.</span></label>
      {submission.error ? <p className="student-react-submit-error" role="alert">{submission.error}</p> : null}
      <DetailActions type="darkroom" actions={actions} submitting={submission.submitting} />
    </form>
  );
}

function PrintDetailsForm({ state, actions }: Omit<ReservationControlsProps, "type">) {
  const [details, setDetails] = useState<PrintReservationDetails>({
    count: 1,
    memo: "",
    phone: state.user.phone || ""
  });
  const submission = useReservationSubmission("print", state, actions, details);
  return (
    <form className="student-react-details-form" onSubmit={submission.submit}>
      <ReservationReview type="print" state={state} />
      <div className="field"><label htmlFor="print-count">매수</label><input id="print-count" className="input" type="number" min={1} required value={details.count} onChange={(event) => setDetails((current) => ({ ...current, count: event.target.value }))} /></div>
      <div className="field"><label htmlFor="print-memo">메모</label><textarea id="print-memo" className="textarea" value={details.memo} onChange={(event) => setDetails((current) => ({ ...current, memo: event.target.value }))} /></div>
      <div className="field"><label htmlFor="print-phone">연락처</label><input id="print-phone" className="input" required value={details.phone} onChange={(event) => setDetails((current) => ({ ...current, phone: event.target.value }))} /></div>
      {state.bootstrap.settings.printBankAccount ? <div className="info-strip"><strong>출력비 계좌</strong><span>{state.bootstrap.settings.printBankAccount}</span></div> : null}
      {submission.error ? <p className="student-react-submit-error" role="alert">{submission.error}</p> : null}
      <DetailActions type="print" actions={actions} submitting={submission.submitting} />
    </form>
  );
}

function DetailsStep({ type, state, actions }: ReservationControlsProps) {
  if (type === "equipment") return <EquipmentDetailsForm state={state} actions={actions} />;
  if (type === "studio") return <StudioDetailsForm state={state} actions={actions} />;
  if (type === "darkroom") return <DarkroomDetailsForm state={state} actions={actions} />;
  return <PrintDetailsForm state={state} actions={actions} />;
}

function StepBody({ type, state, actions }: ReservationControlsProps) {
  const step = state.reservationFlowStep[type] || "date";
  if (step === "date") return <DateStep type={type} state={state} actions={actions} />;
  if (type === "equipment" && step === "schedule") return <EquipmentScheduleStep state={state} actions={actions} />;
  if (type === "equipment" && step === "select") return <EquipmentStep state={state} actions={actions} />;
  if (type === "studio" && step === "select") return <StudioSpaceStep state={state} actions={actions} />;
  if (type === "studio" && step === "schedule") return <StudioTimeStep state={state} actions={actions} />;
  if (type === "darkroom" && step === "schedule") return <DarkroomTimeStep state={state} actions={actions} />;
  if (type === "darkroom" && step === "process") return <DarkroomProcessStep state={state} actions={actions} />;
  if (type === "print" && step === "schedule") return <PrintTimeStep state={state} actions={actions} />;
  if (type === "print" && step === "options") return <PrintOptionsStep state={state} actions={actions} />;
  return <DetailsStep key={`${type}:${state.selectedDates[type]}`} type={type} state={state} actions={actions} />;
}

export function ReservationControls({ type, state, actions }: ReservationControlsProps) {
  const step = state.reservationFlowStep[type] || "date";
  const flowRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const heading = flowRef.current?.querySelector<HTMLElement>(".student-react-reservation-step h2");
    if (!heading) return;
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }, [step, type]);
  return (
    <section ref={flowRef} className="reservation-layout student-react-reservation-flow">
      {type === "print" ? <PrintDrivePanel state={state} /> : null}
      <StepProgress type={type} state={state} actions={actions} />
      <GjuCard title="예약 정보" className="student-react-reservation-step">
        <StepBody type={type} state={state} actions={actions} />
        {step !== "details" ? <FlowActions type={type} step={step} state={state} actions={actions} /> : null}
      </GjuCard>
    </section>
  );
}
