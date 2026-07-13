import React, { useMemo, useState } from "react";

import { GjuButton, GjuCard, GjuEmptyState, GjuStatusBadge, GjuTabs, gjuTabId } from "../../design-system";
import { ScreenHeader } from "../components/StudentPrimitives";
import type { StudentActions, StudentLecture, StudentState } from "../types";

function lectureYear(lecture: StudentLecture) {
  return String(lecture.lectureDate || "").slice(0, 4);
}

function statusTone(status = "") {
  if (status === "모집중") return "green" as const;
  if (status === "취소") return "red" as const;
  return "amber" as const;
}

function LectureCard({ lecture, actions, approved }: { lecture: StudentLecture; actions: StudentActions; approved: boolean }) {
  const status = lecture.status || "모집중";
  const count = lecture.capacity ? `${lecture.applicationCount || 0}/${lecture.capacity}` : `${lecture.applicationCount || 0}`;
  const canApply = approved && status === "모집중" && !lecture.applied;
  const canCancel = Boolean(lecture.applied && lecture.canCancelApplication);
  const [operation, setOperation] = useState<"" | "apply" | "cancel">("");
  const [error, setError] = useState("");

  async function run(nextOperation: "apply" | "cancel") {
    if (operation) return;
    setError("");
    setOperation(nextOperation);
    try {
      if (nextOperation === "apply") await actions.applyLecture(lecture.id);
      else await actions.cancelLecture(lecture.id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "특강 요청을 처리하지 못했습니다.");
    } finally {
      setOperation("");
    }
  }

  return (
    <GjuCard title={lecture.title} eyebrow={lecture.lectureDate || "일정 미정"} className="student-react-lecture-card">
      <div className="chips"><GjuStatusBadge tone={statusTone(status)}>{status}</GjuStatusBadge>{lecture.applied ? <GjuStatusBadge tone="blue">신청완료</GjuStatusBadge> : null}</div>
      <div className="lecture-meta-grid">
        <div><b>시간</b><span>{lecture.time || "-"}</span></div>
        <div><b>장소</b><span>{lecture.location || "-"}</span></div>
        <div><b>강사</b><span>{lecture.instructorName || lecture.professor || "-"}</span></div>
        <div><b>정원</b><span>{count}명</span></div>
      </div>
      {lecture.description ? <details className="lecture-details"><summary>상세 일정 더보기</summary><p>{lecture.description}</p></details> : null}
      {lecture.notes ? <p className="lecture-note">비고: {lecture.notes}</p> : null}
      {error ? <p className="student-react-submit-error" role="alert">{error}</p> : null}
      <div className="row-actions">
        {canApply ? <GjuButton icon="check" loading={operation === "apply"} disabled={Boolean(operation)} onClick={() => void run("apply")}>신청</GjuButton> : null}
        {lecture.applied ? <GjuButton icon="x" tone="danger" loading={operation === "cancel"} disabled={!canCancel || Boolean(operation)} onClick={() => void run("cancel")}>신청 취소</GjuButton> : null}
      </div>
    </GjuCard>
  );
}

export function LecturesScreen({ state, actions }: { state: StudentState; actions: StudentActions }) {
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("all");
  const years = useMemo(() => [...new Set(state.lectures.map(lectureYear).filter(Boolean))].sort().reverse(), [state.lectures]);
  const filtered = useMemo(() => state.lectures.filter((lecture) => {
    const haystack = [lecture.title, lecture.lectureDate, lecture.time, lecture.location, lecture.instructorName, lecture.description, lecture.status].filter(Boolean).join(" ").toLowerCase();
    return (year === "all" || lectureYear(lecture) === year) && (!query.trim() || haystack.includes(query.trim().toLowerCase()));
  }), [query, state.lectures, year]);
  const tabsId = "student-lecture-year";
  const panelId = "student-lecture-results";

  return (
    <section className="grid student-react-lectures">
      <ScreenHeader title="비교과 특강" description="모집 상태와 정원을 확인하고 필요한 특강을 신청하세요." />
      <GjuCard title="특강 찾기">
        <div className="field"><label htmlFor="student-lecture-search">특강 검색</label><input id="student-lecture-search" className="input" value={query} placeholder="특강명·강사·장소 검색" onChange={(event) => setQuery(event.target.value)} /></div>
        <GjuTabs
          id={tabsId}
          panelId={panelId}
          ariaLabel="특강 연도"
          items={[{ key: "all", label: "전체" }, ...years.map((item) => ({ key: item, label: `${item}년` }))]}
          activeKey={year}
          onChange={setYear}
        />
      </GjuCard>
      <div id={panelId} role="tabpanel" aria-labelledby={gjuTabId(tabsId, year)} tabIndex={0} className="grid student-react-tab-panel">
        {filtered.length ? filtered.map((lecture) => <LectureCard key={lecture.id} lecture={lecture} actions={actions} approved={state.user.approvalStatus === "approved"} />) : <GjuEmptyState title="조건에 맞는 비교과 특강이 없습니다." message="검색어나 연도 필터를 조정해 주세요." />}
      </div>
    </section>
  );
}
