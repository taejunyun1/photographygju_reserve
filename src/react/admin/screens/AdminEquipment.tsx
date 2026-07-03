import React from "react";

import {
  GjuCard,
  GjuEmptyState,
  GjuIcon,
  GjuTable
} from "../../design-system";
import type { LegacyState } from "../../platform/types";

type AdminEquipmentProps = {
  state: LegacyState;
};

type AdminEquipmentItem = {
  id: string;
  code?: string;
  name?: string;
  category?: string;
  source?: string;
  facility?: string;
  status?: string;
  notes?: string;
  active?: boolean;
  reservable?: boolean;
  inquiryOnly?: boolean;
};

const SOURCE_TABS = [
  ["department", "극기관"],
  ["fantasy_lab", "판타지랩"],
  ["all", "전체"]
] as const;

function normalizeSearchText(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function asEquipment(value: unknown): AdminEquipmentItem[] {
  return Array.isArray(value) ? (value as AdminEquipmentItem[]) : [];
}

function activeEquipment(items: AdminEquipmentItem[]) {
  return items.filter((item) => item.active !== false);
}

function equipmentCategories(items: AdminEquipmentItem[]) {
  return [...new Set(items.map((item) => item.category).filter(Boolean) as string[])].sort((a, b) =>
    a.localeCompare(b, "ko")
  );
}

function isInquiry(item: AdminEquipmentItem) {
  return Boolean(item.inquiryOnly) || (item.status === "가능" && item.reservable === false);
}

function matchesEquipmentQuery(item: AdminEquipmentItem, query: string) {
  if (!query) return true;
  return [
    item.code,
    item.name,
    item.category,
    item.source,
    item.facility,
    item.status,
    item.notes,
    item.reservable ? "가능" : "문의"
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function sourceLabel(source: string) {
  return {
    department: "극기관",
    fantasy_lab: "판타지랩"
  }[source] || source || "-";
}

function selectedEquipmentSet(state: LegacyState) {
  const ids = Array.isArray(state.adminSelectedEquipmentIds)
    ? state.adminSelectedEquipmentIds
    : Array.isArray(state.selectedAdminEquipmentIds)
      ? state.selectedAdminEquipmentIds
      : [];
  return new Set(ids.map((value) => String(value)));
}

function renderTrashIcon() {
  return (
    <span aria-hidden="true" style={{ pointerEvents: "none", display: "inline-flex" }}>
      <GjuIcon name="trash" className="button-icon icon" />
    </span>
  );
}

function renderStatusButton(item: AdminEquipmentItem, status: "가능" | "수리중" | "파손" | "문의") {
  const active = status === "문의"
    ? isInquiry(item)
    : item.status === status && (status !== "가능" || !isInquiry(item));

  return (
    <button
      key={status}
      className={`status-button ${active ? "active" : ""}`}
      type="button"
      data-equipment-status-action={item.id}
      data-status={status}
      aria-pressed={active ? "true" : "false"}
    >
      {status}
    </button>
  );
}

function renderReservableTag(item: AdminEquipmentItem) {
  return item.reservable ? <span className="tag green">가능</span> : <span className="tag yellow">문의</span>;
}

export function AdminEquipment({ state }: AdminEquipmentProps) {
  const panelTab = String(state.adminEquipmentPanelTab || "manage");
  const query = normalizeSearchText(state.adminEquipmentSearch);
  const sourceTab = String(state.adminEquipmentTab || "all");
  const categoryTab = String(state.adminEquipmentCategoryTab || "all");
  const items = activeEquipment(asEquipment(state.adminEquipment));
  const categories = equipmentCategories(items);
  const selected = selectedEquipmentSet(state);
  const filtered = items.filter((item) => {
    if (sourceTab !== "all" && item.source !== sourceTab) return false;
    if (categoryTab !== "all" && item.category !== categoryTab) return false;
    return matchesEquipmentQuery(item, query);
  });
  const visibleSelectedCount = filtered.filter((item) => selected.has(item.id)).length;
  const allVisibleSelected = filtered.length > 0 && visibleSelectedCount === filtered.length;

  if (panelTab !== "manage") {
    return (
      <section className="grid">
        <GjuCard title="기자재 관리" eyebrow="React Admin">
          <p className="muted">이 마일스톤에서는 장비관리 탭만 React로 전환합니다.</p>
        </GjuCard>
      </section>
    );
  }

  return (
    <section className="grid">
      <GjuCard
        className="admin-equipment-list-card compact"
        title="등록된 전체 기자재"
        eyebrow="React Admin"
        actions={
          <span className="tag blue" data-admin-equipment-count>
            {filtered.length}개
          </span>
        }
      >
        <div className="list-control-panel compact">
          <input
            key={`admin-equipment-search:${String(state.adminEquipmentSearch || "")}`}
            className="input"
            defaultValue={String(state.adminEquipmentSearch || "")}
            placeholder="코드·장비명·카테고리·상태 검색"
            aria-label="기자재 검색"
            data-admin-equipment-search
          />
        </div>
        <div className="tab-row">
          {SOURCE_TABS.map(([key, label]) => (
            <button
              key={key}
              className={`tab-button ${sourceTab === key ? "active" : ""}`}
              type="button"
              data-admin-equipment-tab={key}
              aria-current={sourceTab === key ? "true" : undefined}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="tab-row wrap">
          <button
            className={`tab-button ${categoryTab === "all" ? "active" : ""}`}
            type="button"
            data-admin-equipment-category-tab="all"
            aria-current={categoryTab === "all" ? "true" : undefined}
          >
            전체
          </button>
          {categories.map((category) => (
            <button
              key={category}
              className={`tab-button ${categoryTab === category ? "active" : ""}`}
              type="button"
              data-admin-equipment-category-tab={category}
              aria-current={categoryTab === category ? "true" : undefined}
            >
              {category}
            </button>
          ))}
        </div>
        <div className="equipment-bulk-bar">
          <label className="table-check">
            <input type="checkbox" data-equipment-select-all defaultChecked={allVisibleSelected} />
            <span>전체 선택</span>
          </label>
          <span className="tag" data-admin-equipment-selected-count>
            {selected.size}개 선택
          </span>
          <div className="bulk-actions" aria-label="선택 기자재 상태 변경">
            <button className="button compact" type="button" data-equipment-bulk-status="가능" disabled={!selected.size}>
              가능
            </button>
            <button className="button compact" type="button" data-equipment-bulk-status="수리중" disabled={!selected.size}>
              수리중
            </button>
            <button className="button compact" type="button" data-equipment-bulk-status="파손" disabled={!selected.size}>
              파손
            </button>
            <button className="button compact" type="button" data-equipment-bulk-status="문의" disabled={!selected.size}>
              문의
            </button>
            <button
              className="button danger compact icon-only-action"
              type="button"
              data-equipment-bulk-remove
              disabled={!selected.size}
              aria-label="선택 기자재 제거"
              title="선택 기자재 제거"
            >
              {renderTrashIcon()}
            </button>
          </div>
        </div>
        <div className="table-wrap embedded admin-equipment-scroll-region">
          <GjuTable>
            <thead>
              <tr>
                <th className="check-col">
                  <span className="sr-only">선택</span>
                </th>
                <th>코드</th>
                <th>장비</th>
                <th>분류</th>
                <th>관리처</th>
                <th>상태</th>
                <th>예약</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length ? (
                filtered.map((item) => (
                  <tr
                    key={item.id}
                    data-equipment-row={item.id}
                    data-status={item.status || ""}
                    className={selected.has(item.id) ? "selected" : ""}
                  >
                    <td className="check-col">
                      <input
                        type="checkbox"
                        data-equipment-select={item.id}
                        defaultChecked={selected.has(item.id)}
                        aria-label={`${item.code || item.id} ${item.name || "기자재"} 선택`}
                      />
                    </td>
                    <td>{item.code || "-"}</td>
                    <td>
                      {item.name || "-"}
                      {item.notes ? (
                        <>
                          <br />
                          <span className="muted">{item.notes}</span>
                        </>
                      ) : null}
                    </td>
                    <td>{item.category || "-"}</td>
                    <td>{sourceLabel(String(item.source || item.facility || ""))}</td>
                    <td>
                      <div className="equipment-status-buttons" data-equipment-status-cell={item.id}>
                        {renderStatusButton(item, "가능")}
                        {renderStatusButton(item, "수리중")}
                        {renderStatusButton(item, "파손")}
                        {renderStatusButton(item, "문의")}
                      </div>
                    </td>
                    <td data-equipment-reservable-cell={item.id}>{renderReservableTag(item)}</td>
                    <td>
                      <button
                        className="button danger compact icon-only-action"
                        type="button"
                        data-equipment-remove-admin={item.id}
                        aria-label="기자재 제거"
                        title="기자재 제거"
                      >
                        {renderTrashIcon()}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8}>
                    <GjuEmptyState
                      title={query ? "검색 결과가 없습니다." : "등록된 기자재가 없습니다."}
                      message={query ? "검색어를 지우거나 탭 필터를 변경하세요." : undefined}
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
