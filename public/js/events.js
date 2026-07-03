import { captureEquipmentInteractionScroll } from "./events/shared.js?v=20260703-astryx-token-bridge";
import { setupAdminRefreshHandlers } from "./events/admin-refresh.js?v=20260703-astryx-token-bridge";
import { setupAdminFlowClickHandlers } from "./events/admin-flow.js?v=20260703-astryx-token-bridge";
import { setupFormEventHandlers } from "./events/forms.js?v=20260703-astryx-token-bridge";
import { setupReservationInputHandlers } from "./events/reservation-inputs.js?v=20260703-astryx-token-bridge";
import { setupSearchEventHandlers } from "./events/search.js?v=20260703-astryx-token-bridge";
import { setupStudentFlowClickHandlers } from "./events/student-flow.js?v=20260703-astryx-token-bridge";

export function setupEventHandlers() {
  document.addEventListener("pointerdown", captureEquipmentInteractionScroll, { capture: true, passive: true });
  setupAdminRefreshHandlers();
  setupStudentFlowClickHandlers();
  setupAdminFlowClickHandlers();
  setupReservationInputHandlers();
  setupSearchEventHandlers();
  setupFormEventHandlers();
}
