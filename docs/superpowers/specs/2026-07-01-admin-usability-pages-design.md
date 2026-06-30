# 2026-07-01 Admin Usability And Cloudflare Pages Design

## Context

The first App Review cycle is complete and the current production setup is working:

- Dothome serves the static frontend.
- Dothome `/api/*` uses `public/api/index.php` as a proxy.
- Cloudflare Worker handles API logic and production data.

The next update should improve day-to-day admin use and prepare a move where Cloudflare Pages also serves the frontend. This update must not reset or migrate production data destructively.

Cloudflare references checked on 2026-07-01:

- Cloudflare Pages can deploy prebuilt static assets through Direct Upload.
- Cloudflare Pages Functions run on the Workers runtime and can handle full-stack routes.
- Wrangler configuration can be used as the source of truth for Pages Functions settings.

## Goals

1. Admin users can pull down at the top of any Admin tab to refresh current data.
2. Admin action buttons no longer cause the screen to jump to the top when a toast appears or disappears.
3. Admin can bulk-delete operational records safely:
   - reservations
   - reports
   - extracurricular lectures
   - notices
4. Reservations, reports, and extracurricular lectures can be filtered by academic semester, such as `2026년 1학기` and `2026년 2학기`.
5. The repository becomes ready for Cloudflare Pages frontend hosting without forcing the production DNS cutover in the same code change.

## Non-Goals

- Do not delete student/admin user accounts in bulk. Keep user deletion individual only.
- Do not bulk-delete equipment inventory in this update. Equipment already has selected-item removal and inventory-wide deletion is more dangerous than useful for normal operations.
- Do not replace the Cloudflare Worker production database in this update.
- Do not deploy to Cloudflare Pages automatically during implementation.
- Do not remove Dothome upload support until Pages production traffic has been verified separately.

## Current Architecture Notes

- `public/js/renderer.js` rewrites the full app in `render()`.
- `toast(message)` calls `render()` when the toast appears and again when it disappears. That can reset `.admin-main` scroll position.
- Admin click actions live in `public/js/events/admin-flow.js`.
- Admin form submissions live in `public/js/events/forms.js`.
- Existing scroll preservation lives in `public/js/events/shared.js` as `renderPreservingScroll()`.
- Admin server-side paginated lists live in `core/admin-lists.mjs`.
- Admin list loading paths live in `public/js/data.js`.

## Design

### 1. Admin Pull-To-Refresh

Add a touch/pointer pull-to-refresh interaction scoped to `.admin-main`.

Behavior:

- Enabled for every Admin view: dashboard, users, reservations, equipment, reports, lectures, notices, logs, settings, and account.
- Starts only when `.admin-main.scrollTop <= 0`.
- Ignores drags that start inside `input`, `textarea`, `select`, `button`, `a`, or forms.
- Uses a visible compact indicator at the top of the Admin content:
  - `당겨서 새로고침`
  - `놓으면 새로고침`
  - `새로고침 중`
- Triggers refresh after a vertical pull threshold of about 72 px.
- Calls a shared admin refresh helper that reloads `loadBootstrap()` and `loadAdminData()`, then renders without unwanted scroll jumps.
- Shows a toast such as `최신 데이터를 불러왔습니다.` after a successful pull refresh.
- If refresh fails, keep the current screen and show the error message in a toast.

Implementation shape:

- Add Admin refresh state to `public/js/state.js`.
- Add a small `admin-refresh` event module or place the handler in `public/js/events/admin-flow.js` if it stays small.
- Add CSS for the refresh indicator in `public/styles.css`.
- Keep the interaction mobile-first, but it should also work with pointer events in a desktop browser for testing.

### 2. Scroll-Safe Toast And Admin Action Refresh

Change toast rendering so showing or hiding a toast does not reset the user's scroll position.

Behavior:

- Toast appearance preserves current page and nested scroll positions.
- Toast disappearance also preserves current page and nested scroll positions.
- Admin action handlers that reload data use one shared helper instead of manually calling `loadAdminData(); render();`.
- Actions in these Admin tabs must preserve scroll after completion:
  - 학생 승인
  - 예약 관리
  - 기자재 관리
  - 보고서
  - 비교과 특강
  - 공지사항

Implementation shape:

- Add a scroll-safe render path for toast updates. The simplest acceptable version is:
  - `toast(message, { preserveScroll: true })`
  - internally capture scroll state before rendering and restore after both show and hide
- For admin actions, default to `preserveScroll: true`.
- Add a helper such as `refreshAdminDataPreservingScroll({ includeBootstrap = false })`.
- Replace direct `await loadAdminData(); render();` or async `.then(() => render())` in Admin action paths with the helper.

The bug this fixes is not only the data reload. It is also the toast timeout render, because the timeout currently rebuilds the full app.

### 3. Safe Bulk Delete

Bulk deletion defaults to deleting the current server-side filtered result, not only the currently loaded page and not the whole dataset.

#### Common Rules

- Admin auth is required.
- Deletion endpoints must never be callable by students.
- All bulk deletes must write audit log entries with:
  - actor admin id
  - action name
  - scope: `filtered` or `all`
  - filters used
  - deleted count
  - linked count where relevant
- UI must show a confirmation dialog before any bulk delete.
- `scope=filtered` confirmation includes the visible filter label and estimated count.
- `scope=all` requires typing the exact phrase `전체 삭제`.
- After deletion, reload data and preserve scroll.
- If the current page becomes empty, clamp page number to a valid page.

#### Reservations

Add bulk delete for reservations.

Scopes:

- Current filtered result:
  - reservation type tab
  - equipment status filter
  - semester filter
  - search text
- Full reservation dataset:
  - requires exact typed confirmation `전체 삭제`

Data effects:

- Delete matching reservations.
- Delete linked reports for deleted reservations.
- Do not delete users.
- Do not delete equipment items.
- Return `{ deletedReservations, deletedReports }`.

#### Reports

Add bulk delete for reports.

Scopes:

- Current filtered result:
  - semester filter
  - search text
- Full report dataset:
  - requires exact typed confirmation `전체 삭제`

Data effects:

- Delete matching reports.
- For linked studio reservations that remain, reset `reservation.fields.reportStatus` from `submitted` to `required`.
- Return `{ deletedReports, resetReservations }`.

#### Extracurricular Lectures

Add bulk delete for lectures.

Scopes:

- Current filtered result:
  - semester filter
  - search text
- Full lecture dataset:
  - requires exact typed confirmation `전체 삭제`

Data effects:

- Delete matching lectures.
- Delete linked lecture applications.
- Return `{ deletedLectures, deletedApplications }`.

#### Notices

Add bulk delete for notices.

Scopes:

- Current filtered result:
  - search text
- Full notice dataset:
  - requires exact typed confirmation `전체 삭제`

Data effects:

- Delete matching notices.
- Return `{ deletedNotices }`.

### 4. Semester Filtering

Add academic semester filters to:

- 예약 관리
- 보고서
- 비교과 특강

Semester mapping:

- `YYYY년 1학기`: `YYYY-03-01` through `YYYY-08-31`
- `YYYY년 2학기`: `YYYY-09-01` through `YYYY+1-02-28` or `YYYY+1-02-29`
- January and February belong to the previous year's second semester.

Server behavior:

- Add a `semester` query parameter to admin list endpoints.
- Reservations use `reservation.fields.reservedDate`.
- Reports use linked reservation date first, then `submittedAt` date as fallback.
- Lectures use `lecture.lectureDate`.
- List responses should include available semester options derived from the full source collection before applying the selected semester filter.

Frontend behavior:

- Add state keys:
  - `adminReservationSemesterFilter`
  - `adminReportSemesterFilter`
  - `adminLectureSemesterFilter`
- Default value is `all`.
- Changing semester resets that tab's pagination to page 1.
- The selected semester is included in server query params.
- The filter UI should use existing tab/select visual patterns and remain compact on mobile.

### 5. Cloudflare Pages Frontend Preparation

Prepare Pages hosting without forcing the DNS cutover in this update.

Phase for this update:

- Keep the current Cloudflare Worker API and database as source of truth.
- Keep Dothome upload scripts for rollback and fallback.
- Add Pages-ready build/deploy configuration, but do not deploy automatically.
- Prefer same-origin `/api/*` for the frontend once hosted on Pages.
- Use a Pages Function proxy for `/api/*` to forward to the existing Worker during the transition.
- Keep a fallback option where a Pages-specific `config.js` points directly to the Worker API if the proxy is not enabled.

Expected scripts:

- `pages:build`: build the static frontend into `dist/`.
- `pages:preview`: preview Pages-compatible output locally if Wrangler supports it in this project shape.
- `pages:deploy`: explicit manual deploy command, not run automatically during implementation.
- `pages:check`: read-only or local verification that confirms Pages assets and API routing assumptions.

Deployment sequence after implementation, not during this coding pass:

1. Deploy Pages preview.
2. Verify app load, Admin login, API calls, and account deletion page.
3. Verify `/api/bootstrap` through Pages.
4. Move DNS/custom domain only after preview passes.
5. Keep Dothome static deploy available until the first Pages production release is stable.

## API Design

Add focused admin endpoints instead of overloading unrelated maintenance cleanup:

```text
DELETE /api/admin/reservations/bulk
DELETE /api/admin/reports/bulk
DELETE /api/admin/lectures/bulk
DELETE /api/admin/notices/bulk
```

Request body shape:

```json
{
  "scope": "filtered",
  "filters": {
    "q": "",
    "type": "equipment",
    "status": "checked_out",
    "semester": "2026-S1"
  },
  "confirmText": ""
}
```

For full dataset deletion:

```json
{
  "scope": "all",
  "filters": {},
  "confirmText": "전체 삭제"
}
```

Server validation:

- `scope` must be `filtered` or `all`.
- `scope=all` requires `confirmText === "전체 삭제"`.
- `scope=filtered` must use the same filter semantics as the matching GET endpoint.
- Unknown filter keys are ignored only if harmless; otherwise reject with a 400 to prevent accidental wide deletes.

## Testing Strategy

Use TDD for behavior changes.

Backend tests:

- Bulk deleting filtered reservations deletes linked reports and leaves users/equipment.
- Full reservation deletion requires `전체 삭제`.
- Deleting reports resets linked studio reservations to `reportStatus: "required"`.
- Semester filters classify January/February into the previous year's second semester.
- Semester filtering works for reservations, reports, and lectures.
- Bulk lecture deletion removes linked applications.
- Bulk notice deletion respects search filter.

Frontend source/render tests:

- Admin views render semester filters for reservations, reports, and lectures.
- Bulk delete buttons exist only for the intended tabs.
- Student approval/user bulk delete is not present.
- Toast implementation preserves scroll on show/hide.
- Admin action refresh paths use scroll-preserving refresh helpers.
- Pull-to-refresh handlers avoid form controls and call admin refresh.

Rendered browser QA:

- Admin login.
- Navigate to each Admin tab.
- Pull down at top and confirm refresh indicator and no console errors.
- Scroll inside reservations/reports, trigger an action, wait for toast to disappear, confirm scroll position does not jump to top.
- Apply semester filter to reservations/reports/lectures.
- Exercise filtered bulk delete in a local/dev dataset only.

## Risks And Mitigations

- Bulk delete is destructive. Mitigate with scoped default, exact full-delete phrase, audit logs, and tests.
- Report deletion can leave reservation report status inconsistent. Mitigate by resetting linked studio reservations to `required`.
- Toast scroll preservation can affect non-admin flows. Mitigate by preserving scroll for toast rendering globally; this is safer than resetting user position.
- Pull-to-refresh can conflict with form inputs. Mitigate by ignoring form/control starts.
- Pages transition can break API same-origin assumptions. Mitigate by adding preview/check scripts before DNS cutover.

## Acceptance Criteria

- `npm run release:check` passes.
- Existing security and storage smoke tests pass.
- New bulk-delete and semester tests pass.
- Browser QA confirms no Admin scroll jump after toast disappearance.
- Browser QA confirms pull-to-refresh works on Admin views.
- No production deployment is performed by implementation unless explicitly requested.
- Cloudflare Pages preparation is committed but Dothome rollback path remains available.
