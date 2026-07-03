import React from "react";

import {
  GjuCard,
  GjuEmptyState,
  GjuIcon,
  GjuStatusBadge,
  GjuTable
} from "../../design-system";
import type { LegacyState } from "../../platform/types";

type AdminUsersProps = {
  state: LegacyState;
};

type AdminUser = {
  id: string;
  role?: string;
  name?: string;
  email?: string;
  studentId?: string;
  studentStatus?: string;
  phone?: string;
  approvalStatus?: string;
  blockDuration?: string;
};

const USER_STATUS_FILTERS = [
  ["all", "전체"],
  ["approval_pending", "승인대기"],
  ["approved", "승인완료"],
  ["rejected", "반려"],
  ["blocked", "대여금지"]
] as const;

const USER_LIMIT_OPTIONS = [
  ["week1", "대여금지 · 1주일"],
  ["week2", "대여금지 · 2주일"],
  ["month1", "대여금지 · 1달"],
  ["semester", "대여금지 · 1학기"]
] as const;

function normalizeSearchText(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function asUsers(value: unknown): AdminUser[] {
  return Array.isArray(value) ? (value as AdminUser[]) : [];
}

function matchesUserQuery(user: AdminUser, query: string) {
  if (!query) return true;
  return [
    user.name,
    user.email,
    user.studentId,
    user.studentStatus,
    user.phone,
    user.approvalStatus
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function statusLabel(status: string) {
  return {
    approval_pending: "승인 대기",
    approved: "승인 완료",
    rejected: "반려",
    blocked: "대여금지"
  }[status] || status || "미정";
}

function statusTone(status: string) {
  switch (status) {
    case "approved":
      return "green" as const;
    case "approval_pending":
      return "amber" as const;
    case "rejected":
    case "blocked":
      return "red" as const;
    default:
      return "neutral" as const;
  }
}

function renderDeleteIcon() {
  return (
    <span aria-hidden="true" style={{ pointerEvents: "none", display: "inline-flex" }}>
      <GjuIcon name="trash" className="button-icon icon" />
    </span>
  );
}

function renderApprovalAction(user: AdminUser) {
  const approvedLike = user.approvalStatus === "approved" || user.approvalStatus === "blocked";

  if (approvedLike) {
    return (
      <button className="button danger compact" type="button" data-user-approval={user.id} data-status="rejected">
        반려
      </button>
    );
  }

  return (
    <button className="button primary compact" type="button" data-user-approval={user.id} data-status="approved">
      승인
    </button>
  );
}

export function AdminUsers({ state }: AdminUsersProps) {
  const query = normalizeSearchText(state.adminUserSearch);
  const activeFilter = String(state.adminUserStatusFilter || "all");
  const allUsers = asUsers(state.adminUsers).filter((user) => user.role !== "admin");
  const users = allUsers.filter((user) => {
    if (activeFilter !== "all" && user.approvalStatus !== activeFilter) {
      return false;
    }
    return matchesUserQuery(user, query);
  });

  return (
    <section className="grid">
      <GjuCard title="학생 승인" eyebrow="React Admin">
        <div className="list-control-panel">
          <input
            key={`admin-user-search:${String(state.adminUserSearch || "")}`}
            className="input"
            defaultValue={String(state.adminUserSearch || "")}
            placeholder="이름·학번·연락처·이메일 검색"
            aria-label="학생 검색"
            data-admin-user-search
          />
          <div className="tab-row wrap" role="tablist" aria-label="학생 승인 상태 필터">
            {USER_STATUS_FILTERS.map(([key, label]) => (
              <button
                key={key}
                className={`tab-button ${activeFilter === key ? "active" : ""}`}
                type="button"
                data-admin-user-status-filter={key}
                aria-current={activeFilter === key ? "true" : undefined}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="muted list-page-summary">현재 {users.length}건 표시 / 전체 {allUsers.length}건</p>
        <div className="table-wrap admin-user-table-wrap">
          <GjuTable className="admin-user-table">
            <thead>
              <tr>
                <th className="admin-user-name-head">이름</th>
                <th>학번</th>
                <th>신분</th>
                <th>연락처</th>
                <th className="admin-user-status-head">상태</th>
              </tr>
            </thead>
            <tbody>
              {users.length ? (
                users.map((user) => (
                  <React.Fragment key={user.id}>
                    <tr className="admin-user-info-row">
                      <td className="admin-user-identity" data-label="이름">
                        <strong className="admin-user-name" title={user.name || ""}>
                          {user.name || "-"}
                        </strong>
                        <span className="admin-user-email" title={user.email || ""}>
                          {user.email || ""}
                        </span>
                      </td>
                      <td data-label="학번">{user.studentId || "-"}</td>
                      <td data-label="신분">{user.studentStatus || "-"}</td>
                      <td data-label="연락처">{user.phone || "-"}</td>
                      <td className="admin-user-status-cell" data-label="상태">
                        <GjuStatusBadge tone={statusTone(String(user.approvalStatus || ""))}>
                          {statusLabel(String(user.approvalStatus || ""))}
                        </GjuStatusBadge>
                      </td>
                    </tr>
                    <tr className="admin-user-actions-row">
                      <td colSpan={5}>
                        <div className="admin-user-action-panel">
                          <div className="admin-user-action-group admin-user-core-group">
                            {renderApprovalAction(user)}
                          </div>
                          <div className="admin-user-action-group admin-user-limit-group">
                            <select
                              key={`user-limit:${user.id}:${user.approvalStatus || ""}:${user.blockDuration || ""}`}
                              className="select compact-select"
                              defaultValue={
                                user.approvalStatus === "blocked" && user.blockDuration
                                  ? user.blockDuration
                                  : ""
                              }
                              aria-label={`${user.name || "학생"} 대여금지 기간`}
                              data-user-limit-duration={user.id}
                            >
                              <option value="">대여금지 설정</option>
                              {user.approvalStatus === "blocked" ? <option value="unblock">대여금지 해제</option> : null}
                              {USER_LIMIT_OPTIONS.map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="admin-user-action-group admin-user-secondary-group">
                            <button className="button compact admin-user-small-action" type="button" data-user-reset={user.id}>
                              비번 리셋
                            </button>
                            <button
                              className="button danger compact admin-user-delete-button icon-only-action"
                              type="button"
                              data-user-delete={user.id}
                              data-user-name={user.name || ""}
                              aria-label="삭제"
                              title="삭제"
                            >
                              {renderDeleteIcon()}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>
                    <GjuEmptyState
                      title={query ? "검색 결과가 없습니다." : "학생이 없습니다."}
                      message={query ? "검색어를 지우거나 상태 필터를 변경하세요." : undefined}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </GjuTable>
        </div>
      </GjuCard>
    </section>
  );
}
