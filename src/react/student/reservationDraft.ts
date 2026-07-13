import {
  darkroomSlotAvailability,
  equipmentItemAvailability,
  equipmentScheduleAvailability,
  isCameraBagEquipment,
  isHighValueEquipment,
  printBucketAvailability,
  printCapacityBuckets,
  reservationDateAvailability,
  studioSelectionAvailability
} from "./availability";
import type {
  DarkroomReservationDraft,
  EquipmentReservationDraft,
  PrintReservationDraft,
  ReservationDraft,
  ReservationType,
  StudentActions,
  StudentState,
  StudioReservationDraft
} from "./types";

export type EquipmentReservationDetails = {
  cameraBagConfirmed: boolean;
  equipmentPolicyConfirmed: boolean;
  phone: string;
  purpose: string;
  standRequest: string;
};

export type StudioReservationDetails = {
  participants: string;
  requiredEquipment: string;
  purpose: string;
  phone: string;
  studioPolicyConfirmed: boolean;
};

export type DarkroomReservationDetails = {
  purpose: string;
  phone: string;
  darkroomPolicyConfirmed: boolean;
};

export type PrintReservationDetails = {
  count: number | string;
  memo: string;
  phone: string;
};

export type ReservationDetailsByType = {
  equipment: EquipmentReservationDetails;
  studio: StudioReservationDetails;
  darkroom: DarkroomReservationDetails;
  print: PrintReservationDetails;
};

export type ReservationDetails = ReservationDetailsByType[ReservationType];

function required(value: unknown, message: string): string {
  const text = String(value || "").trim();
  if (!text) throw new Error(message);
  return text;
}

function assertApproved(state: StudentState) {
  if (state.user.approvalStatus !== "approved") {
    throw new Error("학과 관리자 승인 후 예약할 수 있습니다.");
  }
}

function assertDate(type: ReservationType, state: StudentState): string {
  const date = state.selectedDates[type] || "";
  const result = reservationDateAvailability(type, date, state.bootstrap.settings, state.today);
  if (!result.available) throw new Error(result.reason || "예약 날짜를 확인하세요.");
  return date;
}

function equipmentDraft(state: StudentState, details: EquipmentReservationDetails): EquipmentReservationDraft {
  const reservedDate = assertDate("equipment", state);
  const period = required(state.selectedEquipmentPeriod, "대여 기간을 선택하세요.");
  const rentalTime = required(state.selectedEquipmentRentalTime, "대여 시간을 선택하세요.");
  const returnTime = required(state.selectedEquipmentReturnTime, "반납 시간을 선택하세요.");
  const schedule = equipmentScheduleAvailability(state.bootstrap, reservedDate, period, rentalTime, returnTime, state.today);
  if (!schedule.available) throw new Error(schedule.reason || "대여 일정을 확인하세요.");
  const equipmentItemIds = [...new Set(state.selectedEquipmentItemIds)];
  if (!equipmentItemIds.length) throw new Error("기자재를 1개 이상 선택하세요.");
  const selectedItems = equipmentItemIds.map((itemId) => {
    const item = (state.bootstrap.equipment || []).find((candidate) => candidate.id === itemId);
    if (!item) throw new Error("선택한 기자재 정보를 다시 확인하세요.");
    const itemAvailability = equipmentItemAvailability(state.bootstrap, item, reservedDate, period);
    if (!itemAvailability.available) throw new Error(itemAvailability.reason || "예약할 수 없는 기자재가 포함되어 있습니다.");
    return item;
  });
  if (!details.equipmentPolicyConfirmed) {
    throw new Error("파손/분실 및 대리 대여 제한에 동의하세요.");
  }
  const highValue = selectedItems.some((item) => isHighValueEquipment(item, state.bootstrap.settings));
  const cameraBag = selectedItems.some((item) => isCameraBagEquipment(item, state.bootstrap.settings));
  if (highValue && !cameraBag && !details.cameraBagConfirmed) {
    throw new Error(state.bootstrap.settings.equipmentCameraBagNotice || "카메라 가방 지참 항목을 확인하세요.");
  }
  return {
    type: "equipment",
    fields: {
      reservedDate,
      period,
      rentalTime,
      returnTime,
      equipmentItemIds,
      cameraBagConfirmationRequired: highValue,
      pelicanBagReserved: highValue && cameraBag,
      cameraBagConfirmed: highValue ? cameraBag || details.cameraBagConfirmed : false,
      equipmentPolicyConfirmed: true,
      phone: required(details.phone, "연락처를 입력하세요."),
      purpose: String(details.purpose || "").trim(),
      standRequest: String(details.standRequest || "").trim()
    }
  };
}

function studioDraft(state: StudentState, details: StudioReservationDetails): StudioReservationDraft {
  const reservedDate = assertDate("studio", state);
  const studioSpace = required(state.selectedStudioSpace, "스튜디오 공간을 선택하세요.");
  const timeSlots = [...new Set(state.selectedStudioSlots)];
  const selection = studioSelectionAvailability(state.bootstrap, reservedDate, studioSpace, timeSlots);
  if (!selection.available) throw new Error(selection.reason || "스튜디오 시간 선택을 확인하세요.");
  if (!details.studioPolicyConfirmed) {
    throw new Error("정리정돈 및 보고서 제출 규정을 확인하고 동의하세요.");
  }
  return {
    type: "studio",
    fields: {
      reservedDate,
      studioSpace,
      studioSpaces: [studioSpace],
      timeSlots,
      participants: required(details.participants, "사용 명단을 입력하세요."),
      requiredEquipment: String(details.requiredEquipment || "").trim(),
      purpose: String(details.purpose || "").trim(),
      phone: required(details.phone, "연락처를 입력하세요."),
      studioPolicyConfirmed: true,
      reportStatus: "required"
    }
  };
}

function darkroomDraft(state: StudentState, details: DarkroomReservationDetails): DarkroomReservationDraft {
  const reservedDate = assertDate("darkroom", state);
  const timeSlots = [...new Set(state.selectedDarkroomSlots)];
  if (!timeSlots.length) throw new Error("암실 사용 시간을 선택하세요.");
  const slotBoundaries = timeSlots.map((slot) => String(slot || "").split(/\s*-\s*/, 2));
  if (slotBoundaries.some(([start]) => start === "00:00") && slotBoundaries.some(([, end]) => end === "24:00")) {
    throw new Error("암실 예약은 자정을 넘어 선택할 수 없습니다. 날짜별로 나누어 예약해 주세요.");
  }
  const processTypes = [...new Set(state.selectedDarkroomProcessTypes)];
  if (!processTypes.length) throw new Error("암실 작업 유형을 선택하세요.");
  const participantCount = Math.floor(Number(state.selectedDarkroomParticipantCount || 1));
  if (!Number.isFinite(participantCount) || participantCount < 1) throw new Error("사용 인원을 올바르게 입력하세요.");
  for (const slot of timeSlots) {
    const slotAvailability = darkroomSlotAvailability(state.bootstrap, reservedDate, slot, participantCount);
    if (!slotAvailability.available) throw new Error(`${slot}: ${slotAvailability.reason || "사용할 수 없습니다."}`);
  }
  if (!details.darkroomPolicyConfirmed) {
    throw new Error("약품 폐수 분리, 청소, 취식 금지 규정을 확인하고 동의하세요.");
  }
  const chemicals = (state.bootstrap.darkroomChemicals || []).flatMap((chemical) => {
    const amount = String(state.selectedDarkroomChemicals[chemical.id] || "").trim();
    return amount ? [{ id: chemical.id, name: chemical.name, amount }] : [];
  });
  return {
    type: "darkroom",
    fields: {
      reservedDate,
      timeSlots,
      processTypes,
      participantCount,
      chemicals,
      purpose: String(details.purpose || "").trim(),
      phone: required(details.phone, "연락처를 입력하세요."),
      darkroomPolicyConfirmed: true
    }
  };
}

function printDraft(state: StudentState, details: PrintReservationDetails): PrintReservationDraft {
  const reservedDate = assertDate("print", state);
  const startTime = required(state.selectedPrintStartTime, "출력실 사용 시간을 선택하세요.");
  const endTime = required(state.selectedPrintEndTime, "출력실 사용 시간을 선택하세요.");
  const bucket = printCapacityBuckets(state.bootstrap.settings).find((candidate) => (
    candidate.startTime === startTime && candidate.endTime === endTime
  ));
  if (!bucket) throw new Error("출력실 사용 시간 구간을 다시 선택하세요.");
  const bucketAvailability = printBucketAvailability(state.bootstrap, reservedDate, bucket);
  if (!bucketAvailability.available) throw new Error(bucketAvailability.reason || "선택한 출력실 시간은 예약할 수 없습니다.");
  const printTypes = [...new Set(state.selectedPrintTypes)];
  const papers = [...new Set(state.selectedPrintPapers)];
  const sizes = [...new Set(state.selectedPrintSizes)];
  if (!printTypes.length) throw new Error("출력 종류를 선택하세요.");
  if (!papers.length) throw new Error("용지를 선택하세요.");
  if (!sizes.length) throw new Error("사이즈를 선택하세요.");
  const count = Math.floor(Number(details.count));
  if (!Number.isFinite(count) || count < 1) throw new Error("출력 매수를 1 이상 입력하세요.");
  return {
    type: "print",
    fields: {
      reservedDate,
      bucket: { startTime, endTime },
      startTime,
      endTime,
      printTypes,
      papers,
      sizes,
      printType: printTypes.join(", "),
      paper: papers.join(", "),
      size: sizes.join(", "),
      count,
      memo: String(details.memo || "").trim(),
      phone: required(details.phone, "연락처를 입력하세요.")
    }
  };
}

export function buildReservationDraft(
  type: ReservationType,
  state: StudentState,
  details: ReservationDetails
): ReservationDraft {
  assertApproved(state);
  if (type === "equipment") return equipmentDraft(state, details as EquipmentReservationDetails);
  if (type === "studio") return studioDraft(state, details as StudioReservationDetails);
  if (type === "darkroom") return darkroomDraft(state, details as DarkroomReservationDetails);
  return printDraft(state, details as PrintReservationDetails);
}

export async function submitReservationDraft(
  type: ReservationType,
  state: StudentState,
  details: ReservationDetails,
  actions: StudentActions
): Promise<void> {
  const draft = buildReservationDraft(type, state, details);
  await actions.submitReservation(draft);
}
