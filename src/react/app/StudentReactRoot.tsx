import React from "react";

import { StudentApp, type StudentAppProps } from "../student/StudentApp";
import "../student/student.css";
import type { StudentActions, StudentState } from "../student/types";

export type StudentReactRootProps = {
  state: StudentState;
  actions: StudentActions;
};

export type StudentReactRootComponent = React.ComponentType<StudentReactRootProps>;

export function StudentReactRoot({ state, actions }: StudentReactRootProps) {
  return <StudentApp state={state} actions={actions} />;
}

export { StudentApp };
export type { StudentAppProps, StudentActions, StudentState };

export default StudentReactRoot;
