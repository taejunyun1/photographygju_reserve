import React, { useRef, useState } from "react";

import { GjuButton, GjuCard } from "../../design-system";
import { FavoriteEquipmentSheet } from "./FavoriteEquipmentSheet";
import type { StudentActions, StudentState } from "../types";

const RESERVATION_TYPE_LABELS: Record<string, string> = { equipment: "기자재", studio: "스튜디오", darkroom: "암실", print: "출력실", lecture: "특강" };

export function ReservationShortcuts({ state, actions }: { state: StudentState; actions: StudentActions }) {
  const [favoriteSheetOpen, setFavoriteSheetOpen] = useState(false);
  const favoriteTriggerRef = useRef<HTMLSpanElement>(null);
  const equipmentById = new Map((state.bootstrap.equipment || []).map((item) => [item.id, item]));

  function closeFavoriteSheet() {
    setFavoriteSheetOpen(false);
    setTimeout(() => favoriteTriggerRef.current?.querySelector<HTMLButtonElement>("button")?.focus(), 0);
  }

  function startFavoriteEquipment(equipmentId: string) {
    void actions.startReservation("equipment");
    void actions.updateReservationSelection({ type: "equipment", equipmentItemIds: [equipmentId] });
  }

  return <>
      <GjuCard
        title="빠른 예약"
        eyebrow="즐겨찾기 · 최근 예약"
        className="student-react-quick-reservation"
        actions={<span ref={favoriteTriggerRef}><GjuButton variant="ghost" onClick={() => setFavoriteSheetOpen(true)}>즐겨찾기 관리</GjuButton></span>}
      >
        <div className="student-react-quick-reservation__section">
          <div className="student-react-quick-reservation__heading"><h3>즐겨찾기</h3><span>최대 3개 그룹</span></div>
          {state.favoriteGroups.length ? (
            <div className="student-react-favorite-groups">
              {state.favoriteGroups.map((group) => {
                const groupEquipment = group.equipment?.length
                  ? group.equipment
                  : group.equipmentItemIds.map((id) => equipmentById.get(id)).filter((item): item is NonNullable<typeof item> => Boolean(item));
                return (
                  <section key={group.id} className="student-react-favorite-group" aria-label={`${group.name} 즐겨찾기`}>
                    <h4>{group.name}</h4>
                    {groupEquipment.length ? <div className="student-react-favorite-group__items">
                      {groupEquipment.map((item) => (
                        <button key={item.id} type="button" disabled={item.active === false || item.reservable === false} onClick={() => startFavoriteEquipment(item.id)}>
                          <span>{item.name || item.code || "장비"}</span>
                          <small>{item.active === false || item.reservable === false ? "예약 불가" : "바로 예약"}</small>
                        </button>
                      ))}
                    </div> : <p className="muted">이 그룹에 저장된 장비가 없습니다.</p>}
                  </section>
                );
              })}
            </div>
          ) : <p className="muted">자주 쓰는 장비를 그룹으로 저장해 두면 바로 예약을 시작할 수 있습니다.</p>}
        </div>

        <div className="student-react-quick-reservation__section student-react-quick-reservation__recent">
          <div className="student-react-quick-reservation__heading"><h3>다시 예약</h3><span>최근 3건</span></div>
          {state.recentReservations.length ? <div className="student-react-rebooking-list">
            {state.recentReservations.map((reservation) => (
              <button key={reservation.id} type="button" onClick={() => void actions.startRebooking(reservation.id)}>
                <span><strong>{RESERVATION_TYPE_LABELS[reservation.type] || "예약"}</strong><small>{reservation.fields.purpose ? String(reservation.fields.purpose) : "이전 구성으로 다시 시작"}</small></span>
                <em>다시 예약</em>
              </button>
            ))}
          </div> : <p className="muted">완료한 예약이 생기면 여기에서 같은 구성을 다시 시작할 수 있습니다.</p>}
        </div>
      </GjuCard>

      <FavoriteEquipmentSheet
        open={favoriteSheetOpen}
        groups={state.favoriteGroups}
        equipment={state.bootstrap.equipment || []}
        onClose={closeFavoriteSheet}
        onSave={(groups) => actions.saveFavoriteGroups(groups)}
      />

  </>;
}
