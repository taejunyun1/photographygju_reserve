import React, { useRef, useState } from "react";

import { GjuButton, GjuCard, GjuEmptyState, GjuStatusBadge } from "../../design-system";
import { FavoriteEquipmentSheet } from "../components/FavoriteEquipmentSheet";
import { CourseDemandSurveySheet } from "../components/CourseDemandSurveySheet";
import { FacilityCard, LectureSummary, NoticeList, ReservationCard, ScreenHeader } from "../components/StudentPrimitives";
import type { StudentActions, StudentState } from "../types";

const APPROVAL_LABELS: Record<string, string> = {
  approval_pending: "승인 대기",
  approved: "승인 완료",
  rejected: "반려",
  blocked: "대여금지"
};

const RESERVATION_TYPE_LABELS: Record<string, string> = {
  equipment: "기자재",
  studio: "스튜디오",
  darkroom: "암실",
  print: "출력실"
};

function courseDemandDeadline(value?: string) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" }).format(date);
}

export function HomeScreen({ state, actions }: { state: StudentState; actions: StudentActions }) {
  const [favoriteSheetOpen, setFavoriteSheetOpen] = useState(false);
  const [courseDemandSurveyId, setCourseDemandSurveyId] = useState("");
  const favoriteTriggerRef = useRef<HTMLSpanElement>(null);
  const nextReservation = state.myReservations
    .filter((item) => !["cancelled", "admin_cancelled", "rejected"].includes(item.status || ""))
    .slice()
    .sort((a, b) => String(a.fields.reservedDate || "").localeCompare(String(b.fields.reservedDate || "")))[0];
  const lectures = state.lectures.filter((lecture) => (lecture.status || "모집중") === "모집중").slice(0, 3);
  const notices = state.bootstrap.notices.slice(0, 3);
  const approved = state.user.approvalStatus === "approved";
  const equipmentById = new Map((state.bootstrap.equipment || []).map((item) => [item.id, item]));
  const courseDemandSurveys = state.courseDemandSurveys || [];
  const activeCourseDemandSurvey = courseDemandSurveys.find((survey) => survey.id === courseDemandSurveyId) || null;
  const courseDemandSurvey = courseDemandSurveys.find((survey) => survey.isOpen) || courseDemandSurveys[0] || null;
  const courseDemandSummary = (() => {
    if (!approved) {
      return { tone: "amber" as const, label: "승인 후 이용", message: "계정 승인 후 내 학년의 수요조사를 이곳에서 확인할 수 있습니다." };
    }
    if (!courseDemandSurvey) {
      return { tone: "neutral" as const, label: "진행 전", message: "진행 중인 수요조사가 없습니다. 설문이 공개되면 이곳에서 바로 응답할 수 있습니다." };
    }
    if (courseDemandSurvey.isOpen) {
      const selectedCount = courseDemandSurvey.response?.rankings?.length || 0;
      const deadline = courseDemandDeadline(courseDemandSurvey.closesAt);
      return {
        tone: "blue" as const,
        label: "응답 기간",
        message: selectedCount
          ? `${selectedCount}개 과목 응답을 저장했습니다.${deadline ? ` ${deadline}까지 수정할 수 있습니다.` : ""}`
          : `희망 과목을 1~5순위로 선택해 주세요.${deadline ? ` ${deadline}까지 응답할 수 있습니다.` : ""}`
      };
    }
    if (courseDemandSurvey.status === "closed") {
      return {
        tone: courseDemandSurvey.response ? "green" as const : "neutral" as const,
        label: courseDemandSurvey.response ? "응답 완료" : "마감됨",
        message: courseDemandSurvey.response ? "제출한 희망 과목은 다음 학기 개설 편성에 반영됩니다." : "이번 수요조사는 마감되었습니다."
      };
    }
    return { tone: "neutral" as const, label: "준비 중", message: "관리자가 설문을 공개하면 이곳에서 바로 응답할 수 있습니다." };
  })();

  function closeFavoriteSheet() {
    setFavoriteSheetOpen(false);
    setTimeout(() => favoriteTriggerRef.current?.querySelector<HTMLButtonElement>("button")?.focus(), 0);
  }

  function startFavoriteEquipment(equipmentId: string) {
    void actions.startReservation("equipment");
    void actions.updateReservationSelection({ type: "equipment", equipmentItemIds: [equipmentId] });
  }

  return (
    <section className="grid student-react-home">
      <ScreenHeader title={`안녕하세요, ${state.user.name}님`} description="오늘 확인할 예약과 공지를 정리했습니다." />
      {!approved ? (
        <GjuCard title="승인 대기" className="notice">
          <p className="muted">학과 관리자 승인 후 예약할 수 있습니다. 공지는 승인 전에도 확인할 수 있습니다.</p>
          <GjuStatusBadge tone="amber">{APPROVAL_LABELS[state.user.approvalStatus || ""] || "승인 대기"}</GjuStatusBadge>
        </GjuCard>
      ) : null}

      <GjuCard title="다음 학기 희망 과목 조사" eyebrow="개설 수요조사" className="student-react-course-demand-card">
        <div className="student-react-course-demand-card__status">
          <GjuStatusBadge tone={courseDemandSummary.tone}>{courseDemandSummary.label}</GjuStatusBadge>
          <span>수강신청 전 개설 수요를 확인합니다.</span>
        </div>
        <div className="student-react-course-demand-card__actions">
          <span>{courseDemandSummary.message}</span>
          {approved && courseDemandSurvey?.isOpen ? (
            <GjuButton onClick={() => setCourseDemandSurveyId(courseDemandSurvey.id)}>{courseDemandSurvey.response ? "응답 수정" : "응답하기"}</GjuButton>
          ) : null}
        </div>
      </GjuCard>

      <section className="home-quick-actions" aria-label="예약 바로가기">
        <div className="home-section-label"><strong>예약</strong><span>바로가기</span></div>
        <div className="facility-grid">
          {(["equipment", "studio", "darkroom", "print"] as const).map((type) => <FacilityCard key={type} type={type} onSelect={actions.startReservation} />)}
        </div>
      </section>

      {nextReservation ? (
        <section className="surface-stack next-reservation-section">
          <h2>다음 예약</h2>
          <ReservationCard
            reservation={nextReservation}
            onCancel={actions.cancelReservation}
            onCancelLecture={actions.cancelLecture}
            onReport={actions.openReport}
            lectureCanCancel={nextReservation.type === "lecture"
              ? state.lectures.find((lecture) => lecture.id === nextReservation.lecture?.id)?.canCancelApplication
              : undefined}
            today={state.today}
          />
        </section>
      ) : (
        <GjuEmptyState title="예정된 예약이 없습니다." action={<GjuButton onClick={() => actions.setView("reserve")}>예약 시작</GjuButton>} />
      )}

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

      <CourseDemandSurveySheet
        open={Boolean(activeCourseDemandSurvey)}
        survey={activeCourseDemandSurvey}
        onClose={() => setCourseDemandSurveyId("")}
        onSave={(surveyId, rankings) => actions.saveCourseDemandResponse(surveyId, rankings)}
      />

      <GjuCard title="공지사항" actions={<GjuButton variant="ghost" onClick={() => actions.setView("notices")}>전체 보기</GjuButton>}>
        <NoticeList notices={notices} onOpen={(id) => {
          void actions.openNotice(id);
          void actions.setView("notices");
        }} />
      </GjuCard>

      <GjuCard title="모집중인 특강" actions={<GjuButton variant="ghost" onClick={() => actions.setView("lectures")}>전체 보기</GjuButton>}>
        {lectures.length ? lectures.map((lecture) => <LectureSummary key={lecture.id} lecture={lecture} onOpen={() => actions.setView("lectures")} />) : <p className="muted">현재 신청 가능한 특강이 없습니다.</p>}
      </GjuCard>
    </section>
  );
}
