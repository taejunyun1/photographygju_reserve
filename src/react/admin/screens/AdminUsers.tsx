import React, { useState } from "react";

import {
  GjuCard,
  GjuDialog,
  GjuEmptyState,
  GjuIconButton,
  GjuStatusBadge,
  GjuTable,
  GjuTabs,
  gjuTabId
} from "../../design-system";
import type { AdminWarningRecord, LegacyState, ReactAdminActions } from "../../platform/types";
import { runAdminAction } from "./adminScreenUtils";

type AdminUsersProps = {
  state: LegacyState;
  actions: ReactAdminActions;
};

type AdminUserWarningRecord = AdminWarningRecord & { count?: number };

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

type AdminUserSortField = "name" | "studentId" | "studentStatus" | "approvalStatus" | "createdAt";

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

function asUsers(value: unknown): AdminUser[] {
  return Array.isArray(value) ? (value as AdminUser[]) : [];
}

function asWarningRecords(value: unknown): AdminUserWarningRecord[] {
  return Array.isArray(value) ? (value as AdminUserWarningRecord[]) : [];
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
  return { field: "createdAt", direction: "desc" };
}

function sortButtonClassName(active: boolean) {
  return `table-sort ${active ? "active" : ""}`;
}

function renderUserSortButton(
  sortState: AdminUserSortState,
  field: AdminUserSortField,
  label: string,
  onSort: (field: AdminUserSortField) => void
) {
  const active = sortState.field === field;
  const directionLabel = active ? (sortState.direction === "asc" ? " ↑" : " ↓") : "";
  return (
    <button className={sortButtonClassName(active)} type="button" onClick={() => onSort(field)}>
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

function renderUsersPager(page: AdminUsersPageState, onPage: (page: number) => void) {
  const pageCount = totalPages(page);
  if (pageCount <= 1) return null;
  const currentPage = Math.max(1, Number(page.page || 1));
  return (
    <nav className="pagination admin-list-pagination" aria-label="페이지 이동">
      <button
        className="button compact pagination-button"
        type="button"
        disabled={currentPage <= 1}
        onClick={() => onPage(Math.max(1, currentPage - 1))}
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
            aria-current={item === currentPage ? "page" : "false"}
            onClick={() => onPage(item)}
          >
            {item}
          </button>
        )
      ))}
      <button
        className="button compact pagination-button"
        type="button"
        disabled={currentPage >= pageCount}
        onClick={() => onPage(Math.min(pageCount, currentPage + 1))}
      >
        다음
      </button>
    </nav>
  );
}

function renderPasswordResetButton(user: AdminUser, actions: ReactAdminActions) {
  return (
    <GjuIconButton
      className="admin-user-small-action"
      label="비밀번호 초기화"
      icon="refresh"
      onClick={() => runAdminAction(() => actions.resetUserPassword(user.id))}
    />
  );
}

function renderUserDeleteButton(user: AdminUser, actions: ReactAdminActions) {
  return (
    <GjuIconButton
      className="admin-user-delete-button"
      label="학생 삭제"
      icon="trash"
      tone="danger"
      onClick={() => runAdminAction(() => actions.deleteUser(user.id, user.name))}
    />
  );
}

function renderApprovalAction(user: AdminUser, actions: ReactAdminActions) {
  const approvedLike = user.approvalStatus === "approved" || user.approvalStatus === "blocked";

  if (approvedLike) {
    return (
      <GjuIconButton
        label="학생 반려"
        icon="x"
        tone="danger"
        onClick={() => runAdminAction(() => actions.setUserApproval(user.id, "rejected"))}
      />
    );
  }

  return (
    <GjuIconButton
      label="학생 승인"
      icon="check"
      tone="success"
      onClick={() => runAdminAction(() => actions.setUserApproval(user.id, "approved"))}
    />
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

function WarningMemo({ user, actions }: { user: AdminUser; actions: ReactAdminActions }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AdminWarningRecord[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const labels = { pending_review: "미반납 · 확인 대기", confirmed: "확정 · 유지", cleared: "해제" };
  const load = async (nextPage: number) => {
    setLoading(true);
    try {
      const result = await actions.loadAdminWarnings({ userId: user.id, page: nextPage });
      setItems(result.items); setPage(result.page); setTotal(result.total); setPageSize(result.pageSize); setOpen(true);
    } catch { actions.notify("경고 기록을 불러오지 못했습니다.", "error"); }
    finally { setLoading(false); }
  };
  const review = async (record: AdminWarningRecord) => {
    if (!record.actualReturnedAt) { actions.setAdminView("reservations", { q: record.reservationId || "" }); setOpen(false); return; }
    const value = prompt("확인한 실제 반납 시각 (Asia/Seoul, YYYY-MM-DDTHH:mm[:ss])", new Date(Date.parse(record.actualReturnedAt) + 9 * 3600000).toISOString().slice(0, 19));
    if (!value) return;
    const actual = new Date(`${value}+09:00`);
    if (!Number.isFinite(actual.getTime())) { actions.notify("반납 시각 형식을 확인하세요.", "error"); return; }
    const reason = prompt("반납 시각 확인 사유 (필수). 실제 지각은 경고가 유지됩니다.", "");
    if (!reason?.trim()) return;
    try { await actions.reviewEquipmentWarning(record.id, { actualReturnedAt: actual.toISOString(), reason: reason.trim() }); await load(page); } catch { /* bridge reports mutation errors */ }
  };
  const records = asWarningRecords(user.warningRecords);
  return <div className="admin-user-warning-memo">
    <strong>유효 경고 {user.warningCount ?? records.filter((item) => item.status !== "cleared").length}건</strong>
    {records.map((record) => <div key={record.id}>{record.status ? labels[record.status] : "수동 경고"} · {record.reason || "사유 없음"}</div>)}
    <button type="button" className="btn" disabled={loading} onClick={() => void load(1)}>전체 경고 기록·개별 심사</button>
    <GjuIconButton label="메모 추가" icon="plus" onClick={() => runAdminAction(() => actions.warnUser(user.id))} />
    <GjuIconButton label="수동 메모 초기화" icon="refresh" onClick={() => runAdminAction(() => actions.resetUserWarnings(user.id))} />
    {open ? <GjuDialog open title={`${user.name || "학생"} · 전체 경고 ${total}건`} onClose={() => setOpen(false)} showActions={false}>
      {items.map((record) => <article key={record.id}>
        <strong>{record.status ? labels[record.status] : "수동 경고"}</strong><p>{record.reason}</p>
        {record.source === "equipment_overdue" ? <>
          <p>예약 {record.reservationId} · 장비 {(record.equipmentIds || []).join(", ")}</p>
          <p>예정 반납 {formatDateTime(record.dueAt)} · 실제 반납 {record.actualReturnedAt ? formatDateTime(record.actualReturnedAt) : "아직 확인되지 않음"}</p>
          <p>확인 관리자 {record.reviewedBy || "-"} · 확인 사유 {record.reviewReason || "-"}</p>
          <button className="btn" type="button" onClick={() => void review(record)}>{record.actualReturnedAt ? "반납 시간 확인·경고 판정" : "예약 반납 점검으로 이동"}</button>
        </> : null}
      </article>)}
      <button className="btn" disabled={loading || page <= 1} onClick={() => void load(page - 1)}>이전</button>
      <span>{page}페이지</span>
      <button className="btn" disabled={loading || page * pageSize >= total} onClick={() => void load(page + 1)}>다음</button>
    </GjuDialog> : null}
  </div>;
}

function renderWarningMemo(user: AdminUser, actions: ReactAdminActions) {
  return <WarningMemo user={user} actions={actions} />;
}

function renderUserLimitSelect(user: AdminUser, actions: ReactAdminActions, keyPrefix = "user-limit") {
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
      onChange={(event) => {
        const duration = event.currentTarget.value;
        if (!duration) return;
        runAdminAction(() => actions.setUserApproval(user.id, duration === "unblock" ? "approved" : "blocked", duration));
      }}
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

function renderUserSecondaryActions(user: AdminUser, actions: ReactAdminActions) {
  return (
    <div className="admin-user-action-group admin-user-secondary-group">
      {renderPasswordResetButton(user, actions)}
      {renderUserDeleteButton(user, actions)}
    </div>
  );
}

function renderUserMobilePrimaryActions(user: AdminUser, actions: ReactAdminActions) {
  return (
    <div className="admin-user-action-group admin-user-mobile-primary-actions">
      {renderApprovalAction(user, actions)}
      {renderPasswordResetButton(user, actions)}
      {renderUserDeleteButton(user, actions)}
    </div>
  );
}

function renderUserMobileCard(user: AdminUser, actions: ReactAdminActions) {
  return (
    <article className="admin-user-mobile-card">
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
        {renderUserMobilePrimaryActions(user, actions)}
        <div className="admin-user-action-group admin-user-limit-group">
          {renderUserLimitSelect(user, actions, "mobile-user-limit")}
        </div>
        {renderWarningMemo(user, actions)}
      </div>
    </article>
  );
}

export function AdminUsers({ state, actions }: AdminUsersProps) {
  const [searchDraft, setSearchDraft] = React.useState(String(state.adminUserSearch || ""));
  const hasQuery = Boolean(String(state.adminUserSearch || "").trim());
  const activeFilter = String(state.adminUserStatusFilter || "all");
  const sortState = getUserSortState(state);
  const page = getUsersPageState(state);
  const allUsers = asUsers(state.adminUsers).filter((user) => user.role !== "admin");
  const users = allUsers;
  const total = Number(page.total ?? allUsers.length ?? 0);
  const shown = Math.min(allUsers.length, total);
  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void actions.setAdminFilters("users", { q: searchDraft, page: 1 });
  };
  const setSort = (field: AdminUserSortField) => {
    const direction = sortState.field === field && sortState.direction === "asc" ? "desc" : "asc";
    void actions.setAdminFilters("users", { sort: field, direction, page: 1 });
  };
  const setPage = (nextPage: number) => {
    void actions.setAdminFilters("users", { page: nextPage });
  };
  const statusTabsId = "admin-users-status";
  const usersPanelId = "admin-users-results";

  return (
    <section className="grid">
      <GjuCard title="학생 승인" surface="workspace">
        <form className="list-control-panel" onSubmit={submitSearch}>
          <input
            className="input"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.currentTarget.value)}
            placeholder="이름·학번·연락처·이메일 검색"
            aria-label="학생 검색"
          />
          <button className="button primary compact" type="submit">검색</button>
          <GjuTabs
            id={statusTabsId}
            panelId={usersPanelId}
            ariaLabel="학생 승인 상태 필터"
            className="tab-row wrap"
            tabClassName="tab-button"
            items={USER_STATUS_FILTERS.map(([key, label]) => ({ key, label }))}
            activeKey={activeFilter}
            onChange={(key) => void actions.setAdminFilters("users", { status: key, page: 1 })}
          />
        </form>
        <div
          id={usersPanelId}
          role="tabpanel"
          aria-labelledby={gjuTabId(statusTabsId, activeFilter)}
          tabIndex={0}
        >
          <p className="muted list-page-summary">
            현재 {shown}건 표시 / 전체 {total}건
            {hasQuery ? ` · 검색 결과 ${users.length}건(현재 페이지)` : ""}
            {page.hasMore ? " · 다음 페이지에 기록이 더 있습니다" : ""}
          </p>
          <div className="table-wrap admin-user-table-wrap admin-react-desktop-table">
          <GjuTable className="admin-user-table">
            <thead>
              <tr>
                <th className="admin-user-name-head">{renderUserSortButton(sortState, "name", "이름", setSort)}</th>
                <th>{renderUserSortButton(sortState, "studentId", "학번", setSort)}</th>
                <th>{renderUserSortButton(sortState, "studentStatus", "신분", setSort)}</th>
                <th>연락처</th>
                <th className="admin-user-status-head">{renderUserSortButton(sortState, "approvalStatus", "상태", setSort)}</th>
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
                            {renderApprovalAction(user, actions)}
                          </div>
                          <div className="admin-user-action-group admin-user-limit-group">
                            {renderUserLimitSelect(user, actions)}
                          </div>
                          {renderWarningMemo(user, actions)}
                          {renderUserSecondaryActions(user, actions)}
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>
                    <GjuEmptyState
                      title={hasQuery ? "검색 결과가 없습니다." : "학생이 없습니다."}
                      message={hasQuery ? "검색어를 지우거나 상태 필터를 변경하세요." : undefined}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </GjuTable>
          </div>
          <div className="admin-user-mobile-list" aria-label="학생 승인 모바일 목록">
            {users.length ? (
              users.map((user) => <React.Fragment key={`mobile:${user.id}`}>{renderUserMobileCard(user, actions)}</React.Fragment>)
            ) : (
              <GjuEmptyState
                title={hasQuery ? "검색 결과가 없습니다." : "학생이 없습니다."}
                message={hasQuery ? "검색어를 지우거나 상태 필터를 변경하세요." : undefined}
              />
            )}
          </div>
          {renderUsersPager(page, setPage)}
        </div>
      </GjuCard>
    </section>
  );
}
