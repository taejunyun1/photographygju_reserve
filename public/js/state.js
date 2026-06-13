export const $app = document.querySelector("#app");

export const state = {
  token: localStorage.getItem("gju_token") || "",
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
  selectedEquipmentItemIds: [],
  selectedStudioSpace: "",
  selectedStudioSlots: [],
  equipmentCategoryFilter: "Body",
  adminView: "dashboard",
  adminReservationTab: "equipment",
  adminEquipmentTab: "department",
  adminEquipmentCategoryTab: "all",
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
  lectures: [],
  adminLectures: [],
  summary: null,
  toast: ""
};
