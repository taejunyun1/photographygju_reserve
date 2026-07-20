import React, { useEffect, useMemo, useRef, useState } from "react";

import { GjuButton, GjuDialog, GjuEmptyState } from "../../design-system";
import type { StudentEquipment, StudentFavoriteEquipmentGroup } from "../types";

type FavoriteEquipmentSheetProps = {
  open: boolean;
  groups: readonly StudentFavoriteEquipmentGroup[];
  equipment: readonly StudentEquipment[];
  onClose: () => void;
  onSave: (groups: readonly StudentFavoriteEquipmentGroup[]) => Promise<void> | void;
};

const MAX_GROUPS = 3;
const MAX_ITEMS_PER_GROUP = 5;

type FavoriteGroupDraft = {
  id: string;
  name: string;
  equipmentItemIds: string[];
};

function copyGroups(groups: readonly StudentFavoriteEquipmentGroup[]): FavoriteGroupDraft[] {
  return groups.map((group) => ({
    id: group.id,
    name: group.name,
    equipmentItemIds: [...group.equipmentItemIds]
  }));
}

function nextGroup(groups: readonly FavoriteGroupDraft[]): FavoriteGroupDraft {
  const number = groups.length + 1;
  return {
    id: `favorite-draft-${Date.now()}-${number}`,
    name: `그룹 ${number}`,
    equipmentItemIds: [] as string[]
  };
}

export function FavoriteEquipmentSheet({ open, groups, equipment, onClose, onSave }: FavoriteEquipmentSheetProps) {
  const [draftGroups, setDraftGroups] = useState<FavoriteGroupDraft[]>(() => copyGroups(groups));
  const [activeGroupId, setActiveGroupId] = useState(groups[0]?.id || "");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const groupTabRefs = useRef(new Map<string, HTMLButtonElement>());
  const groupAddRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const next = copyGroups(groups);
    setDraftGroups(next);
    setActiveGroupId(next[0]?.id || "");
    setQuery("");
    setError("");
    focusGroupOrAdd(next[0]?.id || "");
  }, [groups, open]);

  const activeGroup = draftGroups.find((group) => group.id === activeGroupId);
  const equipmentById = useMemo(() => new Map(equipment.map((item) => [item.id, item])), [equipment]);
  const filteredEquipment = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return equipment
      .filter((item) => item.active !== false && item.reservable !== false)
      .filter((item) => !needle || [item.code, item.name, item.category].filter(Boolean).join(" ").toLowerCase().includes(needle))
      .slice(0, 20);
  }, [equipment, query]);

  function updateActiveGroup(updater: (group: FavoriteGroupDraft) => FavoriteGroupDraft) {
    if (!activeGroup) return;
    setDraftGroups((current) => current.map((group) => group.id === activeGroup.id ? updater(group) : group));
  }

  function focusGroupOrAdd(groupId: string) {
    setTimeout(() => {
      const groupTab = groupId ? groupTabRefs.current.get(groupId) : undefined;
      const addGroupButton = groupAddRef.current?.querySelector<HTMLButtonElement>("button");
      (groupTab || addGroupButton)?.focus();
    }, 0);
  }

  function addGroup() {
    if (draftGroups.length >= MAX_GROUPS) {
      setError("즐겨찾기 그룹은 최대 3개까지 만들 수 있습니다.");
      return;
    }
    const group = nextGroup(draftGroups);
    setDraftGroups((current) => [...current, group]);
    setActiveGroupId(group.id);
    setError("");
    focusGroupOrAdd(group.id);
  }

  function removeGroup(groupId: string) {
    const removedIndex = Math.max(0, draftGroups.findIndex((group) => group.id === groupId));
    const next = draftGroups.filter((group) => group.id !== groupId);
    const replacementGroup = next.length ? next[Math.min(removedIndex, next.length - 1)] : undefined;
    setDraftGroups(next);
    setActiveGroupId(replacementGroup?.id || "");
    setError("");
    focusGroupOrAdd(replacementGroup?.id || "");
  }

  function addEquipment(equipmentId: string) {
    if (!activeGroup) return;
    if (activeGroup.equipmentItemIds.includes(equipmentId)) return;
    if (activeGroup.equipmentItemIds.length >= MAX_ITEMS_PER_GROUP) {
      setError("한 그룹에는 장비를 최대 5개까지 담을 수 있습니다.");
      return;
    }
    const usedBy = draftGroups.find((group) => group.id !== activeGroup.id && group.equipmentItemIds.includes(equipmentId));
    if (usedBy && !(globalThis.confirm?.(`\"${usedBy.name}\" 그룹에서 이 장비를 옮길까요?`) ?? true)) return;
    setDraftGroups((current) => current.map((group) => {
      if (group.id === activeGroup.id) return { ...group, equipmentItemIds: [...group.equipmentItemIds, equipmentId] };
      return usedBy?.id === group.id ? { ...group, equipmentItemIds: group.equipmentItemIds.filter((id) => id !== equipmentId) } : group;
    }));
    setError("");
  }

  async function save() {
    if (saving) return;
    if (draftGroups.some((group) => !group.name.trim())) {
      setError("모든 그룹의 이름을 입력하세요.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(draftGroups.map((group) => ({ ...group, name: group.name.trim() })));
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "즐겨찾기를 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <GjuDialog
      open={open}
      title="즐겨찾는 장비 관리"
      className="student-react-favorite-sheet"
      onClose={onClose}
      showActions={false}
    >
      <div className="student-react-favorite-sheet__content">
        <p className="muted">자주 쓰는 장비를 최대 3개 그룹으로 나누고, 그룹마다 5개까지 담을 수 있습니다.</p>
        <div className="student-react-favorite-sheet__group-actions">
          <div className="student-react-favorite-sheet__groups" role="tablist" aria-label="즐겨찾기 그룹">
            {draftGroups.map((group) => (
              <button
                key={group.id}
                type="button"
                className="student-react-favorite-sheet__group-tab"
                role="tab"
                aria-selected={group.id === activeGroupId}
                ref={(node) => {
                  if (node) groupTabRefs.current.set(group.id, node);
                  else groupTabRefs.current.delete(group.id);
                }}
                onClick={() => setActiveGroupId(group.id)}
              >
                {group.name || "이름 없는 그룹"}
              </button>
            ))}
          </div>
          <span ref={groupAddRef}><GjuButton variant="outline" icon="plus" disabled={draftGroups.length >= MAX_GROUPS} onClick={addGroup}>그룹 추가</GjuButton></span>
        </div>

        {!activeGroup ? (
          <GjuEmptyState title="첫 즐겨찾기 그룹을 만들어 보세요." message="그룹을 만들면 장비를 검색해 바로 담을 수 있습니다." action={<GjuButton icon="plus" onClick={addGroup}>그룹 만들기</GjuButton>} />
        ) : (
          <div className="student-react-favorite-sheet__editor" role="tabpanel">
            <div className="student-react-favorite-sheet__group-name">
              <div className="field">
                <label htmlFor="favorite-group-name">그룹 이름</label>
                <input
                  id="favorite-group-name"
                  className="input"
                  maxLength={12}
                  value={activeGroup.name}
                  onChange={(event) => updateActiveGroup((group) => ({ ...group, name: event.target.value }))}
                />
              </div>
              <GjuButton variant="ghost" tone="danger" icon="trash" onClick={() => removeGroup(activeGroup.id)}>그룹 삭제</GjuButton>
            </div>

            <div className="student-react-favorite-sheet__selected" aria-label="선택한 즐겨찾기 장비">
              <strong>선택한 장비 {activeGroup.equipmentItemIds.length}/{MAX_ITEMS_PER_GROUP}</strong>
              {activeGroup.equipmentItemIds.length ? (
                <ul>
                  {activeGroup.equipmentItemIds.map((itemId) => {
                    const item = equipmentById.get(itemId);
                    return (
                      <li key={itemId}>
                        <span>{item?.name || itemId}</span>
                        <button type="button" onClick={() => updateActiveGroup((group) => ({ ...group, equipmentItemIds: group.equipmentItemIds.filter((id) => id !== itemId) }))} aria-label={`${item?.name || itemId} 제거`}>제거</button>
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="muted">아래 검색 결과에서 장비를 추가하세요.</p>}
            </div>

            <div className="field">
              <label htmlFor="favorite-equipment-search">장비 검색</label>
              <input id="favorite-equipment-search" className="input" value={query} placeholder="장비명, 코드, 분류" onChange={(event) => setQuery(event.target.value)} />
            </div>
            <div className="student-react-favorite-sheet__results" aria-live="polite">
              {filteredEquipment.map((item) => {
                const selected = activeGroup.equipmentItemIds.includes(item.id);
                return (
                  <button key={item.id} type="button" className="student-react-favorite-sheet__result" disabled={selected} onClick={() => addEquipment(item.id)}>
                    <span><strong>{item.name || item.code || "장비"}</strong><small>{[item.code, item.category].filter(Boolean).join(" · ")}</small></span>
                    <em>{selected ? "추가됨" : "추가"}</em>
                  </button>
                );
              })}
              {!filteredEquipment.length ? <p className="muted">검색 조건에 맞는 예약 가능 장비가 없습니다.</p> : null}
            </div>
          </div>
        )}
        {error ? <p className="student-react-submit-error" role="alert">{error}</p> : null}
        <div className="student-react-favorite-sheet__footer">
          <GjuButton variant="ghost" onClick={onClose}>취소</GjuButton>
          <GjuButton icon="check" loading={saving} onClick={() => void save()}>저장</GjuButton>
        </div>
      </div>
    </GjuDialog>
  );
}
