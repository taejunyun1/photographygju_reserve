# GJU-reserve UX / Data QA Audit

Date: 2026-06-24

## Evidence

- `01-login-mobile.png`: mobile login
- `02-student-home-mobile.png`: mobile student home
- `03-student-print-flow-mobile.png`: mobile print reservation entry
- `04-admin-dashboard-desktop.png`: desktop admin dashboard
- `05-admin-reservations-desktop.png`: desktop admin reservations
- `capture-metrics.json`, `print-capture-metrics.json`, `admin-capture-metrics.json`: CDP checks

## Flow Health

1. Mobile login: Healthy. Primary action is clear, form fields are large, and touch targets are suitable for mobile.
2. Student home: Mostly healthy. Reservation shortcuts, notices, and bottom navigation follow the design system. The home screen can feel dense when notices are present, but content does not overflow.
3. Student print reservation entry: Healthy. Calendar-first flow matches the design guide, status dots are paired with labels, and no horizontal overflow was detected at 390px width.
4. Admin dashboard: Healthy. The dashboard is quiet and task-oriented, with clear operational counters and sidebar navigation.
5. Admin reservations: Healthy after the latest adjustment. The screen states the current loaded count and total count, and multi-page result sets expose explicit previous/next pagination controls.

## UX And Design Findings

- The current visual language is consistent with `docs/frontend-design-system.md`: blue primary action, neutral surfaces, status colors, rounded app-like mobile cards, and dense admin layouts.
- Mobile student screens use bottom navigation and large card targets correctly. The captured 390px screens showed no horizontal overflow.
- Admin screens are appropriately utilitarian. Cards are used for individual records, not page-level decoration.
- The most important remaining UX gap is not visual polish but large-list workflow depth: the API supports pagination and filters, and the admin UI can now move through result pages. Future work should add richer date-range filters in the visible UI for very old records.

## Accessibility Risks

- Screenshot checks confirm visible labels for core login and reservation fields, but this audit did not run a full screen-reader pass.
- Calendar days are large enough visually, but keyboard traversal and active-day announcement still need explicit browser accessibility testing.
- Status is not color-only in the captured screens: badges and legends include text labels.

## Admin / Student Data Communication

- Local HTTP QA passed for: admin login, student signup, admin approval, student login, student reservation creation, student `GET /api/reservations/my`, admin paginated `GET /api/admin/reservations`, and admin paginated `GET /api/admin/users`.
- Automated smoke coverage also passed for paginated admin users, reservations, and reports while preserving legacy array responses for non-query admin endpoints.
- The data flow is suitable for the current app shape because both local server and Worker route through the same `core.mjs` handlers.

## Database Suitability For 4 Years

- The previous production risk was storing the whole app DB as one Durable Object JSON blob. This branch moves Worker persistence into SQL tables with indexes for users, sessions, reservations, reports, lectures, notices, warnings, logs, equipment, and imports.
- This is a suitable baseline for four academic years of departmental usage if traffic remains in the expected small-team reservation range.
- Remaining scaling caveat: writes still save normalized app state back through collection tables rather than using fully query-native route handlers. The store now skips unchanged collections on save, which reduces write amplification. A future phase should move high-volume admin list reads/writes to SQL-native queries.

## Verification

- `npm run check:js`
- `npm run test:security`
- `npm run release:check`
- `git diff --check`
- Local HTTP admin/student round-trip QA
- Chrome CDP mobile and desktop screenshots
