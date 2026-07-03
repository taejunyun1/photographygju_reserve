# 2026-07-03 React Astryx Motion Migration Design

## Goal

GJU-reserve 프론트를 React 구조로 전환하면서 Astryx 디자인 시스템을 전반적으로 적용하고, iOS Capacitor WebView에서도 안정적인 애니메이션과 일관된 UI를 제공한다.

이 설계의 1차 목표는 전체 앱을 한 번에 재작성하는 것이 아니라, React/Astryx 기반 구조를 깔고 Admin 핵심 화면을 먼저 전환해 디자인 일관성과 motion contract를 검증하는 것이다.

## Source References

- Astryx components: https://astryx.atmeta.com/components
- Astryx install/import contract: `npm install @astryxdesign/core`, `import {...} from '@astryxdesign/core/ComponentName'`
- Relevant Astryx component families observed from docs:
  - Layout: App Shell, Layout, Grid, Section
  - Navigation: Side Nav, Mobile Nav, Top Nav, Tabs
  - Action: Button, Icon Button, Button Group, Segmented Control, Toolbar
  - Container: Card, Clickable Card, Selectable Card, Collapsible
  - Data: Table, Pagination, List, Metadata List
  - Data input: Field, Text Input, Date Input, Selector, Switch, Checkbox
  - Overlay: Dialog, Alert Dialog, Popover, Tooltip, Toast
  - Feedback: Badge, Banner, Empty State, Skeleton, Spinner, Status Dot
  - Utility hooks: useEntryAnimation, useMediaQuery, useScrollLock, useToast, VisuallyHidden

## Current State

The current frontend is not Vue. It is a vanilla JavaScript single page app:

- `public/js/views-admin.js` and `public/js/views-student.js` build HTML strings.
- `public/js/renderer.js` writes the active screen with `$app.innerHTML = ...`.
- `public/js/events/*.js` use delegated DOM events and mutate shared `state`.
- `public/styles.css` carries nearly all UI styling in one large stylesheet.
- Cloudflare Pages serves the frontend from `dist`.
- Capacitor uses `webDir: "dist"` and loads the same web build inside iOS WKWebView.
- The Worker API, Durable Object SQLite storage, and same-origin Pages Function proxy are already stable and must not be rewritten as part of this migration.

The main limitation is that whole-screen `innerHTML` replacement makes transitions, component-level lifecycle, focus management, and design consistency harder to maintain. React is useful here because it lets us move UI into reusable components without changing backend contracts.

## Recommended Direction

Use a phased React migration with Astryx wrappers and a motion layer.

The first production-ready milestone is:

1. Add React build infrastructure while preserving `dist`, Cloudflare Pages, and Capacitor release flow.
2. Create a local GJU design-system wrapper layer around Astryx.
3. Add a motion contract for iOS-safe transitions.
4. Convert Admin shell and selected Admin surfaces to React.
5. Keep Student reservation flows on the existing renderer until the Admin React foundation is verified.

This is the recommended path because it improves UI consistency quickly while keeping the high-risk student reservation flow stable during the first migration.

## Alternatives Considered

### Option A: Token-Only Astryx Styling

Keep the current vanilla JS renderer and continue aligning CSS tokens with Astryx.

Pros:

- Lowest short-term risk.
- No build pipeline migration.
- Fastest path for minor visual polish.

Cons:

- Does not fix lifecycle, focus, modal, toast, and animation consistency.
- Large string views continue to grow.
- Design system usage remains implicit rather than enforced by components.

### Option B: React/Astryx Admin-First Migration

Add React and Astryx, then convert Admin shell and critical Admin panels first.

Pros:

- Meaningfully improves design consistency.
- Gives us reusable components before touching student reservation flows.
- Keeps backend and data contracts stable.
- Lets browser and iOS WebView QA validate motion behavior early.

Cons:

- Requires a mixed legacy/React bridge for a while.
- Build/test pipeline becomes more complex.
- Some duplicated UI primitives exist during migration.

This is the recommended option.

### Option C: Full App Rewrite To React/Astryx

Replace student, admin, auth, routing, events, and state management in one large pass.

Pros:

- Cleanest final architecture if completed successfully.
- No long mixed-mode period.

Cons:

- Highest regression risk.
- Student reservations, reports, account deletion, admin operations, and native release flow all move at once.
- Harder to QA and rollback.

This option is too large for the next update cycle.

## Scope

### Included In First Migration

- React runtime and build setup.
- Astryx package integration through local wrapper components.
- Admin shell conversion:
  - desktop side navigation
  - mobile header
  - mobile bottom navigation
  - top icon actions
  - loading/toast shell placement
- Admin design-system primitives:
  - `GjuButton`
  - `GjuIconButton`
  - `GjuCard`
  - `GjuTabs`
  - `GjuTable`
  - `GjuDialog`
  - `GjuToast`
  - `GjuEmptyState`
  - `GjuStatusBadge`
  - `GjuAppShell`
- Admin React screens for the first milestone:
  - Dashboard shell/cards
  - Student approval list actions
  - Equipment management list actions
  - Logs/session table
  - shared confirmation dialogs for destructive actions
- Motion contract:
  - screen entry
  - tab transitions
  - card press states
  - toast entry/exit
  - dialog/bottom-sheet entry/exit
  - loading skeletons
- QA for desktop and mobile web, plus iOS Capacitor WebView smoke testing.

### Deferred To Later Migration

- Full student reservation flow React conversion.
- Full Admin tab conversion for reports, lectures, notices, settings.
- Native SwiftUI rewrite.
- New DB schema, API response shape, or authentication rewrite.
- Large state-management library unless React local state and a small external store prove insufficient.
- Framer Motion or other large animation dependencies unless Astryx/CSS motion cannot meet the interaction requirements.

## Architecture

### Build Pipeline

Keep the deployment output contract:

```text
source files -> build -> dist -> Cloudflare Pages
                         -> Capacitor webDir
```

Introduce a React build pipeline that still writes static assets to `dist`.

Preferred structure:

```text
src/react/
  main.tsx
  App.tsx
  legacy/
    LegacyStudentRenderer.ts
    LegacyAuthRenderer.ts
  platform/
    apiClient.ts
    appState.ts
    bootstrap.ts
    nativeBridge.ts
  design-system/
    AppShell.tsx
    Button.tsx
    Card.tsx
    Dialog.tsx
    EmptyState.tsx
    StatusBadge.tsx
    Table.tsx
    Tabs.tsx
    Toast.tsx
    motion.ts
  admin/
    AdminApp.tsx
    AdminDashboard.tsx
    AdminUsers.tsx
    AdminEquipment.tsx
    AdminLogs.tsx
```

The first React entrypoint may still call legacy student/auth renderers while Admin moves to React. This keeps a single app root but avoids rewriting every screen at once.

### Runtime Ownership

React should own the shell and screens it renders. Legacy code should not mutate React-owned DOM.

During the transition:

- React owns Admin shell and converted Admin screens.
- Legacy renderer owns student/auth screens that are not converted yet.
- Shared data loading remains API-based.
- Existing `state` can be adapted behind a compatibility layer at first, but React components should gradually consume explicit props and actions.

### Data Flow

The backend remains unchanged.

```text
React Admin components
  -> platform/apiClient.ts
  -> same-origin /api/*
  -> Cloudflare Pages Function proxy
  -> Worker API
  -> Durable Object SQLite store
```

Admin actions should use typed action functions:

- `loadAdminDashboard()`
- `loadAdminUsers(params)`
- `loadAdminEquipment(params)`
- `loadAdminSessions(params)`
- `updateUserApproval(id, status)`
- `updateEquipmentStatus(id, status)`
- `deleteEquipment(id)`
- `revokeSession(id)`

The first implementation can wrap existing `public/js/api.js` calls to reduce risk. Later tasks can move API clients fully into `src/react/platform`.

## Design System Strategy

Do not import Astryx directly throughout feature screens.

Create a local wrapper layer and make feature code depend on that layer:

```text
Astryx primitive -> GJU wrapper -> Admin feature component
```

Reasons:

- Keep GJU naming and Korean copy consistent.
- Centralize icon-only button sizing.
- Centralize destructive action styling.
- Centralize loading/disabled/focus states.
- Make it possible to swap or patch Astryx usage without changing every screen.

### Component Mapping

| Current UI Need | React/Astryx Direction | GJU Wrapper |
|---|---|---|
| Admin layout | App Shell, Side Nav, Mobile Nav, Layout | `GjuAppShell` |
| Action buttons | Button, Icon Button, Button Group | `GjuButton`, `GjuIconButton` |
| Filter tabs | Tab List, Segmented Control | `GjuTabs`, `GjuSegmentedControl` |
| Data tables | Table, Table hooks, Pagination | `GjuTable`, `GjuPagination` |
| Cards/stat panels | Card, Clickable Card | `GjuCard`, `GjuStatCard` |
| Empty states | Empty State | `GjuEmptyState` |
| Status display | Badge, Status Dot | `GjuStatusBadge` |
| Confirmation | Alert Dialog, Dialog | `GjuConfirmDialog` |
| Toasts | Toast, useToast | `GjuToastProvider` |
| Accessibility helpers | VisuallyHidden | `GjuVisuallyHidden` |

### Styling Rules

- Use Astryx component structure first.
- Use GJU CSS variables for brand color, spacing, radius, and motion.
- Keep cards at restrained radii consistent with current app requirements.
- Prefer icons for compact tool actions.
- Keep destructive actions visually consistent across Admin screens.
- Avoid one-off page-level CSS unless it represents a reusable pattern.

## Motion Design

iOS app motion is WebView motion, not SwiftUI-native motion. It must therefore be efficient and predictable in WKWebView.

### Motion Principles

- Use `transform` and `opacity` for animated elements.
- Avoid animating layout-heavy properties such as width, height, top, left, and box-shadow where possible.
- Keep durations short for operational screens.
- Preserve user scroll position when toasts or data refreshes occur.
- Respect `prefers-reduced-motion`.
- Keep focus management correct when dialogs open/close.

### Motion Tokens

```css
--motion-duration-instant: 80ms;
--motion-duration-fast: 120ms;
--motion-duration-normal: 180ms;
--motion-duration-panel: 240ms;
--motion-ease-standard: cubic-bezier(0.2, 0, 0, 1);
--motion-ease-emphasized: cubic-bezier(0.2, 0, 0, 1);
```

### Required Motion Patterns

- Screen entry: subtle opacity + 6px translateY, max 180ms.
- Cards: press state uses scale `0.99` and background/border tone shift.
- Tabs: active indicator moves with transform, not layout reflow.
- Dialogs: backdrop fade + panel scale/translate, max 240ms.
- Toasts: slide/fade in, no scroll jump.
- Bottom sheets: translateY entry with scroll lock.
- Table updates: avoid row-by-row animation for large lists; use skeleton/loading state instead.

### Astryx Motion Usage

Use Astryx `useEntryAnimation` where it cleanly maps to entry/exit behavior. If a component already provides stable built-in motion, wrap it rather than reimplementing motion by hand.

## iOS Capacitor Requirements

React/Astryx must work inside WKWebView through Capacitor.

Requirements:

- The app continues to build into `dist`.
- `capacitor.config.json` keeps `webDir: "dist"`.
- Safe-area variables must be applied to headers, mobile nav, sheets, and dialogs.
- Touch targets must be at least 40px in compact areas and preferably 44px where space allows.
- Scroll containers must use native momentum scrolling where needed.
- Reduced-motion mode must avoid disruptive transitions.
- Native notification and watch bridge behavior must remain unchanged.
- Haptics are excluded from the first React/Astryx milestone.

## Migration Phases

### Phase 0: Baseline And Safety

- Capture current release checks.
- Keep current production deployment working.
- Add a `REACT_ADMIN_ENABLED` runtime guard for React Admin so the legacy Admin renderer can remain available during QA.
- Define visual QA baseline for Admin dashboard, users, equipment, and logs.

### Phase 1: React Build Foundation

- Add React, React DOM, TypeScript, and a build step that outputs to `dist`.
- Preserve current Pages and Capacitor deployment contracts.
- Add a minimal React root that can render an Admin-only shell while legacy screens remain available.
- Add tests that prove:
  - build writes `dist`
  - cache version is consistent
  - Capacitor `webDir` still points at `dist`
  - same-origin API proxy checks still pass

### Phase 2: Astryx Wrapper Layer

- Install `@astryxdesign/core`.
- Create `src/react/design-system`.
- Implement wrappers for button, icon button, card, tabs, table, dialog, toast, empty state, status badge, and shell.
- Add story-like test/demo fixtures or render tests for wrapper states:
  - default
  - disabled
  - loading
  - destructive
  - icon-only
  - selected/current

### Phase 3: Motion Contract

- Add motion tokens and reduced-motion handling.
- Add `motion.ts` helpers for common class names or component props.
- Apply motion to shell entry, dialog, toast, tabs, and card press states.
- Verify in browser and iOS WebView that animations are smooth and do not trigger scroll jumps.

### Phase 4: Admin Shell React Conversion

- Convert Admin shell, sidebar, mobile header, mobile nav, and top actions.
- Keep current Admin data loading behavior.
- Preserve manual refresh, account, logout, and scroll preservation.
- Verify desktop and mobile nav do not overlap content.

### Phase 5: Admin Critical Surfaces

Convert these first:

- Dashboard stat/action cards.
- Student approval list actions.
- Equipment management list actions.
- Logs/session table.
- Shared confirm dialog and toast flows.

These are the right first screens because they contain the most visible design consistency issues and repeated action-button patterns.

### Phase 6: Stabilization And Handoff

- Run full release checks.
- Run browser QA for desktop and mobile.
- Run Capacitor iOS build/smoke check before store update.
- Document which screens are React-owned and which remain legacy-owned.
- Defer student reservation React conversion to a separate spec/plan after Admin React is stable.

## Testing Strategy

### Automated Checks

Required:

```bash
npm run check
npm run check:js
npm run test:admin-ui
npm run test:equipment-ui
npm run test:storage
npm run test:security
npm run release:check
npm run pages:check
```

React migration tasks should add targeted tests for:

- wrapper component output and accessibility labels
- icon-only destructive actions
- tab/selected state behavior
- dialog focus and close behavior
- toast rendering without scroll reset
- Admin API action success/error states

### Browser QA

Required flows:

- Admin dashboard loads without framework overlay.
- Admin users list actions render correctly on desktop and mobile.
- Admin equipment list actions render correctly on desktop and mobile.
- Admin logs/session revoke action renders as icon-only and does not wrap.
- Toast and dialog animations complete without scroll jump.
- Console has no relevant warnings/errors.

### iOS QA

Required before App Store update:

- `npm run native:sync`
- iOS build/archive smoke check.
- Manual WebView smoke:
  - login
  - admin nav
  - student approval scroll
  - equipment table/list scroll
  - toast
  - dialog
  - bottom nav safe-area

## Rollback Strategy

- Keep legacy renderer available until converted screens pass QA.
- Convert Admin surfaces behind clear ownership boundaries.
- Keep backend and API unchanged so a frontend rollback does not require data migration.
- Keep previous Cloudflare Pages deployment available for immediate rollback.
- Do not delete legacy view files during the first React milestone.
- Do not remove existing tests until equivalent React tests exist.

## Acceptance Criteria

The first React/Astryx milestone is complete when:

- Admin shell is React-owned.
- Dashboard, student approval actions, equipment actions, and logs/session table are React-owned or wrapped through the React shell.
- Astryx is used only through local GJU wrappers in feature screens.
- Destructive actions, icon-only actions, cards, tabs, tables, dialogs, and toasts share one visual system.
- Motion tokens are applied and reduced-motion is respected.
- Desktop and mobile browser QA pass.
- iOS Capacitor smoke testing passes.
- `npm run release:check` passes.
- Cloudflare Pages deploy check passes on `https://gjureserve.co.kr`.

## Risks

- Mixed legacy/React rendering can create duplicated state if ownership boundaries are not enforced.
- Astryx package size can increase the bundle if imports are not direct and tree-shakeable.
- Admin tables may need virtualization or pagination discipline if React renders too many rows at once.
- WebView animation can feel worse if layout properties are animated.
- CSS collisions can happen while old `public/styles.css` and new component styles coexist.

## Risk Controls

- Use a strict wrapper layer instead of direct Astryx imports in feature code.
- Prefer direct component imports from Astryx paths.
- Keep large lists paginated and avoid per-row animation.
- Add a CSS namespace or root class for React-owned surfaces.
- Keep legacy files until a screen is fully replaced and tested.
- Run browser and iOS QA before each production deployment.

## Fixed Design Decisions

- Use TypeScript for new React code.
- Use React context plus small reducer/action modules for the first Admin milestone.
- Do not add Framer Motion in the first milestone.
- Use Astryx built-in motion and CSS transition tokens first.
- Keep student/auth legacy screens active until a separate student React migration spec is approved.
