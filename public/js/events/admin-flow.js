import { state } from "../state.js?v=20260704-astryx-student-guide";
import { api } from "../api.js?v=20260704-astryx-student-guide";
import { loadAdminData, loadBootstrap } from "../data.js?v=20260704-astryx-student-guide";
import { downloadAdminBackup, downloadLectureCsv } from "../actions.js?v=20260704-astryx-student-guide";
import {
  patchAdminEquipment,
  syncAdminEquipmentDom
} from "../admin-equipment.js?v=20260704-astryx-student-guide";
import { render, toast } from "../renderer.js?v=20260704-astryx-student-guide";
import { formData, parseCsv } from "../utils.js?v=20260704-astryx-student-guide";
import {
  captureScrollState,
  refreshAdminDataPreservingScroll,
  renderPreservingScroll,
  resetAdminPage,
  setAdminPage
} from "./shared.js?v=20260704-astryx-student-guide";

const FULL_DELETE_CONFIRM_TEXT = "전체 삭제";

function activeSemesterLabel(options = [], active = "all") {
  if (!active || active === "all") return "전체 학기";
  return options.find((item) => item?.key === active)?.label || active;
}

function reservationBulkFilterLabel() {
  const query = String(state.adminReservationSearch || "").trim();
  if (query) return `현재 검색 결과 · ${activeSemesterLabel(state.adminReservationSemesters, state.adminReservationSemesterFilter)}`;
  const typeLabel = state.adminReservationTab === "all" ? "전체 예약" : `${state.adminReservationTab} 예약`;
  const statusLabel = state.adminReservationTab === "equipment" && state.adminEquipmentReservationStatusFilter !== "all"
    ? ` · ${state.adminEquipmentReservationStatusFilter}`
    : "";
  return `${activeSemesterLabel(state.adminReservationSemesters, state.adminReservationSemesterFilter)} · ${typeLabel}${statusLabel}`;
}

function reportBulkFilterLabel() {
  const query = String(state.adminReportSearch || "").trim();
  if (query) return `현재 검색 결과 · ${activeSemesterLabel(state.adminReportSemesters, state.adminReportSemesterFilter)}`;
  return activeSemesterLabel(state.adminReportSemesters, state.adminReportSemesterFilter);
}

function lectureBulkFilterLabel() {
  const query = String(state.adminLectureSearch || "").trim();
  if (query) return `현재 검색 결과 · ${activeSemesterLabel(state.adminLectureSemesters, state.adminLectureSemesterFilter)}`;
  return activeSemesterLabel(state.adminLectureSemesters, state.adminLectureSemesterFilter);
}

function noticeBulkFilterLabel() {
  return String(state.adminNoticeSearch || "").trim() ? "현재 검색 결과" : "전체 공지";
}

function pageTotal(page, fallback = 0) {
  return Number(page?.total ?? fallback ?? 0);
}

function pageCollectionTotal(page, fallback = 0) {
  return Number(page?.collectionTotal ?? page?.total ?? fallback ?? 0);
}

function effectiveBulkFilters(filters = {}) {
  return Object.fromEntries(Object.entries(filters || {}).filter(([, value]) => value !== undefined && value !== null && value !== "" && value !== "all"));
}

function currentBulkDeleteConfig(kind, scope) {
  if (kind === "reservations") {
    const query = String(state.adminReservationSearch || "").trim();
    const page = state.adminReservationsPage || {};
    const filters = {
      semester: state.adminReservationSemesterFilter,
      q: query,
      type: query ? "" : state.adminReservationTab,
      status: !query && state.adminReservationTab === "equipment" ? state.adminEquipmentReservationStatusFilter : ""
    };
    return {
      path: "/api/admin/reservations/bulk",
      pageKey: "adminReservationsPage",
      totalCount: scope === "all"
        ? pageCollectionTotal(page, state.adminReservations.length)
        : pageTotal(page, state.adminReservations.length),
      collectionTotal: pageCollectionTotal(page, state.adminReservations.length),
      filterLabel: reservationBulkFilterLabel(),
      filters,
      toastMessage: (result) => `예약 ${result.deletedReservations}건과 연결 보고서 ${result.deletedReports}건을 삭제했습니다.`
    };
  }
  if (kind === "reports") {
    const page = state.adminReportsPage || {};
    return {
      path: "/api/admin/reports/bulk",
      pageKey: "adminReportsPage",
      totalCount: scope === "all" ? pageCollectionTotal(page, state.adminReports.length) : pageTotal(page, state.adminReports.length),
      collectionTotal: pageCollectionTotal(page, state.adminReports.length),
      filterLabel: reportBulkFilterLabel(),
      filters: {
        semester: state.adminReportSemesterFilter,
        q: String(state.adminReportSearch || "").trim()
      },
      toastMessage: (result) => `보고서 ${result.deletedReports}건을 삭제했습니다.`
    };
  }
  if (kind === "lectures") {
    const page = state.adminLecturesPage || {};
    return {
      path: "/api/admin/lectures/bulk",
      pageKey: "adminLecturesPage",
      totalCount: scope === "all" ? pageCollectionTotal(page, state.adminLectures.length) : pageTotal(page, state.adminLectures.length),
      collectionTotal: pageCollectionTotal(page, state.adminLectures.length),
      filterLabel: lectureBulkFilterLabel(),
      filters: {
        semester: state.adminLectureSemesterFilter,
        q: String(state.adminLectureSearch || "").trim()
      },
      toastMessage: (result) => `특강 ${result.deletedLectures}건과 신청 ${result.deletedApplications}건을 삭제했습니다.`
    };
  }
  if (kind === "notices") {
    const page = state.adminNoticesPage || {};
    return {
      path: "/api/admin/notices/bulk",
      pageKey: "adminNoticesPage",
      totalCount: scope === "all" ? pageCollectionTotal(page, state.adminNotices.length) : pageTotal(page, state.adminNotices.length),
      collectionTotal: pageCollectionTotal(page, state.adminNotices.length),
      filterLabel: noticeBulkFilterLabel(),
      filters: { q: String(state.adminNoticeSearch || "").trim() },
      toastMessage: (result) => `공지 ${result.deletedNotices}건을 삭제했습니다.`
    };
  }
  return null;
}

async function refreshAdminPagePreservingScroll(pageKey = "", options = {}) {
  await refreshAdminDataPreservingScroll(options);
  if (pageKey) {
    const page = state[pageKey] || {};
    const pageSize = Math.max(1, Number(page.pageSize || 0) || 100);
    const totalPages = Math.max(1, Math.ceil(Number(page.total || 0) / pageSize));
    if (Number(page.page || 1) > totalPages) {
      setAdminPage(pageKey, totalPages);
      await refreshAdminDataPreservingScroll(options);
    }
  }
}

export function setupAdminFlowClickHandlers() {
  document.addEventListener("click", async (event) => {
    const target = event.target.closest("button, a");
    if (!target) return;
    try {
      if (target.dataset.adminQueueSheet) {
        state.activeAdminQueueSheet = target.dataset.adminQueueSheet;
        render();
        return;
      }
      if (target.dataset.adminQueueSheetClose !== undefined) {
        state.activeAdminQueueSheet = "";
        render();
        return;
      }
      if (target.dataset.action === "csv-preview") {
        const form = target.closest("form");
        state.csvPreviewRows = parseCsv(formData(form).csv || "");
        render();
        return;
      }
      if (target.dataset.action === "lecture-export") {
        downloadLectureCsv();
        return;
      }
      if (target.dataset.action === "admin-export") {
        await downloadAdminBackup();
        toast("백업 JSON을 내려받았습니다.");
        return;
      }
      if (target.dataset.action === "admin-cleanup") {
        if (!confirm("만료된 세션을 삭제하고 오래된 개인정보/보고서 HTML을 정리할까요?")) return;
        const result = await api("/api/admin/maintenance/cleanup", { method: "POST" });
        await refreshAdminDataPreservingScroll();
        toast(`정리 완료: 예약 익명화 ${result.anonymizedReservations}건, 보고서 HTML 삭제 ${result.deletedReportHtmlSnapshots}건, 세션 삭제 ${result.deletedExpiredSessions}건`, { preserveScroll: true });
        return;
      }
      if (target.dataset.adminView) {
        state.activeAdminQueueSheet = "";
        if (target.dataset.adminReservationTab) {
          state.adminReservationTab = target.dataset.adminReservationTab;
          if (target.dataset.adminEquipmentReservationStatus) {
            state.adminEquipmentReservationStatusFilter = target.dataset.adminEquipmentReservationStatus;
          }
          resetAdminPage("adminReservationsPage");
          await loadAdminData();
        }
        state.adminView = target.dataset.adminView;
        renderPreservingScroll();
        return;
      }
      if (target.dataset.adminReservationTab && !target.dataset.adminView) {
        state.adminReservationTab = target.dataset.adminReservationTab;
        resetAdminPage("adminReservationsPage");
        await loadAdminData();
        renderPreservingScroll();
        return;
      }
      if (target.dataset.adminEquipmentReservationStatus) {
        state.adminEquipmentReservationStatusFilter = target.dataset.adminEquipmentReservationStatus;
        resetAdminPage("adminReservationsPage");
        await loadAdminData();
        render();
        return;
      }
      if (target.dataset.adminReservationSemester !== undefined) {
        state.adminReservationSemesterFilter = target.dataset.adminReservationSemester;
        resetAdminPage("adminReservationsPage");
        await refreshAdminPagePreservingScroll("adminReservationsPage");
        return;
      }
      if (target.dataset.adminReportSemester !== undefined) {
        state.adminReportSemesterFilter = target.dataset.adminReportSemester;
        resetAdminPage("adminReportsPage");
        await refreshAdminPagePreservingScroll("adminReportsPage");
        return;
      }
      if (target.dataset.adminLectureSemester !== undefined) {
        state.adminLectureSemesterFilter = target.dataset.adminLectureSemester;
        resetAdminPage("adminLecturesPage");
        await refreshAdminPagePreservingScroll("adminLecturesPage");
        return;
      }
      if (target.dataset.adminUserStatusFilter) {
        state.adminUserStatusFilter = target.dataset.adminUserStatusFilter;
        resetAdminPage("adminUsersPage");
        await loadAdminData();
        render();
        return;
      }
      if (target.dataset.adminUsersPage) {
        setAdminPage("adminUsersPage", target.dataset.adminUsersPage);
        await loadAdminData();
        renderPreservingScroll();
        return;
      }
      if (target.dataset.adminReservationsPage) {
        setAdminPage("adminReservationsPage", target.dataset.adminReservationsPage);
        await loadAdminData();
        renderPreservingScroll();
        return;
      }
      if (target.dataset.adminReportsPage) {
        setAdminPage("adminReportsPage", target.dataset.adminReportsPage);
        await loadAdminData();
        renderPreservingScroll();
        return;
      }
      if (target.dataset.adminSessionSort) {
        state.adminSessionSort = target.dataset.adminSessionSort;
        render();
        return;
      }
      if (target.dataset.adminLogActionFilter) {
        state.adminLogActionFilter = target.dataset.adminLogActionFilter;
        render();
        return;
      }
      if (target.dataset.adminLogSort) {
        state.adminLogSort = target.dataset.adminLogSort;
        render();
        return;
      }
      if (target.dataset.adminEquipmentPanelTab) {
        state.adminEquipmentPanelTab = target.dataset.adminEquipmentPanelTab;
        renderPreservingScroll();
        return;
      }
      if (target.dataset.adminEquipmentTab) {
        state.adminEquipmentTab = target.dataset.adminEquipmentTab;
        renderPreservingScroll();
        return;
      }
      if (target.dataset.adminEquipmentCategoryTab) {
        state.adminEquipmentCategoryTab = target.dataset.adminEquipmentCategoryTab;
        renderPreservingScroll();
        return;
      }
      if (target.dataset.adminLecturePanelTab) {
        state.adminLecturePanelTab = target.dataset.adminLecturePanelTab;
        state.editingLectureId = "";
        renderPreservingScroll();
        return;
      }
      if (target.dataset.lectureUpdate) {
        const status = document.querySelector(`[data-lecture-status="${target.dataset.lectureUpdate}"]`)?.value || "모집중";
        await api(`/api/admin/lectures/${target.dataset.lectureUpdate}`, { method: "PATCH", body: { status } });
        await refreshAdminDataPreservingScroll();
        toast("특강 상태를 저장했습니다.", { preserveScroll: true });
      }
      if (target.dataset.lectureEdit) {
        state.editingLectureId = target.dataset.lectureEdit;
        state.adminLecturePanelTab = "add";
        renderPreservingScroll();
        return;
      }
      if (target.dataset.lectureEditCancel !== undefined) {
        state.editingLectureId = "";
        render();
        return;
      }
      if (target.dataset.lectureDelete) {
        const title = target.dataset.lectureTitle || "이 특강";
        if (!confirm(`'${title}' 특강을 삭제할까요?\n신청 내역도 함께 삭제되며 되돌릴 수 없습니다.`)) return;
        const result = await api(`/api/admin/lectures/${target.dataset.lectureDelete}`, { method: "DELETE" });
        if (state.editingLectureId === target.dataset.lectureDelete) state.editingLectureId = "";
        await refreshAdminPagePreservingScroll("adminLecturesPage");
        toast(`특강을 삭제했습니다.${result.removedApplications ? ` (신청 ${result.removedApplications}건 포함)` : ""}`, { preserveScroll: true });
        return;
      }
      if (target.dataset.adminBulkDelete) {
        const [kind = "", scope = "filtered"] = String(target.dataset.adminBulkDelete || "").split(":");
        await refreshAdminDataPreservingScroll();
        const config = currentBulkDeleteConfig(kind, scope);
        if (!config) return;
        const effectiveFilters = effectiveBulkFilters(config.filters);
        if (scope === "filtered" && !Object.keys(effectiveFilters).length) {
          toast("검색어, 학기, 유형, 상태 등 필터 조건을 먼저 선택하세요.", { preserveScroll: true });
          return;
        }
        if (!config.totalCount) {
          toast("삭제할 항목이 없습니다.", { preserveScroll: true });
          return;
        }
        if (scope === "filtered" && config.collectionTotal > 0 && config.totalCount === config.collectionTotal) {
          toast("현재 필터 결과가 전체 데이터와 같습니다. 전체 삭제 버튼을 사용하세요.", { preserveScroll: true });
          return;
        }
        let confirmText = "";
        if (scope === "all") {
          const input = prompt(`전체 데이터를 삭제하려면 확인 문구를 정확히 입력하세요.\n${FULL_DELETE_CONFIRM_TEXT}`, "");
          if (input === null) return;
          confirmText = input.trim();
          if (confirmText !== FULL_DELETE_CONFIRM_TEXT) {
            toast("전체 삭제를 취소했습니다.", { preserveScroll: true });
            return;
          }
        } else if (!confirm(`${config.filterLabel} 기준 ${config.totalCount}건을 삭제할까요?\n되돌릴 수 없습니다.`)) {
          return;
        }
        const result = await api(config.path, {
          method: "DELETE",
          body: {
            scope,
            filters: config.filters,
            confirmText
          }
        });
        await refreshAdminPagePreservingScroll(config.pageKey);
        toast(config.toastMessage(result), { preserveScroll: true });
        return;
      }
      if (target.dataset.blockedRemove) {
        const settings = state.bootstrap.settings;
        const blockedSchedules = (settings.blockedSchedules || []).filter((item) => item.id !== target.dataset.blockedRemove);
        await api("/api/admin/settings", { method: "PATCH", body: { blockedSchedules } });
        await refreshAdminDataPreservingScroll({ includeBootstrap: true });
        toast("차단 일정을 삭제했습니다.", { preserveScroll: true });
      }
      if (target.dataset.userSort) {
        const field = target.dataset.userSort;
        state.adminUserSort = {
          field,
          direction: state.adminUserSort.field === field && state.adminUserSort.direction === "asc" ? "desc" : "asc"
        };
        render();
        return;
      }
      if (target.dataset.adminReportSort) {
        const field = target.dataset.adminReportSort;
        const defaultDirection = field === "name" ? "asc" : "desc";
        state.adminReportSort = {
          field,
          direction: state.adminReportSort.field === field
            ? (state.adminReportSort.direction === "asc" ? "desc" : "asc")
            : defaultDirection
        };
        render();
        return;
      }
      if (target.dataset.userApproval) {
        const body = { approvalStatus: target.dataset.status };
        if (target.dataset.status === "blocked") {
          body.limitDuration = document.querySelector(`[data-user-limit-duration="${target.dataset.userApproval}"]`)?.value || "week1";
        }
        await api(`/api/admin/users/${target.dataset.userApproval}/approval`, { method: "PATCH", body });
        await refreshAdminDataPreservingScroll();
        toast("사용자 상태를 변경했습니다.", { preserveScroll: true });
      }
      if (target.dataset.userReset) {
        const input = prompt("새 비밀번호를 입력하세요. 비워두면 임시 비밀번호가 자동 생성됩니다.", "");
        if (input === null) return;
        const body = input.trim() ? { newPassword: input.trim() } : {};
        const result = await api(`/api/admin/users/${target.dataset.userReset}/password`, { method: "PATCH", body });
        if (result.generatedPassword) {
          alert(`임시 비밀번호: ${result.generatedPassword}\n학생에게 전달한 뒤 첫 로그인에서 변경하도록 안내하세요.`);
        } else {
          toast("비밀번호를 변경했습니다.", { preserveScroll: true });
        }
        return;
      }
      if (target.dataset.userWarn) {
        const reason = prompt("관리자용 경고 메모를 입력하세요. 학생 상태는 변경되지 않습니다.", "");
        if (reason === null) return;
        const result = await api(`/api/admin/users/${target.dataset.userWarn}/warning`, { method: "POST", body: { reason: reason.trim() } });
        await refreshAdminDataPreservingScroll();
        toast(`경고 메모를 저장했습니다. (기록 ${result.user.warningCount}건)`, { preserveScroll: true });
        return;
      }
      if (target.dataset.userWarnReset) {
        if (!confirm("이 학생의 경고 메모 기록을 초기화할까요? 대여금지 상태는 변경되지 않습니다.")) return;
        await api(`/api/admin/users/${target.dataset.userWarnReset}/warning`, { method: "POST", body: { reset: true } });
        await refreshAdminDataPreservingScroll();
        toast("경고 메모를 초기화했습니다.", { preserveScroll: true });
        return;
      }
      if (target.dataset.userDelete) {
        const name = target.dataset.userName || "이 학생";
        if (!confirm(`${name} 계정을 삭제할까요?\n해당 학생의 예약·보고서·경고 기록도 함께 삭제되며 되돌릴 수 없습니다.`)) return;
        const result = await api(`/api/admin/users/${target.dataset.userDelete}`, { method: "DELETE" });
        await refreshAdminDataPreservingScroll({ includeBootstrap: true });
        toast(`학생을 삭제했습니다.${result.removedReservations ? ` (예약 ${result.removedReservations}건 포함)` : ""}`, { preserveScroll: true });
        return;
      }
      if (target.dataset.warningPopupClose !== undefined) {
        state.warningPopupDismissed = true;
        render();
        return;
      }
      if (target.dataset.sessionRevoke) {
        if (!confirm("이 기기를 원격 로그아웃할까요?")) return;
        await api(`/api/admin/sessions/${target.dataset.sessionRevoke}/revoke`, { method: "POST" });
        state.adminSessions = state.adminSessions.filter((session) => session.id !== target.dataset.sessionRevoke);
        await refreshAdminDataPreservingScroll();
        toast("해당 기기를 로그아웃했습니다.", { preserveScroll: true });
        return;
      }
      if (target.dataset.resStatus) {
        if (target.dataset.status === "cancelled" && !confirm("예약을 대여취소로 변경할까요?")) return;
        toast("예약 상태를 처리 중입니다.", { preserveScroll: true });
        const updated = await api(`/api/admin/reservations/${target.dataset.resStatus}/status`, { method: "PATCH", body: { status: target.dataset.status } });
        state.adminReservations = state.adminReservations.map((reservation) => reservation.id === updated.id ? updated : reservation);
        toast("예약 상태를 변경했습니다.", { preserveScroll: true });
        try {
          await refreshAdminDataPreservingScroll({ includeBootstrap: true });
        } catch (error) {
          toast(`상태는 변경됐지만 최신 목록을 다시 불러오지 못했습니다: ${error.message}`, { preserveScroll: true });
        }
      }
      if (target.dataset.equipmentStatusAction) {
        const scrollState = captureScrollState();
        const itemId = target.dataset.equipmentStatusAction;
        const status = target.dataset.status;
        if (!status) return;
        target.disabled = true;
        let updated;
        try {
          const patch = status === "문의" ? { status: "가능", reservable: false, inquiryOnly: true } : { status };
          updated = await patchAdminEquipment([itemId], patch);
        } finally {
          target.disabled = false;
        }
        syncAdminEquipmentDom(updated);
        toast("기자재 상태를 변경했습니다.", { preserveScroll: true, scrollState });
        return;
      }
      if (target.dataset.equipmentBulkStatus) {
        const scrollState = captureScrollState();
        const ids = [...state.selectedAdminEquipmentIds];
        if (!ids.length) {
          toast("선택된 기자재가 없습니다.", { preserveScroll: true, scrollState });
          return;
        }
        const bulkStatus = target.dataset.equipmentBulkStatus;
        const patch = bulkStatus === "문의" ? { status: "가능", reservable: false, inquiryOnly: true } : { status: bulkStatus };
        const updated = await patchAdminEquipment(ids, patch);
        syncAdminEquipmentDom(updated);
        toast(`선택 기자재 ${updated.length}개의 상태를 변경했습니다.`, { preserveScroll: true, scrollState });
        return;
      }
      if (target.dataset.equipmentRemoveAdmin) {
        const scrollState = captureScrollState();
        if (!confirm("이 기자재를 제거할까요? 목록에서 숨겨지고 학생 예약에서도 제외됩니다.")) return;
        const updated = await patchAdminEquipment([target.dataset.equipmentRemoveAdmin], { active: false });
        syncAdminEquipmentDom(updated);
        toast("기자재를 제거했습니다.", { preserveScroll: true, scrollState });
        return;
      }
      if (target.dataset.equipmentBulkRemove !== undefined) {
        const scrollState = captureScrollState();
        const ids = [...state.selectedAdminEquipmentIds];
        if (!ids.length) {
          toast("선택된 기자재가 없습니다.", { preserveScroll: true, scrollState });
          return;
        }
        if (!confirm(`선택한 기자재 ${ids.length}개를 제거할까요? 목록에서 숨겨지고 학생 예약에서도 제외됩니다.`)) return;
        const updated = await patchAdminEquipment(ids, { active: false });
        syncAdminEquipmentDom(updated);
        toast(`선택 기자재 ${updated.length}개를 제거했습니다.`, { preserveScroll: true, scrollState });
        return;
      }
    } catch (error) {
      toast(error.message, { preserveScroll: true });
    }
  });
}
