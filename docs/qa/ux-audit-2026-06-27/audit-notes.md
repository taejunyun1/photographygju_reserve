# GJU-reserve UX Audit

Date: 2026-06-27

## Scope

- Product surface: GJU-reserve local dev app at `http://localhost:5173`
- Audit mode: combined UX, design, and screenshot-based accessibility review
- Capture viewports: mobile 390px wide student flow, desktop 1280px admin flow
- Destination: `docs/qa/ux-audit-2026-06-27/`
- Note: Browser full-page screenshots intermittently saved as blank images, so accepted evidence uses viewport screenshots after visual inspection.

## Evidence

- `01-mobile-login.png`: mobile login entry
- `02-mobile-student-home.png`: approved student home
- `03-mobile-reservation-entry.png`: equipment reservation date entry
- `03b-mobile-reservation-date-selected.png`: equipment reservation period/time step after date selection
- `04-mobile-my-reservations.png`: empty my reservations state
- `05-desktop-admin-dashboard.png`: admin dashboard
- `05b-desktop-admin-reservations.png`: admin reservation management

## Five-Step UX Health

1. Entry and login: Healthy. The brand, login/signup switch, labels, remember-login option, and primary CTA are clear on mobile.
2. Student home: Mostly healthy. Notices and reservation shortcuts are immediately available, and bottom navigation is understandable.
3. Reservation creation: Needs one pre-release fix. The stepper is clear, but after selecting a date the default rental and return times can both be `10:15`, which looks like a zero-duration reservation.
4. Follow-up use: Needs improvement. The empty `내 예약` state is clean but passive; it gives no direct route back to creating a reservation.
5. Admin operation: Healthy for desktop operations. Dashboard counters, filters, search, and reservation actions are dense but task-oriented. No page-level horizontal overflow was detected at 1280px.

## Strengths

- The mobile student flow follows the design system: large touch targets, clear blue primary CTAs, bottom tab navigation, and readable card hierarchy.
- Reservation starts with a calendar and then moves into a staged form. This reduces cognitive load compared with a long one-page form.
- Status is not color-only in the captured screens; badges include Korean labels such as `조교 승인`, `자동`, `대여완료`, and `반납완료`.
- Admin screens are appropriately utilitarian. The dashboard prioritizes daily work queues and the reservation page keeps search, type filters, and status filters visible.
- Browser console checks during captured flows reported no relevant errors or warnings.

## Fix List

### P1 - Fix before release

1. Prevent same-time equipment rental/return defaults.
   - Evidence: `03b-mobile-reservation-date-selected.png`
   - Current behavior: after selecting `2026-06-28`, both `대여 시간` and `반납 시간` default to `10:15`.
   - Recommended fix: default return time to the next valid slot, or keep return time empty until the user selects it. Disable `기자재 선택` until return time is later than rental time.

2. Add an action to the empty `내 예약` state.
   - Evidence: `04-mobile-my-reservations.png`
   - Current behavior: only `예약 내역이 없습니다.` is shown.
   - Recommended fix: add a primary or default CTA such as `예약하러 가기`, plus a short sentence explaining that upcoming reservations will appear here.

### P2 - Strongly recommended

3. Make the student home first viewport slightly more intentional.
   - Evidence: `02-mobile-student-home.png`
   - Current behavior: notices and reservation shortcuts are useful, but `다음 예약` starts behind the bottom navigation area.
   - Recommended fix: when there is no upcoming reservation, either hide the section from the first viewport or show a compact empty state above the fold.

4. Add confirmation or disabled-current-state handling for admin reservation status actions.
   - Evidence: `05b-desktop-admin-reservations.png`
   - Current behavior: the current status action `대여완료` appears next to state-changing actions.
   - Recommended fix: disable the button for the current state and keep only valid next actions prominent. Use confirmation only for destructive actions like `대여취소`.

5. Improve admin dashboard clipping resilience.
   - Evidence: `05-desktop-admin-dashboard.png`
   - Current behavior: DOM metrics showed no document-level horizontal overflow at 1280px, but the captured image crops the far-right controls/cards because the Browser screenshot output width is narrower than the measured viewport.
   - Recommended fix: manually verify at 1024px, 1280px, and 1440px in a real browser before release. If any crop appears, reduce top action card minimum widths or allow the action grid to wrap sooner.

## Accessibility Risks

- Screenshot and DOM checks confirm visible form labels, button names, and status text, but this is not a full screen-reader audit.
- Calendar date buttons expose numeric names, but selected, disabled, today, my reservation, other reservation, and blocked states need explicit keyboard and screen-reader verification.
- The mobile empty state has low interaction guidance. This is a UX issue and also an accessibility recovery issue because users get less directional help after landing there.
- Admin action buttons are accessible by text, but current-state and next-state buttons should communicate disabled/current state programmatically.

## Verification Evidence

- Browser session loaded `http://localhost:5173`.
- Mobile login, student home, reservation entry, date-selected reservation state, and empty reservations were captured at 390px wide.
- Admin dashboard and reservation management were captured after admin login at 1280px viewport.
- Console log checks during the captured flows returned 0 relevant errors/warnings.
- Desktop admin overflow metrics on dashboard/reservation pages showed `scrollWidth` equal to `innerWidth` at 1280px.

## Evidence Limits

- The review used a local dev database and temporary test student account, not production data.
- Screenshots prove visible layout and basic interaction state, but not full WCAG compliance.
- Native iOS/Android WebView safe-area behavior still needs real device or simulator QA.
