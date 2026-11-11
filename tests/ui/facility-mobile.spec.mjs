import { expect, test } from "@playwright/test";
import { loginReactAdmin, loginReactStudent } from "./support/session.mjs";

for (const role of ["admin", "student"]) {
  test(`Mobile ${role} dashboard keeps every facility and control visible`, async ({ page, browserName }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390", "Mobile widths are covered together in this regression.");
    await (role === "admin" ? loginReactAdmin(page) : loginReactStudent(page));
    const board = page.locator(".gju-facility-board");
    const summary = board.getByRole("group", { name: "공간 요약", exact: true });
    await expect(summary).toBeVisible();
    await expect(page.locator(".toast")).toBeHidden();
    for (const label of ["지금", "새로고침", "확대", "현황 안내"]) {
      const control = board.getByRole("button", { name: label, exact: true });
      expect((await control.innerText()).trim()).toBe("");
      await expect(control.locator("svg")).toBeVisible();
    }
    await board.getByRole("button", { name: "현황 안내", exact: true }).click();
    await expect(board.getByRole("region", { name: "현황 안내", exact: true })).toContainText("예약 없음은 즉시 이용 가능을 뜻하지 않습니다.");
    await board.getByRole("button", { name: "현황 안내", exact: true }).click();
    if (role === "student") await expect(page.locator(".student-react-course-demand-card")).toHaveCount(0);
    for (const width of [320, 360, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      const measurements = await summary.evaluate((element) => ({
        fits: element.scrollWidth <= element.clientWidth + 1,
        buttons: [...element.querySelectorAll("button")].map((button) => {
          const rect = button.getBoundingClientRect();
          return { left: rect.left, right: rect.right, width: rect.width, height: rect.height };
        })
      }));
      expect(measurements.fits).toBeTruthy();
      expect(measurements.buttons).toHaveLength(6);
      await expect(summary.getByRole("button", { name: /디지털사진영상실/ })).toBeVisible();
      expect(measurements.buttons.every((button) => button.left >= 0 && button.right <= width && button.width >= 44 && button.height >= 44), JSON.stringify({ width, measurements })).toBeTruthy();
      await expect(board.getByRole("button", { name: "새로고침", exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
      await expect(page.locator(".toast")).toBeHidden();
      await board.screenshot({ path: `${process.env.GJU_FACILITY_SCREENSHOT_DIR || "outputs/facility-board-implementation"}/r3-${browserName}-${role}-${width}.png` });
    }
    await board.getByLabel("조회 시작 시간", { exact: true }).fill("14:30");
    await board.getByRole("tab", { name: "시간표", exact: true }).click();
    const scroll = board.locator(".gju-facility-board__timeline-scroll");
    await expect.poll(() => scroll.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const selected = element.querySelector("button[data-selected]").getBoundingClientRect();
      return selected.left >= rect.left + element.querySelector("th").getBoundingClientRect().width - 1 && selected.right <= rect.right + 1;
    })).toBeTruthy();
    await board.screenshot({ path: `${process.env.GJU_FACILITY_SCREENSHOT_DIR || "outputs/facility-board-implementation"}/r3-${browserName}-${role}-timeline.png` });
    await summary.getByRole("button", { name: /암실/ }).click();
    await expect(board.getByRole("region", { name: "암실 예약 요약" })).toBeVisible();
    await expect(board.getByLabel("조회 시작 시간", { exact: true })).toHaveValue("14:30");
  });
}
