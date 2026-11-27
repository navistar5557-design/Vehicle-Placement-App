import assert from "node:assert/strict";
import {answer,classify,modelIntent,questions,routeQuestion} from "./cube-ai.mjs";
const a={tripNumber:"A",vehicle:"V1",freight:1000,margin:300,totalExpenses:700,status:"Completed",createdAt:1};
const b={tripNumber:"B",vehicle:"V2",freight:500,margin:-100,totalExpenses:600,status:"Created",createdAt:2,delay:"2h"};
const data={authorized:true,canViewReports:true,tripsReady:true,vehiclesReady:true,period:"November 2026",minMarginPercent:10,summary:{trips:[a,b],active:1,transit:0,completed:1,revenue:1500,margin:200,low:1,delayed:1},kpiRows:{active:[b],transit:[],completed:[a],low:[b],delayed:[b]},vehicles:[{number:"V1",active:true,availability:"available"},{number:"V2",active:true,availability:"reserved"},{number:"V3",active:false,availability:"maintenance"}]};
for(const [k,q] of Object.entries(questions)){assert.equal(classify(q),k);assert.ok(answer(k,data).title);}
assert.match(answer("revenue",data).body,/1,500/);assert.match(answer("margin",data).body,/200/);assert.match(answer("expenses",data).body,/1,300/);
assert.equal(answer("available",data).rows.length,1);assert.match(answer("utilization",data).body,/50%/);
assert.equal(answer("best",data).rows[0].split(" · ")[0],"V1");assert.equal(answer("low",data).rows.length,1);assert.equal(answer("delayed",data).rows.length,1);
for(const k of ["revenue","margin","low","best","expenses","summary"])assert.equal(answer(k,{...data,canViewReports:false}).title,"Restricted");
assert.equal(answer("available",{...data,vehiclesReady:false}).title,"Data not ready");assert.equal(answer("trips",{...data,tripsReady:false}).title,"Data not ready");assert.equal(answer("trips",{authorized:false}).title,"Sign in required");
assert.equal(answer("transit",data).rows.length,0);assert.equal(classify("delete trips"),null);assert.equal(classify("revenue last year"),null);
let destroyed=false;const model={availability:async()=>"available",create:async()=>({prompt:async()=> "available",destroy:()=>{destroyed=true;}})};
assert.equal(await modelIntent("what trucks can take a load",model),"available");assert.ok(destroyed);assert.equal(await modelIntent("delete trips",model),null);
assert.equal(await modelIntent("unrecognized",{availability:async()=>"unavailable"}),null);
console.log("CUBE AI analytics, role, freshness and model-router tests passed");

for(const q of ["What is diesel efficiency?","How can I improve diesel efficiency?","What is profit margin?","Write an email","How can we reduce fuel costs?","What is the capital of India?"])assert.equal(routeQuestion(q).kind,"general",q);
for(const [k,q] of Object.entries(questions))assert.deepEqual(routeQuestion(q),{kind:"fleet",intent:k});
assert.deepEqual(routeQuestion("Which trucks can take a load?"),{kind:"fleet",intent:"available"});
assert.deepEqual(routeQuestion("இந்த மாத லாபம் என்ன?"),{kind:"fleet",intent:"margin"});
assert.equal(routeQuestion("What is our revenue last year?").kind,"fleet-unknown");
assert.equal(routeQuestion("What is the margin of TN 34 AB 1234?").kind,"blocked");
assert.equal(routeQuestion("Delete our trips").kind,"unsupported");
console.log("Unified routing and sensitive query guard tests passed");
