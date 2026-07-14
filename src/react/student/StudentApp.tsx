import React from "react";

import { StudentShell } from "./StudentShell";
import { HomeScreen } from "./screens/HomeScreen";
import { ReservationScreen } from "./screens/ReservationScreen";
import { MineScreen } from "./screens/MineScreen";
import { ReportsScreen } from "./screens/ReportsScreen";
import { LecturesScreen } from "./screens/LecturesScreen";
import { NoticesScreen } from "./screens/NoticesScreen";
import { MySettingsScreen } from "./screens/MySettingsScreen";
import type { StudentActions, StudentState } from "./types";

export type StudentAppProps = {
  state: StudentState;
  actions: StudentActions;
  overlayRoot?: Element | null;
};

export function StudentApp({ state, actions, overlayRoot }: StudentAppProps) {
  let content: React.ReactNode;

  switch (state.view) {
    case "reserve":
      content = <ReservationScreen state={state} actions={actions} overlayRoot={overlayRoot} />;
      break;
    case "mine":
      content = <MineScreen state={state} actions={actions} />;
      break;
    case "reports":
      content = <ReportsScreen state={state} actions={actions} />;
      break;
    case "lectures":
      content = <LecturesScreen state={state} actions={actions} />;
      break;
    case "notices":
      content = <NoticesScreen state={state} actions={actions} />;
      break;
    case "my":
      content = <MySettingsScreen state={state} actions={actions} />;
      break;
    default:
      content = <HomeScreen state={state} actions={actions} />;
  }

  return (
    <StudentShell state={state} actions={actions}>
      {content}
    </StudentShell>
  );
}
