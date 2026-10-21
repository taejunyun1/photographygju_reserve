# 공간·장비 픽셀 현황판 구현 계획

> 계획 작성 후 사용자 구현 지시에 따라 2026-10-19에 구현·통합 검증·Worker/Pages 운영 배포를 진행했다. 검증 증거와 배포 정보는 `outputs/facility-board-implementation/qa-report.md`에 기록했다.

**목표:** 사용자가 승인한 평면 픽셀 목업을 현재 GJU-reserve의 디자인에 맞춰 관리자 대시보드와 예약자 홈 대시보드의 첫 주요 현황 카드로 제공한다. 시간대를 바꾸면 공간 예약과 장비 대여/예약 정보가 함께 갱신되고, 기존 관리·예약 흐름으로 이어진다.

**구조:** 서버의 공통 집계 함수 → 권한별 응답 → 하나의 React 현황판 + 관리자/예약자 연결 컴포넌트. 현재 예약·장비 데이터와 설정을 사용하며 새 DB 테이블, 새로운 승인 상태, 위치 추적 기능은 만들지 않는다.

**기술:** 기존 React/TypeScript, GJU/Astryx wrapper, CSS 변수, 경량 SVG 픽셀 장면, Node ESM 집계, 현재 Worker/Pages 배포 구조.

## 1. 확정 범위와 화면 배치

### 이번 구현 범위

- 관리자: `AdminDashboard.tsx` 루트 section의 첫 카드로 `공간·장비 현황`을 삽입한다. 기존 반납·인계 확인, 경고, 처리 카드, 운영 큐, 압축 인사이트는 기능과 상호 순서를 유지한다.
- 예약자: `HomeScreen.tsx`의 인사/승인 안내 다음, `내 예약` 앞에 같은 현황판을 삽입한다. 예약 화면 각 단계에 큰 지도를 반복하지 않는다.
- 로그인한 관리자는 예약자명·장비명·개별 코드·반납 예정과 기존 관리 화면 연결을 제공한다.
- 승인된 예약자는 `내 예약 / 예약 있음`, 공간·장비 상태, 본인 예약 정보와 `이 조건으로 예약` 동작을 제공한다. 현재 React 예약 화면처럼 타인 이름은 표시하지 않는다.
- 미승인 계정은 기존 승인 안내를 유지한다. 새 현황 API와 예약 진입 모두 기존 승인 조건을 적용한다.
- 당일 전체 시간표와 오늘부터 30일 후까지의 미래 날짜를 조회한다. 이는 새 현황판의 조회 상한이며 기존 예약 가능 여부/기한 정책은 변경하지 않는다. 과거 날짜의 운영 이력 화면은 1차 범위에서 제외한다.

### 확정된 평면도

목업: `outputs/pixel-operations-map-20261019/flat-timeline-mockup.html`.

- 긴 복도 위: 출력실 → 스튜디오 A → 기자재실.
- 복도 아래: 왼쪽 계단 → 스튜디오 B → 암실 → 오른쪽 계단.
- 중간의 다른 공간은 제공된 스케치의 상대 위치와 폭을 유지하는 회색 윤곽만 남긴다. 예약 외 공간에 이름·가구·클릭·상태를 구현하지 않는다.
- 스튜디오 A/B는 지도에서 하나의 방으로 보이지만 데이터는 앞/뒤 구획을 보존한다. 동시 예약을 한 사람으로 합치지 않는다.
- 실제 도면 축척은 아니며, 사용자 스케치를 기준으로 읽기 쉬운 비례를 사용한다. 배치를 다시 추정하거나 새 공간을 만들지 않는다.

### 후속 범위

앞서 요청한 학과 홈페이지 연동은 2차 단계로 유지한다. 1차 내부 현황판의 데이터/장면 계약을 재사용하되, 익명 집계 API와 홈페이지 같은 출처 프록시를 별도로 만든다. 관리자·학생 응답을 그대로 외부에 중계하지 않는다. 홈페이지 저장소의 기존 작업은 이번 단계에서 수정하지 않는다.

## 2. 현재 제품과 맞출 디자인

기준은 현재 소스다. `docs/frontend-design-system.md`의 공통 토큰 원칙을 따르되, 문서의 학생 legacy 설명보다 현재 React 구현을 우선한다.

| 요소 | 적용 방식 | 현재 근거 |
| --- | --- | --- |
| 바탕/카드 | 기존 흰색·옅은 회색 표면을 상속 | `public/styles.css:5`, `src/react/design-system/react-admin.css:23` |
| 주요 선택/행동 | `--gju-color-primary` / `--primary` 사용. 관리자 기본 `#0b4da2`, 학생 shell에서는 `#174f8f`가 적용됨 | `public/styles.css:117`, `src/react/student/student.css:10` |
| 외곽 카드 | `GjuCard`의 기존 8px 반경·경계·그림자 사용 | `src/react/design-system/Card.tsx:14`, `react-admin.css:408` |
| 기존 학생 ‘내 예약’ | 자체 12px 반경을 그대로 유지. 이 기능을 위해 기존 카드 전체를 재정의하지 않음 | `student.css:932` |
| 시간/보기 전환 | 기존 버튼·탭 형태, 선택은 primary container + text | `Button.tsx`, `Tabs.tsx` |
| 예약/대여 상태 | 기존 `GjuStatusBadge`: 파랑=선택/정보, 초록=확정/반출, 호박=승인 대기, 빨강=지연/제한, 회색=정보 없음 | `StatusBadge.tsx`, `student.css:35` |
| 글자/간격 | 기존 폰트, 4/8/12/16/20/24px 간격. 핵심 정보 12px 이상, 보조 텍스트 11px 이상을 목표로 검증 | `public/styles.css:61`, `:220` |
| 픽셀 표현 | 지도 벽·문·가구·장비 아이콘만 각진 픽셀. 외곽 카드/버튼/텍스트는 기존 제품 스타일 | 승인 목업 |

목업의 베이지 바탕·올리브 주색·별도 폰트·고정 예시 날짜를 제품에 복사하지 않는다. 새 hex 색을 기능 컴포넌트에 하드코딩하지 않고 상위 화면의 토큰을 상속한다. 상태는 색상과 문구를 함께 사용한다.

공통 스타일은 현재 두 화면에 로드되는 `src/react/design-system/react-admin.css`에 `.gju-facility-board` 범위로 추가한다. `public/index.html:12-14`의 CSS 순서상 학생 shell override도 적용된다. 생성된 `public/css/*generated.css`를 직접 수정하지 않는다. 새 CSS import를 추가하면 현재 빌드가 admin CSS를 복사하는 구조와 충돌할 수 있으므로 이번 범위에서는 기존 공통 스타일 경로를 사용한다.

## 3. 화면 동작과 밀도

1. 제목 `공간·장비 현황`, 날짜, 최근 갱신 시각을 한 줄에 둔다.
2. `지금` 버튼과 시간대를 선택한다. UI 눈금은 읽기 쉽게 묶되, 실제 10:15/10:30/17:10 같은 시작·종료 시각을 반올림하지 않는다.
3. 선택 구간과 겹치는 예약을 평면도·시간표·장비 목록에 동시에 표시한다. 공간별 여러 예약은 앞/뒤 구획 또는 정확한 시간별로 나누고, 한 줄 요약 + `외 N건` 상세를 제공한다.
4. 데스크톱은 긴 지도 전체와 시간표/장비 목록을 함께 배치한다. 장비 목록은 기본 5행과 전체 보기로 높이를 제한한다.
5. 모바일은 전체 배치 + 44px 이상인 공간 요약 버튼을 기본으로 제공하고, `평면도 / 시간표`를 전환한다. 작은 도면 글씨가 유일한 정보 전달 경로가 되지 않게 한다. 확대 화면에서도 글자·터치 영역을 검증한다.
6. 모바일 기본 현황판 높이는 약 320~380px를 목표로 하되 데이터 상세는 선택했을 때 한 패널에 펼친다. 예약자 홈의 기존 작업을 긴 반복 카드 아래로 밀지 않는다.
7. 지도 안의 방 클릭은 요약을 열며, 관리자 `예약 상세/장비 관리` 또는 예약자 `예약하기`에서 실제 이동한다. 정보 탐색만으로 예약 폼을 초기화하지 않는다.

### 예약자로 이어지는 동작

- `actions.startReservation(type)` → `updateReservationSelection(patch)`라는 기존 홈 즐겨찾기 패턴을 재사용한다.
- `selectedDate`, 명시적으로 고른 실제 슬롯/구획, 장비 항목 등 유효한 값만 전달한다.
- 장비는 DTO의 공개 재고 `equipmentId`를 `equipmentItemIds`로 전달한다. 동명 장비가 있으므로 장비명 검색으로 항목을 추측하지 않는다.
- A/B 건물 전체 선택만으로 Front/Back을 임의 선택하지 않는다. 필요하면 요약 패널에서 앞/뒤 구획을 고르게 한다.
- 시간 눈금이 두 슬롯에 걸치거나 실제 선택 가능한 슬롯과 맞지 않으면 날짜·시설만 전달하고 기존 시간 단계에서 선택하게 한다.
- `예약 없음`은 `즉시 이용 가능`과 다르다. 정원·차단·휴가·신청 기한과 최종 동시 예약 검증은 기존 `availability.ts`/서버 검증이 담당한다.
- 기자재실에서 장비를 눌러도 해당 장비가 실제로 그 방에 있다는 뜻이 되지 않도록 한다. 공간과 장비의 물리적 위치를 연결하지 않는다.

## 4. 데이터 계약과 권한

### 요청 경로

- 관리자 첫 진입은 기존 `/api/admin/summary` 한 번만 호출하는 계약을 유지한다. 응답의 `operationsBoard`에 오늘 DTO를 포함한다.
- 신규 `GET /api/facility-timeline?date=YYYY-MM-DD`는 승인 학생/관리자 전용이다. 서버가 인증 계정의 역할을 결정한다. `viewer=admin` 같은 요청 파라미터로 권한을 선택하지 않는다.
- 학생 홈 진입, 날짜 변경, 조용한 후속 갱신은 이 전용 API를 사용한다. 관리자도 오늘 summary에서 받은 값을 초기값으로 쓰고 다른 날짜/후속 조회에 같은 API를 사용한다.
- 한 요청은 KST 하루만 조회한다. 현황판은 오늘부터 30일 후까지 조회하도록 제한하며 잘못된 날짜는 명확한 오류로 반환한다. 현재 `reservationWindowDays: 30` 선언은 실제 예약 UI/서버에서 사용되지 않으므로 이를 이미 시행 중인 예약 제한으로 간주하지 않는다.
- 계정별 응답은 `private, no-store`로 취급하며, 클라이언트 메모리 캐시는 역할+사용자+날짜로 분리하고 로그아웃/계정 전환 시 지운다.

### 제안 인터페이스

```ts
type FacilityTimeline = {
  schemaVersion: 1;
  layoutVersion: "corridor-v1";
  date: string;
  timeZone: "Asia/Seoul";
  generatedAt: string;
  validUntil: string;
  spaces: SpaceTimeline[];
  equipment: EquipmentTimeline[];
};

// 실제 구현은 viewer 식별자와 선택적 관리 필드를 갖는 공유 DTO 타입을 사용한다.
// 서버가 역할별 허용 목록으로 응답을 만들며 두 연결 컴포넌트가 viewer 불일치 자료를 거부한다.
// 공통 필드: 공간/구획 key, 정확한 startAt/endAt, 상태와 근거,
// 예약 제한 구간, 공개 재고 equipmentId, 장비명/분류,
// 예정 반납, 실제 반출 여부, 종료 미정 여부.
// 관리자만: 예약 ID, 개별 장비 코드, 예약자명, 관리 이동용 ID.
// 학생: isMine와 본인 예약 ID, 다른 예약은 익명 상태·구간만.
// equipmentId는 예약 선택용 재고 식별자이며 타인의 사용자/예약 ID가 아니다.
```

`core/reservation-views.mjs`의 `publicReservationSummary`는 이름과 달리 실명/userId/예약 ID를 포함하므로 새 현황판 응답에 재사용하지 않는다. 새 응답은 명시적인 필드 허용 목록으로 만든다. 기존 bootstrap 개인정보 정책 전체를 변경하는 별도 작업으로 범위를 넓히지 않는다.

### 정확한 집계 원칙

- 현재 날짜만 골라낸 `todaySchedule`을 지도 원본으로 쓰지 않는다. 전날 시작한 야간 예약과 이전 날짜 반출을 포함해 조회 구간과 겹치는 전체 원본을 집계한다.
- 공간은 `auto_confirmed` 등 현행 유효 상태와 개별 시간 구간을 사용한다. 취소·반려·종료 상태를 현재 이용으로 세지 않는다. 현행 상태 정의를 테스트 fixture로 고정한다.
- `reservationTiming`의 첫 시작~마지막 종료 범위는 비연속 암실 슬롯 사이를 채울 수 있다. 설정된 슬롯 순서/자정 전환 규칙을 재사용해 개별 구간을 만든다.
- 서버 계산은 하나의 `requestNow`를 사용한다. 클라이언트 시간대나 각 함수의 서로 다른 `new Date()`에 의존하지 않는다.
- 스튜디오 A/B의 앞·뒤, 암실 인원 정원, 출력실 시간 창별 예약 건수는 단위가 다르다. `3/4 공간`은 물리적 방의 집계로만 쓰고 구획/인원/예약 건수를 합하지 않는다.
- 현재 장비 대여 수는 `checked_out` 예약의 고유 장비 ID 수다. 승인 대기/승인은 실제 반출 수에 넣지 않는다. 수량 미등록 요청 메모도 실재 장비로 집계하지 않는다. 장비의 `facility/source`를 보존해 다른 시설 장비를 학과 기자재실 재고로 임의 귀속하지 않는다.
- 예정 반납 시간이 지났어도 실제 반납 전이면 대여 중이다. `반납 지연 · 종료 미정`으로 표시하며 다음 예약의 실제 인계를 가능하다고 단정하지 않는다. 조기 반납은 `actualReturnedAt`을 사용하고 행정 처리 시각 `returnProcessedAt`과 구분한다.
- 미래는 `예약 예정 / 반납 예정 기준 예상`으로 구분한다. 미반납 장비는 예정 반납 시각으로 현재 반출 상태를 잘라 없애지 않는다. 기존 인계 지연 조건을 함께 반영한다.
- 오늘 지난 시간도 실제 이력이라고 단정하지 않는다. 공간은 예약표로 표시하고, 장비는 실제 반출·반납 timestamp가 있는 경우에만 이력으로 표현한다. 기록이 없으면 `이력 확인 불가`로 두고 승인 상태만으로 과거 대여를 만들어내지 않는다.
- 차단/점검/설정 제한은 예약과 별도의 구간으로 전달한다. 초기 설계안의 ‘제한 집계 제외’ 결정은 예약 진입 기능이 추가된 이번 계획에서 대체한다.

## 5. 갱신과 상태 유지

- 화면 진입, 포커스 복귀/네이티브 앱 복귀, 수동 갱신, 예약/취소/반출/반납 성공 후에 현황 캐시를 무효화하고 최신 데이터를 받는다.
- 현황판이 표시되고 문서가 visible일 때만 60초 간격으로 조용히 갱신한다. 학생 `actions.refresh()`는 토스트·전체 조회를 동반하므로 타이머에서 호출하지 않는다.
- 관리자 기존 focus refresh와 새 요청을 합치거나 중복 제거한다. 초기 summary 뒤 동일 날짜 API를 즉시 중복 호출하지 않는다.
- 날짜·계정이 바뀌었을 때 늦게 도착한 이전 응답이 새 화면을 덮지 않도록 request key/sequence 또는 AbortController를 사용한다.
- 자동 갱신은 사용자가 선택한 날짜·시간·공간·펼침 상태를 바꾸지 않는다. `지금` 모드에서만 현재 시간대를 따라간다.
- 실패/만료는 `갱신 실패`와 마지막 갱신 시각을 표시한다. 오래된 자료를 0건/예약 없음으로 변환하지 않는다. 만료된 정보로 즉시 예약 가능하다고 표시하지 않는다.

## 6. 구현 작업 순서

### 작업 1 — 집계와 권한별 API

**신규:** `core/facility-timeline.mjs`, `scripts/facility-timeline-domain-test.mjs`, `scripts/facility-timeline-api-test.mjs`.

**수정:** `core.mjs`, 필요한 경우 `core/reservation-timing.mjs`의 개별 슬롯 helper export, `package.json`의 집중 검증 명령.

- [x] 순수 집계 함수 `buildFacilityTimeline(db, { date, now, viewer })`와 서버 projection 계약을 먼저 고정한다.
- [x] 비연속/자정/10:30 부분 중첩, 앞·뒤 동시 예약, 미반납/조기 반납, 중복 항목, 승인 대기, 차단 구간 fixture를 작성해 실패를 확인한다.
- [x] 기존 시간 parser/예약 상태/인계 조건을 재사용해 구현한다. 현재 예약 제출 로직은 바꾸지 않는다.
- [x] 관리자 summary 필드와 인증된 전용 GET을 연결한다. 익명/미승인 접근, 학생 응답에 타인 이름·ID·코드가 없는지 검증한다.
- [x] `node scripts/facility-timeline-domain-test.mjs`, `node scripts/facility-timeline-api-test.mjs`, `npm run test:backend-domains`, `npm run test:dashboard-integrity`를 실행한다.

### 작업 2 — 공유 평면도/현황 컴포넌트

**신규:** `src/react/shared/facility-board/types.ts`, `layout.ts`, `FacilityBoard.tsx`, `FacilityFloorPlan.tsx`, `FacilityTimeline.tsx`, `EquipmentTimelineList.tsx`.

**수정:** `src/react/design-system/react-admin.css`의 기능 범위 스타일. 필요한 화면 밀도 override만 `src/react/student/student.css`에 둔다.

- [x] 승인 목업의 방/회색 윤곽/계단 좌표를 `layout.ts`로 옮기고 이벤트와 스타일을 분리한다. HTML 파일 전체를 iframe/innerHTML로 삽입하지 않는다.
- [x] 현재 디자인 wrapper와 토큰으로 지도·시간표·선택 상세를 구성한다. `viewer`, `data`, `selection`, `onSelectionChange`, `onOpenDetails`, `onReserve`를 명시적 props로 받는다.
- [x] 한 장소의 여러 예약과 부분 시간 중첩을 보존하고, 목록은 필요한 행만 보여준다.
- [x] 로딩/정상 빈 상태/갱신 실패/만료/승인 제한을 별도 화면 상태로 구현한다.
- [x] 44px 조작 대상, 키보드 탭/방향키, 화면 읽기용 텍스트 목록, 확대/축소 후 포커스, reduced motion을 검증한다.
- [x] mockup에서 사용한 6px 도면 이름을 실제 UI의 유일한 정보로 사용하지 않는다. 축소 지도는 개요이며 readable 목록/확대 보기가 같은 정보를 제공해야 한다.

### 작업 3 — 공통 조회 상태와 갱신 연결

**수정:** `public/js/state.js`, `public/js/data.js`, `public/js/main.js`, `public/js/actions.js`의 logout/session reset, `public/js/react-student-adapter.js`의 계정 초기화, `src/react/platform/types.ts`, `src/react/student/types.ts`.

**검증:** `scripts/react-admin-data-test.mjs`, `scripts/admin-refresh-lifecycle-test.mjs`, 신규 timeline 조회 fixture.

- [x] `facilityTimeline` 데이터·조회 날짜·loading/error/generatedAt 상태를 역할/계정/날짜 단위로 관리한다.
- [x] 관리자 summary 적용 시 오늘 DTO와 캐시를 함께 초기화한다. 기존 dashboard 단일 summary 요청 테스트는 그대로 통과시킨다.
- [x] 전용 조용한 조회 액션과 요청 중복 제거/늦은 응답 무시/로그아웃 초기화를 구현한다.
- [x] visible/홈 마운트에 묶인 갱신과 기존 앱 복귀 동작을 연결한다. 페이지 이탈 시 타이머를 해제한다.
- [x] `node scripts/react-admin-data-test.mjs`, `node scripts/admin-refresh-lifecycle-test.mjs` 및 새 조회 fixture를 실행한다.

### 작업 4 — 관리자 메인 연결

**신규:** `src/react/admin/components/AdminFacilityBoard.tsx`.

**수정:** `src/react/admin/screens/AdminDashboard.tsx`, `src/react/platform/types.ts`, `public/js/renderer.js`의 `reactAdminActions`와 mutation cache invalidation.

- [x] Dashboard 첫 카드에 연결한다. Dashboard를 직접 호출하는 기존 render fixture를 보존하도록 상태 훅은 연결 컴포넌트에 둔다.
- [x] 기존 `setAdminView("reservations", filters)` / 장비 관리 동작으로 상세 이동한다. 새 대여·반납 처리 버튼을 지도 안에 중복 구현하지 않는다.
- [x] 반납·인계 확인과 압축 인사이트 등 기존 수정 사항이 유지되는지 확인한다.
- [x] `npm run check:react-admin`, `npm run test:react-admin`, `npm run test:admin-ui`, `npm run test:equipment-turnover`와 관리자 UI 집중 검증을 실행한다.

### 작업 5 — 예약자 메인 및 예약 진입 연결

**신규:** `src/react/student/components/StudentFacilityBoard.tsx`.

**수정:** `HomeScreen.tsx`, `student/types.ts`, `public/js/react-student-adapter.js`, 필요한 범위의 `student.css`.

- [x] 승인 안내 다음·내 예약 앞에 삽입한다. 공통 DTO 상태가 snapshot에 명시적으로 복사되도록 한다.
- [x] 홈 진입/갱신과 `내 예약 / 예약 있음` 표시를 연결한다. 승인 전 상세 조회와 예약 CTA는 차단한다.
- [x] 선택한 날짜/시설/유효한 시간·구획으로 기존 예약 wizard를 시작한다. 기존 작성 중인 예약이 있을 때는 현재 제품의 초안 전환 규칙을 확인하고 보존한다.
- [x] `startReservation` 이후 선택값 초기화 순서를 테스트해 날짜/슬롯/장비가 사라지지 않게 한다. A/B 선택만으로 구획을 임의 지정하지 않는다.
- [x] 기존 개인 예약 목록·즐겨찾기·재예약·수요조사 흐름을 유지한다.
- [x] `npm run test:student-react`, `npm run test:student-bridge`, `npm run test:equipment-ui`를 실행한다.

### 작업 6 — 통합 검증과 배포 준비

**수정:** `tests/ui/react-admin.spec.mjs`, `tests/ui/react-student.spec.mjs`, 필요한 공통 fixture, `docs/frontend-design-system.md`의 새 현황판 규칙.

- [x] 같은 fixture의 관리자/학생이 같은 공간·수량·시간을 보되 개인정보 필드는 다르게 받는지 확인한다.
- [x] 390/430/768/1440px에서 두 홈의 첫 카드, 도면 위치, 시간 변경, 상세, 예약 진입, 느린 요청 경쟁, 데이터 만료, 가로 넘침, 키보드/axe를 확인한다.
- [x] 현재 압축 인사이트·새 현황판·기존 예약 폼 회귀를 함께 확인한다.
- [x] `npx playwright test tests/ui/react-admin.spec.mjs tests/ui/react-student.spec.mjs --config playwright.config.mjs`를 실행한다.
- [x] 코드/도메인/UI 집중 검증 이후 실제 출시 시 저장소의 `npm run release:check`를 실행한다. 기존 실패가 있으면 기준선과 새 회귀를 구분해 기록한다.
- [x] `npm run build:worker`, `npm run build`, `npm run pages:check`로 두 배포 대상을 준비한다. 생성 파일을 수동 편집하지 않는다.
- [x] 공통 module `?v=` 식별자는 일관되게 유지하고 새 admin/student 자산 cache identifier와 release manifest를 함께 확인한다.
- [x] 실제 구현/출시 단계에서 Worker는 `--config wrangler.worker.jsonc --keep-vars`로 배포하고 Pages도 함께 반영한다. 이번 계획 작성 단계에서는 실행하지 않는다.
- [ ] 출시 후 Worker 원본과 `https://gjureserve.co.kr` 두 경로의 manifest/API를 확인하고, 별도로 관리자/학생 실사용 경로를 확인한다. 빌드 성공만으로 운영 화면 검증을 대체하지 않는다.

## 7. 완료 기준

- 두 대시보드 메인에서 같은 평면도와 시간대 현황을 볼 수 있다.
- 현재 제품의 색상·카드·타이포그래피·버튼과 일치하고 픽셀 표현은 정보 그림에만 남는다.
- 관리자에게는 담당자 확인과 관리 이동이, 예약자에게는 자기 예약 구분과 실제 예약 진입이 동작한다.
- 비연속/야간/여러 구획/장기 미반납/예정 정보를 잘못 합치거나 현재 사실로 표현하지 않는다.
- 기존 예약/반납/인사이트와 진행 중인 다른 수정 사항을 보존한다.
- 구현과 로컬 관리자/예약자 통합 경로 검증, 전체 출시 검사 및 운영 배포를 완료했다. 운영 자산/API/로그인 화면 확인은 실제 배포 대상으로 실행했으며, 운영 계정으로 예약을 생성하는 검사는 실행하지 않았다.

## 실행 기록 — 2026-10-19

- 관리자/예약자 실제 로컬 API 통합 브라우저 검사: 4개 화면 크기, 집중 128 통과 / 20 조건부 생략. 전체 release:check: UI 171 통과 / 21 조건부 생략, 실패·재시도 없음.
- 최종 검토의 Important 2건과 Minor 2건을 수정하고 독립 재검토를 마쳤다.
- Worker `4c4e04b4-65be-4f87-ae74-860443e77e97` 100% 활성화, Pages `4a820c81-9b27-4513-80ca-67330ae1d9fc` main Production 배포를 확인했다.
- 두 운영 주소의 manifest 자산 해시, API 버전·인증 가드 및 새 현황판 진입 자산 식별자가 일치한다.
- 마지막 출시 후 항목은 운영 계정의 실제 로그인·예약 작성까지 포함하므로 부분 확인으로 남겼다. 관리자/예약자별 예약·관리 진입은 격리된 로컬 실제 API에서 검증했다.
