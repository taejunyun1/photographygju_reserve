import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { loginReactStudent } from "./support/session.mjs";

async function expectNoHorizontalOverflow(page) {
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth
  }));
  expect(widths.document, JSON.stringify(widths)).toBeLessThanOrEqual(widths.client + 1);
  expect(widths.body, JSON.stringify(widths)).toBeLessThanOrEqual(widths.client + 1);
}

test("Student React mounts without legacy student content", async ({ page }) => {
  await loginReactStudent(page);
  await expect(page.locator("#react-student-root .student-react-shell")).toBeVisible();
  await expect(page.locator("#react-student-root .student-content")).toHaveCount(0);
  await expect(page.getByText("안녕하세요, 접근성 학생님")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("Student React favorite manager opens as a reachable bottom sheet", async ({ page }) => {
  await loginReactStudent(page);
  const trigger = page.getByRole("button", { name: "즐겨찾기 관리" });
  await trigger.click();

  const sheet = page.locator(".student-react-favorite-sheet");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("heading", { name: "즐겨찾는 장비 관리" })).toBeVisible();
  const compactControls = await sheet.locator("button").evaluateAll((buttons) => buttons.map((button) => {
    const box = button.getBoundingClientRect();
    return { label: button.getAttribute("aria-label") || button.textContent?.trim(), width: box.width, height: box.height };
  }));
  for (const control of compactControls) {
    expect(control.height, JSON.stringify(control)).toBeGreaterThanOrEqual(44);
  }
  const accessibility = await new AxeBuilder({ page })
    .include(".student-react-favorite-sheet")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(accessibility.violations.filter((violation) => ["critical", "serious"].includes(violation.impact))).toEqual([]);

  const addGroup = sheet.getByRole("button", { name: "그룹 추가" });
  await addGroup.click();
  await sheet.getByRole("button", { name: "그룹 삭제" }).click();
  await expect(addGroup).toBeFocused();

  await sheet.getByRole("button", { name: "닫기" }).click();
  await expect(trigger).toBeFocused();
  await expectNoHorizontalOverflow(page);
});

test("Student React mobile navigation is an inset glass dock with visible 18px icons", async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(!viewport || viewport.width > 768, "mobile contract");
  await loginReactStudent(page);
  const nav = page.locator(".student-react-bottom-nav");
  const navMetrics = await nav.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      left: box.left,
      right: box.right,
      viewportWidth: document.documentElement.clientWidth,
      borderRadius: Number.parseFloat(style.borderRadius),
      backgroundColor: style.backgroundColor,
      backdropFilter: style.backdropFilter || style.webkitBackdropFilter
    };
  });
  expect(navMetrics.left).toBeGreaterThanOrEqual(12);
  expect(navMetrics.right).toBeLessThanOrEqual(navMetrics.viewportWidth - 12);
  expect(navMetrics.borderRadius).toBeGreaterThanOrEqual(24);
  expect(navMetrics.backgroundColor).toContain("0.82");
  expect(navMetrics.backdropFilter).toContain("blur");
  const buttons = nav.getByRole("button");
  await expect(buttons).toHaveCount(5);
  for (let index = 0; index < await buttons.count(); index += 1) {
    const button = buttons.nth(index);
    const metrics = await button.evaluate((element) => {
      const icon = element.querySelector(".student-react-nav__icon");
      const svg = icon?.matches("svg") ? icon : icon?.querySelector("svg");
      const iconBox = icon?.getBoundingClientRect();
      const svgBox = svg?.getBoundingClientRect();
      return {
        width: element.getBoundingClientRect().width,
        height: element.getBoundingClientRect().height,
        visibleText: [...element.childNodes]
          .filter((node) => node.nodeType === Node.TEXT_NODE || node.nodeName === "SPAN")
          .map((node) => node.textContent || "")
          .join("")
          .trim(),
        iconFound: Boolean(icon),
        iconWidth: iconBox?.width || 0,
        iconHeight: iconBox?.height || 0,
        svgWidth: svgBox?.width || 0,
        svgHeight: svgBox?.height || 0
      };
    });
    expect(metrics.width).toBe(48);
    expect(metrics.height).toBe(48);
    expect(metrics.visibleText).toBe("");
    expect(metrics.iconFound).toBe(true);
    expect(metrics.iconWidth).toBe(18);
    expect(metrics.iconHeight).toBe(18);
    expect(metrics.svgWidth).toBeGreaterThan(0);
    expect(metrics.svgHeight).toBeGreaterThan(0);
    await expect(button).toHaveAttribute("aria-label", /.+/);
  }
  await buttons.nth(1).click();
  const heading = page.locator(".student-react-view h1", { hasText: "내 예약" }).first();
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  await expectNoHorizontalOverflow(page);
});

test("Student React mobile booking progress uses circular 24px markers", async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(!viewport || viewport.width > 700, "phone progress contract");
  await loginReactStudent(page);
  await page.evaluate(async () => {
    const { state } = await import("/js/state.js?v=20260923-reservation-requests-r1");
    const { render } = await import("/js/renderer.js?v=20260923-reservation-requests-r1");
    state.view = "reserve";
    state.reservationType = "equipment";
    state.reservationFlowStep.equipment = "select";
    render();
  });
  const markers = page.locator(".student-react-booking-progress button span");
  await expect(markers).toHaveCount(4);
  for (let index = 0; index < 4; index += 1) {
    const box = await markers.nth(index).boundingBox();
    expect(box?.width).toBe(24);
    expect(box?.height).toBe(24);
  }
});

test("Student React reservation cards align actions and summarize the schedule on mobile", async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(!viewport || viewport.width > 430, "phone card contract");
  await loginReactStudent(page);
  await page.evaluate(async () => {
    const { state } = await import("/js/state.js?v=20260923-reservation-requests-r1");
    const { render } = await import("/js/renderer.js?v=20260923-reservation-requests-r1");
    state.view = "mine";
    state.myReservations = [{
      id: "mobile-card-fixture",
      type: "equipment",
      status: "approval_pending",
      fields: {
        reservedDate: "2099-07-27",
        rentalTime: "12:00",
        returnTime: "17:10",
        period: "1박2일"
      },
      equipmentItems: [
        { id: "e1", code: "CAM-750D-03", name: "캐논 750D" },
        { id: "e2", code: "LEN-1855-03", name: "캐논 EF-S 18-55" },
        { id: "e3", code: "LEN-1855-02", name: "캐논 EF-S 18-55" },
        { id: "e4", code: "LGT-430EX-02", name: "캐논 430EX" },
        { id: "e5", code: "LGT-430EX-01", name: "캐논 430EX" }
      ]
    }];
    render();
  });
  await page.locator(".student-react-mine").evaluate(async (element) => {
    await Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished));
  });

  const card = page.locator(".student-react-reservation-card").first();
  const header = card.locator(".student-react-reservation-card__head");
  const date = card.locator(".student-react-reservation-card__schedule-item", { hasText: "날짜" });
  const time = card.locator(".student-react-reservation-card__schedule-item", { hasText: "시간" });
  const equipment = card.locator(".student-react-reservation-card__equipment");

  await expect(date).toContainText("2099. 7. 27. (월)");
  await expect(time).toContainText("12:00–17:10");
  await expect(equipment).toHaveText("1박2일 · CAM-750D-03, LEN-1855-03 외 3개");
  await expect(equipment).not.toContainText("LGT-430EX-01");

  const metrics = await page.evaluate(() => {
    const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect();
    const cardRect = rect(".student-react-reservation-card");
    const badgeRect = rect(".student-react-reservation-card__head .chips");
    const cancelRect = rect(".student-react-reservation-card__head .gju-icon-button");
    const titleElement = document.querySelector(".student-react-reservation-card h2");
    const titleStyle = titleElement ? getComputedStyle(titleElement) : null;
    return {
      badgeTop: badgeRect?.top,
      cancelTop: cancelRect?.top,
      cancelRight: cancelRect?.right,
      contentRight: cardRect ? cardRect.right - 15 : undefined,
      cancelWidth: cancelRect?.width,
      cancelHeight: cancelRect?.height,
      titleFontSize: titleStyle?.fontSize,
      titleMargin: titleStyle?.margin
    };
  });
  expect(Math.abs((metrics.badgeTop || 0) - (metrics.cancelTop || 0))).toBeLessThanOrEqual(8);
  expect(Math.abs((metrics.cancelRight || 0) - (metrics.contentRight || 0))).toBeLessThanOrEqual(2);
  expect(Math.abs((metrics.cancelWidth || 0) - 44)).toBeLessThanOrEqual(0.1);
  expect(Math.abs((metrics.cancelHeight || 0) - 44)).toBeLessThanOrEqual(0.1);
  expect(metrics.titleFontSize).toBe("17px");
  expect(metrics.titleMargin).toBe("0px");
  const accessibility = await new AxeBuilder({ page })
    .include(".student-react-mine")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(accessibility.violations.filter((violation) => (
    ["serious", "critical"].includes(violation.impact)
  ))).toEqual([]);
});

test("Student React My screen has labelled controls and no serious axe violations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await loginReactStudent(page);
  await page.getByRole("button", { name: "마이 페이지" }).click();
  await expect(page.getByRole("heading", { name: "마이" }).first()).toBeVisible();
  const results = await new AxeBuilder({ page })
    .include(".student-react-shell")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact))).toEqual([]);
});

test("Student React reservation filters control a labelled panel", async ({ page }) => {
  await loginReactStudent(page);
  const viewport = page.viewportSize();
  const navigation = viewport && viewport.width <= 768
    ? page.locator(".student-react-bottom-nav")
    : page.locator(".student-react-desktop-nav");
  await navigation.getByRole("button", { name: "내 예약" }).click();
  const tablist = page.getByRole("tablist", { name: "내 예약 카테고리" });
  const active = tablist.getByRole("tab", { selected: true });
  const panelId = await active.getAttribute("aria-controls");
  expect(panelId).toBeTruthy();
  const panel = page.locator(`#${panelId}`);
  await expect(panel).toHaveAttribute("role", "tabpanel");
  await expect(panel).toHaveAttribute("aria-labelledby", await active.getAttribute("id"));
  await active.press("ArrowRight");
  await expect(tablist.getByRole("tab").nth(1)).toHaveAttribute("aria-selected", "true");
});

test("Student React Mine filters show all six tabs without horizontal clipping", async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(!viewport || viewport.width > 430, "phone filter contract");
  await loginReactStudent(page);
  await page.locator(".student-react-bottom-nav").getByRole("button", { name: "내 예약" }).click();
  const tabs = page.getByRole("tablist", { name: "내 예약 카테고리" });
  await expect(tabs.getByRole("tab")).toHaveCount(6);
  const metrics = await tabs.evaluate((element) => {
    const parent = element.getBoundingClientRect();
    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      display: getComputedStyle(element).display,
      columns: getComputedStyle(element).gridTemplateColumns.split(" ").length,
      children: [...element.children].map((child) => {
        const box = child.getBoundingClientRect();
        return {
          left: box.left,
          right: box.right,
          parentLeft: parent.left,
          parentRight: parent.right
        };
      })
    };
  });
  expect(metrics.display).toBe("grid");
  expect(metrics.columns).toBe(3);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  for (const item of metrics.children) {
    expect(item.left).toBeGreaterThanOrEqual(item.parentLeft - 1);
    expect(item.right).toBeLessThanOrEqual(item.parentRight + 1);
  }
  await expectNoHorizontalOverflow(page);
});

test("Student React report submission keeps the form open and announces server errors", async ({ page }) => {
  await loginReactStudent(page);
  await page.route("**/api/reports/studio", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "보고서 저장 실패" })
    });
  });
  await page.evaluate(async () => {
    const { state } = await import("/js/state.js?v=20260923-reservation-requests-r1");
    const { render } = await import("/js/renderer.js?v=20260923-reservation-requests-r1");
    state.view = "reports";
    state.bootstrap.settings.googleDriveUrl = "";
    state.myReservations = [{
      id: "report-error-fixture",
      type: "studio",
      status: "auto_confirmed",
      fields: {
        reservedDate: "2026-07-10",
        reportStatus: "required",
        participants: "2명",
        timeSlots: ["10:30-12:00"],
        studioSpaces: ["Studio A Front"]
      }
    }];
    state.activeReportReservationId = "report-error-fixture";
    render();
  });

  const submit = page.getByRole("button", { name: "보고서 제출" });
  await page.getByLabel("없음 (X)").check();
  await page.getByLabel("정리정돈을 완료했습니다.").check();
  await submit.click();
  await expect(page.getByRole("alert")).toContainText("보고서 저장 실패");
  await expect(page.getByRole("heading", { name: "스튜디오 사용 보고서" })).toBeVisible();
  await expect(submit).toBeEnabled();
});

test("Student React can submit an eligible report without a Drive setting", async ({ page }) => {
  await loginReactStudent(page);
  const reservation = {
    id: "report-drive-optional-fixture",
    type: "studio",
    status: "auto_confirmed",
    fields: {
      reservedDate: "2026-07-10",
      reportStatus: "required",
      participants: "2명",
      timeSlots: ["10:30-12:00"],
      studioSpaces: ["Studio A Front"]
    }
  };
  await page.route("**/api/reports/studio", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: { id: "report-drive-optional", status: "submitted", fields: { resultPhotoUrl: "" } } })
    });
  });
  await page.route("**/api/reservations/my", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: [{ ...reservation, fields: { ...reservation.fields, reportStatus: "submitted" } }] }) });
  });
  await page.evaluate(async (fixture) => {
    const { state } = await import("/js/state.js?v=20260923-reservation-requests-r1");
    const { render } = await import("/js/renderer.js?v=20260923-reservation-requests-r1");
    state.view = "reports";
    state.bootstrap.settings.googleDriveUrl = "";
    state.myReservations = [fixture];
    state.activeReportReservationId = fixture.id;
    render();
  }, reservation);

  await expect(page.getByRole("heading", { name: "스튜디오 사용 보고서" })).toBeVisible();
  await expect(page.getByText("보고서 작성을 시작할 수 없습니다.")).toHaveCount(0);
  await page.getByLabel("없음 (X)").check();
  await page.getByLabel("정리정돈을 완료했습니다.").check();
  await page.getByRole("button", { name: "보고서 제출" }).click();
  await expect(page.getByRole("heading", { name: "제출 완료" })).toBeVisible();
  await expect(page.getByText("제출 완료된 보고서가 없습니다.")).toHaveCount(0);
});

test("Student React lecture actions recover and announce request errors", async ({ page }) => {
  await loginReactStudent(page);
  await page.route("**/api/lectures/lecture-error-fixture/apply", async (route) => {
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "특강 정원이 마감되었습니다." })
    });
  });
  await page.evaluate(async () => {
    const { state } = await import("/js/state.js?v=20260923-reservation-requests-r1");
    const { render } = await import("/js/renderer.js?v=20260923-reservation-requests-r1");
    state.view = "lectures";
    state.lectures = [{
      id: "lecture-error-fixture",
      title: "오류 처리 특강",
      lectureDate: "2026-07-20",
      time: "14:00",
      location: "강의실",
      status: "모집중",
      capacity: 1,
      applicationCount: 0,
      applied: false
    }];
    render();
  });

  const apply = page.getByRole("button", { name: "신청" });
  await apply.click();
  await expect(page.getByRole("alert")).toContainText("특강 정원이 마감되었습니다.");
  await expect(apply).toBeEnabled();
});

test("Student React opens every reservation type without viewport overflow", async ({ page }) => {
  await loginReactStudent(page);
  const types = ["기자재", "스튜디오", "암실", "출력실"];

  for (const label of types) {
    await page.evaluate(async () => {
      const { state } = await import("/js/state.js?v=20260923-reservation-requests-r1");
      const { render } = await import("/js/renderer.js?v=20260923-reservation-requests-r1");
      state.view = "reserve";
      state.reservationType = "";
      state.bootstrap.settings.googleDriveUrl = "https://drive.google.com/";
      render();
    });
    await page.getByRole("button", { name: new RegExp(label) }).first().click();
    await expect(page.getByRole("heading", { name: "예약 신청" })).toBeVisible();
    await expect(page.getByLabel("사용일")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});

test("Student React equipment selection keeps card surfaces inside the mobile viewport", async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(!viewport || viewport.width > 768, "mobile and tablet overflow contract");
  await loginReactStudent(page);
  await page.evaluate(async () => {
    const { state } = await import("/js/state.js?v=20260923-reservation-requests-r1");
    const { render } = await import("/js/renderer.js?v=20260923-reservation-requests-r1");
    state.view = "reserve";
    state.reservationType = "equipment";
    state.reservationFlowStep.equipment = "select";
    state.selectedDates.equipment = "2099-07-20";
    state.selectedEquipmentPeriod = "당일";
    state.selectedEquipmentRentalTime = "10:15";
    state.selectedEquipmentReturnTime = "17:10";
    render();
  });

  await expect(page.getByRole("heading", { name: "예약 정보" })).toBeVisible();
  await expect(page.getByRole("tablist", { name: "기자재 카테고리" })).toBeVisible();

  const metrics = await page.locator(".student-react-reservation-step").evaluate((card) => {
    const cardBox = card.getBoundingClientRect();
    const selectors = [
      ".gju-card__body",
      ".student-react-equipment-picker",
      ".student-react-equipment-manifest",
      "#student-equipment-search",
      "#student-equipment-category",
      "#student-equipment-results > fieldset",
      ".student-react-flow-actions"
    ];
    return {
      viewportWidth: document.documentElement.clientWidth,
      card: { left: cardBox.left, right: cardBox.right, width: cardBox.width, clientWidth: card.clientWidth, scrollWidth: card.scrollWidth },
      surfaces: selectors.map((selector) => {
        const element = card.querySelector(selector);
        const box = element?.getBoundingClientRect();
        return {
          selector,
          found: Boolean(element && box),
          left: box?.left ?? 0,
          right: box?.right ?? 0,
          top: box?.top ?? 0,
          bottom: box?.bottom ?? 0,
          width: box?.width ?? 0,
          clientWidth: element?.clientWidth ?? 0,
          scrollWidth: element?.scrollWidth ?? 0
        };
      })
    };
  });

  for (const surface of metrics.surfaces) {
    expect(surface.found, JSON.stringify(metrics, null, 2)).toBe(true);
    expect(surface.left, JSON.stringify(metrics, null, 2)).toBeGreaterThanOrEqual(-1);
    expect(surface.right, JSON.stringify(metrics, null, 2)).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  }
  const equipmentPicker = metrics.surfaces.find((surface) => surface.selector === ".student-react-equipment-picker");
  const flowActions = metrics.surfaces.find((surface) => surface.selector === ".student-react-flow-actions");
  expect(flowActions.top, JSON.stringify(metrics, null, 2)).toBeGreaterThanOrEqual(equipmentPicker.bottom - 1);
  expect(metrics.card.scrollWidth, JSON.stringify(metrics, null, 2)).toBeLessThanOrEqual(metrics.card.clientWidth + 1);
  await expectNoHorizontalOverflow(page);
});

test("Student React adds multiple unlisted equipment requests and shows them on the home booking list", async ({ page }, testInfo) => {
  test.skip(!["mobile-390", "desktop-1440"].includes(testInfo.project.name), "representative phone and desktop viewports");
  const errors = [];
  const consoleIssues = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) consoleIssues.push(`${message.type()}: ${message.text()}`);
  });
  await loginReactStudent(page);
  expect(page.url()).toMatch(/^http:\/\/127\.0\.0\.1:4179\//);
  await expect(page).toHaveTitle(/GJU Photography Reservation/);
  await expect(page.locator("vite-error-overlay, nextjs-portal, #webpack-dev-server-client-overlay")).toHaveCount(0);
  await page.evaluate(async () => {
    const { state } = await import("/js/state.js?v=20260923-reservation-requests-r1");
    const { render } = await import("/js/renderer.js?v=20260923-reservation-requests-r1");
    state.view = "reserve";
    state.reservationType = "equipment";
    state.reservationFlowStep.equipment = "select";
    state.selectedDates.equipment = "2099-07-20";
    state.selectedEquipmentPeriod = "당일";
    state.selectedEquipmentRentalTime = "10:15";
    state.selectedEquipmentReturnTime = "17:10";
    state.selectedEquipmentItemIds = [];
    state.selectedRequestedEquipment = [];
    render();
  });
  const editor = page.getByRole("region", { name: "목록에 없는 기자재 요청" });
  await expect(editor).toBeVisible();
  await editor.getByLabel("장비명").first().fill("무선 마이크");
  await editor.getByLabel("수량").first().fill("2");
  await editor.getByRole("button", { name: "요청 장비 추가" }).click();
  await editor.getByLabel("장비명").nth(1).fill("마이크 스탠드");
  await editor.getByLabel("수량").nth(1).fill("3");
  await expect(editor.getByLabel("장비명")).toHaveCount(2);
  const savedRows = await page.evaluate(async () => {
    const { state } = await import("/js/state.js?v=20260923-reservation-requests-r1");
    return state.selectedRequestedEquipment;
  });
  expect(savedRows.map(({ name, quantity }) => [name, quantity])).toEqual([["무선 마이크", 2], ["마이크 스탠드", 3]]);
  await expectNoHorizontalOverflow(page);
  await expect(page.getByText("로그인되었습니다.")).toBeHidden();
  await page.screenshot({ path: `/tmp/gju-equipment-requests-${testInfo.project.name}.png`, fullPage: false });
  const nextStep = page.locator(".student-react-flow-actions").getByRole("button", { name: "다음" });
  await expect(nextStep).toBeEnabled();
  await nextStep.click();
  await expect(page.getByText("목록 외 요청 2개")).toBeVisible();

  await page.evaluate(async () => {
    const { state } = await import("/js/state.js?v=20260923-reservation-requests-r1");
    const { render } = await import("/js/renderer.js?v=20260923-reservation-requests-r1");
    state.view = "home";
    state.myReservations = [{
      id: "request-home-fixture",
      type: "equipment",
      status: "pending_approval",
      fields: { title: "인터뷰 장비 예약", reservedDate: "2099-07-20", rentalTime: "10:15", returnTime: "17:10", requestedEquipment: state.selectedRequestedEquipment }
    }];
    render();
  });
  const bookingSection = page.getByRole("region", { name: "내 예약" });
  await expect(bookingSection.getByText("인터뷰 장비 예약")).toBeVisible();
  await expect(bookingSection).toContainText("무선 마이크 × 2");
  await expect(bookingSection.getByRole("button", { name: "전체 예약 보기" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await bookingSection.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `/tmp/gju-home-booking-${testInfo.project.name}.png`, fullPage: false });
  expect(errors).toEqual([]);
  expect(consoleIssues).toEqual([]);
});

test("Student React studio details can add and remove multiple equipment request rows", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390", "representative phone viewport");
  await loginReactStudent(page);
  await page.evaluate(async () => {
    const { state } = await import("/js/state.js?v=20260923-reservation-requests-r1");
    const { render } = await import("/js/renderer.js?v=20260923-reservation-requests-r1");
    state.view = "reserve";
    state.reservationType = "studio";
    state.reservationFlowStep.studio = "details";
    state.selectedDates.studio = "2099-07-20";
    state.selectedStudioSpace = "Studio A Front";
    state.selectedStudioSlots = ["12:00-14:00"];
    render();
  });
  const editor = page.getByRole("region", { name: "함께 사용할 기자재 요청" });
  await editor.getByLabel("장비명").first().fill("LED 조명");
  await editor.getByRole("button", { name: "요청 장비 추가" }).click();
  await editor.getByLabel("장비명").nth(1).fill("소프트박스");
  await expect(editor.getByLabel("장비명")).toHaveCount(2);
  await expect(page.getByText("로그인되었습니다.")).toBeHidden();
  await page.screenshot({ path: "/tmp/gju-studio-requests-mobile-390.png", fullPage: false });
  await editor.getByRole("button", { name: "요청 장비 1 삭제" }).click();
  await expect(editor.getByLabel("장비명")).toHaveCount(1);
  await expect(editor.getByLabel("장비명")).toHaveValue("소프트박스");
  await expectNoHorizontalOverflow(page);
});

test("Student React mobile equipment selection uses an expandable dock above navigation", async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(!viewport || viewport.width > 700, "phone selection dock contract");
  await loginReactStudent(page);
  await page.evaluate(async () => {
    const { state } = await import("/js/state.js?v=20260923-reservation-requests-r1");
    const { render } = await import("/js/renderer.js?v=20260923-reservation-requests-r1");
    const selected = (state.bootstrap.equipment || [])
      .filter((item) => item.active !== false && !item.inquiryOnly && item.source !== "fantasy_lab")
      .slice(0, 4)
      .map((item) => item.id);
    state.view = "reserve";
    state.reservationType = "equipment";
    state.reservationFlowStep.equipment = "select";
    state.selectedDates.equipment = "2099-07-20";
    state.selectedEquipmentPeriod = "당일";
    state.selectedEquipmentRentalTime = "10:15";
    state.selectedEquipmentReturnTime = "17:10";
    state.selectedEquipmentItemIds = selected;
    render();
  });

  await expect(page.locator(".student-react-equipment-manifest--inline")).toBeHidden();
  const dock = page.locator(".student-react-equipment-dock");
  const toggle = dock.locator(".student-react-equipment-dock__toggle");
  await expect(toggle).toHaveAccessibleName(/선택 장비 4개.*목록 보기/);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#student-equipment-selection-panel")).toHaveCount(0);

  const navBox = await page.locator(".student-react-bottom-nav").boundingBox();
  const dockBox = await dock.boundingBox();
  expect(navBox).not.toBeNull();
  expect(dockBox).not.toBeNull();
  expect(dockBox.y + dockBox.height).toBeLessThanOrEqual(navBox.y - 6);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(toggle).toHaveAccessibleName(/선택 장비 4개.*목록 닫기/);
  const panel = page.locator("#student-equipment-selection-panel");
  await expect(panel).toBeVisible();
  await expect(panel.locator(".student-react-equipment-manifest__item")).toHaveCount(4);
  const sheetBox = await dock.boundingBox();
  expect(sheetBox).not.toBeNull();
  expect(sheetBox.height).toBeLessThanOrEqual(viewport.height * 0.45 + 1);

  const accessibility = await new AxeBuilder({ page })
    .include(".student-react-equipment-dock")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(accessibility.violations.filter((violation) => (
    ["serious", "critical"].includes(violation.impact)
  ))).toEqual([]);

  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await panel.getByRole("button", { name: /선택 해제/ }).first().click();
  await expect(panel.locator(".student-react-equipment-manifest__item")).toHaveCount(3);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expectNoHorizontalOverflow(page);
});

test("Student React reservation cancellation keeps the card and announces request errors", async ({ page }) => {
  await loginReactStudent(page);
  await page.route("**/api/reservations/cancel-error-fixture/cancel", async (route) => {
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "이미 취소된 예약입니다." })
    });
  });
  page.on("dialog", (dialog) => dialog.accept());
  await page.evaluate(async () => {
    const { state } = await import("/js/state.js?v=20260923-reservation-requests-r1");
    const { render } = await import("/js/renderer.js?v=20260923-reservation-requests-r1");
    state.view = "mine";
    state.myReservations = [{
      id: "cancel-error-fixture",
      type: "equipment",
      status: "approved",
      fields: { reservedDate: "2099-07-20", period: "당일" }
    }];
    render();
  });

  const cancel = page.getByRole("button", { name: "예약 취소" });
  await cancel.click();
  await expect(page.getByRole("alert")).toContainText("이미 취소된 예약입니다.");
  await expect(page.getByText("기자재 예약")).toBeVisible();
  await expect(cancel).toBeEnabled();
});
