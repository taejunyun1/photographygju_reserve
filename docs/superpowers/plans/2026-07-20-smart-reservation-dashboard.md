# Smart Reservation Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add data-driven administrator insights, group-based student favourites and rebooking, low-noise reservation reminders, and deterministic reservation alternatives without changing the app's navigation structure.

**Architecture:** Keep authoritative reservation validation in `core.mjs`. Isolate derived analytics, favourite-group validation, and candidate ranking into focused `core/` helpers; expose them through authenticated additive API routes. React screens consume only sanitised responses through the existing bridge, while the existing native notification planner owns local scheduling and cancellation.

**Tech Stack:** Node.js ESM, Cloudflare Worker/Durable Object-compatible shared core, React 19, TypeScript, Astryx design system, Capacitor Local Notifications, Node assert scripts, Playwright.

## Global Constraints

- Do not add a new top-level student or administrator navigation item.
- Keep all reservation creation and edits routed through existing `validateReservation` logic.
- Show administrator-only aggregate metrics; never include another student's name, student ID, phone, or reservation reason in analytics or recommendation responses.
- Favourite groups: maximum 3 groups, group name maximum 12 characters, maximum 5 equipment IDs per group, and an equipment ID may appear in only one group.
- Recommendations return at most 3 candidates and must be revalidated immediately before they are returned and again when the user submits the final reservation.
- Reservation reminders may contain at most one pre-start reminder in any rolling 12-hour interval; report reminders keep their existing independent schedule.
- Reuse existing React design-system controls and preserve 44px minimum interactive hit areas.
- Do not touch the user's existing untracked `.codex-audit/` or `equipment-list-2026-07-14.txt` files.

---

## File Structure

| File | Responsibility |
|---|---|
| `core/operations-insights.mjs` | Derive 28-day congestion, equipment utilisation, cancellation rate, demand/shortage warnings, and overdue-return warnings from reservations and equipment. |
| `core/favorite-equipment.mjs` | Normalise, validate, and sanitise per-user favourite equipment groups and form safe rebooking shortcuts. |
| `core/reservation-recommendations.mjs` | Produce deterministic alternative reservation drafts, rank candidates, and cap their public representation. |
| `core.mjs` | Initialise/migrate user preferences, expose authenticated routes, wire validation callbacks, and attach `insights` to the existing admin summary. |
| `src/react/platform/types.ts` | Type the `summary.insights` response consumed by the React administrator screen. |
| `src/react/admin/screens/AdminDashboard.tsx` | Render administrator insight and warning cards that reuse existing reservation/equipment navigation actions. |
| `src/react/student/types.ts` | Type favourite groups, rebooking shortcuts, recommendations, and related student actions. |
| `public/js/react-student-adapter.js` | Load/snapshot shortcut data and implement bridge actions for favourites, rebooking, and recommendation lookup. |
| `src/react/student/components/FavoriteEquipmentSheet.tsx` | Render the accessible mobile-friendly favourite group manager as a bottom sheet. |
| `src/react/student/screens/HomeScreen.tsx` | Render compact favourite groups and recent rebooking cards under the next reservation. |
| `src/react/student/components/ReservationControls.tsx` | Render alternatives only after a failed reservation submission and apply selected values to the draft. |
| `src/react/student/student.css` | Add responsive, safe-area-aware group cards, bottom-sheet, and recommendation styles. |
| `public/js/notification-planner.js` | Replace the four noisy pre-start offsets with deduplicated day-before / optional one-hour / equipment-return reminders. |
| `scripts/smart-reservation-domain-test.mjs` | Cover core metric, favourite group, shortcut, and recommendation contracts. |
| Existing contract tests | Assert dashboard, student bridge/UI, and native notification regression contracts. |

## Task 1: Build and test derived operations insights

**Files:**

- Create: `core/operations-insights.mjs`
- Create: `scripts/smart-reservation-domain-test.mjs`
- Modify: `core.mjs:1-40,942-1035`
- Modify: `package.json`

**Interfaces:**

- Produces `buildOperationsInsights({ reservations, equipment, now, days })`.
- Returns `{ period: { from, to, days }, congestion, equipmentUtilization, cancellationRate, warnings }` where all arrays are pre-sorted and capped.
- Consumes reservation timing already attached by `withReservationDetails` and must derive timing with `reservationTiming` when it is absent.

- [ ] **Step 1: Write failing helper and API assertions**

Add a test fixture with one returned equipment reservation, one cancelled reservation, one checked-out overdue reservation, and an active reservable equipment item. Assert the public shape and the required inclusion/exclusion rules:

```js
const insights = buildOperationsInsights({ reservations, equipment, now: new Date("2099-01-28T12:00:00+09:00") });
assert.equal(insights.period.days, 28);
assert.equal(insights.cancellationRate.totalRequests, 3);
assert.equal(insights.cancellationRate.cancelledRequests, 1);
assert.equal(insights.warnings.some((item) => item.kind === "overdue_return"), true);
assert.equal(insights.equipmentUtilization[0].equipmentId, equipment[0].id);
assert.equal(JSON.stringify(insights).includes("010"), false);
```

Also call `GET /api/admin/summary` using the existing `handleApiRequest` fixture and assert `body.data.insights` exists only for an administrator.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node scripts/smart-reservation-domain-test.mjs`

Expected: fail because `core/operations-insights.mjs` and `summary.insights` do not exist.

- [ ] **Step 3: Implement `buildOperationsInsights`**

Create the helper with explicit terminal-state and time-window predicates:

```js
const TERMINAL = new Set(["cancelled", "admin_cancelled", "rejected"]);
const BLOCKING = new Set(["pending_approval", "approved", "checked_out", "returned", "auto_confirmed", "completed"]);

export function buildOperationsInsights({ reservations = [], equipment = [], now = new Date(), days = 28 } = {}) {
  const to = dateKey(now);
  const from = addDays(to, -(days - 1));
  const scoped = reservations.filter((item) => dateKeyForReservation(item) >= from && dateKeyForReservation(item) <= to);
  const cancelled = scoped.filter((item) => TERMINAL.has(item.status));
  const operational = scoped.filter((item) => BLOCKING.has(item.status));
  return {
    period: { from, to, days },
    congestion: buildCongestion(operational).slice(0, 3),
    equipmentUtilization: buildEquipmentUtilization(operational, equipment, days).slice(0, 5),
    cancellationRate: { totalRequests: scoped.length, cancelledRequests: cancelled.length, percent: percentage(cancelled.length, scoped.length) },
    warnings: buildWarnings({ reservations, equipment, operational, now }).slice(0, 3)
  };
}
```

Implement `buildCongestion` with only equipment/studio/darkroom/print reservation time fields, return `insufficientData: true` instead of a fabricated percentage where fewer than three comparable slots exist, and generate only `demand_increase`, `shortage`, and `overdue_return` warnings. Return equipment IDs/codes/names and numeric values; do not copy `user` or raw `fields` into the result.

In `core.mjs`, import the helper and assign `metrics.insights = buildOperationsInsights({ reservations: detailedReservations, equipment: db.equipment, now: new Date() })` inside the existing `/api/admin/summary` response.

- [ ] **Step 4: Run domain and existing dashboard tests**

Run: `node scripts/smart-reservation-domain-test.mjs && npm run test:admin-ui && npm run test:backend-domains`

Expected: all commands exit 0.

- [ ] **Step 5: Commit the insight domain slice**

```bash
git add core/operations-insights.mjs core.mjs scripts/smart-reservation-domain-test.mjs package.json
git commit -m "2026-07-20 운영 인사이트 도메인 추가"
```

## Task 2: Render administrator insight cards and drill-downs

**Files:**

- Modify: `src/react/platform/types.ts`
- Modify: `src/react/admin/screens/AdminDashboard.tsx`
- Modify: `scripts/react-admin-contract-test.mjs`
- Modify: `src/react/design-system/react-admin.css` only if existing dashboard classes cannot express the responsive layout

**Interfaces:**

- Consumes `LegacyState.summary.metrics.insights` from Task 1.
- Produces `운영 인사이트` and `주의 필요` sections with navigation callbacks to `setAdminView("reservations", filters)` or `setAdminView("equipment", filters)`.

- [ ] **Step 1: Add a failing render contract**

Add a summary fixture containing one congestion row, one utilisation row, a 12% cancellation rate, and one overdue warning. Assert the rendered admin source includes these labels and a harmless empty-state fallback:

```js
assert.match(source, /운영 인사이트/);
assert.match(source, /주의 필요/);
assert.match(source, /혼잡 시간/);
assert.match(source, /취소율/);
assert.match(source, /최근 4주 데이터가 충분하지/);
```

- [ ] **Step 2: Run the contract test to verify it fails**

Run: `npm run test:react-admin`

Expected: failure because the new sections are not rendered.

- [ ] **Step 3: Type and render the sections**

Add `AdminOperationsInsights` and `AdminOperationsWarning` types to `src/react/platform/types.ts`. In `AdminDashboard.tsx`, add a focused `insightCard` renderer that accepts `{ label, value, detail, onClick }`; render congestion, utilisation, and cancellation cards only when their data is sufficient. Render warning cards with clear Korean labels:

```tsx
<section className="admin-dashboard-insights" aria-labelledby="operations-insights-title">
  <h2 id="operations-insights-title">운영 인사이트</h2>
  {hasInsights ? <div className="admin-dashboard-insights__grid">…</div> : <p className="muted">최근 4주 데이터가 충분하지 않아 추세를 표시하지 않습니다.</p>}
</section>
```

Use existing `actions.setAdminView` filters for reservation warnings; for a shortage warning, navigate to `equipment` and preserve the warning's category in the existing query field only if that screen supports it. Otherwise, navigate without an invalid filter. Every click target must be a button with an accessible label and at least the existing card hit area.

- [ ] **Step 4: Run type, contract, and responsive checks**

Run: `npm run check:react-admin && npm run test:react-admin && npm run test:admin-ui`

Expected: all commands exit 0.

- [ ] **Step 5: Commit the admin UI slice**

```bash
git add src/react/platform/types.ts src/react/admin/screens/AdminDashboard.tsx scripts/react-admin-contract-test.mjs src/react/design-system/react-admin.css
git commit -m "2026-07-20 관리자 운영 인사이트 화면 추가"
```

## Task 3: Add favourite-group persistence and safe rebooking shortcuts

**Files:**

- Create: `core/favorite-equipment.mjs`
- Modify: `core.mjs:500-585,622-635,773-781`
- Modify: `scripts/smart-reservation-domain-test.mjs`
- Modify: `src/react/student/types.ts`
- Modify: `public/js/react-student-adapter.js`
- Modify: `scripts/student-react-contract-test.mjs`

**Interfaces:**

- Produces `normalizeFavoriteGroups(value, equipment)`, `validateFavoriteGroups(value, equipment)`, and `reservationShortcuts({ user, reservations, equipment })`.
- Adds `GET /api/me/reservation-shortcuts` and `PUT /api/me/favorite-equipment-groups`.
- Student action signatures: `saveFavoriteGroups(groups)`, `startRebooking(reservationId)`, and `loadReservationShortcuts()`.

- [ ] **Step 1: Write failing API and bridge contracts**

Extend `scripts/smart-reservation-domain-test.mjs` to send three valid groups, then assert rejection for a fourth group, a sixth ID, duplicate equipment IDs, an inactive equipment ID, and another student's request. Add bridge assertions for the API path and new action names:

```js
assert.equal(response.status, 200);
assert.equal(response.body.data.favoriteGroups.length, 3);
assert.equal(tooManyGroups.status, 400);
assert.match(tooManyGroups.body.error, /3개/);
assert.match(studentBridgeSource, /favorite-equipment-groups/);
assert.match(studentBridgeSource, /startRebooking/);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node scripts/smart-reservation-domain-test.mjs && npm run test:student-react`

Expected: failure because the routes, helper, snapshot fields, and actions do not exist.

- [ ] **Step 3: Implement the helper and routes**

Represent a group as `{ id, name, equipmentItemIds }`. The helper must trim names, generate stable server IDs for a new group when `id` is absent, reject duplicates across groups, and reject items that are not active/reservable. When normalising the database, default `user.preferences` to `{ favoriteEquipmentGroups: [] }` without replacing any unrelated future preferences.

The shortcut response must include only the caller's last three non-cancelled reservations and expanded safe equipment fields (`id`, `code`, `name`, `category`, `status`, `active`, `reservable`). The rebooking response is a draft source, not a newly stored reservation.

Use `requireApprovedStudent` for both routes, audit group changes with `favorite_groups.updated`, call `saveDb`, and return only the caller's sanitised groups.

- [ ] **Step 4: Extend the bridge and TypeScript contract**

Add `favoriteGroups` and `recentReservations` to `StudentState`. On initial refresh load `/api/me/reservation-shortcuts` alongside bootstrap and my reservations. Implement actions with this behaviour:

```js
async saveFavoriteGroups(groups) {
  const result = await api("/api/me/favorite-equipment-groups", { method: "PUT", body: { groups } });
  state.favoriteGroups = result.favoriteGroups;
  render();
}

startRebooking(reservationId) {
  const reservation = state.recentReservations.find((item) => item.id === reservationId);
  if (!reservation) return;
  applyReusableReservationFields(state, reservation);
  state.view = "reserve";
  state.reservationType = reservation.type;
  render();
}
```

`applyReusableReservationFields` must clear every date/time field and preserve only currently supported reusable equipment, facility, purpose, and contact fields. It must not copy `status`, `history`, timestamps, or any other user's information.

- [ ] **Step 5: Run API, bridge, type, and existing student contracts**

Run: `node scripts/smart-reservation-domain-test.mjs && npm run test:student-react && npm run test:student-bridge && npm run check:react-admin`

Expected: all commands exit 0.

- [ ] **Step 6: Commit the favourite and shortcut domain slice**

```bash
git add core/favorite-equipment.mjs core.mjs src/react/student/types.ts public/js/react-student-adapter.js scripts/smart-reservation-domain-test.mjs scripts/student-react-contract-test.mjs
git commit -m "2026-07-20 학생 즐겨찾기 그룹과 재예약 추가"
```

## Task 4: Build the student bottom-sheet and compact dashboard cards

**Files:**

- Create: `src/react/student/components/FavoriteEquipmentSheet.tsx`
- Modify: `src/react/student/screens/HomeScreen.tsx`
- Modify: `src/react/student/student.css`
- Modify: `src/react/student/types.ts`
- Modify: `scripts/student-react-contract-test.mjs`
- Test: `tests/ui/react-student.spec.mjs`

**Interfaces:**

- Consumes `state.favoriteGroups`, `state.bootstrap.equipment`, `state.recentReservations`, and actions from Task 3.
- Produces a `FavoriteEquipmentSheet` controlled by `open`, `onClose`, and `onSave(groups)`.

- [ ] **Step 1: Add failing component and browser assertions**

Assert the student source renders `즐겨찾기 관리`, group-cap and per-group-cap text, and `다시 예약`. Add a Playwright test that opens the sheet, creates a group, filters an equipment name, selects it, and verifies focus returns to the opener after close.

```js
await page.getByRole("button", { name: "즐겨찾기 관리" }).click();
await expect(page.getByRole("dialog", { name: "즐겨찾는 기자재 관리" })).toBeVisible();
await page.getByRole("button", { name: "닫기" }).click();
await expect(page.getByRole("button", { name: "즐겨찾기 관리" })).toBeFocused();
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:student-react && npx playwright test tests/ui/react-student.spec.mjs --config playwright.config.mjs`

Expected: failure because the bottom-sheet and cards are absent.

- [ ] **Step 3: Implement the sheet and home sections**

Use `GjuDialog` with a `student-react-favorite-sheet` class, `showActions={false}`, and a close button labelled `닫기`. Track draft groups only inside the sheet; call `onSave` once when the user saves. The sheet must:

```tsx
<GjuDialog open={open} title="즐겨찾는 기자재 관리" onClose={onClose} showActions={false}>
  <button type="button" onClick={createGroup} disabled={groups.length >= 3}>그룹 만들기</button>
  <input aria-label="기자재 검색" value={query} onChange={(event) => setQuery(event.target.value)} />
  <button type="button" onClick={() => addEquipment(selectedGroupId, equipment.id)}>추가</button>
</GjuDialog>
```

Move an already-selected equipment only after a confirmation that names the source and target groups. Put initial focus on the first group, or `그룹 만들기` when none exist; restore focus to the trigger on close. `HomeScreen` displays each group as a compact section with three visible equipment buttons and `외 N개` text, plus recent rebooking cards. Selecting an unavailable favourite must show its state and not start a reservation.

- [ ] **Step 4: Add responsive CSS without global overrides**

Add local classes for the fixed-bottom mobile dialog, group chips, 44px action buttons, and a desktop constrained sheet. Respect `env(safe-area-inset-bottom)` and the existing mobile bottom-navigation offset. Do not hide desktop content from the accessibility tree.

- [ ] **Step 5: Run student UI verification**

Run: `npm run test:student-react && npm run test:student-bridge && npm run test:ui`

Expected: all commands exit 0.

- [ ] **Step 6: Commit the favourite bottom-sheet UI slice**

```bash
git add src/react/student/components/FavoriteEquipmentSheet.tsx src/react/student/screens/HomeScreen.tsx src/react/student/student.css src/react/student/types.ts scripts/student-react-contract-test.mjs tests/ui/react-student.spec.mjs
git commit -m "2026-07-20 학생 즐겨찾기 바텀시트 추가"
```

## Task 5: Reduce reservation reminder noise

**Files:**

- Modify: `public/js/notification-planner.js`
- Modify: `scripts/native-notifications-test.mjs`

**Interfaces:**

- `planReservationNotifications()` keeps the existing return shape and 64-notification maximum.
- Pre-start planner keys become `day-before` and optional `hour-before`; equipment adds `return-hour-before` only while its status is `checked_out`.

- [ ] **Step 1: Add failing planner assertions**

For a reservation 30 hours away, assert the plan includes `day-before` and does not include `ten-min-before` or `start`. For a reservation 8 hours away, assert there is at most one pre-start notification. For a checked-out equipment reservation with a future end time, assert a `return-hour-before` notification exists; set status to `returned` and assert it disappears.

```js
assert.equal(planned.filter((item) => item.extra?.notificationType === "pre-start").length <= 1, true);
assert.equal(planned.some((item) => item.extra?.notificationType === "return-hour-before"), true);
```

- [ ] **Step 2: Run the notification test to verify it fails**

Run: `npm run test:notifications`

Expected: failure because the planner still creates 10-minute and start reminders and has no return reminder.

- [ ] **Step 3: Implement deduplicated planning**

Replace `REMINDER_OFFSETS` with day-before and hour-before candidates. Before adding each pre-start candidate, compare its scheduled timestamp to accepted pre-start notifications for the same reservation and only keep one within 12 hours, preferring the one-hour reminder. Add an equipment return candidate from `reservationEndDate()` only when `status === "checked_out"`. Continue excluding terminal states and keep report reminders on their existing independent path.

- [ ] **Step 4: Run notification and bridge tests**

Run: `npm run test:notifications && npm run test:student-bridge`

Expected: both commands exit 0.

- [ ] **Step 5: Commit the notification slice**

```bash
git add public/js/notification-planner.js scripts/native-notifications-test.mjs
git commit -m "2026-07-20 예약 알림 빈도 제한 적용"
```

## Task 6: Add deterministic reservation alternatives

**Files:**

- Create: `core/reservation-recommendations.mjs`
- Modify: `core.mjs:838-860`
- Modify: `src/react/student/types.ts`
- Modify: `public/js/react-student-adapter.js`
- Modify: `src/react/student/components/ReservationControls.tsx`
- Modify: `src/react/student/student.css`
- Modify: `scripts/smart-reservation-domain-test.mjs`
- Modify: `scripts/student-react-contract-test.mjs`

**Interfaces:**

- Produces `findReservationRecommendations({ db, type, fields, validateCandidate, now })`.
- Adds `POST /api/reservations/recommendations` and `StudentActions.loadReservationRecommendations(draft)`.
- Returns `{ alternatives: Array<{ kind: "same_equipment_time" | "alternate_equipment" | "alternate_time"; label: string; patch: StudentReservationSelectionPatch }> }`.

- [ ] **Step 1: Add failing recommendation tests**

Seed a booked equipment item and a different available item in its category. Submit a conflicting equipment draft to the new route and assert exactly these contract rules:

```js
assert.equal(response.status, 200);
assert.ok(response.body.data.alternatives.length <= 3);
assert.equal(response.body.data.alternatives.every((item) => item.patch.type === "equipment"), true);
assert.equal(JSON.stringify(response.body.data).includes("userName"), false);
assert.equal(JSON.stringify(response.body.data).includes("phone"), false);
```

Add a no-candidate fixture that returns `{ alternatives: [] }` with 200, not an invented alternative or a server error.

- [ ] **Step 2: Run the domain test to verify it fails**

Run: `node scripts/smart-reservation-domain-test.mjs`

Expected: failure because the route and recommendation helper do not exist.

- [ ] **Step 3: Implement server-side candidate generation**

Generate equipment candidates in this exact order: same IDs on the next valid date/time within seven days, active reservable same-category equipment at the requested condition, then an alternative configured time on the requested date. For studio, darkroom, and print, generate only date/time candidates and never fabricate an alternate physical resource. For every candidate, clone fields, call the `validateReservation(db, type, candidateFields)` callback, discard thrown candidates, and then build a public patch containing only changed selection fields.

Add the new route before `POST /api/reservations`. It requires an approved student, accepts `{ type, fields }`, returns an empty list when the supplied draft already validates, and never persists data or sends Slack notifications.

- [ ] **Step 4: Add failed-submit recovery to the student flow**

In the bridge, keep the original `submitReservation` failure behaviour but call the recommendation endpoint only for 409 validation conflicts. Store alternatives in React state. In `ReservationControls.tsx`, render a `다른 선택지` card after the server error, show at most three labelled buttons, call `updateReservationSelection(alternative.patch)` on click, and clear alternatives whenever the draft changes or submission succeeds. If no alternative exists, render `현재 조건에서 가능한 대안이 없습니다. 날짜나 시간 조건을 바꿔 주세요.`.

- [ ] **Step 5: Run recommendation, student, and backend regression tests**

Run: `node scripts/smart-reservation-domain-test.mjs && npm run test:student-react && npm run test:student-bridge && npm run test:backend-domains && npm run test:security`

Expected: all commands exit 0.

- [ ] **Step 6: Commit the recommendation slice**

```bash
git add core/reservation-recommendations.mjs core.mjs src/react/student/types.ts public/js/react-student-adapter.js src/react/student/components/ReservationControls.tsx src/react/student/student.css scripts/smart-reservation-domain-test.mjs scripts/student-react-contract-test.mjs
git commit -m "2026-07-20 예약 대안 추천 추가"
```

## Task 7: Run the release-relevant verification set

**Files:**

- Modify only if verification reveals a specific defect in Tasks 1-6.

**Interfaces:**

- Verifies all prior public APIs, React contracts, native notification behaviour, and browser flows together.

- [ ] **Step 1: Run static and domain verification**

Run: `npm run check && npm run check:js && npm run check:react-admin && node scripts/smart-reservation-domain-test.mjs && npm run test:backend-domains && npm run test:storage && npm run test:security`

Expected: all commands exit 0.

- [ ] **Step 2: Run React, native, and browser verification**

Run: `npm run test:react-admin && npm run test:student-react && npm run test:student-bridge && npm run test:admin-ui && npm run test:notifications && npm run test:ui`

Expected: all commands exit 0.

- [ ] **Step 3: Inspect the final diff**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only files from this plan are staged or modified.

## Plan Self-Review

### Spec coverage

- Administrator-only congestion, utilisation, cancellation, demand/shortage, and overdue-return signals: Tasks 1-2.
- Existing-dashboard placement and drill-down behaviour: Task 2.
- Home-dashboard favourite groups, three-group maximum, five-items-per-group maximum, and bottom-sheet accessibility: Tasks 3-4.
- Recent reservation and same-configuration rebooking with cleared dates/times: Task 3.
- Low-noise day-before, optional pre-start, and return-imminent reminders: Task 5.
- Reservation failure alternatives, maximum three options, validation before display and submit: Task 6.
- Security, privacy, responsive, accessibility, and regression coverage: every task plus Task 7.

### Placeholder scan

No placeholder tasks, unspecified interfaces, or deferred validation steps are present.

### Type consistency

`favoriteGroups`, `recentReservations`, `saveFavoriteGroups`, `startRebooking`, `findReservationRecommendations`, and `StudentReservationSelectionPatch` use the same names in their producing and consuming tasks. `buildOperationsInsights` produces the `summary.metrics.insights` response consumed by the typed administrator dashboard.
