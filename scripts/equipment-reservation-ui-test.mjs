import fs from "node:fs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert.equal = function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
};

globalThis.document = {
  querySelector: () => null,
  querySelectorAll: () => []
};
globalThis.window = {};

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) || "",
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key)
};
globalThis.sessionStorage = globalThis.localStorage;

const { state } = await import("../public/js/state.js?v=20260627-admin-lecture-nav");
const { equipmentForm, homeView, myReservationsView } = await import("../public/js/views-student.js?v=20260627-admin-lecture-nav");

const viewSource = fs.readFileSync("public/js/views-student.js", "utf8");
const eventSource = fs.readFileSync("public/js/events.js", "utf8");
const styleSource = fs.readFileSync("public/styles.css", "utf8");
const rendererSource = fs.readFileSync("public/js/renderer.js", "utf8");

function futureDateKey(daysFromNow = 7) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + daysFromNow);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

const pickerStart = viewSource.indexOf("function equipmentPickerStep");
const pickerEnd = viewSource.indexOf("function cameraBagConsent", pickerStart);
assert(pickerStart !== -1 && pickerEnd !== -1, "equipmentPickerStep block must exist");
const pickerBlock = viewSource.slice(pickerStart, pickerEnd);

const gridIndex = pickerBlock.indexOf("choice-grid equipment-choice-grid");
const selectionIndex = pickerBlock.indexOf('equipmentSelectionDock(selectedItems, "inline")');
const ctaIndex = pickerBlock.indexOf("reserve-bottom-cta");

assert(gridIndex !== -1, "equipment picker must render the equipment choice grid");
assert(selectionIndex !== -1, "equipment picker must render the selected-equipment panel");
assert(ctaIndex !== -1, "equipment picker must render the bottom CTA");
assert(gridIndex < selectionIndex, "selected-equipment panel must render below the equipment choices");
assert(selectionIndex < ctaIndex, "selected-equipment panel must stay above the selection-complete CTA");

const changeStart = eventSource.indexOf('if (target.name === "equipmentItemIds")');
const changeEnd = eventSource.indexOf("  });", changeStart);
assert(changeStart !== -1 && changeEnd !== -1, "equipment checkbox change handler must exist");
const changeBlock = eventSource.slice(changeStart, changeEnd);

assert(eventSource.includes("function renderPreservingScroll()"), "events must provide a scroll-preserving render helper");
assert(eventSource.includes("EQUIPMENT_SCROLL_INTERACTION_SELECTOR"), "events must scope scroll capture to equipment interactions");
assert(eventSource.includes('document.addEventListener("pointerdown", captureEquipmentInteractionScroll'), "equipment interactions must capture scroll before click/change defaults run");
assert(eventSource.includes("lastEquipmentInteractionScrollState || captureScrollState()"), "scroll-preserving render must prefer pre-interaction scroll state");
assert(changeBlock.includes("renderPreservingScroll();"), "equipment checkbox changes must preserve scroll position");
assert(!changeBlock.includes("\n      render();"), "equipment checkbox changes must not use a plain render");

function handlerBlock(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  assert(start !== -1, `${startToken} handler must exist`);
  const end = source.indexOf(endToken, start);
  assert(end !== -1, `${startToken} handler must close before ${endToken}`);
  return source.slice(start, end);
}

for (const [startToken, endToken] of [
  ['if (target.dataset.studentView)', 'if (target.dataset.reserveShortcut)'],
  ['if (target.dataset.reserveShortcut)', 'if (target.dataset.reserveType)'],
  ['if (target.dataset.reserveType)', 'if (target.dataset.action === "reserve-back")'],
  ['if (target.dataset.action === "reserve-back")', 'if (target.dataset.reserveStep)'],
  ['if (target.dataset.calendarDay)', 'if (target.dataset.action === "logout")'],
  ['if (target.name === "studioSpace")', 'if (target.name === "studioSlots")'],
  ['if (target.name === "studioSlots")', 'if (target.name === "darkroomSlots")'],
  ['if (target.name === "darkroomSlots")', 'if (target.name === "processTypes")'],
  ['if (target.name === "processTypes")', 'if (target.name === "participantCount")'],
  ['if (target.name === "printTimeSlot")', 'if (target.name === "printTypes")'],
  ['if (target.name === "printTypes")', 'if (target.name === "papers")'],
  ['if (target.name === "papers")', 'if (target.name === "sizes")'],
  ['if (target.name === "sizes")', 'if (["period", "rentalTime", "returnTime"].includes(target.name)'],
  ['if (target.dataset.myReservationCategory)', 'if (target.dataset.adminView)']
]) {
  const block = handlerBlock(eventSource, startToken, endToken);
  assert(block.includes("renderPreservingScroll();"), `${startToken} must preserve scroll position`);
  assert(!block.includes("renderAtTop();"), `${startToken} must not reset to the top`);
}

assert(eventSource.includes("renderPreservingScroll();\n}"), "reservation flow step changes must preserve scroll");
assert(viewSource.includes("export function equipmentFloatingSelectionDock()"), "student views must export a floating equipment selection dock");
assert(viewSource.includes("${equipmentFloatingSelectionDock()}"), "student mobile navigation must mount the floating equipment selection dock");
assert(!rendererSource.includes("equipmentFloatingSelectionDock()"), "renderer must not mount the floating equipment selection dock at the app root");
assert(viewSource.includes("function reportDeadlineLabel("), "student reports must calculate a visible report D-day label");
assert(viewSource.includes("report-deadline-badge"), "student report cards must render a report D-day badge");
assert(styleSource.includes(".report-deadline-badge"), "report D-day badge must have a visible style");

function resetStudentState() {
  state.user = {
    id: "student1",
    role: "student",
    name: "김학생",
    phone: "01011112222",
    approvalStatus: "approved"
  };
  state.bootstrap = {
    settings: {
      equipmentPeriods: ["당일", "1박2일", "2박3일"],
      equipmentRentalTimes: ["10:15", "12:00", "17:30"],
      equipmentReturnTimes: ["10:15", "12:00", "17:10"],
      equipmentCameraBagNotice: "카메라 가방을 지참하겠습니다.",
      blockedSchedules: []
    },
    equipment: [
      {
        id: "eq1",
        active: true,
        reservable: true,
        status: "가능",
        category: "Body",
        source: "department",
        name: "캐논 750D",
        code: "CAM-750D-01"
      }
    ],
    reservations: [],
    notices: []
  };
  state.lectures = [];
  state.myReservations = [];
  state.view = "home";
  state.reservationType = "equipment";
  state.reservationFlowStep = { equipment: "schedule", studio: "date", darkroom: "date", print: "date" };
  state.selectedDates = { equipment: futureDateKey(), studio: "", darkroom: "", print: "" };
  state.selectedEquipmentPeriod = "";
  state.selectedEquipmentRentalTime = "";
  state.selectedEquipmentReturnTime = "";
  state.selectedEquipmentItemIds = [];
  state.equipmentCategoryFilter = "Body";
  state.equipmentSearch = "";
}

resetStudentState();
const defaultEquipmentForm = equipmentForm();
assert.equal(state.selectedEquipmentRentalTime, "10:15", "equipment rental time must default to the first rental slot");
assert.equal(state.selectedEquipmentReturnTime, "12:00", "equipment return time must default to the next valid return slot, not the same time");
assert(defaultEquipmentForm.includes('data-reserve-next="equipment:select"'), "equipment schedule step must render the next-step CTA");
assert(!defaultEquipmentForm.includes('data-reserve-next="equipment:select" disabled'), "equipment schedule CTA must stay enabled when return time is after rental time");

resetStudentState();
state.selectedEquipmentRentalTime = "17:30";
state.selectedEquipmentReturnTime = "10:15";
const invalidEquipmentForm = equipmentForm();
assert(invalidEquipmentForm.includes("반납 시간은 대여 시간보다 늦어야 합니다."), "equipment form must explain invalid same-day time ranges before the user advances");
assert(invalidEquipmentForm.includes('data-reserve-next="equipment:select" disabled'), "equipment schedule CTA must be disabled when return time is not after rental time");

resetStudentState();
const emptyMineHtml = myReservationsView();
assert(emptyMineHtml.includes("예약하러 가기"), "empty my-reservations state must offer a direct reservation CTA");
assert(emptyMineHtml.includes('data-reserve-shortcut="equipment"'), "empty my-reservations CTA must route directly into a reservation flow");
assert(emptyMineHtml.includes("예약이 만들어지면 이 화면에서"), "empty my-reservations state must explain what will appear there");

resetStudentState();
state.reservationFlowStep.equipment = "select";
state.selectedEquipmentItemIds = ["eq1"];
state.equipmentSelectionSheetOpen = true;
const openSelectionSheetHtml = equipmentForm();
assert(openSelectionSheetHtml.includes('class="selection-sheet-copy"'), "open equipment sheet must use the shared sheet text container");
assert(openSelectionSheetHtml.includes('class="selection-sheet-action">접기</em>'), "open equipment sheet action text must use the shared action style");
assert(openSelectionSheetHtml.includes("선택한 장비와 같은 브랜드의 추천 렌즈를 함께 확인하세요."), "open equipment sheet helper copy must use concise unified wording");
assert(openSelectionSheetHtml.includes("<dt>대여 기간</dt>"), "open equipment sheet must use a precise period label");
assert(openSelectionSheetHtml.includes("<dt>선택 장비</dt>"), "open equipment sheet must use a precise selected-equipment label");

resetStudentState();
const emptyHomeHtml = homeView();
assert(!emptyHomeHtml.includes("next-reservation-section"), "student home must not reserve first-viewport space for an empty next-reservation section");
assert(!emptyHomeHtml.includes("예정된 예약이 없습니다."), "student home empty reservation copy belongs in the my-reservations view, not the first viewport");
state.myReservations = [{
  id: "reservation1",
  type: "equipment",
  status: "checked_out",
  fields: { reservedDate: "2026-06-29", rentalTime: "10:15", returnTime: "17:10" },
  equipmentItems: [{ code: "CAM-750D-01" }]
}];
assert(homeView().includes("next-reservation-section"), "student home must show the next-reservation section when there is an upcoming reservation");

const mobileInlineRuleStart = styleSource.indexOf("  .equipment-selection-dock-inline {", styleSource.indexOf("@media"));
const mobileInlineRuleEnd = styleSource.indexOf("  }", mobileInlineRuleStart);
assert(mobileInlineRuleStart !== -1 && mobileInlineRuleEnd !== -1, "mobile inline equipment selection dock rule must exist");
const mobileInlineRule = styleSource.slice(mobileInlineRuleStart, mobileInlineRuleEnd);
assert(mobileInlineRule.includes("display: none;"), "mobile inline selected-equipment panel must be hidden so it cannot appear between equipment cards");

const mobileDockRuleStart = styleSource.indexOf("  .equipment-selection-dock-floating {", styleSource.indexOf("@media"));
const mobileDockRuleEnd = styleSource.indexOf("  }", mobileDockRuleStart);
assert(mobileDockRuleStart !== -1 && mobileDockRuleEnd !== -1, "mobile equipment selection dock rule must exist");
const mobileDockRule = styleSource.slice(mobileDockRuleStart, mobileDockRuleEnd);

assert(mobileDockRule.includes("position: absolute;"), "mobile selected-equipment panel must be positioned relative to the bottom navigation");
assert(mobileDockRule.includes("left: max(12px, var(--safe-area-left));"), "mobile selected-equipment sheet must keep a side inset instead of touching the screen edge");
assert(mobileDockRule.includes("right: max(12px, var(--safe-area-right));"), "mobile selected-equipment sheet must keep a matching side inset instead of touching the screen edge");
assert(mobileDockRule.includes("bottom: calc(100% + 12px);"), "mobile selected-equipment panel must sit directly above the bottom navigation with design-system spacing");
assert(styleSource.includes("  .mobile-nav {\n    overflow: visible;\n  }"), "mobile navigation must allow the selected-equipment panel to render above it");
assert(!styleSource.includes(".mobile-nav,\n  .admin-mobile-nav {\n    min-height: calc(64px + var(--safe-area-bottom));\n    max-height: calc(72px + var(--safe-area-bottom));\n    contain: layout paint;"), "mobile navigation must not use paint containment because it clips the selected-equipment panel");

const mobilePanelRuleStart = styleSource.indexOf("  .equipment-selection-panel {", mobileDockRuleEnd);
const mobilePanelRuleEnd = styleSource.indexOf("  }", mobilePanelRuleStart);
assert(mobilePanelRuleStart !== -1 && mobilePanelRuleEnd !== -1, "mobile equipment selection panel rule must exist");
const mobilePanelRule = styleSource.slice(mobilePanelRuleStart, mobilePanelRuleEnd);
assert(mobilePanelRule.includes("border-radius: var(--radius-lg);"), "mobile selected-equipment sheet must use the shared radius token");
assert(mobilePanelRule.includes("background: rgba(255, 255, 255, 0.96);"), "mobile selected-equipment sheet must be opaque enough to separate from text behind it");
assert(!mobilePanelRule.includes("max-height: min(58vh, 430px);"), "mobile selected-equipment sheet must no longer use the short 58vh cap");
assert(mobilePanelRule.includes("overflow: auto;"), "mobile selected-equipment sheet must scroll internally when expanded");
assert(mobilePanelRule.includes("overscroll-behavior: contain;"), "mobile selected-equipment sheet scroll must not chain to the reservation screen");
const selectionCopyRuleStart = styleSource.indexOf(".selection-sheet-copy {");
const selectionCopyRuleEnd = styleSource.indexOf("}", selectionCopyRuleStart);
assert(selectionCopyRuleStart !== -1 && selectionCopyRuleEnd !== -1, "equipment sheet title copy rule must exist");
const selectionCopyRule = styleSource.slice(selectionCopyRuleStart, selectionCopyRuleEnd);
assert(selectionCopyRule.includes("color: var(--text);"), "equipment sheet title must not inherit the dark mobile nav text color");
const mobileOpenPanelRuleStart = styleSource.indexOf("  .equipment-selection-panel.is-open {", mobilePanelRuleEnd);
const mobileOpenPanelRuleEnd = styleSource.indexOf("  }", mobileOpenPanelRuleStart);
assert(mobileOpenPanelRuleStart !== -1 && mobileOpenPanelRuleEnd !== -1, "mobile open equipment selection sheet rule must exist");
const mobileOpenPanelRule = styleSource.slice(mobileOpenPanelRuleStart, mobileOpenPanelRuleEnd);
assert(mobileOpenPanelRule.includes("height: 76dvh;"), "open equipment selection sheet must take about three quarters of the screen");
assert(mobileOpenPanelRule.includes("min-height: 70dvh;"), "open equipment selection sheet must not be shorter than 70 percent of the screen");
assert(mobileOpenPanelRule.includes("max-height: 80dvh;"), "open equipment selection sheet must not exceed 80 percent of the screen");
assert(mobileOpenPanelRule.includes("grid-template-rows: auto minmax(0, 1fr);"), "open equipment selection sheet must keep the header fixed while the body scrolls");
const mobileOpenBodyRuleStart = styleSource.indexOf("  .equipment-selection-panel.is-open .selection-sheet-body {", mobileOpenPanelRuleEnd);
const mobileOpenBodyRuleEnd = styleSource.indexOf("  }", mobileOpenBodyRuleStart);
assert(mobileOpenBodyRuleStart !== -1 && mobileOpenBodyRuleEnd !== -1, "mobile open equipment sheet body rule must exist");
const mobileOpenBodyRule = styleSource.slice(mobileOpenBodyRuleStart, mobileOpenBodyRuleEnd);
assert(mobileOpenBodyRule.includes("min-height: 0;"), "open equipment sheet body must be allowed to shrink inside the tall sheet");
assert(mobileOpenBodyRule.includes("overflow: auto;"), "open equipment sheet body must own the scrolling content");
assert(mobileOpenBodyRule.includes("align-content: start;"), "open equipment sheet body must not stretch text rows to fill the tall sheet");
const mobileOpenListRuleStart = styleSource.indexOf("  .equipment-selection-panel.is-open .selected-equipment-list {", mobileOpenBodyRuleEnd);
const mobileOpenListRuleEnd = styleSource.indexOf("  }", mobileOpenListRuleStart);
assert(mobileOpenListRuleStart !== -1 && mobileOpenListRuleEnd !== -1, "mobile open equipment sheet selected-list rule must exist");
const mobileOpenListRule = styleSource.slice(mobileOpenListRuleStart, mobileOpenListRuleEnd);
assert(mobileOpenListRule.includes("display: grid;"), "open equipment sheet selected list must render as compact rows");
assert(mobileOpenListRule.includes("max-height: none;"), "open equipment sheet selected list must not force oversized pill scrolling");
assert(mobileOpenListRule.includes("overflow: visible;"), "open equipment sheet selected list must avoid nested pill scroll chrome");
const mobileOpenPillRuleStart = styleSource.indexOf("  .equipment-selection-panel.is-open .selected-pill {", mobileOpenListRuleEnd);
const mobileOpenPillRuleEnd = styleSource.indexOf("  }", mobileOpenPillRuleStart);
assert(mobileOpenPillRuleStart !== -1 && mobileOpenPillRuleEnd !== -1, "mobile open equipment sheet selected-pill rule must exist");
const mobileOpenPillRule = styleSource.slice(mobileOpenPillRuleStart, mobileOpenPillRuleEnd);
assert(mobileOpenPillRule.includes("width: 100%;"), "open equipment sheet selected pill must use the sheet width instead of an oversized capsule");
assert(mobileOpenPillRule.includes("border-radius: 14px;"), "open equipment sheet selected pill must use the same compact radius as other rows");
assert(mobileOpenPillRule.includes("justify-content: space-between;"), "open equipment sheet selected pill must align remove control consistently");
assert(
  styleSource.includes(".app:has(.equipment-selection-dock-floating .equipment-selection-panel.is-open) .student-shell") &&
    styleSource.includes("overflow: hidden;"),
  "student reservation screen must lock background scroll while selected-equipment sheet is open"
);

console.log("Equipment reservation UI checks passed.");
