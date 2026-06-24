# GJU-reserve Mobile Design System Guide

이 문서는 GJU-reserve를 모바일 네이티브 앱으로 옮기기 쉬운 제품 UI로 관리하기 위한 단일 디자인 시스템 가이드다. 웹 화면을 작은 기기에 그대로 축소하지 않고, iOS/Android 앱에서 자연스러운 터치 흐름, safe area, 하단 내비게이션, 단계형 예약 경험을 기준으로 정리한다.

Figma MCP는 Starter 플랜 호출 제한으로 직접 노드 컨텍스트를 더 가져오지 못했다. 따라서 적용 기준은 사용자가 전달한 iOS/iPadOS 26 레퍼런스, Simple Design System 레퍼런스의 의도, 첨부 캘린더 이미지, 그리고 현재 프로젝트 UI 구조를 통합해 정의한다.

## 1. Core Principles

- 학생 화면은 모바일 앱을 1순위로 설계한다. 첫 화면은 예약 진입, 다음 예약, 공지, 특강처럼 자주 쓰는 작업을 빠르게 수행하게 한다.
- 관리자 화면은 반복 업무 도구다. 검색, 필터, 정렬, 상태 변경, 기록 확인 속도를 장식보다 우선한다.
- 한 화면의 주 행동은 하나만 강하게 둔다. 보조 행동은 작은 버튼, 메뉴, 접기, 상세 화면으로 낮춘다.
- 긴 설명문은 상단에서 공간을 차지하지 않는다. 필요 시 카드 하단, `details`, 도움말, 시트로 보낸다.
- 카드 안에 또 다른 큰 카드를 넣지 않는다. 섹션, 카드, 리스트, 액션 영역의 경계를 명확히 둔다.
- 모든 반복 UI는 먼저 [public/js/ui.js](/Users/taejun-yun/Desktop/WEB_data/school_reservation/public/js/ui.js)를 확인한다.

## 2. Five Core Colors

핵심 컬러는 5가지만 사용한다. 화면별 임의 색상 추가는 금지하고, 새 의미가 필요하면 아래 색상 중 하나의 tint/surface 토큰으로 해결한다.

| Core | Token | Purpose | Use |
| --- | --- | --- | --- |
| Action Blue | `--color-action` | 주요 CTA, 선택, 내 예약, 링크 | 예약 확정, 승인, 저장, 현재 탭 |
| Neutral Slate | `--color-neutral` | 본문, 보조 텍스트, 일반 상태 | 기본 카드, 회색 배지, 비활성 정보 |
| Success Green | `--color-success` | 정상, 완료, 사용 가능 | 승인 완료, 반납 완료, 모집중 |
| Warning Amber | `--color-warning` | 주의, 승인 대기, 확인 필요 | 조교 승인, 카메라 가방 확인, 제한 예정 |
| Danger Red | `--color-danger` | 취소, 삭제, 반려, 차단 | 신청 취소, 삭제, 대여금지, 차단일 |

기존 별도 주황/보라 계열은 새 핵심색으로 보지 않는다. `orange`는 Warning Amber의 강한 상태, `purple`은 Neutral Slate의 보조 tint로 매핑한다.

## 3. Token Rules

- 토큰은 [public/styles.css](/Users/taejun-yun/Desktop/WEB_data/school_reservation/public/styles.css)의 `:root`에서 관리한다.
- 배경은 낮은 채도, 표면은 유리 느낌의 `--glass-*`, CTA는 진한 `--primary` 계열로 구분한다.
- spacing은 4, 8, 12, 16, 20, 24px 단위를 우선한다.
- 기본 radius는 `12px`; 모바일 카드/시트/하단 탭은 18-28px를 사용할 수 있다.
- 터치 컨트롤은 최소 44px, 모바일 목표는 iOS 44pt와 Android 48dp 기준을 만족해야 한다.
- focus/selected/disabled 상태는 색상만이 아니라 border, 배경, 텍스트 라벨로 함께 표현한다.

## 4. Icon Set

아이콘은 [public/js/ui.js](/Users/taejun-yun/Desktop/WEB_data/school_reservation/public/js/ui.js)의 `icon()` 프리미티브만 사용한다.

| Icon | Meaning | Primary Use |
| --- | --- | --- |
| `home` | 홈 | 하단 탭 |
| `calendar` | 예약/날짜 | 내 예약, 날짜 선택 |
| `camera` | 기자재 | 시설 카드 |
| `spark` | 특강/스튜디오 강조 | 특강, 스튜디오 |
| `printer` | 출력실 | 시설 카드 |
| `moon` | 암실 | 시설 카드 |
| `fileText` | 보고서/문서 | 보고서 작성 |
| `megaphone` | 공지 | 공지 탭 |
| `user`, `userPlus` | 계정/가입 | 프로필, 가입 |
| `check` | 확정/완료 | 승인, 저장, 신청 |
| `x` | 취소/반려 | 신청 취소, 반려 |
| `trash` | 삭제 | 삭제 전용 |
| `download` | 내려받기 | CSV, 백업 |
| `external`, `arrowUpRight` | 외부 이동 | 구글 드라이브, 링크 |
| `arrowRight`, `chevronLeft` | 진행/뒤로 | 단계 이동 |
| `edit` | 수정 | 요약 row 수정 |
| `plus` | 추가/담기 | 기자재 담기, 메모 추가 |
| `send` | 제출 | 보고서 제출, 승인 요청 |
| `logIn`, `logOut` | 접속/나가기 | 인증 |

아이콘 사용 규칙:

- 모든 버튼에 아이콘을 붙이지 않는다. 핵심 CTA, 위험 CTA, 외부 이동, 다운로드, 탭에 우선 사용한다.
- 아이콘 단독 버튼은 접근성 라벨이 필요하다.
- 아이콘은 `currentColor`를 사용해 버튼 상태색을 그대로 따른다.
- 버튼 안 아이콘은 텍스트보다 크지 않게 1.1em을 기본으로 한다.

## 5. Buttons

버튼은 행동의 중요도와 위험도를 명확히 나눈다.

- Primary: 서버 상태를 바꾸는 핵심 행동. 예약 확정, 승인 요청, 저장, 신청, 승인.
- Default: 중간 강도의 일반 행동. 보고서 작성, 상태 저장, 수정.
- Ghost: 뒤로가기, 전체 보기, 닫기처럼 화면 이동 또는 낮은 위험의 보조 행동.
- Warning: 확인 필요, 메모 추가, 제한 설정처럼 주의가 필요한 행동.
- Danger: 취소, 반려, 삭제, 로그아웃, 차단 해제 전 위험 안내.
- Compact: 카드 안 보조 버튼, 관리자 부가 작업, 메모 초기화.
- Full: 모바일 하단 CTA, 폼 제출, 예약 확정.

모바일에서는 카드 우측에 긴 CTA를 몰아넣지 않는다. 주요 CTA는 카드 하단 또는 sticky bottom CTA로 둔다.

## 6. Accordion

Accordion은 긴 설명, 상세 일정, 도움말, 판타지랩 안내처럼 처음부터 모두 보일 필요가 없는 정보에 사용한다.

- summary는 44px 이상 터치 가능해야 한다.
- 우측에는 `+`/`-` 또는 chevron 계열 표시를 둔다.
- 본문은 summary 아래 한 단계 낮은 표면색으로 표시한다.
- 예약 플로우의 필수 단계는 accordion으로 숨기지 않는다. 선택 후 다음 단계로 이동하는 wizard 구조를 우선한다.

사용 대상:

- 특강 상세 일정
- 온라인 예약불가 기자재 안내
- 지난 예약 목록
- 관리자 가이드/주의 문구

## 7. Calendar

캘린더는 첨부 레퍼런스처럼 큰 카드 안에 날짜 선택을 집중시키되, 월 변경 버튼은 작고 명확하게 유지한다.

- 월 제목은 크게, `이전/오늘/다음` 버튼은 compact action으로 둔다.
- 모바일에서 월 이동 버튼은 30-34px 높이의 작은 버튼으로 유지한다.
- 날짜 셀은 터치하기 쉬운 크기를 유지하되 화면 하단 탭에 가려지지 않도록 scroll padding을 둔다.
- 내 예약, 타인 예약, 차단 상태는 색상 dot과 텍스트 배지로 함께 표시한다.
- 설명/범례는 상단을 차지하지 않게 캘린더 하단 또는 접힌 안내로 둔다.
- 당일 예약 차단, 차단 일정, 예약 마감은 선택 불가 상태로 즉시 보여준다.

## 8. Cards

카드는 정보 묶음의 최소 단위다. 반복 아이템, 예약 카드, 특강 카드, 보고서 카드, 관리자 행 카드에 사용한다.

- 카드 내부 제목은 화면 제목보다 작게 유지한다.
- 상태 배지는 상단, 핵심 내용은 중앙, CTA는 하단으로 정리한다.
- 긴 텍스트는 2-3줄 미리보기 후 더보기로 보낸다.
- 모바일 카드 안의 정적 정보는 작은 key-value row 또는 chip으로 축소한다.
- 카드 안에 또 다른 큰 카드를 중첩하지 않는다. 필요한 경우 구분선이나 작은 property row를 쓴다.
- 데스크톱에서는 표/그리드로 확장해도 모바일 구조와 정보 순서를 유지한다.

## 9. Inputs

입력 필드는 모바일 키보드와 목적에 맞게 설계한다.

- 검색은 `type="search"`, 연락처는 `inputmode="tel"`, 이메일은 `type="email"`, URL은 `type="url"`을 사용한다.
- placeholder는 예시가 아니라 검색 범위를 짧게 설명한다.
- label은 항상 제공한다. 시각적으로 숨겨도 접근성 이름은 유지한다.
- focus 상태는 border와 focus ring으로 확실히 표시한다.
- 오류 메시지는 필드 바로 아래에 둔다.
- 신청 인원처럼 사용자가 입력하지 않아야 하는 값은 필드로 노출하지 않는다.

## 10. Menu

메뉴는 상태 변경이나 보조 작업을 압축할 때 사용한다.

- 모바일에서는 긴 드롭다운보다 action sheet 또는 짧은 select를 우선한다.
- 대여금지 설정처럼 상태 변경이 포함된 메뉴에는 `대여금지 해제` 옵션도 같은 메뉴 안에 둔다.
- 위험 행동은 메뉴 안에 넣더라도 Danger 색상과 확인 절차를 유지한다.
- 메뉴 항목은 동사형으로 쓴다: 저장, 수정, 삭제, 해제, 내보내기.

## 11. Navigation

학생 하단 탭은 5개 이하로 유지한다.

- 홈
- 내 예약
- 보고서
- 특강
- 공지

예약 탭은 홈의 예약 바로가기로 대체한다. 마이 화면은 별도 탭이 아니라 상단 프로필/상태 칩에서 진입한다.

상단 앱바:

- safe area를 침범하지 않는다.
- 스크롤 시 backdrop blur가 적용된 sticky header로 유지한다.
- 프로필 칩은 클릭 가능한 메뉴 진입점으로 사용한다.

관리자:

- 데스크톱은 사이드 nav, 모바일은 하단 nav 또는 compact nav로 전환한다.
- 관리자 목록은 항상 검색 필드와 필요한 상태 필터를 제공한다.

## 12. Pagination

현재 목록은 대부분 클라이언트 필터/검색 중심이지만, 데이터가 늘어날 수 있으므로 pagination 스타일을 준비한다.

- 데스크톱: `이전`, 페이지 번호, `다음`, 총 건수.
- 모바일: `이전`, `n / total`, `다음` 3요소로 축소한다.
- 무한 스크롤은 관리자 업무 화면에서는 피한다. 선택한 행과 정렬 상태가 사라지기 쉽다.
- 검색 또는 필터가 바뀌면 첫 페이지로 돌아간다.
- 페이지 버튼은 `button.compact`보다 작게 만들지 않는다.

## 13. Tabs

Tabs는 결과를 크게 줄이는 필터에 사용한다.

- 예약 유형: 기자재, 스튜디오, 출력실, 암실, 비교과.
- 특강 연도: 전체, 2026년 등.
- 상태: 승인완료, 반려, 제한, 대여완료, 반납완료.
- 카테고리: Body, Lens, Lighting, Audio 등.

모바일에서는 가로 스크롤 또는 wrap을 허용하되, 탭 텍스트가 버튼 밖으로 넘치지 않아야 한다.

## 14. Text

타이포그래피는 앱 내 업무 UI 기준으로 제한한다.

- 화면 제목: 28-32px, 굵게.
- 카드 제목: 18-22px.
- 본문: 14-16px.
- 보조 설명: 12-14px.
- 버튼: 13-15px, 굵게.
- viewport width에 따라 font-size를 스케일하지 않는다.
- letter spacing은 0을 기본으로 한다.
- 한글 긴 단어는 `overflow-wrap: anywhere` 또는 2줄 허용으로 처리한다.

## 15. Forms

폼은 한 화면에 길게 쌓지 않고 단계형으로 나눈다.

- 기자재 예약: 날짜 -> 기간/시간 -> 장비 -> 확인.
- 스튜디오 예약: 날짜 -> 공간 -> 시간 -> 확인.
- 출력실/암실 예약: 날짜 -> 시간/버킷 -> 확인.
- 필수 확인은 CTA 직전에 둔다.
- 키보드가 올라와도 현재 필드와 제출 버튼이 가려지지 않아야 한다.
- 제출 중에는 버튼을 비활성화하거나 처리 중 상태를 표시한다.
- 서버 검증이 있는 예약/신청/취소는 중복 tap을 방지한다.

## 16. Product Patterns

학생 화면:

- Home: 예약 바로가기, 다음 예약, 공지, 모집중 특강.
- Reservation: 선택한 현재 단계 1개, 완료된 단계 요약 row, 하단 CTA.
- My Reservations: 기자재, 스튜디오, 출력실, 암실, 비교과 카테고리 탭.
- Reports: 예약 정보 자동 연동, 사진 업로드 중심.
- Lectures: 검색, 연도 필터, 신청 상태, 접힌 상세 일정, 신청/취소 CTA.
- Notices: 검색 가능한 공지 리스트와 상세 확인.
- My Page: 상단 프로필 칩에서 진입.

관리자 화면:

- Users: 승인 상태별 필터, 승인/반려 단일 CTA, 대여금지 메뉴, 경고 메모 기록.
- Reservations: 유형/상태 필터, 검색, 카드/표 전환.
- Equipment: 검색, 카테고리, 상태 변경.
- Reports: 검색, 정렬, 제출 상태.
- Lectures: 등록 폼, 검색, 연도/상태 필터, 접힌 상세.
- Logs/Sessions: 최신순 기본, 작업/사용자/IP 검색.

## 17. Native Mapping

| Web Pattern | iOS/Android Pattern |
| --- | --- |
| Top GNB | Bottom tab + stack navigation |
| Profile chip | Settings/account entry |
| Sidebar | Drawer or tablet split pane |
| Dense table | Card list or expandable row |
| Dropdown | Native picker/action sheet |
| Tooltip | Inline help/bottom sheet |
| Web modal | Native modal or bottom sheet |
| Sticky CTA | Safe-area aware bottom action |
| details | Accordion/disclosure cell |
| Calendar grid | Native calendar component or custom grid |

## 18. QA Checklist

- 390px 폭에서 가로 넘침이 없다.
- iOS Dynamic Island/status bar와 Android status bar를 침범하지 않는다.
- 하단 탭과 홈 인디케이터에 CTA가 가려지지 않는다.
- 모든 주요 터치 타깃이 44pt/48dp 기준을 만족한다.
- 리스트 화면에는 검색과 필요한 필터가 있다.
- 긴 텍스트는 카드/버튼 밖으로 넘치지 않는다.
- 색상만으로 상태를 전달하지 않는다.
- 로딩, 빈 상태, 검색 결과 없음, 오류, disabled, 처리 중 상태가 있다.
- hover 없이 tap/selected/pressed/focus 상태가 동작한다.
- `npm run check`, `node --check public/js/*.js`, `git diff --check`, `npm run native:sync`를 통과한다.

## 19. Implementation Rule

디자인 변경은 다음 순서로 진행한다.

1. 화면 목적과 주요 CTA를 먼저 정한다.
2. `ui.js` 프리미티브로 해결 가능한지 확인한다.
3. 색상은 5개 core token 중 하나로 매핑한다.
4. 모바일 390px 전후 폭에서 먼저 검증한다.
5. 데스크톱은 같은 정보 순서를 유지한 채 확장한다.
6. 문법 검사, 빌드, 네이티브 동기화, 필요 시 FTP 배포를 수행한다.
