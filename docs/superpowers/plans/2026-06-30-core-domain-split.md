# Core Domain Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split low-risk domain helpers out of `core.mjs` without changing public API behavior, storage behavior, authentication, reservation policy, or App Review release readiness.

**Architecture:** Keep `core.mjs` as the route composition and public export facade. Move self-contained helper groups into dependency-injected modules under `core/` so extracted code can be tested through the existing `handleApiRequest`, `cleanupExpiredData`, and admin-list smoke paths without circular imports. Do not move route handlers in this phase.

**Tech Stack:** Node.js ESM, vanilla JavaScript, existing Node smoke-test scripts, Cloudflare Worker-compatible modules.

## Global Constraints

- Preserve all current public imports from `core.mjs`: `initialDb`, `normalizeDb`, `capLogs`, `cleanupExpiredData`, `adminExportData`, and `handleApiRequest`.
- Do not change API response shapes or endpoint paths.
- Do not change authentication, authorization, password hashing, session lifetime, login throttling, reservation validation, reservation status policy, cleanup retention windows, or Slack message text.
- Do not touch production data reset, SQL migration, or Cloudflare Durable Object persistence behavior in this phase.
- Do not introduce new runtime dependencies or a test framework.
- Keep `core.mjs` as the only module imported by `server.mjs`, `worker.mjs`, `storage-sql.mjs`, and existing scripts.
- Preserve App Review/release checks.
- Ignore unrelated uncommitted Android/release documentation changes in the worktree; do not stage, edit, or revert them.

---

## File Structure

- Create `core/admin-lists.mjs`: paginated admin list helpers and query parsing. Uses dependency injection for `withReservationDetails`, `reportWithDetails`, and `publicUser`.
- Create `core/maintenance.mjs`: cleanup retention helpers and `cleanupExpiredData`. Uses dependency injection for `normalizeDb`, `capLogs`, and `id`.
- Create `core/notifications.mjs`: Slack message formatting and delivery. Uses dependency injection for `maskPhone`, `normalizeStatusLabel`, `reservationTitle`, `studioSpaces`, and `nowIso`.
- Modify `core.mjs`: import the new factories, remove the extracted helper implementations, instantiate helpers after their dependencies are declared, and keep the existing public exports stable.
- Modify `scripts/security-smoke-test.mjs` only if extraction exposes a missing characterization assertion.
- Modify `package.json` only if a new script is required; prefer existing scripts.

## Task 1: Extract Admin List Helpers

**Files:**
- Create: `core/admin-lists.mjs`
- Modify: `core.mjs`
- Test: `scripts/security-smoke-test.mjs`

**Interfaces:**
- Consumes from `core.mjs`: `withReservationDetails(db, reservation)`, `reportWithDetails(db, report)`, and `publicUser(user, db)`.
- Produces: `createAdminListHelpers(deps): { hasListQuery(searchParams), adminReservationList(db, searchParams), adminReportList(db, searchParams), adminUserList(db, searchParams) }`.

- [ ] **Step 1: Write the characterization check**

Run the existing security smoke test before any code movement:

```bash
npm run test:security
```

Expected: PASS. This is the baseline proving current admin pagination and legacy list responses work before extraction.

- [ ] **Step 2: Create `core/admin-lists.mjs`**

Create `core/admin-lists.mjs` with these exported entry points and move the existing helper logic from `core.mjs` into this module:

```js
function listNumber(value, fallback, { min = 1, max = 200 } = {}) {
  if (value === null || value === undefined || String(value).trim() === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(number)));
}

function listParams(searchParams, defaultPageSize = 100) {
  const page = listNumber(searchParams.get("page"), 1, { min: 1, max: 100000 });
  const pageSize = listNumber(searchParams.get("pageSize"), defaultPageSize, { min: 1, max: 200 });
  return {
    page,
    pageSize,
    q: String(searchParams.get("q") || "").trim().toLocaleLowerCase(),
    type: String(searchParams.get("type") || "").trim(),
    status: String(searchParams.get("status") || "").trim(),
    role: String(searchParams.get("role") || "").trim(),
    from: String(searchParams.get("from") || "").trim(),
    to: String(searchParams.get("to") || "").trim()
  };
}

function searchable(value) {
  return String(value ?? "").toLocaleLowerCase();
}

function searchableRecord(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return searchable(value);
  if (Array.isArray(value)) return value.map(searchableRecord).join(" ");
  if (typeof value === "object") return Object.values(value).map(searchableRecord).join(" ");
  return "";
}

function paginate(items, params) {
  const total = items.length;
  const start = (params.page - 1) * params.pageSize;
  const pageItems = items.slice(start, start + params.pageSize);
  return {
    items: pageItems,
    total,
    page: params.page,
    pageSize: params.pageSize,
    hasMore: start + pageItems.length < total
  };
}

function dateInRange(value, from, to) {
  if (from && (!value || value < from)) return false;
  if (to && (!value || value > to)) return false;
  return true;
}

export function createAdminListHelpers({ withReservationDetails, reportWithDetails, publicUser }) {
  function hasListQuery(searchParams) {
    return Boolean(searchParams && [...searchParams.keys()].length);
  }

  function adminReservationList(db, searchParams) {
    const params = listParams(searchParams, 100);
    const items = db.reservations
      .map((item) => withReservationDetails(db, item))
      .filter((item) => !params.type || item.type === params.type)
      .filter((item) => !params.status || item.status === params.status)
      .filter((item) => dateInRange(item.fields?.reservedDate || "", params.from, params.to))
      .filter((item) => !params.q || searchableRecord({
        id: item.id,
        type: item.type,
        status: item.status,
        fields: item.fields,
        user: item.user,
        equipmentItems: item.equipmentItems
      }).includes(params.q))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return paginate(items, params);
  }

  function adminReportList(db, searchParams) {
    const params = listParams(searchParams, 100);
    const items = db.reports
      .map((item) => reportWithDetails(db, item))
      .filter((item) => !params.type || item.type === params.type)
      .filter((item) => dateInRange(item.reservation?.fields?.reservedDate || item.submittedAt?.slice(0, 10) || "", params.from, params.to))
      .filter((item) => !params.q || searchableRecord({
        id: item.id,
        reservationId: item.reservationId,
        fields: item.fields,
        reservation: item.reservation,
        user: item.user
      }).includes(params.q))
      .sort((a, b) => String(b.submittedAt || "").localeCompare(String(a.submittedAt || "")));
    return paginate(items, params);
  }

  function adminUserList(db, searchParams) {
    const params = listParams(searchParams, 100);
    const items = db.users
      .map((user) => publicUser(user, db))
      .filter((user) => !params.role || user.role === params.role)
      .filter((user) => !params.status || user.approvalStatus === params.status)
      .filter((user) => !params.q || searchableRecord(user).includes(params.q))
      .sort((a, b) => {
        const approvalCompare = String(a.approvalStatus || "").localeCompare(String(b.approvalStatus || ""));
        if (approvalCompare) return approvalCompare;
        return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
      });
    return paginate(items, params);
  }

  return {
    hasListQuery,
    adminReservationList,
    adminReportList,
    adminUserList
  };
}
```

- [ ] **Step 3: Wire `core.mjs` to the admin list module**

At the top of `core.mjs`, add:

```js
import { createAdminListHelpers } from "./core/admin-lists.mjs";
```

Remove the local `hasListQuery`, `listNumber`, `listParams`, `searchable`, `searchableRecord`, `paginate`, `dateInRange`, `adminReservationList`, `adminReportList`, and `adminUserList` function definitions from `core.mjs`.

After `reportWithDetails(db, report)` is defined, add:

```js
const {
  hasListQuery,
  adminReservationList,
  adminReportList,
  adminUserList
} = createAdminListHelpers({
  withReservationDetails,
  reportWithDetails,
  publicUser
});
```

Do not change route code that calls `hasListQuery`, `adminReservationList`, `adminReportList`, or `adminUserList`.

- [ ] **Step 4: Verify admin list extraction**

Run:

```bash
npm run test:security && npm run check
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add core/admin-lists.mjs core.mjs
git commit -m "2026-06-30 core 관리자 목록 도메인 분리"
```

Expected: commit succeeds and does not stage unrelated Android/release documentation files.

## Task 2: Extract Maintenance And Retention Helpers

**Files:**
- Create: `core/maintenance.mjs`
- Modify: `core.mjs`
- Test: `scripts/security-smoke-test.mjs`

**Interfaces:**
- Consumes from `core.mjs`: `normalizeDb(db)`, `capLogs(db)`, `id(prefix)`.
- Produces: `createMaintenanceHelpers(deps): { cleanupExpiredData(db, nowDate, actorId) }`.

- [ ] **Step 1: Run the baseline retention test**

Run:

```bash
npm run test:security
```

Expected: PASS. This already covers anonymized reservations, deleted report HTML snapshots, and expired sessions.

- [ ] **Step 2: Create `core/maintenance.mjs`**

Create `core/maintenance.mjs` with the existing cleanup logic moved out of `core.mjs`:

```js
const TERMINAL_RETENTION_STATUSES = new Set(["cancelled", "admin_cancelled", "rejected", "returned", "completed"]);

function cutoffMs(nowDate, days) {
  return nowDate.getTime() - days * 24 * 60 * 60 * 1000;
}

function parseRecordTime(value) {
  if (!value) return Number.NaN;
  const text = String(value);
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? Date.parse(`${text}T00:00:00+09:00`)
    : Date.parse(text);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function reservationRetentionTime(reservation) {
  return parseRecordTime(reservation.fields?.reservedDate) ||
    parseRecordTime(reservation.updatedAt) ||
    parseRecordTime(reservation.createdAt);
}

export function createMaintenanceHelpers({
  normalizeDb,
  capLogs,
  id,
  reservationRetentionDays = 90,
  reportHtmlRetentionDays = 183
}) {
  function cleanupExpiredData(db, nowDate = new Date(), actorId = "system") {
    normalizeDb(db);
    const nowValue = nowDate.toISOString();
    const nowMs = nowDate.getTime();
    const reservationCutoff = cutoffMs(nowDate, reservationRetentionDays);
    const reportHtmlCutoff = cutoffMs(nowDate, reportHtmlRetentionDays);
    const summary = {
      at: nowValue,
      anonymizedReservations: 0,
      deletedReportHtmlSnapshots: 0,
      deletedExpiredSessions: 0
    };

    for (const reservation of db.reservations) {
      if (!TERMINAL_RETENTION_STATUSES.has(reservation.status) || reservation.retentionAnonymizedAt) continue;
      const retentionTime = reservationRetentionTime(reservation);
      if (!Number.isFinite(retentionTime) || retentionTime > reservationCutoff) continue;
      reservation.userId = "";
      reservation.fields = {
        ...reservation.fields,
        phone: "",
        studentStatus: "",
        renterName: "",
        userName: ""
      };
      reservation.history = [];
      reservation.retentionAnonymizedAt = nowValue;
      summary.anonymizedReservations += 1;
    }

    for (const report of db.reports) {
      if (!report.htmlSnapshot || report.htmlDeletedAt) continue;
      const expiresAt = parseRecordTime(report.expiresAt);
      const submittedAt = parseRecordTime(report.submittedAt);
      const expiredByDate = Number.isFinite(expiresAt) && expiresAt <= nowMs;
      const expiredBySubmittedAt = Number.isFinite(submittedAt) && submittedAt <= reportHtmlCutoff;
      if (!expiredByDate && !expiredBySubmittedAt) continue;
      report.htmlSnapshot = "";
      report.htmlDeletedAt = nowValue;
      summary.deletedReportHtmlSnapshots += 1;
    }

    const beforeSessions = db.sessions.length;
    db.sessions = db.sessions.filter((session) => parseRecordTime(session.expiresAt) > nowDate.getTime());
    summary.deletedExpiredSessions = beforeSessions - db.sessions.length;

    const changed = summary.anonymizedReservations ||
      summary.deletedReportHtmlSnapshots ||
      summary.deletedExpiredSessions;
    if (changed) {
      db.auditLogs.push({
        id: id("audit"),
        actorId,
        action: "maintenance.cleanup",
        targetId: "db",
        detail: summary,
        createdAt: nowValue
      });
      capLogs(db);
    }
    return { ...summary, changed: Boolean(changed) };
  }

  return { cleanupExpiredData };
}
```

- [ ] **Step 3: Wire `core.mjs` to the maintenance module**

At the top of `core.mjs`, add:

```js
import { createMaintenanceHelpers } from "./core/maintenance.mjs";
```

Remove `TERMINAL_RETENTION_STATUSES`, `cutoffMs`, `parseRecordTime`, `reservationRetentionTime`, and the local `cleanupExpiredData` function from `core.mjs`.

After `capLogs(db)` is defined, add:

```js
const { cleanupExpiredData: cleanupExpiredDataImpl } = createMaintenanceHelpers({
  normalizeDb,
  capLogs,
  id,
  reservationRetentionDays: RESERVATION_RETENTION_DAYS,
  reportHtmlRetentionDays: REPORT_HTML_RETENTION_DAYS
});

export const cleanupExpiredData = cleanupExpiredDataImpl;
```

Keep every caller importing `cleanupExpiredData` from `core.mjs`; do not import `core/maintenance.mjs` from adapters or scripts.

- [ ] **Step 4: Verify retention extraction**

Run:

```bash
npm run test:security && npm run check
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add core/maintenance.mjs core.mjs
git commit -m "2026-06-30 core 정리 작업 도메인 분리"
```

Expected: commit succeeds and does not stage unrelated Android/release documentation files.

## Task 3: Extract Slack Notification Helpers

**Files:**
- Create: `core/notifications.mjs`
- Modify: `core.mjs`
- Test: `scripts/security-smoke-test.mjs`

**Interfaces:**
- Consumes from `core.mjs`: `maskPhone(phone)`, `normalizeStatusLabel(status)`, `reservationTitle(type)`, `studioSpaces(fields)`, `nowIso()`.
- Produces: `createNotificationHelpers(deps): { formatSlackMessage(db, event, payload), postSlack(webhook, db, event, payload) }`.

- [ ] **Step 1: Run baseline notification/security test**

Run:

```bash
npm run test:security
```

Expected: PASS. This proves existing Slack masking/security smoke paths work before extraction.

- [ ] **Step 2: Create `core/notifications.mjs`**

Create `core/notifications.mjs` by moving the existing `formatSlackMessage` and `postSlack` logic out of `core.mjs`:

```js
export function createNotificationHelpers({
  id,
  maskPhone,
  normalizeStatusLabel,
  reservationTitle,
  studioSpaces,
  nowIso
}) {
  function formatSlackMessage(db, event, reservation) {
    const user = db.users.find((item) => item.id === reservation.userId) || {};
    const title = {
      student_signup: "[학생 가입 승인 요청]",
      reservation_created: `[${reservationTitle(reservation.type)} 예약 ${reservation.type === "equipment" ? "승인 요청" : "확정"}]`,
      reservation_updated: `[${reservationTitle(reservation.type)} 예약 수정]`,
      reservation_cancelled: `[${reservationTitle(reservation.type)} 예약 취소]`,
      reservation_status: `[${reservationTitle(reservation.type)} 상태 변경]`,
      studio_report: "[스튜디오 보고서 제출]"
    }[event] || "[GJU Photography Reservation]";

    if (event === "student_signup") {
      return `${title}\n이름: ${reservation.name}\n학번: ${reservation.studentId || "-"}\n신분: ${reservation.studentStatus}\n연락처: ${maskPhone(reservation.phone)}\n상태: 승인 대기`;
    }

    const fields = reservation.fields || {};
    const detailUrl = `${db.settings.adminUrl}/reservations/${reservation.id}`;
    const lines = [
      title,
      `예약자: ${user.name || "-"} / ${maskPhone(fields.phone || user.phone)}`,
      `신분: ${fields.studentStatus || user.studentStatus || "-"}`,
      `사용일: ${fields.reservedDate || "-"}`,
      `상태: ${normalizeStatusLabel(reservation.status)}`
    ];

    if (reservation.type === "equipment") {
      const items = (fields.equipmentItemIds || []).map((itemId) => db.equipment.find((item) => item.id === itemId)).filter(Boolean).map((item) => item.code).join(", ");
      lines.splice(4, 0, `대여시간: ${fields.rentalTime}`, `반납시간: ${fields.returnTime}`, `품목: ${items || fields.detailEquipment || "-"}`);
    }
    if (reservation.type === "studio") lines.splice(4, 0, `시간: ${(fields.timeSlots || []).join(", ")}`, `장소: ${studioSpaces(fields).join(", ")}`, `필요 장비: ${fields.requiredEquipment || "-"}`);
    if (reservation.type === "darkroom") {
      const chemicals = (fields.chemicals || []).map((item) => `${item.name} ${item.amount}`).join(", ");
      lines.splice(4, 0, `시간: ${(fields.timeSlots || []).join(", ")}`, `작업: ${(fields.processTypes || []).join(", ")}`, `사용 약품: ${chemicals || "-"}`);
    }
    if (reservation.type === "print") lines.splice(4, 0, `시간: ${fields.startTime}-${fields.endTime}`, `출력: ${fields.printType} / ${fields.paper} / ${fields.size}`, `매수: ${fields.count || "-"}`);

    lines.push(`상세: ${detailUrl}`);
    return lines.join("\n");
  }

  async function postSlack(webhook, db, event, payload) {
    const log = { id: id("slack"), event, status: "skipped", message: "", createdAt: nowIso() };
    const text = typeof payload === "string" ? payload : formatSlackMessage(db, event, payload);
    log.message = text;

    if (!webhook) {
      db.slackLogs.push(log);
      return log;
    }

    try {
      const response = await fetch(webhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text })
      });
      log.status = response.ok ? "sent" : "failed";
      log.response = await response.text();
    } catch (error) {
      log.status = "failed";
      log.response = error.message;
    }
    db.slackLogs.push(log);
    return log;
  }

  return {
    formatSlackMessage,
    postSlack
  };
}
```

- [ ] **Step 3: Wire `core.mjs` to the notification module**

At the top of `core.mjs`, add:

```js
import { createNotificationHelpers } from "./core/notifications.mjs";
```

Remove the local `formatSlackMessage` and `postSlack` function definitions from `core.mjs`.

After `studioSpaces(fields = {})` is defined, add:

```js
const {
  formatSlackMessage,
  postSlack
} = createNotificationHelpers({
  id,
  maskPhone,
  normalizeStatusLabel,
  reservationTitle,
  studioSpaces,
  nowIso
});
```

Do not change route code that calls `postSlack`.

- [ ] **Step 4: Verify notification extraction**

Run:

```bash
npm run test:security && npm run check
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add core/notifications.mjs core.mjs
git commit -m "2026-06-30 core 알림 도메인 분리"
```

Expected: commit succeeds and does not stage unrelated Android/release documentation files.

## Task 4: Full Regression And Review

**Files:**
- No source edits unless a verification command exposes a defect.

**Interfaces:**
- Consumes: Tasks 1-3 extracted modules.
- Produces: verified backend domain split ready for the next frontend event split plan.

- [ ] **Step 1: Run focused backend checks**

Run:

```bash
npm run test:security && npm run check
```

Expected: PASS.

- [ ] **Step 2: Run full release gate**

Run:

```bash
npm run test:storage && npm run check:js && npm run release:check
```

Expected: PASS.

- [ ] **Step 3: Inspect final diff**

Run:

```bash
git status --short --untracked-files=all
git diff --stat HEAD
```

Expected: no uncommitted source changes from this plan. Existing unrelated Android/release documentation changes may remain and must not be reverted.

- [ ] **Step 4: Request final code review**

Use `superpowers:requesting-code-review` for the range starting at the commit before Task 1 and ending at current `HEAD`. The review focus is:

```text
core.mjs remains the public facade, extracted modules are dependency-injected, public API behavior is unchanged, release checks pass, and no unrelated Android/release documentation changes were included.
```

Expected: no Critical or Important findings. Fix any Critical/Important findings before final response.

- [ ] **Step 5: Final handoff note**

Final response should include:

```text
Verified:
- npm run test:security
- npm run check
- npm run test:storage
- npm run check:js
- npm run release:check

Deferred:
- public/js/events.js handler split
- view/CSS organization
```

Expected: user can approve the next frontend split plan after this backend split is complete.
