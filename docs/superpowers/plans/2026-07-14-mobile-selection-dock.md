# Mobile Selection Dock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mobile equipment selection block with a compact expandable dock, render a rounded glass bottom navigation with smaller visible icons, and make booking step numbers circular.

**Architecture:** Keep equipment selection data in the existing student state and add only local open/closed UI state in a focused `EquipmentSelectionSurface` component. Preserve the desktop inline manifest while rendering a mobile-only fixed dock and non-modal expandable region. Fix the lecture icon at the shared `GjuIcon` source and isolate mobile visual contracts in `student.css`.

**Tech Stack:** React 19, TypeScript 6, CSS, Astryx-backed GJU design system, Playwright 1.61, esbuild.

## Global Constraints

- Do not change reservation data, APIs, step order, submission rules, menu items, or menu order.
- Do not add dependencies or global state.
- The selection dock applies at `max-width: 700px`; the glass navigation applies wherever AppShell renders the mobile bottom navigation.
- The expanded selection surface must not exceed `45dvh`.
- Summary text is 13px, equipment names are 14px/700, and equipment codes are 12px.
- Navigation icons are 18×18px inside targets of at least 48×48px.
- Booking markers are fixed 24×24px circles.
- Mobile viewport coverage is 390×844 and 430×932; tablet 768px must retain overflow safety.
- Preserve `aria-label`, `title`, `aria-current`, `aria-expanded`, `aria-controls`, keyboard focus, Escape closing, and reduced-motion behavior.
- Keep `.codex-audit/` untouched and do not merge or push `main`.

---

## File Map

- Create `src/react/student/components/EquipmentSelectionSurface.tsx`: render the desktop inline selection manifest and mobile collapsed/expanded selection dock.
- Modify `src/react/student/components/ReservationControls.tsx`: replace inline manifest markup with the focused selection surface and preserve existing update actions.
- Modify `src/react/design-system/icons.tsx`: render `calendar` through the same local SVG path as the other student navigation icons.
- Modify `src/react/student/student.css`: own circular step markers, selection dock/sheet, glass navigation, safe-area spacing, and mobile text density.
- Modify `tests/ui/react-student.spec.mjs`: assert real icon dimensions, circular progress markers, dock interaction, sheet bounds, content clearance, and no viewport overflow.
- Modify `scripts/equipment-reservation-ui-test.mjs`: assert the static CSS and component contracts for the dock and non-sticky flow actions.
- Modify `scripts/student-react-contract-test.mjs`: assert the local calendar SVG path and selection component integration.
- Modify versioned public/test imports: bump `20260714-mobile-overflow-r4` to `20260714-mobile-dock-r5` after UI behavior is green.

---

### Task 1: Visible lecture icon and circular booking markers

**Files:**
- Modify: `tests/ui/react-student.spec.mjs`
- Modify: `src/react/design-system/icons.tsx`
- Modify: `src/react/student/student.css`
- Modify: `scripts/student-react-contract-test.mjs`

**Interfaces:**
- Consumes: `GjuIcon({ name: GjuIconName, className?: string, title?: string })` and `.student-react-booking-progress button span`.
- Produces: a local `calendar` SVG that accepts `student-react-nav__icon`, and 24×24px step markers at mobile widths.

- [ ] **Step 1: Extend the mobile navigation test before implementation**

Inside `Student React mobile navigation is icon-only, reachable, and uses 44px targets`, return icon metrics from each button:

```js
const metrics = await button.evaluate((element) => {
  const icon = element.querySelector(".student-react-nav__icon");
  const svg = icon?.matches("svg") ? icon : icon?.querySelector("svg");
  const iconBox = icon?.getBoundingClientRect();
  const svgBox = svg?.getBoundingClientRect();
  return {
    width: element.getBoundingClientRect().width,
    height: element.getBoundingClientRect().height,
    visibleText: [...element.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE || node.nodeName === "SPAN")
      .map((node) => node.textContent || "")
      .join("")
      .trim(),
    iconFound: Boolean(icon),
    iconWidth: iconBox?.width || 0,
    iconHeight: iconBox?.height || 0,
    svgWidth: svgBox?.width || 0,
    svgHeight: svgBox?.height || 0
  };
});
expect(metrics.iconFound).toBe(true);
expect(metrics.iconWidth).toBe(18);
expect(metrics.iconHeight).toBe(18);
expect(metrics.svgWidth).toBeGreaterThan(0);
expect(metrics.svgHeight).toBeGreaterThan(0);
```

Add a separate mobile test that opens equipment selection and inspects every booking marker:

```js
test("Student React mobile booking progress uses circular 24px markers", async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(!viewport || viewport.width > 700, "phone progress contract");
  await loginReactStudent(page);
  await page.evaluate(async () => {
    const { state } = await import("/js/state.js?v=20260714-mobile-overflow-r4");
    const { render } = await import("/js/renderer.js?v=20260714-mobile-overflow-r4");
    state.view = "reserve";
    state.reservationType = "equipment";
    state.reservationFlowStep.equipment = "select";
    render();
  });
  const markers = page.locator(".student-react-booking-progress button span");
  await expect(markers).toHaveCount(4);
  for (let index = 0; index < 4; index += 1) {
    const box = await markers.nth(index).boundingBox();
    expect(box?.width).toBe(24);
    expect(box?.height).toBe(24);
  }
});
```

- [ ] **Step 2: Run the targeted tests and verify RED**

Run:

```bash
npm run test:ui -- tests/ui/react-student.spec.mjs --project=mobile-390 --grep "mobile navigation|circular 24px"
```

Expected: FAIL because the lecture icon is 0×0px, other icons are 20×20px, and markers are 22×38px.

- [ ] **Step 3: Render `calendar` locally in `GjuIcon`**

In `src/react/design-system/icons.tsx`, remove `calendar` from `AstryxGjuIconName`, declare it directly in `GjuIconName`, return local paths, and remove it from the Astryx branch:

```tsx
type AstryxGjuIconName = Extract<
  AstryxIconName,
  "chevronLeft" | "chevronRight" | "info" | "warning" | "wrench"
>;

export type GjuIconName =
  | "refresh"
  | "user"
  | "logOut"
  | "trash"
  | "check"
  | "x"
  | "camera"
  | "fileText"
  | "userPlus"
  | "edit"
  | "plus"
  | "calendar"
  | AstryxGjuIconName;

case "calendar":
  return [
    path("M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2", "calendar-1"),
    path("M8 2v4M16 2v4M3 10h18", "calendar-2")
  ];
```

The Astryx conditional must become:

```tsx
if (["chevronLeft", "chevronRight", "info", "warning", "wrench"].includes(name)) {
```

- [ ] **Step 4: Isolate marker and icon dimensions in student CSS**

Use these declarations:

```css
.student-react-booking-progress button span {
  display: inline-grid;
  place-items: center;
  width: 24px;
  min-width: 24px;
  max-width: 24px;
  height: 24px;
  min-height: 24px;
  max-height: 24px;
  aspect-ratio: 1;
  flex: 0 0 24px;
  margin-right: 6px;
  border: 1px solid currentColor;
  border-radius: 50%;
  line-height: 1;
}

.student-react-bottom-nav .student-react-nav__icon {
  width: 18px;
  height: 18px;
}
```

- [ ] **Step 5: Add static source contracts**

In `scripts/student-react-contract-test.mjs`, read `src/react/design-system/icons.tsx` and assert:

```js
assert(iconSource.includes('case "calendar":'), "student lecture navigation must render a local calendar SVG");
assert(!iconSource.includes('["calendar", "chevronLeft"'), "calendar must not use the zero-size Astryx wrapper path");
```

- [ ] **Step 6: Run Task 1 tests and verify GREEN**

Run:

```bash
npm run test:student-react
npm run test:ui -- tests/ui/react-student.spec.mjs --project=mobile-390 --grep "mobile navigation|circular 24px"
```

Expected: all selected tests PASS with five visible 18px icons and four 24px circular markers.

- [ ] **Step 7: Commit Task 1**

```bash
git add src/react/design-system/icons.tsx src/react/student/student.css tests/ui/react-student.spec.mjs scripts/student-react-contract-test.mjs
git commit -m "2026-07-14 특강 아이콘 및 예약 단계 원형 보정"
```

---

### Task 2: Responsive equipment selection surface

**Files:**
- Create: `src/react/student/components/EquipmentSelectionSurface.tsx`
- Modify: `src/react/student/components/ReservationControls.tsx`
- Modify: `src/react/student/student.css`
- Modify: `tests/ui/react-student.spec.mjs`
- Modify: `scripts/equipment-reservation-ui-test.mjs`

**Interfaces:**
- Consumes: `readonly StudentEquipment[]`, `GjuIconButton`, and `onRemove(id: string): void`.
- Produces: `EquipmentSelectionSurface({ items, onRemove })`, desktop inline manifest, and mobile `aria-expanded` dock with `#student-equipment-selection-panel`.

- [ ] **Step 1: Add the failing dock interaction test**

Add a phone-only test that logs in, selects four real fixture items, and validates the collapsed and expanded states:

```js
test("Student React mobile equipment selection uses an expandable dock above navigation", async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(!viewport || viewport.width > 700, "phone selection dock contract");
  await loginReactStudent(page);
  await page.evaluate(async () => {
    const { state } = await import("/js/state.js?v=20260714-mobile-overflow-r4");
    const { render } = await import("/js/renderer.js?v=20260714-mobile-overflow-r4");
    const selected = (state.bootstrap.equipment || [])
      .filter((item) => item.active !== false && !item.inquiryOnly && item.source !== "fantasy_lab")
      .slice(0, 4)
      .map((item) => item.id);
    state.view = "reserve";
    state.reservationType = "equipment";
    state.reservationFlowStep.equipment = "select";
    state.selectedDates.equipment = "2099-07-20";
    state.selectedEquipmentPeriod = "당일";
    state.selectedEquipmentRentalTime = "10:15";
    state.selectedEquipmentReturnTime = "17:10";
    state.selectedEquipmentItemIds = selected;
    render();
  });

  await expect(page.locator(".student-react-equipment-manifest--inline")).toBeHidden();
  const dock = page.locator(".student-react-equipment-dock");
  const toggle = dock.getByRole("button", { name: /선택 장비 4개.*목록 보기/ });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#student-equipment-selection-panel")).toHaveCount(0);

  const navBox = await page.locator(".student-react-bottom-nav").boundingBox();
  const dockBox = await dock.boundingBox();
  expect(dockBox?.bottom).toBeLessThanOrEqual((navBox?.top || 0) - 6);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const panel = page.locator("#student-equipment-selection-panel");
  await expect(panel).toBeVisible();
  await expect(panel.locator(".student-react-equipment-manifest__item")).toHaveCount(4);
  const sheetBox = await dock.boundingBox();
  expect(sheetBox?.height).toBeLessThanOrEqual((viewport?.height || 0) * 0.45 + 1);

  const accessibility = await new AxeBuilder({ page })
    .include(".student-react-equipment-dock")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(accessibility.violations.filter((violation) => (
    ["serious", "critical"].includes(violation.impact)
  ))).toEqual([]);

  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expectNoHorizontalOverflow(page);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npm run test:ui -- tests/ui/react-student.spec.mjs --project=mobile-390 --grep "expandable dock"
```

Expected: FAIL because the inline manifest is visible and the selection dock does not exist.

- [ ] **Step 3: Create `EquipmentSelectionSurface.tsx`**

Implement the focused component with one shared item renderer, an inline desktop surface, and a mobile dock:

```tsx
import React, { useEffect, useState } from "react";

import { GjuIconButton } from "../../design-system";
import type { StudentEquipment } from "../types";

type EquipmentSelectionSurfaceProps = {
  items: readonly StudentEquipment[];
  onRemove(id: string): void;
};

function SelectionItems({ items, onRemove }: EquipmentSelectionSurfaceProps) {
  if (!items.length) return <p className="muted">선택한 장비가 없습니다.</p>;
  return (
    <div className="student-react-equipment-manifest__items">
      {items.map((item) => (
        <span key={item.id} className="student-react-equipment-manifest__item">
          <span>
            <strong>{item.name || item.code || "기자재"}</strong>
            <small>{item.code || item.category || ""}</small>
          </span>
          <GjuIconButton
            label={`${item.name || item.code || "기자재"} 선택 해제`}
            icon="x"
            onClick={() => onRemove(item.id)}
          />
        </span>
      ))}
    </div>
  );
}

export function EquipmentSelectionSurface({ items, onRemove }: EquipmentSelectionSurfaceProps) {
  const [open, setOpen] = useState(false);
  const panelId = "student-equipment-selection-panel";

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <>
      <aside className="student-react-equipment-manifest student-react-equipment-manifest--inline" aria-live="polite">
        <div className="student-react-equipment-manifest__head">
          <strong>선택 목록</strong>
          <span>{items.length}개 선택</span>
        </div>
        <SelectionItems items={items} onRemove={onRemove} />
      </aside>
      <aside className={`student-react-equipment-dock${open ? " is-open" : ""}`} aria-live="polite">
        {open ? (
          <div id={panelId} className="student-react-equipment-dock__panel" role="region" aria-label="선택한 장비 목록">
            <div className="student-react-equipment-dock__head">
              <strong>선택한 장비</strong>
              <span>{items.length}개</span>
            </div>
            <SelectionItems items={items} onRemove={onRemove} />
          </div>
        ) : null}
        <button
          type="button"
          className="student-react-equipment-dock__toggle"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={`선택 장비 ${items.length}개 · ${open ? "목록 닫기" : "목록 보기"}`}
          onClick={() => setOpen((current) => !current)}
        >
          <span><strong>선택 장비</strong><b>{items.length}개</b></span>
          <span>{open ? "목록 닫기" : "목록 보기"}<i aria-hidden="true" /></span>
        </button>
      </aside>
    </>
  );
}
```

- [ ] **Step 4: Integrate with `EquipmentStep`**

Import the component and replace the current inline `<aside>` with:

```tsx
<EquipmentSelectionSurface
  items={selectedItems}
  onRemove={(id) => update(actions, "equipment", {
    equipmentItemIds: selected.filter((selectedId) => selectedId !== id)
  })}
/>
```

- [ ] **Step 5: Add responsive surface styles**

Add desktop/mobile display contracts and the mobile fixed stack:

```css
.student-react-equipment-dock {
  display: none;
}

@media (max-width: 700px) {
  .student-react-equipment-manifest--inline {
    display: none;
  }

  .student-react-equipment-dock {
    position: fixed;
    z-index: 9;
    right: max(12px, env(safe-area-inset-right));
    bottom: calc(82px + env(safe-area-inset-bottom));
    left: max(12px, env(safe-area-inset-left));
    display: grid;
    max-height: 45dvh;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.72);
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.82);
    box-shadow: 0 14px 36px rgba(20, 27, 35, 0.16);
    backdrop-filter: blur(18px) saturate(140%);
  }

  .student-react-equipment-dock__panel {
    min-height: 0;
    overflow-y: auto;
    padding: 12px;
    border-bottom: 1px solid rgba(216, 221, 228, 0.86);
    overscroll-behavior: contain;
  }

  .student-react-equipment-dock.is-open {
    grid-template-rows: minmax(0, 1fr) auto;
    height: min(45dvh, 420px);
  }

  .student-react-equipment-dock__head,
  .student-react-equipment-dock__toggle,
  .student-react-equipment-dock__toggle > span {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .student-react-equipment-dock__head {
    margin-bottom: 8px;
    font-size: 13px;
  }

  .student-react-equipment-dock__toggle {
    width: 100%;
    min-height: 50px;
    padding: 8px 14px;
    border: 0;
    color: var(--student-ink);
    background: transparent;
    font-size: 13px;
    text-align: left;
  }

  .student-react-equipment-dock__toggle b {
    color: var(--student-accent);
  }

  .student-react-equipment-dock__toggle i {
    width: 7px;
    height: 7px;
    border-right: 1.5px solid currentColor;
    border-bottom: 1.5px solid currentColor;
    transform: rotate(225deg);
  }

  .student-react-equipment-dock.is-open .student-react-equipment-dock__toggle i {
    transform: rotate(45deg);
  }

  .student-react-equipment-dock .student-react-equipment-manifest__item strong {
    font-size: 14px;
    font-weight: 700;
  }

  .student-react-equipment-dock .student-react-equipment-manifest__item small {
    font-size: 12px;
  }

  .student-react-reservation-step:has(.student-react-equipment-dock) .gju-card__body {
    padding-bottom: calc(160px + env(safe-area-inset-bottom));
  }
}
```

- [ ] **Step 6: Add static dock contracts**

In `scripts/equipment-reservation-ui-test.mjs`, read the new component and assert:

```js
assert(selectionSurfaceSource.includes('aria-expanded={open}'), "mobile selection dock must expose expanded state");
assert(selectionSurfaceSource.includes('event.key === "Escape"'), "mobile selection dock must close with Escape");
assert(reactStudentStyleSource.includes("max-height: 45dvh;"), "mobile selection sheet must cap its viewport height");
assert(reactStudentStyleSource.includes("student-react-equipment-manifest--inline"), "desktop selection manifest must remain available");
```

- [ ] **Step 7: Run Task 2 tests and verify GREEN**

Run:

```bash
npm run test:equipment-ui
npm run check:react-admin
npm run test:ui -- tests/ui/react-student.spec.mjs --project=mobile-390 --project=mobile-430 --grep "expandable dock|keeps card surfaces"
```

Expected: all selected tests PASS; dock stays above navigation, opens under 45dvh, closes with Escape, and body width remains bounded.

- [ ] **Step 8: Commit Task 2**

```bash
git add src/react/student/components/EquipmentSelectionSurface.tsx src/react/student/components/ReservationControls.tsx src/react/student/student.css tests/ui/react-student.spec.mjs scripts/equipment-reservation-ui-test.mjs
git commit -m "2026-07-14 모바일 기자재 선택 플로팅 도크 추가"
```

---

### Task 3: Rounded glass navigation, cache version, and full verification

**Files:**
- Modify: `src/react/student/student.css`
- Modify: all tracked files containing `20260714-mobile-overflow-r4`
- Test: `tests/ui/react-student.spec.mjs`

**Interfaces:**
- Consumes: `.gju-app-shell__bottom-nav`, `.student-react-bottom-nav`, and five `.student-react-nav__item` buttons.
- Produces: inset glass dock with 18px icons, 48px targets, and an active 40–48px dark rounded surface.

- [ ] **Step 1: Extend the navigation test with glass geometry before styling**

After obtaining `nav`, assert its box and computed style:

```js
const navMetrics = await nav.evaluate((element) => {
  const box = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return {
    left: box.left,
    right: box.right,
    viewportWidth: document.documentElement.clientWidth,
    borderRadius: Number.parseFloat(style.borderRadius),
    backgroundColor: style.backgroundColor,
    backdropFilter: style.backdropFilter || style.webkitBackdropFilter
  };
});
expect(navMetrics.left).toBeGreaterThanOrEqual(12);
expect(navMetrics.right).toBeLessThanOrEqual(navMetrics.viewportWidth - 12);
expect(navMetrics.borderRadius).toBeGreaterThanOrEqual(24);
expect(navMetrics.backgroundColor).toContain("0.82");
expect(navMetrics.backdropFilter).toContain("blur");
```

- [ ] **Step 2: Run the targeted navigation test and verify RED**

Run:

```bash
npm run test:ui -- tests/ui/react-student.spec.mjs --project=mobile-390 --grep "mobile navigation"
```

Expected: FAIL because the current navigation touches both viewport edges, has 0px radius, and has an opaque white background without blur.

- [ ] **Step 3: Apply the student glass dock styles**

Replace the current bottom-navigation surface with:

```css
.student-react-shell .gju-app-shell__bottom-nav {
  padding: 0 max(12px, env(safe-area-inset-right)) calc(10px + env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
  border-top: 0;
  background: transparent;
  backdrop-filter: none;
}

.gju-app-shell .student-react-bottom-nav {
  position: static;
  display: grid;
  grid-template-columns: repeat(5, minmax(48px, 1fr));
  gap: 4px;
  width: 100%;
  min-height: 62px;
  padding: 7px 8px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 14px 34px rgba(20, 27, 35, 0.16);
  backdrop-filter: blur(18px) saturate(140%);
  overflow: hidden;
}

.student-react-bottom-nav .student-react-nav__item {
  display: grid;
  place-items: center;
  justify-self: center;
  width: 48px;
  min-width: 48px;
  min-height: 48px;
  padding: 0;
  border-radius: 18px;
  color: #2f343b;
}

.student-react-bottom-nav .student-react-nav__item.active,
.student-react-bottom-nav .student-react-nav__item[aria-current="page"] {
  color: #ffffff;
  background: #121416;
}
```

- [ ] **Step 4: Run navigation and responsive UI tests**

Run:

```bash
npm run test:ui -- tests/ui/react-student.spec.mjs --project=mobile-390 --project=mobile-430 --project=tablet-768 --grep "mobile navigation|expandable dock|circular 24px|keeps card surfaces"
```

Expected: all selected tests PASS; the tablet skips phone-only dock/progress tests but retains visible navigation and overflow coverage.

- [ ] **Step 5: Bump the cache version**

Mechanically replace every tracked `20260714-mobile-overflow-r4` reference with `20260714-mobile-dock-r5`, then verify no old reference remains:

```bash
rg -l "20260714-mobile-overflow-r4" --glob '!node_modules/**' --glob '!dist/**' | xargs perl -pi -e 's/20260714-mobile-overflow-r4/20260714-mobile-dock-r5/g'
rg -n "20260714-mobile-overflow-r4" --glob '!node_modules/**' --glob '!dist/**'
```

Expected: the second command prints no matches.

- [ ] **Step 6: Run the full verification suite**

Run:

```bash
npm run check && \
npm run check:js && \
npm run check:react-admin && \
npm run test:react-admin && \
npm run test:student-react && \
npm run test:student-bridge && \
npm run test:equipment-ui && \
npm run test:admin-ui && \
npm run test:notifications && \
npm run test:backend-domains && \
npm run test:storage && \
npm run test:security && \
npm run test:ui -- --workers=1 && \
npm run build && \
node scripts/check-pre-release.mjs && \
git diff --check
```

Expected: syntax, type, contract, security, storage, all Playwright projects, build, pre-release checks, and whitespace checks PASS.

- [ ] **Step 7: Capture final mobile screenshots**

Use the isolated Playwright server and a 390×844 page to capture:

- collapsed selection dock with search/results visible;
- expanded selection sheet with four selected items;
- glass navigation with all five icons visible;
- circular 24px progress markers.

Save temporary QA images outside the repository under `/tmp/` and inspect them for clipping, occlusion, readable density, and safe-area spacing.

- [ ] **Step 8: Commit Task 3**

```bash
git add -u
git commit -m "2026-07-14 글라스 하단 내비게이션 및 모바일 캐시 갱신"
```

Verify `git status --short` contains only the pre-existing untracked `.codex-audit/` directory.
