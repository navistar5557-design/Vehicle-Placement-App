const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const open = trip => trip.isOpen ?? !["Completed", "Cancelled"].includes(trip.status);
const sum = (rows, field) => rows.reduce((total, row) => total + number(row[field]), 0);
const indiaDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit"
});

export function dayKey(time) {
  return Number.isFinite(Number(time)) && Number(time) > 0 && Number(time) <= 8640000000000000
    ? indiaDate.format(Number(time)) : "";
}

function summarize(rows) {
  const freight = sum(rows, "freight");
  const margin = sum(rows, "margin");
  return { count: rows.length, freight, margin, expenses: sum(rows, "totalExpenses"),
    marginPercent: freight > 0 ? margin / freight * 100 : null };
}

function groups(rows, key) {
  const grouped = groupRows(rows, key);
  return [...grouped].filter(([label]) => label).map(([label, entries]) => ({
    label, ...summarize(entries)
  })).sort((a, b) => b.freight - a.freight || a.label.localeCompare(b.label));
}

function groupRows(rows, key) {
  const result = new Map();
  for (const row of rows) {
    const label = key(row);
    if (!result.has(label)) result.set(label, []);
    result.get(label).push(row);
  }
  return result;
}

export function analyze({ trips, vehicles, filters = {}, now, minMargin, target }) {
  const today = dayKey(now);
  const month = today.slice(0, 7);
  const matches = trip => (!filters.vehicle || trip.vehicle === filters.vehicle)
    && (!filters.vendor || trip.vendor === filters.vendor);
  const scope = trips.filter(matches);
  const rows = scope.filter(trip => {
    const date = dayKey(trip.createdAt);
    return (!filters.from || (date && date >= filters.from))
      && (!filters.to || (date && date <= filters.to));
  });
  const booked = rows.filter(trip => trip.status !== "Cancelled");
  const monthRows = scope.filter(trip => trip.status !== "Cancelled" &&
    dayKey(trip.createdAt).slice(0, 7) === month && trip.createdAt <= now);
  const monthFreight = sum(monthRows, "freight");
  const [year, monthNumber, day] = today.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const forecast = monthRows.length && day > 1 ? monthFreight / day * daysInMonth : null;
  const busy = new Set(trips.filter(open).map(trip => trip.vehicle));
  const lastCompletion = new Map();
  for (const trip of trips) {
    const at = number(trip.closedAt) || number(trip.statusUpdatedAt);
    if (trip.status === "Completed" && at > (lastCompletion.get(trip.vehicle)?.at || 0) && at <= now) {
      lastCompletion.set(trip.vehicle, { at, location: trip.to });
    }
  }
  const available = vehicles.filter(vehicle => vehicle.active !== false && !busy.has(vehicle.number)
    && (!filters.vehicle || filters.vehicle === vehicle.number)).map(vehicle => {
    const last = lastCompletion.get(vehicle.number);
    return { ...vehicle, location: last?.location, lastAt: last?.at,
      unassignedHours: last ? (now - last.at) / 3600000 : null };
  });
  const alerts = [];
  const empty = booked.filter(trip => number(trip.currentToOriginKm) > 0);
  const routeKey = trip => trip.from && trip.to ? trip.from + " → " + trip.to : "";
  const expenseKeys = { fuelExpense: "Estimated fuel", fastag: "FASTag", loadingExpense: "Loading",
    unloadingExpense: "Unloading", rtoTarpaulin: "RTO / tarpaulin", totalOtherExpense: "Other",
    fixedExpenses: "Fixed", legacyLoadingUnloadingExpense: "Legacy handling" };
  const categories = Object.entries(expenseKeys);
  const completedRoutes = groupRows(trips.filter(trip => trip.status === "Completed"), routeKey);
  for (const trip of booked) {
    const km = number(trip.currentToOriginKm);
    if (km > 40) alerts.push({ trip, level: km > 100 ? "Review" : "Watch", reason: "Empty run · " + km + " km" });
    if (number(trip.margin) < 0 || (number(trip.freight) > 0 && trip.marginPercent < minMargin)) {
      alerts.push({ trip, level: "Review", reason: number(trip.freight) > 0 && Number.isFinite(trip.marginPercent)
        ? "Margin · " + trip.marginPercent.toFixed(1) + "%" : "Negative calculated margin" });
    }
    const peers = routeKey(trip) ? (completedRoutes.get(routeKey(trip)) || []).filter(peer =>
      peer !== trip && peer.status === "Completed" && (number(peer.closedAt) || number(peer.statusUpdatedAt)) > 0 &&
      (number(peer.closedAt) || number(peer.statusUpdatedAt)) < number(trip.createdAt)) : [];
    if (peers.length < 3) continue;
    for (const [key, label] of categories) {
      const values = peers.map(peer => number(peer[key])).filter(value => value > 0).sort((a, b) => a - b);
      if (values.length < 3) continue;
      const middle = Math.floor(values.length / 2);
      const median = (values[middle] + values[Math.ceil(values.length / 2) - 1]) / 2;
      if (number(trip[key]) > median * 1.5) {
        alerts.push({ trip, level: "Watch", reason: label + " > 150% of prior route median (" + values.length + " records)" });
      }
    }
  }
  const active = scope.filter(open);
  const delayed = active.filter(trip => number(trip.createdAt) > 0 && number(trip.transitHours) > 0
    && trip.createdAt + number(trip.transitHours) * 3600000 < now);
  delayed.forEach(trip => alerts.push({ trip, level: "Review", reason: "Past placement time + planned transit hours" }));
  available.filter(vehicle => vehicle.unassignedHours >= 24).forEach(vehicle =>
    alerts.push({ vehicle: vehicle.number, level: "Watch", reason: "No open trip · " + Math.floor(vehicle.unassignedHours) + "h since last recorded completion" }));
  const targetGap = target > 0 ? Math.max(0, target - monthFreight) : null;
  if (targetGap > 0 && forecast !== null && forecast < target) {
    alerts.push({ level: "Watch", reason: "Monthly booked freight is trending below target" });
  }
  return { rows, booked, totals: summarize(booked), available, alerts, delayed, active,
    createdToday: scope.filter(trip => dayKey(trip.createdAt) === today && trip.createdAt <= now).length,
    completedToday: scope.filter(trip => trip.status === "Completed" &&
      dayKey(number(trip.closedAt) || number(trip.statusUpdatedAt)) === today &&
      (number(trip.closedAt) || number(trip.statusUpdatedAt)) <= now).length,
    emptyCount: empty.length, emptyKm: sum(empty, "currentToOriginKm"), monthFreight, forecast, targetGap,
    advance: sum(booked, "advance"), advanceCount: booked.filter(trip =>
      typeof trip.advance === "number" && Number.isFinite(trip.advance)).length,
    vendors: groups(booked, trip => trip.vendor), routes: groups(booked, routeKey),
    vehicles: groups(booked, trip => trip.vehicle), daily: groups(booked, trip => dayKey(trip.createdAt)).sort((a, b) => a.label.localeCompare(b.label)),
    expenses: categories.map(([key, label]) => ({ label, value: sum(booked, key) }))
  };
}

export function freightEstimate({ freight, cost, margin }) {
  if (![freight, cost, margin].every(Number.isFinite) || freight <= 0 || cost < 0 || margin < 0 || margin >= 100) return null;
  return { minimum: Math.ceil(cost / (1 - margin / 100) * 100) / 100, profit: freight - cost,
    margin: (freight - cost) / freight * 100 };
}

export function decisionInsights(report) {
  const losses = report.booked.filter(trip => number(trip.margin) < 0);
  const overTarget = report.booked.filter(trip => number(trip.currentToOriginKm) > 40);
  const cost = report.expenses.reduce((largest, row) =>
    row.value > (largest?.value ?? 0) ? row : largest, null);
  const route = report.routes.reduce((best, row) =>
    row.count >= 3 && row.margin > (best?.margin ?? 0) ? row : best, null);
  return {
    lossTrips: losses.length,
    losses: Math.abs(sum(losses, "margin")),
    emptyTripsOverTarget: overTarget.length,
    kmAboveTarget: sum(overTarget, "currentToOriginKm") - 40 * overTarget.length,
    cost,
    costShare: cost && report.totals.expenses > 0 && cost.value <= report.totals.expenses
      ? 100 * cost.value / report.totals.expenses : null,
    route
  };
}

export const draftFields = {
  vendor: "fVendor", vehicle: "fVehicle", currentLocation: "fCurrent", from: "fFrom", to: "fTo",
  freight: "fFreight", advance: "fAdvance", weightTon: "fWeight", totalKm: "fKm",
  transitHours: "fHours", currentToOriginKm: "fOriginKm", fastag: "fFastag",
  fixedExpenses: "fFixed", otherExpense: "fOther"
};

export function tripDraft(text) {
  const draft = Object.create(null);
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(\w+)\s*[:=]\s*(.*?)\s*$/);
    if (match && Object.hasOwn(draftFields, match[1]) && match[2]) draft[match[1]] = match[2];
  }
  return draft;
}

export function csvCell(value) {
  const raw = String(value ?? "");
  const safe = typeof value === "string" && /^(\s*[=+\-@]|[\t\r\n])/.test(raw) ? "'" + raw : raw;
  return '"' + safe.replaceAll('"', '""') + '"';
}
