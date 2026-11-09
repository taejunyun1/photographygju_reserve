# 디지털사진영상실 좌석 예약 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 예약 서비스에 Mac 12석·PC 4석을 1시간 단위로 당일 예약하고 수업 시간에는 예약을 차단하는 디지털사진영상실을 추가한다.

**Architecture:** digital_lab 예약 유형을 기존 예약·권한·관리 화면에 추가한다. 좌석 가용성·시간 겹침 판정은 core/digital-lab.mjs로 모아 조회와 저장이 공유한다. 기존 blockedSchedules와 reservations의 JSON 저장 구조를 확장한다.

**Tech Stack:** React 19, TypeScript, 기존 JavaScript bridge, Node.js 공통 core, Cloudflare Worker + Durable Object SQLite, Cloudflare Pages, Playwright.

**Spec:** [디지털사진영상실 좌석 예약 설계안](../specs/2026-11-09-digital-lab-seat-reservations-design.md)

## Global Constraints

- 시설명은 디지털사진영상실이다.
- Mac 12석, PC 4석을 개별 좌석으로 예약한다.
- 예약은 1시간 단위이며 당일 예약을 허용한다.
- 시간 비교는 Asia/Seoul 기준이며 시작을 포함하고 종료를 제외한다.
- 좌석 ID는 mac-01~mac-12, pc-01~pc-04로 고정한다.
- 승인된 사용자는 예약과 동시에 자동 확정된다.
- 학생 응답에는 타인의 이름·연락처·예약 ID를 싣지 않는다.
- 기존 예약 데이터와 기존 네 시설의 정책을 보존한다.
- 새 의존성 없이 기존 구성 요소와 데이터 저장 방식을 사용한다.
- 운영 시간은 아직 미확정이다. digitalLabEnabled=false로 도입하고 운영 시간을 설정한 뒤 활성화한다.
- 이 문서는 검토용 구현 계획이며 기능 구현 완료를 뜻하지 않는다.

## Review Focus

- 존재하지 않는 좌석·잘못된 날짜·시간 조작 요청을 서버에서 거부한다. Task 1, 2.
- 당일 정각 경계·KST 날짜 변경·과거 구간·24:00을 조회와 저장이 동일하게 판정한다. Task 1, 2.
- 두 사용자의 동시 예약 및 한 사용자의 동시간대 복수 좌석 요청을 최종 저장에서 차단한다. Task 2.
- 반복 수업의 적용 기간·분 단위 겹침·기존 예약 충돌이 정확히 처리된다. Task 1, 4.
- 새 유형이 기존 bridge·집계·권한 응답에 누락되거나 타인 정보를 노출하지 않는다. Task 3, 5, 6.

## 파일 구성과 인터페이스

신규:
- core/digital-lab.mjs: 고정 좌석 목록, 시간 검증, 가용성 및 예약 충돌 판정.
- src/react/student/components/DigitalLabReservationControls.tsx: 시간·좌석 선택 및 확인.
- scripts/digital-lab-domain-test.mjs, scripts/digital-lab-api-test.mjs: 도메인·실제 로컬 API 테스트.
- tests/ui/digital-lab.spec.mjs: 학생/관리자 화면 시나리오.

주요 수정:
- core/settings.mjs, core/reservation-validation.mjs, core/reservation-timing.mjs, core.mjs.
- src/react/student/{types.ts,availability.ts,reservationDraft.ts}, public/js/{state.js,react-student-adapter.js,actions.js,constants.js}.
- 학생 ReservationScreen, ReservationControls, StudentPrimitives, HomeScreen, MineScreen.
- 관리자 AdminSettings, AdminReservations, AdminDashboard 및 platform/types.ts.
- core/facility-timeline.mjs, core/reservation-views.mjs, core/admin-lists.mjs, core/operations-insights.mjs, core/notifications.mjs.
- src/react/shared/facility-board/{types.ts,model.ts,FacilityBoard.tsx,FacilityTimeline.tsx}.
- package.json의 테스트 명령, 필요한 기존 회귀 테스트.

공유 계약:
- ReservationType에 digital_lab 추가.
- DigitalLabFields = { reservedDate: string, seatId: string, startTime: string, endTime: string, purpose: string, phone: string }.
- DigitalLabSeat = { id: string, label: string, computerType: "mac" | "pc" }.
- getDigitalLabWindow(settings, fields, { now }) → { startAt: string, endAt: string } 또는 status=400 오류.
- evaluateDigitalLabSelection(db, fields, { userId, now, editingId? }) → { available: boolean, reasonCode: string | null, reason: string }. 순수 판정이며 외부 요청·쓰기 없음.
- reasonCode는 disabled, invalid_input, past, outside_hours, class_blocked, seat_reserved, user_overlap 중 하나다.
- GET /api/digital-lab/availability?date=YYYY-MM-DD&start=HH:mm&end=HH:mm → 기존 ok/data 응답 형식 안의 { date, startTime, endTime, generatedAt, seats: [{ id, label, computerType, available, reasonCode, reason, isMine }] }.
- 생성·수정은 기존 /api/reservations 경로를 사용하고 유효성 충돌은 409를 반환한다.
- 설정: digitalLabEnabled:boolean, digitalLabOpenTime:string, digitalLabCloseTime:string. 1시간 단위는 고정하며 start/end는 HH:00, end에 한해 24:00 허용.
- blockedSchedules의 type=digital_lab, target=수업명. 첫 버전은 전체 좌석 차단.

## Task 1: 좌석과 시간 도메인

**Files:** core/digital-lab.mjs, core/settings.mjs, core/reservation-timing.mjs, scripts/digital-lab-domain-test.mjs.

**Interfaces:** 위 DigitalLabSeat, DigitalLabFields와 두 도메인 함수를 정의한다. 설정이 없는 기존 DB는 비활성 상태로 읽힌다.

- [ ] 실패 테스트를 작성한다. 좌석 수는 16, Mac은 12, PC는 4이고 ID 중복이 없어야 한다.
- [ ] 예약 가용성 검증 예시를 고정한다. now=2026-11-09T02:30:00Z(한국 11:30)일 때 11:00~12:00은 past, 12:00~13:00은 가용이다. 10:00~11:00 기존 예약은 11:00 시작 예약과 충돌하지 않는다.
- [ ] 예약·수업 겹침 테스트를 작성한다. 다른 좌석은 가용, 같은 사용자 다른 좌석은 user_overlap, 취소 건은 가용, 10:30~12:10 수업은 12:00~13:00을 class_blocked로 만든다.
- [ ] 입력 테스트를 작성한다. pc-05, mac-13, 2026-02-30, 12:30 시작, 동일/역전 시간, 운영시간 밖, 자정 넘김은 거부한다. 23:00~24:00은 운영시간에 포함될 때만 허용한다.
- [ ] Run: node scripts/digital-lab-domain-test.mjs. 구현 전 실패 원인이 미구현 계약임을 확인한다.
- [ ] 고정 좌석 목록과 두 함수를 구현한다. 날짜·시각은 명시적 KST로 처리하고 반개구간 겹침을 사용한다. 예약 기간은 reservationWindowDays를 따른다.
- [ ] digital_lab의 reservationTiming/reservationIntervals를 startTime/endTime에 연결한다. 운영 설정의 빈 값·활성화 조건·시간 순서를 검증한다.
- [ ] 동일 테스트와 npm run test:backend-domains를 실행해 통과를 확인한다.
- [ ] 날짜를 포함한 메시지로 이 작업만 커밋한다.

## Task 2: 조회·생성·수정 API와 동시 예약 방지

**Files:** core.mjs, core/reservation-validation.mjs, core/reservation-views.mjs, scripts/digital-lab-api-test.mjs, scripts/sql-storage-smoke-test.mjs.

**Interfaces:** Task 1의 evaluateDigitalLabSelection을 조회와 저장에 사용한다. 기존 validateReservation 옵션에 userId를 전달하고 생성·수정 호출부 모두 연결한다. 새 가용성 API는 인증된 사용자에게만 제공한다.

- [ ] 로컬 격리 DB로 승인 사용자 2명, 승인 대기 사용자 1명을 준비하는 API 테스트를 작성한다. create 결과는 type=digital_lab, status=auto_confirmed, 정확한 seatId와 timing이어야 한다.
- [ ] 같은 좌석·같은 시간 POST 두 개를 동시에 보내 성공 1건과 409 1건을 확인하는 테스트를 작성한다. 한 사용자가 다른 좌석으로 동시에 요청해도 한 건만 성공해야 한다.
- [ ] 수정 시 자기 예약은 중복으로 세지 않고, 다른 예약·수업 차단과 겹치는 이동은 409여야 한다. 취소 후에는 같은 좌석을 예약할 수 있어야 한다.
- [ ] 직접 API로 승인 우회·타인 예약 수정·잘못된 좌석·과거 시간·비활성 시설 예약을 시도해 거부되는 테스트를 작성한다. 학생 조회 결과에 타인 이름·전화·예약 ID가 없어야 한다.
- [ ] Run: node scripts/digital-lab-api-test.mjs. 미구현으로 실패하는지 확인한다.
- [ ] GET 가용성 라우트와 기존 생성/수정 흐름을 연결한다. 최종 저장 시 새 now로 재검증하고 기존 로컬 mutation queue 및 Worker 직렬화 경로 안에서 판정과 저장을 수행한다.
- [ ] SQL에 신규 예약을 저장하고 재로딩해 fields/timing이 보존되는지, 기존 네 유형 행이 바뀌지 않는지 검증한다. SQL 스키마 변경은 추가하지 않는다.
- [ ] Run: node scripts/digital-lab-api-test.mjs 및 npm run test:storage, npm run test:security. 통과 후 커밋한다.

## Task 3: 학생 시간·좌석 선택과 내 예약

**Files:** 신규 DigitalLabReservationControls.tsx, student/types.ts, availability.ts, reservationDraft.ts, screens/ReservationScreen.tsx, components/ReservationControls.tsx, components/StudentPrimitives.tsx, screens/HomeScreen.tsx, screens/MineScreen.tsx, public/js/state.js, react-student-adapter.js, actions.js, constants.js, tests/ui/digital-lab.spec.mjs.

**Interfaces:** GET 가용성 응답을 소비하고 DigitalLabReservationDraft를 기존 submitReservation에 전달한다. 상태는 날짜·시간·seatId와 그 조회 키를 유지한다.

- [ ] 학생 화면 테스트를 작성한다. 새 예약에 디지털사진영상실이 보이고 Mac 12석·PC 4석이 정확히 표시돼야 한다. pc-04 선택 후 확인·저장·내 예약에 PC 04와 시간이 나타나야 한다.
- [ ] 오늘 미래 구간만 선택할 수 있어야 한다. 선택 시간 변경 시 새 응답을 기다리며 오래된 응답이 최신 화면을 덮어쓰지 않아야 한다. 저장 직전 409가 나면 이유와 새 가용 상태를 보여주고 다른 좌석을 자동 선택하지 않아야 한다.
- [ ] Run: npx playwright test tests/ui/digital-lab.spec.mjs --project=mobile-390 --workers=1. 의도한 실패를 확인한다.
- [ ] 새 시설 카드·전용 선택 컴포넌트·타입·bridge·draft를 연결한다. 날짜 → 시간 → 좌석 → 확인 순서로 기존 wizard 패턴을 따른다.
- [ ] 내 예약·홈 요약·수정/취소 진입에 시설명과 좌석명을 추가한다. 재예약 경로는 과거 시간과 점유 상태를 재검증한다.
- [ ] Run: npm run check:react-admin, npm run test:student-react, npm run test:student-bridge, 위 화면 테스트. 통과 후 커밋한다.

## Task 4: 운영 시간과 수업 차단 관리

**Files:** core/settings.mjs, core.mjs의 PATCH /api/admin/settings, AdminSettings.tsx, src/react/platform/types.ts, scripts/digital-lab-api-test.mjs, tests/ui/digital-lab.spec.mjs.

**Interfaces:** 기존 saveBlockedSchedules·blockedSchedules를 확장한다. 새/변경 digital_lab 차단이 유효 예약과 겹치면 409와 관리자용 conflicts 배열을 반환한다. 각 항목은 reservationId, reservedDate, seatId, startTime, endTime을 포함한다.

- [ ] 학기 시작/끝 날짜 포함, 기간 밖 제외, 일치하는 요일만 차단, 하루 차단, 분 단위 부분 겹침을 API 테스트로 고정한다.
- [ ] 기존 예약이 있는 시간에 새 수업 차단을 저장하면 409이며 설정과 예약 모두 그대로여야 한다. 기존 예약을 명시적으로 취소한 후 같은 차단은 저장돼야 한다. 수업을 제거하면 다시 예약할 수 있어야 한다.
- [ ] Run: node scripts/digital-lab-api-test.mjs. 새 관리자 계약 실패를 확인한다.
- [ ] 시설 선택에 디지털사진영상실, 운영 설정에 활성화·시작/종료 시간 필드를 추가한다. 이 시설의 target 라벨은 수업명으로 표시한다.
- [ ] 시간표 캘린더·차단 목록에 수업명과 16석 전체 차단을 표시한다. 충돌 저장 실패 시 관리자 예약 상세로 이동할 수 있는 목록을 제공한다.
- [ ] 기존 다른 시설의 수업 차단과 설정 저장 동작을 회귀 검증한다. npm run test:admin-ui와 새 API/브라우저 테스트를 통과시킨 뒤 커밋한다.

## Task 5: 현황판·관리자 목록·알림 통합

**Files:** core/facility-timeline.mjs, core/admin-lists.mjs, core/operations-insights.mjs, core/notifications.mjs, AdminReservations.tsx, AdminDashboard.tsx, shared/facility-board/types.ts, model.ts, FacilityBoard.tsx, FacilityTimeline.tsx, scripts/facility-timeline-domain-test.mjs, scripts/facility-board-render-test.mjs.

**Interfaces:** FacilityRoomKey에 digital, 시설 type에 digital_lab을 추가한다. subspaces는 16석이며 interval.subspaceKeys에는 해당 seatId 하나를 넣는다. 선택 구간 전체에서 사용 가능한 좌석 수를 기종별로 계산한다.

- [ ] 한 Mac 점유 시 Mac 11/12, PC 4/4, 전체 수업 차단 시 각각 0/12·0/4가 되는 테스트를 작성한다. 같은 좌석의 여러 구간을 중복으로 세지 않아야 한다.
- [ ] 학생 현황 응답은 타인 정보를 숨기고 관리자만 예약 상세를 열 수 있어야 한다. 새 유형을 포함해도 기존 스튜디오·암실·출력실·기자재 숫자가 변하지 않아야 한다.
- [ ] Run: npm run test:facility-board. 신규 케이스의 실패를 확인한다.
- [ ] 기존 복도 도면의 위치는 유지하며 별도 디지털사진영상실 요약과 좌석 상세를 연결한다. 관리자 검색·필터·상세·집계에 새 유형을 등록한다.
- [ ] 기존 알림에 디지털사진영상실·좌석·시간을 표시한다. 테스트는 메시지 내용만 검사하며 외부 Slack에 전송하지 않는다. 새 유형에 보고서 의무를 생성하지 않는다.
- [ ] Run: npm run test:facility-board, npm run test:dashboard-integrity, npm run test:notifications 및 관련 알림 도메인 검증. 통과 후 커밋한다.

## Task 6: 통합 검증과 배포 준비

**Files:** package.json, tests/ui/digital-lab.spec.mjs, docs/qa/2026-11-09-digital-lab-seat-reservations.md, public/index.html의 배포 버전.

**Interfaces:** Task 1~5를 통합하고 기존 npm 스크립트에 digital-lab 도메인/API 검증을 등록한다.

- [ ] Mac 12석과 PC 4석을 서로 다른 사용자로 채워 총 16석의 개별 예약을 확인한다. 17번째 같은 구간 요청은 실패하고 한 건 취소하면 그 좌석만 풀려야 한다.
- [ ] 학생 예약 → 관리자 수업 충돌 확인 → 기존 예약 취소 → 수업 등록 → 학생 예약 차단 → 수업 삭제 → 재예약을 격리 환경에서 검증한다.
- [ ] 390·430·768·1440px에서 좌석 버튼·텍스트·상태·확인 버튼이 겹치지 않고 키보드로 선택 가능해야 한다. 색만으로 상태를 전달하지 않는다.
- [ ] 기존 클라이언트의 예약 목록에 새 유형 데이터가 들어오는 호환성도 확인한다. 기존 배포 번들이 예외 없이 읽는지 검증하고, 실패하면 신규 유형 노출 전에 응답 호환 처리를 구현해 해당 테스트를 통과시킨다.
- [ ] Run: npm run release:check. 기존 검증 실패는 새 기능과 구분해 이름과 원인을 기록하며 통과로 보고하지 않는다. 실제 기기 검증과 브라우저 에뮬레이션을 구분한다.
- [ ] 운영 시작/종료 시간을 관리자와 확정한다. 기능이 비활성인 상태로 백엔드부터 배포하고 웹을 배포한 뒤, 운영 설정 및 읽기 전용 상태를 확인하고 활성화한다.
- [ ] 실제 운영에 시험 예약을 자동 생성하지 않는다. 공개 자산 버전·API 정상 응답·좌석 목록은 읽기 전용으로 검증한다.
- [ ] 네이티브 앱은 정적 웹 번들을 포함하므로 웹 배포만으로 갱신되지 않는다. 필요 시 동일 소스를 별도 앱 빌드·실기기 검증·스토어 배포 작업으로 이어간다.
- [ ] 배포 버전, 검증 결과, 적용 운영 시간을 QA 문서에 기록하고 날짜를 포함한 메시지로 커밋한다.

## 자체 검토 결과

- 사용자 확정 조건 다섯 가지는 Task 1~5에 대응한다.
- 공유 타입·API·좌석 ID·시간 판정·차단 범위를 위 계약에 통일했다.
- 운영 시간 미확정은 임의 시간 입력 대신 비활성 기본값과 활성화 전 확정 단계로 처리했다.
- 보고서, 좌석 위치 도면, 별도 대여/반납, 그룹별 차단, 장비 고장 관리 등 추가 요구는 첫 구현 범위에 넣지 않았다.
- 구현 시 작업 순서는 1 → 2 → 3 → 4 → 5 → 6이다. 현재 문서 작성만 완료했으며 구현·테스트 실행·기능 배포는 아직 수행하지 않았다.

