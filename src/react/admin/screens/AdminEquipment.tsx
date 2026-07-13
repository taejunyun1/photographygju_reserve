import React from "react";

import {
  GjuCard,
  GjuEmptyState,
  GjuIcon,
  GjuTable
} from "../../design-system";
import type { AdminEquipmentStatus, LegacyState, ReactAdminActions } from "../../platform/types";
import { fieldValue, numberValue, runAdminAction, stopSubmit } from "./adminScreenUtils";

type AdminEquipmentProps = {
  state: LegacyState;
  actions: ReactAdminActions;
};

type AdminEquipmentItem = {
  id: string;
  code?: string;
  name?: string;
  category?: string;
  brand?: string;
  model?: string;
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
    item.brand,
    item.model,
    item.status,
    item.notes,
    item.reservable ? "예약가능" : "문의"
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

function equipmentStatusTone(status: "가능" | "수리중" | "파손" | "문의") {
  return {
    가능: "green",
    수리중: "amber",
    파손: "red",
    문의: "blue"
  }[status];
}

function renderStatusButton(
  item: AdminEquipmentItem,
  status: AdminEquipmentStatus,
  onStatus: (itemId: string, status: AdminEquipmentStatus) => void
) {
  const active = status === "문의"
    ? isInquiry(item)
    : item.status === status && (status !== "가능" || !isInquiry(item));

  return (
    <button
      key={status}
      className={`status-button ${active ? "active" : ""}`}
      type="button"
      data-tone={equipmentStatusTone(status)}
      aria-pressed={active ? "true" : "false"}
      onClick={() => onStatus(item.id, status)}
    >
      {status}
    </button>
  );
}

function renderReservableTag(item: AdminEquipmentItem) {
  return item.reservable ? <span className="tag green">가능</span> : <span className="tag yellow">문의</span>;
}

function renderEquipmentPanelTabs(panelTab: string, onTab: (tab: string) => void) {
  return (
    <div className="admin-inner-tabs" role="tablist" aria-label="기자재 관리 탭">
      <button
        className={`tab-button ${panelTab === "add" ? "active" : ""}`}
        type="button"
        role="tab"
        aria-selected={panelTab === "add" ? "true" : "false"}
        onClick={() => onTab("add")}
      >
        장비추가
      </button>
      <button
        className={`tab-button ${panelTab === "manage" ? "active" : ""}`}
        type="button"
        role="tab"
        aria-selected={panelTab === "manage" ? "true" : "false"}
        onClick={() => onTab("manage")}
      >
        장비관리
      </button>
    </div>
  );
}

function renderEquipmentMobileCard(
  item: AdminEquipmentItem,
  selected: Set<string>,
  onSelect: (itemId: string, checked: boolean) => void,
  onStatus: (itemId: string, status: AdminEquipmentStatus) => void,
  onRemove: (itemId: string) => void
) {
  const selectedItem = selected.has(item.id);

  return (
    <article className={`admin-equipment-mobile-card ${selectedItem ? "selected" : ""}`}>
      <div className="admin-equipment-mobile-head">
        <label className="admin-equipment-mobile-select">
          <input
            type="checkbox"
            checked={selectedItem}
            onChange={(event) => onSelect(item.id, event.currentTarget.checked)}
            aria-label={`${item.code || item.id} ${item.name || "기자재"} 선택`}
          />
          <span>
            <strong>{item.code || "-"}</strong>
            <em>{item.name || "-"}</em>
          </span>
        </label>
        <div className="admin-equipment-mobile-tools">
          <span className="admin-equipment-mobile-reservable">
            {renderReservableTag(item)}
          </span>
          <button
            className="button danger compact icon-only-action"
            type="button"
            onClick={() => onRemove(item.id)}
            aria-label="기자재 제거"
            title="기자재 제거"
          >
            {renderTrashIcon()}
          </button>
        </div>
      </div>
      {item.notes ? <p className="admin-equipment-mobile-note">{item.notes}</p> : null}
      <dl className="admin-equipment-mobile-meta">
        <div>
          <dt>분류</dt>
          <dd>{item.category || "-"}</dd>
        </div>
        <div>
          <dt>관리처</dt>
          <dd>{sourceLabel(String(item.source || item.facility || ""))}</dd>
        </div>
        <div>
          <dt>상태</dt>
          <dd>{isInquiry(item) ? "문의" : item.status || "-"}</dd>
        </div>
        <div>
          <dt>예약</dt>
          <dd>{item.reservable ? "가능" : "문의"}</dd>
        </div>
      </dl>
      <div className="admin-equipment-mobile-actions">
        <div className="equipment-status-buttons">
          {renderStatusButton(item, "가능", onStatus)}
          {renderStatusButton(item, "수리중", onStatus)}
          {renderStatusButton(item, "파손", onStatus)}
          {renderStatusButton(item, "문의", onStatus)}
        </div>
      </div>
    </article>
  );
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = String(text || "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (quoted && char === "\"" && next === "\"") {
      cell += "\"";
      index += 1;
      continue;
    }
    if (char === "\"") {
      quoted = !quoted;
      continue;
    }
    if (!quoted && char === ",") {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows[0].map((item) => item.trim());
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
}

function equipmentCategoryOptions(state: LegacyState, items: AdminEquipmentItem[]) {
  const configured = state.bootstrap?.settings?.equipmentCategories;
  const values = Array.isArray(configured) ? configured.map(String) : [];
  return [...new Set([...values, ...equipmentCategories(items)])].filter(Boolean);
}

function renderEquipmentAddPanel(state: LegacyState, actions: ReactAdminActions, items: AdminEquipmentItem[]) {
  const categories = equipmentCategoryOptions(state, items);
  const sources = [
    ["department", "극기관"],
    ["fantasy_lab", "판타지랩"]
  ] as const;

  const submitEquipment = stopSubmit(async (form) => {
    const inquiryOnly = fieldValue(form, "reservationMode") === "inquiry";
    const body = {
      codePrefix: fieldValue(form, "codePrefix"),
      name: fieldValue(form, "name"),
      category: fieldValue(form, "category"),
      brand: fieldValue(form, "brand"),
      model: fieldValue(form, "model"),
      source: fieldValue(form, "source"),
      status: (fieldValue(form, "status") || "가능") as AdminEquipmentStatus,
      quantity: numberValue(form, "quantity") || 1,
      notes: fieldValue(form, "notes"),
      reservable: !inquiryOnly,
      inquiryOnly
    };
    await actions.createEquipment(body);
    form.reset();
  });

  const submitCategory = stopSubmit(async (form) => {
    const categoryName = fieldValue(form, "categoryName");
    if (!categoryName) return;
    const next = [...new Set([...categories, categoryName])];
    await actions.saveEquipmentCategories(next);
    form.reset();
  });

  const submitImport = stopSubmit(async (form) => {
    const rows = parseCsv(fieldValue(form, "csv"));
    await actions.importEquipment(rows);
    form.reset();
  });

  return (
    <section className="grid admin-equipment-add-panel">
      <GjuCard title="장비추가" eyebrow="React Admin">
        <form className="admin-react-form-grid" onSubmit={submitEquipment}>
          <label>
            코드 / 접두어
            <input className="input" name="codePrefix" placeholder="CAM-001" />
          </label>
          <label>
            장비명
            <input className="input" name="name" required />
          </label>
          <label>
            카테고리
            <input className="input" name="category" list="admin-equipment-category-list" required />
            <datalist id="admin-equipment-category-list">
              {categories.map((category) => <option key={category} value={category} />)}
            </datalist>
          </label>
          <label>
            관리처
            <select className="select" name="source" defaultValue="department">
              {sources.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            브랜드
            <input className="input" name="brand" />
          </label>
          <label>
            모델
            <input className="input" name="model" />
          </label>
          <label>
            수량
            <input className="input" name="quantity" type="number" min="1" defaultValue="1" />
          </label>
          <label>
            상태
            <select className="select" name="status" defaultValue="가능">
              <option value="가능">가능</option>
              <option value="수리중">수리중</option>
              <option value="파손">파손</option>
            </select>
          </label>
          <label>
            예약 방식
            <select className="select" name="reservationMode" defaultValue="reservable">
              <option value="reservable">예약 가능</option>
              <option value="inquiry">문의 전용</option>
            </select>
          </label>
          <label className="admin-react-form-wide">
            메모
            <input className="input" name="notes" />
          </label>
          <button className="button primary admin-react-form-wide" type="submit">
            장비 추가
          </button>
        </form>
      </GjuCard>
      <GjuCard title="카테고리 추가" eyebrow="분류">
        <form className="admin-react-form-grid" onSubmit={submitCategory}>
          <label>
            카테고리명
            <input className="input" name="categoryName" required />
          </label>
          <button className="button primary" type="submit">
            카테고리 추가
          </button>
        </form>
      </GjuCard>
      <GjuCard title="CSV 가져오기" eyebrow="일괄 등록">
        <form className="admin-react-form-grid" onSubmit={submitImport}>
          <label className="admin-react-form-wide">
            CSV
            <textarea
              className="textarea"
              name="csv"
              rows={8}
              placeholder="code_prefix,name,category,brand,model,source,status,reservable,inquiry_only"
              required
            />
          </label>
          <button className="button primary admin-react-form-wide" type="submit">
            CSV 장비 등록
          </button>
        </form>
      </GjuCard>
    </section>
  );
}

export function AdminEquipment({ state, actions }: AdminEquipmentProps) {
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
  const setPanelTab = (tab: string) => {
    void actions.setAdminFilters("equipment", { panel: tab });
  };
  const setSelected = (itemId: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(itemId);
    else next.delete(itemId);
    actions.setEquipmentSelection([...next]);
  };
  const setAllVisible = (checked: boolean) => {
    const next = new Set(selected);
    filtered.forEach((item) => {
      if (checked) next.add(item.id);
      else next.delete(item.id);
    });
    actions.setEquipmentSelection([...next]);
  };
  const setStatus = (itemId: string, status: AdminEquipmentStatus) => {
    runAdminAction(() => actions.updateEquipmentStatus([itemId], status));
  };

  if (panelTab !== "manage") {
    return (
      <section className="grid">
        {renderEquipmentPanelTabs(panelTab, setPanelTab)}
        {renderEquipmentAddPanel(state, actions, items)}
      </section>
    );
  }

  return (
    <section className="grid">
      {renderEquipmentPanelTabs(panelTab, setPanelTab)}
      <GjuCard
        className="admin-equipment-list-card compact"
        title="등록된 전체 기자재"
        eyebrow="React Admin"
        surface="workspace"
        actions={
          <span className="tag blue">
            {filtered.length}개
          </span>
        }
      >
        <div className="list-control-panel compact">
          <input
            className="input"
            value={String(state.adminEquipmentSearch || "")}
            placeholder="코드·장비명·카테고리·상태 검색"
            aria-label="기자재 검색"
            onChange={(event) => void actions.setAdminFilters("equipment", { q: event.currentTarget.value })}
          />
        </div>
        <div className="tab-row">
          {SOURCE_TABS.map(([key, label]) => (
            <button
              key={key}
              className={`tab-button ${sourceTab === key ? "active" : ""}`}
              type="button"
              aria-current={sourceTab === key ? "true" : undefined}
              onClick={() => void actions.setAdminFilters("equipment", { source: key })}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="tab-row wrap">
          <button
            className={`tab-button ${categoryTab === "all" ? "active" : ""}`}
            type="button"
            aria-current={categoryTab === "all" ? "true" : undefined}
            onClick={() => void actions.setAdminFilters("equipment", { category: "all" })}
          >
            전체
          </button>
          {categories.map((category) => (
            <button
              key={category}
              className={`tab-button ${categoryTab === category ? "active" : ""}`}
              type="button"
              aria-current={categoryTab === category ? "true" : undefined}
              onClick={() => void actions.setAdminFilters("equipment", { category })}
            >
              {category}
            </button>
          ))}
        </div>
        <div className="equipment-bulk-bar">
          <label className="table-check">
            <input type="checkbox" checked={allVisibleSelected} onChange={(event) => setAllVisible(event.currentTarget.checked)} />
            <span>전체 선택</span>
          </label>
          <span className="tag">
            {selected.size}개 선택
          </span>
          <div className="bulk-actions" aria-label="선택 기자재 상태 변경">
            <button className="button compact status-button" type="button" data-tone="green" disabled={!selected.size} onClick={() => runAdminAction(() => actions.updateEquipmentStatus([...selected], "가능"))}>
              가능
            </button>
            <button className="button compact status-button" type="button" data-tone="amber" disabled={!selected.size} onClick={() => runAdminAction(() => actions.updateEquipmentStatus([...selected], "수리중"))}>
              수리중
            </button>
            <button className="button compact status-button" type="button" data-tone="red" disabled={!selected.size} onClick={() => runAdminAction(() => actions.updateEquipmentStatus([...selected], "파손"))}>
              파손
            </button>
            <button className="button compact status-button" type="button" data-tone="blue" disabled={!selected.size} onClick={() => runAdminAction(() => actions.updateEquipmentStatus([...selected], "문의"))}>
              문의
            </button>
            <button
              className="button danger compact icon-only-action"
              type="button"
              disabled={!selected.size}
              onClick={() => runAdminAction(() => actions.deleteEquipment([...selected]))}
              aria-label="선택 기자재 제거"
              title="선택 기자재 제거"
            >
              {renderTrashIcon()}
            </button>
          </div>
        </div>
        <div className="table-wrap embedded admin-equipment-scroll-region admin-equipment-table-wrap">
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
                  <tr key={item.id} className={selected.has(item.id) ? "selected" : ""}>
                    <td className="check-col">
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={(event) => setSelected(item.id, event.currentTarget.checked)}
                        aria-label={`${item.code || item.id} ${item.name || "기자재"} 선택`}
                      />
                    </td>
                    <td data-label="코드">{item.code || "-"}</td>
                    <td data-label="장비">
                      {item.name || "-"}
                      {item.notes ? (
                        <>
                          <br />
                          <span className="muted">{item.notes}</span>
                        </>
                      ) : null}
                    </td>
                    <td data-label="분류">{item.category || "-"}</td>
                    <td data-label="관리처">{sourceLabel(String(item.source || item.facility || ""))}</td>
                    <td data-label="상태">
                      <div className="equipment-status-buttons">
                        {renderStatusButton(item, "가능", setStatus)}
                        {renderStatusButton(item, "수리중", setStatus)}
                        {renderStatusButton(item, "파손", setStatus)}
                        {renderStatusButton(item, "문의", setStatus)}
                      </div>
                    </td>
                    <td data-label="예약">{renderReservableTag(item)}</td>
                    <td data-label="작업">
                      <button
                        className="button danger compact icon-only-action"
                        type="button"
                        onClick={() => runAdminAction(() => actions.deleteEquipment([item.id]))}
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
        <div className="admin-equipment-mobile-list" aria-label="기자재 모바일 목록">
          {filtered.length ? (
            filtered.map((item) => (
              <React.Fragment key={`mobile:${item.id}`}>
                {renderEquipmentMobileCard(item, selected, setSelected, setStatus, (itemId) => runAdminAction(() => actions.deleteEquipment([itemId])))}
              </React.Fragment>
            ))
          ) : (
            <GjuEmptyState
              title={query ? "검색 결과가 없습니다." : "등록된 기자재가 없습니다."}
              message={query ? "검색어를 지우거나 탭 필터를 변경하세요." : undefined}
            />
          )}
        </div>
      </GjuCard>
    </section>
  );
}
