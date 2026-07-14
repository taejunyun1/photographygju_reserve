# Full-Flow UX Fixes Design

Date: 2026-07-14
Status: Approved through the 2026-07-14 full-flow audit and the user's instruction to apply the current findings

## Summary

GJU-reserve의 학생 예약 전 과정과 관리자 후속 처리 화면을 하나의 상태·레이아웃 계약으로 맞춘다. 2026-07-13에 승인된 B2 평면형 워크스페이스와 현재 Astryx/GJU 디자인 시스템을 유지하며, 기자재 예약의 상태 모순, 출력·보고서 드라이브 링크 누락, 긴 기자재 목록, 모바일 관리자 중복 콘텐츠와 작은 터치 영역을 우선 수정한다.

새 페이지, 새 색상 체계, 새 아이콘 세트는 만들지 않는다. 학생 예약의 대표 개선점은 선택한 장비를 즉시 확인하고 제거할 수 있는 `선택 목록(manifest)`이며, 관리자 화면은 카드 안의 카드 대신 목록·표·상태 작업이 한 기준선에 놓이는 B2 구조를 유지한다.

## Evidence And Constraints

- 기준 보고서: `.codex-audit/2026-07-14-full-flow/audit.md`
- 기준 디자인: `docs/frontend-design-system.md`, `docs/superpowers/specs/2026-07-13-ui-density-navigation-design.md`
- 기준 화면: `.codex-audit/2026-07-14-full-flow/01-*.png`부터 `30-*.png`
- 학생·관리자는 같은 surface, border, radius, button, badge 토큰을 사용한다.
- API와 화면 모두 기자재 예약 상태를 동일하게 해석해야 한다.
- 390px, 430px, 900px 경계에서 body 가로 스크롤과 중복 접근성 콘텐츠가 없어야 한다.
- 기존 사용자 변경과 `.codex-audit/` 원본은 수정하거나 커밋하지 않는다.

## Visual Direction

### Existing tokens

- Primary `#2457ff`: 현재 단계, 주요 CTA, 활성 탭
- Surface `#ffffff`: 카드, 입력, 선택 항목
- Shell `#f7f8fb`: 앱 배경과 모바일 헤더
- Text `#111827`: 제목과 핵심 값
- Border `#d8dde8`: 표면과 입력 경계
- Warning `#9a5f00`: 승인 대기와 설정 누락

기존 한국어 산세리프 스택과 현재 제목/본문 크기 체계를 유지한다. 상태·숫자·코드에는 기존 utility 스타일과 tabular numeral 동작을 재사용하고 새 웹폰트를 추가하지 않는다.

### Signature: equipment manifest

기자재 선택 단계 상단에 현재 선택 수와 선택 장비 chip을 보여주는 얇은 manifest를 둔다. 각 항목은 공통 `x` 아이콘으로 즉시 제거할 수 있다. 모바일에서는 화면 하단 작업 버튼과 함께 선택 상태가 사라지지 않으며, 데스크톱에서는 목록 상단의 작업 요약으로 동작한다.

## Reservation State Model

기자재 예약은 다음 상태를 보존한다.

1. `pending_approval`: 학생이 승인 요청을 제출함
2. `approved`: 관리자가 대여를 승인함
3. `checked_out`: 학생에게 장비를 인계함
4. `returned`: 장비를 반납받음

종료 상태는 `rejected`와 `cancelled`다. 기존 `admin_cancelled`는 기자재에서 `cancelled`, 기존 `completed`는 `returned`, `auto_confirmed`는 데이터 이관 시 `approved`로 정규화한다. 신규 기자재 예약은 `pending_approval`로 생성한다.

관리자 상태 작업은 현재 상태와 관계없는 모든 버튼을 한꺼번에 노출하지 않는다.

- 승인 대기: 승인, 반려
- 승인 완료: 대여 처리, 취소
- 대여 중: 반납 처리, 취소
- 반납/반려/취소: 되돌리는 상태 작업 없음

학생 카드와 toast는 같은 상태 이름을 쓴다. `checked_out`은 `대여 중`, `returned`는 `반납 완료`로 표시한다.

## Student Flow

### Equipment selection

- 검색과 카테고리 탭은 그대로 유지하고 탭은 한 줄 가로 스크롤로 제한한다.
- 검색 결과 수와 현재 렌더링 수를 함께 표시한다.
- 처음 20개만 렌더링하고 `더 보기`로 20개씩 확장한다. 검색어나 카테고리가 바뀌면 첫 묶음으로 돌아간다.
- 선택 manifest는 선택 수, 장비명/코드, 개별 제거 작업을 제공한다.
- `이전/다음` 작업은 모바일 bottom nav 위에 sticky로 유지하되 safe area와 겹치지 않는다.

### Review and submission

- 검토 property row는 label과 value를 명시적인 grid로 분리해 `사용일2026-...`처럼 붙지 않는다.
- 기자재 제출 CTA는 `승인 요청`이고, 제출 후 상태도 `승인 대기`다.
- 중복된 기자재 정책 동의 항목은 하나로 정리한다.

### Print and reports

- `googleDriveUrl`이 없으면 출력 예약 flow 진입 전에 설정 누락 안내를 보여주고 다음 단계와 제출을 막는다.
- API 검증에서도 Drive 링크가 없는 출력 예약을 거절해 레거시 또는 직접 요청으로 게이트를 우회할 수 없게 한다.
- 보고서 화면도 링크가 없으면 작성 버튼을 비활성화하고 관리자에게 링크 등록을 요청하는 복구 문구를 보여준다.
- 링크가 있으면 기존 새 창 열기 동작을 유지한다.

### Navigation, headings, dialogs, empty states

- 상단 앱바가 문서의 유일한 `h1`이 되고 화면 내부 제목은 `h2`다.
- 학생 특강 메뉴는 `plus`가 아닌 기존의 내용형 아이콘을 사용한다.
- 정보성 dialog는 헤더 닫기 한 개만 노출한다.
- 공지 데이터 자체가 없을 때와 검색 결과가 없을 때 문구를 구분한다.
- 암실 선택은 `약품`과 `확대기 렌즈`를 process 기준 그룹으로 나눠 렌즈가 약품처럼 보이지 않게 한다.

## Admin Flow

### Reservation operations

- 기자재 필터와 대시보드에 `승인 대기`, `승인 완료`, `대여 중`, `반납 완료`, `취소/반려`를 제공한다.
- 승인 대기 수는 대여 중 수와 별도 집계한다.
- 상태 아이콘 버튼은 44px touch target, 18px 아이콘, 구체적인 접근성 이름을 가진다.

### Density and responsive ownership

- 페이지 제목의 `React Admin` eyebrow를 제거한다.
- 학생/기자재/세션·로그의 데스크톱 표에는 공통 `admin-react-desktop-table` 계약을 적용한다.
- 모바일에서는 데스크톱 표를 `display:none`으로 접근성 트리에서 제거하고 모바일 카드만 표시한다.
- 대시보드 처리 카드는 모바일 2열 compact grid로 배치하고 0건 항목의 강조를 낮춘다.
- 공지 등록과 특강 등록 폼은 기본적으로 접고, `등록 열기` 작업으로 펼친다.
- 모바일 공지 checkbox label은 checkbox와 텍스트가 같은 행의 가운데에 놓인다.
- 세션 목록은 전체 User-Agent 대신 이미 계산된 기기 이름을 우선 표시하고 원문은 `title`로만 제공한다.

## Error And Recovery

- Drive 링크 누락은 amber 상태 badge와 `관리자 설정에서 링크를 등록해 주세요.` 문구로 원인과 복구 방법을 함께 제공한다.
- 상태 변경 API는 기자재 유형에서 정의되지 않은 상태를 계속 400으로 거절한다.
- 승인 흐름의 종료 상태에서는 잘못된 후속 작업 버튼을 렌더링하지 않는다.
- 검색 빈 상태는 검색어가 있을 때만 필터 조정 안내를 표시한다.
- 마이 화면의 계정 메타데이터도 검토 화면과 같은 label/value grid를 사용한다.

## Accessibility And Responsive Contract

- 모든 icon-only action은 `aria-label`, `title`, 44px hit area를 갖는다.
- 정보성 dialog의 `닫기` 접근성 이름은 하나만 존재한다.
- 900px 이하에서 desktop table과 mobile list가 동시에 접근성 트리에 존재하지 않는다.
- 200% 텍스트 확대에서도 탭은 내부에서만 가로 스크롤하며 button label은 넘치지 않는다.
- sticky 작업 영역은 `prefers-reduced-motion`, safe area, bottom nav 높이를 존중한다.

## Verification

- Domain/API: `npm run test:security`, `npm run test:storage`
- React contracts: `npm run check:react-admin`, `npm run test:react-admin`, `npm run test:student-react`
- UX contracts: `npm run test:equipment-ui`, `npm run test:admin-ui`
- Syntax/build: `npm run check`, `npm run check:js`, `npm run build`
- Browser: 기존 Playwright 구성으로 390×844, 430×932, desktop 주요 flow와 axe 검증

## Non-goals

- 브랜드 팔레트나 타이포그래피 교체
- 관리자 메뉴 정보 구조 재편
- 출력 파일 자체 업로드 기능 추가
- 신규 예약 유형 또는 신규 관리자 권한 추가
- App Store Connect 제출, 배포, main 병합 또는 원격 push
