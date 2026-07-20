import React from "react";

import { GjuButton, GjuCard, GjuEmptyState, GjuStatusBadge, GjuTabs } from "../../design-system";
import type {
  AdminAnnualOfferingPlan,
  AdminCoursePlanningData,
  AdminCourseRecord,
  AdminCourseSemesterPlan,
  LegacyState,
  ReactAdminActions
} from "../../platform/types";

type AdminCourseDemandProps = {
  state: LegacyState;
  actions: ReactAdminActions;
};

const TERM_LABELS: Record<string, string> = { spring: "1학기", fall: "2학기", vacation: "방학" };

function termLabel(term: string) {
  return TERM_LABELS[term] || term || "학기 미정";
}

function planForNewAcademicYear(academicYear: number): AdminAnnualOfferingPlan {
  return {
    id: `annual_${academicYear}`,
    academicYear,
    operatingCreditLimit: 85,
    status: "draft",
    semesterPlans: [
      { id: `annual_${academicYear}_spring`, term: "spring", targetYears: [1, 2, 3, 4], offerings: [] },
      { id: `annual_${academicYear}_fall`, term: "fall", targetYears: [1, 2, 3, 4], offerings: [] }
    ]
  };
}

function courseFitsSemester(course: AdminCourseRecord, semesterPlan: AdminCourseSemesterPlan) {
  const terms = course.allowedTerms || [];
  const targetYears = course.targetYears || [];
  const semesterYears = semesterPlan.targetYears || [];
  return course.active !== false && terms.includes(semesterPlan.term) &&
    (!semesterYears.length || !targetYears.length || targetYears.some((year) => semesterYears.includes(year)));
}

function updateSemesterOfferings(plan: AdminAnnualOfferingPlan, semesterPlanId: string, courseId: string, selected: boolean) {
  return {
    ...plan,
    status: "draft",
    semesterPlans: plan.semesterPlans.map((semesterPlan) => {
      if (semesterPlan.id !== semesterPlanId) return semesterPlan;
      const offerings = semesterPlan.offerings || [];
      return {
        ...semesterPlan,
        offerings: selected
          ? [...offerings, { courseId, source: "manual", overrideReason: "관리자 수동 편성" }]
          : offerings.filter((offering) => offering.courseId !== courseId)
      };
    })
  };
}

function planValidation(plan: AdminAnnualOfferingPlan | null) {
  return plan?.validation || { errors: [], warnings: [], metrics: {} };
}

function planningData(state: LegacyState): AdminCoursePlanningData {
  return state.adminCoursePlanning || { curriculumVersions: [], courses: [], annualPlans: [], surveys: [] };
}

function inputDateTimeValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function AdminCourseDemand({ state, actions }: AdminCourseDemandProps) {
  const planning = planningData(state);
  const plans = planning.annualPlans || [];
  const [tab, setTab] = React.useState("plan");
  const [selectedPlanId, setSelectedPlanId] = React.useState("");
  const [selectedSemesterId, setSelectedSemesterId] = React.useState("");
  const [newAcademicYear, setNewAcademicYear] = React.useState(String(new Date().getFullYear() + 1));
  const [recommendation, setRecommendation] = React.useState<AdminAnnualOfferingPlan | null>(null);
  const [courses, setCourses] = React.useState<AdminCourseRecord[]>(planning.courses || []);

  React.useEffect(() => {
    setCourses(planning.courses || []);
    if (!selectedPlanId || !plans.some((plan) => plan.id === selectedPlanId)) setSelectedPlanId(plans[0]?.id || "");
  }, [planning.courses, plans, selectedPlanId]);

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) || null;
  const selectedSemester = selectedPlan?.semesterPlans.find((semesterPlan) => semesterPlan.id === selectedSemesterId)
    || selectedPlan?.semesterPlans[0]
    || null;
  const validation = planValidation(selectedPlan);
  const coursesById = new Map(planning.courses.map((course) => [course.id, course]));

  React.useEffect(() => {
    if (selectedSemester && selectedSemester.id !== selectedSemesterId) setSelectedSemesterId(selectedSemester.id);
  }, [selectedSemester, selectedSemesterId]);

  async function savePlan(plan: AdminAnnualOfferingPlan) {
    await actions.saveAnnualOfferingPlan(plan);
    setRecommendation(null);
  }

  async function createPlan() {
    const academicYear = Number(newAcademicYear);
    if (!Number.isInteger(academicYear) || academicYear < 2020) {
      actions.notify("학년도를 올바르게 입력하세요.", "error");
      return;
    }
    const existing = plans.find((plan) => plan.academicYear === academicYear);
    if (existing) {
      setSelectedPlanId(existing.id);
      actions.notify("해당 학년도의 편성안이 이미 열려 있습니다.");
      return;
    }
    const plan = planForNewAcademicYear(academicYear);
    await savePlan(plan);
    setSelectedPlanId(plan.id);
  }

  async function createSurvey(form: HTMLFormElement) {
    const values = new FormData(form);
    const currentYear = Number(values.get("eligibleCurrentYear") || 0);
    const targetYear = Number(values.get("targetStudentYear") || 0);
    const term = selectedSemester?.term === "fall" ? "fall" : "spring";
    const courseIds = planning.courses
      .filter((course) => course.active !== false && course.isSurveyEligible !== false && course.majorType === "전선")
      .filter((course) => (course.targetYears || []).includes(targetYear) && (course.allowedTerms || []).includes(term))
      .slice(0, 6)
      .map((course) => course.id);
    await actions.createCourseDemandSurvey({
      title: `${selectedPlan?.academicYear || new Date().getFullYear()}학년도 ${targetYear}학년 교과 수요조사`,
      academicYear: selectedPlan?.academicYear || new Date().getFullYear(),
      term,
      eligibleCurrentYears: [currentYear],
      targetStudentYears: [targetYear],
      opensAt: String(values.get("opensAt") || ""),
      closesAt: String(values.get("closesAt") || ""),
      status: String(values.get("status") || "draft") as "draft" | "open",
      courseIds
    });
    form.reset();
  }

  async function prepareRecommendation() {
    if (!selectedPlan) return;
    const next = await actions.loadCourseDemandRecommendation(selectedPlan.id);
    setRecommendation(next);
  }

  const updateCourse = (courseId: string, patch: Partial<AdminCourseRecord>) => {
    setCourses((current) => current.map((course) => course.id === courseId ? { ...course, ...patch } : course));
  };

  const defaultOpensAt = inputDateTimeValue(new Date());
  const defaultClosesAt = inputDateTimeValue(new Date(Date.now() + 1000 * 60 * 60 * 24 * 14));

  return (
    <section className="grid admin-react-screen admin-course-demand">
      <GjuCard title="교과 편성" eyebrow="수요조사 · 연간 운영학점 85 · 교육과정 130" surface="workspace">
        <p className="muted">수요조사는 다음 학기 대상 학생에게만 공개됩니다. 학생 응답은 편성 참고자료이며, 최종 개설은 관리자가 확정합니다.</p>
        <GjuTabs
          id="admin-course-demand-tabs"
          ariaLabel="교과 편성 관리"
          className="tab-row"
          tabClassName="tab-button"
          items={[{ key: "plan", label: "편성안" }, { key: "survey", label: "수요조사" }, { key: "courses", label: "과목 마스터" }]}
          activeKey={tab}
          onChange={setTab}
        />
      </GjuCard>

      {tab === "plan" ? <>
        <GjuCard title="학년도 편성안" surface="workspace">
          <div className="admin-course-demand__plan-picker">
            <label>
              편성안
              <select className="input" value={selectedPlanId} onChange={(event) => { setSelectedPlanId(event.target.value); setRecommendation(null); }}>
                <option value="">편성안 선택</option>
                {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.academicYear}학년도 · {plan.status === "confirmed" ? "확정" : "초안"}</option>)}
              </select>
            </label>
            <label>
              새 학년도
              <input className="input" inputMode="numeric" value={newAcademicYear} onChange={(event) => setNewAcademicYear(event.target.value)} />
            </label>
            <GjuButton onClick={() => void createPlan()}>편성안 만들기</GjuButton>
          </div>
        </GjuCard>

        {!selectedPlan ? <GjuEmptyState title="학년도 편성안을 먼저 만드세요." message="1·2학기 통합 85학점 한도 안에서 수요조사와 개설안을 관리합니다." /> : <>
          <GjuCard title={`${selectedPlan.academicYear}학년도 편성 현황`} surface="workspace">
            <div className="admin-course-demand__metrics" aria-label="편성안 학점 현황">
              <span><strong>{validation.metrics?.operatingCredit ?? 0}</strong><small>/ {validation.metrics?.operatingCreditLimit ?? 85} 운영학점</small></span>
              <span><strong>{validation.metrics?.remainingOperatingCredit ?? 85}</strong><small>학점 잔여</small></span>
              <span><strong>{validation.metrics?.facultyRecognizedCredit ?? 0}</strong><small>교수인정시수</small></span>
              <span><strong>{validation.metrics?.curriculumCredit ?? 0}</strong><small>/ 130 교육과정</small></span>
            </div>
            <div className="admin-course-demand__validation" aria-live="polite">
              {(validation.errors || []).length ? validation.errors?.map((item, index) => <p key={`${item.code}:${index}`} className="admin-course-demand__error">오류 · {item.message}</p>) : <GjuStatusBadge tone="green">확정 규칙 통과</GjuStatusBadge>}
              {validation.warnings?.map((item, index) => <p key={`${item.code}:${index}`} className="admin-course-demand__warning">주의 · {item.message}</p>)}
            </div>
            <div className="admin-course-demand__plan-actions">
              <GjuButton variant="outline" onClick={() => void prepareRecommendation()}>수요 기반 추천 만들기</GjuButton>
              {recommendation ? <GjuButton onClick={() => void savePlan({ ...selectedPlan, semesterPlans: recommendation.semesterPlans, status: "draft" })}>추천안 반영</GjuButton> : null}
              <GjuButton tone="danger" disabled={(validation.errors || []).length > 0 || selectedPlan.status === "confirmed"} onClick={() => void savePlan({ ...selectedPlan, status: "confirmed" })}>{selectedPlan.status === "confirmed" ? "확정됨" : "편성안 확정"}</GjuButton>
            </div>
          </GjuCard>

          <GjuCard title="학기별 과목 편성" surface="workspace">
            <div className="admin-course-demand__semester-tabs" role="tablist" aria-label="편성 학기">
              {selectedPlan.semesterPlans.map((semesterPlan) => <button key={semesterPlan.id} type="button" role="tab" aria-selected={selectedSemester?.id === semesterPlan.id} onClick={() => setSelectedSemesterId(semesterPlan.id)}>{termLabel(semesterPlan.term)} · {semesterPlan.targetYears?.join("·")}학년</button>)}
            </div>
            {selectedSemester ? <div className="admin-course-demand__course-list">
              {planning.courses.filter((course) => courseFitsSemester(course, selectedSemester)).map((course) => {
                const offering = (selectedSemester.offerings || []).find((item) => item.courseId === course.id);
                const required = Boolean(course.isMajorRequired || course.requiredFrequencyYears);
                return <article key={course.id} data-selected={offering ? "true" : "false"}>
                  <div><strong>{course.name}</strong><small>{course.courseCode || "코드 미등록"} · 학생 {course.studentCredit ?? 0} / 운영 {course.operatingCredit ?? 0} / 교수 {course.facultyRecognizedCredit ?? 0}</small></div>
                  <div className="admin-course-demand__course-tags">{course.isMajorRequired ? <GjuStatusBadge tone="red">전필</GjuStatusBadge> : null}{course.requiredFrequencyYears ? <GjuStatusBadge tone="amber">{course.requiredFrequencyYears}년 주기</GjuStatusBadge> : null}{course.operatingCredit === 0 ? <GjuStatusBadge tone="blue">85 제외</GjuStatusBadge> : null}</div>
                  <GjuButton variant={offering ? "outline" : "ghost"} disabled={selectedPlan.status === "confirmed"} onClick={() => void savePlan(updateSemesterOfferings(selectedPlan, selectedSemester.id, course.id, !offering))}>{offering ? "제외" : required ? "필수 반영" : "편성"}</GjuButton>
                </article>;
              })}
            </div> : null}
            {recommendation?.semesterPlans.find((semesterPlan) => semesterPlan.id === selectedSemester?.id)?.deferred?.length ? <p className="muted">85학점 한도를 넘겨 보류된 후보가 있습니다. 수요·필수 여부를 검토해 수동 조정하세요.</p> : null}
          </GjuCard>
        </>}
      </> : null}

      {tab === "survey" ? <>
        <GjuCard title="수요조사 만들기" surface="workspace">
          {!selectedPlan?.semesterPlans.length ? <GjuEmptyState title="먼저 학년도 편성안을 선택하세요." /> : <form className="admin-course-demand__survey-form" onSubmit={(event) => { event.preventDefault(); void createSurvey(event.currentTarget); }}>
            <label>대상 학기<select className="input" name="semesterPlanId" defaultValue={selectedSemester?.id || selectedPlan.semesterPlans[0]?.id}>{selectedPlan.semesterPlans.map((semesterPlan) => <option key={semesterPlan.id} value={semesterPlan.id}>{termLabel(semesterPlan.term)} · {semesterPlan.targetYears?.join("·")}학년 과목</option>)}</select></label>
            <label>현재 학년<select className="input" name="eligibleCurrentYear" defaultValue="2">{[1, 2, 3, 4].map((year) => <option key={year} value={year}>{year}학년</option>)}</select></label>
            <label>다음 수강 학년<select className="input" name="targetStudentYear" defaultValue="3">{[1, 2, 3, 4].map((year) => <option key={year} value={year}>{year}학년</option>)}</select></label>
            <label>시작<input className="input" name="opensAt" type="datetime-local" defaultValue={defaultOpensAt} required /></label>
            <label>마감<input className="input" name="closesAt" type="datetime-local" defaultValue={defaultClosesAt} required /></label>
            <label>상태<select className="input" name="status" defaultValue="draft"><option value="draft">임시저장</option><option value="open">즉시 공개</option></select></label>
            <GjuButton type="submit">수요조사 저장</GjuButton>
          </form>}
        </GjuCard>
        <GjuCard title="진행 중인 수요조사" surface="workspace">
          {planning.surveys.length ? <div className="admin-course-demand__survey-list">{planning.surveys.map((survey) => <article key={survey.id}>
            <div><strong>{survey.status === "open" ? "공개 중" : survey.status === "closed" ? "마감" : "임시저장"}</strong><span>현재 {survey.eligibleCurrentYears?.join("·")}학년 · 후보 {survey.catalogCount ?? 0}과목</span></div>
            <div><b>{survey.summary?.responseCount ?? 0}</b><small> / {survey.summary?.eligibleStudentCount ?? 0}명 응답 ({survey.summary?.responseRate ?? 0}%)</small></div>
            <ol>{(survey.summary?.courses || []).filter((course) => (course.selections || 0) > 0).slice().sort((left, right) => (right.demandScore || 0) - (left.demandScore || 0)).slice(0, 5).map((course) => <li key={course.courseId}>{course.courseName} · {course.demandScore}점</li>)}</ol>
            {survey.status === "open" ? <GjuButton variant="outline" onClick={() => void actions.updateCourseDemandSurvey(survey.id, { status: "closed" })}>설문 마감</GjuButton> : null}
          </article>)}</div> : <GjuEmptyState title="등록된 수요조사가 없습니다." message="학기 말에 대상 학년과 기간을 선택해 공개하세요." />}
        </GjuCard>
      </> : null}

      {tab === "courses" ? <GjuCard title="과목 마스터" surface="workspace">
        <p className="muted">학생·운영·교수인정 학점을 분리해 관리합니다. 현장실습4는 4학년 2학기 15/0/3 규칙으로 잠겨 있습니다.</p>
        <form onSubmit={(event) => { event.preventDefault(); void actions.saveCoursePlanningCourses(courses); }}>
          <div className="admin-course-demand__master-list">
            {courses.map((course) => {
              const lockedFieldPractice = course.name === "현장실습4";
              return <article key={course.id}>
                <label>과목명<input className="input" value={course.name} onChange={(event) => updateCourse(course.id, { name: event.target.value })} /></label>
                <label>과목코드<input className="input" value={course.courseCode || ""} onChange={(event) => updateCourse(course.id, { courseCode: event.target.value })} /></label>
                <label>학생학점<input className="input" type="number" min="0" disabled={lockedFieldPractice} value={course.studentCredit ?? 0} onChange={(event) => updateCourse(course.id, { studentCredit: Number(event.target.value) })} /></label>
                <label>운영학점<input className="input" type="number" min="0" disabled={lockedFieldPractice} value={course.operatingCredit ?? 0} onChange={(event) => updateCourse(course.id, { operatingCredit: Number(event.target.value) })} /></label>
                <label>교수인정<input className="input" type="number" min="0" disabled={lockedFieldPractice} value={course.facultyRecognizedCredit ?? 0} onChange={(event) => updateCourse(course.id, { facultyRecognizedCredit: Number(event.target.value) })} /></label>
                <label className="admin-course-demand__check"><input type="checkbox" checked={Boolean(course.isMajorRequired)} onChange={(event) => updateCourse(course.id, { isMajorRequired: event.target.checked })} /> 전필</label>
                <small>{course.targetYears?.join("·")}학년 · {(course.allowedTerms || []).map(termLabel).join("·")} · {course.deliveryPeriod === "vacation" ? "방학 운영" : "학기 운영"}</small>
              </article>;
            })}
          </div>
          <div className="admin-course-demand__master-actions"><GjuButton type="submit">과목 마스터 저장</GjuButton></div>
        </form>
      </GjuCard> : null}
    </section>
  );
}
