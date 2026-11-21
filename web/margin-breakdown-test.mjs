import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const source=fs.readFileSync(new URL("./app.js",import.meta.url),"utf8");

function between(startMarker,endMarker){
  const start=source.indexOf(startMarker);
  const end=source.indexOf(endMarker,start);
  assert.ok(start>=0,"Missing source marker: "+startMarker);
  assert.ok(end>start,"Missing source marker: "+endMarker);
  return source.slice(start,end);
}

const executable=[
  between("const parseMoneyValue","const moneyInputValue"),
  between("function handlingExpenses","function calcTrip"),
  between("function calcTrip","function tripExpenseBreakdown"),
  between("function tripExpenseBreakdown","async function loadProfile")
].join("\n");

const context={console};
vm.createContext(context);
vm.runInContext(executable+"\nthis.calcTrip=calcTrip;this.tripExpenseBreakdown=tripExpenseBreakdown;",context);

const {calcTrip,tripExpenseBreakdown}=context;

function verify(name,trip,expectedSign){
  const calculated=calcTrip(trip);
  const breakdown=tripExpenseBreakdown(trip);
  const rowTotal=breakdown.expenses.reduce((sum,row)=>sum+Number(row.value||0),0);

  assert.ok(Number.isFinite(breakdown.margin),name+": margin must be finite");
  assert.ok(Number.isFinite(breakdown.marginPercent),name+": margin % must be finite");
  assert.equal(breakdown.totalRevenue,calculated.freight,name+": revenue must equal freight");
  assert.ok(Math.abs(breakdown.totalExpenses-calculated.totalExpenses)<0.0001,name+": total expenses must match calcTrip");
  assert.ok(Math.abs(rowTotal-calculated.totalExpenses)<0.0001,name+": displayed expense rows must sum to calcTrip total");
  assert.ok(Math.abs(breakdown.margin-calculated.margin)<0.0001,name+": net margin must match calcTrip");
  assert.ok(Math.abs(breakdown.marginPercent-calculated.marginPercent)<0.0001,name+": margin % must match calcTrip");
  assert.equal(Math.sign(breakdown.margin),expectedSign,name+": unexpected margin sign");
  assert.equal(breakdown.expenses.some(row=>/driver bata/i.test(row.label)),false,name+": must not invent a Driver Bata charge");
  console.log("PASS",name,"margin",breakdown.margin.toFixed(2),"pct",breakdown.marginPercent.toFixed(1));
}

verify("positive margin",{
  freight:88400,weightTon:20,totalKm:500,mileage:4,fuelRate:100,
  fastag:5000,rtoTarpaulin:3000,loadingExpensePerTon:4000,unloadingExpensePerTon:2000,
  fixedExpenses:1000,loadingUnloading:0,expenseCalcVersion:3,
  expenseRules:[{name:"Other Expense",percent:5}]
},1);

verify("negative margin",{
  freight:60900,weightTon:25,totalKm:1200,mileage:3,fuelRate:100,
  fastag:10000,rtoTarpaulin:5000,loadingExpensePerTon:5000,unloadingExpensePerTon:5000,
  fixedExpenses:5000,loadingUnloading:0,expenseCalcVersion:3,
  expenseRules:[{name:"Other Expense",percent:10}]
},-1);

verify("zero margin",{
  freight:50000,weightTon:10,totalKm:0,mileage:0,fuelRate:100,
  fastag:0,rtoTarpaulin:0,loadingExpensePerTon:0,unloadingExpensePerTon:0,
  fixedExpenses:50000,loadingUnloading:0,expenseCalcVersion:3,expenseRules:[]
},0);

verify("missing data",{},0);

verify("legacy handling",{
  freight:64500,weightTon:10,totalKm:0,mileage:0,fuelRate:100,
  fastag:0,rtoTarpaulin:0,loadingExpensePerTon:45000,unloadingExpensePerTon:0,
  fixedExpenses:0,loadingUnloading:500,expenseCalcVersion:0,expenseRules:[]
},1);

console.log("Margin breakdown calculation tests passed.");
