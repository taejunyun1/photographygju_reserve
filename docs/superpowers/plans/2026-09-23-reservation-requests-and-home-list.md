# Reservation Requests and Home List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let students request multiple unlisted equipment items within existing studio or equipment reservations and see their own active reservations on the home dashboard.

**Architecture:** Store request rows in the existing reservation `fields.requestedEquipment` JSON array. Preserve the current reservation status model and the legacy studio `requiredEquipment` memo. Use the authenticated `/api/reservations/my` collection for the home list, with server-side ownership unchanged.

**Tech Stack:** React/TypeScript student UI, Node/ES modules reservation API, JSON backed SQLite Durable Object, Node assertions and Playwright UI checks.

## Global Constraints

- No new reservation type, approval status, database table, or independent equipment request workflow.
- Each request row is `{ name: string, quantity: number, note: string }`; multiple rows can be added and removed.
- Equipment reservations may contain selected catalog items, request rows, or both. Request rows never reserve inventory automatically.
- Studio's existing `requiredEquipment` text remains visible for old records and rebooking.
- Preserve unrelated `.codex-audit/` and `outputs/` directories.

---

### Task 1: Persist and validate request rows

**Files:**
- Create: `core/equipment-requests.mjs`
- Modify: `core/reservation-validation.mjs`, `core/notifications.mjs`, `src/react/admin/screens/AdminReservations.tsx`
- Test: `scripts/reservation-equipment-requests-test.mjs`

**Interfaces:**
- `normalizeRequestedEquipment(value)` returns validated, trimmed request rows or throws status 400.
- `formatRequestedEquipment(value)` renders `name × quantity` plus note for admin/notification display.

- [ ] Write API tests that create a studio booking with two rows, create an equipment booking with no catalog IDs and two rows, reject malformed rows, then fetch `/api/reservations/my` and verify rows survive.
- [ ] Run `node scripts/reservation-equipment-requests-test.mjs`; expect assertion failure for request-only equipment booking.
- [ ] Implement row normalization (max 20 rows; nonblank name up to 120 chars; integer quantity 1–99; note up to 500 chars) in the shared core helper. Validate on both create and edit through `validateReservation`; require catalog selection **or** at least one request row for equipment.
- [ ] Display request rows in admin reservation details and Slack text; show legacy studio text when new rows are absent.
- [ ] Re-run the focused test and `npm run test:backend-domains`; expect success.

### Task 2: Student multi-row request UI

**Files:**
- Create: `src/react/student/components/EquipmentRequestEditor.tsx`
- Modify: `src/react/student/components/ReservationControls.tsx`, `src/react/student/reservationDraft.ts`, `src/react/student/types.ts`, `src/react/student/student.css`, `public/js/state.js`, `public/js/react-student-adapter.js`
- Test: `scripts/student-react-contract-test.mjs`, `scripts/react-student-bridge-test.mjs`

**Interfaces:**
- `EquipmentRequestEditor` consumes request rows and calls `onChange(rows)` after adding, editing or removing a row.
- `StudentReservationSelectionPatch.requestedEquipment` retains equipment flow rows across the selection and confirmation steps.

- [ ] Add failing student contract checks for two request rows in the equipment picker and studio details, request-only draft creation, malformed row rejection, and the bridge's state reset/rebooking behavior.
- [ ] Run `npm run test:student-react` and `npm run test:student-bridge`; verify failures are caused by missing feature behavior.
- [ ] Add the reusable editor, equipment selection state, and studio details state. Build `fields.requestedEquipment` in both drafts; make the equipment selection step accept a nonblank request-only selection.
- [ ] Preserve existing `requiredEquipment` text for studio rebooking and reports; display old text in the request area when a prior booking has no structured rows.
- [ ] Re-run focused student and bridge checks; expect success.

### Task 3: Show current reservations on student home

**Files:**
- Modify: `src/react/student/screens/HomeScreen.tsx`, `src/react/student/components/StudentPrimitives.tsx`, `src/react/student/student.css`, `public/js/react-student-adapter.js`
- Test: `scripts/student-react-contract-test.mjs`, `tests/ui/react-student.spec.mjs`

**Interfaces:**
- The dashboard displays up to three current or upcoming owned bookings, with count, date/time, place or equipment, existing status, request memo, and a link to the full `mine` screen.

- [ ] Add failing tests with an expired reservation, three future reservations of different types, a cancelled reservation, and two request rows. Expect only active upcoming items ordered by start time with request summaries.
- [ ] Run focused student checks; verify the new assertions fail first.
- [ ] Replace the single `nextReservation` block with the compact `내 예약` list. Refresh `/api/reservations/my` when entering home as well as mine/reports; retain last results and show a refresh error on failure.
- [ ] Re-run focused checks, TypeScript check, and the relevant Playwright test; expect success.
- [ ] Update the standalone mockup to show more than one unlisted request row, then verify the repo diff has no unrelated modifications.
