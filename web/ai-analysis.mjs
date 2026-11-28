import { analyze, csvCell, dayKey, decisionInsights, draftFields, freightEstimate, tripDraft } from "./ai-analysis-data.mjs?v=2";
import { extractFleetScope, localPlan, executePlan } from "./fleet-query.mjs";
import { reportSectionButtons, wireReportDirectory } from "./report-sections.mjs?v=3";

const escape = value => String(value ?? "").replace(/[&<>"']/g,
  char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const rupees = value => "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
const options = (values, empty) => '<option value="">' + empty + '</option>' +
  [...new Set(values.filter(Boolean))].sort().map(value => '<option>' + escape(value) + '</option>').join("");
const table = (headers, rows) => rows.length
  ? '<div class="table-wrap"><table><thead><tr>' + headers.map(value => '<th scope="col">' + escape(value) + '</th>').join("") +
    '</tr></thead><tbody>' + rows.map(row => '<tr>' + row.map(value => '<td>' + escape(value) + '</td>').join("") + '</tr>').join("") + '</tbody></table></div>'
  : '<p>No matching records.</p>';

function chart(rows, key, format) {
  const max = rows.reduce((largest, row) => Math.max(largest, Math.abs(row[key])), 1);
  const signed = rows.some(row => row[key] < 0);
  return rows.length ? '<ul class="analysis-bars' + (signed ? ' is-signed' : '') + '">' + rows.map(row => {
    const value = row[key];
    const width = Math.abs(value) / max * (signed ? 50 : 100);
    const start = signed ? (value < 0 ? 50 - width : 50) : 0;
    return '<li><span>' + escape(row.label) + '</span><span class="analysis-track" aria-hidden="true"><i class="' +
      (value < 0 ? 'negative' : '') + '" style="--start:' + start + '%;--width:' + width +
      '%"></i></span><strong>' + escape(format(value)) + '</strong></li>';
  }).join("") + '</ul>' : '<p class="analysis-empty">No matching records.</p>';
}

const tile = (label, value, detail, tone = "") =>
  '<article class="analysis-metric ' + tone + '"><span>' + escape(label) + '</span><strong>' +
  escape(value) + '</strong><small>' + escape(detail) + '</small></article>';

const insight = (title, metric, detail, link, action, tone = "") =>
  '<article class="analysis-insight ' + tone + '"><h4>' + escape(title) + '</h4><strong>' + escape(metric) +
  '</strong><p>' + escape(detail) + '</p><button type="button" data-analysis-open="' + link +
  '">' + escape(action) + ' <span aria-hidden="true">→</span></button></article>';

const reportGroups = [
  ["Overview", [["priorities", "Priorities"], ["visuals", "Performance charts"]]],
  ["Operations", [["alerts", "Trip alerts"], ["operations", "Dispatch advisor"]]],
  ["Finance", [["finance", "Profitability & freight planning"]]],
  ["Tools", [["assistant", "Analysis assistant"]]]
];

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function mountAnalysis(root, getData, reviewDraft, { history, favorites }) {
  let report, briefing = "", recognition, draft = {}, previousPlan, previousScope, lastAnswer = "";
  const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
  let disposed = false;
  root.innerHTML = `
    <div class="analysis-page report-directory">
      <header class="report-directory-head">
        <h2>AI Analysis</h2>
        <label for="analysisDirectorySearch"><span class="sr-only">Search analysis reports</span>
          <span class="report-search-icon" aria-hidden="true"></span>
          <input id="analysisDirectorySearch" type="search" placeholder="Search analysis reports" autocomplete="off">
        </label>
      </header>
      <div class="report-directory-body">
      <div class="report-directory-list" role="group" aria-label="Available analysis reports">
        ${reportGroups.map(([title, sections]) => `<div class="report-directory-group"><h3>${title}</h3>
          ${reportSectionButtons(sections, "analysis")}</div>`).join("")}
        <p id="analysisNoMatches" role="status" class="analysis-note" hidden>No matching reports.</p>
      </div>
      <div class="report-directory-detail">
      <details class="analysis-filter-box">
      <summary>Filters <span data-output="filter-count"></span></summary>
      <form class="analysis-controls analysis-filters" aria-label="Report filters">
        <label>From<input name="from" type="date"></label><label>Through<input name="to" type="date"></label>
        <label>Vehicle<select name="vehicle"></select></label><label>Vendor<select name="vendor"></select></label>
        <button type="reset" class="secondary">Clear filters</button>
      </form>
      <p class="analysis-note">Trip dates are placement dates in India time. Financial totals use booked freight and calculated trip expenses, excluding cancellations.</p>
      </details>
      <p class="analysis-empty" data-output="status" role="status" hidden></p>
      <p class="analysis-empty" id="analysisSelectionHint">Select an analysis report to view its details.</p>
      <section class="card" id="analysis-priorities" aria-labelledby="analysis-toggle-priorities" hidden><h3>Fleet overview</h3>
        <div class="analysis-metrics" data-output="metrics" aria-label="Key metrics"></div>
        <h4>What needs attention</h4>
        <div class="analysis-insights" data-output="insights"></div>
      </section>
      <section class="card" id="analysis-visuals" aria-labelledby="analysis-toggle-visuals" hidden><h3>Performance charts</h3>
        <div class="analysis-controls">
          <label>Chart<select id="analysisChart"><option value="daily">Daily booked freight</option><option value="vehicles">Vehicle booked freight</option><option value="margin">Vehicle margin</option><option value="expenses">Expense breakdown</option></select></label>
          <button class="secondary" id="analysisCsv">Download trip CSV</button>
          <button class="secondary" id="analysisText">Download briefing</button>
        </div>
        <div data-output="chart"></div>
      </section>
      <section class="card" id="analysis-operations" aria-labelledby="analysis-toggle-operations" hidden><h3>Operations &amp; dispatch</h3>
        <div data-output="briefing"></div>
        <div class="analysis-controls">
          <label>Load origin<select id="analysisOrigin"></select></label>
          <label>Vehicle order<select id="analysisOrder"><option value="origin">Last recorded destination matches origin</option><option value="mileage">Highest recorded mileage</option></select></label>
        </div>
        <div data-output="load"></div>
        <p class="analysis-note">Check vehicles whose last recorded destination matches the load origin first to investigate avoidable empty travel. Confirm current location, distance, capacity and readiness before assignment.</p>
      </section>
      <section class="card" id="analysis-finance" aria-labelledby="analysis-toggle-finance" hidden><h3>Profitability &amp; freight planning</h3>
        <div data-output="finance"></div>
        <div class="analysis-controls">
          <label>Monthly freight target (₹)<input id="analysisTarget" type="number" min="1" step="0.01"></label>
          <label>Proposed freight (₹)<input id="analysisFreight" type="number" min="0.01" step="0.01"></label>
          <label>Estimated total costs (₹)<input id="analysisCosts" type="number" min="0" step="0.01"></label>
          <label>Desired margin (%)<input id="analysisMargin" type="number" min="0" max="99.99" step="0.01"></label>
        </div>
        <p data-output="quote" aria-live="polite"></p>
        <details><summary>Vendor performance</summary><div data-output="vendors"></div></details>
        <details open><summary>Route profitability</summary><div data-output="routes"></div></details>
      </section>
      <section class="card" id="analysis-assistant" aria-labelledby="analysis-toggle-assistant" hidden><h3>Analysis assistant</h3>
        <p>Ask about freight, profit, expenses or trip status. Follow up with “what about yesterday?” or select a saved question. Answers use the selected report records on this device.</p>
        <form id="analysisAsk" class="analysis-controls"><label>Question<input id="analysisQuestion" required maxlength="240" placeholder="Show total freight this month"></label>
          <button class="primary">Ask</button><button type="button" class="secondary" id="analysisVoice" ${Speech ? "" : "hidden"}>Dictate</button>
          <button type="button" class="secondary" id="analysisSpeak" ${"speechSynthesis" in window ? "" : "hidden"}>Read answer</button>
          <button type="button" class="secondary" id="analysisFavorite">Favorite question</button></form>
        <p class="analysis-note">History and favorites last for this sign-in. Relative dates in questions use your browser time zone. Dictation may use the browser provider’s speech service.</p>
        <p data-output="answer" class="analysis-text" aria-live="polite"></p>
        <details><summary>History and favorites</summary><div data-output="history"></div></details>
        <details><summary>Briefing message draft</summary>
          <p>Review and edit before copying into your messaging app.</p>
          <button class="secondary" id="analysisMessage">Prepare draft</button>
          <button class="secondary" id="analysisCopy">Copy draft</button>
          <label>Message draft<textarea id="analysisMessageText" rows="4"></textarea></label>
          <p data-output="copy" aria-live="polite"></p>
        </details>
        <details id="analysisImport"><summary>Import a trip draft</summary>
          <p>Paste text or select a plain-text file (64 KB maximum). Use one field per line, such as <code>vehicle: …</code>, <code>vendor: …</code>, <code>from: …</code>, <code>to: …</code>, <code>freight: …</code>. Review values in Create Trip and select Save Trip yourself.</p>
          <label>Plain-text file<input id="analysisFile" type="file" accept=".txt,text/plain"></label>
          <label>Trip draft text<textarea id="analysisDraft" rows="5" maxlength="65536"></textarea></label>
          <button class="secondary" id="analysisParse">Extract fields</button>
          <div data-output="draft" aria-live="polite"></div>
          <button class="primary" id="analysisReview" disabled>Review in Create Trip</button>
        </details>
      </section>
      <section class="card" id="analysis-alerts" aria-labelledby="analysis-toggle-alerts" hidden><h3>Trip alerts</h3>
        <p class="analysis-note">Checked while the report is open. Empty runs above 40 km are flagged and above 100 km marked for review. Open-trip delay uses placement time plus planned hours. Expense comparisons use prior completed trips on the same route.</p>
        <div data-output="alerts"></div>
      </section>
    </div></div></div>`;
  const $ = selector => root.querySelector(selector);
  const out = name => $('[data-output="' + name + '"]');
  const controls = $(".analysis-filters");
  const showSection = wireReportDirectory(root, {
    search: $("#analysisDirectorySearch"), empty: $("#analysisNoMatches"), hint: $("#analysisSelectionHint")
  });
  const setOptions = (select, values, label) => {
    const markup = options(values, label);
    if (select.dataset.options === markup) return;
    const current = select.value;
    select.innerHTML = markup;
    select.dataset.options = markup;
    select.value = [...select.options].some(option => option.value === current) ? current : "";
  };
  const filters = () => Object.fromEntries(new FormData(controls));
  const tripId = trip => trip.tripNumber || trip.id || "";
  const review = () => {
    const data = getData();
    if (data.ready && data.canCreateTrips && Object.keys(draft).length) reviewDraft(draft);
  };

  function renderLoad() {
    const host = out("load");
    if (!report) { host.textContent = ""; return; }
    const origin = $("#analysisOrigin").value;
    const byMileage = $("#analysisOrder").value === "mileage";
    const sameOrigin = vehicle => origin && vehicle.location === origin ? 1 : 0;
    const candidates = [...report.available].sort((a, b) =>
      (byMileage ? 0 : sameOrigin(b) - sameOrigin(a)) ||
      Number(b.mileage || 0) - Number(a.mileage || 0) || a.number.localeCompare(b.number));
    host.innerHTML = '<h4>Load advisor · ' + candidates.length + ' vehicles without open trips</h4>' +
      table(["Vehicle", "Last recorded destination", "Mileage", "Since last completion"],
        candidates.map(v => [v.number, v.location || "Unknown", v.mileage > 0 ? v.mileage + " km/L" : "Unknown",
          v.unassignedHours === null ? "Unknown" : Math.floor(v.unassignedHours) + " h"]));
  }

  function renderChart() {
    const mode = $("#analysisChart").value;
    out("chart").innerHTML = report ? chart(mode === "margin" ? report.vehicles : report[mode],
      mode === "expenses" ? "value" : mode === "margin" ? "margin" : "freight", rupees) : "";
  }

  function quote() {
    const value = id => $(id).value === "" ? NaN : Number($(id).value);
    const estimate = freightEstimate({
      freight: value("#analysisFreight"), cost: value("#analysisCosts"), margin: value("#analysisMargin")
    });
    out("quote").textContent = estimate
      ? "Minimum freight " + rupees(estimate.minimum) + " · Estimated profit " + rupees(estimate.profit) + " · " + estimate.margin.toFixed(1) + "% margin."
      : "Enter proposed freight, total costs and a margin from 0% to under 100% to estimate profitability.";
  }

  function update() {
    if (disposed) return;
    const data = getData();
    $("#analysisImport").hidden = !data.canCreateTrips;
    const scope = filters();
    const filterCount = Object.values(scope).filter(Boolean).length;
    out("filter-count").textContent = filterCount ? "(" + filterCount + " active)" : "";
    if (!data.ready || (scope.from && scope.to && scope.from > scope.to)) {
      report = undefined;
      briefing = "";
      for (const name of ["load","finance","alerts","chart","vendors","routes","answer","briefing","insights","metrics"]) out(name).textContent = "";
      delete out("insights").dataset.markup;
      out("status").hidden = false;
      out("status").textContent = data.ready ? "Choose an end date on or after the start date." : "Waiting for confirmed trip and vehicle data from Firebase.";
      return;
    }
    out("status").hidden = true;
    setOptions(controls.elements.vehicle, [...data.trips.map(t => t.vehicle), ...data.vehicles.map(v => v.number)], "All vehicles");
    setOptions(controls.elements.vendor, data.trips.map(t => t.vendor), "All vendors");
    setOptions($("#analysisOrigin"), [...data.locations, ...data.trips.map(t => t.from)], "Select origin");
    const now = Date.now();
    report = analyze({ ...data, filters: filters(), now, target: Number($("#analysisTarget").value) });
    const { totals, monthFreight, forecast, targetGap } = report;
    const insights = decisionInsights(report);
    out("metrics").innerHTML = [
      tile("Booked freight", totals.count ? rupees(totals.freight) : "—", totals.count + " trips in selection"),
      tile("Calculated margin", totals.count ? rupees(totals.margin) : "—",
        totals.marginPercent === null ? "Margin rate unavailable" : totals.marginPercent.toFixed(1) + "% of booked freight",
        totals.margin < 0 ? "is-risk" : "is-positive"),
      tile("Past planned window", report.delayed.length, report.active.length + " open trips in current status", report.delayed.length ? "is-risk" : ""),
      tile("Dispatch candidates", report.available.length, "Active vehicles without open trips")
    ].join("");
    const insightCards = [
      report.delayed.length && insight("Open trips past plan", report.delayed.length + " trips",
        "Check trip status with dispatch. This flag uses placement time and planned transit hours.",
        "analysis-alerts", "Review trip alerts", "is-risk"),
      insights.lossTrips && insight("Loss-making trips", rupees(insights.losses),
        insights.lossTrips + " trips with negative calculated margins. Review costs and pricing before repeating similar loads.",
        "analysis-alerts", "Review alerts", "is-risk"),
      insights.emptyTripsOverTarget && insight("Empty travel above 40 km", insights.kmAboveTarget.toLocaleString("en-IN") + " km",
        insights.emptyTripsOverTarget + " trips above the recorded origin-distance target. Check same-origin candidates for the next load.",
        "analysis-operations", "Open load advisor", "is-watch"),
      insights.cost && insight("Largest expense category", insights.cost.label,
        rupees(insights.cost.value) + (insights.costShare === null ? "" : " · " + insights.costShare.toFixed(0) + "% of calculated expenses"),
        "analysis-visuals", "View expense breakdown"),
      insights.route && insight("Highest total route margin", insights.route.label,
        rupees(insights.route.margin) + " across " + insights.route.count + " trips. Comparison includes routes with at least 3 trips.",
        "analysis-finance", "Compare routes", "is-positive")
    ].filter(Boolean).join("") || '<p class="analysis-empty">' +
      (totals.count ? "No cost or route insights met the criteria for this selection." : "No booked trips in this selection.") + '</p>';
    if (out("insights").dataset.markup !== insightCards) {
      out("insights").innerHTML = insightCards;
      out("insights").dataset.markup = insightCards;
    }
    briefing = [
      "Operations briefing · " + dayKey(now) + " IST",
      report.createdToday + " placements today · " + report.completedToday + " completed today · " + report.active.length + " open trips · " + report.delayed.length + " past planned window",
      report.emptyKm.toLocaleString("en-IN") + " recorded origin km across " + report.emptyCount + " trips with positive origin distance",
      report.available.length + " vehicles without open trips" + (filters().vendor ? " (fleet availability has no vendor filter)" : "")
    ].join("\n");
    out("briefing").innerHTML = '<p class="analysis-text">' + escape(briefing) + '</p><p class="analysis-note">Date filters apply to historical totals. Briefing and open-trip alerts use current status.</p>';
    out("finance").innerHTML = '<p>' + totals.count + ' trips · ' + rupees(totals.freight) + ' freight · ' +
      rupees(totals.expenses) + ' expenses · ' + rupees(totals.margin) + ' margin' +
      (totals.marginPercent === null ? "" : " (" + totals.marginPercent.toFixed(1) + "%)") +
      '</p><p>Current month booked freight ' + rupees(monthFreight) + ' · Month-end run-rate ' +
      (forecast === null ? "insufficient records" : rupees(forecast)) +
      (targetGap === null ? "" : " · Remaining to target " + rupees(targetGap)) +
      '</p><p class="analysis-note">Forecast extrapolates booked freight per elapsed calendar day. Month figures use vehicle/vendor filters and the current calendar month.</p>' +
      '<p>Recorded advances ' + rupees(report.advance) + ' across ' + report.advanceCount + ' trips. A payment ledger is required to determine verified receipts, outstanding balances and overdue invoices.</p>';
    const ranking = rows => table(["Name", "Trips", "Booked freight", "Margin", "Margin %"], rows.map(row =>
      [row.label, row.count, rupees(row.freight), rupees(row.margin), row.marginPercent === null ? "—" : row.marginPercent.toFixed(1) + "%"]));
    out("vendors").innerHTML = ranking(report.vendors);
    out("routes").innerHTML = ranking(report.routes);
    const prioritized = [...report.alerts].sort((a,b) => (a.level !== "Review") - (b.level !== "Review"));
    out("alerts").innerHTML = table(["Priority", "Vehicle", "Trip", "Reason"], prioritized.map(row =>
      [row.level, row.trip?.vehicle || row.vehicle || "", row.trip ? tripId(row.trip) : "", row.reason]));
    renderLoad();
    renderChart();
  }

  function renderHistory() {
    out("history").innerHTML = [...favorites, ...history.filter(question => !favorites.has(question))].map(question =>
      '<button type="button" class="secondary" data-question="' + escape(question) + '">' +
      (favorites.has(question) ? "★ " : "") + escape(question) + '</button>').join(" ");
  }

  const input = $("#analysisQuestion");
  $("#analysisAsk").onsubmit = event => {
    event.preventDefault();
    const q = input.value.trim();
    if (!q || !report) return;
    const current = getData();
    if (!current.ready) return;
    const data = { authorized: true, canViewReports: true, tripsReady: true, vehiclesReady: true,
      minMarginPercent: current.minMargin, allTrips: report.rows, vehicles: current.vehicles };
    const followUp = /^\s*(and\b|what about\b|how about\b)/i.test(q);
    const extracted = extractFleetScope(q, data);
    const scope = followUp ? { ...extracted, vehicle: extracted.vehicle || previousScope?.vehicle,
      vendor: extracted.vendor || previousScope?.vendor } : extracted;
    let plan = localPlan(q, scope);
    if (followUp && previousPlan && !plan &&
      /^(?:and|what about|how about)\s+(?:(?:today|yesterday|this week|last week|this month|last month|this year|last year|all time)|\d{4}-\d{2}-\d{2})[?.!]?$/i.test(q)) {
      const period = localPlan("Show total trips " + q.replace(/^(?:and|what about|how about)\s+/i, ""), scope);
      if (period) plan = { ...previousPlan, period: period.period, from: period.from, to: period.to };
    }
    if (plan?.status !== "cancelled") data.allTrips = report.booked;
    const result = plan ? executePlan(plan, data, scope) : null;
    lastAnswer = result ? [result.title, result.body, ...(result.rows || []).map(row => Array.isArray(row) ? row.join(" · ") : String(row))].filter(Boolean).join("\n")
      : "Try asking about booked freight, expenses, margin or trip status.";
    out("answer").textContent = lastAnswer;
    if (plan && result) { previousPlan = plan; previousScope = scope; }
    if (!history.includes(q)) history.unshift(q);
    if (history.length > 20) history.pop();
    renderHistory();
  };
  out("history").onclick = event => {
    const button = event.target.closest("[data-question]");
    if (button) { input.value = button.dataset.question; $("#analysisAsk").requestSubmit(); }
  };
  $("#analysisFavorite").onclick = () => {
    const q = input.value.trim();
    if (!q) return;
    if (favorites.has(q)) favorites.delete(q);
    else if (favorites.size < 20) favorites.add(q);
    renderHistory();
  };
  $("#analysisVoice").onclick = () => {
    if (!Speech || recognition) return;
    recognition = new Speech();
    recognition.lang = "en-IN";
    recognition.onresult = event => { if (!disposed) input.value = event.results[0][0].transcript.slice(0, 240); };
    recognition.onerror = () => { if (!disposed) out("answer").textContent = "Voice input is unavailable. You can type your question."; };
    recognition.onend = () => { recognition = null; };
    try { recognition.start(); } catch { recognition.onerror(); recognition = null; }
  };
  $("#analysisSpeak").onclick = () => {
    if (lastAnswer && report && "speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(lastAnswer);
      utterance.lang = "en-IN";
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  };
  controls.onchange = () => { previousPlan = previousScope = null; lastAnswer = ""; out("answer").textContent = ""; update(); };
  controls.onreset = () => setTimeout(() => { if (!disposed) controls.onchange(); });
  $("#analysisOrigin").onchange = $("#analysisOrder").onchange = renderLoad;
  $("#analysisChart").onchange = renderChart;
  out("insights").addEventListener("click", event => {
    const button = event.target.closest("[data-analysis-open]");
    if (!button) return;
    const panel = button.dataset.analysisOpen;
    if (panel === "analysis-visuals") {
      $("#analysisChart").value = "expenses";
      renderChart();
    }
    showSection(panel, true);
  });
  $("#analysisTarget").oninput = update;
  for (const id of ["#analysisFreight", "#analysisCosts", "#analysisMargin"]) $(id).oninput = quote;
  $("#analysisMargin").value = getData().minMargin;
  quote();
  $("#analysisMessage").onclick = () => { $("#analysisMessageText").value = briefing; };
  $("#analysisCopy").onclick = async () => {
    const field = $("#analysisMessageText");
    if (!field.value) return;
    try {
      await navigator.clipboard.writeText(field.value);
      if (!disposed) out("copy").textContent = "Draft copied.";
    } catch {
      if (!disposed) {
        field.focus();
        field.select();
        out("copy").textContent = "Draft selected. Use your device’s Copy command.";
      }
    }
  };
  $("#analysisText").onclick = () => { if (report) download("cube-operations-briefing.txt", briefing, "text/plain"); };
  $("#analysisCsv").onclick = () => {
    if (!report) return;
    const lines = [["Trip", "Placement date (IST)", "Vehicle", "Vendor", "From", "To", "Status", "Booked freight", "Expenses", "Margin", "Origin km"],
      ...report.booked.map(trip => [tripId(trip), dayKey(trip.createdAt), trip.vehicle, trip.vendor, trip.from, trip.to, trip.status,
        trip.freight, trip.totalExpenses, trip.margin, trip.currentToOriginKm])];
    download("cube-ai-analysis.csv", "\ufeff" + lines.map(row => row.map(csvCell).join(",")).join("\r\n"), "text/csv;charset=utf-8");
  };
  $("#analysisDraft").oninput = () => {
    draft = {};
    out("draft").textContent = "";
    $("#analysisReview").disabled = true;
  };
  $("#analysisFile").onchange = async event => {
    const file = event.target.files[0];
    if (!file) return;
    $("#analysisDraft").value = "";
    $("#analysisDraft").oninput();
    if (file.size > 65536 || !/\.txt$/i.test(file.name)) {
      out("draft").textContent = "Choose a .txt file under 64 KB.";
      return;
    }
    try {
      const content = await file.text();
      if (!disposed && event.target.files[0] === file) $("#analysisDraft").value = content.slice(0, 65536);
    } catch { if (!disposed) out("draft").textContent = "The browser could not read the file."; }
  };
  $("#analysisParse").onclick = () => {
    if (!getData().canCreateTrips) return;
    draft = tripDraft($("#analysisDraft").value);
    out("draft").innerHTML = table(["Field", "Extracted value"], Object.entries(draft).filter(([key]) => Object.hasOwn(draftFields, key)));
    $("#analysisReview").disabled = !Object.keys(draft).length;
  };
  $("#analysisReview").onclick = review;
  const clock = setInterval(update, 60000);
  renderHistory();
  update();
  return { update, dispose() {
    disposed = true;
    clearInterval(clock);
    recognition?.abort();
    window.speechSynthesis?.cancel();
    root.replaceChildren();
  } };
}
