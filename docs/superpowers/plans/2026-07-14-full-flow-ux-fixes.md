# Full-Flow UX Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 학생 예약의 실제 상태와 화면 문구를 일치시키고, 학생·관리자 모바일 화면의 밀도·선택·접근성 문제를 기존 B2 디자인 시스템 안에서 해결한다.

**Architecture:** `core.mjs`가 기자재 상태 lifecycle과 집계를 소유하고 React 학생/관리자 화면은 그 상태를 그대로 표시한다. 시각 변경은 기존 `student.css`, `react-admin.css`, 공통 GJU primitive에 한정하며 새 디자인 계층을 만들지 않는다.

**Tech Stack:** Node.js 18+, React 19, TypeScript, Astryx/GJU wrappers, CSS, Node assertion contract tests, Playwright

## Global Constraints

- 기존 Astryx/GJU token, 8px radius, 44px preferred touch target을 유지한다.
- `.codex-audit/` 원본과 사용자 변경은 수정하거나 커밋하지 않는다.
- 신규 기자재 예약은 `pending_approval`로 시작한다.
- Drive 링크가 없으면 출력 예약 제출과 스튜디오 보고서 작성을 시작할 수 없다.
- main 병합, 원격 push, 배포, App Store Connect 작업은 하지 않는다.

---

### Task 1: Equipment reservation lifecycle

**Files:**
- Modify: `scripts/security-smoke-test.mjs`
- Modify: `scripts/react-admin-render-test.mjs`
- Modify: `scripts/student-react-contract-test.mjs`
- Modify: `core.mjs`
- Modify: `core/reservation-validation.mjs`
- Modify: `src/react/platform/types.ts`
- Modify: `src/react/admin/screens/AdminReservations.tsx`
- Modify: `src/react/admin/screens/AdminDashboard.tsx`
- Modify: `src/react/student/components/StudentPrimitives.tsx`
- Modify: `public/js/views-admin.js`
- Modify: `public/js/notification-planner.js`

**Interfaces:**
- Produces: equipment status sequence `pending_approval | approved | checked_out | returned | rejected | cancelled`
- Consumes: existing `PATCH /api/admin/reservations/:id/status` action

- [x] **Step 1: Write failing domain and render assertions**

Assert that a new equipment reservation is `pending_approval`, normalization preserves `pending_approval`, `approved`, and `checked_out`, the summary exposes `equipmentPendingApproval`, and React renders approval/checkout transitions.

- [x] **Step 2: Run tests and verify the expected legacy-status failures**

Run: `npm run test:security && npm run check:react-admin`

Expected: FAIL because legacy normalization changes pending/approved to checked-out and Admin actions omit approval.

- [x] **Step 3: Implement the minimal lifecycle and status transitions**

Change the core status sets, creation status, migration mapping, summary counts, Admin action visibility, dashboard cards, student labels, legacy fallback labels, and notification digest to use the six-state contract.

- [x] **Step 4: Run domain and render tests**

Run: `npm run test:security && npm run check:react-admin && npm run test:react-admin && npm run test:student-react`

Expected: PASS.

### Task 2: Student reservation safety and equipment manifest

**Files:**
- Modify: `scripts/student-react-contract-test.mjs`
- Modify: `scripts/equipment-reservation-ui-test.mjs`
- Modify: `src/react/student/components/ReservationControls.tsx`
- Modify: `src/react/student/reservationDraft.ts`
- Modify: `src/react/student/screens/ReportsScreen.tsx`
- Modify: `src/react/student/screens/NoticesScreen.tsx`
- Modify: `src/react/student/components/StudentPrimitives.tsx`
- Modify: `src/react/student/StudentShell.tsx`
- Modify: `src/react/student/screens/MySettingsScreen.tsx`
- Modify: `src/react/student/student.css`

**Interfaces:**
- Produces: `hasGoogleDriveUrl(settings): boolean`-equivalent validation at flow and draft boundaries
- Produces: 20-item paged equipment result rendering and selected manifest actions
- Consumes: existing `updateReservationSelection` and `setReservationStep` actions

- [x] **Step 1: Add failing student contract and CSS assertions**

Assert that print draft rejects missing Drive configuration, print/report screens expose recovery copy, equipment picker exposes result count/load-more/selected manifest, one policy consent remains, review rows have explicit label/value classes, and the internal screen title is `h2`.

- [x] **Step 2: Run the student tests and verify failures**

Run: `npm run test:student-react && npm run test:equipment-ui`

Expected: FAIL on the new Drive, manifest, heading, and sticky action contracts.

- [x] **Step 3: Implement student flow changes**

Add the manifest and 20-item expansion, reset limit on filter changes, Drive blocking/recovery copy, report button disabling, grouped darkroom supplies, corrected CTA/status copy, notice empty-state branching, semantic review rows, and sticky safe-area-aware flow actions.

- [x] **Step 4: Run student tests**

Run: `npm run test:student-react && npm run test:student-bridge && npm run test:equipment-ui`

Expected: PASS.

### Task 3: Admin responsive ownership and density

**Files:**
- Modify: `scripts/react-admin-render-test.mjs`
- Modify: `scripts/admin-dashboard-ux-test.mjs`
- Modify: `src/react/design-system/Dialog.tsx`
- Modify: `src/react/admin/AdminApp.tsx`
- Modify: `src/react/admin/screens/AdminUsers.tsx`
- Modify: `src/react/admin/screens/AdminEquipment.tsx`
- Modify: `src/react/admin/screens/AdminNotices.tsx`
- Modify: `src/react/admin/screens/AdminLectures.tsx`
- Modify: `src/react/admin/screens/AdminLogs.tsx`
- Modify: `src/react/admin/screens/AdminReports.tsx`
- Modify: `src/react/admin/screens/AdminSettings.tsx`
- Modify: `src/react/design-system/react-admin.css`

**Interfaces:**
- Produces: `GjuDialog showActions?: boolean` with default `true`
- Produces: common desktop table class and mobile-only list ownership

- [x] **Step 1: Add failing Admin render and CSS assertions**

Assert a single dialog close control, desktop table classes on users/equipment/logs, no visible `React Admin` eyebrow, collapsed notice/lecture create controls, 44px icon buttons, aligned notice checkbox labels, and summarized session device text.

- [x] **Step 2: Run Admin tests and verify failures**

Run: `npm run check:react-admin && npm run test:admin-ui`

Expected: FAIL on dialog, table ownership, eyebrow, form disclosure, and mobile layout assertions.

- [x] **Step 3: Implement Admin layout and accessibility changes**

Add `showActions`, use header-only close for informational dialogs, mark tables with the responsive class, remove implementation eyebrows, gate create forms behind explicit toggles, summarize User-Agent, and adjust shared responsive CSS.

- [x] **Step 4: Run Admin tests**

Run: `npm run check:react-admin && npm run test:react-admin && npm run test:admin-ui`

Expected: PASS.

### Task 4: Full verification and branch commit

**Files:**
- Modify only files already listed when verification exposes a regression.

**Interfaces:**
- Consumes: all prior tasks
- Produces: one dated branch commit without merge or push

- [x] **Step 1: Run static, build, domain, and storage verification**

Run: `npm run check && npm run check:js && npm run build && npm run test:storage && npm run test:security`

Expected: PASS.

- [x] **Step 2: Run React and UX contract verification**

Run: `npm run check:react-admin && npm run test:react-admin && npm run test:student-react && npm run test:student-bridge && npm run test:equipment-ui && npm run test:admin-ui`

Expected: PASS.

- [ ] **Step 3: Run browser verification with the repository's existing Playwright setup**

Run: `npm run test:ui`

Expected: PASS at configured mobile/desktop viewports with no axe violations.

Not run in this branch session because direct Playwright execution requires the user's selected browser. The audit screenshots and render/UX contracts remain the visual grounding for this pass.

- [ ] **Step 4: Review diff and stage only implementation/spec files**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; `.codex-audit/` remains untracked and unstaged.

- [ ] **Step 5: Commit on the feature branch**

Commit message: `2026-07-14 기자재 승인 흐름 및 전체 화면 UX 개선`

Expected: branch `codex/2026-07-14-full-flow-ux-fixes` contains the commit; no merge and no push.
