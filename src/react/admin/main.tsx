import React from "react";
import { createRoot, type Root } from "react-dom/client";

import { AdminApp } from "./AdminApp";
import type { ReactAdminMountOptions } from "../platform/types";

let mountedRoot: HTMLElement | null = null;
let rootInstance: Root | null = null;

function renderAdmin(options: ReactAdminMountOptions) {
  const legacyMarkup = options.legacyRenderAdminContent();
  if (!rootInstance) return;
  rootInstance.render(
    React.createElement(AdminApp, {
      state: options.state,
      actions: options.actions,
      legacyRenderAdminContent: () => legacyMarkup
    })
  );
}

function mount(options: ReactAdminMountOptions) {
  if (rootInstance && mountedRoot !== options.root) {
    rootInstance.unmount();
    rootInstance = null;
  }
  if (mountedRoot && mountedRoot !== options.root) {
    mountedRoot.innerHTML = "";
  }
  mountedRoot = options.root;
  if (!rootInstance) {
    rootInstance = createRoot(options.root);
  }
  renderAdmin(options);
}

function update(options: ReactAdminMountOptions) {
  if (!rootInstance || mountedRoot !== options.root) {
    mount(options);
    return;
  }
  renderAdmin(options);
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
window.GJUReactAdmin.update = update;
