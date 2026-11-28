import {tr} from "./ai-language.mjs?v=1";
// Read-only query plans. Raw records and matched identifiers never leave this module.
const metrics=new Set(["trips","revenue","margin","expenses","fuel","toll","distance","weight","advance","balance","marginPercent","summary"]);
const periods=new Set(["today","yesterday","thisWeek","lastWeek","thisMonth","lastMonth","thisYear","lastYear","all","custom"]);
const statuses=new Set(["all","active","transit","completed","delayed","low","loading","unloading","cancelled"]);
const groups=new Set(["none","vehicle","vendor","route"]);
const actions=new Set(["sum","list","rankHigh","rankLow"]);
const n=v=>Number.isFinite(Number(v))?Number(v):0;
const fmt=v=>Number(v).toLocaleString("en-IN",{maximumFractionDigits:2});
const currency=new Set(["revenue","margin","expenses","fuel","toll","advance","balance"]);
const labels={trips:"Trips",revenue:"Freight revenue",margin:"Margin",expenses:"Total expenses",fuel:"Estimated fuel expenses",toll:"FASTag expenses",distance:"Trip distance",weight:"Load weight",advance:"Advance",balance:"Freight less advance",marginPercent:"Margin percentage",summary:"Operations summary"};
const normalized=v=>String(v??"").toLowerCase().replace(/[^a-z0-9]/g,"");
const day=(y,m,d)=>new Date(y,m,d).getTime();
const iso=(ms)=>new Date(ms).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"});
function dateValue(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return NaN;const [y,m,d]=s.split("-").map(Number),v=new Date(y,m-1,d);return v.getFullYear()===y&&v.getMonth()===m-1&&v.getDate()===d?v.getTime():NaN;}
function plusDay(ms){const d=new Date(ms);return day(d.getFullYear(),d.getMonth(),d.getDate()+1);}
export function periodBounds(period,now=Date.now(),from="",to=""){
 const d=new Date(now),y=d.getFullYear(),m=d.getMonth(),a=d.getDate(),weekday=(d.getDay()+6)%7;
 let start,end;
 switch(period){
 case "today":start=day(y,m,a);end=day(y,m,a+1);break;
 case "yesterday":start=day(y,m,a-1);end=day(y,m,a);break;
 case "thisWeek":start=day(y,m,a-weekday);end=day(y,m,a-weekday+7);break;
 case "lastWeek":start=day(y,m,a-weekday-7);end=day(y,m,a-weekday);break;
 case "lastMonth":start=day(y,m-1,1);end=day(y,m,1);break;
 case "thisYear":start=day(y,0,1);end=day(y+1,0,1);break;
 case "lastYear":start=day(y-1,0,1);end=day(y,0,1);break;
 case "all":return {start:0,end:Infinity,label:"All recorded dates"};
 case "custom":start=dateValue(from);end=plusDay(dateValue(to));break;
 default:start=day(y,m,1);end=day(y,m+1,1);
 }
 return Number.isFinite(start)&&Number.isFinite(end)&&end>start?{start,end,label:iso(start)+" – "+iso(end-1)}:null;
}
export function validatePlan(p){
 if(!p||!metrics.has(p.metric)||!periods.has(p.period)||!statuses.has(p.status)||!groups.has(p.group)||!actions.has(p.action))return null;
 if(p.action.startsWith("rank")&&p.group==="none")return null;
 if(p.metric==="summary"&&p.action!=="sum")return null;
 if(p.metric==="marginPercent"&&p.action==="list")return null;
 if(p.period==="custom"&&!periodBounds("custom",Date.now(),p.from,p.to))return null;
 return {metric:p.metric,period:p.period,status:p.status,group:p.group,action:p.action,limit:Math.max(1,Math.min(40,Number.isInteger(p.limit)?p.limit:10)),from:p.from||"",to:p.to||""};
}
function identify(q,values,allowSuffix=false){
 const compact=normalized(q);
 const full=values.filter(v=>normalized(v).length>=3&&compact.includes(normalized(v)));
 if(full.length)return [...new Set(full)];
 if(allowSuffix){const suffix=q.match(/\b(?:vehicle|truck|lorry)\s+(?:no\.?\s*)?(\d{3,4})\b/i)?.[1];if(suffix)return values.filter(v=>normalized(v).endsWith(suffix));}
 return [];
}
export function extractFleetScope(question,data){
 const q=String(question??"").trim(),trips=data?.allTrips||[];
 const vehicles=[...new Set([...(data?.vehicles||[]).map(v=>v.number),...trips.map(t=>t.vehicle)].filter(Boolean))];
 const vendors=[...new Set(trips.map(t=>t.vendor).filter(Boolean))];
 const vm=identify(q,vehicles,true),vd=identify(q,vendors);
 const dates=[...q.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)].map(x=>x[0]);
 const ambiguous=vm.length>1||vd.length>1;
 const unknownVehicle=/\b(?:vehicle|truck|lorry)\s+(?:no\.?\s*)?(?:[a-z]{2}\s*\d|\d{3,4}\b)/i.test(q)&&!vm.length;
 const unknownVendor=/\b(?:for|of|by)\s+vendor\s+\S+/i.test(q)&&!vd.length&&!/\b(by|vendor wise|vendor-wise|per vendor)\b/i.test(q.replace(/\bby vendor\b/i,""));
 const privateQuestion=/\b(password|api key|secret|otp|aadhaar|aadhar|bank account)\b/i.test(q)||/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i.test(q);
 return {vehicle:vm[0]||"",vendor:vd[0]||"",dates,ambiguous,unknownVehicle,unknownVendor,privateQuestion};
}
export function localPlan(question,scope={}){
 const raw=String(question??"").trim(),q=raw.toLowerCase();
 if(!q||scope.privateQuestion||scope.ambiguous||scope.unknownVehicle||scope.unknownVendor)return null;
 if(/\b(delete|edit|cancel|update|change|create|add|send|close)\b/i.test(q)&&!/\b(cancelled|canceled)\b/.test(q))return null;
 if(/\b(forecast|predict|next month|tomorrow|last \d+ days|average|median|trend|compare|per km|per kilometer|idle|empty|gps|payment status|paid|collection|outstanding)\b/i.test(q))return null;
 const specific=scope.vehicle||scope.vendor||/\b(our|my|cube|company|actual|recorded|today|yesterday|this month|last month|this week|last week|this year|last year|all time|all trips|monthly operations)\b/i.test(q)||/\b(show|list|total|which|how many|how much|highest|lowest|top|bottom)\b/i.test(q);
 if(!specific)return null;
 if(/^(what (is|are|does)|how (to|can|do|should)|why|explain|define|describe|write|draft|correct|translate|suggest)\b/i.test(q)&&!scope.vehicle&&!scope.vendor&&!/\b(our|my|cube|this month|last month|this week|last week|today|yesterday|this year|last year)\b/i.test(q))return null;
 if(/\b(which|how many|show|list)\b.*\b(available|free to load|can take a load)\b/i.test(q))return null;
 if(/\b(utilization|utilisation)\b/i.test(q))return null;
 const metric=/\bmargin\s*(%|percentage|percent)|\bprofit percentage\b/i.test(q)?"marginPercent":/\b(fuel|diesel)\s*(expense|expenses|cost|costs)\b/i.test(q)?"fuel":/\b(toll|fastag)\b/i.test(q)?"toll":/\b(balance)\b/i.test(q)?"balance":/\badvance\b/i.test(q)?"advance":/\b(revenue|freight|turnover)\b/i.test(q)?"revenue":/\b(margin|profit|loss)\b/i.test(q)?"margin":/\b(expenses?|costs?)\b/i.test(q)?"expenses":/\b(distance|kilometers?|kilometres?|km)\b/i.test(q)?"distance":/\b(weight|tons?|tonnes?)\b/i.test(q)?"weight":/\b(summary|performance|overview)\b/i.test(q)?"summary":/\b(trips?|placements?|loads?)\b/i.test(q)?"trips":null;
 if(!metric)return null;
 // Refuse compound metrics and unsupported date expressions rather than silently change scope.
 if(/\b(and|versus|vs)\b/i.test(q)&&!/\bbetween \d{4}-\d{2}-\d{2} and \d{4}-\d{2}-\d{2}\b/i.test(q))return null;
 let period=scope.dates?.length===2?"custom":scope.dates?.length===1?"custom":/\blast month\b/.test(q)?"lastMonth":/\blast week\b/.test(q)?"lastWeek":/\bthis week\b/.test(q)?"thisWeek":/\byesterday\b/.test(q)?"yesterday":/\btoday\b/.test(q)?"today":/\blast year\b/.test(q)?"lastYear":/\bthis year\b/.test(q)?"thisYear":/\b(all time|all dates|all trips ever)\b/.test(q)?"all":"thisMonth";
 if(/\b(january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}\/\d{1,2})\b/i.test(q)&&period!=="custom")return null;
 const status=/\b(delayed|overdue)\b/.test(q)?"delayed":/\b(low margin|loss making)\b/.test(q)?"low":/\b(completed|finished)\b/.test(q)?"completed":/\b(in transit|transit)\b/.test(q)?"transit":/\b(cancelled|canceled)\b/.test(q)?"cancelled":/\b(unloading)\b/.test(q)?"unloading":/\bloading\b/.test(q)?"loading":/\b(active|open)\b/.test(q)?"active":"all";
 const rank=/\b(top|highest|best|most profitable|lowest|bottom|worst|least)\b/.test(q);
 const group=/\b(vendor.wise|by vendor|per vendor|vendors)\b/.test(q)||rank&&/\bvendor\b/.test(q)?"vendor":/\b(route.wise|by route|per route|routes)\b/.test(q)?"route":/\b(vehicle.wise|by vehicle|per vehicle|trucks|vehicles)\b/.test(q)||rank&&/\b(vehicle|truck)\b/.test(q)?"vehicle":"none";
 let action=rank?( /\b(lowest|bottom|worst|least)\b/.test(q)?"rankLow":"rankHigh"):group!=="none"?"sum":/\b(list|show)\b.*\btrips\b/.test(q)&&metric==="trips"?"list":"sum";
 const limit=Number(q.match(/\b(?:top|bottom)\s+(\d{1,2})\b/)?.[1]||10);
 return validatePlan({metric,period,status,group,action,limit,from:scope.dates?.[0],to:scope.dates?.[1]||scope.dates?.[0]});
}
const safeWords=new Set("a about actual active all amount an and are as at available balance best bottom by cancelled cargo completed cost costs current data date day delayed diesel distance do does down each expense expenses fleet for freight from fuel get give group high highest how in is it last least list load loads loading low lowest margin month monthly most much now of on operations or overdue per percent percentage performance please profit profitable rank records report revenue route routes show status summary sum this to today toll top total transit trip trips truck trucks unloading utilization vendor vendors vehicle vehicles week weight what which wise worst year yesterday".split(" "));
export function plannerPrompt(question,scope){
 // Mask all unrecognized words and numbers. Do not send raw vehicle/vendor names, dates or other identifiers.
 let q=String(question??"").toLowerCase();
 for(const value of [scope.vehicle,scope.vendor].filter(Boolean))q=q.split(value.toLowerCase()).join(" ");
 const tokens=q.match(/[a-z]+/g)||[];
 return tokens.filter(w=>safeWords.has(w)).join(" ").slice(0,240);
}
export function executePlan(plan,data,scope={},now=Date.now(),language="en"){
 const T=s=>tr(s,language);
 if(!data?.authorized)return {title:T("Sign in required"),body:T("Sign in with an authorized account."),rows:[]};
 const p=validatePlan(plan);if(!p)return null;
 const financial=currency.has(p.metric)||p.metric==="marginPercent"||p.metric==="summary"||p.status==="low";
 if(financial&&!data.canViewReports)return {title:T("Restricted"),body:T("Your role does not allow financial reports."),rows:[]};
 if(!data.tripsReady||!Array.isArray(data.allTrips))return {title:T("Data not ready"),body:T("Wait for Firebase to synchronize and try again."),rows:[]};
 if(scope.ambiguous||scope.unknownVehicle||scope.unknownVendor||scope.privateQuestion)return null;
 const bounds=periodBounds(p.period,now,p.from,p.to);if(!bounds)return null;
 const rows=data.allTrips.filter(t=>{const time=n(t.createdAt);if(!(time>0&&time>=bounds.start&&time<bounds.end))return false;if(scope.vehicle&&t.vehicle!==scope.vehicle)return false;if(scope.vendor&&t.vendor!==scope.vendor)return false;
 switch(p.status){case "active":return t.isOpen===true;case "transit":return t.status==="In Transit";case "completed":return t.status==="Completed";case "cancelled":return /cancel/i.test(t.status||"");case "loading":return t.status==="Loading";case "unloading":return ["Reached","Unloading"].includes(t.status);case "delayed":return t.isOpen===true&&n(t.transitHours)>0&&time+n(t.transitHours)*3600000<now;case "low":return n(t.margin)<0||n(t.marginPercent)<n(data.minMarginPercent??10);default:return true;}});
 const value=(r)=>{if(p.metric==="trips")return r.length;if(p.metric==="marginPercent"){const f=r.reduce((s,t)=>s+n(t.freight),0);return f?r.reduce((s,t)=>s+n(t.margin),0)/f*100:0;}return r.reduce((s,t)=>s+({revenue:n(t.freight),margin:n(t.margin),expenses:n(t.totalExpenses),fuel:n(t.fuelExpense),toll:n(t.fastag),distance:n(t.totalKm),weight:n(t.weightTon),advance:n(t.advance),balance:n(t.freight)-n(t.advance)}[p.metric]||0),0);};
 const formatted=v=>(currency.has(p.metric)?"₹":"")+fmt(v)+(p.metric==="distance"?" km":p.metric==="weight"?" t":p.metric==="marginPercent"?"%":"");
 const scopeText=[T(bounds.label),scope.vehicle,scope.vendor,p.status!=="all"?T(p.status):""].filter(Boolean).join(" · ");
 const header={title:T(labels[p.metric]),body:scopeText+"\n"+T("Based on trip creation date")+" · "+rows.length+" "+T("matching trips."),rows:[]};
 if(!rows.length){header.body+="\n"+T("No matching records.");return header;}
 if(p.metric==="summary"){const sum=k=>rows.reduce((s,t)=>s+n(t[k]),0);header.body+="\n"+T("Revenue")+" ₹"+fmt(sum("freight"))+" · "+T("Margin")+" ₹"+fmt(sum("margin"))+" · "+T("Expenses")+" ₹"+fmt(sum("totalExpenses"));return header;}
 if(p.group!=="none"){const map=new Map();for(const t of rows){const key=p.group==="route"?[t.from,t.to].filter(Boolean).join(" → "):t[p.group];if(!key)continue;if(!map.has(key))map.set(key,[]);map.get(key).push(t);}const rank=[...map].map(([key,r])=>({key,value:value(r),count:r.length})).sort((a,b)=>p.action==="rankLow"?a.value-b.value:b.value-a.value);header.body+="\n"+rank.length+" "+T("groups")+" · "+T("showing")+" "+Math.min(p.limit,rank.length);header.rows=rank.slice(0,p.limit).map(x=>x.key+" · "+formatted(x.value)+" · "+x.count+" "+T("trips"));return header;}
 header.body+="\n"+T(labels[p.metric])+": "+formatted(value(rows));
 if(p.metric==="balance")header.body+=" ("+T("freight less advance; not verified outstanding receivables")+")";
 if(p.action==="list")header.rows=[...rows].sort((a,b)=>n(b.createdAt)-n(a.createdAt)).slice(0,40).map(t=>[t.tripNumber,t.vehicle,iso(n(t.createdAt)),T(t.status||"")].filter(Boolean).join(" · "));
 return header;
}
