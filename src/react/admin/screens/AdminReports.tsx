import React from "react";

import { GjuCard, GjuEmptyState, GjuStatusBadge, GjuTable, GjuTabs } from "../../design-system";
import type { AdminReportRecord, LegacyState, ReactAdminActions } from "../../platform/types";
import {
  bulkDeleteAvailability,
  formatDateTime,
  property,
  renderPager,
  runAdminAction,
  semesterOptions,
  stopSubmit,
  userLabel
} from "./adminScreenUtils";

type AdminReportsProps = {
  state: LegacyState;
  actions: ReactAdminActions;
};

function reportTitle(report: AdminReportRecord) {
  const fields = report.reservation?.fields || {};
  const date = String(fields.reservedDate || "");
  const space = String(fields.studioSpace || (fields.studioSpaces || []).join(", ") || "");
  return report.title || report.projectTitle || report.reservation?.title || [date, space].filter(Boolean).join(" · ") || report.reservationId || report.id;
}

function reportSemester(report: AdminReportRecord) {
  if (report.semester) return report.semester;
  const date = String(report.reservation?.fields?.reservedDate || report.submittedAt || "").slice(0, 10);
  const match = date.match(/^(\d{4})-(\d{2})/);
  if (!match) return "-";
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month >= 3 && month <= 8) return `${year}년 1학기`;
  if (month >= 9) return `${year}년 2학기`;
  return `${year - 1}년 2학기`;
}

function reportStatusLabel(status: string) {
  return {
    submitted: "제출",
    missing: "미제출",
    reviewed: "확인",
    rejected: "반려"
  }[status] || status || "미정";
}

function reportStatus(report: AdminReportRecord) {
  return String(report.status || (report.submittedAt || report.createdAt ? "submitted" : "missing"));
}

function reportField(report: AdminReportRecord, key: string) {
  return report.fields?.[key] ?? (report as unknown as Record<string, unknown>)[key];
}

function reportEquipment(value: unknown) {
  if (!Array.isArray(value)) return String(value || "-");
  const items = value.map((item) => {
    if (typeof item === "string") return item;
    if (!item || typeof item !== "object") return "";
    const equipment = item as { name?: string; code?: string; label?: string };
    return [equipment.code, equipment.name || equipment.label].filter(Boolean).join(" ");
  }).filter(Boolean);
  return items.join(", ") || "-";
}

function reportPhoto(value: unknown) {
  const url = String(value || "").trim();
  if (!url) return "-";
  if (!/^https?:\/\//i.test(url)) return url;
  return <a href={url} target="_blank" rel="noreferrer">{url}</a>;
}

function reportDetails(report: AdminReportRecord) {
  if (report.isMissing) {
    return <p className="muted">학생 보고서 제출을 기다리고 있습니다.</p>;
  }
  const damageFound = reportField(report, "damageFound") === true;
  return (
    <dl className="property-list compact admin-report-detail-list">
      {property("사용 시간", String(reportField(report, "actualTime") || "-"))}
      {property("참여 인원", String(reportField(report, "participants") || "-"))}
      {property("사용 장비", reportEquipment(reportField(report, "usedEquipment")))}
      {property("결과 사진", reportPhoto(reportField(report, "resultPhotoUrl")))}
      {property("정리 확인", reportField(report, "cleanupConfirmed") === true ? "확인" : "미확인")}
      {property("파손/이상", damageFound ? "발견" : "없음")}
      {damageFound ? property("파손 상세", String(reportField(report, "damageDescription") || "내용 없음")) : null}
      {property("비고", String(reportField(report, "notes") || "-"))}
    </dl>
  );
}

function reportTone(status: string) {
  if (status === "submitted" || status === "reviewed") return "green" as const;
  if (status === "missing") return "amber" as const;
  if (status === "rejected") return "red" as const;
  return "neutral" as const;
}

function bulkDeleteReports(state: LegacyState, actions: ReactAdminActions) {
  runAdminAction(() => actions.bulkDeleteReports({
    status: state.adminReportStatusFilter || "all",
    semester: state.adminReportSemesterFilter || "all",
    q: state.adminReportSearch || ""
  }));
}

export function AdminReports({ state, actions }: AdminReportsProps) {
  const statusFilter = String(state.adminReportStatusFilter || "all");
  const semesterFilter = String(state.adminReportSemesterFilter || "all");
  const semesters = semesterOptions(state.adminReportSemesters);
  const reportSort = state.adminReportSort || { field: "submittedAt", direction: "desc" as const };
  const reports = state.adminReports || [];
  const deleteFilters = {
    status: statusFilter,
    semester: semesterFilter,
    q: state.adminReportSearch || ""
  };
  const persistedReportPage = {
    ...state.adminReportsPage,
    total: Number(state.adminReportsPage?.persistedTotal ?? state.adminReportsPage?.total ?? 0),
    collectionTotal: Number(state.adminReportsPage?.persistedCollectionTotal ?? state.adminReportsPage?.collectionTotal ?? 0)
  };
  const deleteAvailability = bulkDeleteAvailability(persistedReportPage, deleteFilters);
  const canDeleteReports = statusFilter !== "missing";

  const submitSearch = stopSubmit((form) => {
    void actions.setAdminFilters("reports", {
      q: String(new FormData(form).get("q") || ""),
      page: 1
    });
  });

  const setSemester = (semester: string) => {
    void actions.setAdminFilters("reports", { semester, page: 1 });
  };
  const setStatus = (status: string) => {
    void actions.setAdminFilters("reports", { status, page: 1 });
  };
  const setSort = (field: "title" | "name" | "status" | "submittedAt") => {
    const direction = reportSort.field === field && reportSort.direction === "asc" ? "desc" : "asc";
    void actions.setAdminFilters("reports", { sort: field, direction, page: 1 });
  };

  return (
    <section className="grid admin-react-screen">
      <GjuCard
        title="보고서"
        surface="workspace"
        actions={<span className="tag blue">{reports.length}건</span>}
      >
        <form className="list-control-panel compact admin-react-toolbar" onSubmit={submitSearch}>
          <label>
            <span className="sr-only">보고서 검색</span>
            <input
              className="input"
              name="q"
              defaultValue={String(state.adminReportSearch || "")}
              placeholder="학생·제목·상태 검색"
            />
          </label>
          <button className="button primary compact" type="submit">
            검색
          </button>
        </form>
        <GjuTabs
          id="admin-report-status-tabs"
          ariaLabel="보고서 상태"
          className="tab-row"
          tabClassName="tab-button"
          items={[
            { key: "all", label: "전체" },
            { key: "missing", label: "제출 대기" },
            { key: "submitted", label: "제출 완료" }
          ]}
          activeKey={statusFilter}
          onChange={setStatus}
        />
        <GjuTabs
          id="admin-report-semester-tabs"
          ariaLabel="보고서 학기"
          className="tab-row"
          tabClassName="tab-button"
          items={[{ key: "all", label: "전체" }, ...semesters]}
          activeKey={semesterFilter}
          onChange={setSemester}
        />
        {canDeleteReports && deleteAvailability.collectionTotal > 0 ? <div className="admin-react-danger-row">
          <button className="button danger compact" type="button" disabled={deleteAvailability.filteredDisabled} onClick={() => bulkDeleteReports(state, actions)}>
            필터 결과 보고서 삭제
          </button>
          <button className="button danger compact" type="button" disabled={deleteAvailability.allDisabled} onClick={() => runAdminAction(() => actions.deleteAllReports(deleteAvailability.collectionTotal))}>
            전체 보고서 삭제
          </button>
        </div> : null}
        <div className="table-wrap embedded admin-react-desktop-table">
          <GjuTable>
            <thead>
              <tr>
                <th><button className="table-sort" type="button" onClick={() => setSort("title")}>보고서</button></th>
                <th><button className="table-sort" type="button" onClick={() => setSort("name")}>학생</button></th>
                <th>학기</th>
                <th><button className="table-sort" type="button" onClick={() => setSort("status")}>상태</button></th>
                <th><button className="table-sort" type="button" onClick={() => setSort("submittedAt")}>제출일</button></th>
                <th>사용 상세</th>
              </tr>
            </thead>
            <tbody>
              {reports.length ? (
                reports.map((report) => (
                  <tr key={report.id}>
                    <td>{reportTitle(report)}</td>
                    <td>{userLabel(report.user || report.reservation?.user || report.reservation?.student)}</td>
                    <td>{reportSemester(report)}</td>
                    <td>
                      <GjuStatusBadge tone={reportTone(reportStatus(report))}>
                        {reportStatusLabel(reportStatus(report))}
                      </GjuStatusBadge>
                    </td>
                    <td>{formatDateTime(report.submittedAt || report.createdAt)}</td>
                    <td>{reportDetails(report)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    <GjuEmptyState title="보고서가 없습니다." message="검색어와 학기 필터를 확인하세요." />
                  </td>
                </tr>
              )}
            </tbody>
          </GjuTable>
        </div>
        <div className="admin-react-card-list" aria-label="보고서 목록">
          {reports.length ? reports.map((report) => (
            <article key={report.id} className="admin-react-list-card">
              <div className="reservation-card-head">
                <div>
                  <strong>{reportTitle(report)}</strong>
                  <span>{userLabel(report.user || report.reservation?.user || report.reservation?.student)}</span>
                </div>
                <GjuStatusBadge tone={reportTone(reportStatus(report))}>
                  {reportStatusLabel(reportStatus(report))}
                </GjuStatusBadge>
              </div>
              <dl className="property-list">
                {property("학기", reportSemester(report))}
                {property("예약", report.reservationId || report.reservation?.id || "-")}
                {property("제출일", formatDateTime(report.submittedAt || report.createdAt))}
              </dl>
              {reportDetails(report)}
            </article>
          )) : <GjuEmptyState title="보고서가 없습니다." message="검색어와 학기 필터를 확인하세요." />}
        </div>
        {renderPager(actions, state.adminReportsPage, "reports", "보고서 페이지 이동")}
      </GjuCard>
    </section>
  );
}
