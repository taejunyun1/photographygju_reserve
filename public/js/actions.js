import { state } from "./state.js?v=20260613-mod3";
import { api } from "./api.js?v=20260613-mod3";
import { loadAdminData, loadBootstrap, loadLectures, loadMyReservations } from "./data.js?v=20260613-mod3";
import { render, toast } from "./renderer.js?v=20260613-mod3";
import {
  areSlotsConsecutive,
  csvEscape,
  formData,
  formatDateTime,
  getChecked,
  todayKey
} from "./utils.js?v=20260613-mod3";

export async function login(form) {
  const data = formData(form);
  const result = await api("/api/auth/login", { method: "POST", body: data });
  state.token = result.token;
  state.user = result.user;
  localStorage.setItem("gju_token", state.token);
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
  state.activeNoticeId = "";
  localStorage.removeItem("gju_token");
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

export async function submitReservation(form) {
  const type = form.dataset.type;
  const data = formData(form);
  let fields = { ...data };
  if (!fields.reservedDate) {
    throw new Error("캘린더에서 예약 날짜를 선택하세요.");
  }
  if (type === "equipment") {
    const visibleChecked = getChecked("equipmentItemIds");
    state.selectedEquipmentItemIds = [...new Set([...state.selectedEquipmentItemIds, ...visibleChecked])];
    fields.equipmentItemIds = state.selectedEquipmentItemIds;
    if (!fields.equipmentItemIds.length) throw new Error("기자재를 1개 이상 선택하세요.");
  }
  if (type === "studio") {
    fields.timeSlots = getChecked("studioSlots");
    fields.studioSpaces = getChecked("studioSpaces");
    fields.studioSpace = fields.studioSpaces.join(", ");
    fields.reportStatus = "required";
    if (!fields.timeSlots.length) throw new Error("스튜디오 사용 시간을 선택하세요.");
    if (!fields.studioSpaces.length) throw new Error("스튜디오 사용 공간을 선택하세요.");
    if (fields.timeSlots.length > state.bootstrap.settings.studioMaxSlots) {
      throw new Error(`스튜디오는 최대 ${state.bootstrap.settings.studioMaxSlots}타임까지 예약할 수 있습니다.`);
    }
    if (!areSlotsConsecutive(fields.timeSlots, state.bootstrap.settings.studioSlots)) {
      throw new Error("스튜디오는 연속된 시간만 예약할 수 있습니다.");
    }
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
  }
  await api("/api/reservations", { method: "POST", body: { type, fields } });
  state.reservationType = "";
  if (type === "equipment") state.selectedEquipmentItemIds = [];
  state.view = "mine";
  await loadBootstrap();
  await loadMyReservations();
  toast(type === "equipment" ? "기자재 예약 승인 요청이 접수되었습니다." : "예약이 확정되었습니다.");
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
  toast("비밀번호가 변경되었습니다.");
}
