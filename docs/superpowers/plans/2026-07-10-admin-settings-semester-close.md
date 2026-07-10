# Admin Settings Semester Close Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin 설정 달력을 클릭해 차단 일정을 즉시 준비하고, 학기 종료 시 전체 예약·연결 보고서·로그인 세션을 안전하게 정리한다.

**Architecture:** 달력 선택은 기존 legacy Admin 이벤트 브리지에서 폼 값을 채우는 UI 동작으로 구현한다. 학기 종료 정리는 기존 보관정책 정리와 별도의 서버 API 및 maintenance helper로 구현하고, 성공 후 현재 클라이언트도 로그아웃한다.

**Tech Stack:** Vanilla JavaScript Admin fallback, React Admin legacy panel bridge, Node.js API core, SQL/JSON storage adapter, Node assert smoke tests, CSS responsive layout

## Global Constraints

- 기존 `보관정책 정리` 동작과 버튼을 유지한다.
- `학기 종료` 확인 문구가 정확할 때만 전체 정리를 실행한다.
- 실행 전에는 기존 예약, 보고서, 세션 데이터를 변경하지 않는다.
- 전체 예약 삭제 시 연결된 보고서만 함께 삭제한다.
- 성공 후 현재 관리자 세션을 포함한 모든 세션이 해제되어 로그인 화면으로 이동한다.
- 기존 미커밋 모바일 Admin UI 변경을 되돌리거나 덮어쓰지 않는다.

---

### Task 1: 설정 달력 상호작용과 화면 순서

**Files:**
- Modify: `scripts/admin-dashboard-ux-test.mjs`
- Modify: `public/js/views-admin.js`
- Modify: `public/js/events/admin-flow.js`
- Modify: `public/styles.css`

**Interfaces:**
- Consumes: `adminSettingsView()`, `adminBlockedCalendar(items)`, `[data-form="blocked-schedule-add"]`
- Produces: `[data-admin-blocked-date="YYYY-MM-DD"]` 날짜 버튼과 작은 `.calendar-month-actions`

- [ ] **Step 1: Write the failing render contract test**

  Add assertions that the calendar appears before the blocked-schedule form, month actions use `calendar-month-actions`, dates expose `data-admin-blocked-date`, and the event source fills `from`, `to`, and `day`.

- [ ] **Step 2: Run test to verify it fails**

  Run: `npm run test:admin-ui`

  Expected: FAIL because the calendar is below the form and dates are not interactive.

- [ ] **Step 3: Implement the minimal UI behavior**

  Reorder the settings sections, render previous/today/next as compact controls, render calendar days as buttons, and add a click handler that fills both dates and weekday before scrolling to the form.

- [ ] **Step 4: Run test to verify it passes**

  Run: `npm run test:admin-ui`

  Expected: PASS.

### Task 2: 학기 종료 정리 API와 클라이언트 동작

**Files:**
- Modify: `scripts/security-smoke-test.mjs`
- Modify: `core/maintenance.mjs`
- Modify: `core.mjs`
- Modify: `public/js/views-admin.js`
- Modify: `public/js/events/admin-flow.js`
- Modify: `src/react/admin/screens/AdminLogs.tsx`

**Interfaces:**
- Consumes: `requireAdmin()`, `parseBody()`, `saveDb()`, `logout()`
- Produces: `closeSemesterData(db, actorId)` and `POST /api/admin/maintenance/semester-close`

- [ ] **Step 1: Write the failing API and UI contract tests**

  Add API assertions that a wrong confirmation phrase returns 400 without mutation and the exact phrase deletes all reservations, linked reports, and sessions while recording `maintenance.semester_close`. Add UI assertions for the explicit warning and new action button.

- [ ] **Step 2: Run tests to verify they fail**

  Run: `npm run test:security && npm run test:admin-ui`

  Expected: FAIL because the endpoint, helper, copy, and button do not exist.

- [ ] **Step 3: Implement the maintenance helper and route**

  Add `closeSemesterData` to the maintenance helper, validate `confirmText === "학기 종료"`, persist the mutation, and return deleted counts.

- [ ] **Step 4: Implement the Admin action**

  Keep the existing retention action, add the new destructive button, request the exact confirmation phrase, call the endpoint, and invoke `logout()` only after success. Add the new audit label to legacy and React logs.

- [ ] **Step 5: Run tests to verify they pass**

  Run: `npm run test:security && npm run test:admin-ui && npm run test:react-admin`

  Expected: PASS.

### Task 3: 통합 검증

**Files:**
- Verify only; do not add generated screenshots or temporary scripts to the repository.

**Interfaces:**
- Consumes: completed Task 1 and Task 2 behavior
- Produces: verified desktop/mobile settings flow

- [ ] **Step 1: Run syntax, type, and release checks**

  Run: `npm run check:js && npm run check:react-admin && npm run release:check`

  Expected: all commands exit 0 with no failures.

- [ ] **Step 2: Verify the rendered flow**

  Start the local app, open Admin settings at desktop and mobile widths, select a date, verify the form values and scroll target, and verify the semester-close confirmation can be cancelled without changing data.

- [ ] **Step 3: Review the final diff**

  Confirm only the approved settings, maintenance, tests, documentation, and previously existing mobile Admin changes remain modified.
