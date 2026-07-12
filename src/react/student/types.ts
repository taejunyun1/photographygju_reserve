export type StudentNavKey = "home" | "reserve" | "mine" | "reports" | "lectures" | "notices" | "my";

export type ReservationType = "equipment" | "studio" | "darkroom" | "print";

export type ReservationStep = "date" | "schedule" | "select" | "process" | "options" | "details";

export type StudentUser = {
  id?: string;
  name: string;
  email?: string;
  studentId?: string;
  grade?: string;
  phone?: string;
  studentStatus?: string;
  approvalStatus?: string;
};

export type StudentNotice = {
  id: string;
  title: string;
  category?: string;
  body?: string;
  link?: string;
  pinned?: boolean;
  createdAt?: string;
};

export type StudentLecture = {
  id: string;
  title: string;
  lectureDate?: string;
  time?: string;
  location?: string;
  instructorName?: string;
  instructorAffiliation?: string;
  professor?: string;
  targetGrades?: string;
  status?: string;
  description?: string;
  notes?: string;
  applicationCount?: number;
  capacity?: number;
  applied?: boolean;
  canCancelApplication?: boolean;
};

export type StudentEquipment = {
  id: string;
  code?: string;
  name?: string;
  category?: string;
  brand?: string;
  model?: string;
  status?: string;
  reservable?: boolean;
  active?: boolean;
  notes?: string;
  source?: string;
  facility?: string;
  inquiryOnly?: boolean;
};

export type StudentDarkroomChemical = {
  id: string;
  process?: string;
  name: string;
  options: readonly string[];
};

export type StudentChemicalSelection = {
  id: string;
  name: string;
  amount: string;
};

export type StudentBlockedSchedule = {
  id?: string;
  type?: ReservationType;
  day?: string;
  from?: string;
  to?: string;
  start?: string;
  end?: string;
  target?: string;
  label?: string;
};

export type StudentReservationFields = {
  reservedDate?: string;
  period?: string;
  rentalTime?: string;
  returnTime?: string;
  equipmentItemIds?: readonly string[];
  studioSpace?: string;
  studioSpaces?: readonly string[];
  timeSlots?: readonly string[];
  processTypes?: readonly string[];
  participantCount?: number | string;
  participants?: string;
  requiredEquipment?: string;
  startTime?: string;
  endTime?: string;
  printType?: string;
  printTypes?: readonly string[];
  paper?: string;
  papers?: readonly string[];
  size?: string;
  sizes?: readonly string[];
  reportStatus?: string;
  [key: string]: unknown;
};

export type StudentReservation = {
  id: string;
  type: ReservationType | "lecture";
  status?: string;
  userId?: string;
  userName?: string;
  fields: StudentReservationFields;
  equipmentItems?: readonly StudentEquipment[];
  lecture?: StudentLecture | null;
  timing?: {
    startAt?: string;
    endAt?: string;
    reportDeadlineAt?: string;
  };
  createdAt?: string;
};

export type StudentSettings = {
  equipmentPeriods?: readonly string[];
  equipmentRentalTimes?: readonly string[];
  equipmentReturnTimes?: readonly string[];
  equipmentCategories?: readonly string[];
  equipmentHighValueCategories?: readonly string[];
  equipmentBagKeywords?: readonly string[];
  studioSpaces?: readonly string[];
  studioSlots?: readonly string[];
  studioMaxSlots?: number;
  darkroomSlots?: readonly string[];
  darkroomProcessTypes?: readonly string[];
  darkroomCapacity?: number;
  darkroomBlockedRules?: readonly StudentBlockedSchedule[];
  printAvailableStart?: string;
  printAvailableEnd?: string;
  printTimeUnitMinutes?: number;
  printCapacityWindowMinutes?: number;
  printCapacityPerWindow?: number;
  printUploadStartDate?: string;
  printUploadEndDate?: string;
  printTypes?: readonly string[];
  printPapers?: readonly string[];
  printSizes?: readonly string[];
  printBankAccount?: string;
  blockedSchedules?: readonly StudentBlockedSchedule[];
  googleDriveUrl?: string;
  studioReportDeadlineHours?: number;
  equipmentCameraBagNotice?: string;
  [key: string]: unknown;
};

export type StudentBootstrap = {
  settings: StudentSettings;
  notices: readonly StudentNotice[];
  equipment?: readonly StudentEquipment[];
  darkroomChemicals?: readonly StudentDarkroomChemical[];
  reservations?: readonly StudentReservation[];
};

export type EquipmentReservationDraft = {
  type: "equipment";
  fields: {
    reservedDate: string;
    period: string;
    rentalTime: string;
    returnTime: string;
    equipmentItemIds: readonly string[];
    cameraBagConfirmationRequired: boolean;
    pelicanBagReserved: boolean;
    cameraBagConfirmed: boolean;
    equipmentPolicyConfirmed: boolean;
    phone: string;
    purpose: string;
    standRequest: string;
  };
};

export type StudioReservationDraft = {
  type: "studio";
  fields: {
    reservedDate: string;
    studioSpace: string;
    studioSpaces: readonly [string];
    timeSlots: readonly string[];
    participants: string;
    requiredEquipment: string;
    purpose: string;
    phone: string;
    studioPolicyConfirmed: boolean;
    reportStatus: "required";
  };
};

export type DarkroomReservationDraft = {
  type: "darkroom";
  fields: {
    reservedDate: string;
    timeSlots: readonly string[];
    processTypes: readonly string[];
    participantCount: number;
    chemicals: readonly StudentChemicalSelection[];
    purpose: string;
    phone: string;
    darkroomPolicyConfirmed: boolean;
  };
};

export type PrintReservationDraft = {
  type: "print";
  fields: {
    reservedDate: string;
    bucket: { startTime: string; endTime: string };
    startTime: string;
    endTime: string;
    printTypes: readonly string[];
    papers: readonly string[];
    sizes: readonly string[];
    printType: string;
    paper: string;
    size: string;
    count: number;
    memo: string;
    phone: string;
  };
};

export type ReservationDraft =
  | EquipmentReservationDraft
  | StudioReservationDraft
  | DarkroomReservationDraft
  | PrintReservationDraft;

export type StudentReservationSelectionPatch = {
  type: ReservationType;
  selectedDate?: string;
  equipmentPeriod?: string;
  equipmentRentalTime?: string;
  equipmentReturnTime?: string;
  equipmentItemIds?: readonly string[];
  studioSpace?: string;
  studioSlots?: readonly string[];
  darkroomSlots?: readonly string[];
  darkroomProcessTypes?: readonly string[];
  darkroomParticipantCount?: string;
  darkroomChemicals?: Readonly<Record<string, string>>;
  printStartTime?: string;
  printEndTime?: string;
  printTypes?: readonly string[];
  printPapers?: readonly string[];
  printSizes?: readonly string[];
};

export type StudentReportPayload = {
  actualTime: string;
  participants: string;
  usedEquipment: string;
  resultPhotoUrl: string;
  cleanupConfirmed: boolean;
  damageFound: boolean;
  damageDescription: string;
  notes: string;
};

export type StudentProfileUpdate = {
  name: string;
  phone: string;
};

export type StudentPasswordChange = {
  currentPassword: string;
  newPassword: string;
};

export type StudentAccountDeletion = {
  currentPassword: string;
  confirmText: "계정 삭제";
};

export type StudentNativeNotifications = {
  supported: boolean;
  enabled: boolean;
  effective?: boolean;
  permission?: string;
  pendingCount?: number;
  syncedAt?: string;
  error?: string;
};

export type StudentState = {
  readonly view: StudentNavKey;
  readonly today?: string;
  readonly user: StudentUser;
  readonly bootstrap: StudentBootstrap;
  readonly myReservations: readonly StudentReservation[];
  readonly lectures: readonly StudentLecture[];
  readonly reservationType?: ReservationType;
  readonly reservationFlowStep: Readonly<Record<ReservationType, ReservationStep>>;
  readonly selectedDates: Readonly<Record<ReservationType, string>>;
  readonly selectedEquipmentPeriod?: string;
  readonly selectedEquipmentRentalTime?: string;
  readonly selectedEquipmentReturnTime?: string;
  readonly selectedEquipmentItemIds: readonly string[];
  readonly selectedStudioSpace?: string;
  readonly selectedStudioSlots: readonly string[];
  readonly selectedDarkroomSlots: readonly string[];
  readonly selectedDarkroomProcessTypes: readonly string[];
  readonly selectedDarkroomParticipantCount?: string;
  readonly selectedDarkroomChemicals: Readonly<Record<string, string>>;
  readonly selectedPrintStartTime?: string;
  readonly selectedPrintEndTime?: string;
  readonly selectedPrintTypes: readonly string[];
  readonly selectedPrintPapers: readonly string[];
  readonly selectedPrintSizes: readonly string[];
  readonly activeNoticeId?: string | null;
  readonly activeReportReservationId?: string | null;
  readonly nativeNotifications?: StudentNativeNotifications;
};

export type StudentActions = {
  setView(view: StudentNavKey): Promise<void> | void;
  startReservation(type: ReservationType): Promise<void> | void;
  setReservationStep(type: ReservationType, step: ReservationStep): Promise<void> | void;
  updateReservationSelection(patch: StudentReservationSelectionPatch): Promise<void> | void;
  submitReservation(draft: ReservationDraft): Promise<void> | void;
  cancelReservation(id: string): Promise<void> | void;
  openReport(id: string | null): Promise<void> | void;
  submitReport(id: string, payload: StudentReportPayload): Promise<void> | void;
  applyLecture(id: string): Promise<void> | void;
  cancelLecture(lectureId: string): Promise<void> | void;
  openNotice(id: string | null): Promise<void> | void;
  updateProfile(profile: StudentProfileUpdate): Promise<void> | void;
  changePassword(payload: StudentPasswordChange): Promise<void> | void;
  deleteAccount(payload: StudentAccountDeletion): Promise<void> | void;
  refresh(): Promise<void> | void;
  openAccount(): Promise<void> | void;
  logout(): Promise<void> | void;
  enableNotifications(): Promise<void> | void;
  syncNotifications(): Promise<void> | void;
  disableNotifications(): Promise<void> | void;
};
