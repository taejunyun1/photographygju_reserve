import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { loginReactAdmin } from "./support/session.mjs";

async function expectNoHorizontalOverflow(page) {
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth
  }));
  expect(widths.document, JSON.stringify(widths)).toBeLessThanOrEqual(widths.client + 1);
  expect(widths.body, JSON.stringify(widths)).toBeLessThanOrEqual(widths.client + 1);
}

test("React Admin mounts current source without legacy panel or horizontal overflow", async ({ page }) => {
  await loginReactAdmin(page);
  await expect(page.locator(".gju-legacy-admin-panel")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "대시보드" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("React Admin action toast is announced once across a follow-up render", async ({ page }) => {
  await loginReactAdmin(page);
  await page.evaluate(() => {
    window.__gjuLiveToastInsertions = 0;
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches?.('.toast[role="status"], .toast[role="alert"]')) window.__gjuLiveToastInsertions += 1;
          window.__gjuLiveToastInsertions += node.querySelectorAll?.('.toast[role="status"], .toast[role="alert"]').length || 0;
        }
      }
    });
    observer.observe(document.querySelector("#app"), { childList: true, subtree: true });
    window.__gjuToastObserver = observer;
  });
  await page.evaluate(async () => {
    const module = await import("/js/renderer.js?v=20260714-mobile-dock-r5");
    module.toast("중복 알림 확인", { duration: 5_000 });
    module.render();
  });
  await expect(page.locator(".toast")).toContainText("중복 알림 확인");
  await expect.poll(() => page.evaluate(() => window.__gjuLiveToastInsertions)).toBe(1);
  await page.evaluate(() => window.__gjuToastObserver?.disconnect());
});

test("React Admin controls have names and no serious axe violations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await loginReactAdmin(page);
  await expect(page.locator(".loading-overlay")).toHaveCount(0);
  const results = await new AxeBuilder({ page })
    .include(".gju-app-shell")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact))).toEqual([]);
});

test("React Admin tabs expose a controlled panel and support arrow-key activation", async ({ page }, testInfo) => {
  await loginReactAdmin(page);
  if (testInfo.project.name === "desktop-1440") {
    await page.locator(".gju-admin-nav--sidebar").getByRole("button", { name: "학생 승인" }).click();
  } else {
    await page.locator(".gju-admin-nav--bottom").getByRole("button", { name: "학생" }).click();
  }
  const tablist = page.getByRole("tablist", { name: "학생 승인 상태 필터" });
  const tabs = tablist.getByRole("tab");
  await expect(tabs).toHaveCount(5);
  const first = tabs.first();
  const second = tabs.nth(1);
  await expect(first).toHaveAttribute("aria-selected", "true");
  await expect(first).toHaveAttribute("tabindex", "0");
  await expect(second).toHaveAttribute("tabindex", "-1");
  const panelId = await first.getAttribute("aria-controls");
  expect(panelId).toBeTruthy();
  await expect(page.locator(`#${panelId}`)).toHaveAttribute("role", "tabpanel");
  await first.focus();
  await first.press("ArrowRight");
  await expect(second).toBeFocused();
  await expect(second).toHaveAttribute("aria-selected", "true");
});

test("React Admin review parity surfaces render from typed views", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "Desktop navigation coverage is sufficient for this cross-view contract.");
  await loginReactAdmin(page);
  const navigation = page.locator(".gju-admin-nav--sidebar");

  await expect(page.getByText("운영 큐", { exact: true })).toBeVisible();
  await expect(page.getByText("오늘 예약 타임라인", { exact: true })).toBeVisible();
  await expect(page.getByText("운영 지표", { exact: true })).toBeVisible();

  await navigation.getByRole("button", { name: "예약 관리" }).click();
  const reservationTabs = page.getByRole("tablist", { name: "예약 유형" });
  for (const label of ["전체", "기자재", "암실", "스튜디오", "출력"]) {
    await expect(reservationTabs.getByRole("tab", { name: label, exact: true })).toBeVisible();
  }
  await expect(page.getByText("예약이 없습니다.").first()).toBeVisible();

  await navigation.getByRole("button", { name: "보고서" }).click();
  await expect(page.getByText("보고서가 없습니다.").first()).toBeVisible();

  await navigation.getByRole("button", { name: "비교과 특강" }).click();
  await page.getByRole("button", { name: "특강 등록 열기" }).click();
  await expect(page.getByLabel("담당교수")).toBeVisible();
  await expect(page.getByLabel("대상 학년")).toBeVisible();
  await expect(page.getByLabel("비고")).toBeVisible();
  await expect(page.getByRole("button", { name: "CSV 내보내기" })).toBeVisible();

  await navigation.getByRole("button", { name: "공지사항" }).click();
  await expect(page.getByText("공지사항이 없습니다.").first()).toBeVisible();

  await navigation.getByRole("button", { name: "설정" }).click();
  await page.getByText("운영 알림", { exact: true }).click();
  await page.getByText("보안 / 데이터 관리", { exact: true }).click();
  await expect(page.getByRole("button", { name: "백업 JSON" })).toBeVisible();
  await expect(page.getByText("운영 알림", { exact: true })).toBeVisible();
});
