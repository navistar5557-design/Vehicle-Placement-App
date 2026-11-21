import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const source=fs.readFileSync(new URL("./app.js",import.meta.url),"utf8");

const keys=["trips","active","transit","completed","revenue","margin","lowMargin","delayed"];
for(const key of keys){
  assert.ok(source.includes('data-monthly-kpi="'+key+'"'),"Missing KPI double-click key: "+key);
}
assert.ok(source.includes('addEventListener("dblclick"'),"Monthly KPI tiles must use double-click");
assert.ok(source.includes("openMonthlyKpiDetails"),"KPI detail modal opener missing");
assert.ok(source.includes('id="monthlyKpiSearch"'),"Search field missing");
assert.ok(source.includes('id="monthlyKpiFrom"'),"From date filter missing");
assert.ok(source.includes('id="monthlyKpiTo"'),"To date filter missing");
assert.ok(source.includes("exportMonthlyKpiCsv"),"CSV export missing");
assert.ok(source.includes("openMonthlyTripDetails"),"Trip row drill-down missing");
assert.ok(source.includes('e.key!=="Escape"'),"Escape-to-close modal support missing");

function between(startMarker,endMarker){
  const start=source.indexOf(startMarker);
  const end=source.indexOf(endMarker,start);
  assert.ok(start>=0,"Missing source marker: "+startMarker);
  assert.ok(end>start,"Missing source marker: "+endMarker);
  return source.slice(start,end);
}

const context={
  console,
  state:{trips:[],minMarginPercent:10},
  isTripOpenStatus:s=>new Set(["Created","Vehicle Placed","Loading","In Transit","Reached","Unloading"]).has(s||"Vehicle Placed"),
  displayTripNumber:t=>t.tripNumber||t.id
};
vm.createContext(context);
vm.runInContext(
  between("function currentMonthOperationsSummary","function dashboardHeaderSummaryHtml")+
  "\n"+between("function monthKpiRows","function delayInfo")+
  "\n"+between("function monthlyKpiFilterRows","function monthlyKpiSummaryHtml")+
  "\nthis.currentMonthOperationsSummary=currentMonthOperationsSummary;this.monthKpiRows=monthKpiRows;this.monthlyKpiFilterRows=monthlyKpiFilterRows;",
  context
);

const now=new Date();
const start=new Date(now.getFullYear(),now.getMonth(),1).getTime();
const day=24*60*60*1000;
context.state.trips=[
  {id:"A",tripNumber:"A",createdAt:start,status:"Created",freight:100000,margin:20000,marginPercent:20,transitHours:.001,vehicle:"KA01",vendor:"V1",from:"A",to:"B"},
  {id:"B",tripNumber:"B",createdAt:start+day,status:"In Transit",freight:80000,margin:4000,marginPercent:5,transitHours:9999,vehicle:"KA02",vendor:"V2",from:"B",to:"C"},
  {id:"C",tripNumber:"C",createdAt:start+2*day,status:"Completed",freight:70000,margin:14000,marginPercent:20,vehicle:"KA03",vendor:"V3",from:"C",to:"D"},
  {id:"D",tripNumber:"D",createdAt:start+3*day,status:"Cancelled",freight:50000,margin:-5000,marginPercent:-10,vehicle:"KA04",vendor:"V4",from:"D",to:"E"}
];

const summary=context.currentMonthOperationsSummary();
assert.equal(summary.trips.length,4,"Monthly trip count mismatch");
assert.equal(summary.active,2,"Active KPI mismatch");
assert.equal(summary.transit,1,"Transit KPI mismatch");
assert.equal(summary.completed,1,"Completed KPI mismatch");
assert.equal(summary.revenue,300000,"Revenue KPI mismatch");
assert.equal(summary.margin,33000,"Margin KPI mismatch");
assert.equal(summary.low,2,"Low-margin KPI mismatch");

assert.equal(context.monthKpiRows("trips").length,4);
assert.equal(context.monthKpiRows("active").length,2);
assert.equal(context.monthKpiRows("transit").length,1);
assert.equal(context.monthKpiRows("completed").length,1);
assert.equal(context.monthKpiRows("revenue").length,4);
assert.equal(context.monthKpiRows("margin").length,4);
assert.equal(context.monthKpiRows("lowMargin").length,2);
assert.ok(context.monthKpiRows("delayed").some(t=>t.id==="A"),"Delayed KPI should include the overdue active trip");

const searchRows=context.monthlyKpiFilterRows("trips","KA03","","");
assert.equal(searchRows.map(x=>x.id).join(","),"C","Vehicle search should filter Monthly KPI rows");

console.log("Monthly KPI double-click drilldown tests passed.");
