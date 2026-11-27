import assert from "node:assert/strict";
import {extractFleetScope,localPlan,executePlan,plannerPrompt,validatePlan} from "./fleet-query.mjs";
const now=new Date(2026,10,27,12).getTime(),today=new Date(2026,10,27,9).getTime(),prior=new Date(2026,9,10).getTime();
const data={authorized:true,canViewReports:true,tripsReady:true,minMarginPercent:10,vehicles:[{number:"TN34AB6821"},{number:"TN34AB6822"}],allTrips:[
{createdAt:today,vehicle:"TN34AB6821",vendor:"Shivakrupa",freight:1000,margin:250,totalExpenses:750,fuelExpense:200,advance:400,totalKm:100,status:"Created",isOpen:true},
{createdAt:prior,vehicle:"TN34AB6822",vendor:"Other Vendor",freight:2000,margin:400,totalExpenses:1600,fuelExpense:500,advance:600,totalKm:200,status:"Completed",isOpen:false}]};
function ask(q,d=data){const s=extractFleetScope(q,d);const p=localPlan(q,s);assert.ok(p,q);return executePlan(p,d,s,now);}
assert.match(ask("Total revenue last month").body,/2,000/);
assert.match(ask("What is our margin today?").body,/250/);
assert.match(ask("Total fuel expenses for vehicle 6821 this month").body,/200/);
assert.match(ask("Total revenue for Shivakrupa this month").body,/1,000/);
assert.match(ask("Top 5 vehicles by margin this month").rows[0],/6821.*250/);
assert.match(ask("Total balance today").body,/600/);
assert.match(ask("Total revenue between 2026-10-01 and 2026-11-27").body,/3,000/);
assert.equal(ask("Total revenue today",{...data,canViewReports:false}).title,"Restricted");
assert.equal(ask("Total revenue today",{...data,tripsReady:false}).title,"Data not ready");
assert.equal(localPlan("What is profit margin?",{}),null);
assert.equal(localPlan("Total revenue last 30 days",{}),null);
assert.equal(localPlan("Delete our trips",{}),null);
assert.equal(localPlan("Total revenue for vehicle 9999",extractFleetScope("Total revenue for vehicle 9999",data)),null);
assert.ok(!plannerPrompt("Show revenue for Shivakrupa and TN34AB6821",extractFleetScope("Show revenue for Shivakrupa and TN34AB6821",data)).includes("shivakrupa"));
assert.equal(validatePlan({metric:"passwords"}),null);
console.log("Fleet query date range, filtering, ranking, financial access and privacy tests passed");
