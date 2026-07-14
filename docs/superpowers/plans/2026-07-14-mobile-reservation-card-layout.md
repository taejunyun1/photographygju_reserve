# Mobile Reservation Card Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the student mobile reservation filter clipping and replace the shared reservation status card with a compact, aligned layout that clearly separates date, time, period, and a two-item equipment summary.

**Architecture:** Keep `ReservationCard` as the single renderer used by Home and Mine. Replace its flattened metadata string with a small pure display-model helper, render semantic date/time blocks, and own all responsive layout in student-scoped CSS. Override the shared horizontal tabs only through `.student-react-filter-tabs` at the phone breakpoint so other tab groups keep their existing behavior.

**Tech Stack:** React 19, TypeScript, student-scoped CSS, Playwright, Axe, esbuild, Cloudflare Pages, Cloudflare Workers

## Global Constraints

- Card title is exactly `17px` with its browser default margin removed.
- Cancel remains a labelled `44×44px` icon button at the right side of the first row.
- Equipment metadata shows at most two codes followed by `외 N개`.
- Mobile Mine filters render as six equal tabs in a `3 × 2` grid with no internal horizontal scrolling.
- Preserve reservation data, cancellation/report actions, API behavior, tab semantics, keyboard behavior, and status badge wording.
- Verify 390×844 and 430×932 viewports with no document/body horizontal overflow.
- Do not add dependencies or modify Admin behavior.

---

## File Map

- `src/react/student/components/StudentPrimitives.tsx`: create the reservation display model and render the structured shared card.
- `src/react/student/student.css`: align the card header, typography, schedule cells, equipment summary, and phone-only filter grid.
- `tests/ui/react-student.spec.mjs`: add browser regressions for card structure, summary content, positions, tab containment, overflow, and accessibility.
- `public/index.html`, `public/app.js`, tracked public JavaScript imports, and release-check scripts: advance the cache token after the visual bundle changes.
- `design-qa.md`: record reference-to-implementation comparison and the blocking QA result.

---

### Task 1: Shared reservation card display model and layout

**Files:**
- Modify: `tests/ui/react-student.spec.mjs`
- Modify: `src/react/student/components/StudentPrimitives.tsx`
- Modify: `src/react/student/student.css`

**Interfaces:**
- Consumes: `StudentReservation`, existing `GjuStatusBadge`, `GjuIconButton`, cancellation and report callbacks.
- Produces: `reservationDisplayMeta(reservation)` returning `{ date, time, period, equipmentSummary, fallback }`; `.student-react-reservation-card__schedule`; `.student-react-reservation-card__equipment`.

- [ ] **Step 1: Write the failing mobile card test**

Add a Playwright test that logs in, injects an equipment reservation with five items, and renders Mine:

```js
test("Student React reservation cards align actions and summarize the schedule on mobile", async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(!viewport || viewport.width > 430, "phone card contract");
  await loginReactStudent(page);
  await page.evaluate(async () => {
    const { state } = await import("/js/state.js?v=20260714-mobile-card-r6");
    const { render } = await import("/js/renderer.js?v=20260714-mobile-card-r6");
    state.view = "mine";
    state.myReservations = [{
      id: "mobile-card-fixture",
      type: "equipment",
      status: "approval_pending",
      fields: {
        reservedDate: "2026-07-27",
        rentalTime: "12:00",
        returnTime: "17:10",
        period: "1박2일"
      },
      equipmentItems: [
        { id: "e1", code: "CAM-750D-03", name: "캐논 750D" },
        { id: "e2", code: "LEN-1855-03", name: "캐논 EF-S 18-55" },
        { id: "e3", code: "LEN-1855-02", name: "캐논 EF-S 18-55" },
        { id: "e4", code: "LGT-430EX-02", name: "캐논 430EX" },
        { id: "e5", code: "LGT-430EX-01", name: "캐논 430EX" }
      ]
    }];
    render();
  });

  const card = page.locator(".student-react-reservation-card").first();
  const header = card.locator(".student-react-reservation-card__head");
  const badges = header.locator(".chips");
  const cancel = header.getByRole("button", { name: "예약 취소" });
  const title = card.getByRole("heading", { name: "기자재 예약" });
  const date = card.locator(".student-react-reservation-card__schedule-item", { hasText: "날짜" });
  const time = card.locator(".student-react-reservation-card__schedule-item", { hasText: "시간" });
  const equipment = card.locator(".student-react-reservation-card__equipment");

  await expect(date).toContainText("2026. 7. 27. (월)");
  await expect(time).toContainText("12:00–17:10");
  await expect(equipment).toHaveText("1박2일 · CAM-750D-03, LEN-1855-03 외 3개");
  await expect(equipment).not.toContainText("LGT-430EX-01");

  const metrics = await page.evaluate(() => {
    const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect();
    const cardRect = rect(".student-react-reservation-card");
    const badgeRect = rect(".student-react-reservation-card__head .chips");
    const cancelRect = rect(".student-react-reservation-card__head .gju-icon-button");
    const titleElement = document.querySelector(".student-react-reservation-card h2");
    const titleStyle = titleElement ? getComputedStyle(titleElement) : null;
    return {
      badgeTop: badgeRect?.top,
      cancelTop: cancelRect?.top,
      cancelRight: cancelRect?.right,
      contentRight: cardRect ? cardRect.right - 15 : undefined,
      cancelWidth: cancelRect?.width,
      cancelHeight: cancelRect?.height,
      titleFontSize: titleStyle?.fontSize,
      titleMargin: titleStyle?.margin
    };
  });
  expect(Math.abs((metrics.badgeTop || 0) - (metrics.cancelTop || 0))).toBeLessThanOrEqual(8);
  expect(Math.abs((metrics.cancelRight || 0) - (metrics.contentRight || 0))).toBeLessThanOrEqual(2);
  expect(metrics.cancelWidth).toBe(44);
  expect(metrics.cancelHeight).toBe(44);
  expect(metrics.titleFontSize).toBe("17px");
  expect(metrics.titleMargin).toBe("0px");
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx playwright test tests/ui/react-student.spec.mjs --config playwright.config.mjs --project=mobile-390 --grep "align actions and summarize"
```

Expected: FAIL because the schedule/equipment elements do not exist and the title remains the browser-default size/margin.

- [ ] **Step 3: Implement the minimal structured display model**

Replace `reservationMeta()` with focused helpers:

```tsx
function formatReservationDate(value: unknown) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return String(value || "");
  const [, year, month, day] = match;
  const weekday = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    weekday: "short"
  }).format(new Date(`${year}-${month}-${day}T00:00:00+09:00`));
  return `${Number(year)}. ${Number(month)}. ${Number(day)}. (${weekday})`;
}

function reservationDisplayMeta(reservation: StudentReservation) {
  const fields = reservation.fields;
  const date = formatReservationDate(fields.reservedDate || reservation.lecture?.lectureDate);
  const time = fields.rentalTime && fields.returnTime
    ? `${fields.rentalTime}–${fields.returnTime}`
    : fields.startTime && fields.endTime
      ? `${fields.startTime}–${fields.endTime}`
      : (fields.timeSlots || []).join(", ") || String(reservation.lecture?.time || "");
  const equipment = (reservation.equipmentItems || [])
    .map((item) => item.code || item.name)
    .filter(Boolean);
  const equipmentSummary = equipment.length > 2
    ? `${equipment.slice(0, 2).join(", ")} 외 ${equipment.length - 2}개`
    : equipment.join(", ");
  return {
    date,
    time,
    period: String(fields.period || ""),
    equipmentSummary,
    fallback: !date && !time && !fields.period && !equipmentSummary ? "상세 정보 없음" : ""
  };
}
```

Render the card head, 17px title, schedule cells and summary using semantic text labels while leaving existing actions and errors intact.

- [ ] **Step 4: Add the minimal student-scoped CSS**

Add selectors that create the one-row header and compact information hierarchy:

```css
.student-react-reservation-card {
  gap: 12px;
}

.student-react-reservation-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.student-react-reservation-card__head .chips {
  min-width: 0;
  padding-top: 8px;
}

.student-react-reservation-card__head .gju-icon-button {
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
}

.student-react-reservation-card h2 {
  margin: 0;
  font-size: 17px;
  line-height: 1.35;
}

.student-react-reservation-card__schedule {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.student-react-reservation-card__schedule-item {
  display: grid;
  gap: 2px;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--student-line);
  border-radius: 8px;
  background: var(--student-soft);
}

.student-react-reservation-card__equipment {
  margin: 0;
  color: var(--student-muted);
  font-size: 13px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}
```

- [ ] **Step 5: Run the focused test and verify GREEN**

Run the Task 1 command for both `mobile-390` and `mobile-430`.

Expected: PASS at both widths with the same-row action, 17px title, explicit schedule, and two-code summary.

- [ ] **Step 6: Commit the card change**

```bash
git add tests/ui/react-student.spec.mjs src/react/student/components/StudentPrimitives.tsx src/react/student/student.css
git commit -m "2026-07-14 모바일 예약 상태 카드 정렬"
```

---

### Task 2: Phone filter containment and accessibility

**Files:**
- Modify: `tests/ui/react-student.spec.mjs`
- Modify: `src/react/student/student.css`

**Interfaces:**
- Consumes: `.student-react-filter-tabs`, six existing `GjuTabs` buttons and their tab semantics.
- Produces: phone-only equal-width `3 × 2` grid without scroll clipping.

- [ ] **Step 1: Write the failing filter containment test**

```js
test("Student React Mine filters show all six tabs without horizontal clipping", async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(!viewport || viewport.width > 430, "phone filter contract");
  await loginReactStudent(page);
  await page.locator(".student-react-bottom-nav").getByRole("button", { name: "내 예약" }).click();
  const tabs = page.getByRole("tablist", { name: "내 예약 카테고리" });
  await expect(tabs.getByRole("tab")).toHaveCount(6);
  const metrics = await tabs.evaluate((element) => {
    const parent = element.getBoundingClientRect();
    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      display: getComputedStyle(element).display,
      columns: getComputedStyle(element).gridTemplateColumns.split(" ").length,
      children: [...element.children].map((child) => {
        const box = child.getBoundingClientRect();
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, parentLeft: parent.left, parentRight: parent.right };
      })
    };
  });
  expect(metrics.display).toBe("grid");
  expect(metrics.columns).toBe(3);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  for (const item of metrics.children) {
    expect(item.left).toBeGreaterThanOrEqual(item.parentLeft - 1);
    expect(item.right).toBeLessThanOrEqual(item.parentRight + 1);
  }
  await expectNoHorizontalOverflow(page);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx playwright test tests/ui/react-student.spec.mjs --config playwright.config.mjs --project=mobile-390 --grep "show all six tabs"
```

Expected: FAIL with `display` equal to `flex` and `scrollWidth` greater than `clientWidth`.

- [ ] **Step 3: Implement the phone-only grid override**

Inside `@media (max-width: 700px)` add:

```css
.student-react-filter-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  width: 100%;
  max-width: 100%;
  overflow: visible;
}

.student-react-filter-tabs .gju-tabs__tab {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 0 8px;
}
```

- [ ] **Step 4: Run focused tests and verify GREEN**

Run Task 2 at `mobile-390` and `mobile-430`, then run the existing labelled panel keyboard test.

Expected: all tests PASS, all six tabs remain within the tablist, and arrow-key selection still changes the active tab.

- [ ] **Step 5: Run Axe on the modified Mine state**

Extend the mobile card test with `AxeBuilder` scoped to `.student-react-mine` and assert no serious/critical violations.

Expected: PASS with no new accessibility violations.

- [ ] **Step 6: Commit the filter change**

```bash
git add tests/ui/react-student.spec.mjs src/react/student/student.css
git commit -m "2026-07-14 모바일 예약 필터 넘침 방지"
```

---

### Task 3: Browser design QA and cache release token

**Files:**
- Create: `design-qa.md`
- Modify: every tracked file containing `20260714-mobile-dock-r5`
- Generated during verification: `public/js/react-student.generated.js`, `public/css/react-student.generated.css`

**Interfaces:**
- Consumes: screenshots supplied by the user and the new card/filter implementation.
- Produces: matching 390px and 430px captures, `design-qa.md` with `final result: passed`, cache token `20260714-mobile-card-r6`.

- [ ] **Step 1: Advance only tracked cache references**

Run:

```bash
git grep -l '20260714-mobile-dock-r5' | xargs perl -pi -e 's/20260714-mobile-dock-r5/20260714-mobile-card-r6/g'
```

Expected: all tracked runtime imports and release assertions use `20260714-mobile-card-r6`; untracked user files are untouched.

- [ ] **Step 2: Build and start the isolated app**

```bash
npm run check:react-admin
node tests/ui/support/start-isolated-server.mjs
```

Expected: generated React Student bundles compile and the isolated server listens on `127.0.0.1:4179`.

- [ ] **Step 3: Capture matching Home and Mine states**

Use Playwright at 390×844 and 430×932. Seed the five-item approval-pending equipment reservation, capture Home and Mine, and record computed positions for the header, cancel button, title, schedule, equipment summary, filter tabs, document, and body.

Expected: no element extends past the viewport; the cancel button is top-right; title is 17px; date/time are separate; filter scroll width does not exceed client width.

- [ ] **Step 4: Write the blocking QA report**

Create `design-qa.md` with:

```md
# Design QA — Mobile Reservation Card

Reference: TestFlight screenshots supplied 2026-07-14
Viewports: 390×844, 430×932

## Checks
- P0 overflow: passed
- P1 status/action alignment: passed
- P1 date/time hierarchy: passed
- P1 six-filter visibility: passed
- P2 title and metadata density: passed
- Accessibility and focus: passed

final result: passed
```

If a P0/P1/P2 check fails, keep `final result: blocked`, fix one root cause through a new failing test, recapture, and update the report only after it passes.

- [ ] **Step 5: Run the regression suite**

```bash
npm run test:student-react
npm run test:student-bridge
npm run check:react-admin
npx playwright test tests/ui/react-student.spec.mjs --config playwright.config.mjs --project=mobile-390 --project=mobile-430
npm run build
npm run native:sync
```

Expected: every command exits `0` with no failed test, and the iOS/Android embedded web assets contain the same card/filter bundle as `public` without uploading either store build.

- [ ] **Step 6: Commit QA and cache changes**

```bash
git add design-qa.md public src scripts tests ios android
git commit -m "2026-07-14 모바일 예약 카드 QA 및 캐시 갱신"
```

---

### Task 4: Push and deploy web plus Worker API

**Files:**
- No source edits expected.

**Interfaces:**
- Consumes: clean committed feature branch with passing QA.
- Produces: pushed Git branch, Cloudflare Pages deployment, Worker deployment, and production readiness verification.

- [ ] **Step 1: Verify repository scope before publishing**

```bash
git status --short --branch
git diff origin/main...HEAD --stat
git log --oneline origin/main..HEAD
```

Expected: only the design, plan, student card/filter implementation, focused tests, QA report, generated/cache release files are included. `.codex-audit/` and `equipment-list-2026-07-14.txt` remain untracked and unmodified.

- [ ] **Step 2: Push the feature branch**

```bash
git push -u origin codex/2026-07-14-mobile-reservation-card-layout
```

Expected: remote branch update succeeds.

- [ ] **Step 3: Deploy Cloudflare Pages**

```bash
npm run pages:deploy
```

Expected: build succeeds and Wrangler returns the production Pages deployment URL.

- [ ] **Step 4: Deploy Worker API**

```bash
npm run deploy
```

Expected: Wrangler uploads and activates the configured Worker without errors.

- [ ] **Step 5: Verify production readiness**

```bash
npm run pages:check
npm run deploy:check
```

Expected: both readiness commands exit `0`; deployed static assets reference `20260714-mobile-card-r6`.

- [ ] **Step 6: Report deployment scope**

Provide the branch, commits, Pages URL, Worker version/deployment output, passing verification list, and explicitly state that App Store Connect was not uploaded in this task.
