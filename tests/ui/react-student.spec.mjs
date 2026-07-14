import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { loginReactStudent } from "./support/session.mjs";

async function expectNoHorizontalOverflow(page) {
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth
  }));
  expect(widths.document, JSON.stringify(widths)).toBeLessThanOrEqual(widths.client + 1);
  expect(widths.body, JSON.stringify(widths)).toBeLessThanOrEqual(widths.client + 1);
}

test("Student React mounts without legacy student content", async ({ page }) => {
  await loginReactStudent(page);
  await expect(page.locator("#react-student-root .student-react-shell")).toBeVisible();
  await expect(page.locator("#react-student-root .student-content")).toHaveCount(0);
  await expect(page.getByText("안녕하세요, 접근성 학생님")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("Student React mobile navigation is an inset glass dock with visible 18px icons", async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(!viewport || viewport.width > 768, "mobile contract");
  await loginReactStudent(page);
  const nav = page.locator(".student-react-bottom-nav");
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
  const buttons = nav.getByRole("button");
  await expect(buttons).toHaveCount(5);
  for (let index = 0; index < await buttons.count(); index += 1) {
    const button = buttons.nth(index);
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
    expect(metrics.width).toBe(48);
    expect(metrics.height).toBe(48);
    expect(metrics.visibleText).toBe("");
    expect(metrics.iconFound).toBe(true);
    expect(metrics.iconWidth).toBe(18);
    expect(metrics.iconHeight).toBe(18);
    expect(metrics.svgWidth).toBeGreaterThan(0);
    expect(metrics.svgHeight).toBeGreaterThan(0);
    await expect(button).toHaveAttribute("aria-label", /.+/);
  }
  await buttons.nth(1).click();
  const heading = page.locator(".student-react-view h1", { hasText: "내 예약" }).first();
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  await expectNoHorizontalOverflow(page);
});

test("Student React mobile booking progress uses circular 24px markers", async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(!viewport || viewport.width > 700, "phone progress contract");
  await loginReactStudent(page);
  await page.evaluate(async () => {
    const { state } = await import("/js/state.js?v=20260714-mobile-dock-r5");
    const { render } = await import("/js/renderer.js?v=20260714-mobile-dock-r5");
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

test("Student React My screen has labelled controls and no serious axe violations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await loginReactStudent(page);
  await page.getByRole("button", { name: "마이 페이지" }).click();
  await expect(page.getByRole("heading", { name: "마이" }).first()).toBeVisible();
  const results = await new AxeBuilder({ page })
    .include(".student-react-shell")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact))).toEqual([]);
});

test("Student React reservation filters control a labelled panel", async ({ page }) => {
  await loginReactStudent(page);
  const viewport = page.viewportSize();
  const navigation = viewport && viewport.width <= 768
    ? page.locator(".student-react-bottom-nav")
    : page.locator(".student-react-desktop-nav");
  await navigation.getByRole("button", { name: "내 예약" }).click();
  const tablist = page.getByRole("tablist", { name: "내 예약 카테고리" });
  const active = tablist.getByRole("tab", { selected: true });
  const panelId = await active.getAttribute("aria-controls");
  expect(panelId).toBeTruthy();
  const panel = page.locator(`#${panelId}`);
  await expect(panel).toHaveAttribute("role", "tabpanel");
  await expect(panel).toHaveAttribute("aria-labelledby", await active.getAttribute("id"));
  await active.press("ArrowRight");
  await expect(tablist.getByRole("tab").nth(1)).toHaveAttribute("aria-selected", "true");
});

test("Student React report submission keeps the form open and announces server errors", async ({ page }) => {
  await loginReactStudent(page);
  await page.route("**/api/reports/studio", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "보고서 저장 실패" })
    });
  });
  await page.evaluate(async () => {
    const { state } = await import("/js/state.js?v=20260714-mobile-dock-r5");
    const { render } = await import("/js/renderer.js?v=20260714-mobile-dock-r5");
    state.view = "reports";
    state.bootstrap.settings.googleDriveUrl = "https://drive.google.com/";
    state.myReservations = [{
      id: "report-error-fixture",
      type: "studio",
      status: "auto_confirmed",
      fields: {
        reservedDate: "2026-07-10",
        reportStatus: "required",
        participants: "2명",
        timeSlots: ["10:30-12:00"],
        studioSpaces: ["Studio A Front"]
      }
    }];
    state.activeReportReservationId = "report-error-fixture";
    render();
  });

  const submit = page.getByRole("button", { name: "보고서 제출" });
  await page.getByLabel("정리정돈을 완료했습니다.").check();
  await submit.click();
  await expect(page.getByRole("alert")).toContainText("보고서 저장 실패");
  await expect(page.getByRole("heading", { name: "스튜디오 보고서" })).toBeVisible();
  await expect(submit).toBeEnabled();
});

test("Student React lecture actions recover and announce request errors", async ({ page }) => {
  await loginReactStudent(page);
  await page.route("**/api/lectures/lecture-error-fixture/apply", async (route) => {
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "특강 정원이 마감되었습니다." })
    });
  });
  await page.evaluate(async () => {
    const { state } = await import("/js/state.js?v=20260714-mobile-dock-r5");
    const { render } = await import("/js/renderer.js?v=20260714-mobile-dock-r5");
    state.view = "lectures";
    state.lectures = [{
      id: "lecture-error-fixture",
      title: "오류 처리 특강",
      lectureDate: "2026-07-20",
      time: "14:00",
      location: "강의실",
      status: "모집중",
      capacity: 1,
      applicationCount: 0,
      applied: false
    }];
    render();
  });

  const apply = page.getByRole("button", { name: "신청" });
  await apply.click();
  await expect(page.getByRole("alert")).toContainText("특강 정원이 마감되었습니다.");
  await expect(apply).toBeEnabled();
});

test("Student React opens every reservation type without viewport overflow", async ({ page }) => {
  await loginReactStudent(page);
  const types = ["기자재", "스튜디오", "암실", "출력실"];

  for (const label of types) {
    await page.evaluate(async () => {
      const { state } = await import("/js/state.js?v=20260714-mobile-dock-r5");
      const { render } = await import("/js/renderer.js?v=20260714-mobile-dock-r5");
      state.view = "reserve";
      state.reservationType = "";
      state.bootstrap.settings.googleDriveUrl = "https://drive.google.com/";
      render();
    });
    await page.getByRole("button", { name: new RegExp(label) }).first().click();
    await expect(page.getByRole("heading", { name: "예약 신청" })).toBeVisible();
    await expect(page.getByLabel("사용일")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});

test("Student React equipment selection keeps card surfaces inside the mobile viewport", async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(!viewport || viewport.width > 768, "mobile and tablet overflow contract");
  await loginReactStudent(page);
  await page.evaluate(async () => {
    const { state } = await import("/js/state.js?v=20260714-mobile-dock-r5");
    const { render } = await import("/js/renderer.js?v=20260714-mobile-dock-r5");
    state.view = "reserve";
    state.reservationType = "equipment";
    state.reservationFlowStep.equipment = "select";
    state.selectedDates.equipment = "2099-07-20";
    state.selectedEquipmentPeriod = "당일";
    state.selectedEquipmentRentalTime = "10:15";
    state.selectedEquipmentReturnTime = "17:10";
    render();
  });

  await expect(page.getByRole("heading", { name: "예약 정보" })).toBeVisible();
  await expect(page.getByRole("tablist", { name: "기자재 카테고리" })).toBeVisible();

  const metrics = await page.locator(".student-react-reservation-step").evaluate((card) => {
    const cardBox = card.getBoundingClientRect();
    const selectors = [
      ".gju-card__body",
      ".student-react-equipment-picker",
      ".student-react-equipment-manifest",
      "#student-equipment-search",
      "#student-equipment-category",
      "#student-equipment-results > fieldset",
      ".student-react-flow-actions"
    ];
    return {
      viewportWidth: document.documentElement.clientWidth,
      card: { left: cardBox.left, right: cardBox.right, width: cardBox.width, clientWidth: card.clientWidth, scrollWidth: card.scrollWidth },
      surfaces: selectors.map((selector) => {
        const element = card.querySelector(selector);
        const box = element?.getBoundingClientRect();
        return {
          selector,
          found: Boolean(element && box),
          left: box?.left ?? 0,
          right: box?.right ?? 0,
          top: box?.top ?? 0,
          bottom: box?.bottom ?? 0,
          width: box?.width ?? 0,
          clientWidth: element?.clientWidth ?? 0,
          scrollWidth: element?.scrollWidth ?? 0
        };
      })
    };
  });

  for (const surface of metrics.surfaces) {
    expect(surface.found, JSON.stringify(metrics, null, 2)).toBe(true);
    expect(surface.left, JSON.stringify(metrics, null, 2)).toBeGreaterThanOrEqual(-1);
    expect(surface.right, JSON.stringify(metrics, null, 2)).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  }
  const equipmentPicker = metrics.surfaces.find((surface) => surface.selector === ".student-react-equipment-picker");
  const flowActions = metrics.surfaces.find((surface) => surface.selector === ".student-react-flow-actions");
  expect(flowActions.top, JSON.stringify(metrics, null, 2)).toBeGreaterThanOrEqual(equipmentPicker.bottom - 1);
  expect(metrics.card.scrollWidth, JSON.stringify(metrics, null, 2)).toBeLessThanOrEqual(metrics.card.clientWidth + 1);
  await expectNoHorizontalOverflow(page);
});

test("Student React mobile equipment selection uses an expandable dock above navigation", async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(!viewport || viewport.width > 700, "phone selection dock contract");
  await loginReactStudent(page);
  await page.evaluate(async () => {
    const { state } = await import("/js/state.js?v=20260714-mobile-dock-r5");
    const { render } = await import("/js/renderer.js?v=20260714-mobile-dock-r5");
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
  const toggle = dock.locator(".student-react-equipment-dock__toggle");
  await expect(toggle).toHaveAccessibleName(/선택 장비 4개.*목록 보기/);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#student-equipment-selection-panel")).toHaveCount(0);

  const navBox = await page.locator(".student-react-bottom-nav").boundingBox();
  const dockBox = await dock.boundingBox();
  expect(navBox).not.toBeNull();
  expect(dockBox).not.toBeNull();
  expect(dockBox.y + dockBox.height).toBeLessThanOrEqual(navBox.y - 6);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(toggle).toHaveAccessibleName(/선택 장비 4개.*목록 닫기/);
  const panel = page.locator("#student-equipment-selection-panel");
  await expect(panel).toBeVisible();
  await expect(panel.locator(".student-react-equipment-manifest__item")).toHaveCount(4);
  const sheetBox = await dock.boundingBox();
  expect(sheetBox).not.toBeNull();
  expect(sheetBox.height).toBeLessThanOrEqual(viewport.height * 0.45 + 1);

  const accessibility = await new AxeBuilder({ page })
    .include(".student-react-equipment-dock")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(accessibility.violations.filter((violation) => (
    ["serious", "critical"].includes(violation.impact)
  ))).toEqual([]);

  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await panel.getByRole("button", { name: /선택 해제/ }).first().click();
  await expect(panel.locator(".student-react-equipment-manifest__item")).toHaveCount(3);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expectNoHorizontalOverflow(page);
});

test("Student React reservation cancellation keeps the card and announces request errors", async ({ page }) => {
  await loginReactStudent(page);
  await page.route("**/api/reservations/cancel-error-fixture/cancel", async (route) => {
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "이미 취소된 예약입니다." })
    });
  });
  page.on("dialog", (dialog) => dialog.accept());
  await page.evaluate(async () => {
    const { state } = await import("/js/state.js?v=20260714-mobile-dock-r5");
    const { render } = await import("/js/renderer.js?v=20260714-mobile-dock-r5");
    state.view = "mine";
    state.myReservations = [{
      id: "cancel-error-fixture",
      type: "equipment",
      status: "approved",
      fields: { reservedDate: "2026-07-20", period: "당일" }
    }];
    render();
  });

  const cancel = page.getByRole("button", { name: "예약 취소" });
  await cancel.click();
  await expect(page.getByRole("alert")).toContainText("이미 취소된 예약입니다.");
  await expect(page.getByText("기자재 예약")).toBeVisible();
  await expect(cancel).toBeEnabled();
});
