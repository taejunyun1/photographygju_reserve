import React from "react";
import { createRoot, type Root } from "react-dom/client";

import { AdminApp } from "./AdminApp";
import type { ReactAdminMountOptions } from "../platform/types";

let mountedRoot: HTMLElement | null = null;
let rootInstance: Root | null = null;

function mount(options: ReactAdminMountOptions) {
  const initialLegacyMarkup = options.legacyRenderAdminContent();
  if (rootInstance) rootInstance.unmount();
  if (mountedRoot && mountedRoot !== options.root) {
    mountedRoot.innerHTML = "";
  }
  mountedRoot = options.root;
  rootInstance = createRoot(options.root);
  rootInstance.render(
    React.createElement(AdminApp, {
      state: options.state,
      actions: options.actions,
      legacyRenderAdminContent: () => initialLegacyMarkup
    })
  );
}

function unmount() {
  if (rootInstance) {
    rootInstance.unmount();
    rootInstance = null;
  }
  if (!mountedRoot) return;
  mountedRoot.innerHTML = "";
  mountedRoot = null;
}

window.GJUReactAdmin = { mount, unmount };
