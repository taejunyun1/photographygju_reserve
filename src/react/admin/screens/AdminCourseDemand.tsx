import React from "react";

import { GjuButton, GjuCard, GjuEmptyState, GjuStatusBadge, GjuTabs } from "../../design-system";
import type {
  AdminCourseDemandSurvey,
  AdminCoursePlanningData,
  AdminCourseRecord,
  CourseDemandCategory,
  LegacyState,
  ReactAdminActions
} from "../../platform/types";

type AdminCourseDemandProps = {
  state: LegacyState;
  actions: ReactAdminActions;
};

const DEMAND_CATEGORIES: ReadonlyArray<{ key: CourseDemandCategory; label: string }> = [
  { key: "art", label: "예술" },
  { key: "documentary", label: "다큐멘터리" },
  { key: "advertising", label: "광고" },
  { key: "video", label: "영상" }
];
const DEMAND_CATEGORY_KEYS = new Set<CourseDemandCategory>(DEMAND_CATEGORIES.map((category) => category.key));
const TERM_LABELS: Record<string, string> = { spring: "1학기", fall: "2학기", vacation: "방학" };
const STATUS_LABELS: Record<string, string> = { draft: "임시저장", open: "공개 중", closed: "마감" };

function planningData(state: LegacyState): AdminCoursePlanningData {
  return state.adminCoursePlanning || { curriculumVersions: [], courses: [], annualPlans: [], surveys: [] };
}

function inputDateTimeValue(date: Date) {
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function isoDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function termLabel(term = "") {
  return TERM_LABELS[term] || "학기 미정";
}

function statusTone(status = "") {
  if (status === "open") return "green" as const;
  if (status === "closed") return "neutral" as const;
  return "amber" as const;
}

function categoryLabel(category?: CourseDemandCategory) {
  return DEMAND_CATEGORIES.find((item) => item.key === category)?.label || "미지정";
}

function toggleNumber(values: number[] = [], value: number, checked: boolean) {
  return checked
    ? [...new Set([...values, value])].sort((left, right) => left - right)
    : values.filter((item) => item !== value);
}

function toggleString(values: string[] = [], value: string, checked: boolean) {
  return checked ? [...new Set([...values, value])] : values.filter((item) => item !== value);
}

function surveyTarget(survey: AdminCourseDemandSurvey) {
  const current = survey.eligibleCurrentYears?.join("·") || "-";
  const target = survey.targetStudentYears?.join("·") || "-";
  return `현재 ${current}학년 · 수강 ${target}학년 · ${termLabel(survey.term)}`;
}

export function AdminCourseDemand({ state, actions }: AdminCourseDemandProps) {
  const planning = planningData(state);
  const [tab, setTab] = React.useState("survey");
  const [courses, setCourses] = React.useState<AdminCourseRecord[]>(planning.courses || []);
  const [title, setTitle] = React.useState(`${new Date().getFullYear() + 1}학년도 교과 수요조사`);
  const [academicYear, setAcademicYear] = React.useState(String(new Date().getFullYear() + 1));
  const [term, setTerm] = React.useState<"spring" | "fall">("fall");
  const [eligibleCurrentYear, setEligibleCurrentYear] = React.useState(2);
  const [targetStudentYear, setTargetStudentYear] = React.useState(2);
  const [opensAt, setOpensAt] = React.useState(() => inputDateTimeValue(new Date()));
  const [closesAt, setClosesAt] = React.useState(() => inputDateTimeValue(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)));
  const [categoryFilter, setCategoryFilter] = React.useState<CourseDemandCategory | "all">("all");
  const [selectedCourseIds, setSelectedCourseIds] = React.useState<string[]>([]);
  const [editingSurveyId, setEditingSurveyId] = React.useState("");
  const [resultSurveyId, setResultSurveyId] = React.useState(planning.surveys[0]?.id || "");

  React.useEffect(() => {
    setCourses(planning.courses || []);
  }, [planning.courses]);

  const candidateCourses = React.useMemo(() => planning.courses
    .filter((course) => course.active !== false && course.isSurveyEligible !== false)
    .filter((course) => course.majorType === "전선" && !course.isMajorRequired)
    .filter((course) => (course.targetYears || []).includes(targetStudentYear))
    .filter((course) => (course.allowedTerms || []).includes(term))
    .filter((course) => Boolean(course.demandCategory && DEMAND_CATEGORY_KEYS.has(course.demandCategory))), [planning.courses, targetStudentYear, term]);
  const visibleCandidates = categoryFilter === "all"
    ? candidateCourses
    : candidateCourses.filter((course) => course.demandCategory === categoryFilter);
  const selectedCourses = selectedCourseIds
    .map((courseId) => planning.courses.find((course) => course.id === courseId))
    .filter((course): course is AdminCourseRecord => Boolean(course));
  const resultSurvey = planning.surveys.find((survey) => survey.id === resultSurveyId) || planning.surveys[0] || null;
  const sortedResults = (resultSurvey?.summary?.courses || []).slice().sort((left, right) =>
    (right.demandScore || 0) - (left.demandScore || 0) || (right.selections || 0) - (left.selections || 0)
  );

  const updateCourse = (courseId: string, patch: Partial<AdminCourseRecord>) => {
    setCourses((current) => current.map((course) => course.id === courseId ? { ...course, ...patch } : course));
  };

  const resetSelectionContext = (nextTerm: "spring" | "fall", nextTargetYear: number) => {
    setTerm(nextTerm);
    setTargetStudentYear(nextTargetYear);
    setSelectedCourseIds([]);
    setEditingSurveyId("");
  };

  const toggleCandidate = (courseId: string) => {
    setSelectedCourseIds((current) => {
      if (current.includes(courseId)) return current.filter((id) => id !== courseId);
      if (current.length >= 6) {
        actions.notify("설문 후보는 최대 6개까지 선택할 수 있습니다.", "error");
        return current;
      }
      return [...current, courseId];
    });
  };

  const surveyInput = (status: "draft" | "open") => ({
    title: title.trim(),
    academicYear: Number(academicYear),
    term,
    eligibleCurrentYears: [eligibleCurrentYear],
    targetStudentYears: [targetStudentYear],
    opensAt: isoDateTime(opensAt),
    closesAt: isoDateTime(closesAt),
    status,
    courseIds: selectedCourseIds
  });

  async function saveSurvey(status: "draft" | "open") {
    if (!title.trim() || !Number.isInteger(Number(academicYear)) || !isoDateTime(opensAt) || !isoDateTime(closesAt)) {
      actions.notify("설문 제목, 학년도, 시작·마감일을 확인하세요.", "error");
      return;
    }
    if (status === "open" && (selectedCourseIds.length < 5 || selectedCourseIds.length > 6)) {
      actions.notify("설문 공개 전 후보 과목을 5개 또는 6개 선택하세요.", "error");
      return;
    }
    const input = surveyInput(status);
    if (editingSurveyId) await actions.updateCourseDemandSurvey(editingSurveyId, input);
    else await actions.createCourseDemandSurvey(input);
    setEditingSurveyId("");
    setSelectedCourseIds([]);
  }

  function editDraft(survey: AdminCourseDemandSurvey) {
    if (survey.status !== "draft") return;
    setEditingSurveyId(survey.id);
    setTitle(survey.title || "교과 수요조사");
    setAcademicYear(String(survey.academicYear || new Date().getFullYear() + 1));
    setTerm(survey.term === "spring" ? "spring" : "fall");
    setEligibleCurrentYear(survey.eligibleCurrentYears?.[0] || 1);
    setTargetStudentYear(survey.targetStudentYears?.[0] || 1);
    setOpensAt(inputDateTimeValue(new Date(survey.opensAt || Date.now())));
    setClosesAt(inputDateTimeValue(new Date(survey.closesAt || Date.now())));
    setSelectedCourseIds((survey.catalogSnapshot || []).map((course) => course.id));
    setCategoryFilter("all");
    setTab("survey");
  }

  return (
    <section className="grid admin-react-screen admin-course-demand">
      <GjuCard title="교과 수요조사" eyebrow="학년·학기별 전공선택 수요 확인" surface="workspace">
        <p className="muted">학생이 실제로 듣고 싶은 전공선택 과목을 카테고리별로 고르고 1~5순위로 제출합니다.</p>
        <GjuTabs
          id="admin-course-demand-tabs"
          ariaLabel="교과 수요조사 관리"
          className="tab-row"
          tabClassName="tab-button"
          items={[{ key: "survey", label: "설문안" }, { key: "courses", label: "과목 관리" }, { key: "results", label: "결과" }]}
          activeKey={tab}
          onChange={setTab}
        />
      </GjuCard>

      {tab === "survey" ? <>
        <GjuCard title={editingSurveyId ? "설문안 편집" : "새 설문안"} surface="workspace">
          <div className="admin-course-demand__builder-fields">
            <label className="admin-course-demand__wide-field">설문 제목<input className="input" value={title} maxLength={100} onChange={(event) => setTitle(event.target.value)} /></label>
            <label>학년도<input className="input" type="number" min="2020" max="2100" value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} /></label>
            <label>학기<select className="input" value={term} onChange={(event) => resetSelectionContext(event.target.value as "spring" | "fall", targetStudentYear)}><option value="spring">1학기</option><option value="fall">2학기</option></select></label>
            <label>현재 학년<select className="input" value={eligibleCurrentYear} onChange={(event) => setEligibleCurrentYear(Number(event.target.value))}>{[1, 2, 3, 4].map((year) => <option key={year} value={year}>{year}학년</option>)}</select></label>
            <label>수강 대상 학년<select className="input" value={targetStudentYear} onChange={(event) => resetSelectionContext(term, Number(event.target.value))}>{[1, 2, 3, 4].map((year) => <option key={year} value={year}>{year}학년</option>)}</select></label>
            <label>시작<input className="input" type="datetime-local" value={opensAt} onChange={(event) => setOpensAt(event.target.value)} /></label>
            <label>마감<input className="input" type="datetime-local" value={closesAt} onChange={(event) => setClosesAt(event.target.value)} /></label>
          </div>

          <div className="admin-course-demand__candidate-head">
            <div><strong>후보 과목</strong><small>{targetStudentYear}학년 · {termLabel(term)} · 전공선택만 표시</small></div>
            <strong aria-live="polite">선택한 후보 {selectedCourseIds.length}/6</strong>
          </div>
          <div className="admin-course-demand__category-tabs" role="tablist" aria-label="수요 카테고리">
            <button type="button" role="tab" aria-selected={categoryFilter === "all"} onClick={() => setCategoryFilter("all")}>전체</button>
            {DEMAND_CATEGORIES.map((category) => <button key={category.key} type="button" role="tab" aria-selected={categoryFilter === category.key} onClick={() => setCategoryFilter(category.key)}>{category.label}</button>)}
          </div>
          {visibleCandidates.length ? <div className="admin-course-demand__candidate-list">
            {visibleCandidates.map((course) => {
              const selected = selectedCourseIds.includes(course.id);
              return <button key={course.id} type="button" aria-pressed={selected} data-selected={selected ? "true" : undefined} onClick={() => toggleCandidate(course.id)}>
                <span><strong>{course.name}</strong><small>{categoryLabel(course.demandCategory)} · {course.studentCredit ?? 0}학점</small></span>
                <b>{selected ? "선택됨" : "선택"}</b>
              </button>;
            })}
          </div> : <GjuEmptyState title="조건에 맞는 후보 과목이 없습니다." message="과목 관리에서 학년·학기·카테고리를 확인하세요." />}

          <div className="admin-course-demand__selected-list" aria-label="선택한 후보">
            {selectedCourses.length ? selectedCourses.map((course, index) => <button key={course.id} type="button" onClick={() => toggleCandidate(course.id)}><b>{index + 1}</b><span>{course.name}</span><small>{categoryLabel(course.demandCategory)} · 제거</small></button>) : <p className="muted">임시저장은 후보 없이도 가능하며, 공개하려면 5~6개를 선택해야 합니다.</p>}
          </div>
          <div className="admin-course-demand__builder-actions">
            <GjuButton variant="outline" onClick={() => void saveSurvey("draft")}>임시저장</GjuButton>
            <GjuButton disabled={selectedCourseIds.length < 5 || selectedCourseIds.length > 6} onClick={() => void saveSurvey("open")}>설문 공개</GjuButton>
          </div>
        </GjuCard>

        <GjuCard title="설문안 목록" surface="workspace">
          {planning.surveys.length ? <div className="admin-course-demand__survey-list">
            {planning.surveys.map((survey) => <article key={survey.id}>
              <div className="admin-course-demand__survey-title"><div><strong>{survey.title || "교과 수요조사"}</strong><small>{surveyTarget(survey)}</small></div><GjuStatusBadge tone={statusTone(survey.status)}>{STATUS_LABELS[survey.status || "draft"] || survey.status}</GjuStatusBadge></div>
              <p>{survey.academicYear || "-"}학년도 · 후보 {survey.catalogCount ?? survey.catalogSnapshot?.length ?? 0}개 · 응답 {survey.summary?.responseCount ?? 0}명</p>
              <small>{survey.opensAt ? new Date(survey.opensAt).toLocaleString("ko-KR") : "-"} ~ {survey.closesAt ? new Date(survey.closesAt).toLocaleString("ko-KR") : "-"}</small>
              <div className="admin-course-demand__survey-actions">
                {survey.status === "draft" ? <GjuButton variant="outline" onClick={() => editDraft(survey)}>설문안 편집</GjuButton> : null}
                {survey.status === "open" ? <GjuButton variant="outline" tone="danger" onClick={() => void actions.updateCourseDemandSurvey(survey.id, { status: "closed" })}>설문 마감</GjuButton> : null}
              </div>
            </article>)}
          </div> : <GjuEmptyState title="등록된 설문안이 없습니다." message="학년과 학기를 정하고 전공선택 후보 5~6개를 골라 공개하세요." />}
        </GjuCard>
      </> : null}

      {tab === "courses" ? <GjuCard title="과목 관리" surface="workspace">
        <p className="muted">전공선택 과목에 학년·학기와 수요 카테고리를 지정하면 설문 후보로 사용할 수 있습니다.</p>
        <form onSubmit={(event) => { event.preventDefault(); void actions.saveCoursePlanningCourses(courses); }}>
          <div className="admin-course-demand__master-list">
            {courses.map((course) => {
              const lockedFieldPractice = course.name === "현장실습4";
              const validCategory = Boolean(course.demandCategory && DEMAND_CATEGORY_KEYS.has(course.demandCategory));
              return <article key={course.id}>
                <div className="admin-course-demand__master-heading"><label>과목명<input className="input" value={course.name} onChange={(event) => updateCourse(course.id, { name: event.target.value })} /></label>{!validCategory ? <GjuStatusBadge tone="amber">카테고리 지정 필요</GjuStatusBadge> : null}</div>
                <div className="admin-course-demand__master-grid">
                  <label>이수 구분<select className="input" value={course.majorType || "전선"} onChange={(event) => updateCourse(course.id, { majorType: event.target.value, isMajorRequired: event.target.value === "전필" })}><option value="전선">전선</option><option value="전필">전필</option></select></label>
                  <label>수요 카테고리<select className="input" value={course.demandCategory || ""} onChange={(event) => updateCourse(course.id, { demandCategory: event.target.value as CourseDemandCategory })}><option value="">선택</option>{DEMAND_CATEGORIES.map((category) => <option key={category.key} value={category.key}>{category.label}</option>)}</select></label>
                  <fieldset><legend>대상 학년</legend>{[1, 2, 3, 4].map((year) => <label key={year}><input type="checkbox" disabled={lockedFieldPractice} checked={(course.targetYears || []).includes(year)} onChange={(event) => updateCourse(course.id, { targetYears: toggleNumber(course.targetYears, year, event.target.checked) })} /> {year}학년</label>)}</fieldset>
                  <fieldset><legend>개설 학기</legend>{[["spring", "1학기"], ["fall", "2학기"], ["vacation", "방학"]].map(([value, label]) => <label key={value}><input type="checkbox" disabled={lockedFieldPractice} checked={(course.allowedTerms || []).includes(value)} onChange={(event) => updateCourse(course.id, { allowedTerms: toggleString(course.allowedTerms, value, event.target.checked) })} /> {label}</label>)}</fieldset>
                  <div className="admin-course-demand__master-flags"><label><input type="checkbox" checked={course.isSurveyEligible !== false} onChange={(event) => updateCourse(course.id, { isSurveyEligible: event.target.checked })} /> 수요조사 사용</label><label><input type="checkbox" checked={course.active !== false} onChange={(event) => updateCourse(course.id, { active: event.target.checked })} /> 활성</label></div>
                </div>
                <details><summary>과목코드·학점 상세</summary><div className="admin-course-demand__credit-grid">
                  <label>과목코드<input className="input" value={course.courseCode || ""} onChange={(event) => updateCourse(course.id, { courseCode: event.target.value })} /></label>
                  <label>학생학점<input className="input" type="number" min="0" disabled={lockedFieldPractice} value={course.studentCredit ?? 0} onChange={(event) => updateCourse(course.id, { studentCredit: Number(event.target.value) })} /></label>
                  <label>운영학점<input className="input" type="number" min="0" disabled={lockedFieldPractice} value={course.operatingCredit ?? 0} onChange={(event) => updateCourse(course.id, { operatingCredit: Number(event.target.value) })} /></label>
                  <label>교수인정<input className="input" type="number" min="0" disabled={lockedFieldPractice} value={course.facultyRecognizedCredit ?? 0} onChange={(event) => updateCourse(course.id, { facultyRecognizedCredit: Number(event.target.value) })} /></label>
                </div></details>
              </article>;
            })}
          </div>
          <div className="admin-course-demand__master-actions"><GjuButton type="submit">과목 설정 저장</GjuButton></div>
        </form>
      </GjuCard> : null}

      {tab === "results" ? <GjuCard title="수요조사 결과" surface="workspace">
        {planning.surveys.length ? <>
          <label className="admin-course-demand__result-select">설문 선택<select className="input" value={resultSurvey?.id || ""} onChange={(event) => setResultSurveyId(event.target.value)}>{planning.surveys.map((survey) => <option key={survey.id} value={survey.id}>{survey.title || "교과 수요조사"} · {STATUS_LABELS[survey.status || "draft"] || survey.status}</option>)}</select></label>
          <div className="admin-course-demand__result-metrics" aria-label="익명 응답 통계"><span><strong>{resultSurvey?.summary?.responseCount ?? 0}</strong><small>응답</small></span><span><strong>{resultSurvey?.summary?.responseRate ?? 0}%</strong><small>응답률</small></span><span><strong>{resultSurvey?.summary?.eligibleStudentCount ?? 0}</strong><small>대상 학생</small></span></div>
          <div className="admin-course-demand__category-summary">
            {DEMAND_CATEGORIES.map((category) => {
              const row = resultSurvey?.summary?.categories?.find((item) => item.category === category.key);
              return <article key={category.key}><strong>{category.label}</strong><span>{row?.selections ?? 0}회 선택</span><b>{row?.demandScore ?? 0}점</b></article>;
            })}
          </div>
          {sortedResults.length ? <div className="admin-course-demand__result-list">
            {sortedResults.map((course, index) => <article key={course.courseId}><b>{index + 1}</b><div><strong>{course.courseName}</strong><small>{categoryLabel(course.demandCategory)} · {course.selections ?? 0}회 선택 · {course.demandScore ?? 0}점</small></div><ol aria-label={`${course.courseName} 순위별 선택 수`}>{[1, 2, 3, 4, 5].map((rank) => <li key={rank}><span>{rank}순위</span><b>{course.rankCounts?.[rank] ?? 0}</b></li>)}</ol></article>)}
          </div> : <GjuEmptyState title="아직 집계할 응답이 없습니다." />}
          <p className="muted">결과는 학생을 식별하지 않는 익명 합계로만 표시됩니다.</p>
        </> : <GjuEmptyState title="결과를 확인할 설문이 없습니다." message="설문안을 공개한 뒤 응답 현황을 확인하세요." />}
      </GjuCard> : null}
    </section>
  );
}
