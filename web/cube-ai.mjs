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
 if(/\b(last|previous|next|yesterday|today|tomorrow|week|year|january|february|march|april|may|june|july|august|september|october|november|december|vendor|route|idle|empty|forecast|predict|minimum|average|driver|gps|location|add|delete|change|edit|create|close|update|cancel|send|and|or)\b/.test(q)||/\d/.test(q))return null;
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
const modelOptions={expectedInputs:[{type:"text",languages:["en"]}],expectedOutputs:[{type:"text",languages:["en"]}]};
export async function modelIntent(question,model){
 if(!model||typeof model.availability!=="function")return null;
 // The model cannot broaden the supported date scope or authorize write operations.
 const q=clean(question);
 if(/\b(last|previous|next|yesterday|today|tomorrow|week|year|january|february|march|april|may|june|july|august|september|october|november|december|vendor|route|idle|empty|forecast|predict|minimum|average|driver|gps|location|add|delete|change|edit|create|close|update|cancel|send|and|or)\b/.test(q)||/\d/.test(q))return null;
 let session;
 try{
  if(await model.availability(modelOptions)!=="available")return null;
  session=await model.create(modelOptions);
  const raw=await session.prompt("Classify this fleet question into exactly one key from "+JSON.stringify(questions)+". Only current-month analytics or current fleet availability; unsupported questions return NONE. Never answer the question. Question: "+JSON.stringify(question.slice(0,300)));
  const k=String(raw).trim();
  return Object.hasOwn(questions,k)?k:null;
 }catch{return null;}finally{try{session?.destroy();}catch{}}
}

// Route locally before any cloud request. Unknown private queries never become invented fleet answers.
export function routeQuestion(value){
 const raw=String(value??"").trim(),q=raw.toLowerCase(),norm=clean(raw);
 if(!q)return {kind:"blocked"};
 const sensitive=/\b[A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,3}\s?\d{3,4}\b/i.test(raw)||/\b\d{10,}\b/.test(raw)||/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i.test(raw)||/\b(password|api key|secret|otp|aadhaar|aadhar|bank account)\b/i.test(raw);
 const company=/\b(our|my|cube|company|actual|recorded)\b/i.test(q)||/எங்கள்|எனது|நமது|நம்ம|என்னுடைய/.test(q);
 const domain=/\b(fleet|trips?|trucks?|vehicles?|revenue|margin|freight|expenses?|vendor|driver|load|utilization|utilisation|profit|transport|logistics|diesel|fuel|operations)\b/i.test(q)||/வாகன|பயண|லாப|வருவாய்|செலவு|சரக்கு|டிரக்|லாரி/.test(q);
 const recordWords=/\b(this month|current month|last month|today|yesterday|now|available|delayed|completed|in transit|active trips|monthly operations|last year)\b/i.test(q)||/இந்த மாத|இன்று|நேற்று|தற்போது|கடந்த மாத|கிடைக்க/.test(q);
 const write=/\b(delete|edit|cancel|update|change|create|add|send|close)\b/i.test(q);
 const general=/^(what (is|are|does|do)|how (to|can|do|does|should)|why|explain|define|describe|write|draft|correct|translate|suggest|give (me )?(tips|ideas)|calculate|compare|tell me about)\b/i.test(q)||/எப்படி|என்றால் என்ன|விளக்க|எழுத|மொழிபெயர்|ஆலோசனை/.test(q);
 if(sensitive)return {kind:"blocked"};
 if(domain&&write&&company&&!/^(write|draft|correct|translate)\b/.test(q))return {kind:"unsupported"};
 // Exact report shortcuts always retain their existing semantics.
 for(const [key,label] of Object.entries(questions))if(norm===clean(label))return {kind:"fleet",intent:key};
 if(domain&&company&&general&&!recordWords){
  if(/\b(how (can|do|should|to)|suggest|tips|ideas|improve|reduce)\b/.test(q)&&!/\b(actual|recorded|data|report|based on)\b/.test(q))return {kind:"general"};
  return {kind:"unsupported"};
 }
 if(general&&!company&&!recordWords)return {kind:"general"};
 if(domain){
  if(/\d/.test(raw))return {kind:"unsupported"};
  if(/கிடைக்க.*வாகன|வாகன.*கிடைக்க/.test(q))return {kind:"fleet",intent:"available"};
  if(/இந்த மாத.*லாப|லாப.*இந்த மாத/.test(q))return {kind:"fleet",intent:"margin"};
  if(/இந்த மாத.*வருவாய்|வருவாய்.*இந்த மாத/.test(q))return {kind:"fleet",intent:"revenue"};
  const intent=classify(raw);
  if(intent&&(company||recordWords||!general))return {kind:"fleet",intent};
  if(/\b(trucks?|vehicles?)\b/.test(q)&&/\b(can take a load|ready for (a )?load|free to load)\b/.test(q))return {kind:"fleet",intent:"available"};
  if(company||recordWords||!general)return {kind:"fleet-unknown"};
 }
 if(company&&/\b(data|report|records|balance|payment|collections?|sales|customers?)\b/.test(q))return {kind:"unsupported"};
 return {kind:"general"};
}

export function mountCubeAI(getData,cloudRouter=null,generalAI=null){
 const el=document.createElement("section");el.id="cubeAi";el.hidden=true;
 el.innerHTML='<button class="cube-ai-launch" type="button" aria-expanded="false" aria-controls="cubeAiPanel"><span class="cube-ai-orb" aria-hidden="true">✦</span><span>CUBE AI</span><span class="cube-ai-launch-dot" aria-hidden="true"></span></button><section id="cubeAiPanel" class="cube-ai-panel" hidden role="region" aria-label="CUBE AI assistant"><header><div class="cube-ai-brand"><span class="cube-ai-orb" aria-hidden="true">✦</span><div><strong>CUBE AI <span class="cube-ai-edition">ASSISTANT</span></strong><small>One conversation. Smarter operations.</small></div></div><div class="cube-ai-header-actions"><button type="button" class="cube-ai-new" aria-label="New conversation" title="New conversation">＋</button><button type="button" class="cube-ai-expand" aria-label="Expand assistant" title="Expand assistant">↗</button><button type="button" class="cube-ai-close" aria-label="Close assistant" title="Close assistant">×</button></div></header><div class="cube-ai-status"><span><i aria-hidden="true"></i> Smart routing</span><span>Fleet data + Gemini</span></div><div class="cube-ai-messages" role="log" aria-live="polite"></div><div class="cube-ai-suggestions" aria-label="Suggested questions"></div><div class="cube-ai-thinking" hidden role="status"><span></span><span></span><span></span> Finding the answer…</div><form><textarea rows="2" aria-label="Ask CUBE AI" placeholder="Ask anything about your fleet or general knowledge…" maxlength="1000" required></textarea><button type="submit" aria-label="Ask" title="Send question">↑</button></form><footer>General questions may be sent to Google Gemini. Avoid confidential details. Fleet records stay local.</footer></section>';
 document.body.append(el);
 const launch=el.querySelector(".cube-ai-launch"),panel=el.querySelector(".cube-ai-panel"),log=el.querySelector(".cube-ai-messages"),form=el.querySelector("form"),input=form.querySelector("textarea"),suggestions=el.querySelector(".cube-ai-suggestions"),thinking=el.querySelector(".cube-ai-thinking"),send=form.querySelector("button"),expand=el.querySelector(".cube-ai-expand");
 let generation=0,busy=false;
 function message(title,body,rows=[],user=false,source=""){
  const a=document.createElement("article");a.className=user?"cube-ai-user":"cube-ai-answer";
  const h=document.createElement("strong");h.textContent=title;a.append(h);
  if(body){const p=document.createElement("p");p.textContent=body;a.append(p);}
  if(rows.length){const list=document.createElement("ul");for(const row of rows.slice(0,40)){const li=document.createElement("li");li.textContent=row;list.append(li);}a.append(list);if(rows.length>40){const p=document.createElement("p");p.textContent="Showing first 40 of "+rows.length+" records. See reports for all records.";a.append(p);}}
  if(source){const meta=document.createElement("span");meta.className="cube-ai-source";meta.textContent=source;a.append(meta);}
  if(!user&&body){const copy=document.createElement("button");copy.type="button";copy.className="cube-ai-copy";copy.textContent="Copy";copy.setAttribute("aria-label","Copy answer");copy.onclick=async()=>{try{await navigator.clipboard.writeText([title,body,...rows.slice(0,40)].join("\n"));copy.textContent="Copied";}catch{copy.textContent="Copy unavailable";}};a.append(copy);}
  log.append(a);log.scrollTop=log.scrollHeight;
 }
 function setOpen(open){panel.hidden=!open;launch.setAttribute("aria-expanded",String(open));if(open)input.focus();else launch.focus();}
 function setBusy(value){busy=value;send.disabled=value;thinking.hidden=!value;for(const b of suggestions.querySelectorAll("button"))b.disabled=value;}
 function populate(){
  log.replaceChildren();suggestions.replaceChildren();input.value="";
  const d=getData();
  const hero=document.createElement("div");hero.className="cube-ai-welcome";hero.innerHTML='<span class="cube-ai-hero-orb" aria-hidden="true">✦</span><h2>How can I help?</h2><p>Your fleet insights and everyday AI, together in one place.</p>';log.append(hero);
  const quick=[["◈",questions.available],["↗",questions.summary],["◷",questions.delayed],["✦","How can I improve diesel efficiency?"],["✎","Draft a professional logistics email"]];
  for(const [symbol,q] of quick){if(q===questions.summary&&!d.canViewReports)continue;const b=document.createElement("button");b.type="button";b.setAttribute("aria-label",q);const icon=document.createElement("span");icon.textContent=symbol;icon.setAttribute("aria-hidden","true");b.append(icon,document.createTextNode(q));b.onclick=()=>ask(q);suggestions.append(b);}
  suggestions.hidden=false;
 }
 function clear(){generation++;setBusy(false);log.replaceChildren();input.value="";suggestions.replaceChildren();panel.hidden=true;panel.classList.remove("cube-ai-expanded");expand.setAttribute("aria-label","Expand assistant");launch.setAttribute("aria-expanded","false");}
 async function ask(q){
  if(busy||el.hidden||!q.trim()||!getData().authorized)return;
  const token=generation;setBusy(true);suggestions.hidden=true;log.querySelector(".cube-ai-welcome")?.remove();message("You",q,[],true);
  const current=()=>token===generation&&!el.hidden&&getData().authorized;
  try{
   const route=routeQuestion(q);
   if(route.kind==="blocked"){message("Private information","Please remove identifiers, credentials or personal details and ask again. No cloud request was sent.",[] ,false,"Privacy protection");return;}
   if(route.kind==="general"){
    const result=generalAI?await generalAI(q):{ok:false,text:"Gemini is not configured."};
    if(current())message(result.ok?"CUBE AI":"Gemini unavailable",result.text,[],false,result.ok?"Google Gemini · Free tier":"Connection status");return;
   }
   let intent=route.intent;
   if(route.kind==="fleet-unknown"&&cloudRouter){intent=await cloudRouter(q);if(!current())return;}
   if(!current())return;
   if(!intent){message("Fleet question not supported yet","I can retrieve current-month operations and current vehicle availability. Try asking for monthly margin, active trips or available vehicles. I won't guess your actual figures.",[],false,"Fleet analytics · Local");return;}
   const result=answer(intent,getData());message(result.title,result.body,result.rows,false,"Fleet analytics · Firebase records");
  }catch{if(current())message("Unable to answer","Please try again.",[],false,"Connection status");}
  finally{if(token===generation)setBusy(false);}
 }
 function show(){clear();el.hidden=false;populate();}
 launch.onclick=()=>setOpen(panel.hidden);el.querySelector(".cube-ai-close").onclick=()=>setOpen(false);
 el.querySelector(".cube-ai-new").onclick=()=>{generation++;setBusy(false);populate();input.focus();};
 expand.onclick=()=>{const large=panel.classList.toggle("cube-ai-expanded");expand.setAttribute("aria-label",large?"Restore assistant":"Expand assistant");expand.textContent=large?"↙":"↗";};
 panel.addEventListener("keydown",e=>{if(e.key==="Escape"){e.stopPropagation();setOpen(false);}});
 input.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.isComposing){e.preventDefault();form.requestSubmit();}});
 form.addEventListener("submit",e=>{e.preventDefault();const q=input.value.trim();if(q&&!busy){input.value="";ask(q);}});
 return {show,hide(){clear();el.hidden=true;}};
}
