import { captureEquipmentInteractionScroll } from "./events/shared.js?v=20260702-admin-scroll-fix";
import { setupAdminRefreshHandlers } from "./events/admin-refresh.js?v=20260702-admin-scroll-fix";
import { setupAdminFlowClickHandlers } from "./events/admin-flow.js?v=20260702-admin-scroll-fix";
import { setupFormEventHandlers } from "./events/forms.js?v=20260702-admin-scroll-fix";
import { setupReservationInputHandlers } from "./events/reservation-inputs.js?v=20260702-admin-scroll-fix";
import { setupSearchEventHandlers } from "./events/search.js?v=20260702-admin-scroll-fix";
import { setupStudentFlowClickHandlers } from "./events/student-flow.js?v=20260702-admin-scroll-fix";

export function setupEventHandlers() {
  document.addEventListener("pointerdown", captureEquipmentInteractionScroll, { capture: true, passive: true });
  setupAdminRefreshHandlers();
  setupStudentFlowClickHandlers();
  setupAdminFlowClickHandlers();
  setupReservationInputHandlers();
  setupSearchEventHandlers();
  setupFormEventHandlers();
}
