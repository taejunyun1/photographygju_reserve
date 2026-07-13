# UI Density and Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax so progress can be tracked without reinterpreting the approved design.

**Goal:** Implement the approved B2 flat-workspace design so student navigation stays aligned on mobile, administrator pages use available width efficiently, and repeated compact actions use centered icon buttons without text overflow.

**Architecture:** Extend the shared React design-system contracts first (`GjuIconButton`, `GjuCard`, `GjuTabs`, `GjuIcon`), then consume those contracts in student and administrator shells/screens. Preserve all existing API calls, state transitions, confirmations, loading states, and toast behavior; only DOM structure, accessibility metadata, and styling change. Verify each behavior test-first with render-contract tests and Playwright geometry checks.

**Tech Stack:** React 19, TypeScript, Astryx Design System, CSS, Node render-contract tests, Playwright.

## Global Constraints

- Follow `docs/superpowers/specs/2026-07-13-ui-density-navigation-design.md` exactly.
- Do not add a new icon dependency or create new inline/handcrafted SVGs. Reuse existing `GjuIcon` assets and Astryx semantic `Icon` names.
- Keep compact icon glyphs at 18–20px and their interactive hit area at 40–44px.
- Every icon-only action must have both `aria-label` and `title`; the icon itself remains hidden from assistive technology.
- Preserve existing event handlers, disabled/loading conditions, confirmation dialogs, API methods, and user-facing feedback.
- Write and run a failing test before each production change; make the smallest change that turns it green.
- Commit each completed task using the repository convention: `2026-07-13 <주요 변경 요약>`.

---

### Task 1: Lock shared primitive contracts

**Files:**

- Modify: `scripts/react-admin-render-test.mjs`
- Modify: `src/react/design-system/Button.tsx`
- Modify: `src/react/design-system/Card.tsx`
- Modify: `src/react/design-system/Tabs.tsx`
- Modify: `src/react/design-system/icons.tsx`
- Modify: `src/react/design-system/react-admin.css`

- [ ] **Step 1: Add failing render-contract assertions**

In `scripts/react-admin-render-test.mjs`, extend the primitive render checks so they require:

```js
assert.match(iconButtonMarkup, /aria-label="새로고침"/);
assert.match(iconButtonMarkup, /title="새로고침"/);

const workspaceCardMarkup = renderToStaticMarkup(
  React.createElement(GjuCard, { title: "학생 목록", surface: "workspace" }, "내용")
);
assert.match(workspaceCardMarkup, /data-surface="workspace"/);
```

Also render a horizontal `GjuTabs` instance and assert that the `tablist` and individual `tab` roles remain present.

- [ ] **Step 2: Run the contract test and confirm RED**

Run:

```bash
npm run check:react-admin
```

Expected: failure because `GjuIconButton` does not emit `title` and `GjuCard` does not accept or render `surface`.

- [ ] **Step 3: Implement minimal shared component changes**

In `Button.tsx`, forward `title: props.title || label` to `AstryxIconButton`. Keep `label` and `aria-label` unchanged.

In `Card.tsx`, add:

```ts
type GjuCardSurface = "card" | "workspace";

export type GjuCardProps = React.HTMLAttributes<HTMLElement> & {
  title?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  surface?: GjuCardSurface;
};
```

Default `surface` to `"card"`, include `data-surface={surface}`, and only include the panel-motion class for the regular card surface.

In `icons.tsx`, import `Icon` and `IconName` from `@astryxdesign/core`. Extend `GjuIconName` with only the Astryx semantic names needed by administrator utility controls (`calendar`, `chevronLeft`, `chevronRight`, `info`, `warning`, `wrench`). Render those names through `<Icon icon={name} size="sm" />`; keep the existing project-specific icons unchanged.

Do not change `GjuTabs` keyboard behavior. Add a stable `data-orientation={orientation}` hook if the CSS needs it.

- [ ] **Step 4: Implement shared CSS contracts**

In `react-admin.css`:

- Make `.gju-icon-button` a fixed 40×40px inline-grid with `place-items: center`, no text wrapping, and 18px glyphs.
- Keep the busy wrapper the same 40×40px footprint.
- Add `.gju-card[data-surface="workspace"]` rules removing border, shadow, background, and outer radius.
- Set workspace header/body horizontal padding to `0`; preserve a compact vertical gap between them.
- Make `.gju-tabs` a single non-wrapping flex row with `max-width: 100%`, `overflow-x: auto`, and `overscroll-behavior-inline: contain`.
- Make `.gju-tabs__tab` `flex: 0 0 auto` and `white-space: nowrap`.
- Remove the mobile `.tab-row` grid/auto-fit override that causes multi-line tabs.

- [ ] **Step 5: Verify GREEN and commit**

Run:

```bash
npm run check:react-admin
npm run test:react-admin
```

Expected: both commands pass.

Commit:

```bash
git add scripts/react-admin-render-test.mjs src/react/design-system/Button.tsx src/react/design-system/Card.tsx src/react/design-system/Tabs.tsx src/react/design-system/icons.tsx src/react/design-system/react-admin.css
git commit -m "2026-07-13 공통 아이콘·워크스페이스 컴포넌트 정비"
```

---

### Task 2: Stabilize the student mobile top bar

**Files:**

- Modify: `tests/ui/react-student.spec.mjs`
- Modify: `scripts/student-react-contract-test.mjs`
- Modify: `src/react/student/StudentShell.tsx`
- Modify: `src/react/student/student.css`

- [ ] **Step 1: Add failing student shell tests**

Add a Playwright test under the existing authenticated mobile student setup that measures `.student-react-mobile-header`, its title block, and the account button. Assert:

```js
expect(Math.abs(titleBox.y + titleBox.height / 2 - buttonBox.y - buttonBox.height / 2)).toBeLessThanOrEqual(2);
expect(buttonBox.width).toBeGreaterThanOrEqual(40);
expect(buttonBox.height).toBeGreaterThanOrEqual(40);
expect(headerBox.height).toBeLessThanOrEqual(72);
```

Set an intentionally long page title through the existing route/state fixture and assert that the title does not overlap the account button and `document.documentElement.scrollWidth === document.documentElement.clientWidth`.

In `scripts/student-react-contract-test.mjs`, assert that `StudentShell.tsx` contains dedicated title and action class hooks and still renders the account action through `GjuIconButton`.

- [ ] **Step 2: Run tests and confirm RED**

Run:

```bash
npm run test:student-react
npx playwright test tests/ui/react-student.spec.mjs --project=mobile-390
```

Expected: the structure/geometry assertions fail because the mobile header currently has no dedicated row/title CSS contract.

- [ ] **Step 3: Implement the mobile header row**

In `StudentShell.tsx`, keep the existing title, subtitle, and account handler but apply these structural hooks:

```tsx
<div className="mobile-top student-react-mobile-header">
  <div className="student-react-mobile-header__title">...</div>
  <div className="student-react-mobile-header__actions">...</div>
</div>
```

Do not remove the current heading focus used after navigation. Scope the styling so programmatic `h1:focus:not(:focus-visible)` has no visible outline while `:focus-visible` remains visible.

In `student.css`:

- Make the header a one-row grid `minmax(0, 1fr) auto` aligned to center.
- Add `min-width: 0` to the title column and one-line ellipsis to the heading.
- Prevent the actions column from shrinking.
- Normalize desktop header controls to the same center line.
- Reduce desktop/mobile navigation glyphs to at most 20px while preserving the current hit targets.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```bash
npm run test:student-react
npm run test:student-bridge
npx playwright test tests/ui/react-student.spec.mjs --project=mobile-390 --project=mobile-430
```

Expected: student contract and both mobile viewport tests pass.

Commit:

```bash
git add tests/ui/react-student.spec.mjs scripts/student-react-contract-test.mjs src/react/student/StudentShell.tsx src/react/student/student.css
git commit -m "2026-07-13 학생 모바일 상단바 정렬 개선"
```

---

### Task 3: Flatten administrator list workspaces

**Files:**

- Modify: `scripts/react-admin-render-test.mjs`
- Modify: `tests/ui/react-admin.spec.mjs`
- Modify: `src/react/admin/screens/AdminDashboard.tsx`
- Modify: `src/react/admin/screens/AdminUsers.tsx`
- Modify: `src/react/admin/screens/AdminReservations.tsx`
- Modify: `src/react/admin/screens/AdminEquipment.tsx`
- Modify: `src/react/admin/screens/AdminReports.tsx`
- Modify: `src/react/admin/screens/AdminLectures.tsx`
- Modify: `src/react/admin/screens/AdminNotices.tsx`
- Modify: `src/react/admin/screens/AdminLogs.tsx`
- Modify: `src/react/design-system/react-admin.css`

- [ ] **Step 1: Add failing workspace assertions**

In `scripts/react-admin-render-test.mjs`, add source or rendered-screen assertions requiring `surface="workspace"` on the outer listing cards for users, reservations, equipment management, reports, lectures, notices, and logs. Leave create/edit forms, account cards, and settings groups as regular cards.

In `tests/ui/react-admin.spec.mjs`, add a 390px users-page geometry check:

- `.gju-card[data-surface="workspace"]` has no visible border/shadow.
- The search/filter panel and first mobile record share the workspace left/right edge within 2px.
- The tablist height is no more than one tab row plus its scrollbar allowance.
- Body-level horizontal overflow is absent.

- [ ] **Step 2: Run tests and confirm RED**

Run:

```bash
npm run check:react-admin
npx playwright test tests/ui/react-admin.spec.mjs --project=mobile-390
```

Expected: workspace markers and edge-alignment assertions fail.

- [ ] **Step 3: Apply workspace surfaces**

Change only the outer list/report/log cards to:

```tsx
<GjuCard surface="workspace" ...>
```

For `AdminDashboard.tsx`, use the workspace surface for the page-introduction/overview wrapper while retaining actual metric, queue, and action cards. Do not flatten forms or settings groups whose card boundary conveys grouping.

Adjust shared CSS only as needed to align `.list-control-panel`, tab rows, result summaries, tables, and mobile record lists to the workspace edge. Do not remove the existing responsive switch between desktop tables and mobile record cards.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```bash
npm run check:react-admin
npm run test:react-admin
npx playwright test tests/ui/react-admin.spec.mjs --project=mobile-390 --project=mobile-430 --project=desktop
```

Expected: render contracts and all three administrator viewport runs pass.

Commit:

```bash
git add scripts/react-admin-render-test.mjs tests/ui/react-admin.spec.mjs src/react/admin/screens/AdminDashboard.tsx src/react/admin/screens/AdminUsers.tsx src/react/admin/screens/AdminReservations.tsx src/react/admin/screens/AdminEquipment.tsx src/react/admin/screens/AdminReports.tsx src/react/admin/screens/AdminLectures.tsx src/react/admin/screens/AdminNotices.tsx src/react/admin/screens/AdminLogs.tsx src/react/design-system/react-admin.css
git commit -m "2026-07-13 관리자 목록 워크스페이스 평면화"
```

---

### Task 4: Convert compact user and reservation actions to B2 icons

**Files:**

- Modify: `scripts/react-admin-render-test.mjs`
- Modify: `src/react/admin/screens/AdminUsers.tsx`
- Modify: `src/react/admin/screens/AdminReservations.tsx`
- Modify: `src/react/design-system/react-admin.css`

- [ ] **Step 1: Add failing semantic-action assertions**

Extend the render test so representative user and reservation records require icon-only buttons with exact accessible names, including:

- `비밀번호 초기화`
- `학생 승인`
- `학생 반려`
- `메모 추가` / `메모 수정`
- `예약 승인`, `예약 반려`, `예약 취소`, or the exact existing status action label
- `예약 삭제`

For each rendered button, assert `aria-label` and matching `title`. Assert that the button's rendered children do not include a `.gju-button__label` containing the action text.

- [ ] **Step 2: Run the render test and confirm RED**

Run:

```bash
npm run check:react-admin
```

Expected: text-action assertions fail on current `GjuButton` actions.

- [ ] **Step 3: Replace only compact repeated actions**

In `AdminUsers.tsx`, replace password reset, approval/rejection, and memo utility buttons with `GjuIconButton`. Reuse `refresh`, `check`, `x`, and `edit`; preserve all handlers and state guards. Keep bulk actions and the primary student-add form as text buttons.

In `AdminReservations.tsx`, replace per-record status and delete action buttons with `GjuIconButton`. Use `check` for approval/completion, `x` for rejection/cancellation, `refresh` for reset/reopen transitions, and `trash` for deletion. Derive each `label` from the existing action text so its meaning does not change. Apply the same rendering helper to desktop rows and mobile cards to avoid parity drift.

Keep the existing status badge text and confirmation prompts.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```bash
npm run check:react-admin
npm run test:react-admin
npm run test:admin-ui
```

Expected: all administrator render and interaction contracts pass.

Commit:

```bash
git add scripts/react-admin-render-test.mjs src/react/admin/screens/AdminUsers.tsx src/react/admin/screens/AdminReservations.tsx src/react/design-system/react-admin.css
git commit -m "2026-07-13 학생·예약 반복 액션 아이콘화"
```

---

### Task 5: Convert remaining compact administrator utilities

**Files:**

- Modify: `scripts/react-admin-render-test.mjs`
- Modify: `src/react/admin/screens/AdminEquipment.tsx`
- Modify: `src/react/admin/screens/AdminLectures.tsx`
- Modify: `src/react/admin/screens/AdminNotices.tsx`
- Modify: `src/react/admin/screens/AdminLogs.tsx`
- Modify: `src/react/admin/screens/AdminSettings.tsx`
- Modify: `src/react/design-system/react-admin.css`

- [ ] **Step 1: Add failing tests for remaining utilities**

Add exact `aria-label`/`title` assertions for:

- Equipment record status actions and removal.
- Lecture edit/delete.
- Notice delete.
- Log force-logout.
- Settings calendar previous/today/next controls.

Keep controls that are semantic selectors or primary form submissions as text when an icon alone would be ambiguous.

- [ ] **Step 2: Run the render test and confirm RED**

Run:

```bash
npm run check:react-admin
```

Expected: current text utility buttons fail the icon-only contract.

- [ ] **Step 3: Implement compact icon utilities**

Use existing project icons for edit/delete/logout. Use Astryx semantic icons through `GjuIcon` for equipment status (`check`, `wrench`, `warning`, or `info`) and calendar navigation (`chevronLeft`, `calendar`, `chevronRight`). Preserve every action's current handler, loading/disabled state, confirmation, and status text badge.

If a control's current label distinguishes two actions that would share the same icon, keep its accessible label exact and rely on `title` for pointer users; do not add visible text back into the 40px action slot.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```bash
npm run check:react-admin
npm run test:react-admin
npm run test:admin-ui
```

Expected: administrator contracts pass with no lost action semantics.

Commit:

```bash
git add scripts/react-admin-render-test.mjs src/react/admin/screens/AdminEquipment.tsx src/react/admin/screens/AdminLectures.tsx src/react/admin/screens/AdminNotices.tsx src/react/admin/screens/AdminLogs.tsx src/react/admin/screens/AdminSettings.tsx src/react/design-system/react-admin.css
git commit -m "2026-07-13 관리자 유틸리티 액션 아이콘 정리"
```

---

### Task 6: Add responsive and accessibility regression coverage

**Files:**

- Modify: `tests/ui/react-admin.spec.mjs`
- Modify: `tests/ui/react-student.spec.mjs`
- Modify: `tests/ui/accessibility.spec.mjs`
- Modify: `src/react/design-system/react-admin.css`
- Modify: `src/react/student/student.css`

- [ ] **Step 1: Add final failing browser assertions**

Add reusable Playwright helpers that verify:

```js
const iconBox = await button.locator("svg, [data-icon]").first().boundingBox();
expect(iconBox.width).toBeGreaterThanOrEqual(16);
expect(iconBox.width).toBeLessThanOrEqual(20);
expect(Math.abs(buttonCenterX - iconCenterX)).toBeLessThanOrEqual(1);
expect(Math.abs(buttonCenterY - iconCenterY)).toBeLessThanOrEqual(1);
```

Cover student and administrator headers, at least one record action cluster, tabs with a long label, and the bottom navigation. Add a text-enlargement check by applying a 200% root font size before measuring body overflow and essential action visibility.

In `accessibility.spec.mjs`, verify every visible `.gju-icon-button` has a non-empty accessible name and `title`, and that the tablist relationship/keyboard movement still works.

- [ ] **Step 2: Run focused browser tests and confirm RED where CSS still violates the contract**

Run:

```bash
npx playwright test tests/ui/react-admin.spec.mjs tests/ui/react-student.spec.mjs tests/ui/accessibility.spec.mjs --project=mobile-390 --project=mobile-430
```

Expected: any remaining oversized/off-center glyph, overflow, or focus issue is reported by a geometry assertion.

- [ ] **Step 3: Make minimal CSS corrections**

Correct only shared icon slots, long-content containment, and focus-visible selectors needed by the failing assertions. Do not add page-specific magic widths. Keep intended horizontal scrolling inside `.gju-tabs`/filter containers and ensure `body` itself remains overflow-free.

- [ ] **Step 4: Run the full verification matrix**

Run:

```bash
npm run check:react-admin
npm run test:react-admin
npm run test:student-react
npm run test:student-bridge
npm run test:admin-ui
npm run check:js
npm run test:ui
```

Expected: every command exits successfully with no test failures.

- [ ] **Step 5: Capture and compare final target screens**

Using the already-approved in-app browser workflow, capture 390×844 and 430×932 versions of:

- Student home and reservation.
- Administrator dashboard, users, reservations, equipment, and settings.

Compare each to the pre-change captures in `/Users/taejun-yun/.codex/visualizations/2026/07/13/019f5bce-c1c2-7cb3-ab1a-c37340bbf7f7/gju-ui-audit/`. Confirm the title/action center line, removal of nested workspace insets, single-row tabs, 18–20px centered glyphs, and absence of body-level horizontal overflow.

- [ ] **Step 6: Commit verification coverage**

```bash
git add tests/ui/react-admin.spec.mjs tests/ui/react-student.spec.mjs tests/ui/accessibility.spec.mjs src/react/design-system/react-admin.css src/react/student/student.css
git commit -m "2026-07-13 반응형·접근성 UI 회귀 검증 보강"
```

---

## Final Self-Review Checklist

- [ ] Every production change was preceded by a test that failed for the intended missing behavior.
- [ ] All approved surfaces are covered: student top bar, administrator workspace density, compact actions, tabs, long labels, and icon geometry.
- [ ] No placeholders, pseudo-code-only steps, new routes, or unstated API changes remain.
- [ ] Types are explicit for new props and icon names; no `any` is introduced.
- [ ] Existing confirmation, loading, disabled, toast, tab semantics, and desktop/mobile parity remain intact.
- [ ] Final screenshots were visually compared at the same viewport/state as the approved audit captures.
- [ ] The full verification matrix passes from a clean command run.
