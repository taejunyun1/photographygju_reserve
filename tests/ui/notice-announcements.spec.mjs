import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { loginReactStudent } from "./support/session.mjs";

test("Unread notice toast opens its notice and stays read after reopening the app", async ({ page, context }, testInfo) => {
  const read = new Set();
  let owner = "";
  let writes = 0;
  let published = [{ id: "toast-notice", title: "기자재실 운영 시간 안내", body: "공지 상세 내용입니다.", createdAt: "2026-11-12" }];
  await context.route("**/api/bootstrap", async route => {
    const response = await route.fetch();
    const payload = await response.json();
    owner = payload.data.noticeReaderId || owner;
    payload.data.notices = published;
    payload.data.readNoticeIds = [...read];
    await route.fulfill({ response, json: payload });
  });
  await context.route("**/api/me/notices", route => route.fulfill({ json: { ok: true, data: { readerId: owner, notices: published, readNoticeIds: [...read] } } }));
  await context.route("**/api/me/notices/*/read", route => {
    expect(route.request().method()).toBe("POST");
    read.add(decodeURIComponent(new URL(route.request().url()).pathname.split("/").at(-2)));
    writes++;
    return route.fulfill({ json: { ok: true, data: { readerId: owner, readNoticeIds: [...read] } } });
  });

  await loginReactStudent(page);
  const toast = page.locator(".student-react-notice-announcement");
  await expect(page.locator(".toast")).toBeHidden();
  await expect(toast).toBeVisible();
  const result = await new AxeBuilder({ page }).include(".student-react-notice-announcement").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(result.violations.filter(v => ["serious", "critical"].includes(v.impact))).toEqual([]);
  const button = toast.getByRole("button", { name: "새 공지: 기자재실 운영 시간 안내", exact: true });
  const box = await button.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: `outputs/notice-announcements-20261112/notice-toast-${testInfo.project.name}.png`, fullPage: false });
  await button.click();
  await expect(page.getByRole("dialog").getByText("공지 상세 내용입니다.")).toBeVisible();
  await expect.poll(() => writes).toBe(1);
  await page.getByRole("dialog").getByRole("button", { name: "닫기", exact: true }).click();
  await expect(toast).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".student-react-shell")).toBeVisible();
  await expect(toast).toHaveCount(0);
  expect(writes).toBe(1);

  // A later announcement arrives through the quiet refresh without resetting read state.
  published = [...published, { id: "later-notice", title: "새로 등록된 공지", body: "새 공지 내용", createdAt: "2026-11-13" }];
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(toast.getByRole("button", { name: "새 공지: 새로 등록된 공지", exact: true })).toBeVisible();
  expect(read.has("toast-notice")).toBe(true);
});
