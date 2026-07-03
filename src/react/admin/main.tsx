import React from "react";
import { createRoot, type Root } from "react-dom/client";
import type { ReactAdminMountOptions } from "../platform/types";

let rootInstance: Root | null = null;
let mountedRoot: HTMLElement | null = null;

function PlaceholderAdmin() {
  return <main className="react-admin-root">React Admin 준비중</main>;
}

function mount(options: ReactAdminMountOptions) {
  if (!rootInstance || mountedRoot !== options.root) {
    if (rootInstance) rootInstance.unmount();
    rootInstance = createRoot(options.root);
    mountedRoot = options.root;
  }
  rootInstance.render(<PlaceholderAdmin />);
}

function unmount() {
  if (!rootInstance) return;
  rootInstance.unmount();
  rootInstance = null;
  mountedRoot = null;
}

window.GJUReactAdmin = { mount, unmount };
