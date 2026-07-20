import { $app, state } from "./state.js?v=20260714-mobile-card-r6";
import { api } from "./api.js?v=20260714-mobile-card-r6";
import {
  invalidateAdminViewCache,
  loadAdminView,
  loadBootstrap,
  loadLectures,
  loadMyReservations
} from "./data.js?v=20260714-mobile-card-r6";
import {
  clearNativeNotificationAccount,
  disableNativeReservationNotifications,
  enableNativeReservationNotifications,
  handleNativeNotificationResume,
  notifyNativeReservationCreated,
  syncNativeReservationNotifications
} from "./native-notifications.js?v=20260714-mobile-card-r6";
import { createStudentReactActions, studentReactSnapshot } from "./react-student-adapter.js?v=20260711-react-student";
import { csvEscape, escapeHtml, formatDateTime, todayKey } from "./utils.js?v=20260714-mobile-card-r6";
import { adminShell } from "./views-admin.js?v=20260714-mobile-card-r6";
import { authView, noticeBottomSheet, studentShell, warningPopup } from "./views-student.js?v=20260714-mobile-card-r6";
import { captureScrollState, restoreScrollState } from "./events/scroll-state.js?v=20260714-mobile-card-r6";

document.addEventListener("gju-loading-change", () => {
  const scrollState = captureScrollState();
  render();
  restoreScrollState(scrollState);
});

let reactAdminMounted = false;
let reactStudentMounted = false;
let lastAnnouncedToastSequence = -1;

function unmountReactAdmin() {
  if (!reactAdminMounted) return;
  window.GJUReactAdmin?.unmount?.();
  reactAdminMounted = false;
}

function unmountReactStudent() {
  if (!reactStudentMounted) return;
  window.GJUReactStudent?.unmount?.();
  reactStudentMounted = false;
}

function canUseReactAdmin() {
  return state.user?.role === "admin" && state.reactAdminEnabled !== false && typeof window.GJUReactAdmin?.mount === "function";
}

function canUseReactStudent() {
  return state.user?.role === "student" && state.reactStudentEnabled !== false && typeof window.GJUReactStudent?.mount === "function";
}

function renderReactAdminShell() {
  return `<div id="react-admin-root"></div>`;
}

function renderReactStudentShell() {
  return `<div id="react-student-root"></div>`;
}

function renderAppChrome({ includeLegacyNotice = true } = {}) {
  const toastMessage = typeof state.toast === "string" ? state.toast : state.toast?.message || "";
  const toastTone = state.toastTone === "error" || state.toast?.type === "error" ? "error" : "status";
  const announcementSequence = Number(state.toastAnnouncementSequence || 0);
  const announce = Boolean(toastMessage) && announcementSequence !== lastAnnouncedToastSequence;
  if (announce) lastAnnouncedToastSequence = announcementSequence;
  const toastMarkup = toastMessage
    ? announce
      ? `<div class="toast" role="${toastTone === "error" ? "alert" : "status"}" aria-live="${toastTone === "error" ? "assertive" : "polite"}" aria-atomic="true" data-tone="${toastTone}">${escapeHtml(toastMessage)}</div>`
      : `<div class="toast" role="presentation" aria-live="off" aria-atomic="false" data-tone="${toastTone}">${escapeHtml(toastMessage)}</div>`
    : "";
  return `${includeLegacyNotice ? noticeBottomSheet() : ""}${warningPopup()}${loadingOverlay()}${toastMarkup}`;
}

function renderReactAdminFrame() {
  return `<div class="app">${renderReactAdminShell()}<div id="react-admin-chrome">${renderAppChrome()}</div></div>`;
}

function renderReactStudentFrame() {
  return `<div class="app">${renderReactStudentShell()}<div id="react-student-chrome">${renderAppChrome({ includeLegacyNotice: false })}</div></div>`;
}

function hasReactAdminFrame() {
  return reactAdminMounted && Boolean(document.querySelector("#react-admin-root")) && Boolean(document.querySelector("#react-admin-chrome"));
}

function hasReactStudentFrame() {
  return reactStudentMounted && Boolean(document.querySelector("#react-student-root")) && Boolean(document.querySelector("#react-student-chrome"));
}

function updateReactAdminChrome() {
  const chrome = document.querySelector("#react-admin-chrome");
  if (!chrome) return false;
  chrome.innerHTML = renderAppChrome();
  return true;
}

function updateReactStudentChrome() {
  const chrome = document.querySelector("#react-student-chrome");
  if (!chrome) return false;
  chrome.innerHTML = renderAppChrome({ includeLegacyNotice: false });
  return true;
}

function mountReactAdmin(root) {
  window.GJUReactAdmin?.mount?.({
    root,
    state,
    actions: reactAdminActions
  });
  reactAdminMounted = true;
}

function updateReactAdmin(root) {
  window.GJUReactAdmin?.update?.({
    root,
    state,
    actions: reactAdminActions
  });
}

function studentMountOptions(root) {
  return {
    root,
    state: studentReactSnapshot(state),
    actions: reactStudentActions
  };
}

function mountReactStudent(root) {
  window.GJUReactStudent?.mount?.(studentMountOptions(root));
  reactStudentMounted = true;
}

function updateReactStudent(root) {
  window.GJUReactStudent?.update?.(studentMountOptions(root));
}

function renderWithScrollState(scrollState) {
  render();
  if (scrollState) restoreScrollState(scrollState);
}

function actionErrorMessage(error) {
  return error?.message || "요청을 처리하지 못했습니다.";
}

function currentAdminView() {
  return String(state.adminView || "dashboard");
}

async function runAdminMutation(view, mutation, successMessage, options = {}) {
  const scrollState = options.scrollState || captureScrollState();
  let result;
  try {
    result = await mutation();
    if (typeof options.after === "function") await options.after(result);
  } catch (error) {
    toast(actionErrorMessage(error), { tone: "error", scrollState });
    throw error;
  }

  const message = typeof successMessage === "function" ? successMessage(result) : successMessage;
  invalidateAdminViewCache(...(options.invalidateViews || [view, "dashboard"]));
  toast(message, { scrollState });
  if (options.refresh !== false && view) {
    try {
      await loadAdminView(view, { force: true });
      renderWithScrollState(scrollState);
    } catch (error) {
      toast(`${message} 최신 목록 새로고침 실패: ${actionErrorMessage(error)}`, { tone: "error", scrollState });
    }
  }
  return result;
}

function filteredDeleteBody(filters, allowedKeys) {
  return {
    scope: "filtered",
    confirmText: "DELETE",
    filters: Object.fromEntries(allowedKeys
      .map((key) => [key, filters?.[key]])
      .filter(([, value]) => value !== undefined && value !== null && value !== "" && value !== "all"))
  };
}

function normalizedReservationFilters(filters = {}) {
  const q = String(filters?.q || "").trim();
  const type = q ? "all" : String(filters?.type || "all");
  return {
    ...filters,
    q,
    type,
    status: q || type !== "equipment" ? "all" : String(filters?.status || "all")
  };
}

function adminPageMeta(view) {
  return {
    reservations: state.adminReservationsPage,
    reports: state.adminReportsPage,
    lectures: state.adminLecturesPage,
    notices: state.adminNoticesPage
  }[view] || {};
}

function guardedFilteredDeleteBody(view, filters, allowedKeys) {
  const body = filteredDeleteBody(filters, allowedKeys);
  if (!Object.keys(body.filters).length) {
    toast("검색어, 학기, 유형, 상태 등 필터 조건을 먼저 선택하세요.", { tone: "error", preserveScroll: true });
    return null;
  }
  const page = adminPageMeta(view);
  const filteredTotal = Number(page?.total || 0);
  const collectionTotal = Number(page?.collectionTotal ?? page?.total ?? 0);
  if (collectionTotal > 0 && filteredTotal === collectionTotal) {
    toast("현재 필터 결과가 전체 데이터와 같습니다. 전체 삭제 버튼을 사용하세요.", { tone: "error", preserveScroll: true });
    return null;
  }
  return body;
}

async function runAdminFullDelete(view, path, collectionTotal, successMessage, invalidateViews) {
  if (Number(collectionTotal || 0) <= 0) {
    toast("삭제할 데이터가 없습니다.", { tone: "error", preserveScroll: true });
    return;
  }
  const input = prompt("전체 데이터를 삭제하려면 전체 삭제를 정확히 입력하세요.", "");
  if (input !== "전체 삭제") return;
  await runAdminMutation(
    view,
    () => api(path, {
      method: "DELETE",
      body: { scope: "all", confirmText: "전체 삭제", filters: {} }
    }),
    successMessage,
    { invalidateViews }
  );
}

function downloadTextFile(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function runAdminUtility(task, successMessage) {
  const scrollState = captureScrollState();
  try {
    const result = await task();
    renderWithScrollState(scrollState);
    toast(successMessage, { scrollState });
    return result;
  } catch (error) {
    renderWithScrollState(scrollState);
    toast(actionErrorMessage(error), { tone: "error", scrollState });
    throw error;
  }
}

const reactStudentActions = createStudentReactActions({
  state,
  api,
  render,
  toast,
  loadBootstrap,
  loadMyReservations,
  loadLectures,
  notifyNativeReservationCreated,
  clearNativeNotificationAccount,
  enableNativeReservationNotifications,
  disableNativeReservationNotifications,
  syncNativeReservationNotifications,
  handleNativeNotificationResume,
  logout: () => document.dispatchEvent(new CustomEvent("gju-react-student-logout")),
  clearStoredSession: () => {
    localStorage.removeItem("gju_token");
    sessionStorage.removeItem("gju_token");
  },
  confirm: (message) => confirm(message)
});

const reactAdminActions = {
  async setAdminView(view, filters = {}) {
    const scrollState = captureScrollState();
    state.adminView = view;
    renderWithScrollState(scrollState);
    try {
      await loadAdminView(view, filters);
      renderWithScrollState(scrollState);
    } catch (error) {
      toast(actionErrorMessage(error), { tone: "error", scrollState });
    }
  },
  async refreshAdminData() {
    if (state.adminRefresh?.refreshing) return;
    const scrollState = captureScrollState();
    state.adminRefresh = { ...(state.adminRefresh || {}), refreshing: true };
    renderWithScrollState(scrollState);
    let error = null;
    try {
      await loadAdminView(currentAdminView(), { force: true });
    } catch (caught) {
      error = caught;
    } finally {
      state.adminRefresh = { ...(state.adminRefresh || {}), refreshing: false };
      renderWithScrollState(scrollState);
    }
    toast(error ? actionErrorMessage(error) : "최신 데이터를 불러왔습니다.", {
      tone: error ? "error" : "status",
      scrollState
    });
  },
  async setAdminFilters(view, filters) {
    const scrollState = captureScrollState();
    try {
      await loadAdminView(view, filters);
      renderWithScrollState(scrollState);
    } catch (error) {
      toast(actionErrorMessage(error), { tone: "error", scrollState });
    }
  },
  notify(message, tone = "status") {
    toast(message, { tone, preserveScroll: true });
  },
  setEquipmentSelection(ids) {
    const uniqueIds = [...new Set((ids || []).map(String).filter(Boolean))];
    state.selectedAdminEquipmentIds = uniqueIds;
    state.adminSelectedEquipmentIds = uniqueIds;
    renderWithScrollState(captureScrollState());
  },
  async setUserApproval(userId, status, limitDuration) {
    const body = { approvalStatus: status };
    if (status === "blocked") body.limitDuration = limitDuration || "week1";
    await runAdminMutation(
      "users",
      () => api(`/api/admin/users/${encodeURIComponent(userId)}/approval`, { method: "PATCH", body }),
      status === "blocked" ? "대여금지를 적용했습니다." : status === "approved" ? "학생을 승인했습니다." : "학생 상태를 변경했습니다."
    );
  },
  async resetUserPassword(userId) {
    const input = prompt("새 비밀번호를 입력하세요. 비워두면 임시 비밀번호가 자동 생성됩니다.", "");
    if (input === null) return;
    await runAdminMutation(
      "users",
      () => api(`/api/admin/users/${encodeURIComponent(userId)}/password`, {
        method: "PATCH",
        body: input.trim() ? { newPassword: input.trim() } : {}
      }),
      (result) => {
        if (result?.generatedPassword) {
          alert(`임시 비밀번호: ${result.generatedPassword}\n학생에게 전달한 뒤 첫 로그인에서 변경하도록 안내하세요.`);
          return "임시 비밀번호를 생성했습니다.";
        }
        return "비밀번호를 변경했습니다.";
      },
      { invalidateViews: ["users", "logs"] }
    );
  },
  async warnUser(userId) {
    const reason = prompt("관리자용 경고 메모를 입력하세요. 학생 상태는 변경되지 않습니다.", "");
    if (reason === null) return;
    await runAdminMutation(
      "users",
      () => api(`/api/admin/users/${encodeURIComponent(userId)}/warning`, { method: "POST", body: { reason: reason.trim() } }),
      (result) => `경고 메모를 저장했습니다. (기록 ${Number(result?.user?.warningCount || 0)}건)`
    );
  },
  async resetUserWarnings(userId) {
    if (!confirm("이 학생의 경고 메모 기록을 초기화할까요? 대여금지 상태는 변경되지 않습니다.")) return;
    await runAdminMutation(
      "users",
      () => api(`/api/admin/users/${encodeURIComponent(userId)}/warning`, { method: "POST", body: { reset: true } }),
      "경고 메모를 초기화했습니다."
    );
  },
  async deleteUser(userId, name = "이 학생") {
    if (!confirm(`${name} 계정을 삭제할까요?\n해당 학생의 예약·보고서·경고 기록도 함께 삭제되며 되돌릴 수 없습니다.`)) return;
    await runAdminMutation(
      "users",
      () => api(`/api/admin/users/${encodeURIComponent(userId)}`, { method: "DELETE" }),
      (result) => `학생을 삭제했습니다.${result?.removedReservations ? ` (예약 ${result.removedReservations}건 포함)` : ""}`,
      { invalidateViews: ["users", "reservations", "reports", "dashboard", "logs"] }
    );
  },
  async updateReservationStatus(reservationId, status) {
    if (status === "cancelled" && !confirm("예약을 대여취소로 변경할까요?")) return;
    await runAdminMutation(
      "reservations",
      () => api(`/api/admin/reservations/${encodeURIComponent(reservationId)}/status`, { method: "PATCH", body: { status } }),
      "예약 상태를 변경했습니다."
    );
  },
  async deleteReservation(reservationId, label = "이 예약") {
    if (!confirm(`${label}을 삭제할까요? 연결된 보고서도 함께 삭제되며 되돌릴 수 없습니다.`)) return;
    await runAdminMutation(
      "reservations",
      async () => {
        const result = await api(`/api/admin/reservations/${encodeURIComponent(reservationId)}`, { method: "DELETE" });
        if (result?.id !== reservationId || Number(result?.deletedReservations) !== 1) {
          throw new Error("예약 삭제 건수를 확인할 수 없습니다.");
        }
        return result;
      },
      "예약을 삭제했습니다.",
      { invalidateViews: ["reservations", "reports", "dashboard"] }
    );
  },
  async bulkDeleteReservations(filters) {
    const activeFilters = normalizedReservationFilters(filters);
    const body = guardedFilteredDeleteBody("reservations", activeFilters, ["q", "type", "status", "semester"]);
    if (!body) return;
    const input = prompt("현재 필터에 해당하는 예약을 삭제하려면 DELETE를 입력하세요.", "");
    if (input !== "DELETE") return;
    await runAdminMutation(
      "reservations",
      () => api("/api/admin/reservations/bulk", {
        method: "DELETE",
        body
      }),
      "필터된 예약을 삭제했습니다.",
      { invalidateViews: ["reservations", "reports", "dashboard"] }
    );
  },
  async deleteAllReservations(collectionTotal) {
    await runAdminFullDelete(
      "reservations",
      "/api/admin/reservations/bulk",
      collectionTotal,
      "전체 예약을 삭제했습니다.",
      ["reservations", "reports", "dashboard"]
    );
  },
  async updateEquipmentStatus(ids, status) {
    const uniqueIds = [...new Set((ids || []).map(String).filter(Boolean))];
    if (!uniqueIds.length) {
      this.notify("선택된 기자재가 없습니다.", "error");
      return;
    }
    const patch = status === "문의"
      ? { status: "가능", reservable: false, inquiryOnly: true }
      : { status };
    await runAdminMutation(
      "equipment",
      () => uniqueIds.length === 1
        ? api(`/api/admin/equipment/${encodeURIComponent(uniqueIds[0])}`, { method: "PATCH", body: patch })
        : api("/api/admin/equipment/bulk", { method: "PATCH", body: { ids: uniqueIds, patch } }),
      uniqueIds.length === 1 ? "기자재 상태를 변경했습니다." : `선택 기자재 ${uniqueIds.length}개의 상태를 변경했습니다.`
    );
  },
  async createEquipment(input) {
    const inquiryOnly = input.status === "문의" || input.inquiryOnly === true || input.reservable === false;
    const body = {
      ...input,
      status: input.status === "문의" ? "가능" : input.status,
      reservable: inquiryOnly ? false : input.reservable,
      inquiryOnly
    };
    await runAdminMutation("equipment", () => api("/api/admin/equipment", { method: "POST", body }), "장비를 추가했습니다.");
  },
  async importEquipment(rows) {
    await runAdminMutation("equipment", () => api("/api/admin/equipment/import", { method: "POST", body: { rows } }), "CSV 장비를 등록했습니다.");
  },
  async deleteEquipment(ids) {
    const uniqueIds = [...new Set((ids || []).map(String).filter(Boolean))];
    if (!uniqueIds.length) {
      this.notify("선택된 기자재가 없습니다.", "error");
      return;
    }
    if (!confirm(uniqueIds.length === 1
      ? "이 기자재를 제거할까요? 목록에서 숨겨지고 학생 예약에서도 제외됩니다."
      : `선택한 기자재 ${uniqueIds.length}개를 제거할까요? 목록에서 숨겨지고 학생 예약에서도 제외됩니다.`)) return;
    await runAdminMutation(
      "equipment",
      () => uniqueIds.length === 1
        ? api(`/api/admin/equipment/${encodeURIComponent(uniqueIds[0])}`, { method: "PATCH", body: { active: false } })
        : api("/api/admin/equipment/bulk", { method: "PATCH", body: { ids: uniqueIds, patch: { active: false } } }),
      uniqueIds.length === 1 ? "기자재를 제거했습니다." : `선택 기자재 ${uniqueIds.length}개를 제거했습니다.`
    );
  },
  async saveEquipmentCategories(categories) {
    await runAdminMutation(
      "equipment",
      () => api("/api/admin/settings", { method: "PATCH", body: { equipmentCategories: categories } }),
      "카테고리를 추가했습니다.",
      {
        after: (settings) => { state.bootstrap = { ...(state.bootstrap || {}), settings }; },
        invalidateViews: ["equipment", "settings"]
      }
    );
  },
  async saveCoursePlanningCourses(courses) {
    await runAdminMutation(
      "course-demand",
      () => api("/api/admin/courses", { method: "PUT", body: { courses } }),
      "과목 마스터를 저장했습니다.",
      { invalidateViews: ["course-demand"] }
    );
  },
  async saveAnnualOfferingPlan(plan) {
    const existingPlans = Array.isArray(state.adminCoursePlanning?.annualPlans) ? state.adminCoursePlanning.annualPlans : [];
    const exists = existingPlans.some((item) => item?.id === plan?.id);
    const result = await runAdminMutation(
      "course-demand",
      () => exists
        ? api(`/api/admin/annual-offering-plans/${encodeURIComponent(plan.id)}`, { method: "PUT", body: { plan } })
        : api("/api/admin/annual-offering-plans", { method: "PUT", body: { annualPlans: [...existingPlans, plan] } }),
      plan?.status === "confirmed" ? "편성안을 확정했습니다." : "편성안을 저장했습니다.",
      { invalidateViews: ["course-demand"] }
    );
    return Array.isArray(result) ? (result.find((item) => item?.id === plan?.id) || plan) : result;
  },
  async createCourseDemandSurvey(input) {
    await runAdminMutation(
      "course-demand",
      () => api("/api/admin/course-demand-surveys", { method: "POST", body: input }),
      input?.status === "open" ? "수요조사를 공개했습니다." : "설문안을 임시저장했습니다.",
      { invalidateViews: ["course-demand"] }
    );
  },
  async updateCourseDemandSurvey(surveyId, input) {
    if (input?.status === "closed" && !confirm("수요조사를 마감할까요? 마감 후에는 다시 공개하거나 수정할 수 없습니다.")) return;
    await runAdminMutation(
      "course-demand",
      () => api(`/api/admin/course-demand-surveys/${encodeURIComponent(surveyId)}`, { method: "PUT", body: input }),
      input?.status === "closed" ? "수요조사를 마감했습니다." : "수요조사를 수정했습니다.",
      { invalidateViews: ["course-demand"] }
    );
  },
  async loadCourseDemandRecommendation(planId) {
    try {
      return await api(`/api/admin/annual-offering-plans/${encodeURIComponent(planId)}/recommendations`, { method: "POST" });
    } catch (error) {
      toast(actionErrorMessage(error), { tone: "error", preserveScroll: true });
      throw error;
    }
  },
  async bulkDeleteReports(filters) {
    const body = guardedFilteredDeleteBody("reports", filters, ["q", "status", "semester"]);
    if (!body) return;
    const input = prompt("현재 필터에 해당하는 보고서를 삭제하려면 DELETE를 입력하세요.", "");
    if (input !== "DELETE") return;
    await runAdminMutation(
      "reports",
      () => api("/api/admin/reports/bulk", {
        method: "DELETE",
        body
      }),
      "필터된 보고서를 삭제했습니다.",
      { invalidateViews: ["reports", "reservations", "dashboard"] }
    );
  },
  async deleteAllReports(collectionTotal) {
    await runAdminFullDelete(
      "reports",
      "/api/admin/reports/bulk",
      collectionTotal,
      "전체 보고서를 삭제했습니다.",
      ["reports", "reservations", "dashboard"]
    );
  },
  async saveLecture(lectureId, input) {
    await runAdminMutation(
      "lectures",
      () => api(lectureId ? `/api/admin/lectures/${encodeURIComponent(lectureId)}` : "/api/admin/lectures", {
        method: lectureId ? "PATCH" : "POST",
        body: input
      }),
      lectureId ? "특강을 수정했습니다." : "특강을 등록했습니다."
    );
  },
  async deleteLecture(lectureId, title = "이 특강") {
    if (!confirm(`'${title}' 특강을 삭제할까요?\n신청 내역도 함께 삭제되며 되돌릴 수 없습니다.`)) return;
    await runAdminMutation(
      "lectures",
      () => api(`/api/admin/lectures/${encodeURIComponent(lectureId)}`, { method: "DELETE" }),
      "특강을 삭제했습니다."
    );
  },
  async bulkDeleteLectures(filters) {
    const body = guardedFilteredDeleteBody("lectures", filters, ["q", "semester"]);
    if (!body) return;
    const input = prompt("현재 필터에 해당하는 특강을 삭제하려면 DELETE를 입력하세요.", "");
    if (input !== "DELETE") return;
    await runAdminMutation(
      "lectures",
      () => api("/api/admin/lectures/bulk", {
        method: "DELETE",
        body
      }),
      "필터된 특강을 삭제했습니다."
    );
  },
  async deleteAllLectures(collectionTotal) {
    await runAdminFullDelete(
      "lectures",
      "/api/admin/lectures/bulk",
      collectionTotal,
      "전체 특강을 삭제했습니다.",
      ["lectures", "dashboard"]
    );
  },
  async downloadLectureCsv() {
    await runAdminUtility(async () => {
      const lectures = [];
      const pageSize = 200;
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
          sort: String(state.adminLectureSort?.field || "lectureDate"),
          direction: String(state.adminLectureSort?.direction || "asc")
        });
        const q = String(state.adminLectureSearch || "").trim();
        const semester = String(state.adminLectureSemesterFilter || "all");
        if (q) params.set("q", q);
        if (semester && semester !== "all") params.set("semester", semester);
        const result = await api(`/api/admin/lectures?${params.toString()}`);
        const items = Array.isArray(result) ? result : (Array.isArray(result?.items) ? result.items : []);
        lectures.push(...items);
        hasMore = !Array.isArray(result) && Boolean(result?.hasMore) && items.length > 0;
        page += 1;
      }
      const headers = ["특강명", "특강일", "시간", "장소", "강사명", "강사 소속", "담당교수", "대상 학년", "모집인원", "신청인원", "진행상태", "신청자", "학번", "신분", "연락처", "이메일", "신청일", "비고"];
      const rows = lectures.flatMap((lecture) => {
        const applications = Array.isArray(lecture.applications) ? lecture.applications : [];
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
        if (!applications.length) return [[...base, "", "", "", "", "", "", lecture.notes || ""]];
        return applications.map((application) => [
          ...base,
          application.userName,
          application.studentId,
          application.studentStatus,
          application.phone,
          application.email,
          formatDateTime(application.appliedAt),
          lecture.notes || ""
        ]);
      });
      const csv = "\uFEFF" + [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
      downloadTextFile(`gju-lectures-${todayKey()}.csv`, csv, "text/csv;charset=utf-8");
    }, "특강 신청자 CSV를 내보냈습니다.");
  },
  async createNotice(input) {
    await runAdminMutation("notices", () => api("/api/admin/notices", { method: "POST", body: input }), "공지를 등록했습니다.");
  },
  async deleteNotice(noticeId, title = "이 공지") {
    if (!confirm(`'${title}' 공지를 삭제할까요?`)) return;
    await runAdminMutation(
      "notices",
      async () => {
        const result = await api(`/api/admin/notices/${encodeURIComponent(noticeId)}`, { method: "DELETE" });
        if (result?.id !== noticeId || Number(result?.deletedNotices) !== 1) {
          throw new Error("공지 삭제 건수를 확인할 수 없습니다.");
        }
        return result;
      },
      "공지를 삭제했습니다."
    );
  },
  async bulkDeleteNotices(filters) {
    const body = guardedFilteredDeleteBody("notices", filters, ["q"]);
    if (!body) return;
    const input = prompt("현재 검색 조건의 공지를 삭제하려면 DELETE를 입력하세요.", "");
    if (input !== "DELETE") return;
    await runAdminMutation(
      "notices",
      () => api("/api/admin/notices/bulk", {
        method: "DELETE",
        body
      }),
      "필터된 공지를 삭제했습니다."
    );
  },
  async deleteAllNotices(collectionTotal) {
    await runAdminFullDelete(
      "notices",
      "/api/admin/notices/bulk",
      collectionTotal,
      "전체 공지를 삭제했습니다.",
      ["notices", "dashboard"]
    );
  },
  async saveSettings(settings) {
    await runAdminMutation(
      "settings",
      () => api("/api/admin/settings", { method: "PATCH", body: settings }),
      "설정을 저장했습니다."
    );
  },
  async saveBlockedSchedules(blockedSchedules) {
    await runAdminMutation(
      "settings",
      () => api("/api/admin/settings", { method: "PATCH", body: { blockedSchedules } }),
      "차단 일정을 저장했습니다."
    );
  },
  async cleanupAdminData() {
    if (!confirm("만료된 세션을 삭제하고 오래된 개인정보/보고서 HTML을 정리할까요?")) return;
    await runAdminMutation(
      "settings",
      () => api("/api/admin/maintenance/cleanup", { method: "POST" }),
      (result) => `정리 완료: 예약 익명화 ${Number(result?.anonymizedReservations || 0)}건, 보고서 HTML 삭제 ${Number(result?.deletedReportHtmlSnapshots || 0)}건, 세션 삭제 ${Number(result?.deletedExpiredSessions || 0)}건`,
      { invalidateViews: ["settings", "logs", "reservations", "reports", "dashboard"] }
    );
  },
  async closeSemester() {
    const confirmText = prompt("모든 예약, 연결된 보고서, 모든 로그인 세션을 삭제하고 즉시 로그아웃합니다. 계속하려면 학기 종료를 정확히 입력하세요.");
    if (confirmText === null) return;
    if (confirmText !== "학기 종료") {
      this.notify("확인 문구가 일치하지 않습니다.", "error");
      return;
    }
    const result = await runAdminMutation(
      "",
      () => api("/api/admin/maintenance/semester-close", { method: "POST", body: { confirmText } }),
      "학기 종료 데이터 정리가 완료되었습니다.",
      { refresh: false, invalidateViews: ["dashboard", "reservations", "reports", "logs"] }
    );
    if (result) this.logout();
  },
  async updateAccount(input) {
    await runAdminMutation(
      "",
      () => api("/api/me", { method: "PATCH", body: input }),
      "내 정보를 저장했습니다.",
      {
        refresh: false,
        after: (result) => { state.user = result?.user || state.user; },
        invalidateViews: ["account"]
      }
    );
  },
  async changeAccountPassword(currentPassword, newPassword) {
    const result = await runAdminMutation(
      "",
      () => api("/api/me/password", { method: "PATCH", body: { currentPassword, newPassword } }),
      "비밀번호를 변경했습니다. 모든 기기에서 로그아웃합니다.",
      { refresh: false, invalidateViews: ["account", "logs"] }
    );
    if (result) this.logout();
  },
  async revokeSession(sessionId) {
    if (!confirm("이 기기를 원격 로그아웃할까요?")) return;
    await runAdminMutation(
      "logs",
      () => api(`/api/admin/sessions/${encodeURIComponent(sessionId)}/revoke`, { method: "POST" }),
      "해당 기기를 로그아웃했습니다."
    );
  },
  async downloadAdminBackup() {
    await runAdminUtility(async () => {
      const data = await api("/api/admin/export");
      downloadTextFile(
        `gju-reserve-backup-${todayKey()}.json`,
        JSON.stringify(data, null, 2),
        "application/json;charset=utf-8"
      );
    }, "백업 JSON을 내보냈습니다.");
  },
  async enableNativeNotifications() {
    await runAdminUtility(() => enableNativeReservationNotifications(), "운영 알림을 켰습니다.");
  },
  async disableNativeNotifications() {
    await runAdminUtility(() => disableNativeReservationNotifications(), "운영 알림을 껐습니다.");
  },
  async syncNativeNotifications() {
    await runAdminUtility(async () => {
      const result = await syncNativeReservationNotifications();
      if (result?.error) throw new Error(result.error);
      return result;
    }, "운영 알림을 동기화했습니다.");
  },
  logout() {
    document.dispatchEvent(new CustomEvent("gju-react-admin-logout"));
  },
  render
};

function loadingOverlay() {
  if (!state.loadingCount) return "";
  return `
    <div class="loading-overlay" role="status" aria-live="polite">
      <div class="loading-panel">
        <span class="loading-spinner" aria-hidden="true"></span>
        <strong>로딩중</strong>
      </div>
    </div>
  `;
}

export function render() {
  if (!state.bootstrap) {
    unmountReactAdmin();
    unmountReactStudent();
    $app.innerHTML = `<main class="auth-shell"><div class="auth-panel loading-initial">${loadingOverlay() || "<strong>로딩중</strong>"}</div></main>`;
    return;
  }
  const useReactAdmin = canUseReactAdmin();
  if (useReactAdmin) {
    unmountReactStudent();
    if (!hasReactAdminFrame()) {
      $app.innerHTML = renderReactAdminFrame();
    } else {
      updateReactAdminChrome();
    }
    const root = document.querySelector("#react-admin-root");
    if (root) {
      if (!reactAdminMounted) {
        mountReactAdmin(root);
      } else if (typeof window.GJUReactAdmin?.update === "function") {
        updateReactAdmin(root);
      } else {
        mountReactAdmin(root);
      }
    }
    return;
  }
  unmountReactAdmin();
  const useReactStudent = canUseReactStudent();
  if (useReactStudent) {
    if (!hasReactStudentFrame()) {
      $app.innerHTML = renderReactStudentFrame();
    } else {
      updateReactStudentChrome();
    }
    const root = document.querySelector("#react-student-root");
    if (root) {
      if (!reactStudentMounted) mountReactStudent(root);
      else if (typeof window.GJUReactStudent?.update === "function") updateReactStudent(root);
      else mountReactStudent(root);
    }
    return;
  }
  unmountReactStudent();
  const body = !state.user ? authView() : state.user.role === "admin" ? adminShell() : studentShell();
  $app.innerHTML = `<div class="app">${body}${renderAppChrome()}</div>`;
}

let toastTimer = null;

export function toast(message, options = {}) {
  if (toastTimer) clearTimeout(toastTimer);
  const scrollState = options.scrollState || (options.preserveScroll ? captureScrollState() : null);
  state.toast = message;
  state.toastTone = options.tone === "error" ? "error" : "status";
  state.toastAnnouncementSequence = Number(state.toastAnnouncementSequence || 0) + 1;
  render();
  if (scrollState) restoreScrollState(scrollState);
  toastTimer = setTimeout(() => {
    const hideScrollState = options.preserveScroll ? captureScrollState() : null;
    state.toast = "";
    state.toastTone = "status";
    toastTimer = null;
    render();
    if (hideScrollState) restoreScrollState(hideScrollState);
  }, Number(options.duration) > 0 ? Number(options.duration) : 2600);
}
