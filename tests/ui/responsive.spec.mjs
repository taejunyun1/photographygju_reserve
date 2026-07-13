import { expect, test } from "@playwright/test";
import { loginAs } from "./support/session.mjs";

async function expectNoDocumentOverflow(page) {
  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth
  }));
  expect(overflow.scrollWidth, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.clientWidth + 1);
  expect(overflow.bodyScrollWidth, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

test("student and legacy admin shells do not overflow the viewport", async ({ page }) => {
  await loginAs(page, "student");
  await expectNoDocumentOverflow(page);

  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await loginAs(page, "admin");
  await expectNoDocumentOverflow(page);
});

test("mobile navigation targets are at least 44px and every destination is reachable", async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(!viewport || viewport.width > 768, "Mobile and tablet navigation contract");

  for (const role of ["student", "admin"]) {
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    }).catch(() => {});
    await loginAs(page, role);

    const navSelector = role === "admin" ? ".admin-mobile-nav" : ".mobile-nav";
    const nav = page.locator(navSelector);
    await expect(nav).toBeVisible();
    const targets = nav.locator("button:visible, a:visible");
    expect(await targets.count()).toBeGreaterThan(0);

    for (let index = 0; index < await targets.count(); index += 1) {
      const target = targets.nth(index);
      const navigationState = await target.evaluate(async (element) => {
        const container = element.parentElement;
        if (!container) return null;
        const centeredLeft = element.offsetLeft - ((container.clientWidth - element.offsetWidth) / 2);
        container.scrollLeft = Math.max(0, centeredLeft);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return {
          clientWidth: container.clientWidth,
          scrollWidth: container.scrollWidth,
          scrollLeft: container.scrollLeft,
          targetOffsetLeft: element.offsetLeft
        };
      });
      const box = await target.boundingBox();
      expect(box, `${role} navigation item ${index} must have a box`).not.toBeNull();
      expect(box.width, `${role} navigation item ${index} width`).toBeGreaterThanOrEqual(44);
      expect(box.height, `${role} navigation item ${index} height`).toBeGreaterThanOrEqual(44);
      expect(box.x + box.width, JSON.stringify({ role, index, navigationState })).toBeGreaterThan(0);
      expect(box.x, JSON.stringify({ role, index, navigationState })).toBeLessThan(viewport.width);
    }

    await page.locator('[data-action="logout"]:visible').first().click();
    await expect(page.locator('form[data-form="login"]')).toBeVisible();
  }
});
