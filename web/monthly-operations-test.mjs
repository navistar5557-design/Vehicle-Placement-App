import fs from "node:fs";
import assert from "node:assert/strict";

const source=fs.readFileSync(new URL("./app.js",import.meta.url),"utf8");

assert.ok(source.includes("function currentMonthOperationsSummary()"),"monthly summary helper missing");
assert.ok(source.includes("new Date(now.getFullYear(),now.getMonth(),1)"),"monthly summary must start on first day of current month");
assert.ok(source.includes("new Date(now.getFullYear(),now.getMonth()+1,1)"),"monthly summary must use next month as exclusive end");
assert.ok(source.includes("<strong>Monthly Operations</strong>"),"header title must say Monthly Operations");
assert.equal(source.includes("<strong>Today's Operations</strong>"),false,"daily header title must be removed");
assert.ok(source.includes("CUBE Logistics — Monthly Operations Summary"),"copied summary must be monthly");
assert.ok(source.includes('toast("Monthly summary copied")'),"copy confirmation must be monthly");

console.log("Monthly operations summary checks passed.");
