# Design QA — Mobile Reservation Card

## Comparison Target

- Source visual truth:
  - `/Users/taejun-yun/Downloads/KakaoTalk_Photo_2026-07-14-16-56-32 003.jpeg` (`내 예약`, primary comparison)
  - `/Users/taejun-yun/Downloads/KakaoTalk_Photo_2026-07-14-16-56-32 001.jpeg` (Home shared-card reference)
- Implementation screenshots:
  - `docs/qa/mobile-reservation-card-2026-07-14/mine-390-viewport.png`
  - `docs/qa/mobile-reservation-card-2026-07-14/mine-430-viewport.png`
  - `docs/qa/mobile-reservation-card-2026-07-14/home-390-viewport.png`
- Side-by-side evidence:
  - `docs/qa/mobile-reservation-card-2026-07-14/comparison-mine-390.png`
  - `docs/qa/mobile-reservation-card-2026-07-14/comparison-mine-card-focused.png`
  - `docs/qa/mobile-reservation-card-2026-07-14/comparison-mine-filter-focused.png`
- Viewports: `390×844`, `430×932`
- State: approved student; one approval-pending equipment reservation on `2026-07-27`, five selected equipment items, Home and Mine views.

## Full-view Comparison Evidence

The 390px Mine comparison places the TestFlight source and current browser render in one image. The source loses the last filter categories to an internal horizontal row and places the cancel action on a separate left-aligned row. The implementation shows all six filters in a 3×2 grid, keeps the action at the card's top-right, and reduces the reservation card from a large sparse block to a compact schedule summary without changing the surrounding student surface or bottom navigation.

Measured implementation values:

- 390px document/body scroll width: `390px / 390px`
- 430px document/body scroll width: `430px / 430px`
- 390px filter client/scroll width: `311px / 311px`
- 430px filter client/scroll width: `347px / 347px`
- Mobile filter tracks: `97px × 3` at 390px, `109px × 3` at 430px
- Cancel button: `44×44px`, aligned to the card content right edge
- Card title: `17px`, computed margin `0px`
- 390px shared card size: `351×209.68px`

## Focused Comparison Evidence

The focused card comparison makes the typography and alignment readable at native scale. The original second-row X action and large blank gap are gone. The first row now reads type/status at left and cancel at right; the 17px title follows immediately; date and time use separate labelled cells; period and equipment codes finish the card as a 13px summary. Five codes reduce to the first two plus `외 3개`.

The focused filter comparison shows that the clipped single row is replaced by six complete, equal-width tabs. Existing active blue, neutral surface, border, and type treatments remain consistent with the source app.

## Required Fidelity Surfaces

- Fonts and typography: passed. The existing Korean system UI sans stack and weights are preserved. Title size is intentionally reduced to 17px; date/time labels are 11px and values are 14px bold. Wrapping is contained and no truncation hides required text.
- Spacing and layout rhythm: passed. Badge and action share one 44px header row, default `h2` margins are removed, schedule cells use equal tracks, and the six filters have stable 6px gaps across both target widths.
- Colors and visual tokens: passed. Existing white surfaces, blue type badge, amber approval badge, blue active tab, muted text, borders, radius, and shadow tokens are reused. No unrelated palette change was introduced.
- Image quality and asset fidelity: passed. This change adds no raster, generated, decorative, or replacement assets. Existing application icons and the glass navigation remain unchanged and sharp.
- Copy and content: passed. `날짜` and `시간` are explicit labels, Korean weekday notation is included, and equipment content is summarized as requested without losing the total remaining count.

## Interaction and Accessibility

- Mine navigation button: passed.
- Category tab click selection: passed (`aria-selected="true"`).
- Arrow-key tab movement: passed; selection moved from `기자재` to `스튜디오`.
- Cancel button name and touch size: passed (`예약 취소`, `44×44px`).
- Axe WCAG 2 A/AA serious/critical violations in the modified Mine state: none.
- Browser console errors during Home/Mine and filter interactions: none.

## Findings

- No actionable P0, P1, or P2 differences remain.
- P3 follow-up: none required for this scope.

## Comparison History

### Initial source state

- P1: Mine filters had `scrollWidth 426px` inside an approximately `311px` container, hiding the end of `출력실` and all of `특강` at the initial position.
- P1: Reservation cancel action wrapped below the badges on the left; the browser-default heading margin and shared card gap created a large empty region.
- P2: Date, time, period, and five equipment codes were flattened into one paragraph, weakening scanability and increasing wrapping.

### Fixes made

- Replaced the phone-only filter row with a 3×2 equal-width grid while preserving tab semantics and keyboard behavior.
- Added a dedicated reservation card header layout with a fixed right-side 44px cancel control.
- Reduced the title to 17px with zero margin.
- Added labelled date/time cells and a two-code `외 N개` equipment summary.

### Post-fix evidence

- The 390px and 430px implementation captures show complete filters and contained cards.
- Computed document/body and filter scroll widths equal their client widths.
- Focused side-by-side comparisons show corrected action placement, reduced whitespace, and improved metadata hierarchy.
- Automated mobile layout, overflow, keyboard, and Axe checks pass.

final result: passed
