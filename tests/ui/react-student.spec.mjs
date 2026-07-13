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

test("Student React mobile navigation is icon-only, reachable, and uses 44px targets", async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(!viewport || viewport.width > 768, "mobile contract");
  await loginReactStudent(page);
  const nav = page.locator(".student-react-bottom-nav");
  const buttons = nav.getByRole("button");
  await expect(buttons).toHaveCount(5);
  for (let index = 0; index < await buttons.count(); index += 1) {
    const button = buttons.nth(index);
    const metrics = await button.evaluate((element) => ({
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
      visibleText: [...element.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE || node.nodeName === "SPAN")
        .map((node) => node.textContent || "")
        .join("")
        .trim()
    }));
    expect(metrics.width).toBeGreaterThanOrEqual(44);
    expect(metrics.height).toBeGreaterThanOrEqual(44);
    expect(metrics.visibleText).toBe("");
    await expect(button).toHaveAttribute("aria-label", /.+/);
  }
  await buttons.nth(1).click();
  const heading = page.locator(".student-react-view h1", { hasText: "내 예약" }).first();
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  await expectNoHorizontalOverflow(page);
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
    const { state } = await import("/js/state.js?v=20260704-student-icon-nav");
    const { render } = await import("/js/renderer.js?v=20260704-student-icon-nav");
    state.view = "reports";
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
    const { state } = await import("/js/state.js?v=20260704-student-icon-nav");
    const { render } = await import("/js/renderer.js?v=20260704-student-icon-nav");
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
      const { state } = await import("/js/state.js?v=20260704-student-icon-nav");
      const { render } = await import("/js/renderer.js?v=20260704-student-icon-nav");
      state.view = "reserve";
      state.reservationType = "";
      render();
    });
    await page.getByRole("button", { name: new RegExp(label) }).first().click();
    await expect(page.getByRole("heading", { name: "예약 신청" })).toBeVisible();
    await expect(page.getByLabel("사용일")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
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
    const { state } = await import("/js/state.js?v=20260704-student-icon-nav");
    const { render } = await import("/js/renderer.js?v=20260704-student-icon-nav");
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
