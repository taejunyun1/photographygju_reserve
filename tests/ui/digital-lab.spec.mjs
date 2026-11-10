import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { openReactStudent } from "./support/session.mjs";

const password = "digital-lab-fixture";
const phone = "010-0000-0101";
const purpose = "디지털 인화 편집";
const facility = "디지털사진영상실";
const projectOffsets = { "mobile-390": 0, "mobile-430": 4, "tablet-768": 8, "desktop-1440": 12 };

async function api(request, method, path, data, token) {
  const response = await request.fetch(path, {
    method, data,
    headers: token ? { authorization: `Bearer ${token}` } : {}
  });
  const body = await response.json();
  expect(response.ok(), `${method} ${path}: ${body.error || response.status()}`).toBe(true);
  return body.data;
}

async function approvedStudent(request, adminToken) {
  const key = randomUUID();
  const email = `lab-${key}@example.test`;
  const { user } = await api(request, "POST", "/api/auth/signup", {
    name: "디지털실 테스트", email, phone, password, studentStatus: "재학생"
  });
  await api(request, "PATCH", `/api/admin/users/${user.id}/approval`, { approvalStatus: "approved" }, adminToken);
  const { token } = await api(request, "POST", "/api/auth/login", { loginId: email, password });
  return { email, token };
}

async function setup(page, request) {
  const { token: adminToken } = await api(request, "POST", "/api/auth/login", { loginId: "admin", password: "admin" });
  await api(request, "PATCH", "/api/admin/settings", {
    digitalLabEnabled: true, digitalLabOpenTime: "00:00", digitalLabCloseTime: "24:00"
  }, adminToken);
  const student = await approvedStudent(request, adminToken);
  await openReactStudent(page);
  await page.locator('input[name="loginId"]').fill(student.email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('form[data-form="login"] button[type="submit"]').click();
  await expect(page.locator(".student-react-shell")).toBeVisible();
  return { adminToken, student };
}

function koreaDate(offset = 0) {
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
  return new Date(Date.parse(`${today}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
}

function futureDate(info, offset) {
  return koreaDate(2 + (projectOffsets[info.project.name] || 0) + offset);
}

function next(page) {
  return page.getByRole("button", { name: "다음", exact: true });
}

function seat(page, label) {
  return page.getByRole("button", { name: new RegExp(`^${label}(?: |$)`) });
}

async function start(page, date) {
  await page.getByRole("button", { name: "새 예약", exact: true }).click();
  const card = page.getByRole("button", { name: new RegExp(facility) });
  await expect(card).toBeVisible();
  await card.click();
  await page.getByLabel("사용일", { exact: true }).fill(date);
  await next(page).click();
}

async function chooseTime(page, label) {
  await page.getByRole("button", { name: label, exact: true }).click();
}

async function confirmSeat(page, label) {
  await seat(page, label).click();
  await next(page).click();
}

async function openMine(page) {
  await page.getByRole("navigation", { name: "학생 메뉴" })
    .getByRole("button", { name: "내 예약", exact: true }).filter({ visible: true }).click();
}

test("student books one of 12 Mac and four PC seats, edits the same booking and cancels it", async ({ page, request }, info) => {
  const { student } = await setup(page, request);
  const date = futureDate(info, 0);
  await start(page, date);
  await chooseTime(page, "10:00–12:00");
  await page.getByLabel("종료 시간", { exact: true }).selectOption("14:00");
  await next(page).click();
  await expect(seat(page, "Mac [0-9]{2}")).toHaveCount(12);
  await expect(seat(page, "PC [0-9]{2}")).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
  if (info.project.name === "mobile-390") {
    await expect(page.locator(".toast")).toBeHidden();
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: info.outputPath("digital-lab-seats.png"), fullPage: true });
  }
  await confirmSeat(page, "PC 04");
  await expect(page.getByText(/PC 04.*10:00–14:00/)).toBeVisible();
  await page.getByLabel("사용 목적").fill(purpose);
  await page.getByLabel("연락처").fill(phone);
  const created = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/reservations" && response.request().method() === "POST");
  await page.getByRole("button", { name: "예약 신청", exact: true }).click();
  const createResponse = await created;
  expect(createResponse.status()).toBe(200);
  const { data: booking } = await createResponse.json();
  expect(booking.fields).toMatchObject({ seatId: "pc-04", startTime: "10:00", endTime: "14:00" });
  await openMine(page);
  await page.getByRole("tab", { name: facility, exact: true }).click();
  await expect(page.getByRole("heading", { name: `${facility} 예약`, exact: true })).toBeVisible();
  await expect(page.getByText(/PC 04.*10:00–14:00/)).toBeVisible();

  const nav = page.getByRole("navigation", { name: "학생 메뉴" });
  await nav.getByRole("button", { name: "홈", exact: true }).filter({ visible: true }).click();
  const home = page.getByRole("region", { name: "내 예약", exact: true });
  await expect(home).toContainText(facility);
  await expect(home).toContainText("PC 04");
  await expect(home).toContainText("10:00–14:00");
  await openMine(page);

  const availability = page.waitForResponse((response) => new URL(response.url()).searchParams.get("editingId") === booking.id);
  await page.getByRole("button", { name: "예약 수정" }).click();
  expect((await availability).status()).toBe(200);
  await expect(seat(page, "PC 04")).toHaveAttribute("aria-pressed", "true");
  await expect(seat(page, "PC 04")).toBeEnabled();
  await confirmSeat(page, "Mac 12");
  await expect(page.getByLabel("사용 목적")).toHaveValue(purpose);
  await expect(page.getByLabel("연락처")).toHaveValue(phone);
  const edited = page.waitForResponse((response) => response.url().endsWith(`/api/reservations/${booking.id}`) && response.request().method() === "PATCH");
  await page.getByRole("button", { name: "변경 저장" }).click();
  expect((await edited).status()).toBe(200);
  await expect(page.getByText(/Mac 12.*10:00–14:00/)).toBeVisible();

  await nav.getByRole("button", { name: "홈", exact: true }).filter({ visible: true }).click();
  await page.getByRole("button", { name: "새 예약", exact: true }).click();
  await page.locator(".student-react-rebooking-list").getByRole("button", { name: new RegExp(facility) }).click();
  await expect(page.getByLabel("사용일", { exact: true })).toHaveValue("");
  await page.getByLabel("사용일", { exact: true }).fill(date);
  await next(page).click();
  await expect(page.getByRole("button", { name: "10:00–12:00", exact: true })).toHaveAttribute("aria-pressed", "false");
  await chooseTime(page, "10:00–12:00");
  await next(page).click();
  await expect(seat(page, "Mac 12")).toBeDisabled();
  await expect(seat(page, "Mac 12")).toHaveAttribute("aria-pressed", "false");
  await openMine(page);

  page.once("dialog", (dialog) => dialog.accept());
  const cancelled = page.waitForResponse((response) => response.url().endsWith(`/api/reservations/${booking.id}/cancel`));
  await page.getByRole("button", { name: "예약 취소" }).click();
  expect((await cancelled).status()).toBe(200);
  await expect(page.getByText("취소", { exact: true })).toBeVisible();
  const { seats } = await api(request, "GET", `/api/digital-lab/availability?date=${date}&start=10:00&end=14:00`, undefined, student.token);
  expect(seats.find(({ id }) => id === "mac-12").available).toBe(true);
});

test("only future same-day slots are selectable and an older real response cannot replace newer seats", async ({ page, request }, info) => {
  const { adminToken } = await setup(page, request);
  const today = koreaDate();
  await page.clock.setFixedTime(new Date(`${today}T10:00:01+09:00`));
  await start(page, today);
  await expect(page.getByRole("button", { name: "00:00–02:00", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "10:00–12:00", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "12:00–14:00", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "22:00–24:00", exact: true })).toBeEnabled();

  const date = futureDate(info, 1);
  const competitor = await approvedStudent(request, adminToken);
  await api(request, "POST", "/api/reservations", {
    type: "digital_lab",
    fields: { reservedDate: date, seatId: "pc-04", startTime: "12:00", endTime: "14:00", purpose, phone }
  }, competitor.token);
  await page.getByRole("button", { name: "이전", exact: true }).click();
  await page.getByLabel("사용일", { exact: true }).fill(date);
  await next(page).click();

  let releaseOld;
  const holdOld = new Promise((resolve) => { releaseOld = resolve; });
  let notifyOld;
  const oldStarted = new Promise((resolve) => { notifyOld = resolve; });
  let releaseNew;
  const holdNew = new Promise((resolve) => { releaseNew = resolve; });
  await page.route("**/api/digital-lab/availability?*", async (route) => {
    const old = new URL(route.request().url()).searchParams.get("start") === "10:00";
    const response = await route.fetch();
    if (old) notifyOld();
    await (old ? holdOld : holdNew);
    await route.fulfill({ response });
  });

  await chooseTime(page, "10:00–12:00");
  await oldStarted;
  await chooseTime(page, "12:00–14:00");
  await expect(page.getByText("좌석 가용 상태를 확인하는 중입니다.")).toBeVisible();
  await expect(next(page)).toBeDisabled();
  releaseNew();
  await next(page).click();
  await expect(seat(page, "PC 04")).toBeDisabled();
  const oldReceived = page.waitForResponse((response) => new URL(response.url()).searchParams.get("start") === "10:00");
  releaseOld();
  await (await oldReceived).finished();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(seat(page, "PC 04")).toBeDisabled();
  await expect(seat(page, "Mac 01")).toBeEnabled();
});

test("a real save-time 409 refreshes seats and does not choose a replacement", async ({ page, request }, info) => {
  const { adminToken } = await setup(page, request);
  const date = futureDate(info, 2);
  await start(page, date);
  await chooseTime(page, "10:00–12:00");
  await next(page).click();
  await confirmSeat(page, "PC 04");
  await page.getByLabel("사용 목적").fill(purpose);
  const competitor = await approvedStudent(request, adminToken);
  await api(request, "POST", "/api/reservations", {
    type: "digital_lab",
    fields: { reservedDate: date, seatId: "pc-04", startTime: "10:00", endTime: "12:00", purpose, phone }
  }, competitor.token);
  const conflicted = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/reservations" && response.request().method() === "POST");
  await page.getByRole("button", { name: "예약 신청", exact: true }).click();
  expect((await conflicted).status()).toBe(409);
  await expect(page.getByRole("alert")).toContainText("선택한 좌석에 해당 시간의 예약이 있습니다.");
  await expect(seat(page, "PC 04")).toBeDisabled();
  await expect(seat(page, "PC 04")).toHaveAttribute("aria-pressed", "true");
  await expect(next(page)).toBeDisabled();
  await confirmSeat(page, "Mac 01");
  await expect(page.getByLabel("사용 목적")).toHaveValue(purpose);
});
