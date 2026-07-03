import { state } from "./state.js?v=20260703-equipment-inquiry-status";
import { api } from "./api.js?v=20260703-equipment-inquiry-status";
import { loadAdminData, loadBootstrap, loadLectures, loadMyReservations } from "./data.js?v=20260703-equipment-inquiry-status";
import { disableNativeReservationNotifications, notifyNativeReservationCreated } from "./native-notifications.js?v=20260703-equipment-inquiry-status";
import { render, toast } from "./renderer.js?v=20260703-equipment-inquiry-status";
import {
  areSlotsConsecutive,
  csvEscape,
  darkroomSlotBlocked,
  darkroomSlotRemaining,
  equipmentIsCameraBag,
  equipmentIsHighValue,
  equipmentRangeBlocked,
  equipmentItemReservedInRange,
  formData,
  formatDateTime,
  getChecked,
  isPastDate,
  isReservationDateClosed,
  minutesToTime,
  printDateOutsideUploadWindow,
  printUploadWindowLabel,
  printSelectionBlocked,
  printSelectionConflicts,
  reservationDateUnavailable,
  reservationDateUnavailableMessage,
  reservationClosedMessage,
  studioSlotBlocked,
  studioSelectionConflicts,
  todayKey
} from "./utils.js?v=20260703-equipment-inquiry-status";

export async function login(form) {
  const data = formData(form);
  const result = await api("/api/auth/login", { method: "POST", body: data });
  const rememberLogin = data.rememberLogin === "true";
  state.token = result.token;
  state.user = result.user;
  state.view = "home";
  state.reservationType = "";
  state.warningPopupDismissed = false;
  if (rememberLogin) {
    localStorage.setItem("gju_token", state.token);
    sessionStorage.removeItem("gju_token");
  } else {
    sessionStorage.setItem("gju_token", state.token);
    localStorage.removeItem("gju_token");
  }
  await loadBootstrap();
  if (state.user.role === "admin") await loadAdminData();
  if (state.user.role === "student") {
    await loadMyReservations();
    await loadLectures();
  }
  toast("로그인되었습니다.");
}

export async function signup(form) {
  const data = formData(form);
  await api("/api/auth/signup", { method: "POST", body: data });
  state.authMode = "login";
  toast("가입 신청이 접수되었습니다. 학과 관리자 승인 후 예약할 수 있습니다.");
}

export async function logout() {
  await disableNativeReservationNotifications().catch(() => null);
  await api("/api/auth/logout", { method: "POST", body: { token: state.token } }).catch(() => null);
  state.token = "";
  state.user = null;
  state.myReservations = [];
  state.lectures = [];
  state.view = "home";
  state.reservationType = "";
  state.activeNoticeId = "";
  state.activeReportReservationId = "";
  state.selectedDates = { equipment: "", studio: "", darkroom: "", print: "" };
  state.selectedEquipmentItemIds = [];
  state.selectedEquipmentPeriod = "";
  state.selectedEquipmentRentalTime = "";
  state.selectedEquipmentReturnTime = "";
  state.equipmentSelectionSheetOpen = false;
  state.equipmentRecommendationOpen = false;
  state.selectedStudioSpace = "";
  state.selectedStudioSlots = [];
  localStorage.removeItem("gju_token");
  sessionStorage.removeItem("gju_token");
  render();
}

export function downloadLectureCsv() {
  const headers = ["특강명", "특강일", "시간", "장소", "강사명", "강사 소속", "담당교수", "대상 학년", "모집인원", "신청인원", "진행상태", "신청자", "학번", "신분", "연락처", "신청일", "비고"];
  const rows = state.adminLectures.flatMap((lecture) => {
    const applications = lecture.applications || [];
    const base = [
      lecture.title,
      lecture.lectureDate,
      lecture.time,
      lecture.location,
      lecture.instructorName,
      lecture.instructorAffiliation,
      lecture.professor,
      lecture.targetGrades,
      lecture.capacity,
      lecture.applicationCount,
      lecture.status
    ];
    if (!applications.length) {
      return [[...base, "", "", "", "", "", lecture.notes || ""]];
    }
    return applications.map((app) => [
      ...base,
      app.userName,
      app.studentId,
      app.studentStatus,
      app.phone,
      formatDateTime(app.appliedAt),
      lecture.notes || ""
    ]);
  });
  const csv = "\uFEFF" + [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `gju-lectures-${todayKey()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function downloadAdminBackup() {
  const data = await api("/api/admin/export");
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `gju-reserve-backup-${todayKey()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function submitReservation(form) {
  const type = form.dataset.type;
  const data = formData(form);
  let fields = { ...data };
  if (!fields.reservedDate) {
    throw new Error("캘린더에서 예약 날짜를 선택하세요.");
  }
  if (isPastDate(fields.reservedDate)) {
    throw new Error("오늘 이전 날짜는 예약할 수 없습니다. 기록 확인만 가능합니다.");
  }
  if (isReservationDateClosed(type, fields.reservedDate)) {
    throw new Error(reservationClosedMessage(type));
  }
  if (reservationDateUnavailable(type, fields.reservedDate)) {
    throw new Error(reservationDateUnavailableMessage(type));
  }
  if (type === "equipment") {
    const visibleChecked = getChecked("equipmentItemIds");
    state.selectedEquipmentItemIds = [...new Set([...state.selectedEquipmentItemIds, ...visibleChecked])];
    state.selectedEquipmentPeriod = fields.period || state.selectedEquipmentPeriod;
    state.selectedEquipmentRentalTime = fields.rentalTime || state.selectedEquipmentRentalTime;
    state.selectedEquipmentReturnTime = fields.returnTime || state.selectedEquipmentReturnTime;
    fields.equipmentItemIds = state.selectedEquipmentItemIds;
    if (!fields.equipmentItemIds.length) throw new Error("기자재를 1개 이상 선택하세요.");
    const selectedItems = fields.equipmentItemIds
      .map((itemId) => state.bootstrap.equipment.find((candidate) => candidate.id === itemId))
      .filter(Boolean);
    const invalidStatusItems = fields.equipmentItemIds.filter((itemId) => {
      const item = state.bootstrap.equipment.find((candidate) => candidate.id === itemId);
      return !item || item.active === false || !item.reservable || item.status !== "가능";
    });
    if (invalidStatusItems.length) throw new Error("수리중 또는 파손 상태의 기자재가 포함되어 있습니다.");
    if (equipmentRangeBlocked(fields.reservedDate, fields.period).length) throw new Error("선택한 대여 기간에 기자재 차단 일정이 포함되어 있습니다.");
    const unavailableItems = fields.equipmentItemIds.filter((itemId) => equipmentItemReservedInRange(itemId, fields.reservedDate, fields.period));
    if (unavailableItems.length) throw new Error("선택한 대여 기간에 이미 예약된 기자재가 포함되어 있습니다.");
    const hasHighValue = selectedItems.some(equipmentIsHighValue);
    const hasCameraBag = selectedItems.some(equipmentIsCameraBag);
    fields.pelicanBagReserved = hasHighValue && hasCameraBag;
    fields.cameraBagConfirmationRequired = hasHighValue;
    fields.cameraBagConfirmed = hasHighValue ? (hasCameraBag || fields.cameraBagConfirmed === "true") : false;
    if (hasHighValue && !fields.cameraBagConfirmed) {
      throw new Error(state.bootstrap.settings.equipmentCameraBagNotice || "고가장비(카메라)를 선택 시 카메라 가방을 지참하겠습니다");
    }
  }
  if (type === "studio") {
    const selectedSlots = getChecked("studioSlots");
    state.selectedStudioSlots = [...new Set([...state.selectedStudioSlots, ...selectedSlots])];
    fields.timeSlots = state.selectedStudioSlots;
    fields.studioSpace = data.studioSpace || state.selectedStudioSpace;
    fields.studioSpaces = fields.studioSpace ? [fields.studioSpace] : [];
    fields.reportStatus = "required";
    if (!fields.timeSlots.length) throw new Error("스튜디오 사용 시간을 선택하세요.");
    if (fields.studioSpaces.length !== 1) throw new Error("스튜디오 사용 공간을 1개 선택하세요.");
    if (fields.timeSlots.length > state.bootstrap.settings.studioMaxSlots) {
      throw new Error(`스튜디오는 최대 ${state.bootstrap.settings.studioMaxSlots}타임까지 예약할 수 있습니다.`);
    }
    if (!areSlotsConsecutive(fields.timeSlots, state.bootstrap.settings.studioSlots)) {
      throw new Error("스튜디오는 연속된 시간만 예약할 수 있습니다.");
    }
    const blockedPairs = fields.studioSpaces.flatMap((space) => fields.timeSlots
      .filter((slot) => studioSlotBlocked(fields.reservedDate, space, slot))
      .map((slot) => `${space} / ${slot}`));
    if (blockedPairs.length) throw new Error(`차단된 스튜디오 시간입니다: ${blockedPairs.slice(0, 3).join(", ")}`);
    const conflicts = studioSelectionConflicts(fields.reservedDate, fields.studioSpaces, fields.timeSlots);
    if (conflicts.length) throw new Error(`이미 예약된 스튜디오 조합입니다: ${conflicts.slice(0, 3).join(", ")}`);
  }
  if (type === "darkroom") {
    const selectedSlots = getChecked("darkroomSlots");
    const selectedProcessTypes = getChecked("processTypes");
    state.selectedDarkroomSlots = [...new Set([...state.selectedDarkroomSlots, ...selectedSlots])];
    state.selectedDarkroomProcessTypes = [...new Set([...state.selectedDarkroomProcessTypes, ...selectedProcessTypes])];
    fields.timeSlots = state.selectedDarkroomSlots;
    fields.processTypes = state.selectedDarkroomProcessTypes;
    fields.chemicals = state.bootstrap.darkroomChemicals.map((chem) => ({
      id: chem.id,
      name: chem.name,
      amount: data[`chem-${chem.id}`] || state.selectedDarkroomChemicals?.[chem.id] || ""
    })).filter((item) => item.amount);
    if (!fields.timeSlots.length) throw new Error("암실 사용 시간을 선택하세요.");
    if (!fields.processTypes.length) throw new Error("암실 작업 유형을 선택하세요.");
    const participantCount = Math.max(1, Number(fields.participantCount || 1));
    const blockedSlots = fields.timeSlots.filter((slot) => darkroomSlotBlocked(fields.reservedDate, slot));
    if (blockedSlots.length) throw new Error(`암실 사용 불가 시간입니다: ${blockedSlots.join(", ")}`);
    const fullSlots = fields.timeSlots.filter((slot) => darkroomSlotRemaining(fields.reservedDate, slot) < participantCount);
    if (fullSlots.length) throw new Error(`암실 정원을 초과하는 시간입니다: ${fullSlots.join(", ")}`);
  }
  if (type === "print") {
    if (printDateOutsideUploadWindow(fields.reservedDate)) {
      throw new Error(`출력 업로드 가능 기간(${printUploadWindowLabel()}) 밖의 날짜입니다.`);
    }
    fields.startTime = fields.startTime || state.selectedPrintStartTime;
    fields.endTime = fields.endTime || state.selectedPrintEndTime;
    state.selectedPrintTypes = [...new Set([...state.selectedPrintTypes, ...getChecked("printTypes")])];
    state.selectedPrintPapers = [...new Set([...state.selectedPrintPapers, ...getChecked("papers")])];
    state.selectedPrintSizes = [...new Set([...state.selectedPrintSizes, ...getChecked("sizes")])];
    fields.printTypes = state.selectedPrintTypes;
    fields.papers = state.selectedPrintPapers;
    fields.sizes = state.selectedPrintSizes;
    fields.printType = fields.printTypes.join(", ");
    fields.paper = fields.papers.join(", ");
    fields.size = fields.sizes.join(", ");
    if (!fields.startTime || !fields.endTime) throw new Error("출력실 사용 시간을 선택하세요.");
    if (!fields.printTypes.length) throw new Error("출력 종류를 선택하세요.");
    if (!fields.papers.length) throw new Error("용지를 선택하세요.");
    if (!fields.sizes.length) throw new Error("사이즈를 선택하세요.");
    const blockedPrintSlots = printSelectionBlocked(fields.reservedDate, fields.startTime, fields.endTime);
    if (blockedPrintSlots.length) throw new Error("선택한 출력실 시간이 차단 일정과 겹칩니다.");
    const printConflicts = printSelectionConflicts(fields.reservedDate, fields.startTime, fields.endTime);
    if (printConflicts.length) {
      const labels = printConflicts.map((bucket) => `${minutesToTime(bucket.start)}-${minutesToTime(bucket.end)}`).join(", ");
      throw new Error(`출력실 ${labels} 시간대는 예약 가능 인원이 가득 찼습니다.`);
    }
  }
  toast("예약을 처리 중입니다.");
  const reservation = await api("/api/reservations", { method: "POST", body: { type, fields } });
  notifyNativeReservationCreated(reservation).catch(() => null);
  state.reservationType = "";
  if (type === "equipment") {
    state.selectedEquipmentItemIds = [];
    state.equipmentSelectionSheetOpen = false;
    state.equipmentRecommendationOpen = false;
  }
  if (type === "studio") {
    state.selectedStudioSpace = "";
    state.selectedStudioSlots = [];
  }
  if (type === "darkroom") {
    state.selectedDarkroomSlots = [];
    state.selectedDarkroomProcessTypes = [];
    state.selectedDarkroomParticipantCount = "1";
    state.selectedDarkroomChemicals = {};
  }
  if (type === "print") {
    state.selectedPrintStartTime = "";
    state.selectedPrintEndTime = "";
    state.selectedPrintTypes = [];
    state.selectedPrintPapers = [];
    state.selectedPrintSizes = [];
  }
  state.view = "mine";
  state.myReservations = [
    reservation,
    ...state.myReservations.filter((item) => item.id !== reservation.id)
  ];
  if (state.bootstrap?.reservations) {
    state.bootstrap.reservations = [
      reservation,
      ...state.bootstrap.reservations.filter((item) => item.id !== reservation.id)
    ];
  }
  toast(type === "equipment" ? "기자재 예약 승인 요청이 접수되었습니다." : "예약이 확정되었습니다.");
  Promise.all([loadBootstrap(), loadMyReservations()])
    .then(() => render())
    .catch((error) => toast(`예약은 처리됐지만 최신 목록을 다시 불러오지 못했습니다: ${error.message}`));
}

export async function openReport(reservationId) {
  state.view = "reports";
  state.activeReportReservationId = reservationId;
  render();
}

export async function changePassword(form) {
  const data = formData(form);
  if (data.newPassword !== data.confirmPassword) {
    throw new Error("새 비밀번호 확인이 일치하지 않습니다.");
  }
  await api("/api/me/password", {
    method: "PATCH",
    body: {
      currentPassword: data.currentPassword,
      newPassword: data.newPassword
    }
  });
  form.reset();
  state.token = "";
  state.user = null;
  state.myReservations = [];
  state.lectures = [];
  state.adminSessions = [];
  state.adminLogs = [];
  state.view = "home";
  state.adminView = "dashboard";
  localStorage.removeItem("gju_token");
  sessionStorage.removeItem("gju_token");
  toast("비밀번호가 변경되었습니다. 모든 기기에서 로그아웃되었습니다.");
}

export async function deleteAccount(form) {
  const data = formData(form);
  if (String(data.confirmText || "").trim() !== "계정 삭제") {
    throw new Error("확인 문구에 '계정 삭제'를 입력하세요.");
  }
  if (!confirm("계정을 영구 삭제할까요?\n예약·보고서·특강 신청 기록도 함께 삭제되며 되돌릴 수 없습니다.")) return;
  await disableNativeReservationNotifications().catch(() => null);
  const result = await api("/api/me", {
    method: "DELETE",
    body: {
      currentPassword: data.currentPassword,
      confirmText: data.confirmText
    }
  });
  state.token = "";
  state.user = null;
  state.myReservations = [];
  state.lectures = [];
  state.adminSessions = [];
  state.adminLogs = [];
  state.view = "home";
  state.authMode = "login";
  state.reservationType = "";
  state.activeNoticeId = "";
  state.activeReportReservationId = "";
  localStorage.removeItem("gju_token");
  sessionStorage.removeItem("gju_token");
  render();
  toast(`계정이 삭제되었습니다.${result.removedReservations ? ` 예약 ${result.removedReservations}건도 함께 삭제했습니다.` : ""}`);
}
