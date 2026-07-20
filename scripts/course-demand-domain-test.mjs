import assert from "node:assert/strict";
import { adminExportData, handleApiRequest, initialDb, normalizeDb } from "../core.mjs";

const {
  buildOfferingRecommendation,
  createCoursePlanningSeed,
  summarizeSurvey,
  validateAnnualPlan,
  validateCourseDemandResponse
} = await import("../core/course-demand.mjs").catch(() => ({}));

for (const [name, value] of Object.entries({
  buildOfferingRecommendation,
  createCoursePlanningSeed,
  summarizeSurvey,
  validateAnnualPlan,
  validateCourseDemandResponse
})) {
  assert.equal(typeof value, "function", `${name} must be exported`);
}

const seed = createCoursePlanningSeed();
assert.equal(seed.curriculumVersions[0].curriculumCreditLimit, 130);
assert.equal(seed.courses.some((course) => course.isMajorRequired), true, "PDF seed must include major-required courses");

const fieldPractice4 = seed.courses.find((course) => course.name === "현장실습4");
assert.deepEqual(
  {
    targetYears: fieldPractice4?.targetYears,
    allowedTerms: fieldPractice4?.allowedTerms,
    studentCredit: fieldPractice4?.studentCredit,
    operatingCredit: fieldPractice4?.operatingCredit,
    facultyRecognizedCredit: fieldPractice4?.facultyRecognizedCredit
  },
  { targetYears: [4], allowedTerms: ["fall"], studentCredit: 15, operatingCredit: 0, facultyRecognizedCredit: 3 },
  "현장실습4 must preserve the confirmed 4학년 2학기 15/0/3 exception"
);

const capstone = seed.courses.find((course) => course.name.includes("캡스톤"));
assert.equal(capstone?.operatingCredit, 0, "capstone must not consume the annual 85-credit limit");
assert.equal(capstone?.facultyRecognizedCredit, 3, "capstone must count toward faculty-recognized workload");
assert.equal(seed.courses.some((course) => course.name === "사진교과교육론" && course.requiredFrequencyYears === 2), true);
assert.equal(seed.courses.some((course) => course.name === "사진교수학습방법" && course.requiredFrequencyYears === 2), true);

const initialCourseDb = await initialDb("course-demand-domain-password");
assert.equal(initialCourseDb.coursePlanning?.courses.some((course) => course.name === "현장실습4"), true, "new databases must seed course planning data");
const legacyCourseDb = { users: [], equipment: [], reservations: [] };
normalizeDb(legacyCourseDb);
assert.equal(legacyCourseDb.coursePlanning?.curriculumVersions?.[0]?.curriculumCreditLimit, 130, "legacy databases must gain a valid course planning singleton");
assert.equal(adminExportData(initialCourseDb).coursePlanning?.courses.some((course) => course.name === "현장실습4"), true, "administrator backups must include course planning rules");

const rankingSurvey = {
  id: "survey_1",
  status: "open",
  opensAt: "2099-01-01T00:00:00.000Z",
  closesAt: "2099-01-31T14:59:59.000Z",
  eligibleCurrentYears: [2],
  catalogSnapshot: [
    { id: "course_a", name: "과목 A", targetYears: [3], allowedTerms: ["spring"] },
    { id: "course_b", name: "과목 B", targetYears: [3], allowedTerms: ["spring"] },
    { id: "course_c", name: "과목 C", targetYears: [3], allowedTerms: ["spring"] }
  ]
};
const eligibleStudent = { id: "student_1", role: "student", studentYear: 2 };
assert.deepEqual(
  validateCourseDemandResponse({
    survey: rankingSurvey,
    student: eligibleStudent,
    rankings: [{ courseId: "course_a", rank: 1 }, { courseId: "course_b", rank: 2 }],
    now: new Date("2099-01-20T00:00:00.000Z")
  }),
  [{ courseId: "course_a", rank: 1 }, { courseId: "course_b", rank: 2 }]
);
assert.throws(
  () => validateCourseDemandResponse({
    survey: rankingSurvey,
    student: eligibleStudent,
    rankings: [{ courseId: "course_a", rank: 1 }, { courseId: "course_a", rank: 2 }],
    now: new Date("2099-01-20T00:00:00.000Z")
  }),
  /중복/
);
assert.throws(
  () => validateCourseDemandResponse({
    survey: rankingSurvey,
    student: eligibleStudent,
    rankings: [{ courseId: "course_a", rank: 1 }, { courseId: "course_b", rank: 3 }],
    now: new Date("2099-01-20T00:00:00.000Z")
  }),
  /연속/
);
assert.throws(
  () => validateCourseDemandResponse({
    survey: rankingSurvey,
    student: { ...eligibleStudent, studentYear: 1 },
    rankings: [{ courseId: "course_a", rank: 1 }],
    now: new Date("2099-01-20T00:00:00.000Z")
  }),
  /대상/
);

const summary = summarizeSurvey({
  survey: rankingSurvey,
  eligibleStudentCount: 4,
  responses: [
    { studentId: "student_1", rankings: [{ courseId: "course_a", rank: 1 }, { courseId: "course_b", rank: 2 }] },
    { studentId: "student_2", rankings: [{ courseId: "course_b", rank: 1 }, { courseId: "course_a", rank: 3 }] }
  ]
});
assert.equal(summary.responseRate, 50);
assert.deepEqual(
  summary.courses.map((course) => ({ courseId: course.courseId, selections: course.selections, demandScore: course.demandScore })),
  [
    { courseId: "course_a", selections: 2, demandScore: 8 },
    { courseId: "course_b", selections: 2, demandScore: 9 },
    { courseId: "course_c", selections: 0, demandScore: 0 }
  ],
  "rank 1~5 must be weighted 5~1 and remain deterministic"
);

const planningCourses = [
  { id: "required", name: "전필", targetYears: [2], allowedTerms: ["spring"], isMajorRequired: true, studentCredit: 3, operatingCredit: 3, facultyRecognizedCredit: 3, active: true },
  { id: "periodic", name: "사진교과교육론", targetYears: [2], allowedTerms: ["spring"], requiredFrequencyYears: 2, studentCredit: 3, operatingCredit: 3, facultyRecognizedCredit: 3, active: true },
  { id: "demand_high", name: "수요 상", targetYears: [2], allowedTerms: ["spring"], studentCredit: 3, operatingCredit: 3, facultyRecognizedCredit: 3, active: true },
  { id: "demand_low", name: "수요 하", targetYears: [2], allowedTerms: ["spring"], studentCredit: 3, operatingCredit: 3, facultyRecognizedCredit: 3, active: true },
  { id: "capstone", name: "캡스톤 디자인", targetYears: [2], allowedTerms: ["fall"], studentCredit: 3, operatingCredit: 0, facultyRecognizedCredit: 3, active: true }
];
const annualPlan = {
  id: "plan_2099",
  academicYear: 2099,
  operatingCreditLimit: 85,
  semesterPlans: [
    { id: "plan_2099_spring", term: "spring", targetYears: [2], offerings: [] },
    { id: "plan_2099_fall", term: "fall", targetYears: [2], offerings: [] }
  ]
};
const recommendation = buildOfferingRecommendation({
  plan: annualPlan,
  courses: planningCourses,
  history: [],
  demandByCourseId: { demand_high: 12, demand_low: 3 }
});
assert.deepEqual(
  recommendation.semesterPlans.find((item) => item.term === "spring")?.offerings.map((item) => item.courseId),
  ["required", "periodic", "demand_high", "demand_low"],
  "required and overdue periodic courses must precede demand-ranked optional courses"
);
assert.equal(recommendation.semesterPlans.find((item) => item.term === "fall")?.offerings[0]?.courseId, "capstone");

const invalidPlan = {
  ...annualPlan,
  semesterPlans: [{ id: "plan_2099_spring", term: "spring", targetYears: [2], offerings: [{ courseId: "demand_high" }] }]
};
const validation = validateAnnualPlan({ plan: invalidPlan, courses: planningCourses, history: [] });
assert.equal(validation.errors.some((item) => item.code === "major_required_missing"), true);
assert.equal(validation.errors.some((item) => item.code === "periodic_course_due"), true);

const overLimitCourses = Array.from({ length: 29 }, (_, index) => ({
  id: `operating_${index + 1}`,
  name: `운영 ${index + 1}`,
  targetYears: [2],
  allowedTerms: ["spring"],
  studentCredit: 3,
  operatingCredit: 3,
  facultyRecognizedCredit: 3,
  active: true
}));
const overLimitPlan = {
  ...annualPlan,
  semesterPlans: [{ id: "plan_2099_spring", term: "spring", targetYears: [2], offerings: overLimitCourses.map((course) => ({ courseId: course.id })) }]
};
const overLimitValidation = validateAnnualPlan({ plan: overLimitPlan, courses: overLimitCourses, history: [] });
assert.equal(overLimitValidation.errors.some((item) => item.code === "operating_credit_limit"), true, "86+ 일반 운영학점 must block confirmation");

const apiDb = await initialDb("course-demand-api-password");
apiDb.users.push({
  id: "user_course_student",
  role: "student",
  name: "수요조사 학생",
  studentId: "20260001",
  grade: "2학년",
  approvalStatus: "approved",
  preferences: {},
  createdAt: "2026-07-20T00:00:00.000Z",
  updatedAt: "2026-07-20T00:00:00.000Z"
});
apiDb.sessions.push(
  { id: "session_course_admin", token: "course-admin-token", userId: "user_admin", expiresAt: "2100-01-01T00:00:00.000Z", createdAt: "2026-07-20T00:00:00.000Z", lastSeenAt: "2026-07-20T00:00:00.000Z" },
  { id: "session_course_student", token: "course-student-token", userId: "user_course_student", expiresAt: "2100-01-01T00:00:00.000Z", createdAt: "2026-07-20T00:00:00.000Z", lastSeenAt: "2026-07-20T00:00:00.000Z" }
);
apiDb.coursePlanning.annualPlans.push({
  id: "annual_2099",
  academicYear: 2099,
  operatingCreditLimit: 85,
  status: "draft",
  semesterPlans: [{ id: "annual_2099_spring", term: "spring", targetYears: [3], offerings: [] }]
});

async function courseApi({ method = "GET", pathname, token = "", body = {} }) {
  return handleApiRequest({
    method,
    pathname,
    authorization: token ? `Bearer ${token}` : "",
    readText: async () => JSON.stringify(body),
    db: apiDb,
    saveDb: async () => {},
    slackWebhook: ""
  });
}

const adminPlanning = await courseApi({ pathname: "/api/admin/course-planning", token: "course-admin-token" });
assert.equal(adminPlanning.status, 200, "administrator planning data must be authenticated");
assert.equal(adminPlanning.body.data.courses.some((course) => course.name === "현장실습4"), true);
const deniedPlanning = await courseApi({ pathname: "/api/admin/course-planning", token: "course-student-token" });
assert.equal(deniedPlanning.status, 403, "students must not read administrator planning data");

const createdSurvey = await courseApi({
  method: "POST",
  pathname: "/api/admin/course-demand-surveys",
  token: "course-admin-token",
  body: {
    semesterPlanId: "annual_2099_spring",
    eligibleCurrentYears: [2],
    opensAt: "2020-01-01T00:00:00.000Z",
    closesAt: "2100-01-01T00:00:00.000Z",
    status: "open"
  }
});
assert.equal(createdSurvey.status, 200);
assert.equal(createdSurvey.body.data.catalogSnapshot.every((course) => course.targetYears.includes(3)), true, "survey snapshot must only contain its next-semester target courses");

const invalidSurveyWindow = await courseApi({
  method: "POST",
  pathname: "/api/admin/course-demand-surveys",
  token: "course-admin-token",
  body: { semesterPlanId: "annual_2099_spring", eligibleCurrentYears: [2], opensAt: "not-a-date", closesAt: "2100-01-01T00:00:00.000Z", status: "open" }
});
assert.equal(invalidSurveyWindow.status, 400, "invalid survey dates must be reported as client errors, not server failures");

const studentSurveys = await courseApi({ pathname: "/api/me/course-demand-surveys", token: "course-student-token" });
assert.equal(studentSurveys.status, 200);
assert.equal(studentSurveys.body.data.length, 1);
const surveyId = studentSurveys.body.data[0].id;
const selectedCourseIds = studentSurveys.body.data[0].catalog.slice(0, 2).map((course) => course.id);
assert.equal(selectedCourseIds.length, 2);
const savedResponse = await courseApi({
  method: "PUT",
  pathname: `/api/me/course-demand-surveys/${surveyId}/response`,
  token: "course-student-token",
  body: { rankings: selectedCourseIds.map((courseId, index) => ({ courseId, rank: index + 1 })) }
});
assert.equal(savedResponse.status, 200);
assert.deepEqual(savedResponse.body.data.response.rankings.map((item) => item.rank), [1, 2]);

const duplicateResponse = await courseApi({
  method: "PUT",
  pathname: `/api/me/course-demand-surveys/${surveyId}/response`,
  token: "course-student-token",
  body: { rankings: [{ courseId: selectedCourseIds[0], rank: 1 }, { courseId: selectedCourseIds[0], rank: 2 }] }
});
assert.equal(duplicateResponse.status, 400, "duplicate course rankings must be rejected at the API boundary");

const surveySummary = await courseApi({ pathname: `/api/admin/course-demand-surveys/${surveyId}/summary`, token: "course-admin-token" });
assert.equal(surveySummary.status, 200);
assert.equal(surveySummary.body.data.responseCount, 1);
assert.equal(JSON.stringify(surveySummary.body.data).includes("20260001"), false, "admin summary must remain anonymous");

const recommendationResponse = await courseApi({ method: "POST", pathname: "/api/admin/annual-offering-plans/annual_2099/recommendations", token: "course-admin-token" });
assert.equal(recommendationResponse.status, 200);
assert.equal(Array.isArray(recommendationResponse.body.data.semesterPlans), true);

const invalidConfirmation = await courseApi({
  method: "PUT",
  pathname: "/api/admin/annual-offering-plans/annual_2099",
  token: "course-admin-token",
  body: { plan: { ...apiDb.coursePlanning.annualPlans[0], status: "confirmed" } }
});
assert.equal(invalidConfirmation.status, 400, "a plan with missing required courses must not be confirmed");

console.log("Course demand domain checks passed.");
