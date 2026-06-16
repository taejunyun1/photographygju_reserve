export const $app = document.querySelector("#app");

const storedToken = localStorage.getItem("gju_token") || sessionStorage.getItem("gju_token") || "";

export const state = {
  token: storedToken,
  user: null,
  bootstrap: null,
  view: "home",
  authMode: "login",
  reservationType: "",
  calendarMonth: "",
  selectedDates: {
    equipment: "",
    studio: "",
    darkroom: "",
    print: ""
  },
  activeNoticeId: "",
  activeReportReservationId: "",
  pastReservationsOpen: false,
  selectedEquipmentItemIds: [],
  selectedEquipmentPeriod: "",
  selectedEquipmentRentalTime: "",
  selectedEquipmentReturnTime: "",
  selectedStudioSpace: "",
  selectedStudioSlots: [],
  equipmentCategoryFilter: "Body",
  adminView: "dashboard",
  adminReservationTab: "equipment",
  adminReservationSearch: "",
  warningPopupDismissed: false,
  adminEquipmentTab: "department",
  adminEquipmentCategoryTab: "all",
  selectedAdminEquipmentIds: [],
  adminUserSort: {
    field: "approvalStatus",
    direction: "asc"
  },
  csvPreviewRows: [],
  myReservations: [],
  adminUsers: [],
  adminReservations: [],
  adminEquipment: [],
  adminReports: [],
  adminNotices: [],
  adminSessions: [],
  adminLogs: [],
  lectures: [],
  adminLectures: [],
  summary: null,
  loadingCount: 0,
  toast: ""
};
