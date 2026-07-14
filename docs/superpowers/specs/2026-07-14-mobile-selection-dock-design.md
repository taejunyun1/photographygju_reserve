# Mobile Selection Dock and Glass Navigation Design

Date: 2026-07-14  
Status: Approved design

## Summary

GJU-reserve 학생 기자재 예약의 선택 단계를 모바일에서 다시 정리한다. 검색 위에 길게 쌓이던 선택 목록은 하단 내비게이션 위의 한 줄 플로팅 요약으로 접고, 사용자가 누르면 선택한 장비를 관리하는 시트가 위로 펼쳐진다. 하단 내비게이션은 화면 가장자리에서 떨어진 큰 radius의 글라스 도크로 바꾸고 아이콘을 작게 정렬한다. 예약 단계 숫자는 완전한 원으로 고정하고, 보이지 않던 비교과 특강 아이콘은 다른 메뉴와 같은 자체 SVG 렌더링 경로로 통일한다.

예약 데이터, API, 단계 순서와 제출 규칙은 바꾸지 않는다. 변경 범위는 학생 React 화면의 DOM, 로컬 표시 상태, 공통 아이콘과 반응형 CSS, 회귀 테스트다.

## Evidence and Root Causes

390×844 브라우저에서 현재 화면을 재현하고 실제 계산값을 확인했다.

1. 장비 4개 선택 시 `.student-react-equipment-manifest` 높이는 약 325px다. 검색보다 먼저 표시되어 선택 수가 늘수록 실제 탐색 영역을 아래로 밀어낸다.
2. 단계 숫자 요소는 `width: 22px; height: 22px`를 선언하지만 레거시 `.booking-progress span`의 `min-height: 38px`가 함께 적용된다. 계산 결과가 22×38px가 되어 원이 세로 타원으로 보인다.
3. 홈, 내 예약, 보고서, 공지 아이콘은 로컬 SVG로 20×20px가 계산된다. 특강만 Astryx 문자열 아이콘 래퍼를 사용하고 전달한 `student-react-nav__icon` 클래스가 최종 DOM에서 사라져 래퍼와 내부 SVG가 0×0px로 계산된다.
4. 현재 학생 내비게이션은 화면 전체 폭의 흰색 막대다. 앱 콘텐츠와 분리가 약하고 아이콘 크기와 여백이 요청한 플로팅 도크 인상보다 크다.

## Goals

- 선택 목록이 검색과 결과를 밀어내지 않게 한다.
- 선택 수는 항상 확인할 수 있고, 선택한 장비의 이름·코드·삭제 동작은 한 번의 탭으로 접근하게 한다.
- 하단 내비게이션을 safe area를 존중하는 둥근 글라스 플로팅 도크로 만든다.
- 내비게이션 아이콘을 18px로 통일하고 시각 중심을 맞춘다.
- 예약 단계 숫자를 모든 모바일 폭에서 24×24px 원으로 표시한다.
- 비교과 특강 아이콘이 다른 메뉴와 같은 크기로 항상 표시되게 한다.
- 390px과 430px에서 body 가로 넘침이나 콘텐츠 가림이 생기지 않게 한다.

## Non-goals

- 예약 단계 순서, 장비 검색·필터·페이지네이션 변경
- 선택한 장비 데이터의 저장 방식 변경
- 학생 메뉴 항목이나 순서 변경
- 데스크톱 내비게이션 구조 변경
- 전체 색상·서체·브랜드 재설계
- Admin 화면 변경

## Alternatives Considered

### A. Separate selection dock and navigation dock — selected

선택 요약을 내비게이션 위에 별도 한 줄로 두고, 탭하면 위로 시트를 연다. 선택 상태와 전역 이동을 시각적으로 구분하면서도 두 컨트롤을 엄지손가락 영역에 모을 수 있다. 선택 목록이 길어져도 시트 내부만 스크롤한다.

### B. Selection count inside the navigation dock

예약 메뉴에 선택 수 badge를 붙이고 메뉴를 다시 누르면 목록을 여는 방식이다. 화면은 가장 작게 쓰지만, 선택 목록이라는 기능을 발견하기 어렵고 현재 단계에서 전역 메뉴와 임시 예약 상태가 섞인다.

### C. Permanently expanded floating mini-list

선택 목록을 항상 내비게이션 위에 표시하고 내부 스크롤한다. 관리 동작은 즉시 보이지만 선택이 많을 때 결과를 가리는 문제가 반복된다.

선택한 A안은 화면 효율, 발견 가능성, 전역 내비게이션과 임시 선택 상태의 분리 면에서 가장 안정적이다.

## Visual Direction

사진 장비 가방의 얇은 인덱스 스트립과 카메라 컨트롤 도크를 모티프로 삼는다. 반투명 효과는 장식이 아니라 콘텐츠 위에 떠 있는 두 조작 층의 깊이를 설명한다.

### Color tokens

- `Dock glass`: `rgba(255, 255, 255, 0.82)`
- `Dock edge`: `rgba(255, 255, 255, 0.72)`
- `Dock ink`: `#2F343B`
- `Active ink`: `#121416`
- `Selection jade`: `#0B6B57`
- `Soft mist`: `#F4F6F8`

### Type

- 제목과 장비명은 현재 학생 화면의 Korean UI sans를 유지한다.
- 선택 요약과 수량은 13px, 장비명은 14px/700, 코드는 12px로 낮춰 검색 결과보다 시각적 우선순위를 한 단계 내린다.
- 내비게이션은 아이콘 전용을 유지하고 접근성 이름과 title로 의미를 제공한다.

### Layout

```text
┌ 선택 장비 4개                    목록 보기⌃ ┐
└────────────────────────────────────┘
   ╭  홈   내 예약   보고서   특강   공지  ╮
   ╰────────────────────────────────────╯
```

기억에 남는 요소는 서로 붙지 않고 8px 간격으로 떠 있는 두 개의 얇은 글라스 레이어다. 나머지 예약 화면의 카드와 입력에는 새로운 장식을 추가하지 않는다.

## Selected Interaction Design

### Collapsed selection dock

- 모바일 선택 단계에서 내비게이션 바로 위에 고정한다.
- 왼쪽에는 `선택 장비 N개`, 오른쪽에는 `목록 보기`와 방향 표시를 둔다.
- 선택이 0개여도 요약은 유지해 현재 선택 상태와 목록 여는 방법을 알려준다.
- 전체 줄이 버튼이며 `aria-expanded`와 `aria-controls`를 제공한다.
- 선택 수 변경은 기존 `aria-live="polite"` 영역에서 알린다.

### Expanded selection sheet

- 요약을 누르면 같은 위치에서 위로 최대 `45dvh`까지 펼쳐진다.
- header에는 선택 수와 `목록 닫기` 버튼을 둔다.
- 장비 행은 이름, 코드, 선택 해제 버튼으로 구성한다.
- 장비 행 목록만 세로 스크롤하고 header와 요약 컨트롤은 고정한다.
- `Escape`와 닫기 버튼으로 닫을 수 있다. 시트는 modal이 아니므로 페이지의 나머지 요소를 inert 처리하거나 focus trap을 만들지 않는다.
- 선택 해제 후 마지막 항목이 사라져도 시트는 열린 상태를 유지하고 빈 안내를 표시한다.

### Glass navigation dock

- 모바일에서 화면 좌우 12px, 하단 safe area 위에 배치한다.
- 외곽은 24–28px radius, 반투명 흰색, 1px 밝은 테두리, 약한 blur와 shadow를 사용한다.
- 다섯 메뉴는 같은 폭을 가지며 아이콘은 18×18px다.
- 터치 영역은 최소 48×48px를 유지한다.
- 활성 메뉴는 40×40px의 짙은 둥근 사각 배경과 흰 아이콘으로 표시한다.
- 아이콘 전용 표현을 유지하며 각 버튼의 `aria-label`, `title`, `aria-current`를 보존한다.

### Reservation progress

- 숫자 표시는 `inline-grid`, `24×24px`, `min/max-size: 24px`, `aspect-ratio: 1`, `flex: none`으로 고정한다.
- 레거시 `min-height`가 들어오지 않도록 더 구체적인 학생 selector에서 명시적으로 초기화한다.
- 완료, 현재, 다음 단계의 기존 색상 의미와 단계 버튼의 접근성 상태는 유지한다.

### Lecture icon

- `calendar`를 `GjuIcon`의 로컬 24×24 SVG path로 렌더링한다.
- 문자열 기반 Astryx 아이콘 분기를 사용하지 않아 다른 학생 메뉴와 동일한 class, width, height 계약을 적용한다.
- 다른 Astryx 전용 아이콘은 이번 범위에서 변경하지 않는다.

## Component Architecture

- `src/react/student/components/ReservationControls.tsx`
  - `EquipmentStep`가 선택 목록의 열림 상태를 로컬 UI state로 관리한다.
  - 현재 선택 목록 markup을 요약 버튼과 확장 panel로 분리한다.
  - 선택 해제는 기존 `updateReservationSelection` 흐름을 그대로 사용한다.
- `src/react/student/StudentShell.tsx`
  - 메뉴 배열과 접근성 속성은 유지한다.
  - 특강 메뉴는 수정된 공통 `calendar` SVG를 자동으로 사용한다.
- `src/react/design-system/icons.tsx`
  - `calendar`에 로컬 SVG path를 제공하고 해당 이름을 Astryx 문자열 렌더링 분기에서 제외한다.
- `src/react/student/student.css`
  - 선택 dock/sheet, 콘텐츠 하단 여유, 단계 원, 학생 bottom nav의 크기와 glass 표현을 소유한다.
- `src/react/design-system/react-admin.css`
  - 공통 mobile bottom-nav wrapper는 학생 도크가 자체 표면을 가질 수 있도록 기존 safe-area/sticky 계약을 유지한다. 학생 전용 시각 변경은 가능한 한 `student.css`에 한정한다.

## Data and State

새 서버 상태나 영속 데이터를 추가하지 않는다. 시트의 열림 여부만 `EquipmentStep`의 로컬 boolean state다. 장비 선택·해제, 예약 단계 이동, 제출 데이터는 기존 action과 state를 그대로 사용한다. 화면 전환이나 예약 단계 변경으로 component가 unmount되면 시트는 기본 접힘 상태로 돌아간다.

## Responsive Behavior

- 700px 이하에서 선택 dock/sheet를 사용한다.
- glass navigation은 기존 AppShell이 mobile bottom navigation을 표시하는 breakpoint 전체에서 사용한다.
- 701px 이상에서는 선택 목록을 현재처럼 예약 카드 안에 표시하고, navigation 전환 시점은 기존 AppShell breakpoint를 유지한다.
- 모바일 예약 카드에는 selection dock과 navigation이 검색 결과 마지막 행을 가리지 않도록 합산 높이만큼 하단 여유를 둔다.
- 390×844와 430×932에서 선택 시트가 viewport와 safe area 안에 들어온다.
- 의도된 sheet 내부 세로 스크롤 외에 body 가로 스크롤을 만들지 않는다.

## Accessibility and Motion

- 선택 요약 버튼은 구체적인 접근성 이름, `aria-expanded`, `aria-controls`를 가진다.
- 확장 panel은 식별 가능한 제목을 가진 region으로 노출한다.
- 삭제 아이콘 버튼은 각 장비 이름을 포함한 `aria-label`과 최소 44px 터치 영역을 유지한다.
- 내비게이션은 기존 `nav` landmark와 `aria-current="page"`를 유지한다.
- 아이콘은 장식 요소로 접근성 트리에서 숨긴다.
- focus-visible 외곽선은 glass 배경 위에서도 충분한 대비를 가진다.
- sheet open/close에는 180ms 이하의 단일 translate/fade를 사용할 수 있다. `prefers-reduced-motion`에서는 즉시 전환한다.

## Error and Edge Cases

- 선택 장비가 0개면 `선택 장비 0개`와 `선택한 장비가 없습니다.` 안내를 표시한다.
- 긴 장비명과 코드는 말줄임 처리하고 접근성 이름에는 전체 장비명을 유지한다.
- 선택 해제 요청이 동기적으로 state에 반영되지 않아도 기존 render 흐름을 따른다.
- 작은 화면에서 sheet 항목 수가 많으면 목록만 스크롤한다.
- 아이콘 렌더링 실패를 감지하는 회귀 테스트에서 모든 다섯 메뉴의 SVG가 0보다 큰 bounding box를 가져야 한다.

## Verification

테스트를 먼저 추가하고 실패 이유를 확인한 뒤 구현한다.

- 390px과 430px에서 단계 숫자가 24×24px인지 검사한다.
- 다섯 모바일 메뉴 아이콘이 18×18px이고 실제 SVG bounding box가 0보다 큰지 검사한다.
- glass navigation이 viewport 좌우에서 떨어져 있고 radius와 투명 표면을 갖는지 검사한다.
- 선택 요약이 내비게이션 위에 있으며 검색 결과를 가리지 않는지 검사한다.
- 요약을 누르면 `aria-expanded`가 바뀌고 선택 장비 목록이 표시되는지 검사한다.
- 긴 선택 목록이 최대 45dvh를 넘지 않고 panel 내부에서만 스크롤되는지 검사한다.
- 선택 해제와 Escape 닫기가 동작하는지 검사한다.
- body 가로 overflow와 serious/critical axe 위반이 없는지 검사한다.
- 기존 학생 계약, bridge, UI 전체 테스트와 build를 실행한다.

## Acceptance Criteria

1. 모바일 선택 단계에서 선택 목록이 검색 위에 긴 inline 카드로 공간을 차지하지 않는다.
2. 선택 dock은 하단 내비게이션 위에서 현재 선택 수를 보여주며 한 번의 탭으로 열고 닫을 수 있다.
3. 확장 sheet는 최대 45dvh이고 장비 목록만 스크롤한다.
4. 선택 장비명은 14px, 코드는 12px, 요약 텍스트는 13px다.
5. 모바일 내비게이션은 화면 좌우 12px에서 떨어진 둥근 glass dock이며 아이콘은 18px다.
6. 모든 다섯 메뉴 아이콘의 실제 크기가 0보다 크고 특강 calendar가 표시된다.
7. 단계 숫자는 24×24px 원이며 390px과 430px에서 타원이 되지 않는다.
8. 선택 dock, sheet, navigation이 검색 결과와 주요 CTA를 가리지 않는다.
9. keyboard, screen reader 이름, reduced motion, safe area 계약을 유지한다.
10. 지정된 자동화와 브라우저 검증이 통과하고 body 가로 overflow가 없다.

## Implementation Boundaries

모바일 학생 예약과 학생 bottom navigation에 필요한 최소 변경만 한다. 선택·예약 business logic과 Admin 화면을 건드리지 않는다. 새로운 라이브러리나 전역 상태를 추가하지 않고 기존 React, 디자인 시스템, CSS token을 사용한다.
