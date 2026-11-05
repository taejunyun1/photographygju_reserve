import { expect, test } from "@playwright/test";
import { loginReactAdmin, loginReactStudent } from "./support/session.mjs";

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390", "exercise narrow phone sizes once");
});

async function navigate(page, view, role = "admin") {
  await page.evaluate(async ({ view, role }) => {
    const { state } = await import("/js/state.js?v=20261014-photo-picker-r1");
    const { render } = await import("/js/renderer.js?v=20261014-photo-picker-r1");
    state[role === "admin" ? "adminView" : "view"] = view;
    render();
  }, { view, role });
}

async function expectSingleLine(locator) {
  const metrics = await locator.evaluateAll((elements) => elements.map((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return { text: element.textContent, lines: new Set([...range.getClientRects()].map((rect) => rect.top)).size };
  }));
  expect(metrics.length).toBeGreaterThan(0);
  for (const metric of metrics) expect(metric.lines, JSON.stringify(metric)).toBe(1);
}

test("Phone calendars keep two-digit dates on one line", async ({ page }) => {
  await loginReactAdmin(page);
  await navigate(page, "settings");
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await expectSingleLine(page.locator(".calendar-day > span"));
  }
});

test("Phone reservation cards separate the title and wrap long detail values", async ({ page }) => {
  await loginReactAdmin(page);
  await page.evaluate(async () => {
    const { state } = await import("/js/state.js?v=20261014-photo-picker-r1");
    const { render } = await import("/js/renderer.js?v=20261014-photo-picker-r1");
    state.adminView = "reservations";
    state.adminReservations = [{
      id: "mobile-layout-reservation", type: "studio", status: "auto_confirmed",
      createdAt: "2026-11-04T04:15:00Z",
      user: { name: "예약자 테스트", studentId: "20260001", email: "photography.long.student@example.com" },
      fields: { reservedDate: "2026-11-05", studioSpace: "Studio A Front", participants: "long-unbroken-participant-identifier-for-mobile-layout", timeSlots: ["18:00-20:00 (야간)", "20:00-22:00 (야간)"] }
    }];
    render();
  });
  const card = page.locator(".admin-reservation-card");
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    const metrics = await card.evaluate((element) => {
      const title = element.querySelector(".reservation-card-head strong").getBoundingClientRect();
      const user = element.querySelector(".reservation-card-head > div > span").getBoundingClientRect();
      return { titleBottom: title.bottom, userTop: user.top, width: element.clientWidth, scroll: element.scrollWidth,
        details: [...element.querySelectorAll(".prop")].map((row) => ({ text: row.textContent, width: row.clientWidth, scroll: row.scrollWidth })) };
    });
    expect(metrics.userTop).toBeGreaterThanOrEqual(metrics.titleBottom);
    expect(metrics.scroll).toBeLessThanOrEqual(metrics.width + 1);
    for (const detail of metrics.details) expect(detail.scroll, detail.text).toBeLessThanOrEqual(detail.width + 1);
    const tabs = await page.getByRole("tablist", { name: "예약 유형" }).evaluate((element) => ({ width: element.clientWidth, scroll: element.scrollWidth }));
    expect(tabs.scroll).toBeLessThanOrEqual(tabs.width + 1);
  }
});

test("Phone reservation choices and form controls fit with readable labels", async ({ page }) => {
  await loginReactStudent(page);
  await navigate(page, "reserve", "student");
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await expectSingleLine(page.locator(".student-react-facility-card .facility-code b"));
    const overflow = await page.locator(".student-react-facility-card").evaluateAll((cards) => cards.map((card) => ({ width: card.clientWidth, scroll: card.scrollWidth })));
    for (const card of overflow) expect(card.scroll).toBeLessThanOrEqual(card.width + 1);
  }
  await page.setViewportSize({ width: 320, height: 844 });
  await page.locator(".student-react-facility-card").filter({ hasText: "스튜디오" }).click();
  const controls = await page.locator(".student-react-reservation-page .gju-button").evaluateAll((buttons) => buttons.map((button) => ({ label: button.textContent, height: button.getBoundingClientRect().height })));
  for (const control of controls) expect(control.height, control.label).toBeGreaterThanOrEqual(44);
  const font = await page.getByLabel("사용일", { exact: true }).evaluate((input) => parseFloat(getComputedStyle(input).fontSize));
  expect(font).toBeGreaterThanOrEqual(16);
});

test("Phone survey date fields show the complete date and time", async ({ page }) => {
  await loginReactAdmin(page);
  await navigate(page, "course-demand");
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    const metrics = await page.locator('.admin-course-demand__builder-fields input[type="datetime-local"]').evaluateAll((inputs) => inputs.map((input) => ({ width: input.clientWidth, scroll: input.scrollWidth })));
    expect(metrics).toHaveLength(2);
    for (const metric of metrics) expect(metric.scroll).toBeLessThanOrEqual(metric.width + 1);
  }
});
