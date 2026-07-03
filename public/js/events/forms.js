import { state } from "../state.js?v=20260703-react-astryx-admin";
import { api } from "../api.js?v=20260703-react-astryx-admin";
import { loadBootstrap, loadMyReservations } from "../data.js?v=20260703-react-astryx-admin";
import {
  changePassword,
  deleteAccount,
  login,
  signup,
  submitReservation
} from "../actions.js?v=20260703-react-astryx-admin";
import { render, toast } from "../renderer.js?v=20260703-react-astryx-admin";
import { equipmentCategories, formData, parseCsv } from "../utils.js?v=20260703-react-astryx-admin";
import { refreshAdminDataPreservingScroll } from "./shared.js?v=20260703-react-astryx-admin";

export function setupFormEventHandlers() {
  document.addEventListener("change", async (event) => {
    const target = event.target;
    if (target.dataset && target.dataset.userLimitDuration !== undefined) {
      const userId = target.dataset.userLimitDuration;
      const limitDuration = target.value;
      if (!limitDuration) return;
      const body = limitDuration === "unblock"
        ? { approvalStatus: "approved" }
        : { approvalStatus: "blocked", limitDuration };
      try {
        await api(`/api/admin/users/${userId}/approval`, {
          method: "PATCH",
          body
        });
        await refreshAdminDataPreservingScroll();
        toast(limitDuration === "unblock" ? "대여금지를 해제했습니다." : "대여금지를 적용했습니다.", { preserveScroll: true });
      } catch (error) {
        toast(error.message || "대여금지 설정 변경에 실패했습니다.", { preserveScroll: true });
        await refreshAdminDataPreservingScroll();
      }
    }
  });

  document.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    try {
      if (form.dataset.form === "login") await login(form);
      if (form.dataset.form === "signup") await signup(form);
      if (form.dataset.form === "password-change") {
        await changePassword(form);
        return;
      }
      if (form.dataset.form === "account-delete") {
        await deleteAccount(form);
        return;
      }
      if (form.dataset.form === "profile-edit") {
        const result = await api("/api/me", { method: "PATCH", body: formData(form) });
        state.user = result.user;
        toast("개인정보를 저장했습니다.");
        render();
        return;
      }
      if (form.dataset.form === "reservation") await submitReservation(form);
      if (form.dataset.form === "equipment-add") {
        const data = formData(form);
        data.quantity = Number(data.quantity || 1);
        await api("/api/admin/equipment", { method: "POST", body: data });
        await refreshAdminDataPreservingScroll({ includeBootstrap: true });
        toast("장비를 추가했습니다.", { preserveScroll: true });
      }
      if (form.dataset.form === "equipment-category-add") {
        const data = formData(form);
        const next = [...new Set([...(state.bootstrap.settings.equipmentCategories || equipmentCategories()), data.categoryName.trim()].filter(Boolean))];
        await api("/api/admin/settings", { method: "PATCH", body: { equipmentCategories: next } });
        await refreshAdminDataPreservingScroll({ includeBootstrap: true });
        toast("카테고리를 추가했습니다.", { preserveScroll: true });
      }
      if (form.dataset.form === "equipment-import") {
        const rows = state.csvPreviewRows.length ? state.csvPreviewRows : parseCsv(formData(form).csv || "");
        await api("/api/admin/equipment/import", { method: "POST", body: { rows } });
        state.csvPreviewRows = [];
        await refreshAdminDataPreservingScroll({ includeBootstrap: true });
        toast("CSV 장비를 등록했습니다.", { preserveScroll: true });
      }
      if (form.dataset.form === "notice-add") {
        const data = formData(form);
        data.pinned = data.pinned === "true";
        await api("/api/admin/notices", { method: "POST", body: data });
        await refreshAdminDataPreservingScroll();
        toast("공지사항을 게시했습니다.", { preserveScroll: true });
      }
      if (form.dataset.form === "lecture-add") {
        const data = formData(form);
        data.capacity = Number(data.capacity || 0);
        await api("/api/admin/lectures", { method: "POST", body: data });
        form.reset();
        await refreshAdminDataPreservingScroll();
        toast("특강을 등록했습니다.", { preserveScroll: true });
      }
      if (form.dataset.form === "lecture-edit") {
        const data = formData(form);
        data.capacity = Number(data.capacity || 0);
        await api(`/api/admin/lectures/${form.dataset.lectureId}`, { method: "PATCH", body: data });
        state.editingLectureId = "";
        await refreshAdminDataPreservingScroll();
        toast("특강을 수정했습니다.", { preserveScroll: true });
        return;
      }
      if (form.dataset.form === "studio-report") {
        const data = formData(form);
        data.reservationId = form.dataset.reservationId;
        data.cleanupConfirmed = data.cleanupConfirmed === "true";
        data.damageFound = data.damageFound === "true";
        await api("/api/reports/studio", { method: "POST", body: data });
        state.activeReportReservationId = "";
        await loadBootstrap();
        await loadMyReservations();
        toast("스튜디오 보고서가 제출되었습니다.");
        render();
      }
      if (form.dataset.form === "settings-save") {
        const data = formData(form);
        data.darkroomCapacity = Number(data.darkroomCapacity || 6);
        data.equipmentHighValueCategories = String(data.equipmentHighValueCategories || "").split(",").map((item) => item.trim()).filter(Boolean);
        data.equipmentBagKeywords = String(data.equipmentBagKeywords || "").split(",").map((item) => item.trim()).filter(Boolean);
        await api("/api/admin/settings", { method: "PATCH", body: data });
        await refreshAdminDataPreservingScroll({ includeBootstrap: true });
        toast("설정을 저장했습니다.", { preserveScroll: true });
      }
      if (form.dataset.form === "blocked-schedule-add") {
        const data = formData(form);
        const blockedSchedules = [
          ...(state.bootstrap.settings.blockedSchedules || []),
          {
            id: `block_${Date.now()}`,
            type: data.type,
            day: data.day,
            from: data.from,
            to: data.to,
            start: data.start,
            end: data.end,
            target: data.target || ""
          }
        ];
        await api("/api/admin/settings", { method: "PATCH", body: { blockedSchedules } });
        await refreshAdminDataPreservingScroll({ includeBootstrap: true });
        toast("차단 일정을 추가했습니다.", { preserveScroll: true });
      }
    } catch (error) {
      toast(error.message, { preserveScroll: true });
    }
  });
}
