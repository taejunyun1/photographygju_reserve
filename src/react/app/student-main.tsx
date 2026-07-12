import React from "react";
import { createRoot, type Root } from "react-dom/client";

import { StudentReactRoot } from "./StudentReactRoot";
import type { StudentActions, StudentState } from "../student/types";

type StudentMountOptions = {
  root: HTMLElement;
  state: StudentState;
  actions: StudentActions;
};

let mountedRoot: HTMLElement | null = null;
let rootInstance: Root | null = null;

function renderStudent(options: StudentMountOptions) {
  rootInstance?.render(React.createElement(StudentReactRoot, {
    state: options.state,
    actions: options.actions
  }));
}

function mount(options: StudentMountOptions) {
  if (rootInstance && mountedRoot !== options.root) {
    rootInstance.unmount();
    rootInstance = null;
  }
  if (mountedRoot && mountedRoot !== options.root) mountedRoot.innerHTML = "";
  mountedRoot = options.root;
  if (!rootInstance) rootInstance = createRoot(options.root);
  renderStudent(options);
}

function update(options: StudentMountOptions) {
  if (!rootInstance || mountedRoot !== options.root) {
    mount(options);
    return;
  }
  renderStudent(options);
}

function unmount() {
  rootInstance?.unmount();
  rootInstance = null;
  if (mountedRoot) mountedRoot.innerHTML = "";
  mountedRoot = null;
}

declare global {
  interface Window {
    GJU_REACT_STUDENT_ENABLED?: boolean;
    GJUReactStudent?: {
      mount(options: StudentMountOptions): void;
      update(options: StudentMountOptions): void;
      unmount(): void;
    };
  }
}

window.GJUReactStudent = { mount, update, unmount };
