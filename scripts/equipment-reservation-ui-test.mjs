import fs from "node:fs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const viewSource = fs.readFileSync("public/js/views-student.js", "utf8");
const eventSource = fs.readFileSync("public/js/events.js", "utf8");
const styleSource = fs.readFileSync("public/styles.css", "utf8");
const rendererSource = fs.readFileSync("public/js/renderer.js", "utf8");

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
assert(viewSource.includes("export function equipmentFloatingSelectionDock()"), "student views must export a floating equipment selection dock");
assert(viewSource.includes("${equipmentFloatingSelectionDock()}"), "student mobile navigation must mount the floating equipment selection dock");
assert(!rendererSource.includes("equipmentFloatingSelectionDock()"), "renderer must not mount the floating equipment selection dock at the app root");

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
assert(mobileDockRule.includes("bottom: calc(100% + 8px);"), "mobile selected-equipment panel must sit directly above the bottom navigation");
assert(styleSource.includes("  .mobile-nav {\n    overflow: visible;\n  }"), "mobile navigation must allow the selected-equipment panel to render above it");
assert(!styleSource.includes(".mobile-nav,\n  .admin-mobile-nav {\n    min-height: calc(64px + var(--safe-area-bottom));\n    max-height: calc(72px + var(--safe-area-bottom));\n    contain: layout paint;"), "mobile navigation must not use paint containment because it clips the selected-equipment panel");

console.log("Equipment reservation UI checks passed.");
