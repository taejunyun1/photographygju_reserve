import { captureEquipmentInteractionScroll } from "./events/shared.js?v=20260703-equipment-inquiry-status";
import { setupAdminRefreshHandlers } from "./events/admin-refresh.js?v=20260703-equipment-inquiry-status";
import { setupAdminFlowClickHandlers } from "./events/admin-flow.js?v=20260703-equipment-inquiry-status";
import { setupFormEventHandlers } from "./events/forms.js?v=20260703-equipment-inquiry-status";
import { setupReservationInputHandlers } from "./events/reservation-inputs.js?v=20260703-equipment-inquiry-status";
import { setupSearchEventHandlers } from "./events/search.js?v=20260703-equipment-inquiry-status";
import { setupStudentFlowClickHandlers } from "./events/student-flow.js?v=20260703-equipment-inquiry-status";

export function setupEventHandlers() {
  document.addEventListener("pointerdown", captureEquipmentInteractionScroll, { capture: true, passive: true });
  setupAdminRefreshHandlers();
  setupStudentFlowClickHandlers();
  setupAdminFlowClickHandlers();
  setupReservationInputHandlers();
  setupSearchEventHandlers();
  setupFormEventHandlers();
}
