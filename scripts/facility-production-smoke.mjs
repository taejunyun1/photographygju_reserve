import assert from "node:assert/strict";

const origins = process.argv.slice(2);
if (!origins.length) throw new Error("Pass the deployed Worker and Pages origins.");
const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);

for (const raw of origins) {
  const origin = new URL(raw).origin;
  const htmlResponse = await fetch(origin, { cache: "no-store" });
  assert.equal(htmlResponse.status, 200);
  const html = await htmlResponse.text();
  assert.equal((html.match(/release=20261019-facility-r4/g) || []).length, 4, `${origin}: both entry bundles and styles must use the facility release`);

  const timeline = await fetch(`${origin}/api/facility-timeline?date=${today}&viewer=admin`, { cache: "no-store" });
  assert.equal(timeline.status, 401, `${origin}: anonymous requests must not choose admin access`);
  assert.match(timeline.headers.get("cache-control") || "", /no-store/i);
  const payload = await timeline.json();
  assert.equal(payload.ok, false);
  assert.equal(payload.data, undefined);

  console.log(`Passed: ${origin} — facility entry assets and protected timeline API.`);
}
