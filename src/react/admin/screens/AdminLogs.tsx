import React from "react";

import {
  GjuCard,
  GjuEmptyState,
  GjuIcon,
  GjuTable,
  GjuTabs
} from "../../design-system";
import type { LegacyState, ReactAdminActions } from "../../platform/types";
import { runAdminAction } from "./adminScreenUtils";

type AdminLogsProps = {
  state: LegacyState;
  actions: ReactAdminActions;
};

type AdminSession = {
  id: string;
  userId?: string;
  ip?: string;
  device?: string;
  userAgent?: string;
  createdAt?: string;
  expiresAt?: string;
  user?: {
    name?: string;
    studentId?: string;
    email?: string;
  };
};

type AdminLogRecord = {
  id?: string;
  action?: string;
  actor?: string | {
    name?: string;
    email?: string;
    studentId?: string;
  } | null;
  targetId?: string;
  detail?: Record<string, unknown> | null;
  createdAt?: string;
};

const LOG_FILTERS = [
  ["all", "전체"],
  ["auth", "로그인"],
  ["reservation", "예약"],
  ["user", "학생"],
  ["equipment", "기자재"],
  ["lecture", "특강"],
  ["studio_report", "보고서"],
  ["notice", "공지"],
  ["settings", "설정"]
] as const;
const LOG_PAGE_SIZE = 50;

function pageItems<T>(items: T[], page: number) {
  const start = (page - 1) * LOG_PAGE_SIZE;
  return items.slice(start, start + LOG_PAGE_SIZE);
}

function LocalPager({ page, total, onPage, label }: { page: number; total: number; onPage: (page: number) => void; label: string }) {
  const pages = Math.max(1, Math.ceil(total / LOG_PAGE_SIZE));
  if (pages <= 1) return null;
  return (
    <nav className="pagination admin-list-pagination" aria-label={label}>
      <button className="button compact" type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>이전</button>
      <span className="pagination-summary">{page} / {pages}</span>
      <button className="button compact" type="button" disabled={page >= pages} onClick={() => onPage(page + 1)}>다음</button>
    </nav>
  );
}

function normalizeSearchText(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function asSessions(value: unknown): AdminSession[] {
  return Array.isArray(value) ? (value as AdminSession[]) : [];
}

function asLogs(value: unknown): AdminLogRecord[] {
  return Array.isArray(value) ? (value as AdminLogRecord[]) : [];
}

function formatDateTime(value: unknown) {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function sessionUserText(session: AdminSession) {
  return [
    session.user?.name,
    session.user?.studentId,
    session.user?.email,
    session.userId
  ]
    .filter(Boolean)
    .join(" ");
}

function sessionSearchText(session: AdminSession) {
  return [
    session.id,
    session.userId,
    session.user?.name,
    session.user?.studentId,
    session.user?.email,
    session.ip,
    session.device,
    session.userAgent,
    session.createdAt,
    session.expiresAt
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function sortedSessions(sessions: AdminSession[], sort: string) {
  return [...sessions].sort((left, right) => {
    if (sort === "expiresAt") {
      return String(left.expiresAt || "").localeCompare(String(right.expiresAt || ""));
    }
    if (sort === "user") {
      return sessionUserText(left).localeCompare(sessionUserText(right), "ko");
    }
    return String(right.createdAt || "").localeCompare(String(left.createdAt || ""));
  });
}

function auditActionLabel(action: string) {
  return {
    "auth.login_success": "로그인",
    "auth.login_failed": "로그인 실패",
    "auth.login_blocked": "로그인 차단",
    "auth.logout": "로그아웃",
    "session.revoked": "원격 로그아웃",
    "reservation.created": "예약 생성",
    "reservation.cancelled": "예약 취소",
    "reservation.updated": "예약 수정",
    "reservation.status_changed": "예약 상태 변경",
    "reservations.bulk_deleted": "예약 일괄 삭제",
    "lecture.applied": "특강 신청",
    "lecture.cancelled": "특강 신청 취소",
    "studio_report.created": "보고서 제출",
    "reports.bulk_deleted": "보고서 일괄 삭제",
    "user.password_changed": "비밀번호 변경",
    "user.password_reset": "비밀번호 리셋",
    "user.approval_changed": "학생 상태 변경",
    "user.warning_issued": "경고 메모 저장",
    "user.warning_reset": "경고 메모 초기화",
    "user.profile_updated": "개인정보 수정",
    "equipment.created": "장비 등록",
    "equipment.imported": "장비 CSV 등록",
    "equipment.updated": "장비 수정",
    "notice.created": "공지 작성",
    "notices.bulk_deleted": "공지 일괄 삭제",
    "lectures.bulk_deleted": "특강 일괄 삭제",
    "settings.updated": "설정 변경",
    "maintenance.cleanup": "보관정책 정리",
    "maintenance.semester_close": "학기 종료 데이터 정리"
  }[action] || action || "-";
}

function logActionGroup(action = "") {
  if (action.startsWith("auth.") || action.startsWith("session.")) return "auth";
  if (action.startsWith("reservation.")) return "reservation";
  if (action.startsWith("user.")) return "user";
  if (action.startsWith("equipment.")) return "equipment";
  if (action.startsWith("lecture.")) return "lecture";
  if (action.startsWith("studio_report.")) return "studio_report";
  if (action.startsWith("notice.")) return "notice";
  if (action.startsWith("settings.") || action.startsWith("maintenance.")) return "settings";
  return "other";
}

function auditDetailText(log: AdminLogRecord) {
  const detail = log.detail && typeof log.detail === "object" ? log.detail : {};
  const fields: Array<[string, unknown]> = [
    ["로그인 ID", detail.loginId],
    ["유형", detail.type],
    ["해제 세션", detail.revokedSessions],
    ["대상 사용자", detail.targetUserId],
    ["상태", detail.status],
    ["사유", detail.reason],
    ["IP", detail.ip || detail.targetIp],
    ["기기", detail.device || detail.targetDevice],
    ["범위", detail.scope],
    ["필터", detail.filters && typeof detail.filters === "object" ? JSON.stringify(detail.filters) : detail.filters],
    ["삭제 예약", detail.deletedReservations],
    ["삭제 보고서", detail.deletedReports],
    ["삭제 특강", detail.deletedLectures],
    ["삭제 신청", detail.deletedApplications],
    ["삭제 공지", detail.deletedNotices],
    ["보고서 상태 복원", detail.resetReservations]
  ];
  const parts = fields
    .filter(([, value]) => value !== undefined && value !== null && String(value) !== "")
    .map(([label, value]) => `${label} ${String(value)}`);

  return parts.join(" · ") || "-";
}

function actorSearchText(actor: AdminLogRecord["actor"]) {
  if (!actor) return "";
  if (typeof actor === "string") return actor;
  return [
    actor?.name,
    actor?.studentId,
    actor?.email
  ]
    .filter(Boolean)
    .join(" ");
}

function renderActorCell(actor: AdminLogRecord["actor"]) {
  if (!actor) return "-";
  if (typeof actor === "string") return actor;
  const secondary = actor?.studentId || actor?.email || "";
  return (
    <>
      <strong>{actor?.name || "-"}</strong>
      {secondary ? (
        <>
          <br />
          <span className="muted">{secondary}</span>
        </>
      ) : null}
    </>
  );
}

function logSearchText(log: AdminLogRecord) {
  return [
    log.id,
    log.action,
    auditActionLabel(String(log.action || "")),
    actorSearchText(log.actor),
    log.targetId,
    auditDetailText(log),
    log.createdAt
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function filteredSortedLogs(logs: AdminLogRecord[], filter: string, direction: string) {
  return logs
    .filter((log) => filter === "all" || logActionGroup(String(log.action || "")) === filter)
    .slice()
    .sort((left, right) => {
      const result = String(left.createdAt || "").localeCompare(String(right.createdAt || ""));
      return direction === "asc" ? result : -result;
    });
}

function renderLogOutIcon() {
  return (
    <span aria-hidden="true" style={{ pointerEvents: "none", display: "inline-flex" }}>
      <GjuIcon name="logOut" className="button-icon icon" />
    </span>
  );
}

export function AdminLogs({ state, actions }: AdminLogsProps) {
  const [sessionPage, setSessionPage] = React.useState(1);
  const [logPage, setLogPage] = React.useState(1);
  const sessionQuery = normalizeSearchText(state.adminSessionSearch);
  const logQuery = normalizeSearchText(state.adminLogSearch);
  const sessionSort = String(state.adminSessionSort || "createdAt");
  const logFilter = String(state.adminLogActionFilter || "all");
  const logSort = String(state.adminLogSort || "desc");
  const sessions = sortedSessions(
    asSessions(state.adminSessions).filter((session) => !sessionQuery || sessionSearchText(session).includes(sessionQuery)),
    sessionSort
  );
  const logs = filteredSortedLogs(
    asLogs(state.adminLogs).filter((log) => !logQuery || logSearchText(log).includes(logQuery)),
    logFilter,
    logSort
  );
  React.useEffect(() => setSessionPage(1), [sessionQuery, sessionSort]);
  React.useEffect(() => setLogPage(1), [logFilter, logQuery, logSort]);
  const visibleSessions = pageItems(sessions, sessionPage);
  const visibleLogs = pageItems(logs, logPage);

  return (
    <section className="grid">
      <GjuCard title="현재 로그인 세션" eyebrow="React Admin">
        <div className="list-control-panel compact">
          <input
            className="input"
            value={String(state.adminSessionSearch || "")}
            placeholder="사용자·IP·기기 검색"
            aria-label="세션 검색"
            onChange={(event) => void actions.setAdminFilters("logs", { sessionQuery: event.currentTarget.value })}
          />
        </div>
        <GjuTabs
          id="admin-session-sort-tabs"
          ariaLabel="세션 정렬"
          className="tab-row wrap"
          tabClassName="tab-button"
          items={[
            { key: "createdAt", label: "최근 로그인" },
            { key: "expiresAt", label: "만료 임박" },
            { key: "user", label: "사용자명" }
          ]}
          activeKey={sessionSort}
          onChange={(sessionSort) => void actions.setAdminFilters("logs", { sessionSort: sessionSort as "createdAt" | "expiresAt" | "user" })}
        />
        <div className="table-wrap embedded">
          <GjuTable>
            <thead>
              <tr>
                <th>사용자</th>
                <th>IP</th>
                <th>기기</th>
                <th>로그인</th>
                <th>만료</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {visibleSessions.length ? (
                visibleSessions.map((session) => (
                  <tr key={session.id}>
                    <td>
                      <strong>{session.user?.name || "-"}</strong>
                      <br />
                      <span className="muted">{session.user?.studentId || session.user?.email || session.userId || ""}</span>
                    </td>
                    <td>{session.ip || "-"}</td>
                    <td>
                      <strong>{session.device || "-"}</strong>
                      <br />
                      <span className="muted">{session.userAgent || "-"}</span>
                    </td>
                    <td>{formatDateTime(session.createdAt)}</td>
                    <td>{formatDateTime(session.expiresAt)}</td>
                    <td>
                      <button
                        className="button danger compact icon-only-action"
                        type="button"
                        onClick={() => runAdminAction(() => actions.revokeSession(session.id))}
                        aria-label="로그아웃"
                        title="로그아웃"
                      >
                        {renderLogOutIcon()}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    <GjuEmptyState
                      title={sessionQuery ? "검색 결과가 없습니다." : "현재 로그인 세션이 없습니다."}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </GjuTable>
        </div>
        <LocalPager page={sessionPage} total={sessions.length} onPage={setSessionPage} label="세션 페이지 이동" />
      </GjuCard>
      <GjuCard title="활동 로그" eyebrow="React Admin">
        <div className="list-control-panel compact">
          <input
            className="input"
            value={String(state.adminLogSearch || "")}
            placeholder="작업·사용자·대상·상세 검색"
            aria-label="로그 검색"
            onChange={(event) => void actions.setAdminFilters("logs", { logQuery: event.currentTarget.value })}
          />
        </div>
        <GjuTabs
          id="admin-log-action-tabs"
          ariaLabel="활동 로그 작업 필터"
          className="tab-row wrap"
          tabClassName="tab-button"
          items={LOG_FILTERS.map(([key, label]) => ({ key, label }))}
          activeKey={logFilter}
          onChange={(logAction) => void actions.setAdminFilters("logs", { logAction })}
        />
        <GjuTabs
          id="admin-log-sort-tabs"
          ariaLabel="활동 로그 정렬"
          className="tab-row wrap"
          tabClassName="tab-button"
          items={[{ key: "desc", label: "최신순" }, { key: "asc", label: "오래된순" }]}
          activeKey={logSort}
          onChange={(logDirection) => void actions.setAdminFilters("logs", { logDirection: logDirection as "asc" | "desc" })}
        />
        <div className="table-wrap embedded">
          <GjuTable>
            <thead>
              <tr>
                <th>시간</th>
                <th>작업</th>
                <th>사용자</th>
                <th>대상</th>
                <th>상세</th>
              </tr>
            </thead>
            <tbody>
              {visibleLogs.length ? (
                visibleLogs.map((log, index) => (
                  <tr key={log.id || `${log.action || "log"}:${index}`}>
                    <td>{formatDateTime(log.createdAt)}</td>
                    <td>{auditActionLabel(String(log.action || ""))}</td>
                    <td>{renderActorCell(log.actor)}</td>
                    <td>{log.targetId || "-"}</td>
                    <td>{auditDetailText(log)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>
                    <GjuEmptyState title={logQuery ? "검색 결과가 없습니다." : "활동 로그가 없습니다."} />
                  </td>
                </tr>
              )}
            </tbody>
          </GjuTable>
        </div>
        <LocalPager page={logPage} total={logs.length} onPage={setLogPage} label="활동 로그 페이지 이동" />
      </GjuCard>
    </section>
  );
}
