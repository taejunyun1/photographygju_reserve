import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { loginReactAdmin, openReactStudent } from "./support/session.mjs";

const password = "digital-lab-fixture";
const phone = "010-0000-0101";
const purpose = "디지털 인화 편집";
const facility = "디지털사진영상실";
const projectOffsets = { "mobile-390": 0, "mobile-430": 4, "tablet-768": 8, "desktop-1440": 12 };

async function api(request, method, path, data, token) {
  const response = await request.fetch(path, {
    method, data,
    // The local server can close an idle keep-alive socket during UI interaction.
    // Retry only a read on ECONNRESET; never a mutation or an HTTP error.
    maxRetries: method === "GET" ? 1 : 0,
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
  {
    await seat(page, "Mac 01").focus();
    await page.keyboard.press("Enter");
    await expect(seat(page, "Mac 01")).toHaveAttribute("aria-pressed", "true");
    await expect(seat(page, "Mac 01")).toContainText("예약 가능");
    const boxes = await page.getByRole("button", { name: /^(Mac|PC) [0-9]{2}/ }).evaluateAll(nodes => nodes.map(node => {
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, textFits: node.scrollWidth <= node.clientWidth && node.scrollHeight <= node.clientHeight };
    }));
    for (const [index, box] of boxes.entries()) {
      expect(box.textFits).toBe(true);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(page.viewportSize().width);
      for (const other of boxes.slice(index + 1)) expect(box.right <= other.x || other.right <= box.x || box.bottom <= other.y || other.bottom <= box.y).toBe(true);
    }
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

test("admin resolves a lab class conflict and resubmits the retained draft", async ({ page, request }, info) => {
  test.skip(info.project.name !== "mobile-390", "The shared settings fixture runs once to avoid competing class-list saves.");
  const { token: adminToken } = await api(request, "POST", "/api/auth/login", { loginId: "admin", password: "admin" });
  await loginReactAdmin(page);
  const more = page.getByRole("button", { name: "더보기", exact: true }).filter({ visible: true });
  async function openSettings() {
    if (await more.count()) await more.click();
    await page.getByRole("button", { name: "설정", exact: true }).filter({ visible: true }).click();
  }
  await openSettings();
  await page.getByText("운영 설정", { exact: true }).click();
  await page.getByLabel("디지털사진영상실 예약 활성화").check();
  await page.getByLabel("디지털사진영상실 운영 시작").selectOption("00:00");
  await page.getByLabel("디지털사진영상실 운영 종료").selectOption("24:00");
  const settingsSaved = page.waitForResponse((response) => response.url().endsWith("/api/admin/settings") && response.request().method() === "PATCH");
  await page.getByRole("button", { name: "설정 저장", exact: true }).click();
  const savedResponse = await settingsSaved;
  expect(savedResponse.status()).toBe(200);
  expect((await savedResponse.json()).data).toMatchObject({
    digitalLabEnabled: true, digitalLabOpenTime: "00:00", digitalLabCloseTime: "24:00"
  });
  await expect(page.locator(".toast")).toContainText("설정을 저장했습니다.");
  const student = await approvedStudent(request, adminToken);
  const date = futureDate(info, 3);
  const booking = await api(request, "POST", "/api/reservations", {
    type: "digital_lab",
    fields: { reservedDate: date, seatId: "pc-03", startTime: "10:00", endTime: "12:00", purpose, phone }
  }, student.token);
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "차단 일정 추가" }) });
  const calendar = page.getByRole("region", { name: "학기 차단 캘린더" });
  const calendarDay = calendar.getByRole("button", { name: `${date} 차단 일정 입력` });
  if (!(await calendarDay.count())) await calendar.getByRole("button", { name: "다음 달" }).click();
  const className = `디지털 편집 수업 ${info.project.name}`;
  await calendarDay.click();
  await form.getByRole("combobox", { name: "시설", exact: true }).selectOption("studio");
  await form.getByLabel("공간/메모", { exact: true }).fill("Studio A Front");
  await form.getByRole("button", { name: "차단 일정 추가" }).click();
  const studioCard = page.locator(".blocked-item").filter({ hasText: "Studio A Front" });
  await expect(studioCard).toBeVisible();
  await studioCard.getByRole("button", { name: "차단 일정 삭제" }).click();
  await expect(studioCard).toHaveCount(0);

  async function enterClass(start, end) {
    await calendarDay.click();
    await form.getByRole("combobox", { name: "시설", exact: true }).selectOption({ label: facility });
    await form.getByLabel("시작 시간", { exact: true }).fill(start);
    await form.getByLabel("종료 시간", { exact: true }).fill(end);
    await form.getByLabel("수업명", { exact: true }).fill(className);
  }
  await enterClass("12:10", "24:00");
  await form.getByRole("button", { name: "차단 일정 추가" }).click();
  const classCard = page.locator(".blocked-item").filter({ hasText: className });
  await expect(classCard).toContainText("16석 전체 차단");
  const calendarClasses = calendar.getByRole("region", { name: "선택 날짜 디지털사진영상실 수업" });
  await expect(calendarClasses.getByText(new RegExp(className))).toBeVisible();
  await expect(calendarClasses).toContainText("16석 전체 차단");
  await classCard.getByRole("button", { name: "차단 일정 삭제" }).click();
  await expect(classCard).toHaveCount(0);

  await enterClass("11:59", "24:00");
  const conflictResponse = page.waitForResponse((response) => response.url().endsWith("/api/admin/settings") && response.request().method() === "PATCH");
  await form.getByRole("button", { name: "차단 일정 추가" }).click();
  expect((await conflictResponse).status()).toBe(409);
  await expect(form.getByLabel("시작일", { exact: true })).toHaveValue(date);
  await expect(form.getByLabel("시작 시간", { exact: true })).toHaveValue("11:59");
  await expect(form.getByLabel("수업명", { exact: true })).toHaveValue(className);
  const conflicts = page.getByRole("region", { name: "차단 일정과 겹치는 예약" });
  await expect(conflicts).toContainText(date);
  await expect(conflicts).toContainText("PC 03");
  await expect(conflicts).toContainText("10:00");
  await expect(conflicts).toContainText("12:00");
  const detail = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/api/admin/reservations" && url.searchParams.get("q") === booking.id;
  });
  await conflicts.getByRole("button", { name: "예약 상세" }).click();
  const reservationResponse = await detail;
  expect(reservationResponse.status()).toBe(200);
  expect((await reservationResponse.json()).data.items.map(({ id }) => id)).toEqual([booking.id]);
  await expect(page.getByRole("heading", { level: 1, name: "예약 관리" })).toBeVisible();
  const card = page.locator(".admin-reservation-card").filter({ hasText: student.email });
  await expect(card).toBeVisible();
  const cancelled = page.waitForResponse((response) => response.url().endsWith(`/api/admin/reservations/${booking.id}/status`));
  await card.getByRole("button", { name: "관리자 취소", exact: true }).click();
  const cancellationResponse = await cancelled;
  expect(cancellationResponse.status()).toBe(200);
  expect((await cancellationResponse.json()).data.status).toBe("admin_cancelled");
  await expect(card.getByText("관리자 취소", { exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: "관리자 취소", exact: true })).toHaveCount(0);
  await expect(card.getByRole("button", { name: "좌석·시간 수정", exact: true })).toHaveCount(0);

  await openSettings();
  await expect(form.getByRole("combobox", { name: "시설", exact: true })).toHaveValue("digital_lab");
  await expect(form.getByRole("combobox", { name: "요일", exact: true })).toHaveValue(
    ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][new Date(date).getUTCDay()]
  );
  await expect(form.getByLabel("시작일", { exact: true })).toHaveValue(date);
  await expect(form.getByLabel("종료일", { exact: true })).toHaveValue(date);
  await expect(form.getByLabel("시작 시간", { exact: true })).toHaveValue("11:59");
  await expect(form.getByLabel("종료 시간", { exact: true })).toHaveValue("24:00");
  await expect(form.getByLabel("수업명", { exact: true })).toHaveValue(className);
  const retried = page.waitForResponse((response) => response.url().endsWith("/api/admin/settings") && response.request().method() === "PATCH");
  await form.getByRole("button", { name: "차단 일정 추가" }).click();
  expect((await retried).status()).toBe(200);
  await expect(classCard).toContainText("16석 전체 차단");
  const blocked = await request.post("/api/reservations", { headers: { authorization: `Bearer ${student.token}` }, data: {
    type: "digital_lab", fields: { reservedDate: date, seatId: "pc-03", startTime: "10:00", endTime: "12:00", purpose, phone }
  } });
  expect(blocked.status()).toBe(409);
  expect((await blocked.json()).error).toContain("수업");
  await page.screenshot({ path: info.outputPath("digital-lab-class.png"), fullPage: true });
  await expect(form.getByRole("combobox", { name: "시설", exact: true })).toHaveValue("studio");
  await expect(form.getByLabel("시작일", { exact: true })).toHaveValue("");
  await classCard.getByRole("button", { name: "차단 일정 삭제" }).click();
  await expect(classCard).toHaveCount(0);
  await api(request, "POST", "/api/reservations", { type: "digital_lab", fields: { reservedDate: date, seatId: "pc-03", startTime: "10:00", endTime: "12:00", purpose, phone } }, student.token);
  await page.getByRole("navigation", { name: "관리자 모바일 메뉴" }).getByRole("button", { name: "예약", exact: true }).click();
  await openSettings();
  await expect(form.getByRole("combobox", { name: "시설", exact: true })).toHaveValue("studio");
  await expect(form.getByLabel("시작일", { exact: true })).toHaveValue("");
});

test("admin filters and edits a lab reservation, keeping a conflicting draft", async ({ page, request }, info) => {
  const { token: adminToken } = await api(request, "POST", "/api/auth/login", { loginId: "admin", password: "admin" });
  await api(request, "PATCH", "/api/admin/settings", {
    digitalLabEnabled: true, digitalLabOpenTime: "00:00", digitalLabCloseTime: "24:00"
  }, adminToken);
  const student = await approvedStudent(request, adminToken);
  const other = await approvedStudent(request, adminToken);
  const date = futureDate(info, 0);
  const editedDate = futureDate(info, 1);
  const booking = await api(request, "POST", "/api/reservations", {
    type: "digital_lab", fields: { reservedDate: date, seatId: "mac-06", startTime: "06:00", endTime: "08:00", purpose, phone }
  }, student.token);
  await api(request, "POST", "/api/reservations", {
    type: "digital_lab", fields: { reservedDate: editedDate, seatId: "pc-02", startTime: "16:00", endTime: "18:00", purpose, phone }
  }, other.token);
  await loginReactAdmin(page);
  await page.getByRole("navigation", { name: /^관리자 (?:모바일 )?메뉴$/ })
    .getByRole("button", { name: /^예약(?: 관리)?$/ }).filter({ visible: true }).click();
  await page.getByRole("tab", { name: facility, exact: true }).click();
  const card = page.locator(".admin-reservation-card, .admin-react-desktop-table tbody tr")
    .filter({ hasText: student.email }).filter({ visible: true });
  await expect(card).toContainText("Mac 06");
  await expect(card.getByRole("button", { name: "완료", exact: true })).toHaveCount(0);
  await expect(card.getByRole("button", { name: "관리자 취소", exact: true })).toBeVisible();

  await page.getByRole("textbox", { name: "예약 검색" }).fill(`${facility} Mac 06`);
  await page.getByRole("button", { name: "검색", exact: true }).click();
  await expect(page.getByRole("tab", { name: "전체", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "좌석·시간 수정", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "디지털사진영상실 예약 수정" });
  const dateInput = dialog.getByLabel("사용일", { exact: true });
  const seatInput = dialog.getByRole("combobox", { name: "좌석", exact: true });
  const startInput = dialog.getByRole("combobox", { name: "시작 시간", exact: true });
  const endInput = dialog.getByRole("combobox", { name: "종료 시간", exact: true });
  await expect(seatInput).toHaveValue("mac-06");
  await expect(dateInput).toHaveValue(date);
  await expect(startInput).toHaveValue("06:00");
  await expect(endInput).toHaveValue("08:00");
  await dateInput.fill(editedDate);
  await startInput.selectOption("16:00");
  await endInput.selectOption("18:00");
  await seatInput.selectOption("pc-02");
  const edit = () => page.waitForResponse((response) => response.url().endsWith(`/api/reservations/${booking.id}`) && response.request().method() === "PATCH");
  const conflicting = edit();
  const save = dialog.getByRole("button", { name: "변경 저장" });
  await save.click();
  expect((await conflicting).status()).toBe(409);
  await expect(dialog.getByRole("alert")).toContainText("선택한 좌석에 해당 시간의 예약이 있습니다.");
  await expect(seatInput).toHaveValue("pc-02");
  await expect(dateInput).toHaveValue(editedDate);
  await expect(startInput).toHaveValue("16:00");
  await expect(endInput).toHaveValue("18:00");
  await seatInput.selectOption("pc-01");
  const saved = edit();
  await save.click();
  const response = await saved;
  expect(response.status()).toBe(200);
  expect((await response.json()).data).toMatchObject({ id: booking.id, fields: { reservedDate: editedDate, seatId: "pc-01", startTime: "16:00", endTime: "18:00", purpose, phone } });
  await expect(dialog).toHaveCount(0);
  await page.getByRole("textbox", { name: "예약 검색" }).fill("PC 01");
  await page.getByRole("button", { name: "검색", exact: true }).click();
  await expect(card).toContainText("PC 01");
});
