# 교과목 수요조사 및 편성 지원 구현 계획

> **For implementation:** 이 계획은 인라인 실행으로 진행한다. 각 작업은 테스트를 먼저 추가하고, 그 테스트가 실패하는 것을 확인한 뒤 최소 구현으로 통과시킨다.

**목표:** 학생이 다음 학기 희망 과목을 1~5순위로 제출하고, 관리자가 수요 집계와 학점·필수 규칙을 바탕으로 연간 개설안을 작성·확정할 수 있게 한다.

**구조:** 예약 도메인과 독립된 `coursePlanning` 단일 데이터 집합을 추가한다. 과목·교육과정·설문·응답·편성안을 한 객체로 보관해 Durable Object SQL 저장소의 기존 singleton 동기화 경로를 재사용한다. 규칙 계산은 `core/course-demand.mjs`에 순수 함수로 분리하고, `core.mjs`는 인증·라우팅·감사 로그·저장만 맡는다. 학생 화면은 대시보드의 설문 카드와 바텀시트, 관리자 화면은 새 `교과 편성` 메뉴로 제공한다.

**기술:** Node.js ESM, Cloudflare Worker/Durable Object, React 19, TypeScript, Astryx design system, Node `assert`, Playwright.

## 고정 제약

- 1·2학기 일반 운영학점의 합은 85학점을 절대 넘길 수 없다.
- 교육과정 버전의 130학점은 연간 85학점과 별도 계산한다.
- 전필은 해당 적합 학기에 누락된 편성안을 확정할 수 없다.
- `사진교과교육론`, `사진교수학습방법`은 각각 최근 2개 학년도에 확정/실제 개설 이력이 없다면 적합 학기의 필수 후보가 된다.
- 현장실습4는 4학년 2학기·학생 15·운영 0·교수인정 3으로만 저장한다. 현장실습1·2 등 방학 과목과 캡스톤디자인은 85학점에서 제외한다.
- 학생은 공개·진행 중이며 자신이 다음 학기에 수강 가능한 설문에만 1~5위 중 최대 5개를 제출한다. 마감 전 마지막 응답만 집계한다.
- 관리자 집계는 익명 집계만 제공한다. 다른 학생의 이름·학번·개별 순위는 반환하지 않는다.
- 사용자의 미추적 `.codex-audit/`, `equipment-list-2026-07-14.txt`는 수정·스테이징하지 않는다.

## 데이터 계약

`db.coursePlanning`의 기본값은 다음과 같다.

```js
{
  curriculumVersions: [{ id, academicYear, curriculumCreditLimit: 130, status }],
  courses: [{
    id, courseCode, name, majorType, targetYears, allowedTerms,
    studentCredit, operatingCredit, facultyRecognizedCredit,
    countsTowardCurriculum130, isMajorRequired, requiredFrequencyYears,
    deliveryPeriod, isSurveyEligible, active
  }],
  annualPlans: [{ id, academicYear, operatingCreditLimit: 85, status, semesterPlans }],
  surveys: [{ id, semesterPlanId, eligibleCurrentYears, opensAt, closesAt, status, catalogSnapshot }],
  responses: [{ id, surveyId, studentId, rankings: [{ courseId, rank }], submittedAt }],
  offeringHistory: [{ id, courseId, academicYear, term, status, confirmedAt }]
}
```

초기 과목은 승인된 설계 문서의 PDF 시드에서 만들되, 실제 과목 코드는 관리자가 후에 수정할 수 있게 한다. 특수 과목의 수치는 초기 시드부터 강제한다.

---

## 작업 1: 교과 도메인·시드·규칙 계산을 테스트로 고정

**파일**

- 생성: `core/course-demand.mjs`
- 생성: `scripts/course-demand-domain-test.mjs`
- 수정: `core.mjs:1-40,264-294,512-555`
- 수정: `storage-sql.mjs:1-12`
- 수정: `scripts/sql-storage-smoke-test.mjs`
- 수정: `package.json`

- [ ] `scripts/course-demand-domain-test.mjs`에 순수 도메인 테스트를 먼저 작성한다.
  - PDF 시드에 현장실습4, 캡스톤디자인, 두 2년 주기 과목과 최소 한 전필이 포함되는지 확인한다.
  - 현장실습4가 `allowedTerms: ["fall"]`, `targetYears: [4]`, 15/0/3 학점인지 확인한다.
  - 일반 과목 합계 86은 오류, 캡스톤·현장실습 추가는 85 합계를 늘리지 않는지 확인한다.
  - 전필 누락·2년 주기 기한 도래는 확정 오류, 수요 점수는 1~5위가 5~1점으로 집계되는지 확인한다.
  - 추천은 필수 과목, 운영 0 과목, 수요점수 내림차순을 지키고 85 초과 후보를 보류하는지 확인한다.
- [ ] `node scripts/course-demand-domain-test.mjs`를 실행해 helper 부재로 실패하는지 확인한다.
- [ ] `core/course-demand.mjs`를 구현한다.
  - `createCoursePlanningSeed`, `normalizeCoursePlanning`, `validateRanking`, `surveyForStudent`, `summarizeSurvey`, `buildOfferingRecommendation`, `validateAnnualPlan`, `confirmAnnualPlan`을 export한다.
  - 날짜 비교는 ISO 날짜/시각만 사용하고, 모든 결과는 안정적인 ID·이름 순서로 정렬한다.
  - `confirmAnnualPlan`은 검사 성공시에만 이력을 갱신하고 중복 이력을 만들지 않는다.
  - 반환값에는 사용자 개인정보나 원본 응답 행을 포함하지 않는다.
- [ ] `initialDb`에 `coursePlanning` 시드를 추가하고, `normalizeDb`가 기존 데이터에 빈/유효한 planning object를 보완하도록 한다.
- [ ] `storage-sql.mjs`의 `SINGLETON_KEYS`에 `coursePlanning`을 추가하고 저장·재기동·레거시 마이그레이션 뒤에도 데이터가 남는 smoke assertion을 추가한다.
- [ ] `package.json`에 `test:course-demand`를 추가한다.
- [ ] 실행: `npm run test:course-demand && npm run test:storage && npm run check`.
- [ ] 커밋: `2026-07-20 교과 수요조사 도메인 추가`.

## 작업 2: 권한 있는 교과목·설문·편성 API 추가

**파일**

- 수정: `core.mjs:624-1620`
- 수정: `core/course-demand.mjs`
- 수정: `scripts/course-demand-domain-test.mjs`
- 수정: `scripts/security-smoke-test.mjs`

- [ ] API 계약을 먼저 작성한다.
  - 학생: `GET /api/me/course-demand-surveys`, `PUT /api/me/course-demand-surveys/:surveyId/response`.
  - 관리자: `GET/PUT /api/admin/curriculum-versions`, `GET/PUT /api/admin/courses`, `GET/PUT /api/admin/annual-offering-plans`, `POST /api/admin/course-demand-surveys`, `GET /api/admin/course-demand-surveys/:surveyId/summary`, `POST /api/admin/annual-offering-plans/:planId/recommendations`, `PUT /api/admin/annual-offering-plans/:planId`.
  - 무인증·일반 학생이 관리자 경로를 호출하면 401/403, 학생이 대상 외/마감 설문을 수정하면 400/403인지 assert한다.
- [ ] 테스트가 새 route 부재로 실패하는지 실행한다: `npm run test:course-demand && npm run test:security`.
- [ ] `core.mjs`에 경로를 추가한다.
  - 관리자 수정마다 `audit`로 과목·설문·편성 변경을 남기고, 모든 변경은 `saveDb` 후에만 성공 응답한다.
  - `GET /api/me/course-demand-surveys`는 현재 로그인 학생의 다음 학년·학기 대상인지 서버에서 다시 판정하고, 공개 카탈로그·본인 응답만 반환한다.
  - `PUT .../response`는 1부터 연속한 순위·중복 없음·최대 5개·스냅샷 과목만 허용하며 기존 본인 응답을 upsert한다.
  - `summary`는 응답률·과목별 선택수·순위별 수·가중점수·학년별 익명 집계만 반환한다.
  - 추천 API는 저장하지 않고, 편성안 PUT의 `status: confirmed`만 서버 재검증 및 이력 반영을 수행한다.
- [ ] 실행: `npm run test:course-demand && npm run test:security && npm run check && npm run test:storage`.
- [ ] 커밋: `2026-07-20 교과 수요조사 API 추가`.

## 작업 3: 학생 대시보드 설문 카드·1~5위 바텀시트

**파일**

- 생성: `src/react/student/components/CourseDemandSurveySheet.tsx`
- 수정: `src/react/student/types.ts`
- 수정: `src/react/student/screens/HomeScreen.tsx`
- 수정: `src/react/student/student.css`
- 수정: `public/js/state.js`
- 수정: `public/js/react-student-adapter.js`
- 수정: `scripts/student-react-contract-test.mjs`
- 수정: `scripts/react-student-bridge-test.mjs`
- 수정: `tests/ui/react-student.spec.mjs`

- [ ] 먼저 UI/bridge 계약을 쓴다.
  - 대시보드에 `다음 학기 희망 과목 조사`, `1~5순위`, `응답하기`, `마감됨` 문구가 있는지 확인한다.
  - bridge가 두 학생 API 경로를 호출하고 `saveCourseDemandResponse` action을 노출하는지 확인한다.
  - Playwright는 열린 설문에서 과목을 선택해 순위를 바꾸고 저장한 뒤, 재열었을 때 순위와 저장 완료 상태가 남는지 확인한다.
- [ ] 실행: `npm run test:student-react && npm run test:student-bridge`가 새 UI/action 부재로 실패하는지 확인한다.
- [ ] `StudentState`에 `courseDemandSurveys`, `courseDemandSheetSurveyId`, `courseDemandSaving`을, `StudentActions`에 열기·닫기·저장 action을 추가한다.
- [ ] `react-student-adapter.js`의 refresh에서 설문을 독립적으로 읽고, 응답 저장 성공 시 설문 데이터만 갱신해 대시보드를 다시 렌더한다. 로그인/승인 상태가 아닐 때는 빈 배열로 안전하게 처리한다.
- [ ] `CourseDemandSurveySheet`를 `GjuDialog` 기반 바텀시트로 만든다.
  - 카탈로그 과목은 체크 시 빈 순위 중 가장 낮은 순위를 부여하고, 선택된 행은 위/아래 버튼으로 순서를 변경한다.
  - 1~5위 연속성·최대 5개·최소 1개를 클라이언트에서도 명확히 안내하되, 서버 검증을 대체하지 않는다.
  - 저장 중 중복 제출을 막고, 닫기 후 트리거에 포커스를 돌린다.
- [ ] `HomeScreen`의 다음 예약/빠른 예약 사이에 설문 카드 하나만 배치한다. 진행 중이면 응답/수정, 마감이면 내 응답 요약만 제공하며 새 최상위 학생 메뉴는 추가하지 않는다.
- [ ] 반응형 CSS는 기존 `student-react-favorite-sheet` 패턴을 재사용하고 44px 이상의 순위 조작 버튼과 safe-area 여백을 보장한다.
- [ ] 실행: `npm run test:student-react && npm run test:student-bridge && npx playwright test tests/ui/react-student.spec.mjs --config playwright.config.mjs`.
- [ ] 커밋: `2026-07-20 학생 교과 수요조사 화면 추가`.

## 작업 4: 관리자 교과 편성 화면과 편집 흐름

**파일**

- 생성: `src/react/admin/screens/AdminCourseDemand.tsx`
- 수정: `src/react/admin/AdminApp.tsx`
- 수정: `src/react/platform/adminNav.ts`
- 수정: `src/react/platform/types.ts`
- 수정: `public/js/state.js`
- 수정: `public/js/data.js`
- 수정: `public/js/renderer.js`
- 수정: `src/react/design-system/react-admin.css`
- 수정: `scripts/react-admin-data-test.mjs`
- 수정: `scripts/react-admin-contract-test.mjs`
- 수정: `scripts/react-admin-render-test.mjs`
- 수정: `scripts/admin-dashboard-ux-test.mjs`
- 수정: `tests/ui/react-admin.spec.mjs` (또는 기존 관리자 Playwright spec)

- [ ] 먼저 data/렌더 계약을 추가한다.
  - `adminViewDescriptor("course-demand")`가 편성 데이터 endpoint를 한 번만 호출하고 cache/race 규칙을 지키는지 확인한다.
  - 관리자 내비게이션과 화면에 `교과 편성`, `85학점`, `필수 후보`, `수요 점수`, `편성안 확정`이 있는지 확인한다.
  - 렌더 fixture에서 85 초과 오류, 전필/2년 주기 경고, 익명 설문 집계, 현장실습4 15/0/3 표기가 모두 보이는지 확인한다.
- [ ] 실행: `npm run test:react-admin && npm run check:react-admin && npm run test:admin-ui`가 새 view 부재로 실패하는지 확인한다.
- [ ] `AdminView`/상태/필터 타입을 확장해 `course-demand` 전용 데이터를 보관한다. 모바일 More sheet에만 이 항목을 추가해 핵심 예약 탭 수를 늘리지 않는다.
- [ ] `data.js`에 view-scoped descriptor를 추가한다. 기본 데이터는 교육과정·과목·연간 편성안·설문 요약을 함께 받는 관리자 endpoint 하나로, 세부 집계는 선택된 설문 summary endpoint로 지연 요청한다.
- [ ] `renderer.js` action에 다음을 추가한다: 교육과정/과목 저장, 연간 편성안 저장, 설문 공개/마감, 추천 미리보기, 수동 과목 추가·제외·학기 변경·사유 저장, 최종 확정. 모든 mutation은 기존 `runAdminMutation`으로 토스트·캐시 무효화·재로딩을 통일한다.
- [ ] `AdminCourseDemand.tsx`를 두 개의 탭으로 만든다.
  - **수요조사:** 대상 학년, 기간, 응답률, 과목별 점수/선택수/순위 분포, 공개·마감 상태.
  - **편성안:** 1·2학기 열, 85학점 사용/잔여, 130학점 교육과정 점검, 필수·경고·오류, 추천 반영과 수동 조정 사유 입력.
  - 오류가 있으면 확정 버튼을 disabled하고 오류 이유를 같은 영역에 제공한다. 단순 경고는 사유를 남긴 후 확정 가능하게 한다.
- [ ] 과목 마스터 편집은 초기 시드 목록의 과목명·코드·학년·학기·전필·세 학점 값을 수정할 수 있게 하며, 현장실습4의 불변 값은 서버 오류를 UI에서도 안내한다.
- [ ] 실행: `npm run check:react-admin && npm run test:react-admin && npm run test:admin-ui && npx playwright test tests/ui/react-admin.spec.mjs --config playwright.config.mjs`.
- [ ] 커밋: `2026-07-20 관리자 교과 편성 화면 추가`.

## 작업 5: 번들·전체 회귀·검수

**파일**

- 수정(생성 결과): `public/js/react-admin.generated.js`, `public/css/react-admin.generated.css`는 `.gitignore` 대상이므로 커밋하지 않는다.
- 필요 시 수정: `docs/superpowers/specs/2026-07-20-course-demand-survey-design.md` (구현과 불일치한 공개 계약만 보정)

- [ ] public 번들을 생성한다: `npm run build:react-admin`.
- [ ] 전체 정적 검증을 실행한다.

```bash
npm run check
npm run check:js
npm run check:react-admin
npm run test:course-demand
npm run test:smart-reservation
npm run test:student-react
npm run test:student-bridge
npm run test:react-admin
npm run test:admin-ui
npm run test:storage
npm run test:security
npm run test:ui
```

- [ ] 로컬 서버에서 관리자와 학생으로 각각 확인한다.
  - 학생: 대상 설문만 보이고 1~5위 저장/수정/마감 표시가 정상인지.
  - 관리자: 85학점 초과, 전필 누락, 2년 주기 도래, 현장실습4 예외가 올바르게 표시·차단되는지.
- [ ] `git diff --check`, `git status --short`, 최종 변경 파일과 미추적 사용자 파일 분리를 확인한다.
- [ ] 커밋: `2026-07-20 교과 수요조사 기능 검증 완료` (문서 수정이 있을 때만).

## 완료 조건

1. 관리자는 초기 PDF 기반 과목 시드를 검수하고 130학점 교육과정 및 85학점 연간 편성안을 관리할 수 있다.
2. 다음 학기 수강 대상 학생만 열린 설문에서 최대 다섯 과목을 1~5위로 제출·수정할 수 있다.
3. 관리자는 익명 수요 집계·추천 초안·수동 조정·검증 결과를 한 화면에서 확인하고, 하드 규칙을 통과한 편성안만 확정할 수 있다.
4. 확정된 개설 이력은 두 과목의 2년 주기 검사에 재사용된다.
5. 기존 예약·즐겨찾기·통계·알림의 자동/브라우저 회귀 테스트가 모두 유지된다.
