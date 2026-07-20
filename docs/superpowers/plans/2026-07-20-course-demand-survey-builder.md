# 학년·학기별 교과 수요조사 빌더 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자가 편성안 없이 학년·학기별 전선 5~6개로 설문안을 만들고, 학생이 예술·다큐멘터리·광고·영상 카테고리를 확인하며 1~5순위로 투표하게 한다.

**Architecture:** 기존 `coursePlanning` singleton 저장 구조와 학생 응답 API는 유지한다. `core/course-demand.mjs`에 카테고리·설문 정의 검증·스냅샷·집계를 순수 함수로 추가하고, `core.mjs`의 관리자 설문 API가 연간 편성안 대신 이 함수들을 사용한다. React 관리자 화면은 설문안·과목 관리·결과 탭으로 재구성하고 학생 바텀시트는 카테고리별 후보 목록을 렌더링한다.

**Tech Stack:** Node.js ESM, Cloudflare Worker/Durable Object, React 19, TypeScript, Astryx design system, esbuild, Playwright

## Global Constraints

- 설문 생성은 `annualPlans` 또는 `semesterPlanId`를 요구하지 않는다.
- 관리자 화면에서 편성안·85학점·130학점 UI를 제거한다.
- 공개 설문은 활성 전선 과목 5~6개만 허용한다.
- 수요 카테고리는 `art`, `documentary`, `advertising`, `video` 네 값만 허용한다.
- 카테고리별 최소 선택 수는 없다.
- 학생은 최소 1개, 최대 5개를 1~5순위로 제출한다.
- 관리자에게 학생 이름·학번·개별 응답을 반환하지 않는다.
- 공개된 설문의 후보 스냅샷과 대상 조건은 변경하지 않는다.
- 기존 설문·응답·연간 편성안 데이터는 삭제하지 않는다.
- 기존 Astryx UI 패턴을 재사용하며 새 이미지 자산이나 라이브러리를 추가하지 않는다.
- 사용자가 요청한 대로 구현 중 서브에이전트를 사용하지 않고, 완료 직전 전체 QA를 한 번에 수행한다.

---

### Task 1: 카테고리·독립 설문 정의 도메인

**Files:**
- Modify: `scripts/course-demand-domain-test.mjs`
- Modify: `core/course-demand.mjs`

**Interfaces:**
- Produces: `COURSE_DEMAND_CATEGORIES`, `buildCourseDemandCatalog({ courses, courseIds, targetStudentYears, term })`, `validateCourseDemandSurveyDefinition({ input, courses, existingSurveys, currentSurveyId })`
- Extends: course records with `demandCategory`
- Extends: `summarizeSurvey()` result with `categories`
- Consumed by: Task 2 API routes and Tasks 3–4 React types

- [ ] **Step 1: Write failing seed and category tests**

Add assertions that every active survey-eligible semester course has one of the four category values and that normalization preserves an explicitly edited category.

```js
const categoryValues = new Set(["art", "documentary", "advertising", "video"]);
assert(seed.courses.filter((course) => course.active && course.isSurveyEligible).every((course) => categoryValues.has(course.demandCategory)));
assert.equal(normalizeCoursePlanning({ courses: [{ id: "custom", name: "커스텀", demandCategory: "video" }] }).courses[0].demandCategory, "video");
```

- [ ] **Step 2: Run the domain test and verify RED**

Run: `npm run test:course-demand`  
Expected: FAIL because `demandCategory` and new exports are missing.

- [ ] **Step 3: Add category constants and explicit seed mapping**

Add an exported constant and a deterministic seed classifier. `courseRecord()` must preserve a valid supplied category and otherwise classify the known seed by name.

```js
export const COURSE_DEMAND_CATEGORIES = ["art", "documentary", "advertising", "video"];
const COURSE_DEMAND_CATEGORY_SET = new Set(COURSE_DEMAND_CATEGORIES);

function seedDemandCategory(name) {
  if (/영상|드론/.test(name)) return "video";
  if (/다큐|포토\s?스토리|포토에세이|장소/.test(name)) return "documentary";
  if (/커머셜|라이팅|스튜디오|프린트/.test(name)) return "advertising";
  return "art";
}
```

Add `demandCategory: COURSE_DEMAND_CATEGORY_SET.has(options.demandCategory) ? options.demandCategory : seedDemandCategory(name)` to `courseRecord()`.

- [ ] **Step 4: Write failing independent catalog validation tests**

Cover these exact cases with real seed courses or explicit fixtures:

```js
const candidates = Array.from({ length: 6 }, (_, index) => ({
  id: `elective-${index}`,
  name: `전선 ${index}`,
  majorType: "전선",
  active: true,
  isSurveyEligible: true,
  targetYears: [2],
  allowedTerms: ["fall"],
  demandCategory: ["art", "documentary", "advertising", "video"][index % 4],
  studentCredit: 3
}));
assert.equal(buildCourseDemandCatalog({ courses: candidates, courseIds: candidates.slice(0, 5).map((course) => course.id), targetStudentYears: [2], term: "fall" }).length, 5);
assert.throws(() => buildCourseDemandCatalog({ courses: [{ ...candidates[0], majorType: "전필" }], courseIds: [candidates[0].id], targetStudentYears: [2], term: "fall" }), /전선/);
assert.throws(() => validateCourseDemandSurveyDefinition({ input: { status: "open", courseIds: candidates.slice(0, 4).map((course) => course.id) }, courses: candidates }), /5개 또는 6개/);
```

Also test draft 0–6, open 5–6, invalid category, target mismatch, duplicate candidate, invalid date order, and duplicate open survey for the same academic year/term/current grade.

- [ ] **Step 5: Run the domain test and verify RED**

Run: `npm run test:course-demand`  
Expected: FAIL because `buildCourseDemandCatalog` and `validateCourseDemandSurveyDefinition` do not exist.

- [ ] **Step 6: Implement minimal catalog and survey validation**

`buildCourseDemandCatalog()` must preserve `courseIds` order and return only these snapshot fields:

```js
{
  id: course.id,
  courseCode: course.courseCode || "",
  name: course.name,
  targetYears: numberList(course.targetYears),
  allowedTerms: uniqueStrings(course.allowedTerms),
  studentCredit: Number(course.studentCredit || 0),
  demandCategory: course.demandCategory
}
```

Reject missing, duplicate, inactive, non-survey, non-`전선`, wrong-year, wrong-term, or invalid-category records. `validateCourseDemandSurveyDefinition()` returns normalized `title`, `academicYear`, `term`, year arrays, ISO dates, status, and `catalogSnapshot`. Drafts may contain 0–6 candidates; open surveys require 5–6.

- [ ] **Step 7: Add category aggregation**

Extend each course summary row with `demandCategory` and return:

```js
categories: COURSE_DEMAND_CATEGORIES.map((category) => ({
  category,
  selections: courseRows.filter((course) => course.demandCategory === category).reduce((sum, course) => sum + course.selections, 0),
  demandScore: courseRows.filter((course) => course.demandCategory === category).reduce((sum, course) => sum + course.demandScore, 0)
}))
```

- [ ] **Step 8: Run tests and commit**

Run: `npm run test:course-demand && npm run check`  
Expected: PASS.

```bash
git add core/course-demand.mjs scripts/course-demand-domain-test.mjs
git commit -m "2026-07-20 교과 수요조사 카테고리 도메인 추가"
```

---

### Task 2: 편성안 없는 관리자 설문 API

**Files:**
- Modify: `scripts/course-demand-domain-test.mjs`
- Modify: `core.mjs`
- Modify: `src/react/platform/types.ts`
- Modify: `public/js/renderer.js`

**Interfaces:**
- Consumes: Task 1 `validateCourseDemandSurveyDefinition()` and `summarizeSurvey()`
- Produces: independent `POST/PUT /api/admin/course-demand-surveys` contract
- Produces: typed `AdminCourseDemandSurveyInput`, enriched survey summaries, and matching bridge actions

- [ ] **Step 1: Write failing API integration tests**

Using the existing `handleApiRequest` harness, create an admin token, save six categorized elective fixtures, then assert:

```js
const created = await api("POST", "/api/admin/course-demand-surveys", {
  title: "2027학년도 2학년 2학기 수요조사",
  academicYear: 2027,
  term: "fall",
  eligibleCurrentYears: [2],
  targetStudentYears: [2],
  opensAt: "2099-01-01T00:00:00.000Z",
  closesAt: "2099-01-31T14:59:59.000Z",
  status: "open",
  courseIds: electiveCourses.slice(0, 5).map((course) => course.id)
}, adminToken);
assert.equal(created.status, 200);
assert.equal(created.body.data.semesterPlanId, undefined);
assert.equal(created.body.data.catalogSnapshot.length, 5);
```

Add negative tests for four-course publication, a major-required course, duplicate open survey, and mutation of an open survey's candidate IDs. Add a positive test that a draft can later be published with five candidates and an open survey can extend `closesAt` or close.

- [ ] **Step 2: Run the API test and verify RED**

Run: `npm run test:course-demand`  
Expected: FAIL with `설문 대상 학기 편성안을 찾을 수 없습니다.`.

- [ ] **Step 3: Replace POST route dependency on annual plans**

Import Task 1 validators. The route must call:

```js
const definition = validateCourseDemandSurveyDefinition({
  input: body,
  courses: planning.courses,
  existingSurveys: planning.surveys
});
const survey = {
  id: id("course_survey"),
  ...definition,
  createdAt: nowIso(),
  updatedAt: nowIso()
};
```

Audit `academicYear`, `term`, `eligibleCurrentYears`, `targetStudentYears`, and catalog count. Do not store a new `semesterPlanId`.

- [ ] **Step 4: Make PUT state-aware**

- Draft survey: merge editable definition fields and revalidate with `currentSurveyId`.
- Open survey: reject `title`, year, term, target arrays, or `courseIds`; allow only a later `closesAt` and `status: closed`.
- Closed survey: reject content or status changes.
- Preserve `catalogSnapshot` once the survey has been opened.

- [ ] **Step 5: Enrich the admin listing and course persistence**

Return survey `title`, `academicYear`, `term`, dates, target arrays, catalog count, catalog snapshot, and category-aware summary from `GET /api/admin/course-planning`. Ensure `normalizeCoursePlanningCourses()` preserves `demandCategory` through Task 1 normalization.

- [ ] **Step 6: Update frontend contracts and bridge**

Add:

```ts
export type CourseDemandCategory = "art" | "documentary" | "advertising" | "video";

export type AdminCourseDemandSurveyInput = {
  title: string;
  academicYear: number;
  term: "spring" | "fall";
  eligibleCurrentYears: number[];
  targetStudentYears: number[];
  opensAt: string;
  closesAt: string;
  status: "draft" | "open";
  courseIds: string[];
};
```

Make `semesterPlanId` optional, add `catalogSnapshot`, category summary rows, and use the input type in `ReactAdminActions`. Update renderer success messages without annual-plan language.

- [ ] **Step 7: Run tests and commit**

Run: `npm run test:course-demand && npm run test:react-admin && npm run check:react-admin`  
Expected: PASS.

```bash
git add core.mjs scripts/course-demand-domain-test.mjs src/react/platform/types.ts public/js/renderer.js
git commit -m "2026-07-20 독립 교과 수요조사 API 추가"
```

---

### Task 3: 관리자 설문 빌더·과목 관리·결과 화면

**Files:**
- Modify: `scripts/react-admin-contract-test.mjs`
- Modify: `scripts/react-admin-render-test.mjs`
- Modify: `src/react/admin/screens/AdminCourseDemand.tsx`
- Modify: `src/react/platform/adminNav.ts`
- Modify: `src/react/admin/AdminApp.tsx`
- Modify: `src/react/design-system/react-admin.css`

**Interfaces:**
- Consumes: Task 2 survey input and enriched planning state
- Produces: `설문안`, `과목 관리`, `결과` admin UI

- [ ] **Step 1: Write failing source and render contracts**

Assert the nav and screen contain `교과 수요조사`, `설문안`, `과목 관리`, `결과`, `예술`, `다큐멘터리`, `광고`, `영상`, `선택한 후보`, `임시저장`, `설문 공개`. Assert they do not contain `편성안`, `85학점`, `130학점`, `수요 기반 추천 만들기`, or `편성안 확정`.

Render planning state with six categorized electives and assert the form exposes year/term/grade/date controls and candidate selection controls. Render a summary and assert category totals and rank counts appear.

- [ ] **Step 2: Run contracts and verify RED**

Run: `npm run test:react-admin`  
Expected: FAIL because the current screen defaults to the plan tab and requires an annual plan.

- [ ] **Step 3: Replace the screen with three focused tabs**

Use module-level constants to avoid recreating category config:

```ts
const DEMAND_CATEGORIES = [
  { key: "art", label: "예술" },
  { key: "documentary", label: "다큐멘터리" },
  { key: "advertising", label: "광고" },
  { key: "video", label: "영상" }
] as const;
```

Derive candidate courses during render from `active`, `isSurveyEligible`, `majorType === "전선"`, selected target year, selected term, and a valid category. Use a `Set<string>` for selected IDs. Do not copy planning data into effect-driven derived state.

- [ ] **Step 4: Implement 설문안 tab behavior**

- Fields: title, academic year, term, current grade, target grade, opensAt, closesAt.
- Category tabs filter the candidate list but do not impose quotas.
- Candidate buttons toggle IDs and stop at six.
- Show `선택한 후보 n/6` and selected course names.
- `임시저장` submits draft with 0–6.
- `설문 공개` is disabled unless 5–6 candidates and valid fields are present.
- Existing survey cards show draft/open/closed status, target, period, candidate count, and close action.

- [ ] **Step 5: Implement 과목 관리 tab behavior**

Keep existing identity and credit fields for data compatibility, but prioritize editable `majorType`, target years, allowed terms, `demandCategory`, `isSurveyEligible`, and `active`. Show `카테고리 지정 필요` for invalid values. Saving calls `saveCoursePlanningCourses(courses)`.

- [ ] **Step 6: Implement 결과 tab behavior**

Allow survey selection. Show response count/rate, four category summary rows, and course rows sorted by demand score with selections, score, and ranks 1–5. Do not render student identity fields.

- [ ] **Step 7: Add responsive CSS**

Use open workspace sections rather than nested card grids. Candidate rows must remain 44px touch targets, selected state must use the existing primary token, and mobile layouts must collapse to one column without horizontal overflow.

- [ ] **Step 8: Run tests and commit**

Run: `npm run test:react-admin && npm run check:react-admin && npm run check:js`  
Expected: PASS.

```bash
git add scripts/react-admin-contract-test.mjs scripts/react-admin-render-test.mjs src/react/admin/screens/AdminCourseDemand.tsx src/react/platform/adminNav.ts src/react/admin/AdminApp.tsx src/react/design-system/react-admin.css
git commit -m "2026-07-20 관리자 교과 수요조사 빌더 추가"
```

---

### Task 4: 학생 카테고리별 1~5순위 투표

**Files:**
- Modify: `scripts/student-react-contract-test.mjs`
- Modify: `scripts/react-student-bridge-test.mjs`
- Modify: `src/react/student/types.ts`
- Modify: `src/react/student/components/CourseDemandSurveySheet.tsx`
- Modify: `src/react/student/screens/HomeScreen.tsx`
- Modify: `src/react/student/student.css`

**Interfaces:**
- Consumes: Task 2 student survey payload with title/year/term/category
- Preserves: existing `saveCourseDemandResponse(surveyId, rankings)` bridge

- [ ] **Step 1: Write failing student contracts**

Create a six-course survey containing all four categories. Assert rendered markup contains the survey title, target year/term, four non-empty category labels, and each course exactly once. Assert a category with no courses is omitted. Keep existing 1–5 selection and accessible reorder assertions.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm run test:student-react && npm run test:student-bridge`  
Expected: FAIL because category fields are absent and the sheet renders one flat candidate list.

- [ ] **Step 3: Extend student types and public payload**

Add `demandCategory` to `StudentCourseDemandCatalogCourse` and `title`, `academicYear`, `term`, `targetStudentYears` to `StudentCourseDemandSurvey`. Ensure `publicSurveyForStudent()` returns only these safe survey fields plus the student's own response.

- [ ] **Step 4: Group the survey catalog**

Use a module-level category list and derive groups with `useMemo` from `survey.catalog`. Render only non-empty groups. Each group heading shows the Korean label; course buttons retain existing selected state, credits, and 44px target. Keep the selected ranking list above candidates.

- [ ] **Step 5: Improve dashboard copy**

Use the survey title when present and show the target `n학년 · 1학기/2학기` in the dashboard card. Preserve the no-survey, approval, open, response-complete, and closed states already implemented.

- [ ] **Step 6: Add responsive category styling**

Add `.student-react-course-demand-sheet__category` and heading styles while preserving the current mobile bottom-sheet height, scroll container, and full-width save button behavior.

- [ ] **Step 7: Run tests and commit**

Run: `npm run test:student-react && npm run test:student-bridge && npm run check:react-admin`  
Expected: PASS.

```bash
git add scripts/student-react-contract-test.mjs scripts/react-student-bridge-test.mjs src/react/student/types.ts src/react/student/components/CourseDemandSurveySheet.tsx src/react/student/screens/HomeScreen.tsx src/react/student/student.css core/course-demand.mjs
git commit -m "2026-07-20 학생 교과 카테고리 투표 화면 추가"
```

---

### Task 5: 전체 회귀 검증과 배포 준비

**Files:**
- Modify only if verification exposes a defect in the files above

**Interfaces:**
- Verifies all prior task outputs as one release candidate

- [ ] **Step 1: Build production frontend bundles**

Run: `npm run build:react-admin`  
Expected: `React Admin/Student bundles written for public`.

- [ ] **Step 2: Run static and feature checks**

Run:

```bash
npm run check
npm run check:js
npm run check:react-admin
npm run test:course-demand
npm run test:react-admin
npm run test:student-react
npm run test:student-bridge
npm run test:backend-domains
npm run test:storage
npm run test:security
```

Expected: all commands exit 0.

- [ ] **Step 3: Run browser QA**

Run: `npm run test:ui`  
Expected: 106 passed and 14 viewport-specific skips, or a higher pass count if new tests are added; no failures.

Verify at mobile 390px and desktop 1440px that:

- 관리자 메뉴에 `교과 수요조사`가 보인다.
- 편성안과 85/130학점 UI가 없다.
- 5~6개 후보 선택·공개 흐름에 가로 넘침이 없다.
- 학생 설문 바텀시트가 카테고리별로 표시되고 순위 조작이 가능하다.

- [ ] **Step 4: Verify repository state**

Run: `git diff --check && git status --short`  
Expected: only intentionally preserved user files `.codex-audit/` and `equipment-list-2026-07-14.txt` remain untracked; no implementation files are unstaged.

- [ ] **Step 5: Final verification commit only if needed**

If verification required source fixes, stage only those files and commit:

```bash
git commit -m "2026-07-20 교과 수요조사 빌더 검증 보완"
```

Do not deploy or create a new App Store/Android build without a separate explicit deployment request.
