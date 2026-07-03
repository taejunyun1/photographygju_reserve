import type { ReactAdminMountOptions } from "../platform/types";

let mountedRoot: HTMLElement | null = null;

function mount(options: ReactAdminMountOptions) {
  if (mountedRoot && mountedRoot !== options.root) {
    mountedRoot.innerHTML = "";
  }
  mountedRoot = options.root;
  mountedRoot.innerHTML = options.legacyRenderAdminContent();
}

function unmount() {
  if (!mountedRoot) return;
  mountedRoot.innerHTML = "";
  mountedRoot = null;
}

window.GJUReactAdmin = { mount, unmount };
