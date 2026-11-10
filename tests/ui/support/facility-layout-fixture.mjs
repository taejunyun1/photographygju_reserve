export const facilityLayoutNow = new Date("2026-11-06T01:46:00Z");

export function facilityLayoutFixture() {
  const interval = {
    startAt: "2026-11-06T01:00:00Z", endAt: "2026-11-06T05:00:00Z",
    status: "auto_confirmed", label: "예약 있음", isMine: false
  };
  return {
    schemaVersion: 1, layoutVersion: "corridor-v1", viewer: "student",
    date: "2026-11-06", today: "2026-11-06", maxDate: "2026-12-06", timeZone: "Asia/Seoul",
    generatedAt: facilityLayoutNow.toISOString(), validUntil: "2026-11-06T02:46:00Z",
    spaces: [
      { key: "a", name: "스튜디오 A", type: "studio", subspaces: [{ key: "a-back", label: "Studio A Back" }],
        intervals: [{ ...interval, entryKey: "layout-a", subspaceKeys: ["a-back"], contactName: "긴이름예약자테스트ABCDEFGHIJKLMNOPQRSTUVWXYZ012345", phone: "010-0000-0000" }], blockedIntervals: [] },
      ...[["b", "스튜디오 B", "studio"], ["dark", "암실", "darkroom"], ["print", "출력실", "print"]].map(([key, name, type]) => ({ key, name, type, subspaces: [], intervals: [], blockedIntervals: [] }))
    ],
    equipment: ["소니 A7M3", "소니 24-70GM", "LongEquipmentNameWithoutSpacesForLayoutVerification"].map((name, index) => ({
      equipmentId: `layout-equipment-${index}`, name, category: "Camera", facility: "기자재실", source: "inventory",
      custody: null, reservations: [{ ...interval, entryKey: `layout-gear-${index}`, endAt: "2026-11-07T08:10:00Z", handoffNeedsReview: index === 2 }], history: []
    }))
  };
}

export async function seedFacilityLayout(page) {
  const data = facilityLayoutFixture();
  await page.route("**/api/facility-timeline?**", (route) => route.fulfill({ json: { ok: true, data } }));
  await page.evaluate(async (data) => {
    const { state } = await import("/js/state.js?v=20261110-digital-lab-r1");
    const { render } = await import("/js/renderer.js?v=20261110-digital-lab-r1");
    state.view = "main";
    state.facilityTimeline = { date: data.date, data, loading: false, error: "", lastSucceededAt: data.generatedAt, invalidated: false };
    render();
  }, data);
}
