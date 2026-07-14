import { captureEquipmentInteractionScroll, setupSharedEventHandlers } from "./events/shared.js?v=20260714-mobile-card-r6";
import { setupAdminRefreshHandlers } from "./events/admin-refresh.js?v=20260714-mobile-card-r6";
import { setupAdminFlowClickHandlers } from "./events/admin-flow.js?v=20260714-mobile-card-r6";
import { setupFormEventHandlers } from "./events/forms.js?v=20260714-mobile-card-r6";
import { setupReservationInputHandlers } from "./events/reservation-inputs.js?v=20260714-mobile-card-r6";
import { setupSearchEventHandlers } from "./events/search.js?v=20260714-mobile-card-r6";
import { setupStudentFlowClickHandlers } from "./events/student-flow.js?v=20260714-mobile-card-r6";

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
