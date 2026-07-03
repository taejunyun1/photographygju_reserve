import { captureEquipmentInteractionScroll, setupSharedEventHandlers } from "./events/shared.js?v=20260703-react-astryx-admin";
import { setupAdminRefreshHandlers } from "./events/admin-refresh.js?v=20260703-react-astryx-admin";
import { setupAdminFlowClickHandlers } from "./events/admin-flow.js?v=20260703-react-astryx-admin";
import { setupFormEventHandlers } from "./events/forms.js?v=20260703-react-astryx-admin";
import { setupReservationInputHandlers } from "./events/reservation-inputs.js?v=20260703-react-astryx-admin";
import { setupSearchEventHandlers } from "./events/search.js?v=20260703-react-astryx-admin";
import { setupStudentFlowClickHandlers } from "./events/student-flow.js?v=20260703-react-astryx-admin";

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
