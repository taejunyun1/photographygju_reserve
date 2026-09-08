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

test("React Admin congestion insight uses a compact card hierarchy", async ({ page }) => {
  await loginReactAdmin(page);
  await page.evaluate(async () => {
    const { state } = await import("/js/state.js?v=20260714-mobile-card-r6");
    state.summary = {
      ...(state.summary || {}),
      metrics: {
        ...(state.summary?.metrics || {}),
        insights: {
          congestion: {
            items: [{
              type: "equipment",
              label: "기자재",
              time: "14:00~15:00",
              count: 4,
              sharePercent: 25
            }]
          },
          equipmentUtilization: [],
          cancellationRate: { totalRequests: 0 },
          warnings: []
        }
      }
    };
    const { render } = await import("/js/renderer.js?v=20260714-mobile-card-r6");
    render();
  });

  const card = page.locator(".admin-dashboard-insight-card");
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("예약 많은 시간");
  await expect(card).not.toContainText("점유율");
  const dimensions = await card.evaluate((element) => {
    const value = element.querySelector(".gju-card__body > strong");
    return {
      height: element.getBoundingClientRect().height,
      valueFontSize: value ? Number.parseFloat(getComputedStyle(value).fontSize) : 0
    };
  });
  expect(dimensions.valueFontSize).toBeLessThanOrEqual(22);
  expect(dimensions.height).toBeLessThanOrEqual(112);
});

test("React Admin insight navigation keeps the period and selected time", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await loginReactAdmin(page);
  await page.evaluate(async () => {
    const { state } = await import("/js/state.js?v=20260714-mobile-card-r6");
    state.summary = {
      ...(state.summary || {}),
      metrics: {
        ...(state.summary?.metrics || {}),
        insights: {
          period: { from: "2026-08-07", to: "2026-09-03", days: 28 },
          congestion: {
            items: [{ type: "equipment", label: "기자재 10:15", time: "10:15", count: 3, availableCount: 112, sharePercent: 3 }]
          },
          equipmentUtilization: [],
          cancellationRate: { totalRequests: 5, cancelledRequests: 1, percent: 20 },
          warnings: []
        }
      }
    };
    const { render } = await import("/js/renderer.js?v=20260714-mobile-card-r6");
    render();
  });

  const requestPromise = page.waitForRequest((request) => request.url().includes("/api/admin/reservations?"));
  await page.locator(".admin-dashboard-insight-card").first().click();
  await expect(page.getByRole("heading", { level: 1, name: "예약 관리" })).toBeVisible();
  const requestUrl = new URL((await requestPromise).url());
  expect(requestUrl.searchParams.get("from")).toBe("2026-08-07");
  expect(requestUrl.searchParams.get("to")).toBe("2026-09-03");
  expect(requestUrl.searchParams.get("time")).toBe("10:15");
  expect(requestUrl.searchParams.get("status")).toBe("operational");
  expect(requestUrl.searchParams.get("semester")).toBeNull();
  await expect.poll(() => page.evaluate(async () => {
    const { state } = await import("/js/state.js?v=20260714-mobile-card-r6");
    return { from: state.adminReservationDateFrom, to: state.adminReservationDateTo, time: state.adminReservationTimeFilter };
  })).toEqual({ from: "2026-08-07", to: "2026-09-03", time: "10:15" });
  expect(consoleErrors.filter((message) => message.includes("same key"))).toEqual([]);
});

test("React Admin hides cancellation insight until five requests are available", async ({ page }) => {
  await loginReactAdmin(page);
  await page.evaluate(async () => {
    const { state } = await import("/js/state.js?v=20260714-mobile-card-r6");
    state.summary = {
      ...(state.summary || {}),
      metrics: {
        ...(state.summary?.metrics || {}),
        insights: {
          congestion: { items: [] },
          equipmentUtilization: [],
          cancellationRate: { totalRequests: 4, cancelledRequests: 2, percent: 50 },
          warnings: []
        }
      }
    };
    const { render } = await import("/js/renderer.js?v=20260714-mobile-card-r6");
    render();
  });
  await expect(page.locator(".admin-dashboard-insight-card").filter({ hasText: "취소율" })).toHaveCount(0);
  await expect(page.getByText("최근 4주 데이터가 충분하지 않아 추세를 표시하지 않습니다.", { exact: true })).toBeVisible();
});

test("React Admin cancellation insight keeps the cancelled status filter", async ({ page }) => {
  await loginReactAdmin(page);
  await page.evaluate(async () => {
    const { state } = await import("/js/state.js?v=20260714-mobile-card-r6");
    state.summary = {
      ...(state.summary || {}),
      metrics: {
        ...(state.summary?.metrics || {}),
        insights: {
          period: { from: "2026-08-07", to: "2026-09-03", days: 28 },
          congestion: { items: [] },
          equipmentUtilization: [],
          cancellationRate: { totalRequests: 5, cancelledRequests: 2, percent: 40 },
          warnings: []
        }
      }
    };
    const { render } = await import("/js/renderer.js?v=20260714-mobile-card-r6");
    render();
  });

  const requestPromise = page.waitForRequest((request) => request.url().includes("/api/admin/reservations?"));
  await page.locator(".admin-dashboard-insight-card").filter({ hasText: "취소율" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "예약 관리" })).toBeVisible();
  const requestUrl = new URL((await requestPromise).url());
  expect(requestUrl.searchParams.get("status")).toBe("cancelled_or_rejected");
  expect(requestUrl.searchParams.get("dateBasis")).toBe("created");
  expect(requestUrl.searchParams.get("from")).toBe("2026-08-07");
  expect(requestUrl.searchParams.get("to")).toBe("2026-09-03");
});

test("React Admin paginated badge uses server total, not visible rows", async ({ page }) => {
  await loginReactAdmin(page);
  await page.evaluate(async () => {
    const { state } = await import("/js/state.js?v=20260714-mobile-card-r6");
    state.adminView = "reservations";
    state.adminReservations = ["one", "two"].map((id) => ({ id, type: "equipment", status: "approved", fields: {} }));
    state.adminReservationsPage = { total: 105, page: 1, pageSize: 2, hasMore: true };
    const { render } = await import("/js/renderer.js?v=20260714-mobile-card-r6");
    render();
  });
  await expect(page.getByText("105건 · 현재 표시 2건", { exact: true })).toBeVisible();
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
    const module = await import("/js/renderer.js?v=20260714-mobile-card-r6");
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

test("React Admin equipment codes are automatic and migration preview stays responsive", async ({ page }, testInfo) => {
  await loginReactAdmin(page);
  const navigation = testInfo.project.name === "desktop-1440"
    ? page.locator(".gju-admin-nav--sidebar")
    : page.locator(".gju-admin-nav--bottom");
  await navigation.getByRole("button", { name: "기자재" }).click();

  const tabs = page.getByRole("tablist", { name: "기자재 관리 탭" });
  await tabs.getByRole("tab", { name: "장비추가" }).click();
  await expect(page.getByLabel("코드 / 접두어")).toHaveCount(0);
  await expect(page.getByLabel("기능 태그")).toBeVisible();
  await expect(page.getByText("예상 코드", { exact: true })).toBeVisible();

  await page.getByLabel("장비명").fill("소니 A7M3");
  await page.getByLabel("브랜드").fill("Sony");
  await page.getByLabel("모델").fill("A7M3");
  await expect(page.locator(".equipment-code-preview code")).toContainText(/CAM-SNY-A7M3-\d{3}/);

  await tabs.getByRole("tab", { name: "코드 재발급" }).click();
  await page.getByRole("button", { name: "변경안 만들기" }).click();
  await expect(page.locator(".equipment-code-migration-row").first()).toBeVisible();
  await expect(page.locator(".equipment-code-transition").first()).toContainText("→");
  await expectNoHorizontalOverflow(page);
});

test("React Admin completes equipment return through per-item inspection", async ({ page }) => {
  let submittedBody = null;
  await page.route("**/api/admin/reservations/return-ui/return-inspection", async (route) => {
    submittedBody = await route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ reservation: { id: "return-ui", status: "returned" } })
    });
  });
  await loginReactAdmin(page);
  await page.evaluate(async () => {
    const { state } = await import("/js/state.js?v=20260714-mobile-card-r6");
    state.adminView = "reservations";
    state.adminReservationTab = "equipment";
    state.adminEquipmentReservationStatusFilter = "checked_out";
    state.adminReservationsPage = { total: 1, collectionTotal: 1, page: 1, pageSize: 20 };
    state.adminReservations = [{
      id: "return-ui",
      type: "equipment",
      status: "checked_out",
      fields: { reservedDate: "2026-09-11", rentalTime: "10:15", returnTime: "17:10" },
      equipmentItems: [
        { id: "equipment-fx3", code: "CAM-SNY-FX3-001", name: "Sony FX3" },
        { id: "equipment-lens", code: "LEN-SNY-2470GM-001", name: "Sony 24-70GM" }
      ],
      user: { name: "반납 학생", studentId: "20260001", phone: "010-1234-5678" }
    }];
    const { render } = await import("/js/renderer.js?v=20260714-mobile-card-r6");
    render();
  });

  await page.getByRole("button", { name: "반납 점검" }).click();
  const dialog = page.getByRole("dialog", { name: "반납 점검" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("반납 학생");
  await expect(dialog).toContainText("010-1234-5678");
  await expect(dialog).toContainText("Sony FX3, Sony 24-70GM");
  await expect(dialog.getByText("CAM-SNY-FX3-001", { exact: true })).toBeVisible();
  await expect(dialog.getByText("LEN-SNY-2470GM-001", { exact: true })).toBeVisible();

  const repairResult = dialog.getByLabel("Sony 24-70GM 점검 결과");
  await repairResult.selectOption("needs_repair");
  const completeButton = dialog.getByRole("button", { name: "반납 점검 완료" });
  await expect(completeButton).toBeDisabled();
  await dialog.getByLabel("Sony 24-70GM 점검 메모").fill("줌 링 걸림 확인");
  await expect(completeButton).toBeEnabled();
  await completeButton.click();

  await expect.poll(() => submittedBody).toEqual({
    inspections: [
      { equipmentId: "equipment-fx3", outcome: "normal", note: "" },
      { equipmentId: "equipment-lens", outcome: "needs_repair", note: "줌 링 걸림 확인" }
    ]
  });
  await expectNoHorizontalOverflow(page);
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
