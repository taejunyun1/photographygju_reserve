import React, { useEffect, useMemo, useState } from "react";

import { GjuButton, GjuDialog, GjuEmptyState } from "../../design-system";
import type { StudentCourseDemandRanking, StudentCourseDemandSurvey } from "../types";

type CourseDemandSurveySheetProps = {
  open: boolean;
  survey: StudentCourseDemandSurvey | null;
  onClose: () => void;
  onSave: (surveyId: string, rankings: readonly StudentCourseDemandRanking[]) => Promise<void> | void;
};

function sortedRankings(rankings: readonly StudentCourseDemandRanking[]) {
  return rankings
    .map((ranking) => ({ courseId: String(ranking.courseId || ""), rank: Number(ranking.rank) }))
    .filter((ranking) => ranking.courseId && ranking.rank > 0)
    .sort((left, right) => left.rank - right.rank)
    .map((ranking, index) => ({ ...ranking, rank: index + 1 }));
}

export function CourseDemandSurveySheet({ open, survey, onClose, onSave }: CourseDemandSurveySheetProps) {
  const [rankings, setRankings] = useState<StudentCourseDemandRanking[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setRankings(sortedRankings(survey?.response?.rankings || []));
    setSaving(false);
    setError("");
  }, [open, survey?.id, survey?.response?.submittedAt]);

  const coursesById = useMemo(() => new Map((survey?.catalog || []).map((course) => [course.id, course])), [survey]);
  const selectedIds = new Set(rankings.map((ranking) => ranking.courseId));

  function addCourse(courseId: string) {
    if (selectedIds.has(courseId)) {
      setRankings((current) => sortedRankings(current.filter((ranking) => ranking.courseId !== courseId)));
      return;
    }
    if (rankings.length >= 5) {
      setError("희망 과목은 최대 5개까지 선택할 수 있습니다.");
      return;
    }
    setRankings((current) => [...sortedRankings(current), { courseId, rank: current.length + 1 }]);
    setError("");
  }

  function move(courseId: string, offset: number) {
    const index = rankings.findIndex((ranking) => ranking.courseId === courseId);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= rankings.length) return;
    const next = [...rankings];
    [next[index], next[target]] = [next[target], next[index]];
    setRankings(sortedRankings(next));
  }

  async function save() {
    if (!survey || saving) return;
    if (!rankings.length) {
      setError("희망 과목을 1개 이상 선택하세요.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(survey.id, sortedRankings(rankings));
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "수요조사 응답을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <GjuDialog open={open} title="다음 학기 희망 과목 조사" className="student-react-course-demand-sheet" onClose={onClose} showActions={false}>
      <div className="student-react-course-demand-sheet__content">
        <p className="muted">수강신청이 아닌 개설 수요조사입니다. 희망 과목을 1~5순위로 정해 주세요.</p>
        {!survey ? <GjuEmptyState title="설문을 찾을 수 없습니다." /> : (
          <>
            <section className="student-react-course-demand-sheet__rankings" aria-label="선택한 희망 과목 순위">
              <div><strong>선택한 과목 {rankings.length}/5</strong><span>1~5순위</span></div>
              {rankings.length ? <ol>
                {rankings.map((ranking, index) => {
                  const course = coursesById.get(ranking.courseId);
                  return <li key={ranking.courseId}>
                    <strong>{ranking.rank}순위</strong>
                    <span>{course?.name || "과목"}{course?.studentCredit ? ` · ${course.studentCredit}학점` : ""}</span>
                    <div>
                      <button type="button" aria-label={`${course?.name || "과목"} 순위 올리기`} disabled={index === 0} onClick={() => move(ranking.courseId, -1)}>↑</button>
                      <button type="button" aria-label={`${course?.name || "과목"} 순위 내리기`} disabled={index === rankings.length - 1} onClick={() => move(ranking.courseId, 1)}>↓</button>
                      <button type="button" aria-label={`${course?.name || "과목"} 선택 해제`} onClick={() => addCourse(ranking.courseId)}>해제</button>
                    </div>
                  </li>;
                })}
              </ol> : <p className="muted">아래 후보에서 희망 과목을 선택하세요.</p>}
            </section>
            <section className="student-react-course-demand-sheet__catalog" aria-label="희망 과목 후보">
              <h3>과목 후보</h3>
              {(survey.catalog || []).map((course) => <button key={course.id} type="button" data-selected={selectedIds.has(course.id) ? "true" : "false"} onClick={() => addCourse(course.id)}>
                <span><strong>{course.name}</strong><small>{course.courseCode ? `${course.courseCode} · ` : ""}{course.studentCredit ? `${course.studentCredit}학점` : "학점 확인 필요"}</small></span>
                <em>{selectedIds.has(course.id) ? "선택 해제" : "선택"}</em>
              </button>)}
            </section>
            {error ? <p className="student-react-course-demand-sheet__error" role="alert">{error}</p> : null}
            <div className="student-react-course-demand-sheet__footer">
              <GjuButton variant="ghost" onClick={onClose}>취소</GjuButton>
              <GjuButton disabled={saving || !survey.isOpen} onClick={() => void save()}>{saving ? "저장 중" : "응답 저장"}</GjuButton>
            </div>
          </>
        )}
      </div>
    </GjuDialog>
  );
}
