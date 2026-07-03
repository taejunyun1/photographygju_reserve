import React from "react";

import {
  GjuCard,
  GjuEmptyState,
  GjuIcon,
  GjuTable
} from "../../design-system";
import type { LegacyState } from "../../platform/types";

type AdminLogsProps = {
  state: LegacyState;
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
  actor?: string;
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
    "lecture.applied": "특강 신청",
    "lecture.cancelled": "특강 신청 취소",
    "studio_report.created": "보고서 제출",
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
    "settings.updated": "설정 변경",
    "maintenance.cleanup": "보관정책 정리"
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
  const detail = log.detail || {};
  const parts = [
    detail && typeof detail === "object" ? String((detail as Record<string, unknown>).status || "") : "",
    detail && typeof detail === "object" ? String((detail as Record<string, unknown>).reason || "") : "",
    detail && typeof detail === "object" ? String((detail as Record<string, unknown>).ip || (detail as Record<string, unknown>).targetIp || "") : "",
    detail && typeof detail === "object" ? String((detail as Record<string, unknown>).device || (detail as Record<string, unknown>).targetDevice || "") : ""
  ].filter(Boolean);

  return parts.join(" · ") || "-";
}

function logSearchText(log: AdminLogRecord) {
  return [
    log.id,
    log.action,
    auditActionLabel(String(log.action || "")),
    log.actor,
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

export function AdminLogs({ state }: AdminLogsProps) {
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

  return (
    <section className="grid">
      <GjuCard title="현재 로그인 세션" eyebrow="React Admin">
        <div className="list-control-panel compact">
          <input
            key={`admin-session-search:${String(state.adminSessionSearch || "")}`}
            className="input"
            defaultValue={String(state.adminSessionSearch || "")}
            placeholder="사용자·IP·기기 검색"
            aria-label="세션 검색"
            data-admin-session-search
          />
        </div>
        <div className="tab-row wrap" role="tablist" aria-label="세션 정렬">
          <button
            className={`tab-button ${sessionSort === "createdAt" ? "active" : ""}`}
            type="button"
            data-admin-session-sort="createdAt"
          >
            최근 로그인
          </button>
          <button
            className={`tab-button ${sessionSort === "expiresAt" ? "active" : ""}`}
            type="button"
            data-admin-session-sort="expiresAt"
          >
            만료 임박
          </button>
          <button
            className={`tab-button ${sessionSort === "user" ? "active" : ""}`}
            type="button"
            data-admin-session-sort="user"
          >
            사용자명
          </button>
        </div>
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
              {sessions.length ? (
                sessions.map((session) => (
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
                        data-session-revoke={session.id}
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
      </GjuCard>
      <GjuCard title="활동 로그" eyebrow="React Admin">
        <div className="list-control-panel compact">
          <input
            key={`admin-log-search:${String(state.adminLogSearch || "")}`}
            className="input"
            defaultValue={String(state.adminLogSearch || "")}
            placeholder="작업·사용자·대상·상세 검색"
            aria-label="로그 검색"
            data-admin-log-search
          />
        </div>
        <div className="tab-row wrap" role="tablist" aria-label="활동 로그 작업 필터">
          {LOG_FILTERS.map(([key, label]) => (
            <button
              key={key}
              className={`tab-button ${logFilter === key ? "active" : ""}`}
              type="button"
              data-admin-log-action-filter={key}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="tab-row wrap" role="tablist" aria-label="활동 로그 정렬">
          <button className={`tab-button ${logSort === "desc" ? "active" : ""}`} type="button" data-admin-log-sort="desc">
            최신순
          </button>
          <button className={`tab-button ${logSort === "asc" ? "active" : ""}`} type="button" data-admin-log-sort="asc">
            오래된순
          </button>
        </div>
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
              {logs.length ? (
                logs.map((log, index) => (
                  <tr key={log.id || `${log.action || "log"}:${index}`}>
                    <td>{formatDateTime(log.createdAt)}</td>
                    <td>{auditActionLabel(String(log.action || ""))}</td>
                    <td>{log.actor || "-"}</td>
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
      </GjuCard>
    </section>
  );
}
