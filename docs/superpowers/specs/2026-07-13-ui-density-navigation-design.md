# UI Density and Navigation Design

Date: 2026-07-13  
Status: Approved design

## Summary

GJU-reserve의 학생·관리자 React 화면을 같은 디자인 시스템 안에서 다시 정렬한다. 선택된 방향은 **B2 평면형 워크스페이스**다. 관리자 화면은 불필요한 바깥 카드와 내부 카드 중첩을 제거해 실제 콘텐츠 폭을 늘리고, 작은 액션은 아이콘 중심으로 압축한다. 학생 로그인 후 상단바는 제목과 프로필 액션이 한 줄에서 안정적으로 정렬되도록 고친다.

데이터, API, 권한, 예약 규칙은 바꾸지 않는다. 이번 작업은 화면 구조, 공통 컴포넌트, 반응형 스타일, 접근성 이름과 회귀 테스트에 한정한다.

## Evidence From the Current UI

2026-07-13에 390×844 모바일 뷰포트에서 로그인, 관리자 대시보드, 관리자 학생 승인, 학생 홈을 직접 확인했다.

1. 로그인 화면은 전체 구조가 안정적이지만 입력과 버튼 내부의 텍스트·아이콘 기준선이 완전히 같지 않다.
2. 관리자 대시보드는 요약 섹션과 각 지표가 연속된 카드로 표현돼 화면에 보이는 정보량이 적다.
3. 관리자 학생 승인 화면은 shell 좌우 여백 안에 큰 `GjuCard`가 있고, 그 안에 다시 검색 패널·탭·학생 카드가 들어간다. 390px 화면에서 shell 콘텐츠 폭은 약 351px지만 실제 검색 패널과 학생 카드 폭은 약 313px로 줄어든다. 상태 탭은 다섯 항목이 여러 줄로 접혀 약 158px 높이를 사용한다.
4. 학생 홈의 모바일 상단바는 페이지 제목과 프로필 버튼이 서로 다른 줄로 갈라진다. 프로그램 방식으로 제목에 포커스를 줄 때 큰 포커스 외곽선도 노출된다.

스크린샷으로는 키보드 이동, 스크린 리더 이름, 200% 텍스트 확대, 실제 터치 오작동을 확정할 수 없다. 이 항목은 구현 후 자동화와 브라우저 검증으로 확인한다.

## Goals

- 학생 로그인 후 모바일 상단바를 한 줄로 고정하고 제목·액션 정렬을 안정화한다.
- 공통 아이콘을 18–20px로 제한하고 40–44px 터치 영역 안에 정중앙 배치한다.
- 버튼 텍스트 때문에 높이와 정렬이 깨지는 작은 액션 묶음을 아이콘 전용 버튼으로 바꾼다.
- 관리자 목록·대시보드·설정 화면에서 불필요한 카드 중첩을 없애 가용 폭과 첫 화면 정보량을 늘린다.
- 탭과 필터 라벨은 줄바꿈하지 않고 필요할 때 가로 스크롤한다.
- 긴 이름, 이메일, 상태 라벨이 주변 버튼과 레이아웃을 밀어내지 않게 한다.
- 학생단과 관리자단이 같은 radius, 간격, 아이콘, 버튼 상태 규칙을 사용하게 한다.

## Non-goals

- API 요청 형식, 서버 데이터, 권한, 예약 승인 흐름 변경
- 전체 브랜드 색상이나 타이포그래피 교체
- 관리자 정보 구조나 메뉴 항목 재편
- 학생 예약 wizard 단계 변경
- 새로운 페이지나 기능 추가

## Selected Direction: B2 Flat Workspace

### Student shell

- 모바일 상단바는 왼쪽 페이지 제목과 오른쪽 프로필 아이콘 버튼으로 구성한다.
- 제목 영역에 `min-width: 0`을 적용하고 한 줄 말줄임 처리한다.
- 상단바 내부 요소는 같은 중심선에 놓고 safe area를 포함한 최소 높이를 유지한다.
- 프로그램 방식으로 이동된 제목 포커스는 레이아웃 크기의 외곽선을 노출하지 않는다. 키보드로 실제 탐색할 때의 `:focus-visible` 표시는 유지한다.
- 데스크톱 상단바의 사용자 상태 chip과 새로고침·로그아웃 액션도 같은 높이와 중심선 규칙을 사용한다.

### Admin shell and page surfaces

- shell 콘텐츠는 viewport와 sidebar가 허용하는 폭을 최대한 사용한다.
- 목록 페이지의 큰 외곽 `GjuCard`는 평면형 workspace 표면으로 바꾼다. 페이지 제목, 검색, 탭, 결과 요약, 목록이 shell 콘텐츠 가장자리에 맞춰진다.
- 카드는 학생 한 명, 예약 한 건, 지표 한 묶음, 설정 그룹처럼 실제로 구분해야 하는 데이터 단위에만 사용한다.
- 카드 안에 다시 큰 카드나 두꺼운 패널을 만들지 않는다. 세부 정보는 property row, divider, badge로 구분한다.
- 관리자 모바일 목록의 검색·탭·레코드가 동일한 좌우 기준선에 놓이도록 두 번째 내부 inset을 제거한다.
- 데스크톱에서는 표와 grid를 넓게 사용하고, 모바일에서는 같은 정보 순서를 유지한 레코드형 목록으로 전환한다.

### Button and icon system

- 작은 카드 액션과 utility 액션은 B2 방식의 아이콘 전용 버튼을 사용한다. 대상에는 승인, 반려, 초기화, 메모, 수정, 삭제, 새로고침, 로그아웃, 계정, 추가가 포함된다.
- 아이콘은 기존 `GjuIcon`과 디자인 시스템 자산을 우선 재사용한다. 같은 의미의 새로운 임의 SVG나 텍스트 기호를 화면마다 만들지 않는다.
- compact 아이콘은 18px 기본, 20px 상한을 사용한다. 버튼 hit area는 40px compact, 44px preferred다.
- 모든 아이콘 전용 버튼은 `aria-label`과 `title`을 가진다. 아이콘 자체는 접근성 트리에서 숨긴다.
- 승인/완료는 primary 또는 success, 반려/삭제/로그아웃은 danger로 구분한다. 색상만으로 의미를 전달하지 않고 접근성 이름과 확인 문구를 함께 사용한다.
- 위험하거나 되돌리기 어려운 동작은 기존 확인 dialog를 유지한다.
- form 제출, 예약 시작처럼 화면의 핵심 CTA는 짧은 텍스트를 유지할 수 있다. B2 아이콘 전용 규칙은 좁은 행과 카드 안의 반복 액션 묶음에 우선 적용한다.
- 비동기 처리 중에는 버튼 크기를 바꾸지 않고 같은 슬롯에서 18px loading 표시로 교체한다.

### Tabs, filters, and long content

- 탭과 segmented control은 한 줄 `flex` 흐름과 `overflow-x: auto`를 사용한다.
- 탭 항목은 줄바꿈하거나 균등 폭으로 과도하게 축소하지 않는다. 라벨 길이에 맞는 최소 폭을 유지한다.
- 선택된 탭은 primary 배경과 텍스트 대비로 표시하며 키보드 포커스도 보인다.
- 긴 이름과 제목은 한 줄 말줄임, 이메일·식별자는 안전한 break 또는 말줄임을 사용한다.
- body 전체에는 가로 스크롤이 생기지 않는다. 가로 스크롤은 탭·필터 같은 의도된 컨테이너 안에서만 허용한다.

## Component Architecture

### Shared design system

- `src/react/design-system/Button.tsx`
  - `GjuIconButton`이 label을 `aria-label`과 `title`에 일관되게 전달한다.
  - disabled, busy, danger 상태에서도 버튼 크기와 아이콘 정렬을 유지한다.
- `src/react/design-system/icons.tsx`
  - 아이콘 viewBox와 기본 크기 계약을 유지한다.
  - 필요한 의미가 없을 때만 공통 이름을 추가하고, feature 화면에서 별도 아이콘 구현을 금지한다.
- `src/react/design-system/Tabs.tsx`
  - 가로 스크롤 가능한 단일 행 동작을 공통 계약으로 만든다.
- `src/react/design-system/Card.tsx`
  - `surface="card" | "workspace"` prop을 추가한다. 기본값은 `card`다.
  - `workspace`는 header/body 구조는 유지하되 외곽 배경, border, shadow, 큰 내부 padding을 제거한다.
- `src/react/design-system/react-admin.css`
  - shell 폭, workspace 표면, icon button, 탭 스크롤, 모바일 레코드의 공통 스타일을 소유한다.

### Student surface

- `src/react/student/StudentShell.tsx`는 모바일 제목과 프로필 액션을 한 행 컨테이너로 유지한다.
- `src/react/student/student.css`는 학생 shell 전용 정렬, 제목 말줄임, 상단바와 bottom nav 아이콘 크기를 정의한다.
- 학생 feature 화면은 공통 버튼·탭을 사용하고 화면별 임의 크기 덮어쓰기를 최소화한다.

### Admin surfaces

- `src/react/admin/screens/*`의 반복 action row를 공통 아이콘 버튼으로 교체한다.
- 목록 화면의 outer card는 `surface="workspace"`로 명시하고, 검색·탭·결과의 기준선을 통일한다.
- 설정처럼 명확한 그룹 구분이 필요한 화면은 카드를 유지하되 카드 안의 추가 카드 중첩은 제거한다.

## Data Flow and State

기존 action과 API 호출은 그대로 둔다. 텍스트 버튼을 아이콘 버튼으로 교체할 때도 기존 `onClick`, loading, disabled, confirmation, toast 흐름을 유지한다. 탭과 필터의 state key, URL 또는 admin filter state도 바꾸지 않는다. 이번 변경은 DOM 구조와 스타일 계약만 조정하며 사용자 데이터 변환은 없다.

## Error, Loading, and Safety States

- 실패 메시지와 toast는 기존 문구와 위치를 유지한다.
- loading 상태는 아이콘 버튼의 접근성 이름을 유지하고 `aria-busy`를 전달한다.
- disabled 상태는 시각적 대비와 pointer/keyboard 차단을 함께 적용한다.
- 삭제·반려·로그아웃처럼 위험한 아이콘은 danger tone과 확인 절차를 함께 사용한다.
- 아이콘을 불러오지 못해도 버튼의 접근성 이름으로 동작을 식별할 수 있어야 한다.

## Responsive Rules

- 390px과 430px에서 학생 상단바는 한 줄이며 프로필 버튼이 오른쪽에 고정된다.
- 모바일 shell 좌우 edge는 18–24px 범위의 기존 token을 사용한다.
- 관리자 검색, 탭, 결과 목록은 모바일에서 동일한 좌우 기준선에 놓인다.
- compact action row는 아이콘 전용 40px 버튼을 사용하고 필요할 때 줄바꿈하되 버튼 내부는 줄바꿈하지 않는다.
- 900px 초과에서는 desktop sidebar와 표/grid를 사용하고, 900px 이하에서는 sticky header와 bottom nav를 사용한다.
- 200% 텍스트 확대에서도 body 가로 넘침이 없고 핵심 CTA가 가려지지 않는다.

## Accessibility Requirements

- 모든 아이콘 전용 버튼에 고유하고 구체적인 `aria-label`과 `title`이 있다.
- 키보드 `:focus-visible` 표시는 제거하지 않는다.
- 프로그램 방식으로 focus된 제목은 키보드 포커스로 오인되는 큰 외곽선을 만들지 않는다.
- 탭은 기존 tablist/tab/tabpanel 관계와 `aria-selected`를 유지한다.
- status는 텍스트 badge를 유지해 색상만으로 전달하지 않는다.
- 터치 타깃은 최소 40px, 주요 모바일 액션은 44px를 목표로 한다.

## Verification

### Automated

- TypeScript와 React render 계약: `npm run check:react-admin`
- Admin contract: `npm run test:react-admin`
- Student contract and bridge: `npm run test:student-react`, `npm run test:student-bridge`
- Admin UX contracts: `npm run test:admin-ui`
- JavaScript syntax: `npm run check:js`
- Responsive and accessibility browser tests: `npm run test:ui`

필요한 회귀 테스트를 추가한다.

- 390px/430px 학생 상단바 제목과 프로필 버튼이 같은 행에 있는지 검사
- compact 아이콘 버튼의 bounding box와 SVG 크기가 계약 범위인지 검사
- 관리자 탭이 한 줄이고 컨테이너 내부에서만 가로 스크롤되는지 검사
- 관리자 outer workspace 때문에 모바일 목록이 이중 inset을 갖지 않는지 검사
- 긴 이름·이메일·라벨이 action row를 밀거나 body overflow를 만들지 않는지 검사
- icon-only action의 접근성 이름과 focus-visible 상태 검사

### Visual

- 390×844와 430×932에서 학생 홈, 학생 예약, 관리자 대시보드, 학생 승인, 예약 관리, 기자재, 설정을 캡처한다.
- 같은 viewport의 변경 전 캡처와 변경 후 캡처를 나란히 비교한다.
- 데스크톱에서 표와 주요 작업 영역이 불필요한 max-width 또는 중첩 카드로 다시 좁아지지 않았는지 확인한다.

## Acceptance Criteria

1. 학생 모바일 상단바의 제목과 프로필 버튼이 390px과 430px에서 한 줄로 정렬된다.
2. compact 아이콘은 18–20px, hit area는 40–44px이며 수평·수직 중앙에 놓인다.
3. 관리자 모바일 목록의 검색·탭·레코드가 shell edge에 맞고 두 번째 큰 내부 inset이 없다.
4. 관리자·학생 화면의 작은 반복 action은 아이콘 전용 버튼으로 표시되며 텍스트 때문에 버튼 높이가 달라지지 않는다.
5. 탭·필터는 한 줄 가로 스크롤이며 여러 줄로 접히지 않는다.
6. 390px, 430px, 200% 텍스트 확대에서 body 가로 overflow가 없다.
7. 모든 icon-only action은 접근성 이름, title, focus-visible 상태를 가진다.
8. 기존 API 동작, loading, disabled, confirmation, toast 흐름에 회귀가 없다.
9. 지정된 자동화 테스트와 변경 후 브라우저 검증이 통과한다.

## Implementation Boundaries

공통 컴포넌트와 공통 CSS에서 먼저 문제를 해결한다. 화면별 수정은 액션 의미와 workspace 구조를 전달하는 데 필요한 범위로 제한한다. 기존 feature 로직과 unrelated refactor는 포함하지 않는다.
