# GJU-reserve Astryx Design System Guide

이 문서는 GJU-reserve의 단일 프론트엔드 디자인 기준이다. 이전 모바일 가이드와 임시 레퍼런스 기준은 폐기하고, 현재 앱에 적용 중인 Astryx/GJU 토큰과 컴포넌트 규칙을 기준으로 Admin과 학생단을 함께 관리한다.

## 1. Product Direction

- GJU-reserve는 예약 업무 앱이다. 마케팅식 장식보다 반복 사용, 상태 확인, 빠른 처리, 안정적인 터치 흐름을 우선한다.
- Admin과 학생단은 같은 토큰을 쓴다. 화면 밀도만 다르게 조절하고, 카드/버튼/탭/입력/상태 배지의 모양은 같은 계열로 유지한다.
- Astryx 원칙은 직접 feature 화면에 흩뿌리지 않는다. React Admin은 `src/react/design-system/*` wrapper를 쓰고, legacy 학생단은 `public/styles.css`와 `public/js/ui.js`의 같은 토큰 이름을 사용한다.
- 신규 화면은 먼저 wrapper 또는 `public/js/ui.js` primitive를 확인한다. 같은 역할의 UI를 새 클래스와 임의 색상으로 만들지 않는다.

## 2. Token Contract

공통 토큰은 [public/styles.css](/Users/taejun-yun/Desktop/WEB_data/school_reservation/public/styles.css)의 `:root`가 기준이다. React Admin 전용 확장은 [src/react/design-system/react-admin.css](/Users/taejun-yun/Desktop/WEB_data/school_reservation/src/react/design-system/react-admin.css)에 둔다.

- Surface: 기본 표면은 흰색 또는 낮은 채도 배경이다. 주요 shell/header/bottom nav는 `rgba(247, 248, 251, 0.96)` 계열을 사용한다.
- Border: 모든 표면 경계는 `--gju-color-border` 또는 `--line-soft`로 통일한다.
- Radius: 카드와 버튼의 기본 radius는 8px이다. bottom sheet, native safe-area container처럼 손가락으로 잡는 큰 표면만 예외적으로 12-16px를 사용할 수 있다.
- Spacing: 4, 8, 12, 16, 20, 24px 단위를 우선한다. 모바일 shell 좌우 여백은 `--gju-student-edge` 또는 `--gju-app-shell-mobile-edge`를 쓴다.
- Touch target: compact는 40px, 기본 터치는 44px 이상이다.
- Motion: transform/opacity 중심으로 80ms, 120ms, 180ms, 240ms만 사용한다. `prefers-reduced-motion`에서는 entry/transition을 제거한다.

## 3. Color Roles

색상은 의미 역할로만 사용한다.

| Role | Token | Use |
| --- | --- | --- |
| Primary | `--primary`, `--primary-container` | 예약 진행, 현재 탭, 주요 CTA |
| Text | `--text`, `--muted`, `--muted-2` | 제목, 본문, 보조 설명 |
| Surface | `--surface-lowest`, `--surface-low`, `--component-card-background` | 앱 쉘, 카드, 입력 영역 |
| Border | `--line`, `--line-soft`, `--gju-color-border` | 카드, 버튼, 탭, 구분선 |
| Success | `--green`, `--green-soft` | 가능, 완료, 승인 |
| Warning | `--yellow`, `--yellow-soft` | 승인 대기, 확인 필요 |
| Danger | `--red`, `--red-soft` | 삭제, 취소, 반려, 제한 |

새 색상이 필요해도 임의 hex를 먼저 추가하지 않는다. 기존 role로 해결할 수 없을 때만 토큰을 추가한다.

## 4. Components

### Buttons

- 기본 버튼은 8px radius, 40/44px 높이, 굵은 13-15px 텍스트를 사용한다.
- destructive action은 danger tone과 확인 절차를 함께 둔다.
- icon-only 버튼은 `aria-label`, `title`, 정사각 hit area를 반드시 가진다.
- 버튼 안 텍스트가 길면 줄바꿈을 허용하되 버튼 밖으로 넘치면 안 된다.

### Cards

- 카드는 개별 반복 항목, 입력 그룹, 예약 요약, 안내 패널에만 쓴다.
- 카드 안에 큰 카드를 중첩하지 않는다. 세부 정보는 구분선, property row, 작은 chip으로 처리한다.
- 카드 radius는 8px이 기본이다. 학생단 facility card와 예약 카드도 같은 radius 토큰을 쓴다.
- 데스크톱에서는 grid/table로 넓게 펼치되 모바일에서 같은 정보 순서를 유지한다.

### Tabs And Segmented Controls

- 필터 탭은 40px 이상 높이를 유지한다.
- 모바일에서는 가로 스크롤을 허용하되, 텍스트가 버튼 밖으로 넘치면 안 된다.
- 현재 탭은 `--primary-container` 배경과 primary text로 표현한다.

### Inputs

- 모든 입력은 label 또는 접근성 이름을 가진다.
- 검색은 `role="searchbox"` 또는 `type="search"` 흐름을 유지한다.
- focus는 border와 focus ring으로 같이 표시한다.

### Status Badges

- 상태는 색상만으로 전달하지 않는다. 텍스트와 tone을 함께 둔다.
- 가능/완료는 success, 승인 대기/확인 필요는 warning, 삭제/취소/반려는 danger를 사용한다.

## 5. Shells

### Admin

- React Admin은 `GjuAppShell`이 화면 소유권을 가진다.
- 데스크톱은 sidebar, 모바일은 sticky header와 light bottom nav를 사용한다.
- 상단 action은 icon-only이다. 새로고침, 내 정보, 나가기는 텍스트를 렌더하지 않고 접근성 라벨만 가진다.

### 학생단

- 학생단은 legacy renderer를 유지하되 Astryx/GJU 토큰을 따른다.
- top appbar는 sticky light surface로 유지한다.
- bottom nav는 Admin React와 같은 light surface를 사용한다. 이전 dark floating nav 스타일은 사용하지 않는다.
- 모바일 bottom nav item은 icon-only 구조를 쓴다. 보이는 label은 렌더하지 않고 `aria-label`과 `title`만 유지하며, icon은 `public/js/ui.js`의 `icon()` primitive로 렌더한다.
- bottom nav 색상은 일반 보조 텍스트보다 진한 `--gju-color-text-muted`와 `--on-primary-container` 계열을 써서 모바일 WebView에서도 선명하게 보이게 한다.
- 예약 플로우는 학생단의 핵심 작업이므로 한 화면에 현재 단계 하나를 강하게 보여주고, 완료된 단계는 summary row로 접는다.

## 6. Student Surface Rules

- Home: 공지, 예약 바로가기, 다음 예약, 모집중 특강 순서로 보여준다. 빈 예약 섹션은 홈 첫 화면에 공간을 차지하지 않는다.
- Reserve: 날짜 -> 시간/기간 -> 선택 -> 확인의 wizard 구조를 유지한다.
- My Reservations: 빈 상태에는 바로 예약 CTA를 둔다.
- Reports: D-day와 제출 상태를 badge로 보여준다.
- Lectures: 검색, 학기/연도 필터, 신청 상태, 접힌 상세를 유지한다.
- Notices: 검색 가능한 리스트와 상세 확인을 유지한다.
- My Page: 프로필/계정 정보와 로그아웃은 명확한 action 영역으로 분리한다.

## 7. Native And WebView Rules

- iOS/Android safe area는 `--safe-area-*` 토큰으로 처리한다.
- shell padding은 `max(edge, safe-area)` 패턴을 사용한다.
- bottom nav 높이는 명시 토큰으로 잡아 하단 CTA와 겹치지 않게 한다.
- fixed 또는 sticky 영역은 `backdrop-filter`를 쓰더라도 스크롤 성능을 해치지 않게 그림자와 blur를 과하게 늘리지 않는다.

## 8. Accessibility

- icon-only action은 `aria-label`과 `title`을 가진다.
- 탭/필터/버튼은 키보드 focus-visible 상태가 있다.
- 삭제/취소/반려는 색상만으로 의미를 전달하지 않는다.
- 모든 주요 터치 타깃은 40px compact, 44px preferred 기준을 지킨다.

## 9. QA Checklist

- 390px, 430px 모바일 폭에서 가로 넘침이 없다.
- top appbar와 bottom nav가 safe area를 침범하지 않는다.
- 학생단과 Admin의 카드/버튼/탭 radius가 같은 Astryx/GJU 토큰을 사용한다.
- bottom nav는 light surface이고 active 상태가 primary token으로 보인다.
- 삭제, 로그아웃, 새로고침 같은 icon-only action은 visible text 없이 접근성 라벨을 가진다.
- hover 없이 tap/selected/pressed/focus 상태가 동작한다.
- `npm run test:equipment-ui`, `npm run test:admin-ui`, `npm run check:js`, `npm run release:check`를 통과한다.

## 10. 공간·장비 현황판

- 관리자 대시보드 첫 주요 카드와 예약자 홈의 간결한 내 예약 요약 다음에서 같은 React 현황판을 사용한다.
- 사용자 제공 스케치의 긴 복도와 다섯 예약 대상의 상대 위치를 보존한다. 다른 공간은 회색 윤곽만 표시한다.
- 외곽은 기존 `GjuCard`, 버튼·탭·상태 배지와 현재 shell의 색상 변수를 상속한다. 픽셀 스타일은 지도·가구·장비 그림에만 적용한다.
- 모바일은 기본 평면도와 읽을 수 있는 공간 요약, 시간표 전환·확대 보기를 제공한다. 축소 도면의 작은 글자는 유일한 정보 전달 경로가 아니며, 조작 대상은 44px 이상을 유지한다.
- 공간은 예약 시간 기준으로 표현하고 실제 점유라고 단정하지 않는다. 장비의 실제 반출, 승인 대기, 예약 예정, 반납 지연을 구분한다.
- 관리자에는 예약자명·개별 코드·관리 이동을 제공한다. 예약자 응답은 본인 예약과 익명 타인 상태로 구분하며 서버 응답에서 타인 개인정보를 제외한다.
- 현황판은 선택 상태를 보존하면서 조용히 갱신한다. 실패 시 마지막 갱신 시각과 실패 문구를 표시하며, 데이터 누락을 0건/예약 없음으로 바꾸지 않는다.
- 집중 검증은 `npm run test:facility-board`, 통합 브라우저 검증은 `npx playwright test tests/ui/facility-board.spec.mjs --config playwright.config.mjs`를 사용한다.
- 모바일 현황판은 공간 요약을 2열과 기자재실 전체 폭 행으로 배치해 다섯 대상이 모두 보이게 한다. 축소 평면도와 요약의 1~5 번호를 일치시키고, 확대 시 전체 명칭을 표시한다. 날짜·시간 입력은 16px, 지금·새로고침은 별도 행의 44px 버튼으로 유지한다.
- 시간표는 기존 모바일 표의 카드 전환 규칙과 분리해 표 구조·고정 공간 열을 보존하며, 열 때 선택 시간대를 노출한다. 좁은 화면에서 공간 요약을 가로 스크롤로 감추지 않는다.
- 예약자 홈에는 다음 학기 희망 과목 조사 카드를 표시하지 않는다.
- 현황판 유틸리티(지금·새로고침·확대·닫기·관리/상세 이동)와 모바일 보기 전환은 제품의 선형 아이콘을 사용한다. 접근성 이름과 버튼 tooltip은 전체 동작명을 유지하며, 조작 영역은 44px이다.
- 기본 화면에는 공간 이름·예약자/내 예약·시간·수량·필수 상태를 남긴다. 반복 안내와 장비 분류·등록 시설·관리처 설명은 정보 아이콘으로 펼쳐 확인한다. 조회 실패·오래된 자료·차단 상태는 접지 않는다.

## 11. 예약자 홈 정보 밀도

- 홈은 내 예약 요약과 공간·장비 현황의 두 영역을 중심으로 구성한다. 중복 인사말·시설 선택 카드·정적인 보고서 카드·특강 목록을 덜어낸다.
- 내 예약은 실제 반출 건을 우선하고 가까운 예약까지 최대 2건을 표시한다. 전체 건수와 전체 예약 이동, 새 예약 버튼을 함께 제공한다.
- 보고서는 실제 작성 가능한 항목이 있을 때만 아이콘과 건수로 표시한다. 공지는 고정 공지 우선으로 한 줄만 남기고 상세 화면으로 연결한다.
- 즐겨찾기와 다시 예약은 새 예약의 종류 선택 화면에서 사용한다. 저장한 재고 ID를 유지하고, 다시 예약할 때 과거 날짜·시간·연락처를 재사용하지 않는다.
- 승인 대기·반려·대여금지 안내와 필수 예약 상태는 유지한다. 설명을 줄이더라도 버튼 접근성 이름과 44px 조작 영역은 보존한다.
