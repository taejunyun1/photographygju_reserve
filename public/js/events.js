import { captureEquipmentInteractionScroll } from "./events/shared.js?v=20260702-admin-icon-header";
import { setupAdminRefreshHandlers } from "./events/admin-refresh.js?v=20260702-admin-icon-header";
import { setupAdminFlowClickHandlers } from "./events/admin-flow.js?v=20260702-admin-icon-header";
import { setupFormEventHandlers } from "./events/forms.js?v=20260702-admin-icon-header";
import { setupReservationInputHandlers } from "./events/reservation-inputs.js?v=20260702-admin-icon-header";
import { setupSearchEventHandlers } from "./events/search.js?v=20260702-admin-icon-header";
import { setupStudentFlowClickHandlers } from "./events/student-flow.js?v=20260702-admin-icon-header";

export function setupEventHandlers() {
  document.addEventListener("pointerdown", captureEquipmentInteractionScroll, { capture: true, passive: true });
  setupAdminRefreshHandlers();
  setupStudentFlowClickHandlers();
  setupAdminFlowClickHandlers();
  setupReservationInputHandlers();
  setupSearchEventHandlers();
  setupFormEventHandlers();
}
