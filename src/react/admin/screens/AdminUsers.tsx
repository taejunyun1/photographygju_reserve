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

type AdminUserWarningRecord = {
  id: string;
  reason?: string;
  count?: number;
  createdAt?: string;
};

type AdminUser = {
  id: string;
  role?: string;
  name?: string;
  email?: string;
  studentId?: string;
  grade?: string;
  studentStatus?: string;
  phone?: string;
  approvalStatus?: string;
  blockDuration?: string;
  blockedUntil?: string;
  warningCount?: number;
  warningRecords?: AdminUserWarningRecord[];
};

type AdminUserSortField = "name" | "studentId" | "studentStatus" | "approvalStatus";

type AdminUserSortState = {
  field: AdminUserSortField;
  direction: "asc" | "desc";
};

type AdminUsersPageState = {
  total?: number;
  page?: number;
  pageSize?: number;
  hasMore?: boolean;
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

function asWarningRecords(value: unknown): AdminUserWarningRecord[] {
  return Array.isArray(value) ? (value as AdminUserWarningRecord[]) : [];
}

function warningSearchText(user: AdminUser) {
  return asWarningRecords(user.warningRecords)
    .flatMap((record) => [record.reason, record.createdAt, record.count])
    .filter(Boolean)
    .join(" ");
}

function matchesUserQuery(user: AdminUser, query: string) {
  if (!query) return true;
  return [
    user.name,
    user.email,
    user.studentId,
    user.grade,
    user.studentStatus,
    user.phone,
    user.approvalStatus,
    statusLabel(String(user.approvalStatus || "")),
    user.blockedUntil,
    warningSearchText(user)
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

function getUsersPageState(state: LegacyState): AdminUsersPageState {
  const page = state.adminUsersPage;
  return page && typeof page === "object" ? (page as AdminUsersPageState) : {};
}

function getUserSortState(state: LegacyState): AdminUserSortState {
  const sort = state.adminUserSort;
  if (sort && typeof sort === "object") {
    const field = (sort as { field?: AdminUserSortField }).field;
    const direction = (sort as { direction?: "asc" | "desc" }).direction;
    if (field && direction) {
      return { field, direction };
    }
  }
  return { field: "approvalStatus", direction: "asc" };
}

function userSortValue(user: AdminUser, field: AdminUserSortField) {
  if (field === "approvalStatus") return statusLabel(String(user.approvalStatus || ""));
  return String(user[field] || "");
}

function sortUsers(users: AdminUser[], sortState: AdminUserSortState) {
  const multiplier = sortState.direction === "desc" ? -1 : 1;
  return [...users].sort((left, right) => (
    userSortValue(left, sortState.field).toLocaleLowerCase().localeCompare(
      userSortValue(right, sortState.field).toLocaleLowerCase(),
      "ko"
    ) * multiplier
  ));
}

function sortButtonClassName(active: boolean) {
  return `table-sort ${active ? "active" : ""}`;
}

function renderUserSortButton(sortState: AdminUserSortState, field: AdminUserSortField, label: string) {
  const active = sortState.field === field;
  const directionLabel = active ? (sortState.direction === "asc" ? " ↑" : " ↓") : "";
  return (
    <button className={sortButtonClassName(active)} type="button" data-user-sort={field}>
      {label}
      {directionLabel}
    </button>
  );
}

function totalPages(page: AdminUsersPageState) {
  const total = Number(page.total || 0);
  const pageSize = Number(page.pageSize || 100) || 100;
  return Math.max(1, Math.ceil(total / pageSize));
}

function visiblePageItems(currentPage: number, pageCount: number) {
  const items: Array<number | "ellipsis"> = [];
  for (let index = 1; index <= pageCount; index += 1) {
    if (pageCount > 7 && index !== 1 && index !== pageCount && Math.abs(index - currentPage) > 1) {
      if (items[items.length - 1] !== "ellipsis") items.push("ellipsis");
      continue;
    }
    items.push(index);
  }
  return items;
}

function renderUsersPager(page: AdminUsersPageState) {
  const pageCount = totalPages(page);
  if (pageCount <= 1) return null;
  const currentPage = Math.max(1, Number(page.page || 1));
  return (
    <nav className="pagination admin-list-pagination" aria-label="페이지 이동">
      <button
        className="button compact pagination-button"
        type="button"
        data-admin-users-page={Math.max(1, currentPage - 1)}
        disabled={currentPage <= 1}
      >
        이전
      </button>
      {visiblePageItems(currentPage, pageCount).map((item, index) => (
        item === "ellipsis" ? (
          <span key={`ellipsis:${index}`} className="pagination-summary">
            ...
          </span>
        ) : (
          <button
            key={item}
            className={`button compact pagination-button ${item === currentPage ? "is-active" : ""}`}
            type="button"
            data-admin-users-page={item}
            aria-current={item === currentPage ? "page" : "false"}
          >
            {item}
          </button>
        )
      ))}
      <button
        className="button compact pagination-button"
        type="button"
        data-admin-users-page={Math.min(pageCount, currentPage + 1)}
        disabled={currentPage >= pageCount}
      >
        다음
      </button>
    </nav>
  );
}

function renderDeleteIcon() {
  return (
    <span aria-hidden="true" style={{ pointerEvents: "none", display: "inline-flex" }}>
      <GjuIcon name="trash" className="button-icon icon" />
    </span>
  );
}

function renderPlusIcon() {
  return <GjuIcon name="plus" className="button-icon icon" />;
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

function formatDateTime(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function renderWarningMemo(user: AdminUser) {
  const records = asWarningRecords(user.warningRecords);

  if (!records.length) {
    return (
      <div className="admin-user-warning-memo is-empty">
        <div className="admin-user-warning-memo-head">
          <strong>경고 메모 기록 없음</strong>
          <button className="button warn compact admin-user-memo-add" type="button" data-user-warn={user.id}>
            {renderPlusIcon()}
            메모 추가
          </button>
        </div>
        <span>저장된 메모가 없습니다.</span>
      </div>
    );
  }

  const latest = records[0];
  const date = formatDateTime(latest.createdAt);
  const count = Math.max(0, Number(user.warningCount || records.length || 0));

  return (
    <div className="admin-user-warning-memo">
      <div className="admin-user-warning-memo-head">
        <strong>최근 경고 메모 {count}건</strong>
        <div className="admin-user-warning-actions">
          <button className="button warn compact admin-user-memo-add" type="button" data-user-warn={user.id}>
            {renderPlusIcon()}
            메모 추가
          </button>
          <button className="button ghost compact admin-user-memo-reset" type="button" data-user-warn-reset={user.id}>
            초기화
          </button>
        </div>
      </div>
      <span>
        {date}
        {date ? " · " : ""}
        {latest.reason || "사유 없음"}
      </span>
    </div>
  );
}

function renderUserLimitSelect(user: AdminUser, keyPrefix = "user-limit") {
  return (
    <select
      key={`${keyPrefix}:${user.id}:${user.approvalStatus || ""}:${user.blockDuration || ""}`}
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
  );
}

function renderUserSecondaryActions(user: AdminUser) {
  return (
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
  );
}

function renderUserMobileCard(user: AdminUser) {
  return (
    <article className="admin-user-mobile-card" data-user-mobile-card={user.id}>
      <div className="admin-user-mobile-head">
        <div className="admin-user-mobile-identity">
          <strong className="admin-user-name" title={user.name || ""}>
            {user.name || "-"}
          </strong>
          <span className="admin-user-email" title={user.email || ""}>
            {user.email || ""}
          </span>
        </div>
        <GjuStatusBadge tone={statusTone(String(user.approvalStatus || ""))}>
          {statusLabel(String(user.approvalStatus || ""))}
        </GjuStatusBadge>
      </div>
      <dl className="admin-user-mobile-meta">
        <div>
          <dt>학번</dt>
          <dd>{user.studentId || "-"}</dd>
        </div>
        <div>
          <dt>신분</dt>
          <dd>{user.studentStatus || "-"}</dd>
        </div>
        <div>
          <dt>연락처</dt>
          <dd>{user.phone || "-"}</dd>
        </div>
        <div>
          <dt>상태</dt>
          <dd>{statusLabel(String(user.approvalStatus || ""))}</dd>
        </div>
      </dl>
      <div className="admin-user-mobile-actions">
        <div className="admin-user-action-group admin-user-core-group">
          {renderApprovalAction(user)}
        </div>
        <div className="admin-user-action-group admin-user-limit-group">
          {renderUserLimitSelect(user, "mobile-user-limit")}
        </div>
        {renderWarningMemo(user)}
        {renderUserSecondaryActions(user)}
      </div>
    </article>
  );
}

export function AdminUsers({ state }: AdminUsersProps) {
  const query = normalizeSearchText(state.adminUserSearch);
  const activeFilter = String(state.adminUserStatusFilter || "all");
  const sortState = getUserSortState(state);
  const page = getUsersPageState(state);
  const allUsers = asUsers(state.adminUsers).filter((user) => user.role !== "admin");
  const filteredUsers = allUsers.filter((user) => {
    if (activeFilter !== "all" && user.approvalStatus !== activeFilter) {
      return false;
    }
    return matchesUserQuery(user, query);
  });
  const users = sortUsers(filteredUsers, sortState);
  const total = Number(page.total || allUsers.length || 0);
  const shown = Math.min(allUsers.length, total);

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
        <p className="muted list-page-summary">
          현재 {shown}건 표시 / 전체 {total}건
          {query ? ` · 검색 결과 ${users.length}건(현재 표시 데이터 기준)` : ""}
          {page.hasMore ? " · 다음 페이지에 기록이 더 있습니다" : ""}
        </p>
        <div className="table-wrap admin-user-table-wrap">
          <GjuTable className="admin-user-table">
            <thead>
              <tr>
                <th className="admin-user-name-head">{renderUserSortButton(sortState, "name", "이름")}</th>
                <th>{renderUserSortButton(sortState, "studentId", "학번")}</th>
                <th>{renderUserSortButton(sortState, "studentStatus", "신분")}</th>
                <th>연락처</th>
                <th className="admin-user-status-head">{renderUserSortButton(sortState, "approvalStatus", "상태")}</th>
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
                            {renderUserLimitSelect(user)}
                          </div>
                          {renderWarningMemo(user)}
                          {renderUserSecondaryActions(user)}
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
        <div className="admin-user-mobile-list" aria-label="학생 승인 모바일 목록">
          {users.length ? (
            users.map((user) => <React.Fragment key={`mobile:${user.id}`}>{renderUserMobileCard(user)}</React.Fragment>)
          ) : (
            <GjuEmptyState
              title={query ? "검색 결과가 없습니다." : "학생이 없습니다."}
              message={query ? "검색어를 지우거나 상태 필터를 변경하세요." : undefined}
            />
          )}
        </div>
        {renderUsersPager(page)}
      </GjuCard>
    </section>
  );
}
