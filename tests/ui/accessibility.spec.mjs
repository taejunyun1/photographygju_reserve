import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { clickVisible, loginAs, openAuth } from "./support/session.mjs";

function violationTargets(results) {
  return results.violations.map((violation) => ({
    rule: violation.id,
    targets: violation.nodes.flatMap((node) => node.target)
  }));
}

test("auth form controls have programmatic labels", async ({ page }) => {
  await openAuth(page);
  const loginResults = await new AxeBuilder({ page })
    .include(".auth-panel")
    .withRules(["label", "select-name", "button-name"])
    .analyze();
  const loginUnlabelled = await page.locator('form[data-form="login"] input, form[data-form="login"] select, form[data-form="login"] textarea').evaluateAll((controls) => controls
    .filter((control) => !control.labels?.length && !control.getAttribute("aria-label") && !control.getAttribute("aria-labelledby"))
    .map((control) => control.getAttribute("name") || control.tagName.toLowerCase()));

  await page.locator('[data-auth-mode="signup"]').click();
  const signupResults = await new AxeBuilder({ page })
    .include(".auth-panel")
    .withRules(["label", "select-name", "button-name"])
    .analyze();
  const signupUnlabelled = await page.locator('form[data-form="signup"] input, form[data-form="signup"] select, form[data-form="signup"] textarea').evaluateAll((controls) => controls
    .filter((control) => !control.labels?.length && !control.getAttribute("aria-label") && !control.getAttribute("aria-labelledby"))
    .map((control) => control.getAttribute("name") || control.tagName.toLowerCase()));

  expect.soft(violationTargets(loginResults)).toEqual([]);
  expect.soft(violationTargets(signupResults)).toEqual([]);
  expect({ login: loginUnlabelled, signup: signupUnlabelled }).toEqual({ login: [], signup: [] });
});

test("failed actions use an assertive live region", async ({ page }, testInfo) => {
  await openAuth(page);
  await page.locator('input[name="loginId"]').fill(`missing-${testInfo.project.name}-${testInfo.repeatEachIndex}@example.invalid`);
  await page.locator('input[name="password"]').fill("wrong");
  await page.locator('form[data-form="login"] button[type="submit"]').click();

  const alert = page.getByRole("alert");
  await expect(alert).toContainText("올바르지 않습니다");
  await expect(alert).toHaveAttribute("aria-live", "assertive");
  await expect(alert).toHaveAttribute("aria-atomic", "true");

});

test("successful actions use a polite live region", async ({ page }) => {
  await loginAs(page, "student");
  const status = page.locator('.toast[role="status"]');
  await expect(status).toContainText("로그인되었습니다");
  await expect(status).toHaveAttribute("aria-live", "polite");
  await expect(status).toHaveAttribute("aria-atomic", "true");
});

test("tabs expose relationships and support roving keyboard focus", async ({ page }) => {
  await loginAs(page, "admin");
  await clickVisible(page, '[data-admin-view="users"]');

  const tablist = page.getByRole("tablist", { name: "학생 승인 상태 필터" });
  const tabs = tablist.getByRole("tab");
  await expect(tabs).toHaveCount(5);

  const first = tabs.nth(0);
  const second = tabs.nth(1);
  await expect(first).toHaveAttribute("aria-selected", "true");
  await expect(first).toHaveAttribute("tabindex", "0");
  await expect(second).toHaveAttribute("tabindex", "-1");
  await expect(first).toHaveAttribute("id", /.+/);
  await expect(tablist).toHaveAttribute("id", /.+/);

  await first.focus();
  await first.press("ArrowRight");
  await expect(second).toBeFocused();
  await expect(second).toHaveAttribute("aria-selected", "true");
  await expect(first).toHaveAttribute("tabindex", "-1");

  await second.press("Home");
  await expect(first).toBeFocused();
});

test("roving tab focus survives a delayed render", async ({ page }) => {
  await openAuth(page);
  await page.evaluate(async () => {
    const { tabs } = await import("/js/ui.js?v=20260714-mobile-card-r6");
    const host = document.createElement("section");
    host.id = "delayed-tab-fixture";
    const renderTabs = (active) => {
      host.innerHTML = tabs([["one", "첫 번째"], ["two", "두 번째"]], {
        active,
        id: "delayed-tabs",
        dataset: "delayed-tab",
        ariaLabel: "지연 탭"
      });
    };
    renderTabs("one");
    host.addEventListener("click", (event) => {
      const key = event.target.closest?.("[data-delayed-tab]")?.dataset.delayedTab;
      if (!key) return;
      setTimeout(() => renderTabs(key), 700);
    });
    document.querySelector("#app").append(host);
  });

  const tablist = page.getByRole("tablist", { name: "지연 탭" });
  const second = tablist.getByRole("tab", { name: "두 번째" });
  await tablist.getByRole("tab", { name: "첫 번째" }).focus();
  await tablist.getByRole("tab", { name: "첫 번째" }).press("ArrowRight");
  await page.waitForTimeout(900);
  await expect(second).toBeFocused();
});

test("tab helper creates stable tab-to-panel relationships", async ({ page }) => {
  await openAuth(page);
  await page.evaluate(async () => {
    const { tabIds, tabPanel, tabs } = await import("/js/ui.js?v=20260714-mobile-card-r6");
    const ids = tabIds({ id: "fixture-tabs" });
    const host = document.createElement("div");
    host.id = "semantic-tab-fixture";
    host.innerHTML = tabs([["one", "첫 번째"], ["two", "두 번째"]], {
      active: "one",
      id: "fixture-tabs",
      panelId: ids.panelId,
      ariaLabel: "의미론 탭"
    }) + tabPanel({
      id: ids.panelId,
      labelledBy: ids.tabId("one", 0),
      body: "패널 내용"
    });
    document.body.append(host);
  });

  const tab = page.getByRole("tab", { name: "첫 번째" });
  const panel = page.getByRole("tabpanel");
  await expect(tab).toHaveAttribute("aria-controls", "fixture-tabs-tabpanel");
  await expect(panel).toHaveAttribute("id", "fixture-tabs-tabpanel");
  await expect(panel).toHaveAttribute("aria-labelledby", await tab.getAttribute("id"));
});

test("production student tabs control a labelled panel", async ({ page }) => {
  await loginAs(page, "student");
  await page.evaluate(async () => {
    const { state } = await import("/js/state.js?v=20260714-mobile-card-r6");
    const { render } = await import("/js/renderer.js?v=20260714-mobile-card-r6");
    state.view = "mine";
    state.myReservations = [{
      id: "accessibility-reservation",
      type: "equipment",
      status: "approved",
      fields: { reservedDate: "2099-01-05", period: "당일", rentalTime: "10:15", returnTime: "17:10" },
      equipmentItems: []
    }];
    render();
  });

  const tablist = page.getByRole("tablist", { name: "내 예약 카테고리" });
  const activeTab = tablist.getByRole("tab", { selected: true });
  const panelId = await activeTab.getAttribute("aria-controls");
  expect(panelId).toBeTruthy();
  const panel = page.locator(`#${panelId}`);
  await expect(panel).toHaveAttribute("role", "tabpanel");
  await expect(panel).toHaveAttribute("aria-labelledby", await activeTab.getAttribute("id"));
});

test("view replacement restores focus to a stable navigation target", async ({ page }) => {
  await loginAs(page, "student");
  const scrollBefore = await page.evaluate(() => {
    const shell = document.querySelector(".student-shell");
    const target = shell && shell.scrollHeight > shell.clientHeight ? shell : document.scrollingElement;
    target.scrollTop = Math.min(80, Math.max(0, target.scrollHeight - target.clientHeight));
    return target.scrollTop;
  });
  const shortcut = page.locator('[data-reserve-shortcut="equipment"]');
  await shortcut.focus();
  await shortcut.click();

  await expect(shortcut).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => {
    const active = document.activeElement;
    return Boolean(active?.matches("main h1, main [data-page-heading]"));
  })).toBe(true);
  if (scrollBefore > 0) {
    await expect.poll(() => page.evaluate(() => {
      const shell = document.querySelector(".student-shell");
      const target = shell && shell.scrollHeight > shell.clientHeight ? shell : document.scrollingElement;
      return target.scrollTop;
    })).toBe(scrollBefore);
  }
});

test("legacy dialogs receive focus and restore it to their trigger", async ({ page }) => {
  await loginAs(page, "student");
  await page.evaluate(async () => {
    const { state } = await import("/js/state.js?v=20260714-mobile-card-r6");
    const { render } = await import("/js/renderer.js?v=20260714-mobile-card-r6");
    state.view = "notices";
    state.bootstrap.notices = [{
      id: "focus-notice",
      category: "학과",
      title: "포커스 확인 공지",
      body: "공지 상세 포커스 이동을 확인합니다.",
      pinned: false,
      createdAt: "2099-01-01T00:00:00.000Z"
    }];
    render();
  });
  const trigger = page.locator("[data-notice-open]:visible").first();
  await expect(trigger).toBeVisible();
  const noticeId = await trigger.getAttribute("data-notice-open");
  await trigger.focus();
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "공지사항 상세" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("button[data-notice-close]")).toBeFocused();
  await dialog.locator("button[data-notice-close]").click();

  await expect(page.locator(`[data-notice-open="${noticeId}"]`).first()).toBeFocused();
});
