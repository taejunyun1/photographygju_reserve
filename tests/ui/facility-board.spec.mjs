import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { loginReactAdmin, loginReactStudent } from "./support/session.mjs";

const projectIndex = (name) => ["mobile-390", "mobile-430", "tablet-768", "desktop-1440"].indexOf(name);
const fixtureCleanup = new Map();
const addDays = (count) => {
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  return new Date(Date.parse(`${today}T00:00:00Z`) + count * 86400000).toISOString().slice(0, 10);
};
const futureWeekday = (index) => {
  const weekdays = Array.from({ length: 28 }, (_, day) => addDays(day + 1))
    .filter((date) => ![0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay()));
  return weekdays[index];
};
async function api(request, method, path, token, data) {
  const response = await request.fetch(path, { method, headers: token ? { authorization: `Bearer ${token}` } : {}, data });
  const payload = await response.json();
  expect(response.ok(), `${path}: ${payload.error || response.status()}`).toBeTruthy();
  return payload.data;
}
async function fixtures(request, testInfo, offset) {
  const admin = await api(request, "POST", "/api/auth/login", "", { loginId: "admin", password: "admin" });
  const cleanup = { token: admin.token, reservations: [], equipment: [] };
  fixtureCleanup.set(testInfo.testId, cleanup);
  const student = await api(request, "POST", "/api/auth/login", "", { loginId: "student@example.com", password: "fixture-password" });
  const date = futureWeekday(projectIndex(testInfo.project.name) * 3 + offset);
  const fields = { reservedDate: date, phone: "01000000000", timeSlots: ["14:00-16:00"] };
  const other = await api(request, "POST", "/api/reservations", admin.token, { type: "studio", fields: { ...fields, studioSpace: "Studio A Front" } });
  cleanup.reservations.push(other.id);
  const mine = await api(request, "POST", "/api/reservations", student.token, { type: "studio", fields: { ...fields, studioSpace: "Studio A Back" } });
  cleanup.reservations.push(mine.id);
  const equipment = await api(request, "POST", "/api/admin/equipment", admin.token, { name: `현황판 LED ${testInfo.project.name}-${offset}`, category: "Lighting", brand: "Godox", model: `SL60W-${projectIndex(testInfo.project.name)}-${offset}`, status: "가능", quantity: 1 });
  const item = equipment[0];
  cleanup.equipment.push(item.id);
  const rental = await api(request, "POST", "/api/reservations", student.token, { type: "equipment", fields: { reservedDate: date, phone: "01000000000", period: "당일", rentalTime: "12:00", returnTime: "17:10", equipmentItemIds: [item.id] } });
  cleanup.reservations.push(rental.id);
  return { date, admin, student, other, mine, item };
}
test.afterEach(async ({ request }, testInfo) => {
  const cleanup = fixtureCleanup.get(testInfo.testId);
  if (!cleanup) return;
  fixtureCleanup.delete(testInfo.testId);
  for (const id of cleanup.reservations) await api(request, "DELETE", `/api/admin/reservations/${encodeURIComponent(id)}`, cleanup.token);
  for (const id of cleanup.equipment) await api(request, "PATCH", `/api/admin/equipment/${encodeURIComponent(id)}`, cleanup.token, { active: false });
});
async function selectTime(board, date) {
  await board.getByLabel("현황 조회 날짜", { exact: true }).fill(date);
  await board.getByLabel("조회 시작 시간", { exact: true }).fill("14:00");
  await expect(board.getByRole("group", { name: "공간 요약", exact: true })).toBeVisible();
}
async function noPageOverflow(page) {
  const widths = await page.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth }));
  expect(widths.page).toBeLessThanOrEqual(widths.viewport + 1);
}

test("Facility board admin main uses real schedule, keeps names and opens the management record", async ({ page, request }, testInfo) => {
  const fixture = await fixtures(request, testInfo, 0);
  const quietRequests = [];
  page.on("request", (request) => { if (new URL(request.url()).pathname === "/api/facility-timeline") quietRequests.push(request.url()); });
  await loginReactAdmin(page);
  const board = page.locator(".gju-facility-board");
  await expect(board).toBeVisible();
  await expect(page.locator("#react-admin-root .gju-card").first()).toHaveClass(/gju-facility-board/);
  await expect(board.getByRole("group", { name: "공간 요약", exact: true })).toBeVisible();
  expect(quietRequests).toHaveLength(0);
  await selectTime(board, fixture.date);
  const rail = board.getByRole("group", { name: "공간 요약", exact: true });
  await rail.getByRole("button", { name: /스튜디오 A/ }).click();
  const detail = board.getByRole("region", { name: "스튜디오 A 예약 요약" });
  await expect(detail).toContainText(fixture.admin.user.name);
  await expect(detail).toContainText(fixture.student.user.name);
  await expect(detail).toContainText("Studio A Front");
  await expect(detail).toContainText("Studio A Back");
  await expect(detail.getByRole("button", { name: "예약 상세", exact: true })).toHaveCount(2);
  await rail.getByRole("button", { name: /기자재실/ }).click();
  const equipment = board.getByRole("region", { name: "이 시간의 장비", exact: true });
  await expect(equipment).toContainText(fixture.item.name);
  await expect(equipment).toContainText("승인 대기");
  await expect(equipment.getByText("대여 중", { exact: true })).toHaveCount(0);
  await noPageOverflow(page);
  await expect(page.locator(".toast")).toBeHidden();
  await board.screenshot({ path: `outputs/facility-board-implementation/admin-${testInfo.project.name}.png` });
  await rail.getByRole("button", { name: /스튜디오 A/ }).click();
  await detail.getByRole("button", { name: "예약 상세", exact: true }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "예약 관리" })).toBeVisible();
});

test("Facility board student main redacts other users and starts the selected reservation without guessing a zone", async ({ page, request }, testInfo) => {
  const fixture = await fixtures(request, testInfo, 1);
  const response = await api(request, "GET", `/api/facility-timeline?date=${fixture.date}&viewer=admin`, fixture.student.token);
  const serialized = JSON.stringify(response);
  expect(serialized).not.toContain(fixture.admin.user.name);
  expect(serialized).not.toContain(fixture.other.id);
  expect(serialized).not.toContain(fixture.item.code);
  expect(response.viewer).toBe("student");
  await loginReactStudent(page);
  const board = page.locator(".gju-facility-board");
  await expect(board).toBeVisible();
  await selectTime(board, fixture.date);
  const rail = board.getByRole("group", { name: "공간 요약", exact: true });
  await rail.getByRole("button", { name: /스튜디오 A/ }).click();
  const detail = board.getByRole("region", { name: "스튜디오 A 예약 요약" });
  await expect(detail).toContainText("내 예약");
  await expect(detail).toContainText("예약 있음");
  await expect(detail).not.toContainText(fixture.admin.user.name);
  await expect(detail.getByRole("button", { name: "내 예약 상세", exact: true })).toHaveCount(1);
  await detail.getByRole("button", { name: "닫기", exact: true }).click();
  if ((page.viewportSize()?.width || 0) <= 620) {
    await board.getByRole("tab", { name: "시간표", exact: true }).click();
    await expect(board.getByRole("table")).toBeVisible();
    await board.getByRole("tab", { name: "평면도", exact: true }).click();
    await board.getByRole("button", { name: "확대", exact: true }).click();
    await expect(board.locator(".gju-facility-board__floor-viewport")).toHaveClass(/is-zoomed/);
    await board.getByRole("button", { name: "전체 보기", exact: true }).click();
  }
  await noPageOverflow(page);
  const axe = await new AxeBuilder({ page }).include(".gju-facility-board").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations.filter((violation) => ["critical", "serious"].includes(violation.impact))).toEqual([]);
  await expect(page.locator(".toast")).toBeHidden();
  await board.screenshot({ path: `outputs/facility-board-implementation/student-${testInfo.project.name}.png` });
  await rail.getByRole("button", { name: /스튜디오 A/ }).click();
  await detail.getByRole("button", { name: "이 조건으로 예약", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "예약 신청", exact: true })).toBeVisible();
  const selected = await page.evaluate(async () => {
    const { state } = await import("/js/state.js?v=20261014-photo-picker-r1");
    return { type: state.reservationType, date: state.selectedDates.studio, space: state.selectedStudioSpace, slots: state.selectedStudioSlots };
  });
  expect(selected).toEqual({ type: "studio", date: fixture.date, space: "", slots: [] });
});

test("Facility board refresh preserves selection and marks a failed request without inventing empty data", async ({ page }) => {
  await loginReactStudent(page);
  const board = page.locator(".gju-facility-board");
  await expect(board.getByRole("group", { name: "공간 요약", exact: true })).toBeVisible();
  await board.getByLabel("조회 시작 시간", { exact: true }).fill("10:30");
  await page.route("**/api/facility-timeline?**", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, error: "fixture unavailable" }) }));
  await page.evaluate(() => document.dispatchEvent(new CustomEvent("gju-facility-resume")));
  await expect(board.getByRole("alert")).toContainText("갱신 실패");
  await expect(board.getByRole("alert")).toContainText("마지막 자료");
  await expect(board.getByLabel("조회 시작 시간", { exact: true })).toHaveValue("10:30");
  await page.unroute("**/api/facility-timeline?**");
  await board.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(board.getByRole("alert")).toHaveCount(0);
  await expect(board.getByLabel("조회 시작 시간", { exact: true })).toHaveValue("10:30");
});

test("Facility board equipment booking keeps the exact inventory ID and selected date", async ({ page, request }, testInfo) => {
  const fixture = await fixtures(request, testInfo, 2);
  await loginReactStudent(page);
  const board = page.locator(".gju-facility-board");
  await selectTime(board, fixture.date);
  await board.getByRole("group", { name: "공간 요약", exact: true }).getByRole("button", { name: /기자재실/ }).click();
  const equipment = board.getByRole("region", { name: "이 시간의 장비", exact: true });
  await expect(equipment).toContainText(fixture.item.name);
  await equipment.getByRole("button", { name: "이 장비 예약", exact: true }).click();
  await expect(page.getByRole("heading", { name: "예약 신청", exact: true })).toBeVisible();
  const selected = await page.evaluate(async () => {
    const { state } = await import("/js/state.js?v=20261014-photo-picker-r1");
    return { type: state.reservationType, date: state.selectedDates.equipment, items: state.selectedEquipmentItemIds };
  });
  expect(selected).toEqual({ type: "equipment", date: fixture.date, items: [fixture.item.id] });
});

test("Facility board immediately loads a new date while the previous date is still pending", async ({ page }) => {
  await loginReactStudent(page);
  const board = page.locator(".gju-facility-board");
  await expect(board.getByRole("group", { name: "공간 요약", exact: true })).toBeVisible();
  const first = addDays(1), second = addDays(2);
  let releaseFirst;
  const hold = new Promise((resolve) => { releaseFirst = resolve; });
  let firstStarted;
  const started = new Promise((resolve) => { firstStarted = resolve; });
  await page.route(`**/api/facility-timeline?date=${first}`, async (route) => {
    firstStarted();
    await hold;
    await route.continue();
  });
  try {
    await board.getByLabel("현황 조회 날짜", { exact: true }).fill(first);
    await started;
    const nextResponse = page.waitForResponse((response) => response.url().includes(`/api/facility-timeline?date=${second}`), { timeout: 2500 });
    await board.getByLabel("현황 조회 날짜", { exact: true }).fill(second);
    await nextResponse;
    await expect(board.getByRole("group", { name: "공간 요약", exact: true })).toBeVisible();
    await expect(board.getByLabel("현황 조회 날짜", { exact: true })).toHaveValue(second);
  } finally {
    releaseFirst();
  }
});
