import { captureEquipmentInteractionScroll, setupSharedEventHandlers } from "./events/shared.js?v=20260704-admin-mobile-overflow";
import { setupAdminRefreshHandlers } from "./events/admin-refresh.js?v=20260704-admin-mobile-overflow";
import { setupAdminFlowClickHandlers } from "./events/admin-flow.js?v=20260704-admin-mobile-overflow";
import { setupFormEventHandlers } from "./events/forms.js?v=20260704-admin-mobile-overflow";
import { setupReservationInputHandlers } from "./events/reservation-inputs.js?v=20260704-admin-mobile-overflow";
import { setupSearchEventHandlers } from "./events/search.js?v=20260704-admin-mobile-overflow";
import { setupStudentFlowClickHandlers } from "./events/student-flow.js?v=20260704-admin-mobile-overflow";

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
