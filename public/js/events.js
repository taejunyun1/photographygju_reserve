import { captureEquipmentInteractionScroll } from "./events/shared.js?v=20260627-admin-lecture-nav";
import { setupAdminRefreshHandlers } from "./events/admin-refresh.js?v=20260627-admin-lecture-nav";
import { setupAdminFlowClickHandlers } from "./events/admin-flow.js?v=20260627-admin-lecture-nav";
import { setupFormEventHandlers } from "./events/forms.js?v=20260627-admin-lecture-nav";
import { setupReservationInputHandlers } from "./events/reservation-inputs.js?v=20260627-admin-lecture-nav";
import { setupSearchEventHandlers } from "./events/search.js?v=20260627-admin-lecture-nav";
import { setupStudentFlowClickHandlers } from "./events/student-flow.js?v=20260627-admin-lecture-nav";

export function setupEventHandlers() {
  document.addEventListener("pointerdown", captureEquipmentInteractionScroll, { capture: true, passive: true });
  setupAdminRefreshHandlers();
  setupStudentFlowClickHandlers();
  setupAdminFlowClickHandlers();
  setupReservationInputHandlers();
  setupSearchEventHandlers();
  setupFormEventHandlers();
}
