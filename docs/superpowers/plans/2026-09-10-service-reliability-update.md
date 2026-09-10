# 서비스 통계·갱신·배포 안정화 구현 계획

> **For agentic workers:** Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 사용자 지시에 따라 메인 에이전트가 순차 구현하고, 서브에이전트는 필요할 때 최종 통합 검증에만 사용한다.

**Goal:** 과거 통계가 현재 설정에 의해 바뀌는 문제를 해결하고, 설문 마감 집계·화면 갱신·웹/앱 배포 버전을 일관되게 관리한다.

**Architecture:** 기존 Node 공통 API와 Cloudflare Worker/Durable Object 저장 구조를 유지한다. 집계 계산, 마감 스냅샷, 클라이언트 갱신 수명주기, 빌드 식별을 작은 모듈로 분리하고 기존 API 응답에는 호환 필드를 추가한다. 통계 검증은 목록과 같은 데이터 스냅샷을 사용하고, 과거 사실을 복원할 수 없는 데이터에는 불확실성을 표시한다.

**Tech Stack:** Node.js ES modules, React/TypeScript, Cloudflare Workers/Pages, Durable Object SQLite, Capacitor iOS/Android, Node assert, Playwright.

## Global Constraints

- 작성일: 2026-09-10. 조사 기준 커밋: `163a98c`, 현재 브랜치: `main`. 문서 작성 자체는 구현·배포 실행이 아니다.
- 구현은 한 작업 흐름으로 진행하고, 중간마다 검증 에이전트를 새로 생성하지 않는다.
- `.codex-audit/`, `outputs/`의 기존 미추적 자료를 변경하거나 커밋하지 않는다.
- 예약·학생·장비·응답 원본을 통계 보정을 위해 삭제하거나 임의 수정하지 않는다.
- QR, 수업 편성안, 새 대시보드, 신규 외부 분석 서비스는 추가하지 않는다.
- 기존 `equipmentUtilization`, `reservedDays`, `utilizationPercent`, `responseCount` 필드를 유지한다. UI 문구는 실제 의미인 예약일 비율을 사용한다.
- 브라우저 복귀 갱신과 기존 네이티브 복귀 갱신을 통합한다. 네이티브 복귀 기능이 없는 것으로 취급해 중복 구현하지 않는다.
- 수동 새로고침은 유지한다. 자동 갱신 실패로 기존 숫자를 0으로 바꾸지 않는다.
- 개인정보·응답자 식별자를 공개 API, 로그, 빌드 메타데이터, 관리자 설문 결과에 노출하지 않는다.
- 커밋은 실제 작업 날짜와 변경 요약을 포함한다. 확정된 테스트가 통과한 후에만 다음 배포 단계로 진행한다.
- Android 테스터 요건은 기존에 알려진 외부 제약이다. 구현 시 콘솔 상태를 다시 확인하며, 빌드 완료를 출시 완료로 보고하지 않는다.

## 1. 현재 상태와 확인 근거

| 항목 | 확인된 사실 | 이번 처리 |
|---|---|---|
| 과거 장비 통계 | `core/operations-insights.mjs`가 현재 예약 가능 장비만 통계에 포함. 동일 반납 예약인데 장비를 수리중으로 바꾸면 통계에서 사라짐 | 역사 집계와 현재 가용 재고 분리 |
| 설문 마감 | `core.mjs`의 `surveyTargetCount`가 조회 시 현재 학생과 기존 응답자를 합산. 마감된 설문도 현재 값 사용 | 마감 결과 고정 및 레거시 안내 |
| 데이터 갱신 | 관리자 조회 캐시는 15초. 기존 네이티브 복귀 처리와 수동 갱신 존재. 일부 mutation의 명시적 무효화 목록에 dashboard 없음 | 공통 무효화 및 복귀 갱신 |
| 운영 배포 검사 | `check-production-deploy.mjs`가 HTML의 첫 버전 문자열과 app.js를 검사. 최신 관리자 번들 동일성은 정식 검사에 없음 | 파일별 해시·커밋 식별 검사 |
| 네이티브 | 로컬 iOS/Android 내장 index가 이전 번들 URL 사용. Capacitor는 dist를 내장하며 웹 원격 로딩 설정이 아님 | 최신 빌드 동기화·검증·스토어 반영 |
| 기본 집계 | 기존 105건 페이지 교차 검사, 집계/수요조사 테스트 통과 | 기존 회귀 검사 보존 |

참고 문서:
- `docs/qa/2026-09-08-counting-audit.md`
- `docs/qa/2026-09-08-operating-metrics.md`
- `docs/qa/2026-09-08-insights-correction.md`
- `docs/native-app-build.md`
- `docs/service-specification/05-deployment-operations-security.md`

## 2. 집계 계약

| 표시 | 기간·대상 | 제외/분모 | 목록 또는 검증 기준 |
|---|---|---|---|
| 가입 승인 대기 | 현재 학생 역할, approval_pending | 관리자 제외 | 학생 목록 total |
| 기자재 승인 대기/승인 완료/대여 중 | 해당 기자재 예약 상태 | 예약 건수이며 장비 대수가 아님 | 해당 상태 예약 목록 total |
| 오늘 예약 중 반납 완료/취소·반려 | 오늘 예약 시작일 | 관리자 취소 포함 | 동일 날짜·상태 목록 total |
| 미제출 보고서 | 제출 의무 발생, 제출 기록 없음 | 미도래·의무 면제·취소 제외 | missing 목록 total |
| 제출 보고서 확인 대기 | 보고서 목록과 동일 상태 정규화 | 이미 확인한 보고서 제외 | submitted 목록 total |
| 이번 주 예약 | 한국시간 월~일 예약 시작일 | 취소·반려 제외, 주 후반 미래 예약 포함 | 같은 주 필터 |
| 현재 대여 가능 비율 | 활성 등록 장비 중 현재 대여 가능 | 문의/제한/수리/현재 점유 제외, 전체 활성 등록 수 분모 | 가능+점유+설정상 제한=전체 |
| 최근 취소 건수 | 최근 28일 예약 시작일 | 취소·관리자 취소·반려 | reserved 날짜 기준 |
| 최근 취소율 | 최근 28일 접수일 | 취소·반려 / 기간 내 접수 전체 | created 날짜 기준 |
| 예약 많은 시간 | 최근 28일 유효 예약 시작일·시간 | 동일 유형·시간 3건 미만 제외 | operational+정확한 시간 필터 |
| 장비 예약일 비율 | 기간과 겹치는 유효 장비 예약의 달력 날짜 합집합 | 취소 제외, 기간 밖 잘라내기, 현재 상태로 과거 제외 금지 | 중복 제거 일수 / 28일 |
| 수요조사 응답률 | 공개 중은 현재 대상+기응답자 합집합; 마감 후 스냅샷 | 학생별 최신 응답 1건 | 상세·목록·내보내기 동일 스냅샷 |
| 특강 신청 | 내부 신청+기초 외부 신청 | 취소된 내부 신청 제거 | 외부 기초 인원이 포함됨을 안내 |

예약일 비율은 실제 사용시간 통계가 아니다. 반납 시각을 실제 사용시간으로 추정하거나 28일을 영업일로 임의 변경하지 않는다.

## 3. 작업 순서

`Task 1 기준/회귀 검사 → Task 2 과거 장비 통계 → Task 3 설문 마감 → Task 4 갱신 → Task 5 배포 검증 → Task 6 통합 QA·웹/앱 반영`

Task 2와 3은 각각 독립 검증 가능한 변경으로 나누되 실제 작업은 메인에서 순서대로 수행한다. Task 6에서 전체 검증을 한 차례 묶어 진행한다.

### Task 1: 집계 기준 및 회귀 계약 고정

**Files**
- Modify: `scripts/count-consistency-test.mjs`, `scripts/dashboard-data-integrity-test.mjs`
- Modify: `docs/qa/2026-09-08-counting-audit.md`
- Create: `docs/qa/2026-09-10-service-reliability-signoff.md`

**Interfaces**
- Consumes: `GET /api/admin/summary`, 각 관리자 목록의 `{ items, total, page, pageSize }`.
- Produces: 위 집계 계약과 최종 QA 기록 양식. 계산 수식을 바꾸는 작업은 Task 2/3에서 진행.

- [ ] 현재 git 상태와 실행 가능한 테스트 명령을 기록한다. 관련 없는 수정이 있으면 보존하고 해당 파일과 충돌 여부를 확인한다.
- [ ] `npm run test:dashboard-integrity`, `npm run test:smart-reservation`, `npm run test:course-demand`를 실행해 기준 결과를 저장한다. 기대: 모두 통과.
- [ ] 검증 케이스에 0건·105건·마지막 페이지·취소/반려·동일 장비 중복·한국시간 일요일/월요일 경계를 지정한다. 시간은 테스트 입력으로 고정해 날짜에 따른 간헐 실패를 피한다.
- [ ] 최종 QA 표에 검증용 데이터 검사와 운영 계정 읽기 전용 대조를 별도 항목으로 만든다. 운영 접근이 없으면 후자를 미확인으로 남기며 테스트 결과로 대체하지 않는다.
- [ ] 위 계약 중 기존 결과와 달라지는 것은 이유와 영향 화면을 기록한 뒤 해당 후속 Task의 실패 테스트로 옮긴다.

**완료 기준:** 숫자별 기준과 클릭 목적지가 명시되고 현재 기준 테스트 결과가 기록됨.

### Task 2: 과거 장비 통계를 현재 상태에서 분리

**Files**
- Modify: `core/operations-insights.mjs`
- Modify: `scripts/smart-reservation-domain-test.mjs`
- Modify: `src/react/admin/screens/AdminDashboard.tsx` (필요한 상태 안내만)
- Modify: `docs/qa/2026-09-08-insights-correction.md`

**Interfaces**
- Consumes: `buildOperationsInsights({ reservations, equipment, settings, now, days })`.
- Produces: 기존 응답 형태 그대로, 현재 상태 변경에 영향받지 않는 `equipmentUtilization`.
- Internal: `buildHistoricalEquipmentIndex(equipment, reservations)` → 장비 ID를 키로 한 `{ id, code, name, category }` Map. 현재 장비 메타데이터를 우선 쓰고 예약 상세의 장비 메타데이터를 보조로 사용한다.

- [ ] 다음 재현을 실패 회귀 테스트로 추가한다.

```js
const reservation = {
  id: "history", type: "equipment", status: "returned",
  fields: { reservedDate: "2026-09-01", equipmentItemIds: ["eq"] },
  timing: { endAt: "2026-09-01T08:00:00Z" }
};
const measure = status => buildOperationsInsights({
  reservations: [reservation],
  equipment: [{ id: "eq", name: "카메라", active: true, reservable: true, status }],
  now: new Date("2026-09-10T12:00:00+09:00")
}).equipmentUtilization;
assert.deepEqual(measure("가능"), measure("수리중"));
```

- [ ] `npm run test:smart-reservation` 실행. 기존 구현에서는 수리중 결과가 빈 배열이어서 실패해야 한다.
- [ ] 역사 집계의 장비 집합을 예약의 `equipmentItems`와 `fields.equipmentItemIds`, 장비 원본의 합집합으로 구성한다. active/reservable/inquiryOnly/status 필터는 현재 가용성·부족 경고에만 적용한다.
- [ ] ID만 남은 장비는 ID 단위 집계를 유지하고 이름은 `기록상 장비`로 표시한다. 이름으로 병합하지 않는다. 원본에 예약 자체가 없으면 새 이력을 만들지 않는다.
- [ ] 모든 장비의 예약일 집계를 먼저 계산한다. 부족 경고는 전체 계산 결과로 판정하고, 상위 5개 제한은 응답 표시 단계에서만 적용한다. 현재 구현의 상위 5개 밖 장비가 경고 판정에서도 누락되는 문제를 함께 방지한다.
- [ ] active=false, 문의 전용 전환, 이름 변경, 메타데이터 누락, 기간 경계, 중복 예약, 취소 제외 테스트를 추가한다. 이름이 바뀌면 표시명만 달라지고 ID별 일수는 같아야 한다.
- [ ] `npm run test:smart-reservation`과 `npm run test:dashboard-integrity` 실행. 기대: 역사 통계 유지, 현재 가용률은 여전히 상태 변경에 반응.
- [ ] 변경 파일만 커밋한다. 메시지 형식: `YYYY-MM-DD 장비 과거 예약 통계와 현재 재고 상태 분리`.

**완료 기준:** 동일 예약 집합은 장비 현재 상태와 무관하게 동일한 ID별 예약일을 산출한다.

### Task 3: 수요조사 마감 스냅샷과 레거시 처리

**Files**
- Create: `core/course-demand-snapshot.mjs`
- Modify: `core.mjs`, `core/course-demand.mjs`
- Modify: `storage-sql.mjs` (기존 singleton JSON 왕복 보존이 안 될 경우에만)
- Modify: `src/react/admin/screens/AdminCourseDemand.tsx`, `src/react/platform/types.ts`
- Modify: `scripts/course-demand-domain-test.mjs`, `scripts/sql-storage-smoke-test.mjs`

**Interfaces**
- `captureSurveySnapshot({ survey, responses, eligibleStudentCount, now, source })` → 아래 스냅샷.
- `readSurveySummary({ survey, responses, eligibleStudentCount })` → 스냅샷 summary 우선, 없으면 기존 집계+`statisticsBasis: "legacy_live" | "live"`.
- `finalizeExpiredSurveys(db, now)` → `{ changed: boolean, finalizedSurveyIds: string[] }`. 저장은 기존 API/Worker 트랜잭션 경계가 담당한다.

```ts
type SurveyStatisticsSnapshot = {
  schemaVersion: 1;
  capturedAt: string;
  effectiveCloseAt: string;
  source: "manual_close" | "deadline_observed";
  summary: {
    surveyId: string;
    eligibleStudentCount: number;
    responseCount: number;
    responseRate: number;
    courses: Array<{
      courseId: string; courseName: string; targetYears: number[];
      demandCategory: string; selections: number; demandScore: number;
      rankCounts: Record<string, number>;
    }>;
    categories: Array<{ category: string; selections: number; demandScore: number }>;
  };
};
```

- [ ] 공개 설문 수동 마감 후 학생 승인/학년·교과명 변경으로 summary가 달라지는 실패 테스트를 작성한다. 스냅샷에는 응답자 ID를 넣지 않는 검사도 포함한다.
- [ ] `npm run test:course-demand` 실행해 새 케이스의 실패를 확인한다.
- [ ] 수동 마감 PUT에서 최신 대상 수와 학생별 최신 응답으로 summary를 한 번 계산하고 `survey.statisticsSnapshot`에 저장한다. status 변경과 snapshot 저장은 한 번의 save로 처리한다. 저장 실패 시 변경 전 survey 상태를 복원하고 성공 응답을 보내지 않는다.
- [ ] 설문 목록, 상세 summary, 기존 추천 계산이 모두 `readSurveySummary`를 사용하게 한다. 마감 뒤 응답 원본이나 대상 학생이 바뀌어도 확정 summary를 재계산하지 않는다.
- [ ] 자동 마감은 종료 시각 이후 최초 요청에서 확정한다. `capturedAt`은 실제 저장 시각, `effectiveCloseAt`은 설문 종료 시각이다. 사용자 정보·설문 응답·계정 삭제 등 대상 수에 영향을 주는 쓰기보다 먼저 만료 설문 확정을 실행한다. 해당 경로와 Worker 정리 작업에서도 동일 순서를 검사한다.
- [ ] `deadline_observed`는 지연 확정임을 메타데이터에 남긴다. 종료 시점의 인원임을 입증할 수 없는 기존 공개 설문에는 `종료 후 확인 시점 기준` 안내를 표시한다. 정확한 마감 시점 통계로 가장하지 않는다.
- [ ] 기존 closed 설문에 snapshot이 없으면 원래 기록을 덮어쓰지 않는다. 화면에 `기존 설문 · 마감 당시 대상 인원 기록 없음`과 현재 기준 참고 집계임을 표시한다. 근거 있는 당시 백업이 확인된 경우에만 별도 복원안을 작성한다.
- [ ] 마감 후 수정/재공개 금지라는 기존 규칙을 유지한다. 종료 전 기간 연장은 허용하되 확정 후 연장·자동 재개는 차단한다. 시각 경계는 기존 응답 허용 규칙(`now <= closesAt`)과 일치시켜 확정은 `now > closesAt`에 한다.
- [ ] 수동 마감 재요청, 만료 후 재조회, 저장 실패 후 재시도, 오래된 closed, 종료 직전/동일시각/직후 응답, 대상 0명, 중복 응답, 개인정보 비노출, 저장 후 재로딩 검사를 수행한다.
- [ ] `npm run test:course-demand`, `npm run test:storage`, `npm run test:security` 실행. 기대: 동일 스냅샷 재사용 및 추가 필드 왕복 보존.
- [ ] 메시지 `YYYY-MM-DD 수요조사 마감 집계 고정 및 기존 설문 기준 안내`로 커밋한다.

**완료 기준:** 새로 확정한 설문 결과가 후속 학생 정보 변경에 영향받지 않고, 복원 불가능한 과거 데이터와 지연 확정의 기준이 드러난다.

### Task 4: 갱신 시각·복귀 갱신·mutation 무효화 통합

**Files**
- Create: `public/js/admin-refresh-lifecycle.js`, `scripts/admin-refresh-lifecycle-test.mjs`
- Modify: `public/js/data.js`, `public/js/state.js`, `public/js/main.js`, `public/js/renderer.js`
- Modify: `public/js/events/admin-refresh.js`, `public/js/native-app-lifecycle.js` (연결 조정)
- Modify: `src/react/admin/screens/AdminDashboard.tsx`, `src/react/platform/types.ts`
- Modify: `scripts/react-admin-data-test.mjs`, `tests/ui/react-admin.spec.mjs`, `package.json`

**Interfaces**
- `createAdminRefreshLifecycle({ canRefresh, refresh, clock })` → `{ request({ force }), dispose() }`.
- `state.adminDataFreshness` → `{ fetchedAt: string | null, refreshing: boolean, error: string | null }`.
- `refresh`는 현재 view와 필터를 유지하는 강제 조회를 호출한다. dashboard를 조회할 때만 dashboard의 `fetchedAt`을 변경한다.

- [ ] 같은 순간의 focus/visibilitychange/native resume 호출이 네트워크 1회만 만드는 실패 테스트를 작성한다. clock은 테스트에서 주입한다.
- [ ] 자동 요청은 마지막 성공 후 15초 이내면 생략한다. 진행 중 요청은 공유한다. 수동 갱신과 변경 저장 직후 갱신은 15초 제한을 우회하되 진행 중 요청 뒤 최신 데이터를 보장하는 1회 재조회로 합친다.
- [ ] 브라우저가 다시 보일 때와 네이티브가 복귀할 때 동일 coordinator를 호출한다. 관리자/로그인 여부를 검사하고 숨긴 화면에서 주기 polling을 하지 않는다. dispose 시 이벤트 해제 및 완료된 요청의 로그아웃 후 state 적용을 막는다.
- [ ] `runAdminMutation`의 invalidateViews를 확인해 기본 관련 화면에 dashboard를 항상 합친다. 특히 가입 승인, 장비 수정/일괄 수정/삭제처럼 명시적 목록이 기본 무효화를 덮어쓰는 경로를 포함한다.
- [ ] 저장 성공 이후 목록 재조회 실패는 `저장은 완료됐지만 최신 목록을 불러오지 못했습니다`로 구분한다. 자동 재시도로 mutation을 다시 전송하지 않는다.
- [ ] 화면에 `마지막 갱신 HH:mm:ss`, 갱신 중 상태, 실패 시 기존 값 유지와 재시도 버튼을 제공한다. 자동 갱신 성공 때마다 토스트를 띄우지 않는다. KST 표기를 사용한다.
- [ ] 브라우저 테스트에서 다른 관리자의 변경을 mock 응답으로 반영한 뒤 복귀하면 값이 바뀌는지, 필터·페이지·스크롤이 유지되는지 확인한다. 입력 중인 폼과 반납 점검 모달을 자동 갱신으로 초기화하지 않는다.
- [ ] `node scripts/admin-refresh-lifecycle-test.mjs`, `npm run test:react-admin`, 관련 Playwright 관리자 케이스 실행. 갱신 lifecycle 검사를 package의 관리자 테스트 흐름에 포함한다.
- [ ] 메시지 `YYYY-MM-DD 관리자 데이터 복귀 갱신 및 갱신 시각 표시`로 커밋한다.

**완료 기준:** 오래 열린 화면의 갱신 시점을 알 수 있고, 복귀·저장 후 관련 숫자가 갱신되며 중복 요청·입력 유실이 없다.

### Task 5: 빌드 식별·실제 배포 파일 비교 정식화

**Files**
- Create: `scripts/build-release-manifest.mjs`, `scripts/release-manifest-test.mjs`
- Modify: `scripts/build-react-admin.mjs`, `scripts/build-static.js`, `scripts/build-native.js`
- Modify: `scripts/check-production-deploy.mjs`, `scripts/check-native-release.mjs`, `package.json`
- Modify: `public/index.html`, `src/react/admin/screens/AdminSettings.tsx`
- Generated/ignored: `public/release.json`, `dist/release.json`, `public/release-meta.mjs`.
- Modify: `.gitignore` (빌드 생성 파일만 명시적으로 제외).
- Modify: `worker.mjs` (`release-meta.mjs`를 번들에 포함해 API 빌드 식별 제공).

**Interfaces**

```ts
type ReleaseManifest = {
  schemaVersion: 1;
  commit: string;
  builtAt: string;
  target: "worker" | "pages" | "native";
  assets: Record<string, { sha256: string; bytes: number }>;
};
```

- [ ] 오래된 HTML, 이전 관리자 번들, 변경된 JS 한 파일, 잘못된 API commit으로 각각 검사가 실패하는 테스트를 추가한다. 성공 여부를 HTTP 200 하나로 판단하지 않는다.
- [ ] build commit은 `git rev-parse HEAD`에서 읽는다. 로컬 개발은 dirty 메타데이터를 허용하되 운영 배포는 관련 추적 파일 수정이 남아 있으면 실패시킨다. 무관한 미추적 자료 때문에 배포를 차단하지 않는다.
- [ ] Worker용 build는 public 번들을 만든 후 manifest를 생성하고 `public/release-meta.mjs`에 commit을 export한다. Worker의 새 읽기 전용 `GET /api/version`은 번들 내부 commit만 반환한다. Pages와 native manifest의 commit도 같은 값이어야 한다.
- [ ] 정적 자산을 모두 생성한 뒤 SHA-256을 만든다. 자기 참조를 피하기 위해 release.json 자체는 assets에서 제외한다. native는 config.js/CSP 수정 후 manifest를 다시 작성한다.
- [ ] 관리자/학생 번들과 data.js, renderer.js, state.js, styles.css, app.js, index.html 등 실제 배포 파일을 목록에 포함한다. 각 대상의 파일 해시를 사용한다. public과 dist는 빌드 경로 때문에 바이트가 다를 수 있으므로 서로의 해시를 비교하지 않는다.
- [ ] 배포 검사는 해당 대상의 로컬 manifest를 인자로 받아 운영 release.json의 commit·asset 목록과 실제 파일을 비교한다. `/api/version`도 같은 commit인지 확인한다. 인증 정보, 저장 파일 경로, 계정 정보는 manifest에 포함하지 않는다.
- [ ] 정상 배포 후 검사는 GET/OPTIONS만 사용한다. 기존 익명 계정 삭제 거부 검사는 보안 테스트로 분리해 일반 배포 확인이 쓰기 메서드를 보내지 않게 한다.
- [ ] 실패 메시지에 해당 대상과 파일명·기대 commit·실제 commit을 남긴다. 네트워크 오류를 데이터 0건 또는 배포 성공으로 처리하지 않는다.
- [ ] 관리자 설정 화면 하단에 앱/웹 빌드 식별을 표시한다. 일반 학생 예약 흐름에는 기술 정보를 추가하지 않는다.
- [ ] `node scripts/release-manifest-test.mjs` 실행 후 빌드된 public/dist/native 각각으로 검사한다. 확인 명령은 `npm run deploy:check -- --manifest public/release.json` 및 `GJU_PRODUCTION_URL=https://gjureserve.co.kr npm run deploy:check -- --manifest dist/release.json`로 정식 지원한다.
- [ ] 메시지 `YYYY-MM-DD 배포 버전 식별과 자산 해시 검증 추가`로 커밋한다.

**완료 기준:** HTML·JS·API가 서로 다른 버전이면 배포 점검이 실패하고, 정확히 같은 대상의 빌드가 반영됐을 때만 성공한다.

### Task 6: 통합 QA·웹 배포·앱 패키징/스토어 반영

**Files**
- Modify: `docs/qa/2026-09-10-service-reliability-signoff.md`, `docs/release-qa-signoff.md`
- Modify: `ios/App/App.xcodeproj/project.pbxproj`, `android/app/build.gradle`
- Generated: `ios/App/App/public/`, `android/app/src/main/assets/public/`
- Use: `scripts/ios-appstore-export.mjs`, `scripts/check-android-release.mjs`

**Interfaces**
- Consumes: Task 1 집계 계약, Task 3 스냅샷, Task 4 freshness, Task 5 release manifests.
- Produces: 커밋·Worker 버전·Pages 배포·네이티브 빌드 번호·검사 결과·스토어 처리 상태가 구분된 QA 기록.

- [ ] 한 번의 통합 검증으로 기존 `npm run release:check`와 신규 테스트가 모두 실행되는지 확인한다. 오류 없는 작업을 반복 검증하지 않고 변경·실패·미확인 위험이 생긴 부분만 다시 검사한다.
- [ ] 웹 주요 화면 390/430/768/1440px에서 통계, 카드 이동, 복귀 갱신, 반납 모달, 설문 마감 안내를 확인한다. 자동 접근성 검사와 수동 화면 확인을 구분해 기록한다.
- [ ] 접근 가능한 운영 관리자 세션이 있으면 데이터 읽기만으로 요약과 전체 목록을 같은 필터로 대조한다. 최초/마지막 수정 시각이 달라진 데이터는 다시 스냅샷을 맞춘다. 인증 정보는 문서에 남기지 않는다. 세션이 없으면 미확인으로 표시한다.
- [ ] 운영 변경 전 기존 백업 경로로 복구 가능한 스냅샷을 확보하고 Worker/Pages 이전 버전을 기록한다. 백업 파일은 공개 폴더 및 Git 밖에 보관한다. 데이터 복구는 별도 의사결정으로 두고 실패했다고 즉시 운영 DB를 덮어쓰지 않는다.
- [ ] 구현 커밋과 로컬 검증이 완료되면 기존 승인된 흐름대로 main 푸시 → Worker 배포 → Pages 배포를 실행한다. 단계가 실패하면 다음 배포 완료로 표시하지 않는다.

```sh
npm run build:react-admin
npm run deploy
npm run pages:deploy
npm run deploy:check -- --manifest public/release.json
GJU_PRODUCTION_URL=https://gjureserve.co.kr npm run deploy:check -- --manifest dist/release.json
```

- [ ] Worker와 Pages는 신규 필드를 읽지 않는 구버전 클라이언트에도 기존 응답 필드를 계속 제공해야 한다. `/api/version` 확인 후 summary/설문 조회의 인증 경계를 다시 확인한다.
- [ ] iOS/Android 현재 로컬 표시는 1.5.2(33)이다. 실행 시 App Store Connect/Play Console의 가장 높은 빌드 번호를 확인하고 그보다 큰 번호를 사용한다. 스토어 버전 확인 없이 34를 무조건 사용하지 않는다.
- [ ] 네이티브 빌드 번호 변경을 커밋한 뒤 동일 commit으로 빌드한다. 웹 release 이후 새 커밋이 생기면 최종 웹도 같은 release commit으로 맞춘다.

```sh
npm run native:sync
npm run native:release:check
npm run native:ios:archive
npm run native:android:bundle
```

- [ ] native:sync 전후 각 내장 release.json과 대상 번들의 해시를 확인한다. 네이티브 빌드가 dist/config.js를 변경하므로 이후 Pages 배포는 반드시 pages:build부터 다시 실행한다.
- [ ] iOS는 서명/프로비저닝이 준비되면 `npm run native:ios:upload`를 사용한다. 업로드 성공, App Store Connect 처리 완료, TestFlight 확인, 심사/출시 상태를 따로 기록한다. 최신 서버를 쓰더라도 내장 프론트가 구버전인 앱의 호환성을 확인한다.
- [ ] Android는 release AAB 서명 확인과 설치 테스트를 수행한다. Play Console 테스터/출시 요건이 막혀 있으면 `서명된 AAB 완료·출시 보류`로 기록하고, 웹/iOS 작업은 계속 마무리한다. 키를 새로 생성하거나 기존 업로드 키를 교체하지 않는다.
- [ ] 실제 기기 또는 시뮬레이터에서 로그인, 예약 확인, 승인/반납, 화면 복귀 갱신, 알림 권한 흐름을 확인한다. 자동 검사만 수행한 플랫폼은 기기 검증 완료로 표시하지 않는다.
- [ ] 최종 QA 기록에 완료/실패/외부 대기 상태와 근거를 남기고 사용자에게 실제 반영 범위를 전달한다.

**완료 기준:** 웹 운영 파일/API 버전 일치, 새 앱 패키지 최신 소스 일치, 스토어 상태별 정확한 인계. 테스트 인원·스토어 심사는 코드 완성과 구분한다.

## 4. 최종 인수 체크리스트

- [ ] 현재 장비 상태를 변경해도 과거 ID별 예약일은 유지된다.
- [ ] 현재 가용 장비 수는 수리/대여/반납 상태 변화에 맞게 달라진다.
- [ ] 새 마감 설문은 대상·응답·과목 통계가 고정된다.
- [ ] 자동 지연 마감과 과거 기준 미보유 설문의 한계를 화면에 표시한다.
- [ ] 다른 관리자 처리 후 복귀 시 새 숫자가 반영된다.
- [ ] 저장 성공/조회 실패를 구분하고 입력·스크롤·필터를 유지한다.
- [ ] 요약/목록 건수 및 페이지 total이 검증 데이터에서 일치한다.
- [ ] 운영 실데이터 대조 여부를 실제 수행 수준대로 기록한다.
- [ ] 오래된 번들/HTML/API 조합을 배포 검사가 탐지한다.
- [ ] 웹/iOS/Android의 commit·빌드 번호와 실제 공개 상태를 기록한다.

## 5. 범위와 실행 방식

이번 문서는 구현 계획까지만 작성한다. 기능 코드를 수정하거나 빌드·배포를 실행하지 않는다.

구현을 시작하면 이미 합의한 메인 순차 구현 방식을 적용한다. 단계별로 관련 테스트를 수행하고 마지막에 통합 QA를 한 번 진행한다. 플랫폼 인증·서명·스토어 상태처럼 실제 외부 준비가 없는 단계만 정확한 사유와 함께 대기로 기록하며, 완료 가능한 단계는 계속 진행한다.
