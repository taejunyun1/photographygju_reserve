# Admin Dashboard UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ADMIN 대시보드를 혼합형 운영 대시보드로 개편하고, 운영 알림을 설정으로 이동하며, 전역 버튼을 더 명확한 단일 버튼 형태로 정리한다.

**Architecture:** 기존 바닐라 JS 템플릿 구조를 유지한다. `public/js/views-admin.js`에 대시보드 계산/렌더 헬퍼를 추가하고, `public/styles.css`에 대시보드 섹션과 버튼 토큰만 확장한다. 동작 검증은 정적 소스 검사와 실제 ESM 렌더 함수 호출을 섞은 Node 스모크 테스트로 고정한다.

**Tech Stack:** Vanilla JavaScript ES modules, CSS, Node.js smoke scripts, existing npm release checks.

## Global Constraints

- 기존 API 응답과 클라이언트 상태에서 계산 가능한 값만 1차 구현에 포함한다.
- 서버 DB 스키마 변경, 새로운 통계 API 추가, 관리자 권한 체계 변경은 범위 밖이다.
- 대시보드에서 `운영 네이티브 알림` 카드를 제거하고 설정 화면의 `운영 알림` 섹션으로 이동한다.
- ADMIN은 마케팅 화면이 아니라 반복 운영을 위한 밀도 높은 도구로 유지한다.
- 전역 `.button` 디자인은 2중 테두리/인셋 표현을 제거하고 명확한 단일 버튼 면으로 표현한다.

---

### Task 1: ADMIN Dashboard, Notification Settings, And Button System

**Files:**
- Create: `scripts/admin-dashboard-ux-test.mjs`
- Modify: `package.json`
- Modify: `public/js/views-admin.js`
- Modify: `public/styles.css`
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `public/js/*.js`
- Modify: `public/privacy.html`
- Modify: `public/account-deletion.html`
- Modify: `scripts/check-native-release.mjs`

**Interfaces:**
- Consumes: `adminDashboardView()`, `adminSettingsView()`, `state` from existing ESM files.
- Produces: `adminDashboardMetrics()`, dashboard queue/metric HTML, settings notification HTML, clearer `.button` styles, and `npm run test:admin-ui`.

- [ ] **Step 1: Write the failing test**

```js
import fs from "node:fs";
import assert from "node:assert/strict";

globalThis.document = { querySelector: () => null };
globalThis.window = {};
const storage = new Map([["gju_native_notifications_enabled", "true"]]);
globalThis.localStorage = {
  getItem: (key) => storage.get(key) || "",
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key)
};
globalThis.sessionStorage = globalThis.localStorage;

const { state } = await import("../public/js/state.js?v=20260626-admin-dashboard-ux");
const { adminDashboardView, adminSettingsView, adminDashboardMetrics } = await import("../public/js/views-admin.js?v=20260626-admin-dashboard-ux");

state.bootstrap = { settings: {
  printBankAccount: "광주은행 000",
  googleDriveUrl: "https://drive.google.com/example",
  darkroomCapacity: 4,
  printAvailableStart: "09:00",
  printAvailableEnd: "18:00",
  printUploadStartDate: "2026-06-01",
  printUploadEndDate: "2026-12-31",
  equipmentHighValueCategories: ["Body", "Lens"],
  equipmentBagKeywords: ["펠리컨", "Pelican"],
  equipmentCameraBagNotice: "가방 지참",
  blockedSchedules: []
} };
state.summary = { pendingUsers: 2, pendingEquipment: 3, todayReservations: 4, missingReports: 1 };
state.nativeNotifications = { supported: true, permission: "granted", syncedAt: "2026-06-26T08:00:00.000Z", error: "" };
state.adminReservations = [
  { id: "r1", type: "equipment", status: "pending_approval", user: { name: "김학생" }, fields: { reservedDate: "2026-06-26", rentalTime: "10:00", returnDate: "2026-06-26" } },
  { id: "r2", type: "studio", status: "approved", user: { name: "이학생" }, fields: { reservedDate: "2026-06-26", timeSlots: ["13:00-14:00"] } },
  { id: "r3", type: "equipment", status: "checked_out", user: { name: "박학생" }, fields: { reservedDate: "2026-06-25", returnDate: "2026-06-26", rentalTime: "09:00" } },
  { id: "r4", type: "print", status: "cancelled", user: { name: "최학생" }, fields: { reservedDate: "2026-06-27", startTime: "15:00" } }
];
state.adminEquipment = [
  { id: "e1", active: true, status: "가능" },
  { id: "e2", active: true, status: "가능" },
  { id: "e3", active: true, status: "수리중" },
  { id: "e4", active: false, status: "가능" }
];
state.adminReports = [{ id: "report1", status: "pending" }];
state.adminLectures = [{ id: "lecture1", title: "프린트 워크숍", status: "모집중", startsAt: "2026-07-01" }];
state.adminNotices = [{ id: "notice1", title: "하계 운영 안내", createdAt: "2026-06-26T07:00:00.000Z" }];

const dashboard = adminDashboardView();
const settings = adminSettingsView();
const metrics = adminDashboardMetrics();
const css = fs.readFileSync("public/styles.css", "utf8");

function cssRule(selector) {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `${selector} rule must exist`);
  const end = css.indexOf("\n}", start);
  assert.notEqual(end, -1, `${selector} rule must close`);
  return css.slice(start, end);
}

const buttonRule = cssRule(".button");
const primaryButtonRule = cssRule(".button.primary");

assert(!dashboard.includes("운영 네이티브 알림"), "dashboard must not render native notification card");
assert(dashboard.includes("오늘 처리할 일"), "dashboard must render today's action section");
assert(dashboard.includes("운영 큐"), "dashboard must render operations queue");
assert(dashboard.includes("운영 지표"), "dashboard must render quantitative metrics");
assert(dashboard.includes("대여/반납 처리 필요"), "dashboard must include checkout/return work");
assert(settings.includes("운영 알림"), "settings must render operations notification section");
assert(settings.includes("마지막 동기화"), "settings notification section must show last sync");
assert.equal(metrics.weekReservations, 4, "metrics must count reservations from current state");
assert.equal(metrics.checkoutReturnNeeded, 1, "checkout/return work must only count equipment reservations");
assert.equal(metrics.availableEquipment, 2, "metrics must count active available equipment");
assert.equal(metrics.repairEquipment, 1, "metrics must count repair equipment");
assert(css.includes(".admin-dashboard-section"), "dashboard section styles must exist");
assert(css.includes(".admin-queue-list"), "operations queue styles must exist");
assert(buttonRule.includes("box-shadow: 0 1px 2px"), "button must use one clear surface shadow");
assert(!primaryButtonRule.includes("linear-gradient"), "primary button must use a clear single-color surface");
assert(!primaryButtonRule.includes("inset"), "primary button must not use an inset highlight that reads as a double button");

console.log("Admin dashboard UX checks passed.");
```

Add script entries:

```json
"test:admin-ui": "node scripts/admin-dashboard-ux-test.mjs",
"release:check": "npm run check && npm run check:js && npm run test:equipment-ui && npm run test:admin-ui && npm run test:storage && node scripts/check-pre-release.mjs && npm run native:release:check"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:admin-ui`

Expected: FAIL because `adminDashboardMetrics` is not exported and dashboard still contains the notification card.

- [ ] **Step 3: Implement the minimum production code**

Add `adminDashboardMetrics()`, `adminOperationsQueue()`, and `adminDashboardMetricSection()` to `public/js/views-admin.js`. Update `adminDashboardView()` to render `오늘 처리할 일`, `운영 큐`, and `운영 지표`, then move `adminNativeNotificationCard()` into `adminSettingsView()`.

Change `.button` to a solid single-surface button with `background: var(--surface-lowest)`, `border-color: var(--line)`, `border-radius: var(--radius-sm)`, and `box-shadow: 0 1px 2px rgba(16, 24, 40, 0.08)`. Remove gradient and inset shadows from `.button.primary`. Add dashboard classes: `.admin-dashboard-section`, `.admin-dashboard-grid`, `.admin-queue-list`, `.admin-queue-item`, `.admin-metric-grid`, `.admin-metric-card`. Replace the previous release cache version with `20260626-admin-dashboard-ux`.

- [ ] **Step 4: Run targeted and release checks**

Run:

```bash
npm run test:admin-ui
npm run check:js
npm run release:check
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-06-26-admin-dashboard-ux.md package.json scripts/admin-dashboard-ux-test.mjs public scripts/check-native-release.mjs
git commit -m "2026-06-26 ADMIN 대시보드 UX 및 버튼 디자인 업데이트"
```
