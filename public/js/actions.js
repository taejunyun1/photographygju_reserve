import { state } from "./state.js?v=20260614-myrecent1";
import { api } from "./api.js?v=20260614-myrecent1";
import { loadAdminData, loadBootstrap, loadLectures, loadMyReservations } from "./data.js?v=20260614-myrecent1";
import { render, toast } from "./renderer.js?v=20260614-myrecent1";
import {
  areSlotsConsecutive,
  csvEscape,
  darkroomSlotBlocked,
  darkroomSlotRemaining,
  equipmentRangeBlocked,
  equipmentItemReservedInRange,
  formData,
  formatDateTime,
  getChecked,
  isPastDate,
  minutesToTime,
  printSelectionBlocked,
  printSelectionConflicts,
  studioSlotBlocked,
  studioSelectionConflicts,
  todayKey
} from "./utils.js?v=20260614-myrecent1";

export async function login(form) {
  const data = formData(form);
  const result = await api("/api/auth/login", { method: "POST", body: data });
  const rememberLogin = data.rememberLogin === "true";
  state.token = result.token;
  state.user = result.user;
  state.view = "home";
  state.reservationType = "";
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
  if (type === "equipment") {
    const visibleChecked = getChecked("equipmentItemIds");
    state.selectedEquipmentItemIds = [...new Set([...state.selectedEquipmentItemIds, ...visibleChecked])];
    state.selectedEquipmentPeriod = fields.period || state.selectedEquipmentPeriod;
    state.selectedEquipmentRentalTime = fields.rentalTime || state.selectedEquipmentRentalTime;
    state.selectedEquipmentReturnTime = fields.returnTime || state.selectedEquipmentReturnTime;
    fields.equipmentItemIds = state.selectedEquipmentItemIds;
    if (!fields.equipmentItemIds.length) throw new Error("기자재를 1개 이상 선택하세요.");
    const invalidStatusItems = fields.equipmentItemIds.filter((itemId) => {
      const item = state.bootstrap.equipment.find((candidate) => candidate.id === itemId);
      return !item || item.active === false || !item.reservable || item.status !== "가능";
    });
    if (invalidStatusItems.length) throw new Error("수리중 또는 파손 상태의 기자재가 포함되어 있습니다.");
    if (equipmentRangeBlocked(fields.reservedDate, fields.period).length) throw new Error("선택한 대여 기간에 기자재 차단 일정이 포함되어 있습니다.");
    const unavailableItems = fields.equipmentItemIds.filter((itemId) => equipmentItemReservedInRange(itemId, fields.reservedDate, fields.period));
    if (unavailableItems.length) throw new Error("선택한 대여 기간에 이미 예약된 기자재가 포함되어 있습니다.");
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
    fields.timeSlots = getChecked("darkroomSlots");
    fields.processTypes = getChecked("processTypes");
    fields.chemicals = state.bootstrap.darkroomChemicals.map((chem) => ({
      id: chem.id,
      name: chem.name,
      amount: data[`chem-${chem.id}`]
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
    fields.printTypes = getChecked("printTypes");
    fields.papers = getChecked("papers");
    fields.sizes = getChecked("sizes");
    fields.printType = fields.printTypes.join(", ");
    fields.paper = fields.papers.join(", ");
    fields.size = fields.sizes.join(", ");
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
  state.reservationType = "";
  if (type === "equipment") state.selectedEquipmentItemIds = [];
  if (type === "studio") {
    state.selectedStudioSpace = "";
    state.selectedStudioSlots = [];
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
