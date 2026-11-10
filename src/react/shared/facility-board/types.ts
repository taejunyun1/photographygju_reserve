export type FacilityRoomKey = "a" | "b" | "dark" | "print" | "digital";
export type FacilitySelectionKey = FacilityRoomKey | "gear";
export type FacilityViewer = "admin" | "student";

export type FacilityReservationInterval = {
  entryKey: string;
  startAt: string;
  endAt: string;
  status: string;
  label: string;
  isMine: boolean;
  reservationId?: string;
  contactName?: string;
  phone?: string;
  subspaceKeys?: string[];
  handoffNeedsReview?: boolean;
  historyUnavailable?: boolean;
};

export type FacilitySpaceTimeline = {
  key: FacilityRoomKey;
  name: string;
  type: "studio" | "darkroom" | "print" | "digital_lab";
  subspaces: Array<{ key: string; label: string; computerType?: "mac" | "pc" }>;
  intervals: FacilityReservationInterval[];
  blockedIntervals: Array<{ startAt: string; endAt: string; label: string; subspaceKeys?: string[]; reasonCode?: "disabled" | "outside_hours" | "class_blocked" }>;
};

export type FacilityEquipmentCustody = {
  label: string;
  isMine: boolean;
  reservationId?: string;
  checkedOutAt: string | null;
  expectedReturnAt: string | null;
  overdue: boolean;
};

export type FacilityEquipmentTimeline = {
  equipmentId: string;
  name: string;
  category: string;
  facility: string;
  source: string;
  code?: string;
  custody: FacilityEquipmentCustody | null;
  reservations: FacilityReservationInterval[];
  history: Array<{
    startAt: string;
    endAt: string;
    label: string;
    isMine: boolean;
    reservationId?: string;
  }>;
};

export type FacilityTimelineData = {
  schemaVersion: 1;
  layoutVersion: "corridor-v1";
  viewer: FacilityViewer;
  date: string;
  today: string;
  maxDate: string;
  timeZone: "Asia/Seoul";
  generatedAt: string;
  validUntil: string;
  spaces: FacilitySpaceTimeline[];
  equipment: FacilityEquipmentTimeline[];
  equipmentBlockedIntervals?: Array<{ startAt: string; endAt: string; label: string }>;
};

export type FacilityTimelineResource = {
  invalidated?: boolean;
  date: string;
  data: FacilityTimelineData | null;
  loading: boolean;
  error: string;
  lastSucceededAt: string;
};

export type FacilityReservationIntent = {
  type: "studio" | "darkroom" | "print" | "equipment" | "digital_lab";
  selectedDate: string;
  equipmentItemIds?: string[];
  studioSpace?: string;
  studioSlots?: string[];
  darkroomSlots?: string[];
  printStartTime?: string;
  printEndTime?: string;
  digitalLabStartTime?: string;
  digitalLabEndTime?: string;
  digitalLabSeatId?: string;
};

export type FacilityBoardProps = {
  viewer: FacilityViewer;
  resource: FacilityTimelineResource;
  approved?: boolean;
  /** The admin dashboard host refreshes today's summary on focus, visibility and native resume. */
  lifecycleRefresh?: "dedicated" | "admin-summary-today";
  onLoad: (date: string, options?: { force?: boolean }) => Promise<unknown> | void;
  onOpenReservation?: (reservationId: string) => void;
  onOpenEquipment?: (equipmentId?: string) => void;
  onReserve?: (intent: FacilityReservationIntent) => Promise<void> | void;
};
