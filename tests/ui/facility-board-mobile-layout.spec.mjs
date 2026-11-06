import { expect, test } from "@playwright/test";
import { loginReactStudent } from "./support/session.mjs";
import { facilityLayoutNow, seedFacilityLayout } from "./support/facility-layout-fixture.mjs";

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!["mobile-390", "ios-webkit"].includes(testInfo.project.name), "Narrow widths are covered once per engine");
  await page.clock.setFixedTime(facilityLayoutNow);
  await loginReactStudent(page);
  await expect(page.locator(".toast")).toBeHidden();
  await seedFacilityLayout(page);
});

async function expectStacked(page, detailSelector) {
  const result = await page.locator(".gju-facility-board__body").evaluate((body, detailSelector) => {
    const bounds = body.getBoundingClientRect();
    const selectors = [".gju-facility-board__controls", ".gju-facility-board__status-line", ".gju-facility-board__toolbar", ".gju-facility-board__views", detailSelector].filter(Boolean);
    return {
      width: innerWidth, pageWidth: document.documentElement.scrollWidth, body: { left: bounds.left, right: bounds.right, width: bounds.width },
      blocks: selectors.map((selector) => {
        const el = body.querySelector(selector), r = el.getBoundingClientRect();
        return { selector, left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, scroll: el.scrollWidth, client: el.clientWidth };
      }),
      inputs: [...body.querySelectorAll("input")].map((el) => {
        const r = el.getBoundingClientRect(), parent = el.parentElement.getBoundingClientRect();
        return { left: r.left, right: r.right, parentLeft: parent.left, parentRight: parent.right, height: r.height, font: parseFloat(getComputedStyle(el).fontSize) };
      })
    };
  }, detailSelector);
  expect(result.pageWidth).toBeLessThanOrEqual(result.width + 1);
  for (const [index, block] of result.blocks.entries()) {
    expect(block.width, JSON.stringify(block)).toBeGreaterThanOrEqual(result.body.width - 1);
    expect(block.left).toBeGreaterThanOrEqual(result.body.left - 1);
    expect(block.right).toBeLessThanOrEqual(result.body.right + 1);
    expect(block.scroll, block.selector).toBeLessThanOrEqual(block.client + 1);
    if (index) expect(block.top, `${block.selector} overlaps its preceding section`).toBeGreaterThanOrEqual(result.blocks[index - 1].bottom);
  }
  for (const input of result.inputs) {
    expect(input.left).toBeGreaterThanOrEqual(input.parentLeft - 1);
    expect(input.right).toBeLessThanOrEqual(input.parentRight + 1);
    expect(input.height).toBeGreaterThanOrEqual(44);
    expect(input.font).toBeGreaterThanOrEqual(16);
  }
}

test("Facility selections keep controls, map and expanded content full width without overlap", async ({ page }, testInfo) => {
  const board = page.locator(".gju-facility-board");
  const rail = board.getByRole("group", { name: "공간 요약", exact: true });
  for (const width of [320, 375, 390, 430, 620]) {
    await page.setViewportSize({ width, height: 844 });
    await expectStacked(page);
    await rail.getByRole("button", { name: /기자재실/ }).click();
    const gear = board.getByRole("region", { name: "이 시간의 장비", exact: true });
    await expect(gear.locator("li")).toHaveCount(3);
    await expectStacked(page, ".gju-facility-board__equipment-area");
    const headers = await gear.locator(".gju-facility-board__equipment-top").evaluateAll((elements) => elements.map((el) => {
      const name = el.querySelector("strong").getBoundingClientRect(), badge = el.querySelector(".gju-status-badge").getBoundingClientRect();
      return { nameTop: name.top, badgeTop: badge.top, nameRight: name.right, badgeLeft: badge.left, client: el.clientWidth, scroll: el.scrollWidth };
    }));
    for (const header of headers) {
      expect(Math.abs(header.nameTop - header.badgeTop)).toBeLessThanOrEqual(1);
      expect(header.nameRight).toBeLessThanOrEqual(header.badgeLeft);
      expect(header.scroll).toBeLessThanOrEqual(header.client + 1);
    }
    if (await gear.locator("details").first().getAttribute("open") === null) await gear.getByLabel("소니 A7M3 장비 정보", { exact: true }).click();
    await expect(gear.locator("details").first()).toHaveAttribute("open", "");
    await expectStacked(page, ".gju-facility-board__equipment-area");
    const actions = await gear.locator("li").first().evaluate((el) => ({ info: el.querySelector("summary").getBoundingClientRect().bottom, reserve: el.querySelector('button[aria-label="이 장비 예약"]').getBoundingClientRect().top }));
    expect(actions.reserve).toBeGreaterThanOrEqual(actions.info);
    if (width === 390) await board.screenshot({ path: `outputs/facility-overflow-20261106/after-gear-${testInfo.project.name}.png` });
    await rail.getByRole("button", { name: /스튜디오 A/ }).click();
    const detail = board.getByRole("region", { name: "스튜디오 A 예약 요약" });
    await expect(detail).toContainText("010-0000-0000");
    await expectStacked(page, ".gju-facility-board__detail");
    const contact = await detail.locator(".gju-facility-board__contact").evaluate((el) => ({ client: el.clientWidth, scroll: el.scrollWidth, width: el.getBoundingClientRect().width, row: el.parentElement.getBoundingClientRect().width }));
    expect(contact.scroll).toBeLessThanOrEqual(contact.client + 1);
    expect(contact.width).toBeGreaterThanOrEqual(contact.row - 1);
    if (width === 390) await board.screenshot({ path: `outputs/facility-overflow-20261106/after-studio-${testInfo.project.name}.png` });
    await detail.getByRole("button", { name: "닫기", exact: true }).click();
  }
});

test("Native bottom navigation uses the safe inset and leaves the last action reachable", async ({ page }) => {
  await page.evaluate(() => { document.documentElement.dataset.nativeApp = "true"; });
  const board = page.locator(".gju-facility-board");
  await board.getByRole("group", { name: "공간 요약", exact: true }).getByRole("button", { name: /기자재실/ }).click();
  for (const width of [320, 390, 620]) {
    await page.setViewportSize({ width, height: 844 });
    const button = board.getByRole("button", { name: "장비 예약하기", exact: true });
    await button.scrollIntoViewIfNeeded();
    const nav = await page.locator(".gju-app-shell__bottom-nav").evaluate((el) => ({ top: el.getBoundingClientRect().top, padding: parseFloat(getComputedStyle(el).paddingBottom) }));
    expect(nav.padding).toBeGreaterThanOrEqual(34);
    const rect = await button.boundingBox();
    expect(rect.y + rect.height).toBeLessThanOrEqual(nav.top - 16);
  }
});

test("Facility map zoom and timetable scroll stay inside the card", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  const board = page.locator(".gju-facility-board");
  await board.getByRole("button", { name: "확대", exact: true }).click();
  await expectStacked(page);
  const zoom = board.locator(".gju-facility-board__floor-viewport");
  expect(await zoom.evaluate((el) => el.scrollWidth > el.clientWidth)).toBeTruthy();
  await board.getByRole("tab", { name: "시간표", exact: true }).click();
  await expectStacked(page);
  const timeline = board.locator(".gju-facility-board__timeline-scroll");
  expect(await timeline.evaluate((el) => el.scrollWidth > el.clientWidth)).toBeTruthy();
  const controls = await board.locator(".gju-facility-board__toolbar button, .gju-facility-board__summary button").evaluateAll((elements) => elements.map((el) => ({ label: el.getAttribute("aria-label"), width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })));
  for (const control of controls) {
    expect(control.width, control.label).toBeGreaterThanOrEqual(44);
    expect(control.height, control.label).toBeGreaterThanOrEqual(44);
  }
});
