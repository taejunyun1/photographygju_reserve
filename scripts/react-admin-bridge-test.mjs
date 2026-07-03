import assert from "node:assert/strict";

let appWriteCount = 0;
let frameVisible = false;
const mountCalls = [];
const updateCalls = [];
const unmountCalls = [];
const listeners = new Map();
const reactAdminChrome = { innerHTML: "" };
const reactAdminRoot = { id: "react-admin-root", innerHTML: "", mountedSubtree: null };
const app = {
  _innerHTML: "",
  set innerHTML(value) {
    this._innerHTML = value;
    appWriteCount += 1;
    frameVisible = value.includes('id="react-admin-root"');
    if (!value.includes('id="react-admin-chrome"')) reactAdminChrome.innerHTML = "";
  },
  get innerHTML() {
    return this._innerHTML;
  }
};

globalThis.CustomEvent = class CustomEvent {
  constructor(type) {
    this.type = type;
  }
};
globalThis.requestAnimationFrame = (callback) => {
  callback();
  return 0;
};
globalThis.document = {
  documentElement: { scrollTop: 0 },
  body: { scrollTop: 0 },
  addEventListener(type, handler) {
    const handlers = listeners.get(type) || [];
    handlers.push(handler);
    listeners.set(type, handlers);
  },
  dispatchEvent(event) {
    for (const handler of listeners.get(event.type) || []) handler(event);
    return true;
  },
  querySelector(selector) {
    if (selector === "#app") return app;
    if (selector === "#react-admin-root") return frameVisible ? reactAdminRoot : null;
    if (selector === "#react-admin-chrome") return frameVisible ? reactAdminChrome : null;
    return null;
  },
  querySelectorAll() {
    return [];
  }
};
globalThis.window = {
  GJU_REACT_ADMIN_ENABLED: true,
  GJUReactAdmin: {
    mount(options) {
      mountCalls.push(options.root);
      options.root.innerHTML = `<section data-render="${mountCalls.length}" data-refreshing="${String(Boolean(options.state.adminRefresh?.refreshing))}">legacy admin</section>`;
      options.root.mountedSubtree = { render: mountCalls.length, refreshing: Boolean(options.state.adminRefresh?.refreshing) };
    },
    update(options) {
      updateCalls.push(options.root);
      options.root.innerHTML = `<section data-render="update:${updateCalls.length}" data-refreshing="${String(Boolean(options.state.adminRefresh?.refreshing))}">legacy admin</section>`;
      options.root.mountedSubtree = { render: mountCalls.length, update: updateCalls.length, refreshing: Boolean(options.state.adminRefresh?.refreshing) };
    },
    unmount() {
      unmountCalls.push(true);
      reactAdminRoot.innerHTML = "";
      reactAdminRoot.mountedSubtree = null;
    }
  },
  scrollX: 0,
  scrollY: 0,
  scrollTo() {}
};
globalThis.localStorage = {
  getItem() {
    return "";
  },
  setItem() {},
  removeItem() {}
};
globalThis.sessionStorage = globalThis.localStorage;

const { state } = await import("../public/js/state.js?v=20260704-admin-reservation-fit");
const { render } = await import("../public/js/renderer.js?v=20260704-admin-reservation-fit");

state.bootstrap = { settings: { blockedSchedules: [] } };
state.user = { id: "admin1", role: "admin", name: "관리자", email: "admin@gju.local" };
state.reactAdminEnabled = true;
state.loadingCount = 0;
state.toast = "";

render();

assert.equal(appWriteCount, 1, "initial React Admin render must write the shell once");
assert.equal(mountCalls.length, 1, "initial React Admin render must mount the bundle");
assert.equal(updateCalls.length, 0, "initial React Admin render must not call update before mount");
assert.equal(unmountCalls.length, 0, "initial React Admin render must not unmount");

const initialRoot = mountCalls[0];
state.toast = "브리지 확인";
render();

assert.equal(appWriteCount, 1, "toast renders inside React Admin must preserve the mounted shell");
assert.equal(mountCalls.length, 1, "toast renders inside React Admin must not remount the bundle");
assert.equal(updateCalls.length, 1, "toast renders inside React Admin must update the mounted bundle");
assert.equal(unmountCalls.length, 0, "toast renders inside React Admin must not unmount the bundle");
assert(reactAdminChrome.innerHTML.includes("toast"), "toast renders inside React Admin must update the surrounding chrome");
assert(reactAdminRoot.innerHTML.includes('data-render="update:1"'), "toast renders inside React Admin must update the existing React Admin tree");

state.loadingCount = 1;
document.dispatchEvent(new CustomEvent("gju-loading-change"));

assert.equal(appWriteCount, 1, "loading overlay renders inside React Admin must preserve the mounted shell");
assert.equal(mountCalls.length, 1, "loading overlay renders inside React Admin must not remount the bundle");
assert.equal(updateCalls.length, 2, "loading overlay renders inside React Admin must update the mounted bundle");
assert.equal(unmountCalls.length, 0, "loading overlay renders inside React Admin must not unmount the bundle");
assert(reactAdminChrome.innerHTML.includes("loading-overlay"), "loading overlay renders inside React Admin must update the surrounding chrome");
assert(reactAdminRoot.innerHTML.includes('data-render="update:2"'), "loading overlay renders inside React Admin must update the existing React Admin tree");

state.adminRefresh = { refreshing: true };
render();

assert.equal(appWriteCount, 1, "refresh busy-state renders inside React Admin must preserve the mounted shell");
assert.equal(mountCalls.length, 1, "refresh busy-state renders inside React Admin must not remount the bundle");
assert.equal(updateCalls.length, 3, "refresh busy-state renders inside React Admin must update the mounted bundle");
assert.equal(unmountCalls.length, 0, "refresh busy-state renders inside React Admin must not unmount the bundle");
assert(reactAdminRoot.innerHTML.includes('data-refreshing="true"'), "refresh busy-state renders inside React Admin must propagate the refreshing flag");

state.adminRefresh = { refreshing: false };
render();

assert.equal(appWriteCount, 1, "refresh clear renders inside React Admin must preserve the mounted shell");
assert.equal(mountCalls.length, 1, "refresh clear renders inside React Admin must not remount the bundle");
assert.equal(updateCalls.length, 4, "refresh clear renders inside React Admin must update the mounted bundle");
assert.equal(unmountCalls.length, 0, "refresh clear renders inside React Admin must not unmount the bundle");
assert(reactAdminRoot.innerHTML.includes('data-refreshing="false"'), "refresh clear renders inside React Admin must clear the refreshing flag");

state.reactAdminEnabled = false;
render();

assert.equal(unmountCalls.length, 1, "leaving the React Admin path must unmount the bundle");
assert.equal(appWriteCount, 2, "leaving the React Admin path must replace the shell with legacy admin content");
assert(!app.innerHTML.includes('id="react-admin-root"'), "legacy admin render must remove the React Admin root");
assert.equal(reactAdminRoot.mountedSubtree, null, "leaving the React Admin path must clear the mounted subtree");

console.log("React Admin bridge behavior checks passed.");
