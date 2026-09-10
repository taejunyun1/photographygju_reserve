import assert from "node:assert/strict";

const { createAdminRefreshLifecycle } = await import("../public/js/admin-refresh-lifecycle.js").catch(() => ({}));
assert.equal(typeof createAdminRefreshLifecycle, "function", "admin refresh lifecycle must be exported");

let now = 100_000;
let requests = 0;
let resolveRefresh;
const lifecycle = createAdminRefreshLifecycle({
  clock: () => now,
  minIntervalMs: 15_000,
  canRefresh: () => true,
  refresh: () => {
    requests += 1;
    return new Promise((resolve) => { resolveRefresh = resolve; });
  }
});

const first = lifecycle.request();
const duplicate = lifecycle.request();
assert.equal(requests, 1, "concurrent refresh triggers must share one network refresh");
resolveRefresh();
await Promise.all([first, duplicate]);
await lifecycle.request();
assert.equal(requests, 1, "recent lifecycle refreshes must be throttled");
now += 15_001;
const next = lifecycle.request();
assert.equal(requests, 2, "a refresh is allowed after the throttle window");
resolveRefresh();
await next;

const signedOut = createAdminRefreshLifecycle({ canRefresh: () => false, refresh: () => { throw new Error("must not run"); } });
assert.equal(await signedOut.request(), false, "signed-out and non-admin sessions must not refresh admin data");

console.log("Admin refresh lifecycle checks passed.");
