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

// New behaviour: Other Expense is a direct rupee deduction.
{
  const trip={
    freight:100000,totalKm:0,mileage:0,fuelRate:100,weightTon:10,
    otherExpense:12500,fastag:3000,rtoTarpaulin:2000,fixedExpenses:1000,
    loadingExpensePerTon:4000,unloadingExpensePerTon:2500,
    loadingUnloading:0,expenseCalcVersion:3,expenseRules:[]
  };
  const c=calcTrip(trip);
  assert.equal(c.totalOtherExpense,12500);
  assert.equal(c.percentageExpense,0);
  assert.equal(c.totalExpenses,25000);
  assert.equal(c.margin,75000);
  assert.equal(c.marginPercent,75);
  const b=tripExpenseBreakdown(trip);
  const other=b.expenses.find(x=>x.key==="other");
  assert.equal(other.value,12500);
  assert.equal(other.detail,"");
  console.log("PASS direct Other Expense amount");
}

// Changing freight must NOT change the direct Other Expense amount.
{
  const base={totalKm:0,mileage:0,fuelRate:100,weightTon:10,otherExpense:10000,expenseCalcVersion:3,expenseRules:[]};
  const a=calcTrip({...base,freight:50000});
  const b=calcTrip({...base,freight:100000});
  assert.equal(a.totalOtherExpense,10000);
  assert.equal(b.totalOtherExpense,10000);
  assert.equal(a.margin,40000);
  assert.equal(b.margin,90000);
  console.log("PASS Other Expense does not scale with freight");
}

// Old trips saved with a percentage retain the same historical calculation.
{
  const legacy={freight:100000,totalKm:0,mileage:0,fuelRate:100,weightTon:10,expenseCalcVersion:3,expenseRules:[{name:"Other Expense",percent:10}]};
  const c=calcTrip(legacy);
  assert.equal(c.percentageExpense,10000);
  assert.equal(c.otherExpenseAmount,0);
  assert.equal(c.totalOtherExpense,10000);
  assert.equal(c.margin,90000);
  const b=tripExpenseBreakdown(legacy);
  assert.equal(b.expenses.find(x=>x.key==="other").value,10000);
  assert.equal(b.expenses.find(x=>x.key==="other").detail,"");
  console.log("PASS legacy percentage compatibility");
}

assert.ok(source.includes('Other Expense (₹)'));
assert.equal(source.includes('<span>Other Expense %</span>'),false);
assert.ok(source.includes('id="fOther"'));
assert.ok(source.includes('id="eOther"'));
assert.ok(source.includes('otherExpense:formNumber("fOther")'));
assert.ok(source.includes('expenseRules:[]'));

console.log("Other Expense amount tests passed.");
