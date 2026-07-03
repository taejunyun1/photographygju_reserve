import { captureEquipmentInteractionScroll, setupSharedEventHandlers } from "./events/shared.js?v=20260704-astryx-student-guide";
import { setupAdminRefreshHandlers } from "./events/admin-refresh.js?v=20260704-astryx-student-guide";
import { setupAdminFlowClickHandlers } from "./events/admin-flow.js?v=20260704-astryx-student-guide";
import { setupFormEventHandlers } from "./events/forms.js?v=20260704-astryx-student-guide";
import { setupReservationInputHandlers } from "./events/reservation-inputs.js?v=20260704-astryx-student-guide";
import { setupSearchEventHandlers } from "./events/search.js?v=20260704-astryx-student-guide";
import { setupStudentFlowClickHandlers } from "./events/student-flow.js?v=20260704-astryx-student-guide";

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
