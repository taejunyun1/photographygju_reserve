import { captureEquipmentInteractionScroll } from "./events/shared.js?v=20260703-ui-consistency";
import { setupAdminRefreshHandlers } from "./events/admin-refresh.js?v=20260703-ui-consistency";
import { setupAdminFlowClickHandlers } from "./events/admin-flow.js?v=20260703-ui-consistency";
import { setupFormEventHandlers } from "./events/forms.js?v=20260703-ui-consistency";
import { setupReservationInputHandlers } from "./events/reservation-inputs.js?v=20260703-ui-consistency";
import { setupSearchEventHandlers } from "./events/search.js?v=20260703-ui-consistency";
import { setupStudentFlowClickHandlers } from "./events/student-flow.js?v=20260703-ui-consistency";

export function setupEventHandlers() {
  document.addEventListener("pointerdown", captureEquipmentInteractionScroll, { capture: true, passive: true });
  setupAdminRefreshHandlers();
  setupStudentFlowClickHandlers();
  setupAdminFlowClickHandlers();
  setupReservationInputHandlers();
  setupSearchEventHandlers();
  setupFormEventHandlers();
}
