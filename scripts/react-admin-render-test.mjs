import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

const renderEntry = await build({
  stdin: {
    contents: `
      export { GjuButton, GjuIconButton } from "../src/react/design-system/Button.tsx";
      export { GjuCard } from "../src/react/design-system/Card.tsx";
      export { GjuDialog } from "../src/react/design-system/Dialog.tsx";
      export { GjuEmptyState } from "../src/react/design-system/EmptyState.tsx";
      export { GjuStatusBadge } from "../src/react/design-system/StatusBadge.tsx";
      export { GjuTable } from "../src/react/design-system/Table.tsx";
      export { GjuToast } from "../src/react/design-system/Toast.tsx";
      export { AdminApp } from "../src/react/admin/AdminApp.tsx";
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
assert(!iconButton.includes(">삭제<"), "icon button must not render visible label text");
assert(iconButton.includes("gju-icon-button"), "icon button must use shared class");
assert(iconButton.includes("astryx-button"), "icon button wrapper must adapt Astryx IconButton");

const card = renderToStaticMarkup(
  React.createElement(renderModule.GjuCard, { title: "테스트 카드" }, "본문")
);
assert(card.includes("테스트 카드"), "card must render title");
assert(card.includes("gju-card"), "card must use shared class");
assert(card.includes("astryx-card"), "card wrapper must adapt Astryx Card");

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

const shellMarkup = renderToStaticMarkup(
  React.createElement(renderModule.AdminApp, {
    state: { adminView: "dashboard", user: { role: "admin", name: "admin" }, summary: {} },
    actions: {
      setAdminView() {},
      refreshAdminData() {},
      logout() {},
      render() {}
    },
    legacyRenderAdminContent: () => "<section>legacy</section>"
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

const dashboardMarkup = renderToStaticMarkup(
  React.createElement(renderModule.AdminApp, {
    state: {
      adminView: "dashboard",
      user: { role: "admin" },
      summary: {
        pendingUsers: 2,
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
    actions: {
      setAdminView() {},
      refreshAdminData() {},
      logout() {},
      render() {}
    },
    legacyRenderAdminContent: () => "<section>legacy</section>"
  })
);
assert(dashboardMarkup.includes("가입 승인 대기"), "dashboard must render pending users card");
assert(dashboardMarkup.includes("대여완료"), "dashboard must render checked-out card");
assert(dashboardMarkup.includes("반납완료"), "dashboard must render returned card");
assert(dashboardMarkup.includes("대여취소"), "dashboard must render cancelled card");
assert(dashboardMarkup.includes("보고서 확인 필요"), "dashboard must render report card");
assert(!dashboardMarkup.includes("legacy"), "dashboard must be React-owned");

const refreshingShellMarkup = renderToStaticMarkup(
  React.createElement(renderModule.AdminApp, {
    state: {
      adminView: "dashboard",
      user: { role: "admin", name: "admin" },
      summary: {},
      adminRefresh: { refreshing: true }
    },
    actions: {
      setAdminView() {},
      refreshAdminData() {},
      logout() {},
      render() {}
    },
    legacyRenderAdminContent: () => "<section>legacy</section>"
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

const noopActions = {
  setAdminView() {},
  refreshAdminData() {},
  logout() {},
  render() {}
};

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
    actions: noopActions,
    legacyRenderAdminContent: () => "<section>legacy</section>"
  })
);
assert(usersMarkup.includes('data-user-delete="u1"'), "React users screen must render delete action contract");
assert(usersMarkup.includes('data-user-sort="name"'), "React users screen must render legacy user sort controls");
assert(usersMarkup.includes('data-user-sort="studentId"'), "React users screen must render student id sort control");
assert(usersMarkup.includes('data-user-sort="approvalStatus"'), "React users screen must render approval status sort control");
assert(usersMarkup.includes('data-admin-users-page="1"'), "React users screen must render previous-page contract");
assert(usersMarkup.includes('data-admin-users-page="2"'), "React users screen must render current page contract");
assert(usersMarkup.includes('data-admin-users-page="3"'), "React users screen must render next-page contract");
assert(usersMarkup.includes('aria-label="삭제"'), "React users delete must be icon-only accessible");
assert(!usersMarkup.includes(">삭제</button>"), "React users delete must not render visible delete text");

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
    actions: noopActions,
    legacyRenderAdminContent: () => "<section>legacy</section>"
  })
);
assert(usersWarningMemoMarkup.includes('data-user-warn="u2"'), "React users screen must render delegated warning memo add control");
assert(usersWarningMemoMarkup.includes('data-user-warn-reset="u2"'), "React users screen must render delegated warning memo reset control");
assert(usersWarningMemoMarkup.includes("최근 경고 메모 2건"), "React users screen must render warning memo summary");
assert(usersWarningMemoMarkup.includes("장비 연체 2회"), "React users screen must render the latest warning memo reason");
assert(!usersWarningMemoMarkup.includes("검색 결과가 없습니다."), "React users search must match warning memo text");

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
    actions: noopActions,
    legacyRenderAdminContent: () => "<section>legacy</section>"
  })
);
assert(equipmentMarkup.includes('data-equipment-remove-admin="e1"'), "React equipment screen must render remove action contract");
assert(equipmentMarkup.includes('data-equipment-bulk-status="문의"'), "React equipment screen must include inquiry status action");
assert(equipmentMarkup.includes('data-admin-equipment-panel-tab="add"'), "React equipment manage view must keep access to the add workflow tab");
assert(equipmentMarkup.includes('data-admin-equipment-panel-tab="manage"'), "React equipment manage view must keep the manage workflow tab");

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
    actions: noopActions,
    legacyRenderAdminContent: () => "<section>legacy</section>"
  })
);
assert(equipmentBrandMarkup.includes('data-equipment-row="e1"'), "React equipment search must match brand");

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
    actions: noopActions,
    legacyRenderAdminContent: () => "<section>legacy</section>"
  })
);
assert(equipmentModelMarkup.includes('data-equipment-row="e1"'), "React equipment search must match model");

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
    actions: noopActions,
    legacyRenderAdminContent: () => "<section>legacy</section>"
  })
);
assert(equipmentReservableMarkup.includes('data-equipment-row="e1"'), "React equipment search must match reservable token parity");

const equipmentAddFallbackMarkup = renderToStaticMarkup(
  React.createElement(renderModule.AdminApp, {
    state: {
      adminView: "equipment",
      adminEquipmentPanelTab: "add",
      user: { role: "admin" },
      adminEquipment: []
    },
    actions: noopActions,
    legacyRenderAdminContent: () =>
      '<main class="admin-shell"><aside class="sidebar">legacy nav</aside><section class="admin-main"><header class="admin-header">legacy header</header><section class="grid"><div class="admin-inner-tabs"><button class="tab-button active" data-admin-equipment-panel-tab="add">장비추가</button><button class="tab-button" data-admin-equipment-panel-tab="manage">장비관리</button></div><div class="card admin-equipment-add-card"><form data-form="equipment-add"><input name="name" /></form></div><div class="card admin-equipment-add-card"><form data-form="equipment-category-add"><input name="categoryName" /></form></div><div class="card admin-equipment-add-card"><form data-form="equipment-import"><textarea name="csv"></textarea></form></div></section></section></main>'
  })
);
assert(equipmentAddFallbackMarkup.includes('data-form="equipment-add"'), "React equipment add fallback must preserve the legacy add form");
assert(equipmentAddFallbackMarkup.includes('data-form="equipment-category-add"'), "React equipment add fallback must preserve the legacy category form");
assert(equipmentAddFallbackMarkup.includes('data-form="equipment-import"'), "React equipment add fallback must preserve the legacy CSV import form");
assert(!equipmentAddFallbackMarkup.includes('class="admin-shell"'), "React equipment add fallback must not duplicate the legacy admin shell");
assert(!equipmentAddFallbackMarkup.includes("legacy nav"), "React equipment add fallback must not duplicate the legacy sidebar chrome");

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
    actions: noopActions,
    legacyRenderAdminContent: () => "<section>legacy</section>"
  })
);
assert(logsMarkup.includes('data-session-revoke="s1"'), "React logs screen must render session revoke action contract");
assert(!logsMarkup.includes(">로그아웃</button>"), "React session revoke must be icon-only");
assert(logsMarkup.includes("관리자"), "React logs screen must render actor object names");
assert(logsMarkup.includes("20260001"), "React logs screen must render actor object student ids");
assert(!logsMarkup.includes("[object Object]"), "React logs screen must not stringify actor objects");

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
    actions: noopActions,
    legacyRenderAdminContent: () => "<section>legacy</section>"
  })
);
assert(logsSearchMarkup.includes("관리자"), "React logs search must match actor object fields");
assert(!logsSearchMarkup.includes("검색 결과가 없습니다."), "React logs search must not drop actor object matches");

const legacyFallbackMarkup = renderToStaticMarkup(
  React.createElement(renderModule.AdminApp, {
    state: { adminView: "reports", user: { role: "admin", name: "admin" }, summary: {} },
    actions: {
      setAdminView() {},
      refreshAdminData() {},
      logout() {},
      render() {}
    },
    legacyRenderAdminContent: () =>
      '<main class="admin-shell"><aside class="sidebar">legacy nav</aside><section class="admin-main"><header class="admin-mobile-header">mobile header</header><header class="admin-header">desktop header</header><section class="legacy-fragment"><h2>legacy report body</h2><section class="nested-legacy-section"><p>nested section body</p></section><div class="after-nested-content">after nested content</div></section><p class="tail-content">tail content</p></section><nav class="admin-mobile-nav">legacy bottom nav</nav></main>'
  })
);
assert(legacyFallbackMarkup.includes("gju-legacy-admin-panel"), "Non-dashboard admin views must render the legacy panel fallback");
assert(legacyFallbackMarkup.includes("legacy report body"), "Legacy fallback content must render inside the React Admin shell");
assert(legacyFallbackMarkup.includes("nested section body"), "Legacy fallback must preserve nested sections inside admin-main content");
assert(legacyFallbackMarkup.includes("after nested content"), "Legacy fallback must preserve content that appears after nested sections");
assert(!legacyFallbackMarkup.includes('class="admin-shell"'), "Legacy fallback must not re-render the old admin shell inside React Admin");
assert(!legacyFallbackMarkup.includes('class="admin-mobile-nav"'), "Legacy fallback must not duplicate the old mobile nav inside React Admin");
assert(!legacyFallbackMarkup.includes("legacy nav"), "Legacy fallback must not duplicate the old sidebar chrome");
assert(!legacyFallbackMarkup.includes("mobile header"), "Legacy fallback must not duplicate the old mobile header chrome");
assert(!legacyFallbackMarkup.includes("desktop header"), "Legacy fallback must not duplicate the old desktop header chrome");

const standaloneLegacyMarkup = renderToStaticMarkup(
  React.createElement(renderModule.AdminApp, {
    state: { adminView: "reports", user: { role: "admin", name: "admin" }, summary: {} },
    actions: {
      setAdminView() {},
      refreshAdminData() {},
      logout() {},
      render() {}
    },
    legacyRenderAdminContent: () => '<section class="standalone-legacy"><span>plain fallback body</span></section>'
  })
);
assert(standaloneLegacyMarkup.includes('class="standalone-legacy"'), "Legacy fallback must leave standalone markup untouched when no legacy shell is present");
assert(standaloneLegacyMarkup.includes("plain fallback body"), "Legacy fallback must preserve standalone markup content");

console.log("React Admin render checks passed.");
