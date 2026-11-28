import { tr, normalizeLanguage, languages, languageLabels } from "./ai-language.mjs?v=1";
import { extractFleetScope, localPlan, executePlan, plannerPrompt, validatePlan } from "./fleet-query.mjs?v=2";
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
const unavailable=(language="en")=>({title:tr("Data not ready",language),body:tr("Trip or vehicle data has not been confirmed by Firebase yet. Refresh or reconnect and try again.",language),rows:[]});
export function answer(intent,data,language="en"){
 const T=s=>tr(s,language);
 if(!data?.authorized)return {title:T("Sign in required"),body:T("Sign in with an authorized account."),rows:[]};
 if(!Object.hasOwn(questions,intent))return {title:T("Question not supported yet"),body:T("Choose a suggested question. This version supports current-month fleet analytics and current vehicle availability, not record changes or future predictions."),rows:[]};
 if(financial.has(intent)&&!data.canViewReports)return {title:T("Restricted"),body:T("Your role does not allow financial reports."),rows:[]};
 const fleet=intent==="available"||intent==="utilization";
 if(!data.tripsReady||(fleet&&!data.vehiclesReady))return unavailable(language);
 if(fleet){
  const active=data.vehicles.filter(v=>v.active!==false);
  const available=active.filter(v=>v.availability==="available");
  const assigned=active.filter(v=>v.availability!=="available");
  return {title:intent==="available"?T("Available vehicles now"):T("Fleet utilization now"),body:available.length+" "+T("available")+" / "+active.length+" "+T("active vehicles")+". "+assigned.length+" "+T("assigned")+". "+T("Utilization")+": "+(active.length?Math.round(assigned.length/active.length*100):0)+"%. "+T("Availability is based on recorded active trips, not GPS."),rows:available.map(v=>v.number+" · "+T("Available"))};
 }
 const s=data.summary, rows=s.trips;
 const label=data.period;
 const view=t=>[t.tripNumber,t.vehicle,date(t.createdAt),[t.from,t.to].filter(Boolean).join(" → "),T(t.status||"")].filter(Boolean).join(" · ");
 if(intent==="summary")return {title:label+" "+T("operations"),body:s.trips.length+" "+T("trips")+" · "+s.active+" "+T("active")+" · "+s.transit+" "+T("in transit")+" · "+s.completed+" "+T("completed")+"\n"+T("Revenue")+" "+money(s.revenue)+" · "+T("Margin")+" "+money(s.margin)+"\n"+s.low+" "+T("low margin")+" · "+s.delayed+" "+T("delayed"),rows:[]};
 if(intent==="best"){
  const map=new Map();
  for(const t of rows){if(!t.vehicle)continue;const v=map.get(t.vehicle)||{count:0,margin:0,revenue:0};v.count++;v.margin+=num(t.margin);v.revenue+=num(t.freight);map.set(t.vehicle,v);}
  const ranked=[...map].sort((a,b)=>b[1].margin-a[1].margin);
  return {title:T("Vehicle margin ranking")+" · "+label,body:ranked.length?T("Ranked by total recorded margin; includes all statuses, matching Monthly Operations."):T("No vehicle trip records this month."),rows:ranked.map(([v,t])=>v+" · "+money(t.margin)+" "+T("margin")+" · "+t.count+" "+T("trips"))};
 }
 const selected=(data.kpiRows[intent]||rows);
 const t=totals(selected);
 const title=T(questions[intent])+" · "+label;
 let body=selected.length+" "+T("matching trip(s).");
 if(intent==="revenue")body+=" "+T("Total freight")+": "+money(s.revenue)+".";
 if(intent==="margin")body+=" "+T("Total margin")+": "+money(s.margin)+".";
 if(intent==="expenses")body+=" "+T("Total expenses")+": "+money(t.expenses)+".";
 if(intent==="low")body+=" "+T("Below configured threshold")+" ("+data.minMarginPercent+"%) "+T("or negative margin.");
 if(intent==="delayed")body+=" "+T("Overdue against creation time plus planned transit hours; not a GPS-based ETA.");
 if(!selected.length)body+=" "+T("No trips found.");
 return {title,body,rows:selected.map(t=>view(t)+(intent==="revenue"? " · "+T("Freight")+" "+money(t.freight):["margin","low"].includes(intent)? " · "+T("Margin")+" "+money(t.margin)+" ("+num(t.marginPercent).toFixed(1)+"%)":intent==="expenses"? " · "+T("Expenses")+" "+money(t.totalExpenses):intent==="delayed"?" · "+t.delay+" "+T("late"):intent==="completed"? " · "+T("Completed")+" "+date(t.closedAt||t.statusUpdatedAt):""))};
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

const aiIcons={"spark":"<path d=\"M12 2c.8 6.2 3.8 9.2 10 10-6.2.8-9.2 3.8-10 10C11.2 15.8 8.2 12.8 2 12 8.2 11.2 11.2 8.2 12 2Z\" fill=\"currentColor\" stroke=\"none\"/>","truck":"<path d=\"M2 5h13v13H2zM15 10h4l3 4v4h-7\"/><circle cx=\"6\" cy=\"18\" r=\"2\" fill=\"currentColor\"/><circle cx=\"18\" cy=\"18\" r=\"2\" fill=\"currentColor\"/>","chart":"<path d=\"M3 3v18h18M7 15l5-5 4 3 5-7\"/>","clock":"<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 6v6l4 2\"/>","rank":"<path d=\"M8 21H3V11h5zM15 21h-5V3h5zM22 21h-5V8h5z\"/>","mail":"<rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\"/><path d=\"m3 6 9 7 9-7\"/>","plus":"<path d=\"M12 5v14M5 12h14\"/>","expand":"<path d=\"M14 4h6v6M20 4l-6 6M10 20H4v-6M4 20l6-6\"/>","restore":"<path d=\"M20 10h-6V4M14 10l6-6M4 14h6v6M10 14l-6 6\"/>","close":"<path d=\"m6 6 12 12M18 6 6 18\"/>","send":"<path d=\"M12 20V4m-7 7 7-7 7 7\"/>","copy":"<rect x=\"8\" y=\"8\" width=\"12\" height=\"13\" rx=\"2\"/><path d=\"M16 5V4H4v13h1\"/>","shield":"<path d=\"M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z\"/><path d=\"m9 12 2 2 4-4\"/>","arrow":"<path d=\"M5 12h14m-6-6 6 6-6 6\"/>"};
function aiIcon(name){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+(aiIcons[name]||aiIcons.spark)+'</svg>';}
export function mountCubeAI(getData,cloudRouter=null,generalAI=null,fleetPlanner=null){
 const el=document.createElement("section");el.id="cubeAi";el.hidden=true;
 el.innerHTML=`<button class="cube-ai-launch" type="button" aria-expanded="false" aria-controls="cubeAiPanel" aria-label="CUBE AI"><span class="cube-ai-orb" aria-hidden="true">${aiIcon("spark")}</span><span class="cube-ai-launch-text">CUBE AI<small>Ask your assistant</small></span><span class="cube-ai-launch-arrow">${aiIcon("arrow")}</span></button><section id="cubeAiPanel" class="cube-ai-panel" hidden role="region" aria-label="CUBE AI assistant"><header><div class="cube-ai-brand"><span class="cube-ai-orb" aria-hidden="true">${aiIcon("spark")}</span><div><span class="cube-ai-eyebrow">CUBE LOGISTICS / INTELLIGENCE</span><strong>CUBE AI</strong><small>Operations & everyday assistance</small></div></div><div class="cube-ai-header-actions"><button type="button" class="cube-ai-new" aria-label="New conversation" title="New conversation">${aiIcon("plus")}</button><button type="button" class="cube-ai-expand" aria-label="Expand assistant" title="Expand assistant">${aiIcon("expand")}</button><button type="button" class="cube-ai-close" aria-label="Close assistant" title="Close assistant">${aiIcon("close")}</button></div></header><div class="cube-ai-status"><span class="cube-ai-status-main"><i aria-hidden="true"></i>Automatic question routing</span><label class="cube-ai-language"><span>Answer language</span><select aria-label="Answer language" class="cube-ai-language-select">${Object.entries(languageLabels).map(([id,label])=>`<option value="${id}">${label}</option>`).join("")}</select></label></div><div class="cube-ai-messages" role="log" aria-live="polite"></div><div class="cube-ai-suggestion-heading">EXPLORE CUBE AI</div><div class="cube-ai-suggestions" aria-label="Suggested questions"></div><div class="cube-ai-thinking" hidden role="status"><span></span><span></span><span></span> Finding the answer…</div><form><div class="cube-ai-composer"><textarea rows="2" aria-label="Ask CUBE AI" placeholder="Ask anything about your fleet or general knowledge…" maxlength="1000" required></textarea><div class="cube-ai-composer-tools"><span>Enter to send · Shift+Enter for new line</span><button type="submit" aria-label="Ask" title="Send question">${aiIcon("send")}</button></div></div></form><footer>${aiIcon("shield")}<span>Fleet records stay local. General questions may go to Gemini. Avoid confidential details.</span></footer></section>`;
 document.body.append(el);
 const launch=el.querySelector(".cube-ai-launch"),panel=el.querySelector(".cube-ai-panel"),log=el.querySelector(".cube-ai-messages"),form=el.querySelector("form"),input=form.querySelector("textarea"),suggestions=el.querySelector(".cube-ai-suggestions"),thinking=el.querySelector(".cube-ai-thinking"),send=form.querySelector("button"),expand=el.querySelector(".cube-ai-expand");
 let generation=0,busy=false;
 const languageSelect=el.querySelector('.cube-ai-language-select');
 let language='en';try{language=normalizeLanguage(localStorage.getItem('cube.ai.answerLanguage'));}catch{}
 languageSelect.value=language;let languageAnimation;
 languageSelect.onchange=()=>{language=normalizeLanguage(languageSelect.value);try{localStorage.setItem('cube.ai.answerLanguage',language);}catch{}if(typeof languageSelect.animate==='function'&&!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches){languageAnimation?.cancel();languageAnimation=languageSelect.animate([{boxShadow:'0 0 0 0 #f5823780',transform:'scale(1)'},{boxShadow:'0 0 0 4px #f5823720',transform:'scale(1.035)'},{boxShadow:'0 0 0 0 transparent',transform:'scale(1)'}],{duration:360,easing:'ease-out'});}};
 function message(title,body,rows=[],user=false,source="",alreadyLocalized=false){
  const T=s=>tr(s,language);if(!user){title=T(title);if(!alreadyLocalized)body=T(body);}

  const a=document.createElement("article");a.className=user?"cube-ai-user":"cube-ai-answer";
  const h=document.createElement("strong");h.className="cube-ai-message-title";if(!user){const avatar=document.createElement("span");avatar.className="cube-ai-mini-avatar";avatar.innerHTML=aiIcon("spark");h.append(avatar);}h.append(document.createTextNode(title));a.append(h);
  if(body){const p=document.createElement("p");p.textContent=body;a.append(p);}
  if(rows.length){const list=document.createElement("ul");for(const row of rows.slice(0,40)){const li=document.createElement("li");li.textContent=row;list.append(li);}a.append(list);if(rows.length>40){const p=document.createElement("p");p.textContent=T("Showing first 40 of")+" "+rows.length+" "+T("records. See reports for all records.");a.append(p);}}
  if(source&&source!=="Google Gemini · Free tier"){const meta=document.createElement("span");meta.className="cube-ai-source";meta.dataset.source=source.includes("Firebase")?"fleet":source.includes("Gemini")?"gemini":"local";meta.textContent=T(source);a.append(meta);}
  if(!user&&body){const copy=document.createElement("button");copy.type="button";copy.className="cube-ai-copy";copy.innerHTML=aiIcon("copy")+"<span>Copy</span>";copy.setAttribute("aria-label","Copy answer");copy.onclick=async()=>{try{await navigator.clipboard.writeText([title,body,...rows.slice(0,40)].join("\n"));copy.textContent="Copied";}catch{copy.textContent="Copy unavailable";}};a.append(copy);}
  log.append(a);log.scrollTop=log.scrollHeight;
 }
 function setOpen(open){panel.hidden=!open;launch.setAttribute("aria-expanded",String(open));if(open)input.focus({preventScroll:true});else launch.focus({preventScroll:true});}
 function setBusy(value){busy=value;panel.classList.toggle('cube-ai-busy',value);send.disabled=value;languageSelect.disabled=value;thinking.hidden=!value;for(const b of suggestions.querySelectorAll("button"))b.disabled=value;}
 function populate(){
  log.replaceChildren();suggestions.replaceChildren();input.value="";
  const d=getData();
  const hero=document.createElement("div");hero.className="cube-ai-welcome";hero.innerHTML='<div class="cube-ai-hero-visual"><div class="cube-ai-orbit cube-ai-orbit-one"></div><div class="cube-ai-orbit cube-ai-orbit-two"></div><span class="cube-ai-hero-orb" aria-hidden="true">'+aiIcon("spark")+'</span></div><span class="cube-ai-kicker">YOUR INTELLIGENT OPERATIONS PARTNER</span><h2>How can I <em>help you?</em></h2><p>Fleet insights, smarter decisions and everyday answers.<br>All in one conversation.</p>';log.append(hero);
  const quick=[["truck",questions.available,"Available vehicles","Check current fleet availability",false],["chart",questions.summary,"Monthly operations","Review trips and financials",true],["clock",questions.delayed,"Delayed trips","Identify overdue movements",false],["rank","Top 5 vehicles by margin this month","Top performers","Rank vehicles by profitability",true],["mail","Draft a professional logistics email","Write an email","Get help with communication",false],["spark","How can I improve fuel efficiency?","General intelligence","Ask for practical advice",false]];
  for(const [symbol,q,title,desc,restricted] of quick){if(restricted&&!d.canViewReports)continue;const b=document.createElement("button");b.type="button";b.setAttribute("aria-label",q);const icon=document.createElement("span");icon.className="cube-ai-prompt-icon";icon.innerHTML=aiIcon(symbol);const words=document.createElement("span");words.className="cube-ai-prompt-text";const name=document.createElement("strong");name.textContent=title;const detail=document.createElement("small");detail.textContent=desc;words.append(name,detail);b.append(icon,words);b.onclick=()=>ask(q);suggestions.append(b);}
  suggestions.hidden=false;panel.classList.add("cube-ai-welcome-state");
 }
 function clear(){generation++;setBusy(false);log.replaceChildren();input.value="";suggestions.replaceChildren();panel.hidden=true;panel.classList.remove("cube-ai-expanded");expand.setAttribute("aria-label","Expand assistant");expand.innerHTML=aiIcon("expand");launch.setAttribute("aria-expanded","false");}
 async function ask(q){
  if(busy||el.hidden||!q.trim()||!getData().authorized)return;
  const token=generation;setBusy(true);suggestions.hidden=true;panel.classList.remove("cube-ai-welcome-state");log.querySelector(".cube-ai-welcome")?.remove();message("You",q,[],true);
  const current=()=>token===generation&&!el.hidden&&getData().authorized;
  try{
   const data=getData(),scope=extractFleetScope(q,data);
   const route=routeQuestion(q);
   if(scope.privateQuestion||scope.ambiguous||scope.unknownVehicle||scope.unknownVendor){message("Please clarify your fleet question","Use one known vehicle or vendor, and remove credentials or private contact information.",[],false,"Privacy protection");return;}
   // Exact dashboard shortcuts keep existing behavior; richer queries use the local query tool.
   const exact=Object.values(questions).some(v=>clean(v)===clean(q));
   if(!exact){
    const plan=localPlan(q,scope);
    if(plan){const result=executePlan(plan,getData(),scope,Date.now(),language);if(result){message(result.title,result.body,result.rows,false,"Fleet analytics · Firebase records",true);return;}}
   }
   if((scope.vehicle||scope.vendor||scope.dates.length||route.kind==="fleet-unknown"||route.kind==="unsupported")&&!exact){
    // Only send a sanitized vocabulary; unknown date ranges, actions and private queries fail closed.
    const sanitized=plannerPrompt(q,scope);
    const allowed=route.kind==="fleet-unknown"&&!scope.dates.length&&!/\b(last|previous|next|yesterday|today|week|year|month|january|february|march|april|may|june|july|august|september|october|november|december|delete|edit|cancel|update|change|create|add|send|close|and|or|average|compare|forecast|predict|idle|empty|gps|payment|outstanding)\b/i.test(q)&&!/\d/.test(q);
    if(allowed&&fleetPlanner&&sanitized){const proposed=validatePlan(await fleetPlanner(sanitized));if(!current())return;if(proposed&&proposed.period==="thisMonth"){const result=executePlan(proposed,getData(),scope,Date.now(),language);if(result){message(result.title,result.body,result.rows,false,"Gemini query plan · Firebase records",true);return;}}}
    message("Fleet question needs clarification","Try a single metric, vehicle or vendor and a supported date range. I will not invent company figures or send your records to Gemini.",[],false,"Fleet analytics · Local");return;
   }
   if(route.kind==="blocked"){message("Private information","Please remove identifiers, credentials or personal details and ask again. No cloud request was sent.",[] ,false,"Privacy protection");return;}
   if(route.kind==="general"){
    const result=generalAI?await generalAI(q,language):{ok:false,text:"Gemini is not configured."};
    if(current())message(result.ok?"CUBE AI":"Gemini unavailable",result.text,[],false,result.ok?"":"Connection status",result.ok);return;
   }
   let intent=route.intent;
   if(route.kind==="fleet-unknown"&&cloudRouter){intent=await cloudRouter(q);if(!current())return;}
   if(!current())return;
   if(!intent){message("Fleet question not supported yet","I can retrieve current-month operations and current vehicle availability. Try asking for monthly margin, active trips or available vehicles. I won't guess your actual figures.",[],false,"Fleet analytics · Local");return;}
   const result=answer(intent,getData(),language);message(result.title,result.body,result.rows,false,"Fleet analytics · Firebase records",true);
  }catch{if(current())message("Unable to answer","Please try again.",[],false,"Connection status");}
  finally{if(token===generation)setBusy(false);}
 }
 function show(){clear();el.hidden=false;populate();}
 launch.onclick=()=>setOpen(panel.hidden);el.querySelector(".cube-ai-close").onclick=()=>setOpen(false);
 el.querySelector(".cube-ai-new").onclick=()=>{generation++;setBusy(false);populate();input.focus();};
 expand.onclick=()=>{const large=panel.classList.toggle("cube-ai-expanded");expand.setAttribute("aria-label",large?"Restore assistant":"Expand assistant");expand.innerHTML=aiIcon(large?"restore":"expand");};
 panel.addEventListener("keydown",e=>{if(e.key==="Escape"){e.stopPropagation();setOpen(false);}});
 input.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.isComposing){e.preventDefault();form.requestSubmit();}});
 form.addEventListener("submit",e=>{e.preventDefault();const q=input.value.trim();if(q&&!busy){input.value="";ask(q);}});
 return {show,hide(){clear();el.hidden=true;}};
}
