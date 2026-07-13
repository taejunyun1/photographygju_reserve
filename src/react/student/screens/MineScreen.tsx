import React, { useMemo, useState } from "react";

import { GjuCard, GjuEmptyState, GjuTabs, gjuTabId } from "../../design-system";
import { ReservationCard, ScreenHeader } from "../components/StudentPrimitives";
import type { StudentActions, StudentState } from "../types";

const FILTERS = [
  { key: "all", label: "전체" },
  { key: "equipment", label: "기자재" },
  { key: "studio", label: "스튜디오" },
  { key: "darkroom", label: "암실" },
  { key: "print", label: "출력실" },
  { key: "lecture", label: "특강" }
];

function dateOffset(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function reservationDate(item: StudentState["myReservations"][number]) {
  return String(item.fields.reservedDate || item.lecture?.lectureDate || "");
}

function reservationSearchText(item: StudentState["myReservations"][number]) {
  return [
    item.id,
    item.type,
    item.status,
    item.fields,
    item.lecture,
    item.equipmentItems
  ].map((value) => typeof value === "string" ? value : JSON.stringify(value || "")).join(" ").toLowerCase();
}

export function MineScreen({ state, actions }: { state: StudentState; actions: StudentActions }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [pastOpen, setPastOpen] = useState(false);
  const reservations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return state.myReservations
      .filter((item) => filter === "all" || item.type === filter)
      .filter((item) => !normalizedQuery || reservationSearchText(item).includes(normalizedQuery))
      .slice()
      .sort((left, right) => reservationDate(right).localeCompare(reservationDate(left)));
  }, [filter, query, state.myReservations]);
  const cutoff = dateOffset(state.today || new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date()), -5);
  const recent = reservations.filter((item) => !reservationDate(item) || reservationDate(item) >= cutoff);
  const past = reservations.filter((item) => reservationDate(item) && reservationDate(item) < cutoff);
  const tabsId = "student-mine-category";
  const panelId = "student-mine-results";

  return (
    <section className="grid student-react-mine">
      <ScreenHeader title="내 예약" description="최근 예약과 지난 예약을 확인합니다." />
      <GjuCard title="내 예약 찾기">
        <div className="field">
          <label htmlFor="student-mine-search">내 예약 검색</label>
          <input id="student-mine-search" className="input" type="search" value={query} placeholder="날짜·종류·상태·장비·장소 검색" onChange={(event) => setQuery(event.target.value)} />
        </div>
        <GjuTabs
          id={tabsId}
          panelId={panelId}
          ariaLabel="내 예약 카테고리"
          items={FILTERS}
          activeKey={filter}
          onChange={setFilter}
          className="student-react-filter-tabs"
        />
      </GjuCard>
      <div id={panelId} role="tabpanel" aria-labelledby={gjuTabId(tabsId, filter)} tabIndex={0} className="grid student-react-tab-panel">
        <div className="student-react-section-heading"><strong>최근 예약</strong><span>{recent.length}건</span></div>
        {recent.length ? recent.map((reservation) => (
          <ReservationCard
            key={reservation.id}
            reservation={reservation}
            onCancel={actions.cancelReservation}
            onCancelLecture={actions.cancelLecture}
            onReport={actions.openReport}
            lectureCanCancel={reservation.type === "lecture"
              ? state.lectures.find((lecture) => lecture.id === reservation.lecture?.id)?.canCancelApplication
              : undefined}
            today={state.today}
          />
        )) : <GjuEmptyState title="최근 예약이 없습니다." message={query ? "검색어를 지우거나 다른 카테고리를 선택하세요." : "새로운 예약을 시작해 보세요."} />}
        <section className={`student-react-past-reservations${pastOpen ? " is-open" : ""}`}>
          <button type="button" className="student-react-past-toggle" aria-expanded={pastOpen} onClick={() => setPastOpen((current) => !current)}>
            <span><strong>지난 예약</strong><small>5일 이전 {past.length}건</small></span>
            <b>{pastOpen ? "접기" : "펼치기"}</b>
          </button>
          {pastOpen ? (
            <div className="grid">
              {past.length ? past.map((reservation) => (
                <ReservationCard
                  key={reservation.id}
                  reservation={reservation}
                  onCancel={actions.cancelReservation}
                  onCancelLecture={actions.cancelLecture}
                  onReport={actions.openReport}
                  lectureCanCancel={reservation.type === "lecture"
                    ? state.lectures.find((lecture) => lecture.id === reservation.lecture?.id)?.canCancelApplication
                    : undefined}
                  today={state.today}
                />
              )) : <GjuEmptyState title="지난 예약이 없습니다." />}
            </div>
          ) : null}
        </section>
      </div>
    </section>
  );
}
