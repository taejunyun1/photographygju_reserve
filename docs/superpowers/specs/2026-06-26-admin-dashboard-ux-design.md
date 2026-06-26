# 2026-06-26 Admin Dashboard UX Design

## Goal

ADMIN 화면을 혼합형 운영 대시보드로 개편한다. 상단은 오늘 처리할 업무를 빠르게 보여주고, 하단은 주간/월간 운영 지표를 보여준다. 네이티브 알림 관리는 대시보드에서 제거하고 설정 화면으로 이동한다.

## Scope

- ADMIN 대시보드의 정량 지표와 오늘 처리 큐를 강화한다.
- 대시보드에 있던 운영 네이티브 알림 카드를 설정 화면으로 이동한다.
- ADMIN 화면의 UI/UX를 운영툴 기준으로 정리한다.
- 이번 범위는 웹 ADMIN UI와 기존 API 응답을 활용한 프론트 개선이다.
- Figma 산출물은 Desktop ADMIN Dashboard 1개 시안으로 만든다.

## Current State

- `public/js/views-admin.js`의 `adminDashboardView()`는 4개 지표 카드, 운영 네이티브 알림 카드, 운영 순서 카드, 가이드로 구성되어 있다.
- `adminNativeNotificationCard()`는 현재 대시보드 안에서 호출된다.
- 설정 화면 `adminSettingsView()`는 예약 정책과 차단 일정 중심이다.
- `GET /api/admin/summary`는 `pendingUsers`, `pendingEquipment`, `todayReservations`, `missingReports` 등 핵심 운영 수치를 이미 제공한다.
- ADMIN 내 각 관리 화면은 검색, 탭, 카드/테이블 패턴을 사용하지만 대시보드가 처리 우선순위와 누적 지표를 충분히 드러내지 못한다.

## UX Direction

### Dashboard Structure

대시보드는 3단 구조로 구성한다.

1. 오늘 할 일
   - 가입 승인 대기
   - 기자재 승인 대기
   - 오늘 예약
   - 대여/반납 처리 필요
   - 보고서 확인 필요

2. 운영 큐
   - 오늘 예약 타임라인 또는 오늘 처리 목록
   - 기자재 승인/대여/반납 큐
   - 미처리 보고서 큐
   - 최근 공지/특강 상태

3. 정량 지표
   - 이번 주 예약 수
   - 예약 유형별 비중
   - 기자재 사용률
   - 미반납/취소/보고서 미제출 추이
   - 인기 기자재 Top 5

초기 구현은 기존 클라이언트 상태에서 안정적으로 계산 가능한 지표를 먼저 사용한다. 서버 API 변경이 필요한 장기 지표는 별도 후속 작업으로 분리한다.

### Native Notifications

- 대시보드에서 운영 네이티브 알림 카드를 제거한다.
- 설정 화면에 `운영 알림` 섹션을 추가한다.
- 섹션은 권한 상태, 켜짐/꺼짐, 예정 알림 개수, 마지막 동기화 시간을 보여준다.
- 기존 `data-native-notifications` 이벤트와 `plannedAdminNotifications()` 로직은 유지한다.
- 알림 기능은 iOS/Android 네이티브 앱에서만 동작한다는 설명을 설정 화면에 둔다.

### ADMIN UI/UX

- ADMIN은 마케팅성 화면이 아니라 반복 운영을 위한 밀도 높은 도구로 유지한다.
- 주요 액션은 `승인 필요`, `오늘 처리`, `기한 초과`처럼 운영 의미가 명확한 상태로 표현한다.
- 대시보드 카드의 설명 문구는 짧게 줄이고, 클릭 가능한 카드와 큐 항목은 바로 해당 관리 화면으로 이동한다.
- 색상은 기존 상태 톤을 유지하되 위험/지연/대기 상태를 더 명확히 구분한다.
- 모바일 ADMIN은 하단 내비게이션을 유지하고, 대시보드 지표는 세로 스택으로 자연스럽게 떨어진다.

## Component Plan

- `adminDashboardView()`
  - 대시보드 전체 구조를 `today action`, `operations queue`, `metrics` 섹션으로 나눈다.
  - 네이티브 알림 카드를 제거한다.

- `adminDashboardMetrics()`
  - 기존 `state.summary`와 `state.adminReservations`, `state.adminEquipment`, `state.adminReports`, `state.adminLectures`, `state.adminNotices`로 계산 가능한 정량 지표를 반환한다.

- `adminOperationsQueue()`
  - 오늘 예약, 승인 대기 기자재, 보고서 확인 필요 항목을 짧은 큐 형태로 표시한다.
  - 항목 클릭 시 기존 `data-admin-view`와 필터 dataset을 활용한다.

- `adminSettingsView()`
  - 기존 설정 폼 위 또는 아래에 `운영 알림` 섹션을 추가한다.
  - `adminNativeNotificationCard()`를 설정용 카드로 재사용하거나 이름을 `adminNotificationSettingsCard()`로 바꾼다.

- CSS
  - 대시보드 KPI 카드, 큐 목록, 지표 영역에 필요한 클래스만 추가한다.
  - 기존 `card`, `stat-grid`, `native-notification-grid`, `tag`, `button` 패턴을 최대한 재사용한다.

## Data Rules

- 기존 API 응답과 클라이언트 상태에서 계산 가능한 값만 1차 구현에 포함한다.
- 서버가 제공하지 않는 장기 추이 데이터는 더미값으로 만들지 않는다.
- 값이 없으면 `데이터 없음` 또는 `최근 데이터 기준`으로 표시한다.
- 관리자 화면에서 개인정보가 과하게 노출되지 않도록 큐 항목은 이름, 날짜, 예약 유형, 상태 중심으로 표시한다.

## Figma Deliverable

- 파일명: `06.26_학과 예약_ADMIN Dashboard UX`
- 화면: Desktop ADMIN Dashboard
- 포함 섹션:
  - Sidebar + top header
  - 오늘 할 일 KPI row
  - 오늘 처리 큐
  - 운영 정량 지표
  - 설정으로 이동한 운영 알림 카드 예시
- 디자인 톤:
  - 운영툴형, 높은 정보 밀도, 절제된 색상
  - 카드 남용 없이 섹션별 정보 흐름을 분리
  - 모바일이 아닌 데스크톱 관리자 기준으로 우선 설계

## Testing Strategy

- TDD로 먼저 ADMIN UX 체크 스크립트를 추가한다.
- 실패 조건:
  - 대시보드 HTML에 `운영 네이티브 알림`이 남아 있음
  - 설정 화면에 운영 알림 섹션이 없음
  - 대시보드에 운영 큐와 정량 지표 섹션이 없음
  - 대시보드 지표가 기존 summary/state 기반으로 계산되지 않음
- 통과 후 `npm run release:check`, `git diff --check`를 실행한다.

## Out of Scope

- 서버 DB 스키마 변경
- 새로운 통계 API 추가
- 관리자 권한 체계 변경
- Watch 앱 타깃 추가
- Google Analytics 또는 외부 분석 대시보드 연동
