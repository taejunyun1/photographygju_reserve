# Task 4 Report: Scroll-Safe Toast And Admin Action Refresh

## Summary
- Implemented scroll-safe admin toast rendering with `toast(message, options = {})` and `options.preserveScroll`.
- Added shared Admin refresh helper `refreshAdminDataPreservingScroll({ includeBootstrap?, includeMe? })`.
- Moved scroll capture/restore primitives into `public/js/events/scroll-state.js` to avoid a `renderer.js` <-> `shared.js` circular dependency, then re-exported them from `shared.js`.
- Replaced Admin action refresh paths in `public/js/events/admin-flow.js` and `public/js/events/forms.js` with awaited scroll-preserving helper calls and Admin toasts that preserve scroll.

## TDD Evidence
### RED
1. Added the required source assertions to `scripts/admin-dashboard-ux-test.mjs`:
   - `toast must accept options`
   - `toast must support preserveScroll`
   - `Admin data refreshes must use the scroll-preserving helper`
   - `Admin async refresh paths must not use bare render in promise callbacks`
2. Ran:

```bash
npm run test:admin-ui
```

3. Observed expected failure:
   - `AssertionError [ERR_ASSERTION]: toast must accept options`

### GREEN
Ran:

```bash
npm run test:admin-ui && npm run check:js
```

Observed:
- `Admin dashboard UX checks passed.`
- `JavaScript syntax checks passed (38 files).`

## Commands Run
```bash
npm run test:admin-ui
npm run test:admin-ui
npm run check:js
npm run test:admin-ui
npm run check:js
git status --short
git diff --stat
```

## Changed Files
- `public/js/renderer.js`
- `public/js/events/shared.js`
- `public/js/events/admin-flow.js`
- `public/js/events/forms.js`
- `scripts/admin-dashboard-ux-test.mjs`
- `public/js/events/scroll-state.js` (new helper module to avoid circular imports)

## Self-Review
- Preserved the existing JS import cache query `?v=20260627-admin-lecture-nav`.
- Kept `shared.js` as the public source for `captureScrollState` / `restoreScrollState` via re-export.
- Avoided the `renderer.js` -> `shared.js` import cycle by extracting the scroll snapshot implementation into a focused helper module.
- Converted Admin mutation flows to awaited refresh helpers instead of bare `render()` callbacks after async refreshes.
- Applied `{ preserveScroll: true }` to Admin action toasts that run inside the Admin management flows updated by this task.

## Concerns
- The source-aggregation test originally did not include the new helper module, so I expanded the test input set to keep the pre-existing scroll-selector assertions meaningful after the extraction.

## Follow-up Fix Notes
- Updated the remaining required admin completion toasts in `public/js/events/admin-flow.js` so password reset and 기자재 management success paths now call `toast(..., { preserveScroll: true })`.
- Updated the shared admin/action error path in `public/js/events/admin-flow.js` and `public/js/events/forms.js` so error toasts are scroll-safe.
- Strengthened `scripts/admin-dashboard-ux-test.mjs` with exact source assertions for the previously missed required admin toast paths, including negative checks for the plain-toast forms.

## Verification
Ran:

```bash
npm run test:admin-ui && npm run check:js
```

Result:
- Passed: `Admin dashboard UX checks passed.`
- Passed: `JavaScript syntax checks passed (38 files).`
