import assert from "node:assert/strict";
import { analyze, csvCell, dayKey, decisionInsights, freightEstimate, tripDraft } from "./ai-analysis-data.mjs";

const now = Date.parse("2026-11-27T21:00:00Z");
assert.equal(dayKey(now), "2026-11-28");
assert.equal(dayKey(undefined), "");
const trip = (id, fields) => ({ id, vehicle: "Truck A", vendor: "Vendor A", from: "A", to: "B",
  freight: 1000, totalExpenses: 800, margin: 200, marginPercent: 20, fastag: 100, ...fields });
const peers = [10, 12, 14].map(day => trip(String(day), {
  status: "Completed", createdAt: Date.UTC(2026, 10, day), closedAt: Date.UTC(2026, 10, day + 1),
  vehicle: "Truck B"
}));
const current = trip("current", { createdAt: now - 7200000, status: "In Transit", transitHours: 1,
  currentToOriginKm: 101, marginPercent: 5, fastag: 155, advance: 0 });
const report = analyze({
  now, trips: [...peers, current, trip("cancelled", { createdAt: now, status: "Cancelled", freight: 99000 })],
  vehicles: [{ number: "Truck A" }, { number: "Truck B", mileage: 5 }, { number: "Truck C", active: false }],
  filters: { from: "2026-11-28", to: "2026-11-28", vendor: "Vendor A" }, target: 10000, minMargin: 10
});
assert.equal(report.rows.length, 2);
assert.equal(report.totals.freight, 1000);
assert.equal(report.monthFreight, 4000);
assert.equal(report.targetGap, 6000);
assert.equal(report.forecast, 4000 / 28 * 30);
assert.equal(report.emptyKm, 101);
assert.equal(report.advanceCount, 1);
assert.deepEqual(report.available.map(v => [v.number, v.location]), [["Truck B", "B"]]);
assert.deepEqual(report.delayed.map(t => t.id), ["current"]);
for (const marker of ["Empty run", "Margin", "FASTag", "planned transit", "No open trip", "below target"]) {
  assert.ok(report.alerts.some(alert => alert.reason.includes(marker)), marker);
}
const empty = analyze({ trips: [], vehicles: [{ number: "Never assigned" }], now, minMargin: 10 });
assert.equal(empty.available[0].unassignedHours, null);
assert.equal(empty.forecast, null);
assert.equal(empty.alerts.length, 0);
assert.deepEqual(decisionInsights(empty), {
  lossTrips: 0, losses: 0, emptyTripsOverTarget: 0, kmAboveTarget: 0, cost: null, costShare: null, route: null
});
const decisions = decisionInsights(analyze({ now, trips: [...peers, { ...current, margin: -125 }],
  vehicles: [], minMargin: 10 }));
assert.equal(decisions.losses, 125);
assert.equal(decisions.lossTrips, 1);
assert.equal(decisions.kmAboveTarget, 61);
assert.equal(decisions.cost.label, "FASTag");
assert.equal(decisions.route.label, "A → B");
assert.equal(decisions.route.margin, 475);
assert.deepEqual(freightEstimate({ freight: 100, cost: 90, margin: 20 }), { minimum: 112.5, profit: 10, margin: 10 });
assert.equal(freightEstimate({ freight: 100, cost: 90, margin: 100 }), null);
assert.deepEqual({ ...tripDraft("vendor: CUBE\r\nfrom=A\nfreight: 1250\ncreatedBy: user\n__proto__: attack") },
  { vendor: "CUBE", from: "A", freight: "1250" });
assert.equal(csvCell(" =SUM(A1)"), ' "'.trim() + "' =SUM(A1)\"");
assert.equal(csvCell(-25), '"-25"');
console.log("AI Analysis calculations, date boundaries, cancellation scope, alerts, drafts and CSV passed.");
