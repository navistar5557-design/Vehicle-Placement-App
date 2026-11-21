import fs from "node:fs";

const app=fs.readFileSync(new URL("./app.js",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("./styles.css",import.meta.url),"utf8");

const checks=[
  ["1 Audit history","logTripAudit","openTripAudit"],
  ["2 Sync status","syncedNow","Saving..."],
  ["3 Duplicate protection","activeTripForVehicle","showDuplicateTrip"],
  ["4 Vehicle availability","vehicleAvailability","vehiclePickerOptions"],
  ["5 Trip lifecycle","TRIP_STATUSES","Unloading"],
  ["5b Close trip & vehicle release","closeTrip","tripClosed","Close Trip"],
  ["6 Profitability warning","profitabilityPreview","minMarginPercent"],
  ["7 Vendor performance","vendorPerformanceHtml","vendorPerformanceRows"],
  ["8 Vehicle performance","vehiclePerformanceHtml","vehicleUtilization30Days"],
  ["9 Advanced search","tripVehicleFilter","tripDateFrom"],
  ["10 Human trip ID","nextTripNumber","tripNumber"],
  ["11 Documents","openTripDocuments","firebase-storage.js"],
  ["12 Notification centre","notificationMeta","enablePushBtn"],
  ["13 Dashboard drill-down","data-drill","openKpi"],
  ["14 Daily summary","daily-summary-panel","copyDailySummary"],
  ["Profile settings","settingsHtml","createWebUser","createWebRole","profileMenuBtn"]
];

let failed=false;
for(const [name,...markers] of checks){
  const missing=markers.filter(x=>!app.includes(x)&&!css.includes(x));
  if(missing.length){
    failed=true;
    console.error("FAIL",name,"missing:",missing.join(", "));
  }else{
    console.log("PASS",name);
  }
}
if(failed)process.exit(1);
console.log("Phase 1 smoke checks passed:",checks.length);
