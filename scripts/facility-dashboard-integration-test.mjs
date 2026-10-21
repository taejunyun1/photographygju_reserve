import assert from "node:assert/strict";
import { createStudentReactActions, studentReactSnapshot } from "../public/js/react-student-adapter.js";

function harness({ approved = true, confirm = true } = {}) {
  const calls = [];
  const state = {
    user: { id: "student-1", role: "student", approvalStatus: approved ? "approved" : "approval_pending" },
    bootstrap: { settings: {}, equipment: [], reservations: [] },
    view: "home", reservationType: "",
    selectedDates: { studio: "", darkroom: "", print: "", equipment: "" },
    reservationFlowStep: { studio: "date", darkroom: "date", print: "date", equipment: "date" },
    selectedStudioSpace: "", selectedStudioSlots: [], selectedEquipmentItemIds: [], selectedRequestedEquipment: [],
    selectedDarkroomSlots: [], selectedDarkroomProcessTypes: [], selectedDarkroomChemicals: {},
    selectedPrintTypes: [], selectedPrintPapers: [], selectedPrintSizes: [],
    facilityTimeline: { date: "2099-01-02", data: null, loading: false, error: "", lastSucceededAt: "" }
  };
  const actions = createStudentReactActions({
    state, render: () => calls.push(["render"]), toast: (message) => calls.push(["toast", message]),
    confirm: () => confirm,
    loadFacilityTimeline: async (...args) => { calls.push(["loadFacilityTimeline", ...args]); return "timeline"; },
    invalidateFacilityTimelineCache: () => calls.push(["invalidate"])
  });
  return { state, calls, actions };
}

const student = harness();
assert.deepEqual(studentReactSnapshot(student.state).facilityTimeline, student.state.facilityTimeline, "timeline resource must reach the React student snapshot");
assert.equal(await student.actions.loadFacilityTimeline("2099-01-03", { force: true }), "timeline");
assert.deepEqual(student.calls[0], ["loadFacilityTimeline", "2099-01-03", { force: true }]);
student.actions.startFacilityReservation({ type: "studio", selectedDate: "2099-01-03" });
assert.equal(student.state.view, "reserve");
assert.equal(student.state.selectedDates.studio, "2099-01-03");
assert.equal(student.state.selectedStudioSpace, "", "a building click must never infer Front/Back");
assert.deepEqual(student.state.selectedStudioSlots, [], "a display time bucket must never invent a reservable slot");
student.actions.startFacilityReservation({ type: "equipment", selectedDate: "2099-01-04", equipmentItemIds: ["same-name-camera-id-2"] });
assert.deepEqual(student.state.selectedEquipmentItemIds, ["same-name-camera-id-2"], "inventory IDs must survive the CTA exactly");
assert.equal(student.state.selectedDates.studio, "2099-01-03", "other facility drafts must survive");

const draft = harness({ confirm: false });
draft.state.selectedDates.studio = "2099-01-01";
draft.state.selectedStudioSlots = ["10:30-12:00"];
draft.actions.startFacilityReservation({ type: "studio", selectedDate: "2099-01-02" });
assert.equal(draft.state.view, "home");
assert.equal(draft.state.selectedDates.studio, "2099-01-01");
assert.deepEqual(draft.state.selectedStudioSlots, ["10:30-12:00"], "declining draft replacement must preserve the draft");

const unapproved = harness({ approved: false });
unapproved.actions.startFacilityReservation({ type: "equipment", selectedDate: "2099-01-02" });
assert.equal(unapproved.state.view, "home");
assert.equal(unapproved.calls[0][0], "toast");
console.log("Facility dashboard bridge: snapshot, quiet refresh, atomic booking intent, inventory identity, draft preservation and approval gate passed.");
