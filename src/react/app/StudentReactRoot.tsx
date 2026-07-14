import React from "react";

import { StudentApp, type StudentAppProps } from "../student/StudentApp";
import "../student/student.css";
import type { StudentActions, StudentState } from "../student/types";

export type StudentReactRootProps = {
  state: StudentState;
  actions: StudentActions;
  overlayRoot?: Element | null;
};

export type StudentReactRootComponent = React.ComponentType<StudentReactRootProps>;

export function StudentReactRoot({ state, actions, overlayRoot }: StudentReactRootProps) {
  return <StudentApp state={state} actions={actions} overlayRoot={overlayRoot} />;
}

export { StudentApp };
export type { StudentAppProps, StudentActions, StudentState };

export default StudentReactRoot;
