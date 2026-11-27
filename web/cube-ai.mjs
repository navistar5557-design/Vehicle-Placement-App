// Read-only fleet analytics. The model may choose a supported intent, never calculate values or execute actions.
export const questions={
 summary:"Monthly operations summary",available:"Which vehicles are available now?",active:"Active trips this month",
 transit:"Trips in transit this month",completed:"Completed trips this month",revenue:"Revenue this month",
 margin:"Margin this month",low:"Low margin trips this month",delayed:"Delayed trips this month",
 best:"Which vehicle has the highest total margin this month?",expenses:"Total expenses this month",
 utilization:"Fleet utilization now",trips:"Trips created this month"
};
const clean=s=>String(s??"").toLowerCase().replace(/[^a-z0-9 ]/g," ").replace(/ +/g," ").trim();
export function classify(question){
 const q=clean(question);
 for(const [key,value] of Object.entries(questions))if(q===clean(value))return key;
 // Refuse unsupported scope, identifiers, write requests and compound queries rather than silently answering a different question.
 if(/\b(last|previous|next|yesterday|today|tomorrow|week|year|vendor|route|idle|empty|forecast|predict|minimum|average|driver|gps|location|add|delete|change|edit|create|close|update|cancel|send|and|or)\b/.test(q)||/\d/.test(q))return null;
 if(/\b(available|availability|free vehicles)\b/.test(q))return "available";
 if(/\b(utilization|utilisation)\b/.test(q))return "utilization";
 if(/\b(low margin|loss making|loss making trips)\b/.test(q))return "low";
 if(/\b(highest|best|top|most profitable)\b/.test(q)&&/\b(vehicle|truck)\b/.test(q)&&/\b(margin|profit|profitable)\b/.test(q))return "best";
 if(/\b(delayed|overdue|late)\b/.test(q))return "delayed";
 if(/\b(in transit|transit)\b/.test(q))return "transit";
 if(/\b(completed|finished)\b/.test(q))return "completed";
 if(/\b(active|open trips)\b/.test(q))return "active";
 if(/\b(revenue|freight)\b/.test(q))return "revenue";
 if(/\b(margin|profit|loss)\b/.test(q))return "margin";
 if(/\b(expense|expenses|costs)\b/.test(q))return "expenses";
 if(/\b(summary|overview|performance)\b/.test(q))return "summary";
 if(/\b(trips|placements)\b/.test(q))return "trips";
 return null;
}
const financial=new Set(["revenue","margin","low","best","expenses","summary"]);
const money=n=>"₹"+Number(n).toLocaleString("en-IN",{maximumFractionDigits:0});
const num=v=>Number(v||0);
const date=v=>v?new Date(v).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"}):"Date unavailable";
const totals=rows=>rows.reduce((s,t)=>({revenue:s.revenue+num(t.freight),margin:s.margin+num(t.margin),expenses:s.expenses+num(t.totalExpenses)}),{revenue:0,margin:0,expenses:0});
const unavailable=()=>({title:"Data not ready",body:"Trip or vehicle data has not been confirmed by Firebase yet. Refresh or reconnect and try again.",rows:[]});
export function answer(intent,data){
 if(!data?.authorized)return {title:"Sign in required",body:"Sign in with an authorized account.",rows:[]};
 if(!Object.hasOwn(questions,intent))return {title:"Question not supported yet",body:"Choose a suggested question. This version supports current-month fleet analytics and current vehicle availability, not record changes or future predictions.",rows:[]};
 if(financial.has(intent)&&!data.canViewReports)return {title:"Restricted",body:"Your role does not allow financial reports.",rows:[]};
 const fleet=intent==="available"||intent==="utilization";
 if(!data.tripsReady||(fleet&&!data.vehiclesReady))return unavailable();
 if(fleet){
  const active=data.vehicles.filter(v=>v.active!==false);
  const available=active.filter(v=>v.availability==="available");
  const assigned=active.filter(v=>v.availability!=="available");
  return {title:intent==="available"?"Available vehicles now":"Fleet utilization now",body:available.length+" available / "+active.length+" active vehicles. "+assigned.length+" assigned. Utilization: "+(active.length?Math.round(assigned.length/active.length*100):0)+"%. Availability is based on recorded active trips, not GPS.",rows:available.map(v=>v.number+" · Available")};
 }
 const s=data.summary, rows=s.trips;
 const label=data.period;
 const view=t=>[t.tripNumber,t.vehicle,date(t.createdAt),[t.from,t.to].filter(Boolean).join(" → "),t.status].filter(Boolean).join(" · ");
 if(intent==="summary")return {title:label+" operations",body:s.trips.length+" trips · "+s.active+" active · "+s.transit+" in transit · "+s.completed+" completed\nRevenue "+money(s.revenue)+" · Margin "+money(s.margin)+"\n"+s.low+" low margin · "+s.delayed+" delayed",rows:[]};
 if(intent==="best"){
  const map=new Map();
  for(const t of rows){if(!t.vehicle)continue;const v=map.get(t.vehicle)||{count:0,margin:0,revenue:0};v.count++;v.margin+=num(t.margin);v.revenue+=num(t.freight);map.set(t.vehicle,v);}
  const ranked=[...map].sort((a,b)=>b[1].margin-a[1].margin);
  return {title:"Vehicle margin ranking · "+label,body:ranked.length?"Ranked by total recorded margin; includes all statuses, matching Monthly Operations.":"No vehicle trip records this month.",rows:ranked.map(([v,t])=>v+" · "+money(t.margin)+" margin · "+t.count+" trips")};
 }
 const selected=(data.kpiRows[intent]||rows);
 const t=totals(selected);
 const title=questions[intent]+" · "+label;
 let body=selected.length+" matching trip(s).";
 if(intent==="revenue")body+=" Total freight: "+money(s.revenue)+".";
 if(intent==="margin")body+=" Total margin: "+money(s.margin)+".";
 if(intent==="expenses")body+=" Total expenses: "+money(t.expenses)+".";
 if(intent==="low")body+=" Below configured threshold ("+data.minMarginPercent+"%) or negative margin.";
 if(intent==="delayed")body+=" Overdue against creation time plus planned transit hours; not a GPS-based ETA.";
 if(!selected.length)body+=" No trips found.";
 return {title,body,rows:selected.map(t=>view(t)+(intent==="revenue"?" · Freight "+money(t.freight):["margin","low"].includes(intent)?" · Margin "+money(t.margin)+" ("+num(t.marginPercent).toFixed(1)+"%)":intent==="expenses"?" · Expenses "+money(t.totalExpenses):intent==="delayed"?" · "+t.delay+" late":intent==="completed"?" · Completed "+date(t.closedAt||t.statusUpdatedAt):""))};
}
// On-device language model is strictly an intent router. No trip records are supplied to it.
export async function modelIntent(question,model){
 if(!model||typeof model.availability!=="function")return null;
 // The model cannot broaden the supported date scope or authorize write operations.
 const q=clean(question);
 if(/\b(last|previous|next|yesterday|today|tomorrow|week|year|vendor|route|idle|empty|forecast|predict|minimum|average|driver|gps|location|add|delete|change|edit|create|close|update|cancel|send|and|or)\b/.test(q)||/\d/.test(q))return null;
 let session;
 try{
  if(await model.availability()!=="available")return null;
  session=await model.create();
  const raw=await session.prompt("Classify this fleet question into exactly one key from "+JSON.stringify(questions)+". Only current-month analytics or current fleet availability; unsupported questions return NONE. Never answer the question. Question: "+JSON.stringify(question.slice(0,300)));
  const k=String(raw).trim();
  return Object.hasOwn(questions,k)?k:null;
 }catch{return null;}finally{try{session?.destroy();}catch{}}
}
export function mountCubeAI(getData){
 const el=document.createElement("section");
 el.id="cubeAi";el.hidden=true;
 el.innerHTML='<button class="cube-ai-launch" type="button" aria-expanded="false" aria-controls="cubeAiPanel">✦ CUBE AI</button><section id="cubeAiPanel" class="cube-ai-panel" hidden role="region" aria-label="CUBE AI fleet assistant"><header><div><strong>✦ CUBE AI</strong><small>Read-only fleet assistant</small></div><button type="button" class="cube-ai-close" aria-label="Close assistant">×</button></header><div class="cube-ai-mode">Local analytics · No paid API</div><div class="cube-ai-messages" role="log" aria-live="polite"></div><div class="cube-ai-suggestions"></div><form><input aria-label="Ask about your fleet" placeholder="Ask about your fleet…" maxlength="300" required><button type="submit">Ask</button></form><footer>Current month / current fleet · No data changes</footer></section>';
 document.body.append(el);
 const launch=el.querySelector(".cube-ai-launch"),panel=el.querySelector(".cube-ai-panel"),log=el.querySelector(".cube-ai-messages"),form=el.querySelector("form"),input=form.querySelector("input"),suggestions=el.querySelector(".cube-ai-suggestions");
 let generation=0,busy=false;
 function message(title,body,rows=[],user=false){
  const a=document.createElement("article");if(user)a.className="cube-ai-user";
  const h=document.createElement("strong");h.textContent=title;a.append(h);
  if(body){const p=document.createElement("p");p.textContent=body;a.append(p);}
  if(rows.length){const list=document.createElement("ul");for(const row of rows.slice(0,40)){const li=document.createElement("li");li.textContent=row;list.append(li);}a.append(list);if(rows.length>40){const p=document.createElement("p");p.textContent="Showing first 40 of "+rows.length+" records. See existing reports for the full list.";a.append(p);}}
  log.append(a);log.scrollTop=log.scrollHeight;
 }
 function setOpen(open){panel.hidden=!open;launch.setAttribute("aria-expanded",String(open));if(open)input.focus();else launch.focus();}
 function clear(){generation++;busy=false;log.replaceChildren();input.value="";form.querySelector("button").disabled=false;suggestions.replaceChildren();panel.hidden=true;launch.setAttribute("aria-expanded","false");}
 async function ask(q){
  if(busy||el.hidden||!q.trim())return;
  const current=getData();if(!current.authorized)return;
  const token=generation;busy=true;form.querySelector("button").disabled=true;
  message("You",q,[],true);
  try{
   let intent=classify(q);
   if(!intent)intent=await modelIntent(q,globalThis.LanguageModel);
   if(token!==generation||el.hidden)return;
   const result=answer(intent,getData());
   message(result.title,result.body,result.rows);
  }catch{if(token===generation)message("Unable to answer","Please try again.");}
  finally{if(token===generation){busy=false;form.querySelector("button").disabled=false;}}
 }
 function show(){
  clear();el.hidden=false;
  const d=getData();
  message("Welcome","Ask about recorded fleet operations. Answers use your existing trip data and permissions. On-device AI may interpret additional wording on supported browsers.");
  for(const k of ["available","summary","low","delayed","best","trips"]){if(financial.has(k)&&!d.canViewReports)continue;const b=document.createElement("button");b.type="button";b.textContent=questions[k];b.onclick=()=>ask(questions[k]);suggestions.append(b);}
 }
 launch.onclick=()=>setOpen(panel.hidden);el.querySelector(".cube-ai-close").onclick=()=>setOpen(false);
 panel.addEventListener("keydown",e=>{if(e.key==="Escape"){e.stopPropagation();setOpen(false);}});
 form.addEventListener("submit",e=>{e.preventDefault();const q=input.value.trim();if(q&&!busy){input.value="";ask(q);}});
 return {show,hide(){clear();el.hidden=true;}};
}
