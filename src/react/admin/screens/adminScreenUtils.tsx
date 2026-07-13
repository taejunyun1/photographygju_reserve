import React from "react";

import { GjuEmptyState } from "../../design-system";
import type { AdminPageMeta, AdminSemesterOption, AdminUserRecord, AdminView, ReactAdminActions } from "../../platform/types";

export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function text(value: unknown, fallback = "-") {
  const next = String(value ?? "").trim();
  return next || fallback;
}

export function searchText(...values: unknown[]) {
  return values
    .filter((value) => value !== undefined && value !== null)
    .map((value) => String(value))
    .join(" ")
    .toLowerCase();
}

export function normalizedQuery(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function semesterLabel(key: string) {
  const match = key.match(/^(\d{4})-S([12])$/);
  return match ? `${match[1]}년 ${match[2]}학기` : key;
}

export function semesterOptions(value: unknown): AdminSemesterOption[] {
  const seen = new Set<string>();
  return asArray<string | Partial<AdminSemesterOption>>(value).flatMap((option) => {
    const key = typeof option === "string" ? option.trim() : String(option.key || "").trim();
    if (!key || seen.has(key)) return [];
    seen.add(key);
    const label = typeof option === "string" ? semesterLabel(key) : String(option.label || semesterLabel(key));
    return [{ key, label }];
  });
}

export function bulkDeleteAvailability(page: AdminPageMeta | undefined, filters: Record<string, unknown>) {
  const hasFilters = Object.values(filters).some((value) => value !== undefined && value !== null && value !== "" && value !== "all");
  const filteredTotal = Number(page?.total || 0);
  const collectionTotal = Number(page?.collectionTotal ?? page?.total ?? 0);
  return {
    filteredDisabled: !hasFilters || filteredTotal <= 0 || (collectionTotal > 0 && filteredTotal === collectionTotal),
    allDisabled: collectionTotal <= 0,
    collectionTotal
  };
}

export function formatDate(value: unknown) {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function formatDateTime(value: unknown) {
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

export function userLabel(user?: AdminUserRecord | null) {
  if (!user) return "-";
  return [user.name, user.studentId, user.email].filter(Boolean).join(" · ") || user.id || "-";
}

export function fieldValue(form: HTMLFormElement, name: string) {
  const data = new FormData(form);
  return String(data.get(name) || "").trim();
}

export function checkedValue(form: HTMLFormElement, name: string) {
  const data = new FormData(form);
  return data.get(name) === "on";
}

export function numberValue(form: HTMLFormElement, name: string) {
  const value = fieldValue(form, name);
  return value ? Number(value) : undefined;
}

function totalPages(page: AdminPageMeta | undefined) {
  const total = Number(page?.total || 0);
  const pageSize = Number(page?.pageSize || 100) || 100;
  return Math.max(1, Math.ceil(total / pageSize));
}

function visiblePages(currentPage: number, pageCount: number) {
  const items: Array<number | "ellipsis"> = [];
  for (let page = 1; page <= pageCount; page += 1) {
    if (pageCount > 7 && page !== 1 && page !== pageCount && Math.abs(page - currentPage) > 1) {
      if (items[items.length - 1] !== "ellipsis") items.push("ellipsis");
      continue;
    }
    items.push(page);
  }
  return items;
}

export function renderPager(
  actions: ReactAdminActions,
  page: AdminPageMeta | undefined,
  view: Extract<AdminView, "users" | "reservations" | "reports" | "lectures" | "notices">,
  label: string
) {
  const pageCount = totalPages(page);
  if (pageCount <= 1) return null;
  const currentPage = Math.max(1, Number(page?.page || 1));
  const setPage = (nextPage: number) => {
    void actions.setAdminFilters(view, { page: nextPage });
  };

  return (
    <nav className="pagination admin-list-pagination" aria-label={label}>
      <button
        className="button compact pagination-button"
        type="button"
        disabled={currentPage <= 1}
        onClick={() => setPage(Math.max(1, currentPage - 1))}
      >
        이전
      </button>
      {visiblePages(currentPage, pageCount).map((item, index) => (
        item === "ellipsis" ? (
          <span key={`ellipsis:${index}`} className="pagination-summary">
            ...
          </span>
        ) : (
          <button
            key={item}
            className={`button compact pagination-button ${item === currentPage ? "is-active" : ""}`}
            type="button"
            aria-current={item === currentPage ? "page" : undefined}
            onClick={() => setPage(item)}
          >
            {item}
          </button>
        )
      ))}
      <button
        className="button compact pagination-button"
        type="button"
        disabled={currentPage >= pageCount}
        onClick={() => setPage(Math.min(pageCount, currentPage + 1))}
      >
        다음
      </button>
    </nav>
  );
}

export function emptyList(title: string, message?: string) {
  return <GjuEmptyState title={title} message={message} />;
}

export function property(label: string, value: React.ReactNode) {
  return (
    <div className="prop" key={label}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function stopSubmit(handler: (form: HTMLFormElement) => void | Promise<void>) {
  return (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    void Promise.resolve(handler(form)).catch(() => {});
  };
}

export function runAdminAction(action: () => unknown | Promise<unknown>) {
  void Promise.resolve().then(action).catch(() => {});
}
