const TERM_ORDER = ["spring", "fall", "vacation"];
const SCORE_BY_RANK = { 1: 5, 2: 4, 3: 3, 4: 2, 5: 1 };
const CONFIRMED_HISTORY_STATUSES = new Set(["confirmed", "offered", "completed"]);
export const COURSE_DEMAND_CATEGORIES = ["art", "documentary", "advertising", "video"];
const COURSE_DEMAND_CATEGORY_SET = new Set(COURSE_DEMAND_CATEGORIES);

function domainError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function slug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9가-힣]+/g, "-")
    .replaceAll(/^-|-$/g, "") || "course";
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || "").trim()).filter(Boolean))];
}

function numberList(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))]
    .sort((left, right) => left - right);
}

function seedDemandCategory(name) {
  const value = String(name || "");
  if (/영상|드론/.test(value)) return "video";
  if (/다큐|포토\s?스토리|포토에세이|장소/.test(value)) return "documentary";
  if (/커머셜|라이팅|스튜디오|프린트/.test(value)) return "advertising";
  return "art";
}

function courseRecord(name, options = {}) {
  const id = options.id || `course_${slug(name)}`;
  const deliveryPeriod = options.deliveryPeriod || "semester";
  const operatingCredit = Number(options.operatingCredit ?? (deliveryPeriod === "semester" ? 3 : 0));
  return {
    id,
    courseCode: options.courseCode || "",
    name,
    majorType: options.majorType || (options.isMajorRequired ? "전필" : "전선"),
    targetYears: numberList(options.targetYears),
    allowedTerms: uniqueStrings(options.allowedTerms),
    studentCredit: Number(options.studentCredit ?? 3),
    operatingCredit,
    facultyRecognizedCredit: Number(options.facultyRecognizedCredit ?? 3),
    countsTowardCurriculum130: options.countsTowardCurriculum130 !== false,
    isMajorRequired: Boolean(options.isMajorRequired),
    requiredFrequencyYears: Number(options.requiredFrequencyYears || 0),
    deliveryPeriod,
    isSurveyEligible: options.isSurveyEligible !== false && deliveryPeriod === "semester",
    demandCategory: COURSE_DEMAND_CATEGORY_SET.has(options.demandCategory) ? options.demandCategory : seedDemandCategory(name),
    active: options.active !== false
  };
}

function standardCourses(targetYear, term, names, options = {}) {
  return names.map((name) => courseRecord(name, {
    targetYears: [targetYear],
    allowedTerms: [term],
    ...options,
    isMajorRequired: (options.majorRequiredNames || []).includes(name)
  }));
}

export function createCoursePlanningSeed() {
  const courses = [
    ...standardCourses(1, "spring", ["흑백사진과 암실", "사진영상학개론", "기초사진실기", "영상 에세이 메이킹"]),
    ...standardCourses(1, "fall", ["영상 프레임과 컷", "라이팅과 스튜디오", "이미지와사회", "디지털 포토 에디팅", "AI와 이미지 메이킹"], {
      majorRequiredNames: ["라이팅과 스튜디오"]
    }),
    ...standardCourses(2, "spring", ["디지털 이미지 제작과 프린트", "사진사", "영상드론기초", "내러티브 영상촬영", "응용 디지털 촬영"], {
      majorRequiredNames: ["디지털 이미지 제작과 프린트"]
    }),
    ...standardCourses(2, "fall", ["사진커뮤니케이션", "영상 컬러와 포스트 프로덕션", "리서치와 레퍼런스 이미지 제작", "비주얼 스토리 메이킹", "다큐멘터리 메이킹&쇼케이스"], {
      majorRequiredNames: ["영상 컬러와 포스트 프로덕션"]
    }),
    courseRecord("사진교과교육론", {
      targetYears: [2],
      allowedTerms: ["spring", "fall"],
      requiredFrequencyYears: 2
    }),
    ...standardCourses(3, "spring", ["커머셜 포토그라피 기초 워크숍", "포토 스토리 워크숍", "영상 인터뷰 내러티브 워크숍", "사물·데이터·이미지 워크숍"], {
      majorRequiredNames: ["커머셜 포토그라피 기초 워크숍"]
    }),
    ...standardCourses(3, "fall", ["커머셜 포토그라피 심화 워크숍", "포토에세이 워크숍", "영상 드론 콘텐츠 워크숍", "사진과 장소 그리고 콘텍스트 워크숍", "영상 콘텐츠 크리에이터 워크숍"], {
      majorRequiredNames: ["커머셜 포토그라피 심화 워크숍"]
    }),
    courseRecord("사진교수학습방법", {
      targetYears: [3],
      allowedTerms: ["spring", "fall"],
      requiredFrequencyYears: 2
    }),
    courseRecord("캡스톤 디자인1", {
      targetYears: [3],
      allowedTerms: ["fall"],
      studentCredit: 3,
      operatingCredit: 0,
      facultyRecognizedCredit: 3,
      deliveryPeriod: "semester",
      isSurveyEligible: true
    }),
    ...standardCourses(4, "spring", ["커머셜 포토그라피 세미나", "예술창작 프로젝트 세미나", "다큐멘터리 세미나"]),
    courseRecord("캡스톤 디자인2", {
      targetYears: [4],
      allowedTerms: ["spring"],
      studentCredit: 3,
      operatingCredit: 0,
      facultyRecognizedCredit: 3,
      deliveryPeriod: "semester",
      isSurveyEligible: true
    }),
    courseRecord("현장실습1", {
      targetYears: [4],
      allowedTerms: ["vacation"],
      operatingCredit: 0,
      deliveryPeriod: "vacation",
      isSurveyEligible: false
    }),
    courseRecord("현장실습2", {
      targetYears: [4],
      allowedTerms: ["vacation"],
      operatingCredit: 0,
      deliveryPeriod: "vacation",
      isSurveyEligible: false
    }),
    courseRecord("현장실습4", {
      targetYears: [4],
      allowedTerms: ["fall"],
      studentCredit: 15,
      operatingCredit: 0,
      facultyRecognizedCredit: 3,
      deliveryPeriod: "semester",
      isSurveyEligible: true
    }),
    ...standardCourses(4, "fall", ["커머셜 포토그라피 랩", "예술창작 프로젝트 랩", "포스트 다큐멘터리 랩"])
  ];

  return {
    curriculumVersions: [{ id: "curriculum_2026", academicYear: 2026, curriculumCreditLimit: 130, status: "active" }],
    courses,
    annualPlans: [],
    surveys: [],
    responses: [],
    offeringHistory: []
  };
}

export function normalizeCoursePlanning(value) {
  const seed = createCoursePlanningSeed();
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    curriculumVersions: Array.isArray(source.curriculumVersions) && source.curriculumVersions.length ? source.curriculumVersions : seed.curriculumVersions,
    courses: Array.isArray(source.courses) && source.courses.length ? source.courses.map((course) => courseRecord(course.name || "과목", course)) : seed.courses,
    annualPlans: Array.isArray(source.annualPlans) ? source.annualPlans : [],
    surveys: Array.isArray(source.surveys) ? source.surveys : [],
    responses: Array.isArray(source.responses) ? source.responses : [],
    offeringHistory: Array.isArray(source.offeringHistory) ? source.offeringHistory : []
  };
}

export function buildCourseDemandCatalog({ courses = [], courseIds = [], targetStudentYears = [], term = "" } = {}) {
  if (!Array.isArray(courseIds)) throw domainError("설문 후보 과목 목록이 올바르지 않습니다.");
  const normalizedIds = courseIds.map((courseId) => String(courseId || "").trim()).filter(Boolean);
  if (normalizedIds.length !== courseIds.length) throw domainError("설문 후보 과목을 확인하세요.");
  if (new Set(normalizedIds).size !== normalizedIds.length) throw domainError("같은 과목을 중복으로 선택할 수 없습니다.");
  const targetYears = numberList(targetStudentYears);
  const coursesById = new Map((Array.isArray(courses) ? courses : []).map((course) => [String(course?.id || ""), course]));

  return normalizedIds.map((courseId) => {
    const course = coursesById.get(courseId);
    if (!course) throw domainError("존재하지 않는 과목이 포함되어 있습니다.");
    if (course.active === false) throw domainError(`${course.name || "과목"}은 비활성 과목입니다.`);
    if (course.isSurveyEligible === false) throw domainError(`${course.name || "과목"}은 수요조사 대상이 아닙니다.`);
    if (course.majorType !== "전선" || course.isMajorRequired) throw domainError("수요조사에는 전선 과목만 선택할 수 있습니다.");
    const courseYears = numberList(course.targetYears);
    if (!targetYears.length || !courseYears.some((year) => targetYears.includes(year))) {
      throw domainError(`${course.name || "과목"}의 대상 학년이 설문과 맞지 않습니다.`);
    }
    const allowedTerms = uniqueStrings(course.allowedTerms);
    if (!allowedTerms.includes(term)) throw domainError(`${course.name || "과목"}의 개설 학기가 설문과 맞지 않습니다.`);
    if (!COURSE_DEMAND_CATEGORY_SET.has(course.demandCategory)) throw domainError(`${course.name || "과목"}의 수요 카테고리를 지정하세요.`);
    return {
      id: course.id,
      courseCode: course.courseCode || "",
      name: course.name,
      targetYears: courseYears,
      allowedTerms,
      studentCredit: Number(course.studentCredit || 0),
      demandCategory: course.demandCategory
    };
  });
}

function surveyDate(value, fieldName) {
  const timestamp = new Date(value || "").getTime();
  if (!Number.isFinite(timestamp)) throw domainError(`${fieldName}을 올바르게 입력하세요.`);
  return new Date(timestamp).toISOString();
}

function surveyYears(values, fieldName) {
  const years = numberList(values).filter((year) => year >= 1 && year <= 4);
  if (!years.length || years.length !== numberList(values).length) throw domainError(`${fieldName}을 올바르게 선택하세요.`);
  return years;
}

export function validateCourseDemandSurveyDefinition({ input = {}, courses = [], existingSurveys = [], currentSurveyId = "" } = {}) {
  const title = String(input.title || "").trim();
  if (!title || title.length > 100) throw domainError("설문 제목을 100자 이내로 입력하세요.");
  const academicYear = Number(input.academicYear);
  if (!Number.isInteger(academicYear) || academicYear < 2020 || academicYear > 2100) throw domainError("설문 학년도를 올바르게 입력하세요.");
  const term = String(input.term || "");
  if (!['spring', 'fall'].includes(term)) throw domainError("설문 학기를 선택하세요.");
  const eligibleCurrentYears = surveyYears(input.eligibleCurrentYears, "현재 학년");
  const targetStudentYears = surveyYears(input.targetStudentYears, "수강 대상 학년");
  const opensAt = surveyDate(input.opensAt, "시작일");
  const closesAt = surveyDate(input.closesAt, "종료일");
  if (new Date(closesAt).getTime() <= new Date(opensAt).getTime()) throw domainError("종료일은 시작일보다 늦어야 합니다.");
  const status = String(input.status || "draft");
  if (!['draft', 'open'].includes(status)) throw domainError("설문 상태가 올바르지 않습니다.");
  const catalogSnapshot = buildCourseDemandCatalog({
    courses,
    courseIds: Array.isArray(input.courseIds) ? input.courseIds : [],
    targetStudentYears,
    term
  });
  if (catalogSnapshot.length > 6) throw domainError("설문 후보 과목은 최대 6개까지 선택할 수 있습니다.");
  if (status === "open" && ![5, 6].includes(catalogSnapshot.length)) throw domainError("공개 설문은 후보 과목을 5개 또는 6개 선택해야 합니다.");

  if (status === "open") {
    const conflicts = (Array.isArray(existingSurveys) ? existingSurveys : []).some((survey) =>
      survey?.id !== currentSurveyId && survey?.status === "open" && Number(survey?.academicYear) === academicYear &&
      survey?.term === term && numberList(survey?.eligibleCurrentYears).some((year) => eligibleCurrentYears.includes(year))
    );
    if (conflicts) throw domainError("같은 학년도·학기·현재 학년에 이미 공개된 수요조사가 있습니다.");
  }

  return {
    title,
    academicYear,
    term,
    eligibleCurrentYears,
    targetStudentYears,
    opensAt,
    closesAt,
    status,
    catalogSnapshot
  };
}

function studentYear(student) {
  const value = Number(student?.studentYear ?? student?.year ?? String(student?.grade || student?.studentStatus || "").match(/\d+/)?.[0]);
  return Number.isInteger(value) ? value : 0;
}

function withinSurveyWindow(survey, now) {
  const currentTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const opensAt = new Date(survey?.opensAt || 0).getTime();
  const closesAt = new Date(survey?.closesAt || 0).getTime();
  return survey?.status === "open" && Number.isFinite(currentTime) && currentTime >= opensAt && currentTime <= closesAt;
}

function rankingCourseIds(survey) {
  return new Set((survey?.catalogSnapshot || []).map((course) => String(course.id || "")).filter(Boolean));
}

export function validateCourseDemandResponse({ survey, student, rankings, now = new Date() } = {}) {
  if (!withinSurveyWindow(survey, now)) throw domainError("현재 응답할 수 있는 수요조사가 아닙니다.");
  if (!(survey?.eligibleCurrentYears || []).map(Number).includes(studentYear(student))) {
    throw domainError("이 설문 대상 학년이 아닙니다.", 403);
  }
  if (!Array.isArray(rankings) || rankings.length < 1 || rankings.length > 5) {
    throw domainError("희망 과목은 1개 이상 5개 이하로 선택하세요.");
  }
  const validCourseIds = rankingCourseIds(survey);
  const ids = rankings.map((ranking) => String(ranking?.courseId || "").trim());
  if (ids.some((courseId) => !validCourseIds.has(courseId))) throw domainError("설문에 없는 과목은 선택할 수 없습니다.");
  if (new Set(ids).size !== ids.length) throw domainError("같은 과목을 중복으로 선택할 수 없습니다.");
  const normalized = rankings.map((ranking) => ({ courseId: String(ranking.courseId).trim(), rank: Number(ranking.rank) }))
    .sort((left, right) => left.rank - right.rank);
  if (!normalized.every((ranking, index) => ranking.rank === index + 1)) {
    throw domainError("순위는 1순위부터 빈칸 없이 연속해야 합니다.");
  }
  return normalized;
}

export function summarizeSurvey({ survey, responses = [], eligibleStudentCount = 0 } = {}) {
  const courseRows = (survey?.catalogSnapshot || []).map((course) => ({
    courseId: String(course.id || ""),
    courseName: String(course.name || "과목"),
    targetYears: numberList(course.targetYears),
    demandCategory: COURSE_DEMAND_CATEGORY_SET.has(course.demandCategory) ? course.demandCategory : "art",
    selections: 0,
    demandScore: 0,
    rankCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  }));
  const byCourseId = new Map(courseRows.map((course) => [course.courseId, course]));
  for (const response of responses) {
    for (const ranking of response?.rankings || []) {
      const course = byCourseId.get(String(ranking?.courseId || ""));
      const rank = Number(ranking?.rank);
      if (!course || !SCORE_BY_RANK[rank]) continue;
      course.selections += 1;
      course.rankCounts[rank] += 1;
      course.demandScore += SCORE_BY_RANK[rank];
    }
  }
  const responseCount = responses.length;
  const eligible = Math.max(0, Number(eligibleStudentCount || 0));
  return {
    surveyId: survey?.id || "",
    eligibleStudentCount: eligible,
    responseCount,
    responseRate: eligible ? Math.round((responseCount / eligible) * 100) : 0,
    courses: courseRows,
    categories: COURSE_DEMAND_CATEGORIES.map((category) => ({
      category,
      selections: courseRows.filter((course) => course.demandCategory === category).reduce((sum, course) => sum + course.selections, 0),
      demandScore: courseRows.filter((course) => course.demandCategory === category).reduce((sum, course) => sum + course.demandScore, 0)
    }))
  };
}

function courseFitsSemester(course, semesterPlan) {
  const terms = uniqueStrings(course?.allowedTerms);
  const targetYears = numberList(course?.targetYears);
  const semesterYears = numberList(semesterPlan?.targetYears);
  return course?.active !== false && terms.includes(String(semesterPlan?.term || "")) &&
    (!semesterYears.length || !targetYears.length || semesterYears.some((year) => targetYears.includes(year)));
}

function historySatisfiesCourse(course, history, academicYear) {
  if (!course?.requiredFrequencyYears) return true;
  const threshold = Number(academicYear) - Number(course.requiredFrequencyYears) + 1;
  return (history || []).some((entry) => entry?.courseId === course.id && CONFIRMED_HISTORY_STATUSES.has(entry.status) && Number(entry.academicYear) >= threshold && Number(entry.academicYear) <= Number(academicYear));
}

function offering(courseId, source, reason = "") {
  return { courseId, source, overrideReason: reason };
}

function operatingCreditForPlan(plan, coursesById) {
  return (plan?.semesterPlans || []).flatMap((semesterPlan) => semesterPlan?.offerings || [])
    .reduce((total, item) => total + Number(coursesById.get(item.courseId)?.operatingCredit || 0), 0);
}

export function buildOfferingRecommendation({ plan, courses = [], history = [], demandByCourseId = {} } = {}) {
  const coursesById = new Map(courses.map((course) => [course.id, course]));
  let operatingCredit = operatingCreditForPlan(plan, coursesById);
  const limit = Number(plan?.operatingCreditLimit || 85);
  const semesterPlans = (plan?.semesterPlans || []).map((semesterPlan) => {
    const courseIds = new Set((semesterPlan.offerings || []).map((item) => item.courseId));
    const candidates = courses.filter((course) => !courseIds.has(course.id) && courseFitsSemester(course, semesterPlan));
    const mandatory = candidates.filter((course) => course.isMajorRequired);
    const periodic = candidates.filter((course) => !course.isMajorRequired && course.requiredFrequencyYears && !historySatisfiesCourse(course, history, plan?.academicYear));
    const zeroCredit = candidates.filter((course) => !course.isMajorRequired && !course.requiredFrequencyYears && Number(course.operatingCredit) === 0);
    const optional = candidates.filter((course) => !course.isMajorRequired && !course.requiredFrequencyYears && Number(course.operatingCredit) !== 0)
      .sort((left, right) => Number(demandByCourseId[right.id] || 0) - Number(demandByCourseId[left.id] || 0) || left.name.localeCompare(right.name, "ko"));
    const deferred = [];
    const additions = [];
    for (const [source, list] of [["required", mandatory], ["periodic", periodic], ["exception", zeroCredit], ["demand", optional]]) {
      for (const course of list) {
        const nextCredit = operatingCredit + Number(course.operatingCredit || 0);
        if (nextCredit > limit) {
          deferred.push({ courseId: course.id, source, reason: "operating_credit_limit" });
          continue;
        }
        additions.push(offering(course.id, source));
        operatingCredit = nextCredit;
      }
    }
    return { ...semesterPlan, offerings: [...(semesterPlan.offerings || []), ...additions], deferred };
  });
  const recommended = { ...plan, semesterPlans };
  return {
    ...recommended,
    operatingCredit,
    remainingOperatingCredit: Math.max(0, limit - operatingCredit),
    validation: validateAnnualPlan({ plan: recommended, courses, history })
  };
}

export function validateAnnualPlan({ plan, courses = [], history = [] } = {}) {
  const errors = [];
  const warnings = [];
  const coursesById = new Map(courses.map((course) => [course.id, course]));
  const operatingCredit = operatingCreditForPlan(plan, coursesById);
  const limit = Number(plan?.operatingCreditLimit || 85);
  if (operatingCredit > limit) errors.push({ code: "operating_credit_limit", message: `연간 운영학점은 ${limit}학점을 넘길 수 없습니다.` });
  const offeringIds = new Set((plan?.semesterPlans || []).flatMap((semesterPlan) => semesterPlan?.offerings || []).map((item) => item.courseId));
  for (const semesterPlan of plan?.semesterPlans || []) {
    for (const course of courses.filter((item) => courseFitsSemester(item, semesterPlan) && item.isMajorRequired)) {
      if (!offeringIds.has(course.id)) errors.push({ code: "major_required_missing", courseId: course.id, message: `${course.name} 전필이 누락되었습니다.` });
    }
    for (const course of courses.filter((item) => courseFitsSemester(item, semesterPlan) && item.requiredFrequencyYears && !historySatisfiesCourse(item, history, plan?.academicYear))) {
      if (!offeringIds.has(course.id)) errors.push({ code: "periodic_course_due", courseId: course.id, message: `${course.name}은 최근 ${course.requiredFrequencyYears}개 학년도 내 개설이 필요합니다.` });
    }
  }
  for (const semesterPlan of plan?.semesterPlans || []) {
    for (const item of semesterPlan?.offerings || []) {
      const course = coursesById.get(item.courseId);
      if (!course) errors.push({ code: "course_not_found", courseId: item.courseId, message: "존재하지 않는 과목입니다." });
      else if (!courseFitsSemester(course, semesterPlan)) errors.push({ code: "course_term_or_year_invalid", courseId: course.id, message: `${course.name}의 대상 학년 또는 학기가 맞지 않습니다.` });
      else if (course.name === "현장실습4" && (semesterPlan.term !== "fall" || course.studentCredit !== 15 || course.operatingCredit !== 0 || course.facultyRecognizedCredit !== 3)) {
        errors.push({ code: "field_practice4_rule", courseId: course.id, message: "현장실습4는 4학년 2학기 15/0/3 규칙을 지켜야 합니다." });
      }
    }
  }
  const curriculumCredit = courses.filter((course) => course.countsTowardCurriculum130 !== false).reduce((total, course) => total + Number(course.studentCredit || 0), 0);
  if (curriculumCredit > 130) warnings.push({ code: "curriculum_credit_limit", message: "과목 마스터의 교육과정 편성학점이 130학점을 넘습니다.", value: curriculumCredit });
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    metrics: {
      operatingCredit,
      operatingCreditLimit: limit,
      remainingOperatingCredit: limit - operatingCredit,
      facultyRecognizedCredit: (plan?.semesterPlans || []).flatMap((semesterPlan) => semesterPlan?.offerings || []).reduce((total, item) => total + Number(coursesById.get(item.courseId)?.facultyRecognizedCredit || 0), 0),
      curriculumCredit
    }
  };
}

export function publicSurveyForStudent({ survey, student, response, now = new Date() } = {}) {
  const eligible = (survey?.eligibleCurrentYears || []).map(Number).includes(studentYear(student));
  if (!eligible || survey?.status === "draft" || (survey?.status === "closed" && !response)) return null;
  return {
    id: survey.id,
    semesterPlanId: survey.semesterPlanId,
    title: survey.title || "다음 학기 희망 과목 조사",
    academicYear: survey.academicYear,
    term: survey.term,
    targetStudentYears: numberList(survey.targetStudentYears),
    status: survey.status,
    opensAt: survey.opensAt,
    closesAt: survey.closesAt,
    isOpen: withinSurveyWindow(survey, now),
    catalog: (survey.catalogSnapshot || []).map((course) => ({
      id: course.id,
      courseCode: course.courseCode || "",
      name: course.name,
      targetYears: numberList(course.targetYears),
      allowedTerms: uniqueStrings(course.allowedTerms),
      studentCredit: Number(course.studentCredit || 0),
      demandCategory: COURSE_DEMAND_CATEGORY_SET.has(course.demandCategory) ? course.demandCategory : "art"
    })),
    response: response ? { rankings: response.rankings || [], submittedAt: response.submittedAt || "" } : null
  };
}
