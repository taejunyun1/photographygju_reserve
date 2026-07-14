import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { build } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const workspace = process.cwd();
const compiledPath = path.join(workspace, "scripts", ".student-react-test.compiled.mjs");

const testBundle = await build({
  stdin: {
    contents: `
      export * from "../src/react/student/types.ts";
      export * from "../src/react/student/availability.ts";
      export * from "../src/react/student/reservationDraft.ts";
      export { StudentApp } from "../src/react/student/StudentApp.tsx";
      export { ReservationControls } from "../src/react/student/components/ReservationControls.tsx";
      export { isReportDue } from "../src/react/student/screens/ReportsScreen.tsx";
      export {
        submitProfileUpdate,
        submitPasswordChange,
        submitAccountDeletion
      } from "../src/react/student/screens/MySettingsScreen.tsx";
      export { StudentReactRoot } from "../src/react/app/StudentReactRoot.tsx";
      export { captures, resetCaptures } from "student-design-test-double";
    `,
    resolveDir: path.join(workspace, "scripts"),
    sourcefile: "scripts/student-react-test-entry.tsx",
    loader: "tsx"
  },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: compiledPath,
  write: false,
  external: ["react", "react-dom", "react-dom/server"],
  plugins: [
    {
      name: "student-design-test-double",
      setup(context) {
        context.onResolve({ filter: /^student-design-test-double$/ }, () => ({
          path: "student-design-test-double",
          namespace: "student-test"
        }));
        context.onResolve({ filter: /(^|\/)design-system$/ }, () => ({
          path: "student-design-test-double",
          namespace: "student-test"
        }));
        context.onResolve({ filter: /student\.css$/ }, () => ({
          path: "student.css",
          namespace: "student-test-css"
        }));
        context.onLoad({ filter: /.*/, namespace: "student-test-css" }, () => ({
          contents: "",
          loader: "css"
        }));
        context.onLoad({ filter: /.*/, namespace: "student-test" }, () => ({
          contents: `
            import React from "react";

            export const captures = {
              buttons: [],
              iconButtons: [],
              dialogs: []
            };

            export function resetCaptures() {
              captures.buttons.length = 0;
              captures.iconButtons.length = 0;
              captures.dialogs.length = 0;
            }

            export function GjuAppShell({ children, desktopNav, header, mobileHeader, mobileBottomNav, className = "" }) {
              return React.createElement("div", { className: \`gju-app-shell \${className}\` }, desktopNav, header, mobileHeader, children, mobileBottomNav);
            }

            export function GjuButton(props) {
              captures.buttons.push(props);
              return React.createElement("button", {
                type: props.type || "button",
                disabled: props.disabled,
                "aria-label": props["aria-label"]
              }, props.children);
            }

            export function GjuIconButton(props) {
              captures.iconButtons.push(props);
              return React.createElement("button", {
                type: props.type || "button",
                disabled: props.disabled,
                "aria-label": props.label,
                title: props.title
              });
            }

            export function GjuCard({ children, title, eyebrow, actions, className = "" }) {
              return React.createElement("section", { className: \`gju-card \${className}\` }, eyebrow, title ? React.createElement("h2", null, title) : null, actions, children);
            }

            export function GjuDialog(props) {
              captures.dialogs.push(props);
              if (!props.open) return null;
              return React.createElement("section", { role: "dialog", "aria-label": String(props.title || "") }, props.title, props.children || props.body);
            }

            export function GjuEmptyState({ title, message, action }) {
              return React.createElement("div", null, title, message, action);
            }

            export function GjuStatusBadge({ children }) {
              return React.createElement("span", null, children);
            }

            export function gjuTabId(id, key) {
              return \`\${id}-tab-\${key}\`;
            }

            export function GjuTabs({ items = [], activeKey, onChange, id = "gju-tabs", panelId, ariaLabel }) {
              return React.createElement("div", { role: "tablist", "aria-label": ariaLabel }, ...items.map((item) => React.createElement("button", {
                key: item.key,
                type: "button",
                id: gjuTabId(id, item.key),
                role: "tab",
                "aria-selected": item.key === activeKey,
                "aria-controls": panelId,
                onClick: () => onChange(item.key)
              }, item.label)));
            }

            export function GjuIcon({ name }) {
              return React.createElement("i", { "data-icon": name });
            }
          `,
          loader: "tsx"
        }));
      }
    }
  ]
});

const jsOutput = testBundle.outputFiles.find((file) => !file.path.endsWith(".css"));
assert(jsOutput, "student test bundle must emit JavaScript");
fs.writeFileSync(compiledPath, jsOutput.text);
process.on("exit", () => {
  if (fs.existsSync(compiledPath)) fs.unlinkSync(compiledPath);
});

const student = await import(`${pathToFileURL(compiledPath).href}?test=${Date.now()}`);

const settings = {
  equipmentPeriods: ["당일", "1박2일", "2박3일", "주말사용"],
  equipmentRentalTimes: ["10:15", "12:00"],
  equipmentReturnTimes: ["12:00", "17:10"],
  equipmentHighValueCategories: ["Body", "Lens"],
  equipmentBagKeywords: ["Pelican", "펠리컨"],
  equipmentCameraBagNotice: "카메라 가방을 지참하겠습니다.",
  studioSpaces: ["Studio A Front", "Studio B Front"],
  studioSlots: ["10:30-12:00", "12:00-14:00", "14:00-16:00", "16:00-18:00"],
  studioMaxSlots: 3,
  darkroomSlots: ["10:00-12:00", "12:00-14:00", "14:00-16:00"],
  darkroomProcessTypes: ["현상", "인화"],
  darkroomCapacity: 6,
  darkroomBlockedRules: [{ day: "monday", label: "월요일", start: "14:00", end: "18:00" }],
  printAvailableStart: "10:00",
  printAvailableEnd: "16:00",
  printCapacityWindowMinutes: 120,
  printCapacityPerWindow: 2,
  printTypes: ["과제", "개인 작품"],
  printPapers: ["글로시", "매트"],
  printSizes: ["소형", "대형"],
  printUploadStartDate: "2026-07-01",
  printUploadEndDate: "2026-07-31",
  printBankAccount: "000-000",
  googleDriveUrl: "https://drive.google.com/drive/folders/gju-test",
  studioReportDeadlineHours: 48,
  blockedSchedules: [
    { id: "studio-block", type: "studio", day: "monday", from: "2026-07-01", to: "2026-07-31", start: "12:00", end: "14:00", target: "Studio B" },
    { id: "print-block", type: "print", day: "monday", from: "2026-07-01", to: "2026-07-31", start: "14:00", end: "16:00" }
  ]
};

const equipment = [
  { id: "body-1", code: "CAM-01", name: "Camera", category: "Body", brand: "Canon", status: "가능", active: true, reservable: true },
  { id: "lens-1", code: "LENS-01", name: "Canon Lens", category: "Lens", brand: "Canon", status: "가능", active: true, reservable: true },
  { id: "bag-1", code: "BAG-01", name: "Pelican 1510", category: "Other", status: "가능", active: true, reservable: true },
  { id: "repair-1", code: "CAM-02", name: "Repair", category: "Body", status: "수리중", active: true, reservable: false },
  { id: "fantasy-1", code: "FANTASY-01", name: "Fantasy Camera", category: "Body", source: "fantasy_lab", status: "가능", active: true, reservable: false, inquiryOnly: true },
  { id: "inactive-1", code: "CAM-03", name: "Inactive", category: "Body", status: "가능", active: false, reservable: true }
];

const reservations = [
  { id: "equipment-conflict", type: "equipment", status: "approved", fields: { reservedDate: "2026-07-20", period: "당일", equipmentItemIds: ["body-1"] } },
  { id: "studio-conflict", type: "studio", status: "auto_confirmed", fields: { reservedDate: "2026-07-20", studioSpaces: ["Studio A Front"], timeSlots: ["10:30-12:00"] } },
  { id: "darkroom-five", type: "darkroom", status: "auto_confirmed", fields: { reservedDate: "2026-07-20", timeSlots: ["10:00-12:00"], participantCount: 5 } },
  { id: "print-one", type: "print", status: "auto_confirmed", fields: { reservedDate: "2026-07-20", startTime: "10:00", endTime: "12:00" } },
  { id: "print-two", type: "print", status: "auto_confirmed", fields: { reservedDate: "2026-07-20", startTime: "10:00", endTime: "12:00" } }
];

const chemicals = [
  { id: "chem-d76", process: "현상", name: "Kodak D-76", options: ["500ml", "1000ml"] },
  { id: "lens-schneider-50", process: "확대기 렌즈", name: "Schneider componon-s 50mm f2.8", options: ["1개"] }
];

function makeState(overrides = {}) {
  return {
    view: "home",
    today: "2026-07-11",
    user: {
      id: "user-1",
      name: "학생",
      email: "student@example.com",
      studentId: "20260001",
      grade: "2",
      phone: "010-1234-5678",
      studentStatus: "재학",
      approvalStatus: "approved"
    },
    bootstrap: { settings, notices: [{ id: "notice-1", title: "공지", body: "공지 본문" }], equipment, darkroomChemicals: chemicals, reservations: [] },
    myReservations: [],
    lectures: [],
    reservationType: undefined,
    reservationFlowStep: { equipment: "date", studio: "date", darkroom: "date", print: "date" },
    selectedDates: { equipment: "", studio: "", darkroom: "", print: "" },
    selectedEquipmentPeriod: "",
    selectedEquipmentRentalTime: "",
    selectedEquipmentReturnTime: "",
    selectedEquipmentItemIds: [],
    selectedStudioSpace: "",
    selectedStudioSlots: [],
    selectedDarkroomSlots: [],
    selectedDarkroomProcessTypes: [],
    selectedDarkroomParticipantCount: "1",
    selectedDarkroomChemicals: {},
    selectedPrintStartTime: "",
    selectedPrintEndTime: "",
    selectedPrintTypes: [],
    selectedPrintPapers: [],
    selectedPrintSizes: [],
    activeNoticeId: null,
    activeReportReservationId: null,
    nativeNotifications: { supported: true, enabled: true, permission: "granted", pendingCount: 3 },
    ...overrides
  };
}

function actionRecorder(overrides = {}) {
  const calls = [];
  const actions = new Proxy({}, {
    get(_target, key) {
      return (...args) => {
        calls.push([String(key), ...args]);
        return overrides[key]?.(...args);
      };
    }
  });
  return { actions, calls };
}

function textContent(node) {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textContent).join("");
  if (React.isValidElement(node)) return textContent(node.props.children);
  return "";
}

function button(label) {
  return student.captures.buttons.find((props) => textContent(props.children).trim() === label);
}

function iconButton(label) {
  return student.captures.iconButtons.find((props) => props.label === label);
}

let markup = "";

// Exact legacy availability behavior is derived from the bootstrap snapshot.
const availabilityBootstrap = { settings, notices: [], equipment, darkroomChemicals: chemicals, reservations };
assert.equal(student.reservationDateAvailability("equipment", "2026-07-11", settings, "2026-07-11").available, false, "equipment must reject same-day reservations");
assert.equal(student.reservationDateAvailability("darkroom", "2026-07-11", settings, "2026-07-11").available, true, "darkroom must allow same-day reservations");
assert.equal(student.reservationDateAvailability("equipment", "2026-07-19", settings, "2026-07-11").available, false, "equipment must reject weekend starts");
assert.match(student.equipmentItemAvailability(availabilityBootstrap, equipment[0], "2026-07-20", "당일").reason, /예약/, "equipment conflicts must expose a reason");
assert.equal(student.equipmentItemAvailability(availabilityBootstrap, equipment.find((item) => item.id === "repair-1"), "2026-07-21", "당일").available, false, "non-reservable equipment must be disabled");
assert.equal(student.studioSlotAvailability(availabilityBootstrap, "2026-07-20", "Studio A Front", "10:30-12:00").available, false, "studio conflicts must be unavailable");
assert.equal(student.studioSlotAvailability(availabilityBootstrap, "2026-07-20", "Studio B Front", "12:00-14:00").available, false, "studio blocked schedules must be unavailable");
assert.equal(student.studioSelectionAvailability(availabilityBootstrap, "2026-07-21", "Studio A Front", ["10:30-12:00", "14:00-16:00"]).available, false, "studio slots must be consecutive");
assert.equal(student.studioSelectionAvailability(availabilityBootstrap, "2026-07-21", "Studio A Front", settings.studioSlots).available, false, "studio selection must enforce max slots");
assert.equal(student.darkroomSlotAvailability(availabilityBootstrap, "2026-07-20", "10:00-12:00", 2).available, false, "darkroom selection must enforce participant capacity");
assert.equal(student.darkroomSlotAvailability(availabilityBootstrap, "2026-07-20", "14:00-16:00", 1).available, false, "darkroom blocked rules must be enforced");
const buckets = student.printCapacityBuckets(settings);
assert.deepEqual(buckets.map(({ startTime, endTime }) => [startTime, endTime]), [["10:00", "12:00"], ["12:00", "14:00"], ["14:00", "16:00"]], "print buckets must follow the configured two-hour windows");
assert.equal(student.printBucketAvailability(availabilityBootstrap, "2026-07-20", buckets[0]).available, false, "full print buckets must be unavailable");
assert.equal(student.printBucketAvailability(availabilityBootstrap, "2026-07-20", buckets[2]).available, false, "blocked print buckets must be unavailable");

student.resetCaptures();
markup = renderToStaticMarkup(React.createElement(student.StudentApp, {
  state: makeState({
    view: "reserve",
    reservationType: "equipment",
    bootstrap: availabilityBootstrap,
    reservationFlowStep: { equipment: "select", studio: "date", darkroom: "date", print: "date" },
    selectedDates: { equipment: "2026-07-20", studio: "", darkroom: "", print: "" },
    selectedEquipmentPeriod: "당일",
    selectedEquipmentRentalTime: "10:15",
    selectedEquipmentReturnTime: "12:00",
    selectedEquipmentItemIds: ["body-1"]
  }),
  actions: actionRecorder().actions
}));
assert(!markup.includes("Inactive"), "inactive equipment must be hidden from the rendered picker");
assert(markup.includes("Repair"), "active non-reservable equipment may remain visible with its reason");
assert(markup.includes("현재 예약할 수 없는 기자재입니다."), "non-reservable equipment must explain why it is disabled");
assert(markup.includes("disabled"), "non-reservable and conflicting equipment controls must be disabled");
for (const text of ["기자재 검색", "카테고리", "Canon 렌즈 추천", "온라인 예약불가 기자재", "Fantasy Camera"]) {
  assert(markup.includes(text), `React equipment picker must retain ${text}`);
}
for (const text of ["선택 목록", "1개 선택", "Camera", "검색 결과"]) {
  assert(markup.includes(text), `React equipment picker must expose the ${text} manifest contract`);
}

const expandedEquipment = [
  ...equipment,
  ...Array.from({ length: 25 }, (_, index) => ({
    id: `extra-${index + 1}`,
    code: `EXTRA-${String(index + 1).padStart(2, "0")}`,
    name: `Extra ${index + 1}`,
    category: "Other",
    status: "가능",
    active: true,
    reservable: true
  }))
];
markup = renderToStaticMarkup(React.createElement(student.StudentApp, {
  state: makeState({
    view: "reserve",
    reservationType: "equipment",
    bootstrap: { ...availabilityBootstrap, equipment: expandedEquipment },
    reservationFlowStep: { equipment: "select", studio: "date", darkroom: "date", print: "date" },
    selectedDates: { equipment: "2026-07-21", studio: "", darkroom: "", print: "" },
    selectedEquipmentPeriod: "당일",
    selectedEquipmentRentalTime: "10:15",
    selectedEquipmentReturnTime: "12:00"
  }),
  actions: actionRecorder().actions
}));
assert(markup.includes("더 보기"), "long equipment results must expose a progressive load-more action");
assert(!markup.includes("Extra 25"), "the initial equipment result DOM must not render the full catalog");

markup = renderToStaticMarkup(React.createElement(student.StudentApp, {
  state: makeState({
    view: "reserve",
    reservationType: "print",
    reservationFlowStep: { equipment: "date", studio: "date", darkroom: "date", print: "date" }
  }),
  actions: actionRecorder().actions
}));
assert(markup.includes("출력 파일 업로드"), "print reservation must explain the upload prerequisite");
assert(markup.includes(settings.googleDriveUrl), "print reservation must expose the configured Google Drive link");

const missingDrivePrintState = makeState({
  view: "reserve",
  reservationType: "print",
  bootstrap: { ...makeState().bootstrap, settings: { ...settings, googleDriveUrl: "" } },
  reservationFlowStep: { equipment: "date", studio: "date", darkroom: "date", print: "date" }
});
markup = renderToStaticMarkup(React.createElement(student.StudentApp, {
  state: missingDrivePrintState,
  actions: actionRecorder().actions
}));
assert(markup.includes("출력 예약을 시작할 수 없습니다."), "print reservations must expose a blocking recovery state when Drive is missing");

assert.deepEqual(student.reservationSelectionPatchForDate("studio", "2026-07-22"), {
  type: "studio",
  selectedDate: "2026-07-22",
  studioSpace: "",
  studioSlots: []
}, "date changes must reset studio-dependent selections");
assert.deepEqual(student.reservationSelectionPatchForDate("darkroom", "2026-07-22").darkroomChemicals, {}, "date changes must reset darkroom chemicals");
assert.equal(student.reservationSelectionPatchForDate("print", "2026-07-22").printStartTime, "", "date changes must reset print buckets");

const validStates = {
  equipment: makeState({
    selectedDates: { equipment: "2026-07-21", studio: "", darkroom: "", print: "" },
    selectedEquipmentPeriod: "당일",
    selectedEquipmentRentalTime: "10:15",
    selectedEquipmentReturnTime: "12:00",
    selectedEquipmentItemIds: ["body-1", "bag-1"]
  }),
  studio: makeState({
    selectedDates: { equipment: "", studio: "2026-07-21", darkroom: "", print: "" },
    selectedStudioSpace: "Studio A Front",
    selectedStudioSlots: ["10:30-12:00", "12:00-14:00"]
  }),
  darkroom: makeState({
    selectedDates: { equipment: "", studio: "", darkroom: "2026-07-21", print: "" },
    selectedDarkroomSlots: ["10:00-12:00"],
    selectedDarkroomProcessTypes: ["현상"],
    selectedDarkroomParticipantCount: "2",
    selectedDarkroomChemicals: { "chem-d76": "500ml" }
  }),
  print: makeState({
    selectedDates: { equipment: "", studio: "", darkroom: "", print: "2026-07-21" },
    selectedPrintStartTime: "12:00",
    selectedPrintEndTime: "14:00",
    selectedPrintTypes: ["과제"],
    selectedPrintPapers: ["글로시"],
    selectedPrintSizes: ["소형"]
  })
};

const validDetails = {
  equipment: { cameraBagConfirmed: true, equipmentPolicyConfirmed: true, phone: "010-1111-2222", purpose: "촬영", standRequest: "C stand" },
  studio: { participants: "학생, 팀원", requiredEquipment: "조명", purpose: "과제", phone: "010-1111-2222", studioPolicyConfirmed: true },
  darkroom: { purpose: "필름 현상", phone: "010-1111-2222", darkroomPolicyConfirmed: true },
  print: { count: 2, memo: "A 파일", phone: "010-1111-2222" }
};

assert.throws(
  () => student.buildReservationDraft("print", {
    ...validStates.print,
    bootstrap: { ...validStates.print.bootstrap, settings: { ...settings, googleDriveUrl: "" } }
  }, validDetails.print),
  /드라이브/,
  "print draft validation must reject missing Drive configuration"
);

const expectedDraftFields = {
  equipment: ["reservedDate", "period", "rentalTime", "returnTime", "equipmentItemIds", "cameraBagConfirmed", "phone", "purpose", "equipmentPolicyConfirmed"],
  studio: ["reservedDate", "studioSpace", "studioSpaces", "timeSlots", "participants", "purpose", "phone", "studioPolicyConfirmed"],
  darkroom: ["reservedDate", "timeSlots", "processTypes", "participantCount", "chemicals", "purpose", "phone", "darkroomPolicyConfirmed"],
  print: ["reservedDate", "bucket", "startTime", "endTime", "printTypes", "papers", "sizes", "count", "memo", "phone"]
};

for (const type of ["equipment", "studio", "darkroom", "print"]) {
  const draft = student.buildReservationDraft(type, validStates[type], validDetails[type]);
  assert.equal(draft.type, type, `${type} draft must retain its discriminant`);
  for (const field of expectedDraftFields[type]) {
    assert(Object.hasOwn(draft.fields, field), `${type} draft must include ${field}`);
  }

  const successful = actionRecorder({ submitReservation: async () => undefined });
  await student.submitReservationDraft(type, validStates[type], validDetails[type], successful.actions);
  assert.deepEqual(successful.calls, [["submitReservation", draft]], `${type} submit must send the complete draft`);

  const rejected = actionRecorder({ submitReservation: async () => { throw new Error(`${type}-server-rejected`); } });
  await assert.rejects(
    student.submitReservationDraft(type, validStates[type], validDetails[type], rejected.actions),
    new RegExp(`${type}-server-rejected`),
    `${type} submit must preserve bridge rejection errors`
  );
}

const midnightDarkroomState = makeState({
  bootstrap: {
    ...validStates.darkroom.bootstrap,
    settings: {
      ...settings,
      darkroomSlots: ["00:00-02:00", "22:00-24:00"]
    }
  },
  selectedDates: { equipment: "", studio: "", darkroom: "2026-07-21", print: "" },
  selectedDarkroomSlots: ["00:00-02:00", "22:00-24:00"],
  selectedDarkroomProcessTypes: ["현상"],
  selectedDarkroomParticipantCount: "1"
});
assert.throws(
  () => student.buildReservationDraft("darkroom", midnightDarkroomState, validDetails.darkroom),
  /자정|날짜별/,
  "darkroom slots on both sides of midnight must be split into separate reservation dates"
);

for (const [type, details] of Object.entries({
  equipment: { ...validDetails.equipment, equipmentPolicyConfirmed: false },
  studio: { ...validDetails.studio, participants: "" },
  darkroom: { ...validDetails.darkroom, darkroomPolicyConfirmed: false },
  print: { ...validDetails.print, count: 0 }
})) {
  const rejected = actionRecorder();
  await assert.rejects(
    student.submitReservationDraft(type, validStates[type], details, rejected.actions),
    /입력|동의|확인|선택|매수/,
    `${type} invalid draft must reject before calling the bridge`
  );
  assert.equal(rejected.calls.length, 0, `${type} invalid draft must not call submitReservation`);
}

// Report visibility is date-gated, controlled by the bridge ID, and close uses null.
const pastReport = { id: "report-past", type: "studio", status: "auto_confirmed", timing: { reportDeadlineAt: "2026-07-12T03:00:00.000Z" }, fields: { reservedDate: "2026-07-10", reportStatus: "required", timeSlots: ["10:30-12:00"], studioSpaces: ["Studio A Front"] } };
const futureReport = { id: "report-future", type: "studio", status: "auto_confirmed", fields: { reservedDate: "2026-07-12", reportStatus: "required", timeSlots: ["10:30-12:00"], studioSpaces: ["Studio A Front"] } };
assert.equal(student.isReportDue(pastReport, "2026-07-11"), true);
assert.equal(student.isReportDue(futureReport, "2026-07-11"), false);
let recorded = actionRecorder();
markup = renderToStaticMarkup(React.createElement(student.StudentApp, {
  state: makeState({ view: "reports", myReservations: [pastReport, futureReport], activeReportReservationId: "report-future" }),
  actions: recorded.actions
}));
assert(!markup.includes("실제 사용 시간"), "an ineligible active report ID must not open a form");
student.resetCaptures();
recorded = actionRecorder();
markup = renderToStaticMarkup(React.createElement(student.StudentApp, {
  state: makeState({ view: "reports", myReservations: [pastReport, futureReport], activeReportReservationId: "report-past" }),
  actions: recorded.actions
}));
assert(markup.includes("실제 사용 시간"), "an eligible active report ID must open its form");
assert(markup.includes("보고서 제출 기한"), "reports must explain the configured submission deadline");
assert(markup.includes("D-1"), "report cards must expose the server-computed deadline state");
assert(markup.includes(settings.googleDriveUrl), "reports must expose the configured Google Drive link");
button("닫기").onClick();
assert(recorded.calls.some(([name, value]) => name === "openReport" && value === null), "report close must clear the controlled ID with null");
assert(fs.readFileSync("src/react/student/screens/ReportsScreen.tsx", "utf8").includes("key={active.id}"), "report form must be keyed by reservation ID so its draft resets");

student.resetCaptures();
markup = renderToStaticMarkup(React.createElement(student.StudentApp, {
  state: makeState({
    view: "reports",
    bootstrap: { ...makeState().bootstrap, settings: { ...settings, googleDriveUrl: "" } },
    myReservations: [pastReport],
    activeReportReservationId: "report-past"
  }),
  actions: actionRecorder().actions
}));
assert(markup.includes("보고서 작성을 시작할 수 없습니다."), "reports must explain how to recover when Drive is missing");
assert(!markup.includes("실제 사용 시간"), "reports must not open the submission form without a Drive destination");
assert.equal(button("작성")?.disabled, true, "report compose actions must be disabled while Drive is missing");

// Notice detail is controlled by activeNoticeId and closes through openNotice(null).
student.resetCaptures();
recorded = actionRecorder();
markup = renderToStaticMarkup(React.createElement(student.StudentApp, {
  state: makeState({ view: "notices", activeNoticeId: "notice-1" }),
  actions: recorded.actions
}));
assert.equal(student.captures.dialogs.length, 1, "active notice must render one GjuDialog");
assert.equal(student.captures.dialogs[0].open, true);
assert.equal(student.captures.dialogs[0].showActions, false, "notice detail must expose only the dialog header close action");
assert(markup.includes("공지 본문"), "controlled notice dialog must render its body");
student.captures.dialogs[0].onClose();
assert.deepEqual(recorded.calls, [["openNotice", null]], "notice close must clear the controlled notice ID");

// Lecture applications are approval-gated and cancellation never uses reservation actions.
const lecture = { id: "lecture-1", title: "특강", status: "모집중", applied: true, canCancelApplication: true, capacity: 20, applicationCount: 1 };
student.resetCaptures();
recorded = actionRecorder();
renderToStaticMarkup(React.createElement(student.StudentApp, {
  state: makeState({ view: "lectures", lectures: [lecture] }),
  actions: recorded.actions
}));
button("신청 취소").onClick();
assert.deepEqual(recorded.calls, [["cancelLecture", "lecture-1"]], "lecture cancellation must call cancelLecture only");

student.resetCaptures();
recorded = actionRecorder({ cancelLecture: async () => { throw new Error("lecture-cancel-rejected"); } });
renderToStaticMarkup(React.createElement(student.StudentApp, {
  state: makeState({ view: "lectures", lectures: [lecture] }),
  actions: recorded.actions
}));
button("신청 취소").onClick();
await new Promise((resolve) => setImmediate(resolve));
assert.deepEqual(recorded.calls, [["cancelLecture", "lecture-1"]], "rejected lecture cancellation must still avoid cancelReservation");

student.resetCaptures();
recorded = actionRecorder();
const lectureApplication = {
  id: "lecture-application-1",
  type: "lecture",
  status: "lecture_applied",
  fields: { reservedDate: "2026-07-20", title: "특강" },
  lecture: { id: "lecture-1", title: "특강", canCancelApplication: false }
};
markup = renderToStaticMarkup(React.createElement(student.StudentApp, {
  state: makeState({ view: "mine", myReservations: [lectureApplication], lectures: [lecture] }),
  actions: recorded.actions
}));
assert(markup.includes("신청완료"), "student reservation cards must localize backend status values");
assert(!markup.includes("lecture_applied"), "student reservation cards must not expose raw backend status values");
assert(iconButton("특강 신청 취소"), "lecture pseudo-reservations must expose cancellation when the live lecture says it is eligible");
iconButton("특강 신청 취소").onClick();
assert.deepEqual(recorded.calls, [["cancelLecture", "lecture-1"]], "lecture pseudo-reservation cancellation must use the lecture ID");

student.resetCaptures();
renderToStaticMarkup(React.createElement(student.StudentApp, {
  state: makeState({ view: "lectures", user: { ...makeState().user, approvalStatus: "approval_pending" }, lectures: [{ ...lecture, applied: false }] }),
  actions: actionRecorder().actions
}));
assert.equal(button("신청"), undefined, "unapproved users must not be able to apply for a lecture");

student.resetCaptures();
renderToStaticMarkup(React.createElement(student.StudentApp, {
  state: makeState({
    view: "mine",
    myReservations: [{
      id: "returned-equipment",
      type: "equipment",
      status: "returned",
      fields: { reservedDate: "2026-07-10", period: "당일" }
    }]
  }),
  actions: actionRecorder().actions
}));
assert.equal(iconButton("예약 취소"), undefined, "returned equipment reservations must never expose cancellation");

markup = renderToStaticMarkup(React.createElement(student.StudentApp, {
  state: makeState({
    view: "mine",
    myReservations: [
      { id: "recent-reservation", type: "studio", status: "auto_confirmed", fields: { reservedDate: "2026-07-11", studioSpace: "Studio A Front", timeSlots: ["10:30-12:00"] } },
      { id: "past-reservation", type: "equipment", status: "returned", fields: { reservedDate: "2026-07-01", period: "당일", rentalTime: "10:15", returnTime: "17:10" }, equipmentItems: [{ id: "body-1", code: "CAM-01", name: "Camera" }] }
    ]
  }),
  actions: actionRecorder().actions
}));
for (const text of ["내 예약 검색", "최근 예약", "지난 예약", "펼치기"]) {
  assert(markup.includes(text), `Mine screen must retain ${text}`);
}

student.resetCaptures();
recorded = actionRecorder();
renderToStaticMarkup(React.createElement(student.StudentApp, {
  state: makeState({ view: "lectures", lectures: [{ ...lecture, applied: false }] }),
  actions: recorded.actions
}));
button("신청").onClick();
assert.deepEqual(recorded.calls, [["applyLecture", "lecture-1"]]);

// Account helpers validate local-only fields and call the typed bridge actions.
recorded = actionRecorder();
await student.submitProfileUpdate(recorded.actions, { name: "새 이름", phone: "010-9999-9999" });
await student.submitPasswordChange(recorded.actions, { currentPassword: "old-password", newPassword: "new-password", confirmPassword: "new-password" });
await student.submitAccountDeletion(recorded.actions, { currentPassword: "new-password", confirmText: "계정 삭제" });
assert.deepEqual(recorded.calls, [
  ["updateProfile", { name: "새 이름", phone: "010-9999-9999" }],
  ["changePassword", { currentPassword: "old-password", newPassword: "new-password" }],
  ["deleteAccount", { currentPassword: "new-password", confirmText: "계정 삭제" }]
]);
await assert.rejects(
  student.submitPasswordChange(actionRecorder().actions, { currentPassword: "old", newPassword: "one-password", confirmPassword: "different" }),
  /일치/
);
await assert.rejects(
  student.submitAccountDeletion(actionRecorder().actions, { currentPassword: "old", confirmText: "삭제" }),
  /계정 삭제/
);
await assert.rejects(
  student.submitProfileUpdate(actionRecorder({ updateProfile: async () => { throw new Error("profile-rejected"); } }).actions, { name: "학생", phone: "010" }),
  /profile-rejected/
);
await assert.rejects(
  student.submitPasswordChange(actionRecorder({ changePassword: async () => { throw new Error("password-rejected"); } }).actions, { currentPassword: "old-password", newPassword: "new-password", confirmPassword: "new-password" }),
  /password-rejected/
);
await assert.rejects(
  student.submitAccountDeletion(actionRecorder({ deleteAccount: async () => { throw new Error("delete-rejected"); } }).actions, { currentPassword: "old-password", confirmText: "계정 삭제" }),
  /delete-rejected/
);

student.resetCaptures();
markup = renderToStaticMarkup(React.createElement(student.StudentApp, {
  state: makeState({ view: "my" }),
  actions: actionRecorder().actions
}));
for (const text of ["개인정보 수정", "비밀번호 변경", "계정 삭제", "개인정보 처리방침", "계정 및 데이터 삭제 안내", "로그아웃", "3개", "승인 완료", "허용됨"]) {
  assert(markup.includes(text), `My screen must render ${text}`);
}
assert(markup.includes("student-react-account-properties"), "My account metadata must use an explicit label/value layout");

// Root must render StudentApp and keep the student mobile navigation icon-only.
student.resetCaptures();
markup = renderToStaticMarkup(React.createElement(student.StudentReactRoot, {
  state: makeState(),
  actions: actionRecorder().actions
}));
assert(markup.includes("안녕하세요, 학생님"), "StudentReactRoot must mount the ready StudentApp tree");
const shellSource = fs.readFileSync("src/react/student/StudentShell.tsx", "utf8");
assert(shellSource.includes("!mobile ? <span>{label}</span> : null"), "student mobile navigation must remain icon-only");
assert(shellSource.includes('className="student-react-mobile-header__title"'), "student mobile header must expose a non-shrinking title column contract");
assert(shellSource.includes('className="student-react-mobile-header__actions"'), "student mobile header must expose a fixed action column contract");
assert(
  shellSource.includes('<GjuIconButton label="마이 페이지" icon="user"'),
  "student mobile account action must use the shared icon-only button"
);
assert(!shellSource.includes('["lectures", "특강", "plus"]'), "student lecture navigation must not use the generic add icon");
const primitiveSource = fs.readFileSync("src/react/student/components/StudentPrimitives.tsx", "utf8");
assert(primitiveSource.includes("<h1>{title}</h1>"), "the screen header must provide the primary content heading on desktop");

const studentCssSource = fs.readFileSync("src/react/student/student.css", "utf8");
assert(studentCssSource.includes(".student-react-account-properties > div"), "My account metadata must keep labels separate from values");
assert(
  studentCssSource.includes("grid-template-columns: minmax(0, 1fr) auto"),
  "student mobile header must keep title and account action on one responsive row"
);
assert(
  studentCssSource.includes('.student-react-mobile-header h1[tabindex="-1"]:focus'),
  "programmatic mobile heading focus must not look like keyboard focus"
);
assert(
  studentCssSource.includes('.student-react-view h1[tabindex="-1"]:focus'),
  "programmatic content heading focus must not look like keyboard focus"
);

// Student React remains bridge-driven and must not create a second transport or DOM event system.
function readTree(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? readTree(file) : [{ file, source: fs.readFileSync(file, "utf8") }];
  });
}

for (const { file, source } of readTree("src/react/student")) {
  for (const forbidden of ["innerHTML", "document.", "fetch(", "/api/", "addEventListener(", "window."]) {
    assert(!source.includes(forbidden), `Student React source must not use ${forbidden}: ${file}`);
  }
}

console.log("Student React behavioral contract checks passed.");
