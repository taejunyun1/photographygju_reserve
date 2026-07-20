import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

const reactAdminCssSource = fs.readFileSync("src/react/design-system/react-admin.css", "utf8");
const adminScreenSource = [
  "AdminUsers.tsx",
  "AdminReservations.tsx",
  "AdminEquipment.tsx",
  "AdminReports.tsx",
  "AdminLectures.tsx",
  "AdminNotices.tsx",
  "AdminLogs.tsx",
  "AdminSettings.tsx"
].map((file) => fs.readFileSync(path.join("src/react/admin/screens", file), "utf8")).join("\n");

const renderEntry = await build({
  stdin: {
    contents: `
      export { GjuButton, GjuIconButton } from "../src/react/design-system/Button.tsx";
      export { GjuCard } from "../src/react/design-system/Card.tsx";
      export { GjuDialog } from "../src/react/design-system/Dialog.tsx";
      export { GjuEmptyState } from "../src/react/design-system/EmptyState.tsx";
      export { GjuStatusBadge } from "../src/react/design-system/StatusBadge.tsx";
      export { GjuTable } from "../src/react/design-system/Table.tsx";
      export { GjuTabs } from "../src/react/design-system/Tabs.tsx";
      export { GjuToast } from "../src/react/design-system/Toast.tsx";
      export { AdminApp } from "../src/react/admin/AdminApp.tsx";
      export { AdminDashboard } from "../src/react/admin/screens/AdminDashboard.tsx";
      export { AdminCourseDemand } from "../src/react/admin/screens/AdminCourseDemand.tsx";
    `,
    resolveDir: path.join(process.cwd(), "scripts"),
    sourcefile: "scripts/react-admin-render-entry.tsx",
    loader: "tsx"
  },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  external: ["react", "react-dom", "react-dom/server"]
});

const compiledModulePath = path.join(process.cwd(), "scripts", ".react-admin-render-test.compiled.mjs");
fs.writeFileSync(compiledModulePath, renderEntry.outputFiles[0].text);
process.on("exit", () => {
  if (fs.existsSync(compiledModulePath)) {
    fs.unlinkSync(compiledModulePath);
  }
});
const renderModule = await import(pathToFileURL(compiledModulePath).href);

const dialogBehaviorEntry = await build({
  stdin: {
    contents: `
      export { dialogCalls } from "virtual-dialog-mock";
      export { iconButtonCalls, buttonCalls } from "virtual-button-mock";
      export { GjuDialog } from "../src/react/design-system/Dialog.tsx";
    `,
    resolveDir: path.join(process.cwd(), "scripts"),
    sourcefile: "scripts/react-admin-dialog-behavior-entry.tsx",
    loader: "tsx"
  },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  external: ["react", "react-dom", "react-dom/server"],
  plugins: [
    {
      name: "dialog-behavior-mocks",
      setup(buildContext) {
        buildContext.onResolve({ filter: /^virtual-dialog-mock$/ }, () => ({
          path: "virtual-dialog-mock",
          namespace: "dialog-behavior"
        }));
        buildContext.onResolve({ filter: /^virtual-button-mock$/ }, () => ({
          path: "virtual-button-mock",
          namespace: "dialog-behavior"
        }));
        buildContext.onResolve({ filter: /^@astryxdesign\/core\/Dialog$/ }, () => ({
          path: "virtual-dialog-mock",
          namespace: "dialog-behavior"
        }));
        buildContext.onResolve({ filter: /^\.\/Button$/ }, (args) => {
          if (args.importer.endsWith(`${path.sep}Dialog.tsx`)) {
            return {
              path: "virtual-button-mock",
              namespace: "dialog-behavior"
            };
          }
          return null;
        });
        buildContext.onLoad({ filter: /^virtual-dialog-mock$/, namespace: "dialog-behavior" }, () => ({
          contents: `
            import React from "react";
            export const dialogCalls = [];
            export function Dialog(props) {
              dialogCalls.push(props);
              return React.createElement("mock-dialog", props, props.children);
            }
          `,
          loader: "tsx"
        }));
        buildContext.onLoad({ filter: /^virtual-button-mock$/, namespace: "dialog-behavior" }, () => ({
          contents: `
            import React from "react";
            export const iconButtonCalls = [];
            export const buttonCalls = [];
            export function GjuIconButton(props) {
              iconButtonCalls.push(props);
              return React.createElement("mock-icon-button", props);
            }
            export function GjuButton(props) {
              buttonCalls.push(props);
              return React.createElement("mock-button", props, props.children);
            }
          `,
          loader: "tsx"
        }));
      }
    }
  ]
});
const dialogBehaviorModulePath = path.join(process.cwd(), "scripts", ".react-admin-dialog-behavior-test.compiled.mjs");
fs.writeFileSync(dialogBehaviorModulePath, dialogBehaviorEntry.outputFiles[0].text);
process.on("exit", () => {
  if (fs.existsSync(dialogBehaviorModulePath)) {
    fs.unlinkSync(dialogBehaviorModulePath);
  }
});
const dialogBehaviorModule = await import(pathToFileURL(dialogBehaviorModulePath).href);

const button = renderToStaticMarkup(
  React.createElement(renderModule.GjuButton, { tone: "danger" }, "삭제")
);
assert(button.includes("gju-button"), "button must use shared class");
assert(button.includes("astryx-button"), "button wrapper must adapt Astryx Button");
assert(button.includes('data-tone="danger"'), "button must preserve tone data attribute");

const iconButton = renderToStaticMarkup(
  React.createElement(renderModule.GjuIconButton, { label: "삭제", icon: "trash", tone: "danger" })
);
assert(iconButton.includes('aria-label="삭제"'), "icon button must keep accessible label");
assert(iconButton.includes('title="삭제"'), "icon button must expose its label as a native tooltip");
assert(!iconButton.includes(">삭제<"), "icon button must not render visible label text");
assert(iconButton.includes("gju-icon-button"), "icon button must use shared class");
assert(iconButton.includes("astryx-button"), "icon button wrapper must adapt Astryx IconButton");

const card = renderToStaticMarkup(
  React.createElement(renderModule.GjuCard, { title: "테스트 카드" }, "본문")
);
assert(card.includes("테스트 카드"), "card must render title");
assert(card.includes("gju-card"), "card must use shared class");
assert(card.includes("astryx-card"), "card wrapper must adapt Astryx Card");

const workspaceCard = renderToStaticMarkup(
  React.createElement(renderModule.GjuCard, { title: "학생 목록", surface: "workspace" }, "내용")
);
assert(workspaceCard.includes('data-surface="workspace"'), "workspace card must expose its flat surface contract");

const tabs = renderToStaticMarkup(
  React.createElement(renderModule.GjuTabs, {
    id: "status-tabs",
    activeKey: "pending",
    items: [
      { key: "pending", label: "승인 대기" },
      { key: "approved", label: "승인 완료" }
    ]
  })
);
assert(tabs.includes('role="tablist"'), "tabs must expose a tablist role");
assert.equal((tabs.match(/role="tab"/g) || []).length, 2, "tabs must expose one tab role per item");
assert(tabs.includes('data-orientation="horizontal"'), "tabs must expose its orientation for responsive styling");

const badge = renderToStaticMarkup(
  React.createElement(renderModule.GjuStatusBadge, { tone: "green" }, "가능")
);
assert(badge.includes("가능"), "status badge must render label");
assert(badge.includes("gju-status-badge"), "status badge must use shared class");
assert(badge.includes("astryx-badge"), "status badge wrapper must adapt Astryx Badge");

const dialogMarkup = renderToStaticMarkup(
  React.createElement(
    React.Fragment,
    null,
    React.createElement(renderModule.GjuDialog, { open: true, title: "첫 번째 확인", onClose() {} }, "본문"),
    React.createElement(renderModule.GjuDialog, { open: true, title: "두 번째 확인" })
  )
);
assert(dialogMarkup.includes("gju-dialog"), "dialog must use shared class");
assert(dialogMarkup.includes("gju-motion-dialog"), "dialog must use motion class");
assert(dialogMarkup.includes("astryx-dialog"), "dialog wrapper must adapt Astryx Dialog");
assert(dialogMarkup.includes('role="dialog"'), "dialog must expose dialog role");
assert(dialogMarkup.includes('aria-modal="true"'), "dialog must expose modal semantics");
assert(dialogMarkup.includes('aria-label="닫기"'), "dialog must render a close button");
assert(dialogMarkup.includes('class="gju-dialog__header"'), "dialog must render a named header layout class");
assert(dialogMarkup.includes(">본문<"), "dialog must render children as body content");
const dialogIds = [...dialogMarkup.matchAll(/id="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((id) => id.includes("gju-dialog-title"));
assert.equal(dialogIds.length, 2, "dialog must render one title id per instance");
assert.equal(new Set(dialogIds).size, 2, "dialog title ids must be unique per instance");
for (const dialogId of dialogIds) {
  assert(dialogMarkup.includes(`aria-labelledby="${dialogId}"`), "dialog must label itself with its unique title id");
}

const closeEvents = [];
renderToStaticMarkup(
  React.createElement(dialogBehaviorModule.GjuDialog, {
    open: true,
    title: "닫기 우선순위",
    onClose() {
      closeEvents.push("close");
    },
    onCancel() {
      closeEvents.push("cancel");
    }
  })
);
assert.equal(dialogBehaviorModule.dialogCalls.length, 1, "dialog behavior test must capture Astryx dialog props");
assert.equal(dialogBehaviorModule.iconButtonCalls.length, 1, "dialog behavior test must capture close button props");
assert.equal(dialogBehaviorModule.buttonCalls.length, 2, "dialog behavior test must capture footer buttons");
dialogBehaviorModule.dialogCalls[0].onOpenChange(false);
assert.deepEqual(closeEvents, ["close"], "dialog open-change close path must prefer onClose over onCancel");
closeEvents.length = 0;
dialogBehaviorModule.iconButtonCalls[0].onClick();
assert.deepEqual(closeEvents, ["close"], "dialog close button must prefer onClose over onCancel");
closeEvents.length = 0;
dialogBehaviorModule.buttonCalls[0].onClick();
assert.deepEqual(closeEvents, ["close"], "dialog cancel button must prefer onClose over onCancel");

const iconCallCountBeforeHeaderOnlyDialog = dialogBehaviorModule.iconButtonCalls.length;
const buttonCallCountBeforeHeaderOnlyDialog = dialogBehaviorModule.buttonCalls.length;
renderToStaticMarkup(
  React.createElement(dialogBehaviorModule.GjuDialog, {
    open: true,
    title: "정보",
    showActions: false,
    onClose() {}
  })
);
assert.equal(dialogBehaviorModule.iconButtonCalls.length, iconCallCountBeforeHeaderOnlyDialog + 1, "header-only dialog must keep one close icon");
assert.equal(dialogBehaviorModule.buttonCalls.length, buttonCallCountBeforeHeaderOnlyDialog, "header-only dialog must not render duplicate footer close buttons");

const emptyState = renderToStaticMarkup(
  React.createElement(renderModule.GjuEmptyState, {
    title: "비어 있음",
    message: "표시할 데이터가 없습니다."
  })
);
assert(emptyState.includes("gju-empty-state"), "empty state must use shared class");
assert(emptyState.includes("astryx-empty-state"), "empty state wrapper must adapt Astryx EmptyState");

const table = renderToStaticMarkup(
  React.createElement(
    renderModule.GjuTable,
    null,
    React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "이름"))),
    React.createElement("tbody", null, React.createElement("tr", null, React.createElement("td", null, "홍길동")))
  )
);
assert(table.includes("gju-table"), "table must use shared class");
assert(table.includes("astryx-table"), "table wrapper must adapt Astryx Table");

const toast = renderToStaticMarkup(
  React.createElement(renderModule.GjuToast, { message: "저장되었습니다." })
);
assert(toast.includes("gju-toast"), "toast must use shared class");
assert(toast.includes("gju-motion-toast"), "toast must use motion class");
assert(toast.includes("astryx-toast"), "toast wrapper must adapt Astryx Toast");
assert(toast.includes("저장되었습니다."), "toast must render the message");
assert(toast.includes('role="status"'), "toast must expose status role");
assert(toast.includes('aria-live="polite"'), "toast must announce politely");

const noopActions = new Proxy({}, {
  get: () => () => undefined
});

function reactElements(node, predicate, matches = []) {
  if (!React.isValidElement(node)) return matches;
  if (predicate(node)) matches.push(node);
  React.Children.forEach(node.props?.children, (child) => reactElements(child, predicate, matches));
  return matches;
}

const shellMarkup = renderToStaticMarkup(
  React.createElement(renderModule.AdminApp, {
    state: { adminView: "dashboard", user: { role: "admin", name: "admin" }, summary: {} },
    actions: noopActions
  })
);
assert(shellMarkup.includes("gju-app-shell"), "React Admin shell must render app shell");
assert(shellMarkup.includes("학생 승인"), "React Admin shell must render Korean nav labels");
assert(shellMarkup.includes('aria-label="새로고침"'), "React Admin shell must render refresh icon action");
assert(shellMarkup.includes("gju-app-shell__sidebar gju-app-shell__desktop-only"), "React Admin shell must mark desktop sidebar chrome explicitly");
assert(shellMarkup.includes("gju-app-shell__header gju-app-shell__desktop-header"), "React Admin shell must render dedicated desktop header chrome");
assert(shellMarkup.includes("gju-app-shell__mobile-header gju-app-shell__mobile-only"), "React Admin shell must mark mobile header chrome explicitly");
assert(shellMarkup.includes("gju-app-shell__bottom-nav gju-app-shell__mobile-only"), "React Admin shell must mark mobile bottom navigation explicitly");
assert(shellMarkup.includes("대시보드"), "React Admin shell must render the current page title");
const desktopHeaderSegment = shellMarkup.match(
  /<header class="gju-app-shell__header gju-app-shell__desktop-header">([\s\S]*?)<\/header>/
)?.[1];
assert(desktopHeaderSegment, "React Admin shell must render desktop header markup");
assert(desktopHeaderSegment.includes('<div class="gju-admin-header">'), "React Admin shell must mount admin header content inside the desktop header slot");
assert(desktopHeaderSegment.includes('aria-label="내 정보"'), "Desktop header must render the account action");
assert(desktopHeaderSegment.includes('aria-label="새로고침"'), "Desktop header must render the refresh action");
assert(desktopHeaderSegment.includes('aria-label="나가기"'), "Desktop header must render the logout action");

const mobileHeaderSegment = shellMarkup.match(
  /<header class="gju-app-shell__header gju-app-shell__mobile-header gju-app-shell__mobile-only">([\s\S]*?)<\/header>/
)?.[1];
assert(mobileHeaderSegment, "React Admin shell must render mobile header markup");
assert(mobileHeaderSegment.includes('<div class="gju-admin-header">'), "React Admin shell must keep the admin header content inside the mobile header slot");
assert(mobileHeaderSegment.includes('aria-label="내 정보"'), "Mobile header must keep the account action");
assert(mobileHeaderSegment.includes('aria-label="새로고침"'), "Mobile header must keep the refresh action");
assert(mobileHeaderSegment.includes('aria-label="나가기"'), "Mobile header must keep the logout action");

const mobileBottomNavSegment = shellMarkup.match(
  /<div class="gju-app-shell__bottom-nav gju-app-shell__mobile-only">([\s\S]*?)<\/div>/
)?.[1];
assert(mobileBottomNavSegment, "React Admin shell must render mobile bottom nav markup");
assert(!mobileBottomNavSegment.includes('aria-label="새로고침"'), "Mobile bottom nav must remain separate from header actions");
assert(!mobileBottomNavSegment.includes('aria-label="나가기"'), "Mobile bottom nav must not contain header actions");
for (const label of ["대시보드", "학생", "예약", "기자재", "더보기"]) {
  assert(mobileBottomNavSegment.includes(`aria-label="${label}"`), `Mobile bottom nav must render icon-only ${label} action`);
}
assert(!mobileBottomNavSegment.includes(">보고서<"), "Mobile bottom nav must move secondary routes into More");
assert(!mobileBottomNavSegment.includes(">설정<"), "Mobile bottom nav must move settings into More");

const dashboardMarkup = renderToStaticMarkup(
  React.createElement(renderModule.AdminApp, {
    state: {
      adminView: "dashboard",
      user: { role: "admin" },
      summary: {
        pendingUsers: 2,
        equipmentPendingApproval: 6,
        equipmentApproved: 2,
        equipmentCheckedOut: 1,
        equipmentReturned: 3,
        equipmentCancelled: 4,
        missingReports: 5
      },
      adminReservations: [],
      adminEquipment: [],
      adminReports: [],
      adminLectures: [],
      adminNotices: []
    },
    actions: noopActions
  })
);
assert(dashboardMarkup.includes("가입 승인 대기"), "dashboard must render pending users card");
assert(dashboardMarkup.includes("기자재 승인 대기"), "dashboard must render pending equipment approval card");
assert(dashboardMarkup.includes("승인 완료"), "dashboard must render approved equipment card");
assert(dashboardMarkup.includes("대여 중"), "dashboard must render checked-out card");
assert(dashboardMarkup.includes("반납 완료"), "dashboard must render returned card");
assert(dashboardMarkup.includes("취소/반려"), "dashboard must render cancelled card");
assert(dashboardMarkup.includes("보고서 확인 필요"), "dashboard must render report card");
assert(!dashboardMarkup.includes("legacy"), "dashboard must be React-owned");
assert(dashboardMarkup.includes('data-surface="workspace"'), "dashboard introduction must use the flat workspace surface");
assert(dashboardMarkup.includes("admin-dashboard-action-grid"), "dashboard action cards must use the compact responsive grid");
assert(dashboardMarkup.includes("admin-dashboard-action-card"), "dashboard action cards must expose a density styling hook");
assert(reactAdminCssSource.includes("grid-template-columns: repeat(2, minmax(0, 1fr))"), "mobile dashboard actions must use two compact columns");

const courseDemandMarkup = renderToStaticMarkup(
  React.createElement(renderModule.AdminCourseDemand, {
    state: {
      adminCoursePlanning: {
        curriculumVersions: [],
        annualPlans: [],
        surveys: [{
          id: "open-survey",
          title: "공개 설문",
          academicYear: 2027,
          term: "fall",
          eligibleCurrentYears: [2],
          targetStudentYears: [2],
          opensAt: "2026-07-01T00:00:00.000Z",
          closesAt: "2026-07-31T14:59:59.000Z",
          status: "open",
          catalogCount: 6,
          summary: { responseCount: 1, eligibleStudentCount: 10, responseRate: 10, categories: [], courses: [] }
        }],
        courses: ["art", "documentary", "advertising", "video", "art", "video"].map((demandCategory, index) => ({
          id: `course-${index + 1}`,
          name: `전공선택 ${index + 1}`,
          majorType: "전선",
          targetYears: [2],
          allowedTerms: ["fall"],
          studentCredit: 3,
          demandCategory,
          isSurveyEligible: true,
          active: true
        }))
      }
    },
    actions: noopActions
  })
);
for (const label of ["설문 제목", "학년도", "학기", "현재 학년", "수강 대상 학년", "시작", "마감", "선택한 후보 0/6", "임시저장", "설문 공개"]) {
  assert(courseDemandMarkup.includes(label), `course demand builder must render ${label}`);
}
assert(courseDemandMarkup.includes("전공선택 1"), "course demand builder must render matching elective candidates");
assert(courseDemandMarkup.includes("마감일 연장"), "course demand builder must render deadline extension for an open survey");
assert(courseDemandMarkup.includes("설문 마감"), "course demand builder must render close action for an open survey");
assert(!courseDemandMarkup.includes("85학점"), "course demand builder must not expose annual operating-plan metrics");

const dashboardNavigationCalls = [];
const dashboardTree = renderModule.AdminDashboard({
  state: {
    summary: {
      pendingUsers: 2,
      equipmentPendingApproval: 6,
      equipmentApproved: 2,
      equipmentCheckedOut: 1,
      equipmentReturned: 3,
      equipmentCancelled: 4,
      missingReports: 5,
      todaySchedule: [],
      checkoutReturnQueue: [{
        id: "dashboard-return",
        type: "equipment",
        status: "checked_out",
        queueAction: "return",
        queueAt: "2026-07-12T08:10:00.000Z",
        fields: { reservedDate: "2026-07-10", rentalTime: "10:15", returnTime: "17:10" },
        user: { name: "반납 학생" }
      }],
      metrics: {
        weekReservations: 9,
        activeEquipment: 10,
        availableEquipment: 8,
        repairEquipment: 2,
        equipmentAvailableRate: 80,
        cancelledReservations: 1,
        reportQueueCount: 5,
        openLectures: 2,
        typeCounts: { equipment: 6, studio: 3 },
        popularEquipment: [{ name: "Sony FX3", count: 4 }],
        latestNotice: { title: "운영 공지" }
      }
    }
  },
  actions: {
    setAdminView(view, filters) {
      dashboardNavigationCalls.push([view, filters]);
    }
  }
});
const dashboardButtons = reactElements(dashboardTree, (element) => element.type === "button");
dashboardButtons[1].props.onClick();
dashboardButtons[2].props.onClick();
dashboardButtons[3].props.onClick();
dashboardButtons[4].props.onClick();
dashboardButtons[5].props.onClick();
assert.deepEqual(
  dashboardNavigationCalls,
  [
    ["reservations", { type: "equipment", status: "pending_approval", q: "", page: 1 }],
    ["reservations", { type: "equipment", status: "approved", q: "", page: 1 }],
    ["reservations", { type: "equipment", status: "checked_out", q: "", page: 1 }],
    ["reservations", { type: "equipment", status: "returned", q: "", page: 1 }],
    ["reservations", { type: "equipment", status: "cancelled_or_rejected", q: "", page: 1 }]
  ],
  "dashboard reservation cards must pass their target filters through the typed navigation action"
);
const dashboardParityMarkup = renderToStaticMarkup(dashboardTree);
for (const label of ["운영 큐", "오늘 예약 타임라인", "대여/반납 큐", "운영 지표", "이번 주 예약 수", "기자재 가용률", "Sony FX3", "운영 공지"]) {
  assert(dashboardParityMarkup.includes(label), `dashboard must render ${label}`);
}
assert(dashboardParityMarkup.includes("반납 17:10"), "dashboard return queue must display the computed return action and time instead of rental time");

const refreshingShellMarkup = renderToStaticMarkup(
  React.createElement(renderModule.AdminApp, {
    state: {
      adminView: "dashboard",
      user: { role: "admin", name: "admin" },
      summary: {},
      adminRefresh: { refreshing: true }
    },
    actions: noopActions
  })
);
assert(refreshingShellMarkup.includes('aria-label="새로고침 중"'), "React Admin refresh action must announce the in-progress label");
assert(refreshingShellMarkup.includes('aria-busy="true"'), "React Admin refresh action must expose aria-busy while refreshing");
const refreshingDesktopHeaderSegment = refreshingShellMarkup.match(
  /<header class="gju-app-shell__header gju-app-shell__desktop-header">([\s\S]*?)<\/header>/
)?.[1];
assert(refreshingDesktopHeaderSegment, "React Admin shell must keep desktop header markup while refreshing");
assert(refreshingDesktopHeaderSegment.includes('aria-label="새로고침 중"'), "Desktop header refresh action must expose the busy label");
assert(refreshingDesktopHeaderSegment.includes("aria-busy=\"true\""), "Desktop header refresh action must stay busy while refreshing");

const usersMarkup = renderToStaticMarkup(
  React.createElement(renderModule.AdminApp, {
    state: {
      adminView: "users",
      user: { role: "admin" },
      adminUserSort: { field: "name", direction: "asc" },
      adminUsersPage: { total: 6, page: 2, pageSize: 2, hasMore: true },
      adminUsers: [
        {
          id: "u1",
          role: "student",
          name: "학생",
          email: "s@gju.local",
          studentId: "20260001",
          studentStatus: "재학생",
          phone: "010",
          approvalStatus: "approved"
        }
      ]
    },
    actions: noopActions
  })
);
assert(usersMarkup.includes("admin-user-table-wrap admin-react-desktop-table"), "student approval desktop table must use the shared responsive ownership class");
assert(!usersMarkup.includes("data-user-"), "React users screen must not emit delegated user action attributes");
assert(!usersMarkup.includes("data-admin-users-page"), "React users pagination must use React handlers");
for (const label of ["이름", "학번", "신분", "상태", "이전", "다음"]) {
  assert(usersMarkup.includes(label), `React users screen must keep the ${label} control`);
}
for (const label of ["학생 반려", "비밀번호 초기화", "메모 추가", "학생 삭제"]) {
  assert(usersMarkup.includes(`aria-label="${label}"`), `React users ${label} action must be icon-only accessible`);
  assert(usersMarkup.includes(`title="${label}"`), `React users ${label} action must expose a native tooltip`);
}
assert(!usersMarkup.includes(">비번 리셋</button>"), "React users password reset must not render visible text");
assert(!usersMarkup.includes(">삭제</button>"), "React users delete must not render visible delete text");
assert(usersMarkup.includes('data-surface="workspace"'), "React users list must use the flat workspace surface");

const usersWarningMemoMarkup = renderToStaticMarkup(
  React.createElement(renderModule.AdminApp, {
    state: {
      adminView: "users",
      user: { role: "admin" },
      adminUserSearch: "연체",
      adminUserSort: { field: "name", direction: "asc" },
      adminUsersPage: { total: 1, page: 1, pageSize: 20, hasMore: false },
      adminUsers: [
        {
          id: "u2",
          role: "student",
          name: "경고학생",
          email: "warn@gju.local",
          studentId: "20260002",
          studentStatus: "재학생",
          phone: "010-1234-5678",
          approvalStatus: "approved",
          warningCount: 2,
          warningRecords: [
            {
              id: "w2",
              reason: "장비 연체 2회",
              createdAt: "2026-07-03T10:30:00.000Z"
            },
            {
              id: "w1",
              reason: "이전 메모",
              createdAt: "2026-07-02T08:00:00.000Z"
            }
          ]
        }
      ]
    },
    actions: noopActions
  })
);
assert(!usersWarningMemoMarkup.includes("data-user-warn"), "React warning actions must use React handlers");
assert(usersWarningMemoMarkup.includes("메모 추가"), "React users screen must render warning memo add control");
assert(usersWarningMemoMarkup.includes("초기화"), "React users screen must render warning memo reset control");
assert(usersWarningMemoMarkup.includes("최근 경고 메모 2건"), "React users screen must render warning memo summary");
assert(usersWarningMemoMarkup.includes("장비 연체 2회"), "React users screen must render the latest warning memo reason");
assert(!usersWarningMemoMarkup.includes("검색 결과가 없습니다."), "React users search must match warning memo text");
for (const label of ["메모 추가", "메모 초기화"]) {
  assert(usersWarningMemoMarkup.includes(`aria-label="${label}"`), `React users ${label} action must be icon-only accessible`);
  assert(usersWarningMemoMarkup.includes(`title="${label}"`), `React users ${label} action must expose a native tooltip`);
}

const serverOrderedUsersMarkup = renderToStaticMarkup(
  React.createElement(renderModule.AdminApp, {
    state: {
      adminView: "users",
      user: { role: "admin" },
      adminUserSort: { field: "name", direction: "asc" },
      adminUsersPage: { total: 2, page: 1, pageSize: 20, hasMore: false },
      adminUsers: [
        { id: "server-first", role: "student", name: "Zulu", approvalStatus: "approved" },
        { id: "server-second", role: "student", name: "Alpha", approvalStatus: "approved" }
      ]
    },
    actions: noopActions
  })
);
assert(
  serverOrderedUsersMarkup.indexOf("Zulu") < serverOrderedUsersMarkup.indexOf("Alpha"),
  "React users must preserve the server-sorted page order"
);

const equipmentMarkup = renderToStaticMarkup(
  React.createElement(renderModule.AdminApp, {
    state: {
      adminView: "equipment",
      user: { role: "admin" },
      adminEquipment: [
        {
          id: "e1",
          code: "CAM-1",
          name: "카메라",
          category: "Body",
          brand: "Sony",
          model: "FX3",
          source: "school",
          status: "가능",
          active: true,
          reservable: true
        }
      ]
    },
    actions: noopActions
  })
);
assert(equipmentMarkup.includes("admin-equipment-table-wrap admin-react-desktop-table"), "equipment desktop table must use the shared responsive ownership class");
assert(!equipmentMarkup.includes("data-equipment-remove-admin"), "React equipment remove must use an onClick handler");
assert(!equipmentMarkup.includes("data-equipment-bulk-status"), "React equipment bulk status must use onClick handlers");
assert(!equipmentMarkup.includes("data-admin-equipment-panel-tab"), "React equipment tabs must use onClick handlers");
assert(equipmentMarkup.includes("문의"), "React equipment screen must include inquiry status action");
assert(equipmentMarkup.includes("장비추가"), "React equipment manage view must keep access to the add workflow tab");
assert(equipmentMarkup.includes('data-surface="workspace"'), "React equipment list must use the flat workspace surface");
for (const label of ["가능 상태로 변경", "수리중 상태로 변경", "파손 상태로 변경", "문의 상태로 변경", "기자재 제거"]) {
  assert(equipmentMarkup.includes(`aria-label="${label}"`), `React equipment ${label} action must be icon-only accessible`);
  assert(equipmentMarkup.includes(`title="${label}"`), `React equipment ${label} action must expose a native tooltip`);
}

const equipmentBrandMarkup = renderToStaticMarkup(
  React.createElement(renderModule.AdminApp, {
    state: {
      adminView: "equipment",
      user: { role: "admin" },
      adminEquipmentSearch: "sony",
      adminEquipment: [
        {
          id: "e1",
          code: "CAM-1",
          name: "카메라",
          category: "Body",
          brand: "Sony",
          model: "FX3",
          source: "school",
          status: "가능",
          active: true,
          reservable: true
        }
      ]
    },
    actions: noopActions
  })
);
assert(equipmentBrandMarkup.includes("CAM-1"), "React equipment search must match brand");

const equipmentModelMarkup = renderToStaticMarkup(
  React.createElement(renderModule.AdminApp, {
    state: {
      adminView: "equipment",
      user: { role: "admin" },
      adminEquipmentSearch: "fx3",
      adminEquipment: [
        {
          id: "e1",
          code: "CAM-1",
          name: "카메라",
          category: "Body",
          brand: "Sony",
          model: "FX3",
          source: "school",
          status: "가능",
          active: true,
          reservable: true
        }
      ]
    },
    actions: noopActions
  })
);
assert(equipmentModelMarkup.includes("CAM-1"), "React equipment search must match model");

const equipmentReservableMarkup = renderToStaticMarkup(
  React.createElement(renderModule.AdminApp, {
    state: {
      adminView: "equipment",
      user: { role: "admin" },
      adminEquipmentSearch: "예약가능",
      adminEquipment: [
        {
          id: "e1",
          code: "CAM-1",
          name: "카메라",
          category: "Body",
          brand: "Sony",
          model: "FX3",
          source: "school",
          status: "가능",
          active: true,
          reservable: true
        }
      ]
    },
    actions: noopActions
  })
);
assert(equipmentReservableMarkup.includes("CAM-1"), "React equipment search must match reservable token parity");

const equipmentAddMarkup = renderToStaticMarkup(
  React.createElement(renderModule.AdminApp, {
    state: {
      adminView: "equipment",
      adminEquipmentPanelTab: "add",
      user: { role: "admin" },
      adminEquipment: []
    },
    actions: noopActions
  })
);
assert(equipmentAddMarkup.includes("장비추가"), "React equipment add view must render native add form");
assert(equipmentAddMarkup.includes("카테고리 추가"), "React equipment add view must render native category form");
assert(equipmentAddMarkup.includes("CSV 가져오기"), "React equipment add view must render native CSV import form");
assert(!equipmentAddMarkup.includes("gju-legacy-admin-panel"), "React equipment add view must not use LegacyAdminPanel");
assert(!equipmentAddMarkup.includes("legacy"), "React equipment add view must not render legacy fallback content");
assert(equipmentAddMarkup.includes('name="codePrefix"'), "React equipment add form must submit the server codePrefix contract");
assert(equipmentAddMarkup.includes("문의 전용"), "React equipment add form must expose inquiry-only registration explicitly");

const logsMarkup = renderToStaticMarkup(
  React.createElement(renderModule.AdminApp, {
    state: {
      adminView: "logs",
      user: { role: "admin" },
      adminSessions: [
        {
          id: "s1",
          user: { name: "admin", email: "admin@gju.local" },
          ip: "127.0.0.1",
          device: "Mac / Chrome",
          userAgent: "UA",
          createdAt: "2026-07-03T00:00:00.000Z",
          expiresAt: "2026-07-17T00:00:00.000Z"
        }
      ],
      adminLogs: [
        {
          id: "log1",
          action: "user.approval_changed",
          actor: { name: "관리자", email: "admin@gju.local", studentId: "20260001" },
          targetId: "u1",
          detail: { status: "approved" },
          createdAt: "2026-07-03T00:30:00.000Z"
        }
      ]
    },
    actions: noopActions
  })
);
assert(!logsMarkup.includes("data-session-revoke"), "React logs session revoke must use an onClick handler");
assert(logsMarkup.includes('aria-label="로그아웃"'), "React logs screen must keep the accessible session revoke action");
assert(!logsMarkup.includes(">로그아웃</button>"), "React session revoke must be icon-only");
assert(logsMarkup.includes("관리자"), "React logs screen must render actor object names");
assert(logsMarkup.includes("20260001"), "React logs screen must render actor object student ids");
assert(!logsMarkup.includes("[object Object]"), "React logs screen must not stringify actor objects");
assert(!logsMarkup.includes('<span class="muted">UA</span>'), "session tables must not render the raw User-Agent as visible card text");
assert.equal(
  (logsMarkup.match(/table-wrap embedded admin-react-desktop-table/g) || []).length,
  2,
  "session and activity-log tables must use the shared desktop ownership class"
);
assert(logsMarkup.includes('aria-label="로그인 세션 목록"'), "sessions must render a mobile-owned card list");
assert(logsMarkup.includes('aria-label="활동 로그 목록"'), "activity logs must render a mobile-owned card list");
assert(
  /<button(?=[^>]*gju-icon-button)(?=[^>]*aria-label="로그아웃")[^>]*>/.test(logsMarkup),
  "React session logout must use the shared icon button"
);
assert.equal(
  (logsMarkup.match(/data-surface="workspace"/g) || []).length,
  2,
  "React sessions and activity logs must each use a flat workspace surface"
);

const logsSearchMarkup = renderToStaticMarkup(
  React.createElement(renderModule.AdminApp, {
    state: {
      adminView: "logs",
      user: { role: "admin" },
      adminLogSearch: "20260001",
      adminSessions: [],
      adminLogs: [
        {
          id: "log1",
          action: "user.approval_changed",
          actor: { name: "관리자", email: "admin@gju.local", studentId: "20260001" },
          targetId: "u1",
          detail: { status: "approved" },
          createdAt: "2026-07-03T00:30:00.000Z"
        }
      ]
    },
    actions: noopActions
  })
);
assert(logsSearchMarkup.includes("관리자"), "React logs search must match actor object fields");
assert(!logsSearchMarkup.includes("검색 결과가 없습니다."), "React logs search must not drop actor object matches");

const logsDetailMarkup = renderToStaticMarkup(
  React.createElement(renderModule.AdminApp, {
    state: {
      adminView: "logs",
      user: { role: "admin" },
      adminLogSearch: "login@example.com",
      adminSessions: [],
      adminLogs: [
        {
          id: "log-detail",
          action: "user.deleted",
          targetId: "user-old",
          detail: {
            loginId: "login@example.com",
            type: "student",
            revokedSessions: 3,
            targetUserId: "user-target"
          },
          createdAt: "2026-07-03T00:30:00.000Z"
        }
      ]
    },
    actions: noopActions
  })
);
for (const value of ["login@example.com", "student", "3", "user-target"]) {
  assert(logsDetailMarkup.includes(value), `React logs must search and display audit detail value ${value}`);
}

const studioReservationMarkup = renderToStaticMarkup(
  React.createElement(renderModule.AdminApp, {
    state: {
      adminView: "reservations",
      user: { role: "admin" },
      adminReservationTab: "studio",
      adminReservationSemesters: [{ key: "2026-S2", label: "2026년 2학기" }],
      adminReservationsPage: { total: 1, collectionTotal: 4, page: 1, pageSize: 20 },
      adminReservations: [{
        id: "studio-1",
        type: "studio",
        status: "auto_confirmed",
        user: { name: "스튜디오 학생", studentId: "20260001" },
        fields: {
          reservedDate: "2026-09-10",
          timeSlots: ["10:30-12:00"],
          studioSpaces: ["Studio A Front"],
          participants: "홍길동 외 1명",
          requiredEquipment: "Profoto B10"
        }
      }]
    },
    actions: noopActions
  })
);
for (const label of ["기자재", "암실", "스튜디오", "출력", "2026년 2학기", "Studio A Front", "홍길동 외 1명", "Profoto B10", "완료", "관리자 취소"]) {
  assert(studioReservationMarkup.includes(label), `studio reservation screen must render ${label}`);
}
assert(!studioReservationMarkup.includes(">대여완료<"), "studio reservations must not expose the equipment checked_out transition");
assert(!studioReservationMarkup.includes(">반납완료<"), "studio reservations must not expose the equipment returned transition");
assert(studioReservationMarkup.includes('data-surface="workspace"'), "React reservations list must use the flat workspace surface");
for (const label of ["완료", "관리자 취소", "예약 삭제"]) {
  assert(studioReservationMarkup.includes(`aria-label="${label}"`), `studio reservation ${label} action must be icon-only accessible`);
  assert(studioReservationMarkup.includes(`title="${label}"`), `studio reservation ${label} action must expose a native tooltip`);
}
assert(!studioReservationMarkup.includes(">관리자 취소</button>"), "studio cancellation must not render visible text");

const reservationDetailsMarkup = renderToStaticMarkup(
  React.createElement(renderModule.AdminApp, {
    state: {
      adminView: "reservations",
      user: { role: "admin" },
      adminReservationTab: "all",
      adminReservationsPage: { total: 3, collectionTotal: 5, page: 1, pageSize: 20 },
      adminReservations: [
        {
          id: "equipment-1",
          type: "equipment",
          status: "checked_out",
          fields: { reservedDate: "2026-09-11", rentalTime: "10:15", returnTime: "17:10", period: "당일", purpose: "졸업작품", cameraBagConfirmed: true },
          equipmentItems: [{ code: "CAM-FX3-01", name: "Sony FX3" }]
        },
        {
          id: "darkroom-1",
          type: "darkroom",
          status: "auto_confirmed",
          fields: { reservedDate: "2026-09-12", timeSlots: ["12:00-14:00"], processTypes: ["현상"], participantCount: 2, chemicals: [{ name: "D-76", amount: "500ml" }] }
        },
        {
          id: "print-1",
          type: "print",
          status: "auto_confirmed",
          fields: { reservedDate: "2026-09-13", startTime: "10:00", endTime: "11:00", printType: "과제", paper: "매트", size: "대형", count: 3, memo: "색상 확인" }
        }
      ]
    },
    actions: noopActions
  })
);
for (const value of ["CAM-FX3-01", "졸업작품", "현상", "D-76 500ml", "과제 / 매트 / 대형", "색상 확인", "필터 결과 예약 삭제", "전체 예약 삭제"]) {
  assert(reservationDetailsMarkup.includes(value), `reservation detail parity must render ${value}`);
}
for (const label of ["반납 처리", "예약 취소", "예약 삭제"]) {
  assert(reservationDetailsMarkup.includes(`aria-label="${label}"`), `equipment reservation ${label} action must be icon-only accessible`);
  assert(reservationDetailsMarkup.includes(`title="${label}"`), `equipment reservation ${label} action must expose a native tooltip`);
}

const equipmentApprovalMarkup = renderToStaticMarkup(
  React.createElement(renderModule.AdminApp, {
    state: {
      adminView: "reservations",
      user: { role: "admin" },
      adminReservationTab: "equipment",
      adminReservationsPage: { total: 2, collectionTotal: 2, page: 1, pageSize: 20 },
      adminReservations: [
        { id: "equipment-pending", type: "equipment", status: "pending_approval", fields: { reservedDate: "2026-09-14" } },
        { id: "equipment-approved", type: "equipment", status: "approved", fields: { reservedDate: "2026-09-15" } }
      ]
    },
    actions: noopActions
  })
);
for (const label of ["승인", "반려", "대여 처리", "예약 취소"]) {
  assert(equipmentApprovalMarkup.includes(`aria-label="${label}"`), `equipment approval lifecycle must expose ${label}`);
}
assert(equipmentApprovalMarkup.includes("승인 대기"), "equipment approval lifecycle must render the pending state");
assert(equipmentApprovalMarkup.includes("승인 완료"), "equipment approval lifecycle must render the approved state");

const reportsMarkup = renderToStaticMarkup(
  React.createElement(renderModule.AdminApp, {
    state: {
      adminView: "reports",
      user: { role: "admin" },
      adminReportSemesters: [{ key: "2026-S2", label: "2026년 2학기" }],
      adminReportsPage: { total: 1, collectionTotal: 2, page: 1, pageSize: 20 },
      adminReports: [{
        id: "report-1",
        reservationId: "studio-1",
        submittedAt: "2026-09-11T03:00:00.000Z",
        reservation: {
          id: "studio-1",
          fields: { reservedDate: "2026-09-10", studioSpaces: ["Studio A Front"] }
        },
        fields: {
          actualTime: "10:40-11:50",
          participants: "2명",
          usedEquipment: ["Profoto B10", "소프트박스"],
          resultPhotoUrl: "https://example.com/result.jpg",
          cleanupConfirmed: true,
          damageFound: true,
          damageDescription: "스탠드 잠금 불량",
          notes: "조교 확인 요청"
        }
      }]
    },
    actions: noopActions
  })
);
for (const value of ["2026년 2학기", "2026-09-10 · Studio A Front", "10:40-11:50", "2명", "Profoto B10", "소프트박스", "https://example.com/result.jpg", "스탠드 잠금 불량", "조교 확인 요청", "필터 결과 보고서 삭제", "전체 보고서 삭제"]) {
  assert(reportsMarkup.includes(value), `report detail parity must render ${value}`);
}
assert(reportsMarkup.includes('data-surface="workspace"'), "React reports list must use the flat workspace surface");

const lecturesMarkup = renderToStaticMarkup(
  React.createElement(renderModule.AdminApp, {
    state: {
      adminView: "lectures",
      user: { role: "admin" },
      adminLectureSemesters: [{ key: "2026-S2", label: "2026년 2학기" }],
      adminLecturesPage: { total: 1, collectionTotal: 2, page: 1, pageSize: 20 },
      adminLectures: [{
        id: "lecture-1",
        title: "인물 조명",
        lectureDate: "2026-09-20",
        time: "10:00 - 12:00",
        location: "Studio A",
        instructorName: "김강사",
        professor: "박교수",
        targetGrades: "2, 3학년",
        notes: "삼각대 지참",
        status: "모집중",
        applications: [{
          id: "app-1",
          userName: "신청학생",
          studentId: "20260010",
          studentStatus: "재학생",
          phone: "010-1234-5678",
          email: "student@example.com",
          appliedAt: "2026-09-01T00:00:00.000Z"
        }]
      }]
    },
    actions: noopActions
  })
);
for (const value of ["2026년 2학기", "담당교수", "대상 학년", "비고", "박교수", "2, 3학년", "삼각대 지참", "신청학생", "20260010", "010-1234-5678", "student@example.com", "CSV 내보내기", "필터 결과 특강 삭제", "전체 특강 삭제"]) {
  assert(lecturesMarkup.includes(value), `lecture parity must render ${value}`);
}
assert(lecturesMarkup.includes('data-surface="workspace"'), "React lectures list must use the flat workspace surface");
assert(lecturesMarkup.includes("특강 등록 열기"), "lecture create form must be collapsed behind an explicit disclosure action");
assert(!lecturesMarkup.includes('name="capacity"'), "collapsed lecture create form must not occupy the default list workspace");
for (const label of ["특강 수정", "특강 삭제"]) {
  assert(lecturesMarkup.includes(`aria-label="${label}"`), `React lectures ${label} action must be icon-only accessible`);
  assert(lecturesMarkup.includes(`title="${label}"`), `React lectures ${label} action must expose a native tooltip`);
}

const noticesMarkup = renderToStaticMarkup(
  React.createElement(renderModule.AdminApp, {
    state: {
      adminView: "notices",
      user: { role: "admin" },
      adminNoticesPage: { total: 3, collectionTotal: 4, page: 2, pageSize: 1 },
      adminNotices: [{ id: "notice-hidden", title: "비공개 공지", body: "초안", status: "draft", pinned: false }]
    },
    actions: noopActions
  })
);
assert(noticesMarkup.includes("숨김"), "notice status must derive active=false from the server draft contract");
assert(noticesMarkup.includes("필터 결과 공지 삭제"), "notice screen must expose filtered deletion separately");
assert(noticesMarkup.includes("전체 공지 삭제"), "notice screen must expose full deletion separately");
assert(noticesMarkup.includes("2"), "notice pager must use the server page metadata");
assert(noticesMarkup.includes('data-surface="workspace"'), "React notices list must use the flat workspace surface");
assert(noticesMarkup.includes("공지 등록 열기"), "notice create form must be collapsed behind an explicit disclosure action");
assert(!noticesMarkup.includes('name="linkUrl"'), "collapsed notice create form must not occupy the default list workspace");
assert(noticesMarkup.includes('aria-label="공지 삭제"'), "React notice deletion must be icon-only accessible");
assert(noticesMarkup.includes('title="공지 삭제"'), "React notice deletion must expose a native tooltip");
assert(!adminScreenSource.includes('eyebrow="React Admin"'), "Admin pages must not expose implementation labels in the product UI");
assert(
  reactAdminCssSource.includes(".gju-icon-button {\n  width: 44px;")
    && reactAdminCssSource.includes("min-height: 44px;"),
  "shared Admin icon actions must use a 44px preferred touch target"
);
assert(
  reactAdminCssSource.includes(".admin-react-check {\n  display: inline-flex;\n  align-items: center;"),
  "Admin notice checkbox labels must align checkbox and text on one row"
);

const settingsMarkup = renderToStaticMarkup(
  React.createElement(renderModule.AdminApp, {
    state: {
      adminView: "settings",
      user: { role: "admin" },
      bootstrap: {
        settings: {
          studioReportDeadlineHours: 48,
          blockedSchedules: [{ id: "block-1", type: "studio", day: "monday", from: "2026-07-01", to: "2026-07-31", start: "10:30", end: "12:00", target: "Studio A" }]
        }
      },
      nativeNotifications: { supported: true, enabled: true, effective: true, permission: "granted", pendingCount: 3, syncedAt: "2026-07-11T00:00:00.000Z" }
    },
    actions: noopActions
  })
);
assert.equal((settingsMarkup.match(/class="admin-settings-disclosure"/g) || []).length, 4, "secondary Admin settings sections must be collapsed into four disclosures");
assert(settingsMarkup.includes("운영값·출력·기자재 규칙"), "settings disclosure summaries must explain their contents");
for (const value of ["스튜디오 보고서 제출 기한", "방학 모드", "백업 JSON", "운영 알림", "동기화", "알림 끄기"]) {
  assert(settingsMarkup.includes(value), `settings parity must render ${value}`);
}
for (const label of ["이전 달", "오늘", "다음 달"]) {
  assert(settingsMarkup.includes(`aria-label="${label}"`), `settings ${label} action must be icon-only accessible`);
  assert(settingsMarkup.includes(`title="${label}"`), `settings ${label} action must expose a native tooltip`);
}
assert(settingsMarkup.includes('aria-label="차단 일정 삭제"'), "settings blocked schedule deletion must be icon-only accessible");
assert(settingsMarkup.includes('title="차단 일정 삭제"'), "settings blocked schedule deletion must expose a native tooltip");
assert(!settingsMarkup.includes(">‹</button>"), "settings calendar must not use a text symbol for previous month");
assert(!settingsMarkup.includes(">›</button>"), "settings calendar must not use a text symbol for next month");
assert(!settingsMarkup.includes("예약 안내"), "settings must not claim to save an unsupported reservationNotice field");
assert(!settingsMarkup.includes("기자재 안내"), "settings must not claim to save an unsupported equipmentNotice field");

for (const [view, requiredText] of [
  ["reservations", "예약 관리"],
  ["reports", "보고서"],
  ["lectures", "비교과 특강"],
  ["notices", "공지사항"],
  ["settings", "보안 / 데이터 관리"],
  ["account", "내 정보"]
]) {
  const routeMarkup = renderToStaticMarkup(
    React.createElement(renderModule.AdminApp, {
      state: {
        adminView: view,
        user: { role: "admin", name: "관리자", email: "admin@gju.local" },
        bootstrap: { settings: {} },
        adminReservations: [],
        adminReports: [],
        adminLectures: [],
        adminNotices: [],
        adminSessions: [],
        adminLogs: []
      },
      actions: noopActions
    })
  );
  assert(routeMarkup.includes(requiredText), `React Admin ${view} route must render native route content`);
  assert(!routeMarkup.includes("gju-legacy-admin-panel"), `React Admin ${view} route must not use LegacyAdminPanel`);
  assert(!routeMarkup.includes("legacy"), `React Admin ${view} route must not render legacy fallback content`);
}

console.log("React Admin render checks passed.");
