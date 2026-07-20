export type AdminPageMeta = {
  total?: number;
  collectionTotal?: number;
  page?: number;
  pageSize?: number;
  hasMore?: boolean;
};

export type AdminSemesterOption = {
  key: string;
  label: string;
};

export type AdminUserRecord = {
  id: string;
  role?: string;
  name?: string;
  email?: string;
  studentId?: string;
  grade?: string;
  studentStatus?: string;
  phone?: string;
  approvalStatus?: string;
  blockDuration?: string;
  blockedUntil?: string;
  warningCount?: number;
  warningRecords?: Array<{
    id: string;
    reason?: string;
    count?: number;
    createdAt?: string;
  }>;
};

export type AdminReservationRecord = {
  id: string;
  type?: string;
  status?: string;
  title?: string;
  place?: string;
  room?: string;
  equipmentCode?: string;
  equipmentName?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  reason?: string;
  createdAt?: string;
  timing?: {
    startAt?: string;
    endAt?: string;
    reportDeadlineAt?: string;
  };
  queueAction?: "checkout" | "return";
  queueAt?: string;
  fields?: Record<string, unknown> & {
    reservedDate?: string;
    returnDate?: string;
    title?: string;
    studioSpace?: string;
    studioSpaces?: string[];
    startTime?: string;
    endTime?: string;
    rentalTime?: string;
    returnTime?: string;
    period?: string;
    purpose?: string;
    phone?: string;
    timeSlots?: string[];
    participants?: string | number;
    requiredEquipment?: string;
    processTypes?: string[];
    participantCount?: number;
    chemicals?: Array<{ name?: string; amount?: string }>;
    printType?: string;
    paper?: string;
    size?: string;
    count?: number;
    memo?: string;
    cameraBagConfirmationRequired?: boolean;
    cameraBagConfirmed?: boolean;
    pelicanBagReserved?: boolean;
    reportStatus?: string;
  };
  equipmentItems?: Array<{
    id?: string;
    code?: string;
    name?: string;
    category?: string;
  }>;
  user?: AdminUserRecord | null;
  student?: AdminUserRecord | null;
  equipment?: {
    id?: string;
    code?: string;
    name?: string;
    category?: string;
  } | null;
};

export type AdminEquipmentRecord = {
  id: string;
  code?: string;
  name?: string;
  category?: string;
  brand?: string;
  model?: string;
  source?: string;
  facility?: string;
  status?: string;
  notes?: string;
  active?: boolean;
  reservable?: boolean;
  inquiryOnly?: boolean;
};

export type AdminReportRecord = {
  id: string;
  reservationId?: string;
  title?: string;
  projectTitle?: string;
  status?: string;
  semester?: string;
  submittedAt?: string;
  createdAt?: string;
  fields?: Record<string, unknown> & {
    actualTime?: string;
    participants?: string | number;
    usedEquipment?: string | Array<string | { name?: string; code?: string; label?: string }>;
    resultPhotoUrl?: string;
    cleanupConfirmed?: boolean;
    damageFound?: boolean;
    damageDescription?: string;
    notes?: string;
  };
  user?: AdminUserRecord | null;
  reservation?: AdminReservationRecord | null;
};

export type AdminLectureApplication = {
  id?: string;
  userId?: string;
  userName?: string;
  studentId?: string;
  studentStatus?: string;
  phone?: string;
  email?: string;
  appliedAt?: string;
};

export type AdminLectureRecord = {
  id: string;
  title?: string;
  lecturer?: string;
  date?: string;
  lectureDate?: string;
  time?: string;
  instructorName?: string;
  instructorAffiliation?: string;
  professor?: string;
  targetGrades?: string;
  notes?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  capacity?: number;
  enrolledCount?: number;
  applicationCount?: number;
  semester?: string;
  status?: string;
  description?: string;
  applications?: AdminLectureApplication[];
};

export type AdminNoticeRecord = {
  id: string;
  title?: string;
  body?: string;
  category?: string;
  pinned?: boolean;
  active?: boolean;
  status?: "published" | "draft" | string;
  linkUrl?: string;
  link?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminSessionRecord = {
  id: string;
  userId?: string;
  ip?: string;
  device?: string;
  userAgent?: string;
  createdAt?: string;
  expiresAt?: string;
  user?: AdminUserRecord | null;
};

export type AdminLogRecord = {
  id?: string;
  action?: string;
  actor?: string | AdminUserRecord | null;
  targetId?: string;
  detail?: Record<string, unknown> | null;
  createdAt?: string;
};

export type AdminBlockedSchedule = {
  id?: string;
  type?: string;
  day?: string;
  from?: string;
  to?: string;
  start?: string;
  end?: string;
  target?: string;
  startDate?: string;
  endDate?: string;
  weekdays?: string[];
  reason?: string;
  active?: boolean;
};

export type AdminSettings = {
  [key: string]: unknown;
  semester?: string;
  blockedSchedules?: AdminBlockedSchedule[];
  equipmentCategories?: string[];
  printBankAccount?: string;
  googleDriveUrl?: string;
  darkroomCapacity?: number;
  printAvailableStart?: string;
  printAvailableEnd?: string;
  printUploadStartDate?: string;
  printUploadEndDate?: string;
  equipmentHighValueCategories?: string[];
  equipmentBagKeywords?: string[];
  equipmentCameraBagNotice?: string;
  studioReportDeadlineHours?: number;
  vacationMode?: boolean;
};

export type AdminSettingsInput = Pick<AdminSettings,
  | "printBankAccount"
  | "googleDriveUrl"
  | "darkroomCapacity"
  | "studioReportDeadlineHours"
  | "printAvailableStart"
  | "printAvailableEnd"
  | "printUploadStartDate"
  | "printUploadEndDate"
  | "equipmentHighValueCategories"
  | "equipmentBagKeywords"
  | "equipmentCameraBagNotice"
  | "vacationMode"
>;

export type AdminNativeNotificationState = {
  supported?: boolean;
  enabled?: boolean;
  effective?: boolean;
  permission?: string;
  pendingCount?: number;
  syncedAt?: string;
  error?: string;
};

export type AdminOperationsWarning = {
  kind?: "demand_increase" | "shortage" | "overdue_return" | string;
  reservationId?: string;
  equipmentId?: string;
  equipmentName?: string;
  code?: string;
  name?: string;
  category?: string;
  utilizationPercent?: number;
  recentRequests?: number;
  baselineRequests?: number;
  dueAt?: string;
};

export type AdminOperationsInsights = {
  period?: { from?: string; to?: string; days?: number };
  congestion?: {
    items?: Array<{ type?: string; time?: string; label?: string; count?: number; sharePercent?: number }>;
    insufficientData?: boolean;
  };
  equipmentUtilization?: Array<{ equipmentId?: string; code?: string; name?: string; category?: string; reservedDays?: number; utilizationPercent?: number }>;
  cancellationRate?: { totalRequests?: number; cancelledRequests?: number; percent?: number };
  warnings?: AdminOperationsWarning[];
};

export type AdminDashboardMetrics = {
  weekReservations?: number;
  activeEquipment?: number;
  availableEquipment?: number;
  repairEquipment?: number;
  equipmentAvailableRate?: number;
  cancelledReservations?: number;
  reportQueueCount?: number;
  openLectures?: number;
  typeCounts?: Record<string, number>;
  popularEquipment?: Array<{ name: string; count: number }>;
  latestNotice?: AdminNoticeRecord | null;
  insights?: AdminOperationsInsights;
};

export type AdminDashboardSummary = Record<string, unknown> & {
  pendingUsers?: number;
  pendingEquipment?: number;
  equipmentPendingApproval?: number;
  equipmentApproved?: number;
  equipmentCheckedOut?: number;
  equipmentReturned?: number;
  equipmentCancelled?: number;
  todayReservations?: number;
  missingReports?: number;
  todaySchedule?: AdminReservationRecord[];
  checkoutReturnQueue?: AdminReservationRecord[];
  metrics?: AdminDashboardMetrics;
};

export type AdminCourseRecord = {
  id: string;
  courseCode?: string;
  name: string;
  majorType?: string;
  targetYears?: number[];
  allowedTerms?: string[];
  studentCredit?: number;
  operatingCredit?: number;
  facultyRecognizedCredit?: number;
  countsTowardCurriculum130?: boolean;
  isMajorRequired?: boolean;
  requiredFrequencyYears?: number;
  deliveryPeriod?: string;
  isSurveyEligible?: boolean;
  active?: boolean;
};

export type AdminCourseOffering = {
  courseId: string;
  source?: string;
  overrideReason?: string;
};

export type AdminCourseSemesterPlan = {
  id: string;
  term: "spring" | "fall" | "vacation" | string;
  targetYears?: number[];
  optionalCreditTarget?: number | null;
  offerings: AdminCourseOffering[];
  deferred?: Array<{ courseId: string; source?: string; reason?: string }>;
};

export type AdminCoursePlanValidation = {
  valid?: boolean;
  errors?: Array<{ code?: string; courseId?: string; message?: string }>;
  warnings?: Array<{ code?: string; courseId?: string; message?: string; value?: number }>;
  metrics?: {
    operatingCredit?: number;
    operatingCreditLimit?: number;
    remainingOperatingCredit?: number;
    facultyRecognizedCredit?: number;
    curriculumCredit?: number;
  };
};

export type AdminAnnualOfferingPlan = {
  id: string;
  academicYear: number;
  operatingCreditLimit?: number;
  status?: "draft" | "confirmed" | string;
  semesterPlans: AdminCourseSemesterPlan[];
  validation?: AdminCoursePlanValidation;
};

export type AdminCourseDemandSurveySummary = {
  eligibleStudentCount?: number;
  responseCount?: number;
  responseRate?: number;
  courses?: Array<{ courseId: string; courseName?: string; selections?: number; demandScore?: number; rankCounts?: Record<number, number> }>;
};

export type AdminCourseDemandSurvey = {
  id: string;
  semesterPlanId: string;
  eligibleCurrentYears?: number[];
  targetStudentYears?: number[];
  opensAt?: string;
  closesAt?: string;
  status?: "draft" | "open" | "closed" | string;
  catalogCount?: number;
  summary?: AdminCourseDemandSurveySummary;
};

export type AdminCoursePlanningData = {
  curriculumVersions: Array<{ id: string; academicYear: number; curriculumCreditLimit: number; status?: string }>;
  courses: AdminCourseRecord[];
  annualPlans: AdminAnnualOfferingPlan[];
  surveys: AdminCourseDemandSurvey[];
};

export type AdminView =
  | "dashboard"
  | "users"
  | "reservations"
  | "equipment"
  | "reports"
  | "lectures"
  | "notices"
  | "logs"
  | "course-demand"
  | "settings"
  | "account";

export type AdminSortDirection = "asc" | "desc";

export type AdminViewFilterMap = {
  dashboard: Record<string, never>;
  users: {
    q: string;
    status: string;
    page: number;
    pageSize: number;
    role: string;
    sort: "name" | "studentId" | "studentStatus" | "approvalStatus" | "createdAt";
    direction: AdminSortDirection;
  };
  reservations: {
    q: string;
    type: string;
    status: string;
    semester: string;
    page: number;
    pageSize: number;
    sort: "createdAt" | "reservedDate" | "status" | "type" | "name" | "title";
    direction: AdminSortDirection;
  };
  equipment: {
    q: string;
    source: string;
    category: string;
    panel: string;
  };
  reports: {
    q: string;
    semester: string;
    page: number;
    pageSize: number;
    sort: "submittedAt" | "createdAt" | "name" | "title" | "status" | "semester";
    direction: AdminSortDirection;
  };
  lectures: {
    q: string;
    semester: string;
    page: number;
    pageSize: number;
    panel: string;
    sort: "lectureDate" | "createdAt" | "title" | "instructorName" | "status" | "applicationCount";
    direction: AdminSortDirection;
  };
  notices: {
    q: string;
    page: number;
    pageSize: number;
    sort: "createdAt" | "updatedAt" | "title" | "category" | "status" | "pinned";
    direction: AdminSortDirection;
  };
  logs: {
    sessionQuery: string;
    sessionSort: "createdAt" | "expiresAt" | "user";
    logQuery: string;
    logAction: string;
    logDirection: AdminSortDirection;
  };
  "course-demand": Record<string, never>;
  settings: {
    blockedQuery: string;
  };
  account: Record<string, never>;
};

export type AdminEquipmentStatus = "가능" | "수리중" | "파손" | "문의";

export type AdminEquipmentInput = {
  codePrefix?: string;
  name: string;
  category: string;
  brand?: string;
  model?: string;
  source?: string;
  status?: AdminEquipmentStatus;
  quantity?: number;
  notes?: string;
  reservable?: boolean;
  inquiryOnly?: boolean;
};

export type AdminLectureInput = {
  title: string;
  lectureDate: string;
  time: string;
  location: string;
  instructorName: string;
  instructorAffiliation?: string;
  professor?: string;
  targetGrades?: string;
  capacity?: number;
  description: string;
  status?: string;
  notes?: string;
};

export type AdminNoticeInput = {
  title: string;
  body: string;
  category?: string;
  link?: string;
  pinned?: boolean;
  active?: boolean;
};

export type AdminAccountInput = {
  name: string;
  email: string;
  phone?: string;
};

export type AdminToastState = {
  message?: string;
  type?: "success" | "error" | "info";
};

export type LegacyState = Record<string, unknown> & {
  token?: string;
  adminView?: string;
  adminRefresh?: { refreshing?: boolean };
  user?: { role?: string; name?: string; email?: string; studentId?: string; phone?: string };
  bootstrap?: { settings?: AdminSettings } | null;
  summary?: AdminDashboardSummary | null;
  toast?: AdminToastState | string | null;
  toastTone?: "status" | "error";
  toastAnnouncementSequence?: number;
  adminUserSearch?: string;
  adminUserStatusFilter?: string;
  adminUserSort?: { field?: string; direction?: AdminSortDirection };
  adminUsers?: AdminUserRecord[];
  adminUsersPage?: AdminPageMeta;
  adminReservations?: AdminReservationRecord[];
  adminReservationSearch?: string;
  adminReservationTab?: string;
  adminEquipmentReservationStatusFilter?: string;
  adminReservationSemesterFilter?: string;
  adminReservationSort?: { field?: string; direction?: AdminSortDirection };
  adminReservationsPage?: AdminPageMeta;
  adminReservationSemesters?: AdminSemesterOption[];
  adminEquipment?: AdminEquipmentRecord[];
  adminEquipmentSearch?: string;
  adminEquipmentTab?: string;
  adminEquipmentCategoryTab?: string;
  adminEquipmentPanelTab?: string;
  adminSelectedEquipmentIds?: string[];
  selectedAdminEquipmentIds?: string[];
  adminReports?: AdminReportRecord[];
  adminReportSearch?: string;
  adminReportSemesterFilter?: string;
  adminReportSort?: { field?: string; direction?: AdminSortDirection };
  adminReportsPage?: AdminPageMeta;
  adminReportSemesters?: AdminSemesterOption[];
  adminLectures?: AdminLectureRecord[];
  adminLectureSearch?: string;
  adminLectureSemesterFilter?: string;
  adminLecturePanelTab?: string;
  adminLectureSort?: { field?: string; direction?: AdminSortDirection };
  lectures?: AdminLectureRecord[];
  adminLecturesPage?: AdminPageMeta;
  adminLectureSemesters?: AdminSemesterOption[];
  adminNotices?: AdminNoticeRecord[];
  adminNoticesPage?: AdminPageMeta;
  adminNoticeSearch?: string;
  adminNoticeSort?: { field?: string; direction?: AdminSortDirection };
  adminSessions?: AdminSessionRecord[];
  adminLogs?: AdminLogRecord[];
  adminSessionSearch?: string;
  adminSessionSort?: string;
  adminLogSearch?: string;
  adminLogActionFilter?: string;
  adminLogSort?: string;
  adminBlockedScheduleSearch?: string;
  nativeNotifications?: AdminNativeNotificationState;
  adminCoursePlanning?: AdminCoursePlanningData | null;
};

export type ReactAdminActions = {
  setAdminView<View extends AdminView>(view: View, filters?: Partial<AdminViewFilterMap[View]>): Promise<void> | void;
  refreshAdminData(): Promise<void>;
  setAdminFilters<View extends AdminView>(
    view: View,
    filters: Partial<AdminViewFilterMap[View]>
  ): Promise<void> | void;
  notify(message: string, tone?: "status" | "error"): void;
  setEquipmentSelection(ids: string[]): void;
  setUserApproval(userId: string, status: string, limitDuration?: string): Promise<void>;
  resetUserPassword(userId: string): Promise<void>;
  warnUser(userId: string): Promise<void>;
  resetUserWarnings(userId: string): Promise<void>;
  deleteUser(userId: string, name?: string): Promise<void>;
  updateReservationStatus(reservationId: string, status: string): Promise<void>;
  deleteReservation(reservationId: string, label?: string): Promise<void>;
  bulkDeleteReservations(filters: Partial<AdminViewFilterMap["reservations"]>): Promise<void>;
  deleteAllReservations(collectionTotal: number): Promise<void>;
  updateEquipmentStatus(ids: string[], status: AdminEquipmentStatus): Promise<void>;
  createEquipment(input: AdminEquipmentInput): Promise<void>;
  importEquipment(rows: Array<Record<string, unknown>>): Promise<void>;
  deleteEquipment(ids: string[]): Promise<void>;
  saveEquipmentCategories(categories: string[]): Promise<void>;
  saveCoursePlanningCourses(courses: AdminCourseRecord[]): Promise<void>;
  saveAnnualOfferingPlan(plan: AdminAnnualOfferingPlan): Promise<AdminAnnualOfferingPlan>;
  createCourseDemandSurvey(input: {
    semesterPlanId: string;
    eligibleCurrentYears: number[];
    targetStudentYears?: number[];
    opensAt: string;
    closesAt: string;
    status: "draft" | "open" | "closed";
  }): Promise<void>;
  updateCourseDemandSurvey(surveyId: string, input: { status?: "draft" | "open" | "closed"; closesAt?: string }): Promise<void>;
  loadCourseDemandRecommendation(planId: string): Promise<AdminAnnualOfferingPlan>;
  bulkDeleteReports(filters: Partial<AdminViewFilterMap["reports"]>): Promise<void>;
  deleteAllReports(collectionTotal: number): Promise<void>;
  saveLecture(lectureId: string | null, input: AdminLectureInput): Promise<void>;
  deleteLecture(lectureId: string, title?: string): Promise<void>;
  bulkDeleteLectures(filters: Partial<AdminViewFilterMap["lectures"]>): Promise<void>;
  deleteAllLectures(collectionTotal: number): Promise<void>;
  downloadLectureCsv(): Promise<void>;
  createNotice(input: AdminNoticeInput): Promise<void>;
  deleteNotice(noticeId: string, title?: string): Promise<void>;
  bulkDeleteNotices(filters: Partial<AdminViewFilterMap["notices"]>): Promise<void>;
  deleteAllNotices(collectionTotal: number): Promise<void>;
  saveSettings(settings: AdminSettingsInput): Promise<void>;
  saveBlockedSchedules(schedules: AdminBlockedSchedule[]): Promise<void>;
  cleanupAdminData(): Promise<void>;
  closeSemester(): Promise<void>;
  updateAccount(input: AdminAccountInput): Promise<void>;
  changeAccountPassword(currentPassword: string, newPassword: string): Promise<void>;
  revokeSession(sessionId: string): Promise<void>;
  downloadAdminBackup(): Promise<void>;
  enableNativeNotifications(): Promise<void>;
  disableNativeNotifications(): Promise<void>;
  syncNativeNotifications(): Promise<void>;
  logout(): Promise<void> | void;
  render(): void;
};

export type ReactAdminMountOptions = {
  root: HTMLElement;
  state: LegacyState;
  actions: ReactAdminActions;
};

declare global {
  interface Window {
    GJU_REACT_ADMIN_ENABLED?: boolean;
    GJU_API_BASE?: string;
    GJUReactAdmin?: {
      mount(options: ReactAdminMountOptions): void;
      update?(options: ReactAdminMountOptions): void;
      unmount(): void;
    };
  }
}
