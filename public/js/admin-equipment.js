import { state } from "./state.js?v=20260704-admin-mobile-overflow";
import { api } from "./api.js?v=20260704-admin-mobile-overflow";
import { equipmentAdminStatusOptions } from "./constants.js?v=20260704-admin-mobile-overflow";
import { normalizeSearchText, searchableText, tag } from "./utils.js?v=20260704-admin-mobile-overflow";

export function activeAdminEquipmentItems() {
  return state.adminEquipment.filter((item) => item.active !== false);
}

export function visibleAdminEquipmentItems() {
  const query = normalizeSearchText(state.adminEquipmentSearch).trim();
  return activeAdminEquipmentItems()
    .filter((item) => state.adminEquipmentTab === "all" || item.source === state.adminEquipmentTab)
    .filter((item) => state.adminEquipmentCategoryTab === "all" || item.category === state.adminEquipmentCategoryTab)
    .filter((item) => {
      if (!query) return true;
      return searchableText([
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
      ]).includes(query);
    });
}

export function normalizeAdminEquipmentSelection() {
  const activeIds = new Set(activeAdminEquipmentItems().map((item) => item.id));
  state.selectedAdminEquipmentIds = [...new Set(state.selectedAdminEquipmentIds)].filter((itemId) => activeIds.has(itemId));
  return state.selectedAdminEquipmentIds;
}

export function selectedAdminEquipmentSet() {
  return new Set(normalizeAdminEquipmentSelection());
}

export function setVisibleAdminEquipmentSelection(checked) {
  const visibleIds = visibleAdminEquipmentItems().map((item) => item.id);
  const selected = selectedAdminEquipmentSet();
  visibleIds.forEach((itemId) => {
    if (checked) selected.add(itemId);
    else selected.delete(itemId);
  });
  state.selectedAdminEquipmentIds = [...selected];
}

export function setAdminEquipmentSelection(itemId, checked) {
  const selected = selectedAdminEquipmentSet();
  if (checked) selected.add(itemId);
  else selected.delete(itemId);
  state.selectedAdminEquipmentIds = [...selected];
}

export function mergeAdminEquipmentItems(items) {
  const updates = Array.isArray(items) ? items : [items];
  const byId = new Map(updates.filter(Boolean).map((item) => [item.id, item]));
  const mergeInto = (list) => {
    if (!Array.isArray(list)) return;
    list.forEach((item, index) => {
      const updated = byId.get(item.id);
      if (updated) list[index] = { ...item, ...updated };
    });
  };
  mergeInto(state.adminEquipment);
  if (state.bootstrap?.equipment) mergeInto(state.bootstrap.equipment);
  normalizeAdminEquipmentSelection();
}

export async function patchAdminEquipment(ids, patch) {
  const uniqueIds = [...new Set(ids)].filter(Boolean);
  if (!uniqueIds.length) return [];
  const updated = uniqueIds.length === 1
    ? await api(`/api/admin/equipment/${uniqueIds[0]}`, { method: "PATCH", body: patch, loading: false })
    : await api("/api/admin/equipment/bulk", { method: "PATCH", body: { ids: uniqueIds, patch }, loading: false });
  const items = Array.isArray(updated) ? updated : [updated];
  mergeAdminEquipmentItems(items);
  return items;
}

export function equipmentStatusButtons(item) {
  return `
    <div class="equipment-status-buttons" data-equipment-status-cell="${item.id}">
      ${equipmentAdminStatusOptions.map((status) => {
        const active = status === "문의"
          ? item.status === "가능" && item.reservable === false
          : item.status === status && (status !== "가능" || item.reservable !== false);
        return `
        <button
          class="status-button ${active ? "active" : ""}"
          type="button"
          data-equipment-status-action="${item.id}"
          data-status="${status}"
          aria-pressed="${active ? "true" : "false"}"
        >${status}</button>
      `;
      }).join("")}
    </div>
  `;
}

export function equipmentReservableTag(item) {
  return item.reservable ? tag("가능", "green") : tag("문의", "yellow");
}

export function syncAdminEquipmentDom(updatedItems = []) {
  const updates = Array.isArray(updatedItems) ? updatedItems : [updatedItems];
  updates.filter(Boolean).forEach((item) => {
    document.querySelectorAll(`[data-equipment-row="${item.id}"]`).forEach((row) => {
      if (item.active === false) {
        row.remove();
        return;
      }
      const statusCell = row.querySelector(`[data-equipment-status-cell="${item.id}"]`);
      const reservableCell = row.querySelector(`[data-equipment-reservable-cell="${item.id}"]`);
      if (statusCell) statusCell.outerHTML = equipmentStatusButtons(item).trim();
      if (reservableCell) reservableCell.innerHTML = equipmentReservableTag(item);
      row.dataset.status = item.status || "";
    });
  });
  syncAdminEquipmentSelectionDom();
}

export function syncAdminEquipmentSelectionDom() {
  const selected = selectedAdminEquipmentSet();
  const visibleIds = visibleAdminEquipmentItems().map((item) => item.id);
  const visibleSelectedCount = visibleIds.filter((itemId) => selected.has(itemId)).length;
  document.querySelectorAll("[data-equipment-select]").forEach((input) => {
    input.checked = selected.has(input.dataset.equipmentSelect);
    input.closest("[data-equipment-row]")?.classList.toggle("selected", input.checked);
  });
  document.querySelectorAll("[data-equipment-select-all]").forEach((input) => {
    input.checked = visibleIds.length > 0 && visibleSelectedCount === visibleIds.length;
    input.indeterminate = visibleSelectedCount > 0 && visibleSelectedCount < visibleIds.length;
  });
  document.querySelectorAll("[data-admin-equipment-selected-count]").forEach((node) => {
    node.textContent = `${selected.size}개 선택`;
  });
  document.querySelectorAll("[data-admin-equipment-count]").forEach((node) => {
    node.textContent = `${visibleAdminEquipmentItems().length}개`;
  });
  document.querySelectorAll("[data-equipment-bulk-status], [data-equipment-bulk-remove]").forEach((button) => {
    button.disabled = selected.size === 0;
  });
}
