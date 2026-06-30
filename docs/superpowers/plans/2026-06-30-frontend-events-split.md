# Frontend Events Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `public/js/events.js` into focused event modules while preserving every current UI interaction, smoke-test contract, and release-readiness check.

**Architecture:** Keep `public/js/events.js` as the single public event facade imported by `public/js/main.js`. Move delegated event logic into modules under `public/js/events/`, with shared scroll/search/reservation helpers exported from one shared module. Existing rendered views keep their current `data-*`, `name`, and `data-form` contracts.

**Tech Stack:** Vanilla JavaScript ESM, static `public/` assets, existing Node smoke-test scripts, optional rendered QA through Browser plugin or Playwright fallback.

## Global Constraints

- Preserve `public/js/main.js` importing only `setupEventHandlers` from `./events.js?v=20260627-admin-lecture-nav`.
- Preserve current query-string cache suffix `?v=20260627-admin-lecture-nav` on all new public JS imports.
- Do not change endpoint paths, request bodies, response handling, toast text, confirm/prompt/alert text, state key names, `data-*` attributes, form names, input names, or CSS class names.
- Do not change reservation validation, admin actions, Slack/backend behavior, storage, SQL, Cloudflare Durable Object persistence, or native notification behavior.
- Do not introduce new runtime dependencies, build steps, bundlers, or a test framework.
- Preserve App Review/release checks.
- Keep `scripts/equipment-reservation-ui-test.mjs` and `scripts/admin-dashboard-ux-test.mjs` source assertions meaningful after the split.
- Ignore unrelated uncommitted Android/release documentation changes in the worktree; do not stage, edit, or revert them.

---

## File Structure

- Keep `public/js/events.js`: facade only. It imports event module setup functions and calls them from `setupEventHandlers()`.
- Create `public/js/events/shared.js`: scroll preservation, admin pagination helpers, reservation-flow helpers, checked-value helpers, and reservation-draft synchronization.
- Create `public/js/events/search.js`: IME-safe search input binding, server-backed admin search page reset, and search rerender scheduling.
- Create `public/js/events/student-flow.js`: auth-mode clicks, notice/report sheets, student navigation, reservation type/step clicks, calendar-day selection, native notification clicks, equipment picker clicks, reservation cancellation, lecture apply/cancel, and my-reservation category clicks.
- Create `public/js/events/reservation-inputs.js`: delegated `change` handling for reservation input controls and admin equipment row selection checkboxes.
- Create `public/js/events/admin-flow.js`: delegated admin click handling for views, filters, pagination, tabs, lectures, blocked schedules, user actions, sessions, reservation status, and equipment status/bulk/remove actions.
- Create `public/js/events/forms.js`: delegated `submit` handling and the async `change` handler for `data-user-limit-duration`.
- Modify `scripts/equipment-reservation-ui-test.mjs`: read the combined event source from `public/js/events.js` plus `public/js/events/*.js`.
- Modify `scripts/admin-dashboard-ux-test.mjs`: read the combined event source from `public/js/events.js` plus `public/js/events/*.js`.
- Do not modify `public/js/main.js` unless verification proves the facade import broke.

## Task 1: Extract Shared Event Utilities

**Files:**
- Create: `public/js/events/shared.js`
- Modify: `public/js/events.js`
- Modify: `scripts/equipment-reservation-ui-test.mjs`
- Modify: `scripts/admin-dashboard-ux-test.mjs`

**Interfaces:**
- Consumes: `state`, `render`, `toast`, and utility functions from `public/js/utils.js`.
- Produces:
  - `EQUIPMENT_SCROLL_INTERACTION_SELECTOR`
  - `captureEquipmentInteractionScroll(event)`
  - `renderAtTop()`
  - `renderPreservingScroll()`
  - `resetAdminPage(key)`
  - `setAdminPage(key, page)`
  - `setReservationFlowStep(type, step)`
  - `goReservationFlowStep(type, step)`
  - `checkedValues(name)`
  - `applyPrintTimeSlot(value)`
  - `equipmentTimeRangeValid(period, rentalTime, returnTime)`
  - `syncReservationDraftFromDom(type)`
  - `canAdvanceReservationFlow(type, nextStep)`

- [ ] **Step 1: Run the baseline frontend checks**

Run:

```bash
npm run test:equipment-ui && npm run test:admin-ui && npm run check:js
```

Expected: PASS. This is the baseline for current scroll preservation, reservation flow, admin dashboard, and JS syntax.

- [ ] **Step 2: Update source-reading tests before moving code**

In `scripts/equipment-reservation-ui-test.mjs`, replace:

```js
const eventSource = fs.readFileSync("public/js/events.js", "utf8");
```

with:

```js
function readEventSource() {
  return [
    "public/js/events.js",
    "public/js/events/shared.js",
    "public/js/events/search.js",
    "public/js/events/student-flow.js",
    "public/js/events/reservation-inputs.js",
    "public/js/events/admin-flow.js",
    "public/js/events/forms.js"
  ]
    .filter((file) => fs.existsSync(file))
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");
}

const eventSource = readEventSource();
```

Make the same replacement in `scripts/admin-dashboard-ux-test.mjs`.

- [ ] **Step 3: Verify test-reader compatibility before extraction**

Run:

```bash
npm run test:equipment-ui && npm run test:admin-ui
```

Expected: PASS. The reader change alone must preserve current assertions against the unsplit file.

- [ ] **Step 4: Create `public/js/events/shared.js`**

Create `public/js/events/shared.js` with these imports and exports. Move the existing implementations from the top of `public/js/events.js` into this file without changing body text except import paths and added `export` keywords:

```js
import { state } from "../state.js?v=20260627-admin-lecture-nav";
import { render, toast } from "../renderer.js?v=20260627-admin-lecture-nav";
import {
  equipmentPeriodDays,
  equipmentRangeBlocked,
  isReservationDateClosed,
  printDateOutsideUploadWindow,
  printSelectionBlocked,
  printSelectionConflicts,
  timeToMinutes
} from "../utils.js?v=20260627-admin-lecture-nav";

export const EQUIPMENT_SCROLL_INTERACTION_SELECTOR = [
  "[data-equipment-category]",
  "[data-equipment-remove]",
  "[data-equipment-selection-toggle]",
  "[data-equipment-recommend-toggle]",
  "[data-equipment-recommend-add]",
  ".equipment-choice",
  "input[name=\"equipmentItemIds\"]"
].join(",");

const SCROLL_RESTORE_TARGET_SELECTOR = ".student-shell, .admin-main, .auth-shell, .mobile-nav, .admin-mobile-nav, .desktop-nav, .side-nav, .admin-inner-tabs, .lecture-year-tabs";

let lastEquipmentInteractionScrollState = null;

export function scrollToPageTop() {
  requestAnimationFrame(() => {
    for (const target of document.querySelectorAll(".student-shell, .admin-main, .auth-shell")) {
      target.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
      target.scrollTop = 0;
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  });
}

export function renderAtTop() {
  render();
  scrollToPageTop();
}
```

Continue the same file by moving the current definitions of `captureScrollState`, `restoreScrollState`, `renderPreservingScroll`, `captureEquipmentInteractionScroll`, `resetAdminPage`, `setAdminPage`, `setReservationFlowStep`, `goReservationFlowStep`, `checkedValues`, `applyPrintTimeSlot`, `equipmentTimeRangeValid`, `syncReservationDraftFromDom`, and `canAdvanceReservationFlow` from `public/js/events.js`. Preserve all current toast strings and state mutations exactly.

- [ ] **Step 5: Wire `public/js/events.js` to shared helpers**

At the top of `public/js/events.js`, remove utility imports that are now only used by `shared.js`: `equipmentPeriodDays`, `equipmentRangeBlocked`, `isReservationDateClosed`, `printDateOutsideUploadWindow`, `printSelectionBlocked`, `printSelectionConflicts`, and `timeToMinutes`.

Add:

```js
import {
  captureEquipmentInteractionScroll,
  renderAtTop,
  renderPreservingScroll,
  resetAdminPage,
  setAdminPage,
  setReservationFlowStep,
  goReservationFlowStep,
  applyPrintTimeSlot,
  canAdvanceReservationFlow
} from "./events/shared.js?v=20260627-admin-lecture-nav";
```

Remove the moved local helper definitions from `public/js/events.js`. Keep this line in `setupEventHandlers()`:

```js
document.addEventListener("pointerdown", captureEquipmentInteractionScroll, { capture: true, passive: true });
```

- [ ] **Step 6: Verify shared extraction**

Run:

```bash
npm run test:equipment-ui && npm run test:admin-ui && npm run check:js
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add public/js/events/shared.js public/js/events.js scripts/equipment-reservation-ui-test.mjs scripts/admin-dashboard-ux-test.mjs
git commit -m "2026-06-30 프론트 이벤트 공통 유틸 분리"
```

Expected: commit succeeds and does not stage unrelated Android/release documentation files.

## Task 2: Extract Search Event Handlers

**Files:**
- Create: `public/js/events/search.js`
- Modify: `public/js/events.js`

**Interfaces:**
- Consumes: `state`, `render`, `loadAdminData`, `normalizeUnicodeText`, and `resetAdminPage`.
- Produces: `setupSearchEventHandlers()`.

- [ ] **Step 1: Run the baseline search checks**

Run:

```bash
npm run test:equipment-ui && npm run test:admin-ui
```

Expected: PASS.

- [ ] **Step 2: Create `public/js/events/search.js`**

Create `public/js/events/search.js` with these imports:

```js
import { state } from "../state.js?v=20260627-admin-lecture-nav";
import { loadAdminData } from "../data.js?v=20260627-admin-lecture-nav";
import { render } from "../renderer.js?v=20260627-admin-lecture-nav";
import { normalizeUnicodeText } from "../utils.js?v=20260627-admin-lecture-nav";
import { resetAdminPage } from "./shared.js?v=20260627-admin-lecture-nav";
```

Move the current search-specific logic from inside `setupEventHandlers()` into `export function setupSearchEventHandlers() { ... }`. The moved block begins with:

```js
function rerenderSearch(selector, { restoreFocus = true } = {}) {
```

and ends after the current delegated `focusout` handler:

```js
document.addEventListener("focusout", async (event) => {
  const target = event.target;
  const binding = searchBindingForTarget(target);
  if (!binding) return;
  if (searchRenderInProgress) return;
  await commitSearchInput(target, binding, { restoreFocus: false });
});
```

Do not change `searchBindings`, `adminServerSearchStateKeys`, `hangulSearchPattern`, IME/composition comments, debounce delay `120`, or the `loadAdminData()` path for `adminUserSearch`, `adminReservationSearch`, and `adminReportSearch`.

- [ ] **Step 3: Wire search setup from the facade**

At the top of `public/js/events.js`, add:

```js
import { setupSearchEventHandlers } from "./events/search.js?v=20260627-admin-lecture-nav";
```

Remove the moved search logic from `setupEventHandlers()` and add this call after the reservation `change` handler block and before the `data-user-limit-duration` async change handler:

```js
setupSearchEventHandlers();
```

This preserves the current registration order: pointerdown, click, reservation/equipment change, search beforeinput/composition/input/keydown/focusout, user-limit change, submit.

- [ ] **Step 4: Verify search extraction**

Run:

```bash
npm run test:equipment-ui && npm run test:admin-ui && npm run check:js
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add public/js/events/search.js public/js/events.js
git commit -m "2026-06-30 검색 이벤트 핸들러 분리"
```

Expected: commit succeeds and does not stage unrelated Android/release documentation files.

## Task 3: Extract Student And Reservation Flow Handlers

**Files:**
- Create: `public/js/events/student-flow.js`
- Create: `public/js/events/reservation-inputs.js`
- Modify: `public/js/events.js`

**Interfaces:**
- Consumes from shared: `renderAtTop`, `renderPreservingScroll`, `setReservationFlowStep`, `goReservationFlowStep`, `applyPrintTimeSlot`, and `canAdvanceReservationFlow`.
- Produces:
  - `setupStudentFlowClickHandlers()`
  - `setupReservationInputHandlers()`

- [ ] **Step 1: Run the baseline student/reservation checks**

Run:

```bash
npm run test:equipment-ui && npm run check:js
```

Expected: PASS.

- [ ] **Step 2: Create `public/js/events/student-flow.js`**

Create `public/js/events/student-flow.js` with the imports needed by the moved click handlers:

```js
import { state } from "../state.js?v=20260627-admin-lecture-nav";
import { api } from "../api.js?v=20260627-admin-lecture-nav";
import { loadBootstrap, loadLectures, loadMyReservations } from "../data.js?v=20260627-admin-lecture-nav";
import { logout, openReport } from "../actions.js?v=20260627-admin-lecture-nav";
import {
  disableNativeReservationNotifications,
  enableNativeReservationNotifications,
  syncNativeReservationNotifications
} from "../native-notifications.js?v=20260627-admin-lecture-nav";
import { render, toast } from "../renderer.js?v=20260627-admin-lecture-nav";
import {
  renderAtTop,
  renderPreservingScroll,
  setReservationFlowStep,
  goReservationFlowStep,
  canAdvanceReservationFlow
} from "./shared.js?v=20260627-admin-lecture-nav";
```

Add `export function setupStudentFlowClickHandlers() { document.addEventListener("click", async (event) => { ... }); }` and move these exact click branches from the current `public/js/events.js` click listener into it, preserving branch order and body text:

```text
target.dataset.authMode
target.dataset.noticeOpen
target.dataset.noticeClose
target.dataset.pastReservationsToggle
target.dataset.calendarMonth
target.dataset.calendarDay
target.dataset.action === "logout"
target.dataset.nativeNotifications === "enable"
target.dataset.nativeNotifications === "sync"
target.dataset.nativeNotifications === "disable"
target.dataset.equipmentCategory
target.dataset.equipmentRemove
target.dataset.equipmentSelectionToggle
target.dataset.equipmentRecommendToggle
target.dataset.equipmentRecommendAdd
target.dataset.studentView
target.dataset.reserveShortcut
target.dataset.reserveType
target.dataset.action === "reserve-back"
target.dataset.reserveStep
target.dataset.reserveNext
target.dataset.cancelRes
target.dataset.reportRes
target.dataset.reportOpen
target.dataset.reportClose
target.dataset.lectureApply
target.dataset.lectureCancel
target.dataset.lectureYearFilter
target.dataset.myReservationCategory
```

Keep the listener wrapper exactly:

```js
document.addEventListener("click", async (event) => {
  const target = event.target.closest("button, a");
  if (!target) return;
  try {
    // moved branches
  } catch (error) {
    toast(error.message);
  }
});
```

- [ ] **Step 3: Create `public/js/events/reservation-inputs.js`**

Create `public/js/events/reservation-inputs.js` with:

```js
import { state } from "../state.js?v=20260627-admin-lecture-nav";
import {
  setAdminEquipmentSelection,
  setVisibleAdminEquipmentSelection,
  syncAdminEquipmentSelectionDom
} from "../admin-equipment.js?v=20260627-admin-lecture-nav";
import {
  renderPreservingScroll,
  setReservationFlowStep,
  applyPrintTimeSlot
} from "./shared.js?v=20260627-admin-lecture-nav";
```

Add `export function setupReservationInputHandlers() { document.addEventListener("change", (event) => { ... }); }` and move the first delegated `change` handler from `public/js/events.js` into it. The moved block starts with:

```js
const target = event.target;
if (target.dataset.equipmentSelectAll !== undefined) {
```

and ends after the `equipmentItemIds` branch:

```js
if (target.name === "equipmentItemIds") {
  ...
  renderPreservingScroll();
}
```

Preserve all current branch bodies and render calls.

- [ ] **Step 4: Wire student and reservation handlers from the facade**

At the top of `public/js/events.js`, add:

```js
import { setupStudentFlowClickHandlers } from "./events/student-flow.js?v=20260627-admin-lecture-nav";
import { setupReservationInputHandlers } from "./events/reservation-inputs.js?v=20260627-admin-lecture-nav";
```

Remove the moved student/reservation branches from the current click listener and remove the first delegated `change` listener. Add these calls inside `setupEventHandlers()` after the pointerdown registration:

```js
setupStudentFlowClickHandlers();
setupReservationInputHandlers();
```

If any admin branches remain in the original click listener for Task 4, keep the original listener in `public/js/events.js` for those remaining branches only. Do not duplicate a branch across files.

- [ ] **Step 5: Verify student/reservation extraction**

Run:

```bash
npm run test:equipment-ui && npm run test:admin-ui && npm run check:js
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add public/js/events/student-flow.js public/js/events/reservation-inputs.js public/js/events.js
git commit -m "2026-06-30 학생 예약 이벤트 핸들러 분리"
```

Expected: commit succeeds and does not stage unrelated Android/release documentation files.

## Task 4: Extract Admin And Form Handlers

**Files:**
- Create: `public/js/events/admin-flow.js`
- Create: `public/js/events/forms.js`
- Modify: `public/js/events.js`

**Interfaces:**
- Consumes from shared: `renderPreservingScroll`, `resetAdminPage`, and `setAdminPage`.
- Produces:
  - `setupAdminFlowClickHandlers()`
  - `setupFormEventHandlers()`

- [ ] **Step 1: Run the baseline admin/form checks**

Run:

```bash
npm run test:admin-ui && npm run test:equipment-ui && npm run check:js
```

Expected: PASS.

- [ ] **Step 2: Create `public/js/events/admin-flow.js`**

Create `public/js/events/admin-flow.js` with:

```js
import { state } from "../state.js?v=20260627-admin-lecture-nav";
import { api } from "../api.js?v=20260627-admin-lecture-nav";
import { loadAdminData, loadBootstrap } from "../data.js?v=20260627-admin-lecture-nav";
import { downloadAdminBackup, downloadLectureCsv } from "../actions.js?v=20260627-admin-lecture-nav";
import {
  patchAdminEquipment,
  syncAdminEquipmentDom
} from "../admin-equipment.js?v=20260627-admin-lecture-nav";
import { render, toast } from "../renderer.js?v=20260627-admin-lecture-nav";
import { formData, parseCsv } from "../utils.js?v=20260627-admin-lecture-nav";
import { renderPreservingScroll, resetAdminPage, setAdminPage } from "./shared.js?v=20260627-admin-lecture-nav";
```

Add `export function setupAdminFlowClickHandlers() { document.addEventListener("click", async (event) => { ... }); }` and move all remaining admin click branches from `public/js/events.js` into it. The moved branches are:

```text
target.dataset.adminQueueSheet
target.dataset.adminQueueSheetClose
target.dataset.action === "csv-preview"
target.dataset.action === "lecture-export"
target.dataset.action === "admin-export"
target.dataset.action === "admin-cleanup"
target.dataset.adminView
target.dataset.adminReservationTab && !target.dataset.adminView
target.dataset.adminEquipmentReservationStatus
target.dataset.adminUserStatusFilter
target.dataset.adminUsersPage
target.dataset.adminReservationsPage
target.dataset.adminReportsPage
target.dataset.adminSessionSort
target.dataset.adminLogActionFilter
target.dataset.adminLogSort
target.dataset.adminEquipmentPanelTab
target.dataset.adminEquipmentTab
target.dataset.adminEquipmentCategoryTab
target.dataset.adminLecturePanelTab
target.dataset.lectureUpdate
target.dataset.lectureEdit
target.dataset.lectureEditCancel
target.dataset.lectureDelete
target.dataset.blockedRemove
target.dataset.userSort
target.dataset.adminReportSort
target.dataset.userApproval
target.dataset.userReset
target.dataset.userWarn
target.dataset.userWarnReset
target.dataset.userDelete
target.dataset.warningPopupClose
target.dataset.sessionRevoke
target.dataset.resStatus
target.dataset.equipmentStatusAction
target.dataset.equipmentBulkStatus
target.dataset.equipmentRemoveAdmin
target.dataset.equipmentBulkRemove
```

Keep the listener wrapper exactly:

```js
document.addEventListener("click", async (event) => {
  const target = event.target.closest("button, a");
  if (!target) return;
  try {
    // moved branches
  } catch (error) {
    toast(error.message);
  }
});
```

- [ ] **Step 3: Create `public/js/events/forms.js`**

Create `public/js/events/forms.js` with:

```js
import { state } from "../state.js?v=20260627-admin-lecture-nav";
import { api } from "../api.js?v=20260627-admin-lecture-nav";
import { loadAdminData, loadBootstrap, loadMyReservations } from "../data.js?v=20260627-admin-lecture-nav";
import {
  changePassword,
  deleteAccount,
  login,
  signup,
  submitReservation
} from "../actions.js?v=20260627-admin-lecture-nav";
import { render, toast } from "../renderer.js?v=20260627-admin-lecture-nav";
import { equipmentCategories, formData, parseCsv } from "../utils.js?v=20260627-admin-lecture-nav";
```

Add `export function setupFormEventHandlers() { ... }` and move the current async `change` handler for `target.dataset.userLimitDuration` plus the full delegated `submit` handler from `public/js/events.js` into it. Preserve every `data-form` branch body exactly, including `form.reset()`, `render()` returns, and toast text.

- [ ] **Step 4: Reduce `public/js/events.js` to a facade**

At the top of `public/js/events.js`, keep only imports for setup functions:

```js
import { captureEquipmentInteractionScroll } from "./events/shared.js?v=20260627-admin-lecture-nav";
import { setupAdminFlowClickHandlers } from "./events/admin-flow.js?v=20260627-admin-lecture-nav";
import { setupFormEventHandlers } from "./events/forms.js?v=20260627-admin-lecture-nav";
import { setupReservationInputHandlers } from "./events/reservation-inputs.js?v=20260627-admin-lecture-nav";
import { setupSearchEventHandlers } from "./events/search.js?v=20260627-admin-lecture-nav";
import { setupStudentFlowClickHandlers } from "./events/student-flow.js?v=20260627-admin-lecture-nav";

export function setupEventHandlers() {
  document.addEventListener("pointerdown", captureEquipmentInteractionScroll, { capture: true, passive: true });
  setupStudentFlowClickHandlers();
  setupAdminFlowClickHandlers();
  setupReservationInputHandlers();
  setupSearchEventHandlers();
  setupFormEventHandlers();
}
```

No other logic should remain in `public/js/events.js`.

- [ ] **Step 5: Verify admin/form extraction**

Run:

```bash
npm run test:admin-ui && npm run test:equipment-ui && npm run check:js
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add public/js/events/admin-flow.js public/js/events/forms.js public/js/events.js
git commit -m "2026-06-30 관리자 폼 이벤트 핸들러 분리"
```

Expected: commit succeeds and does not stage unrelated Android/release documentation files.

## Task 5: Full Regression, Rendered QA, And Review

**Files:**
- No source edits unless verification exposes a defect.

**Interfaces:**
- Consumes: Tasks 1-4 split event modules.
- Produces: verified frontend event split ready for later view/CSS organization.

- [ ] **Step 1: Run focused frontend checks**

Run:

```bash
npm run test:equipment-ui && npm run test:admin-ui && npm run check:js
```

Expected: PASS.

- [ ] **Step 2: Run release gate**

Run:

```bash
npm run test:security && npm run test:storage && npm run release:check
```

Expected: PASS.

- [ ] **Step 3: Inspect final source state**

Run:

```bash
git status --short --untracked-files=all
git diff --stat HEAD
rg -n "from \"\\.\\/events\\.js|from './events\\.js|events\\.js\\?v=20260627-admin-lecture-nav|from \"\\.\\/events\\/" public/js scripts
```

Expected:
- no uncommitted source changes from this plan
- existing unrelated Android/release documentation changes may remain
- `public/js/main.js` imports `events.js`
- `public/js/events.js` imports `./events/*.js`
- scripts do not import `public/js/events/*.js`; they only read source files with `fs`

- [ ] **Step 4: Run rendered frontend QA**

Use `build-web-apps:frontend-testing-debugging`:

1. If Browser plugin tooling is callable, use the Browser path.
2. If Browser tooling is unavailable in this session, record `Browser plugin not available` and use Playwright or a browser smoke script outside the repo.
3. Target flow:

```text
The flow under test is: app loads -> login screen renders -> auth mode switch and primary navigation controls respond without runtime errors.
```

Minimum checks:
- page identity
- not blank
- no framework/runtime overlay
- console errors/warnings
- one desktop screenshot
- one mobile screenshot when practical
- interaction proof for switching between login/signup or reservation/admin tab state available without credentials

- [ ] **Step 5: Request final code review**

Use `superpowers:requesting-code-review` for the range starting at the commit before Task 1 and ending at current `HEAD`. Review focus:

```text
events.js remains the public facade, new event modules are focused by responsibility, event registration order preserves behavior, smoke tests still verify real contracts, rendered QA passes, and no unrelated Android/release documentation changes were included.
```

Expected: no Critical or Important findings. Fix any Critical/Important findings before final response. Record any Minor findings in `.superpowers/sdd/progress.md`.

- [ ] **Step 6: Final handoff note**

Final response should include:

```text
Verified:
- npm run test:equipment-ui
- npm run test:admin-ui
- npm run check:js
- npm run test:security
- npm run test:storage
- npm run release:check
- rendered frontend QA path used

Deferred:
- view/CSS organization
- deeper authenticated browser walkthrough with real review/admin credentials
```

Expected: user can approve the next view/CSS organization plan after this event split is complete.
