import assert from "node:assert/strict";
import {
  analyze, csvCell, dayKey, decisionInsights, freightEstimate, routeQuoteBenchmark, tripDataQuality, tripDraft, weeklyReview
} from "./ai-analysis-data.mjs";

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
const dated = [
  trip("start", { createdAt: Date.parse("2026-11-20T18:30:00Z"), margin: 250, currentToOriginKm: 15 }),
  trip("prior-end", { createdAt: Date.parse("2026-11-20T18:29:59Z"), margin: -100 }),
  trip("today", { createdAt: Date.parse("2026-11-27T18:30:00Z"), freight: 5000 }),
  trip("cancelled-current", { status: "Cancelled", createdAt: Date.parse("2026-11-24T18:30:00Z") }),
  trip("no-date", { margin: 10000 })
];
const weekly = weeklyReview(dated, now);
assert.deepEqual([weekly.current.from, weekly.current.to, weekly.previous.from, weekly.previous.to],
  ["2026-11-21", "2026-11-27", "2026-11-14", "2026-11-20"]);
assert.equal(weekly.current.count, 1);
assert.equal(weekly.previous.count, 1);
assert.equal(weekly.current.freight, 1000);
assert.equal(weekly.current.emptyKm, 15);
assert.equal(weekly.previous.emptyKm, null);
assert.equal(weekly.route.change, 350);
assert.equal(weekly.vendor.label, "Vendor A");
assert.equal(weeklyReview(dated, Date.parse("2027-01-01T00:30:00+05:30")).current.from, "2026-12-25");

const complete = { status: "Completed", createdAt: now - 3600000, totalKm: 250, mileage: 5, fuelRate: 95, fastag: 0 };
const benchmarkTrips = [
  trip("first", { ...complete, freight: 900, marginPercent: 10, totalExpenses: 810 }),
  trip("second", { ...complete, freight: "1,100", marginPercent: 20, totalExpenses: 880 }),
  trip("third", { ...complete, freight: 5000, marginPercent: 30, totalExpenses: 3500 }),
  trip("bad", { ...complete, totalKm: 0, mileage: "invalid", fuelRate: null }),
  trip("reverse", { ...complete, from: "B", to: "A" }),
  trip("open", { ...complete, status: "In Transit", freight: 50000 }),
  trip("future", { ...complete, createdAt: now + 3600000, freight: 50000 }),
  trip("bad-date", { ...complete, createdAt: 0, from: "B", to: "A" })
];
const quality = tripDataQuality(benchmarkTrips);
assert.deepEqual(quality.flagged.map(row => row.trip.id), ["bad", "bad-date"]);
assert.deepEqual(quality.flagged[0].fields, ["Trip distance", "Vehicle mileage", "Fuel rate"]);
assert.deepEqual(quality.flagged[1].fields, ["Placement date"]);
const [forward, reverse] = routeQuoteBenchmark(benchmarkTrips, quality, now);
assert.deepEqual([forward.label, forward.count, forward.excluded, forward.freight, forward.expenses, forward.margin],
  ["A → B", 3, 1, 1100, 880, 20]);
assert.deepEqual([reverse.label, reverse.count, reverse.excluded, reverse.freight], ["B → A", 1, 1, null]);
console.log("AI Analysis calculations, date boundaries, cancellation scope, alerts, drafts and CSV passed.");
