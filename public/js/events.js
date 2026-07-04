import { captureEquipmentInteractionScroll, setupSharedEventHandlers } from "./events/shared.js?v=20260704-student-icon-nav";
import { setupAdminRefreshHandlers } from "./events/admin-refresh.js?v=20260704-student-icon-nav";
import { setupAdminFlowClickHandlers } from "./events/admin-flow.js?v=20260704-student-icon-nav";
import { setupFormEventHandlers } from "./events/forms.js?v=20260704-student-icon-nav";
import { setupReservationInputHandlers } from "./events/reservation-inputs.js?v=20260704-student-icon-nav";
import { setupSearchEventHandlers } from "./events/search.js?v=20260704-student-icon-nav";
import { setupStudentFlowClickHandlers } from "./events/student-flow.js?v=20260704-student-icon-nav";

export function setupEventHandlers() {
  document.addEventListener("pointerdown", captureEquipmentInteractionScroll, { capture: true, passive: true });
  setupSharedEventHandlers();
  setupAdminRefreshHandlers();
  setupStudentFlowClickHandlers();
  setupAdminFlowClickHandlers();
  setupReservationInputHandlers();
  setupSearchEventHandlers();
  setupFormEventHandlers();
}
