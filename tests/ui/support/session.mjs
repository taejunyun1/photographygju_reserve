import { expect } from "@playwright/test";

export async function openAuth(page) {
  await page.route("**/config.js", async (route) => {
    await route.fulfill({
      contentType: "text/javascript; charset=utf-8",
      body: "window.GJU_API_BASE = ''; window.GJU_REACT_ADMIN_ENABLED = false; window.GJU_REACT_STUDENT_ENABLED = false;"
    });
  });
  await page.goto("/");
  await expect(page.locator('form[data-form="login"]')).toBeVisible();
}

export async function loginAs(page, role) {
  await openAuth(page);
  await page.locator('input[name="loginId"]').fill(role === "admin" ? "admin" : "student@example.com");
  await page.locator('input[name="password"]').fill(role === "admin" ? "admin" : "fixture-password");
  await page.locator('form[data-form="login"] button[type="submit"]').click();
  await expect(page.locator(role === "admin" ? ".admin-shell" : ".student-shell")).toBeVisible();
  await expect(page.locator(".toast")).toContainText("로그인되었습니다");
}

export async function openReactAdmin(page) {
  await page.route("**/config.js", async (route) => {
    await route.fulfill({
      contentType: "text/javascript; charset=utf-8",
      body: "window.GJU_API_BASE = ''; window.GJU_REACT_ADMIN_ENABLED = true; window.GJU_REACT_STUDENT_ENABLED = false;"
    });
  });
  await page.goto("/");
  await expect(page.locator('form[data-form="login"]')).toBeVisible();
}

export async function loginReactAdmin(page) {
  await openReactAdmin(page);
  await page.locator('input[name="loginId"]').fill("admin");
  await page.locator('input[name="password"]').fill("admin");
  await page.locator('form[data-form="login"] button[type="submit"]').click();
  await expect(page.locator(".gju-app-shell")).toBeVisible();
  await expect(page.locator(".toast")).toContainText("로그인되었습니다");
}

export async function openReactStudent(page) {
  await page.route("**/config.js", async (route) => {
    await route.fulfill({
      contentType: "text/javascript; charset=utf-8",
      body: "window.GJU_API_BASE = ''; window.GJU_REACT_ADMIN_ENABLED = true; window.GJU_REACT_STUDENT_ENABLED = true;"
    });
  });
  await page.goto("/");
  await expect(page.locator('form[data-form="login"]')).toBeVisible();
}

export async function loginReactStudent(page) {
  await openReactStudent(page);
  await page.locator('input[name="loginId"]').fill("student@example.com");
  await page.locator('input[name="password"]').fill("fixture-password");
  await page.locator('form[data-form="login"] button[type="submit"]').click();
  await expect(page.locator(".student-react-shell")).toBeVisible();
  await expect(page.locator(".toast")).toContainText("로그인되었습니다");
}

export async function clickVisible(page, selector) {
  await page.locator(`${selector}:visible`).first().click();
}
