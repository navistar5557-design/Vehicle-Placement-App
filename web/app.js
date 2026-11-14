import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getMessaging, getToken, onMessage, isSupported as messagingSupported } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  onSnapshot, query, orderBy, writeBatch
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA0AlvGWpiLa9D1aVbPEMuPcnI1M-DmCR4",
  authDomain: "cube-vehicle-placement.firebaseapp.com",
  projectId: "cube-vehicle-placement",
  storageBucket: "cube-vehicle-placement.firebasestorage.app"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = s => document.querySelector(s);
const money = n => new Intl.NumberFormat("en-IN",{maximumFractionDigits:0}).format(Number(n||0));
const dateTime = ms => ms ? new Date(ms).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"}) : "-";
const esc = v => String(v ?? "").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const uid = () => crypto.randomUUID ? crypto.randomUUID() : (Date.now()+"-"+Math.random().toString(16).slice(2));

let state = {
  user:null, profile:null, role:null,
  trips:[], vehicles:[], vendors:[], locations:[], fuelRate:100,
  page:"dashboard", unsubs:[], dashboardFilter:"thisWeek", dashboardFrom:"", dashboardTo:"", notifications:[]
};

function toast(msg){ const el=$("#toast"); el.textContent=msg; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"),2200); }
function setSync(text, ok=true){ const el=$("#syncState"); el.textContent=(ok?"● ":"● ")+text; el.style.color=ok?"#087A36":"#B42318"; }
function normalizeUsername(v){ return v.trim().toLowerCase().replace(/[^a-z0-9._-]/g,""); }
function loginIdentity(v){ const s=v.trim(); return s.includes("@") ? s : normalizeUsername(s)+"@cube.internal"; }
function isAdmin(){ return !!(state.role?.canManageUsers && state.role?.canManageMasters); }
function canManageMasters(){ return !!state.role?.canManageMasters; }
function canCreateTrips(){ return !!state.role?.canCreateTrips; }
function canDeleteTrips(){ return !!state.role?.canDeleteTrips; }
function tokenDocId(token,platform){
  let hash=5381;
  for(let i=0;i<token.length;i++) hash=((hash<<5)+hash)^token.charCodeAt(i);
  return `${state.profile?.uid||"anon"}_${platform}_${(hash>>>0).toString(16)}`;
}
function visibleNotification(n){
  if(!state.profile) return false;
  if(n.target==="all" || !n.target) return true;
  if(Array.isArray(n.targetUids) && n.targetUids.includes(state.profile.uid)) return true;
  if(Array.isArray(n.targetRoles) && n.targetRoles.includes(state.profile.roleId)) return true;
  return false;
}
function updateNotificationBadge(){
  const badge=$("#notificationBadge"); if(!badge) return;
  const lastSeen=Number(localStorage.getItem("cube_notifications_seen_at")||0);
  const unread=state.notifications.filter(n=>Number(n.createdAt||0)>lastSeen).length;
  badge.textContent=String(Math.min(unread,99));
  badge.classList.toggle("hidden",unread===0);
}
async function createLiveNotification(title,body,tripId="",type="general"){
  const id=uid();
  await setDoc(doc(db,"notifications",id),{
    id,title,body,tripId,type,target:"all",
    createdAt:Date.now(),
    createdBy:state.profile?.username||"User",
    createdByUid:state.profile?.uid||""
  });
}

function calcTrip(t){
  const freight=Number(t.freight||0), weight=Number(t.weightTon||0), km=Number(t.totalKm||0), mileage=Number(t.mileage||0), fuelRate=Number(t.fuelRate||0);
  const pct=(t.expenseRules||[]).reduce((s,r)=>s+freight*Number(r.percent||0)/100,0);
  const fuel=mileage>0?(km/mileage)*fuelRate:0;
  const load=Number(t.loadingExpensePerTon||0)*weight, unload=Number(t.unloadingExpensePerTon||0)*weight;
  const exp=pct+fuel+Number(t.fixedExpenses||0)+Number(t.fastag||0)+Number(t.rtoTarpaulin||0)+Number(t.loadingUnloading||0)+load+unload;
  const margin=freight-exp;
  return {...t,totalExpenses:exp,margin,marginPercent:freight?margin/freight*100:0,fuelExpense:fuel};
}

async function loadProfile(user){
  const userDoc=await getDoc(doc(db,"users",user.uid));
  if(!userDoc.exists()) throw new Error("This account is not authorized.");
  const p=userDoc.data();
  if(p.active===false) throw new Error("This user account is inactive.");
  const roleId=p.roleId||p.role||"user";
  const roleDoc=await getDoc(doc(db,"roles",roleId));
  const role=roleDoc.exists()?roleDoc.data():{id:roleId,name:roleId,canCreateTrips:true,canManageMasters:false,canDeleteTrips:false,canViewReports:true,canManageUsers:false};
  state.profile={uid:user.uid,username:p.username||user.email?.split("@")[0]||"user",loginEmail:p.loginEmail||p.email||user.email||"",roleId};
  state.role=role;
}

function startLiveSync(){
  state.unsubs.forEach(f=>f()); state.unsubs=[];
  setSync("Connecting...");
  const watch=(name,cb)=>state.unsubs.push(onSnapshot(collection(db,name),snap=>{cb(snap.docs.map(d=>({id:d.id,...d.data()}))); setSync("Live Sync"); render();},err=>{console.error(err);setSync("Sync error",false);}));
  watch("trips",rows=>state.trips=rows.map(calcTrip).sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0)));
  watch("vehicles",rows=>state.vehicles=rows.map(x=>({number:x.number||x.id,mileage:Number(x.mileage||0),active:x.active!==false})).sort((a,b)=>a.number.localeCompare(b.number)));
  watch("vendors",rows=>state.vendors=rows.map(x=>({name:x.name||x.id,active:x.active!==false})).sort((a,b)=>a.name.localeCompare(b.name)));
  watch("locations",rows=>state.locations=rows.map(x=>({name:x.name||x.id,active:x.active!==false})).sort((a,b)=>a.name.localeCompare(b.name)));
  state.unsubs.push(onSnapshot(doc(db,"settings","fuelRate"),d=>{ if(d.exists()) state.fuelRate=Number(d.data().value||100); render(); }));
  state.unsubs.push(onSnapshot(collection(db,"notifications"),snap=>{
    state.notifications=snap.docs.map(d=>({id:d.id,...d.data()})).filter(visibleNotification).sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0)).slice(0,50);
    updateNotificationBadge();
  },err=>console.warn("Notifications listener unavailable",err)));
}

function showApp(){
  $("#loginView").classList.add("hidden"); $("#appView").classList.remove("hidden");
  const avatar=$("#topAvatar"); if(avatar) avatar.textContent=(state.profile.username||"CU").trim().slice(0,2).toUpperCase();
  const topUserName=$("#topUserName"); if(topUserName) topUserName.textContent=state.profile.username||"User";
  const topUserRole=$("#topUserRole"); if(topUserRole) topUserRole.textContent=state.role.name||state.profile.roleId||"User";
  const newTripBtn=document.querySelector('[data-page="newtrip"]'); if(newTripBtn) newTripBtn.style.display=canCreateTrips()?"":"none";
  ["vehicles","vendors","locations"].forEach(p=>{const b=document.querySelector(`[data-page="${p}"]`);if(b)b.style.display=canManageMasters()?"":"none";});
  startLiveSync(); navigate("dashboard");
}
function showLogin(){ $("#appView").classList.add("hidden"); $("#loginView").classList.remove("hidden"); }
async function enableBrowserPush(){
  if(!("Notification" in window) || !("serviceWorker" in navigator)){ toast("Browser push is not supported here"); return; }
  if(!(await messagingSupported())){ toast("Firebase browser messaging is not supported here"); return; }
  const cfg=await getDoc(doc(db,"settings","webPush"));
  const vapidKey=cfg.exists()?String(cfg.data().vapidKey||""):"";
  if(!vapidKey){ toast("Web Push key is not configured in Firebase yet"); return; }
  const permission=await Notification.requestPermission();
  if(permission!=="granted"){ toast("Notification permission was not granted"); return; }
  const sw=await navigator.serviceWorker.register("./firebase-messaging-sw.js");
  const messaging=getMessaging(app);
  const token=await getToken(messaging,{vapidKey,serviceWorkerRegistration:sw});
  if(!token){ toast("Unable to register browser notifications"); return; }
  await setDoc(doc(db,"deviceTokens",tokenDocId(token,"web")),{
    uid:state.profile.uid,username:state.profile.username,platform:"web",token,active:true,updatedAt:Date.now()
  },{merge:true});
  onMessage(messaging,payload=>{
    const title=payload.notification?.title||payload.data?.title||"CUBE Logistics";
    const body=payload.notification?.body||payload.data?.body||"New update";
    toast(title+": "+body);
  });
  toast("Browser push notifications enabled");
}
function openNotificationCenter(){
  localStorage.setItem("cube_notifications_seen_at",String(Date.now()));
  updateNotificationBadge();
  const rows=state.notifications.slice(0,20);
  const body=`
    <div class="notification-center-note">Live notifications are synced through Firebase while you are signed in.</div>
    ${rows.length?`<div class="notification-list">${rows.map(n=>`<div class="notification-item">
      <div class="notification-item-icon">🔔</div>
      <div><strong>${esc(n.title||"CUBE Logistics")}</strong><p>${esc(n.body||"")}</p><small>${esc(dateTime(n.createdAt))}</small></div>
    </div>`).join("")}</div>`:'<div class="empty">No notifications yet.</div>'}
  `;
  modal("Notifications",body);
}

$("#togglePassword").addEventListener("click",()=>{ const p=$("#loginPass"); p.type=p.type==="password"?"text":"password"; $("#togglePassword").setAttribute("aria-label", p.type==="password"?"Show password":"Hide password"); });
$("#loginForm").addEventListener("submit",async e=>{
  e.preventDefault(); $("#loginError").textContent="";
  const identity=$("#loginUser").value.trim(), pass=$("#loginPass").value;
  try{
    await signInWithEmailAndPassword(auth,loginIdentity(identity),pass);
    if($("#rememberUser").checked) localStorage.setItem("cube_web_username",identity); else localStorage.removeItem("cube_web_username");
  }catch(err){ $("#loginError").textContent="Login failed. Please check your User ID and password."; console.error(err); }
});
$("#loginUser").value=localStorage.getItem("cube_web_username")||"";

onAuthStateChanged(auth,async user=>{
  state.user=user;
  if(!user){state.profile=null;state.role=null;state.unsubs.forEach(f=>f());state.unsubs=[];showLogin();return;}
  try{await loadProfile(user);showApp();}catch(e){await signOut(auth);$("#loginError").textContent=e.message;}
});
$("#logoutBtn").addEventListener("click",()=>signOut(auth));
$("#notificationBtn")?.addEventListener("click",openNotificationCenter);
$("#refreshBtn").addEventListener("click",()=>{setSync("Refreshing...");state.unsubs.forEach(f=>f());startLiveSync();toast("Live data refreshed");});
$("#globalSearch")?.addEventListener("keydown",e=>{
  if(e.key==="Enter" && e.currentTarget.value.trim()){
    const q=e.currentTarget.value.trim();
    navigate("trips");
    setTimeout(()=>{const box=$("#tripSearch");if(box){box.value=q;box.dispatchEvent(new Event("input"));}},0);
  }
});
document.addEventListener("keydown",e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();$("#globalSearch")?.focus();}
});
$("#menuBtn").addEventListener("click",()=>$("#menuBtn").setAttribute("aria-expanded",$(".sidebar").classList.toggle("open")));
$("#nav").addEventListener("click",e=>{const b=e.target.closest("[data-page]");if(b)navigate(b.dataset.page);});

function navigate(page){
  state.page=page;
  document.querySelectorAll("#nav button").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  $(".sidebar").classList.remove("open"); $("#menuBtn").setAttribute("aria-expanded","false");
  const hour=new Date().getHours();
  const greet=hour<12?"Good Morning":hour<17?"Good Afternoon":"Good Evening";
  const titles={dashboard:[`${greet}, ${state.profile?.username||"User"} 👋`,"Here is your fleet & placement overview."],trips:["Trips","Live trip placement and status"],newtrip:["Create Trip","Add a new vehicle placement"],vehicles:["Vehicles","Vehicle master"],vendors:["Vendors","Vendor master"],locations:["Locations","Location master"],reports:["Reports","Operational and profitability summary"]};
  $("#pageTitle").textContent=titles[page]?.[0]||"CUBE";$("#pageSubtitle").textContent=titles[page]?.[1]||"";
  render();
}

function render(){
  if(!state.profile)return;
  const root=$("#pageContent");
  if(state.page==="dashboard"){root.innerHTML=dashboardHtml();wireDashboard();}
  if(state.page==="trips"){root.innerHTML=tripsHtml();wireTrips();}
  if(state.page==="newtrip"){root.innerHTML=newTripHtml();wireNewTrip();}
  if(state.page==="vehicles"){root.innerHTML=masterHtml("vehicles");wireMaster("vehicles");}
  if(state.page==="vendors"){root.innerHTML=masterHtml("vendors");wireMaster("vendors");}
  if(state.page==="locations"){root.innerHTML=masterHtml("locations");wireMaster("locations");}
  if(state.page==="reports")root.innerHTML=reportsHtml();
  root.classList.remove("page-enter");
  requestAnimationFrame(()=>requestAnimationFrame(()=>root.classList.add("page-enter")));
}

function getDashboardRange(){
  const now=new Date(); now.setHours(23,59,59,999);
  const startOfDay=d=>{const x=new Date(d);x.setHours(0,0,0,0);return x};
  const endOfDay=d=>{const x=new Date(d);x.setHours(23,59,59,999);return x};
  let start,end=now,label="This Week";
  if(state.dashboardFilter==="yesterday"){
    const d=new Date();d.setDate(d.getDate()-1);start=startOfDay(d);end=endOfDay(d);label="Yesterday";
  }else if(state.dashboardFilter==="last7"){
    const d=new Date();d.setDate(d.getDate()-6);start=startOfDay(d);label="Last 7 Days";
  }else if(state.dashboardFilter==="lastWeek"){
    const d=new Date();const day=d.getDay()||7;d.setDate(d.getDate()-day-6);start=startOfDay(d);end=new Date(start);end.setDate(end.getDate()+6);end=endOfDay(end);label="Last Week";
  }else if(state.dashboardFilter==="thisMonth"){
    start=new Date(now.getFullYear(),now.getMonth(),1);label="This Month";
  }else if(state.dashboardFilter==="lastMonth"){
    start=new Date(now.getFullYear(),now.getMonth()-1,1);end=new Date(now.getFullYear(),now.getMonth(),0,23,59,59,999);label="Last Month";
  }else if(state.dashboardFilter==="custom" && state.dashboardFrom && state.dashboardTo){
    start=startOfDay(new Date(state.dashboardFrom+"T00:00:00"));end=endOfDay(new Date(state.dashboardTo+"T00:00:00"));label="Custom Range";
  }else{
    const d=new Date();const day=d.getDay()||7;d.setDate(d.getDate()-day+1);start=startOfDay(d);label="This Week";
  }
  return {start:start.getTime(),end:end.getTime(),label};
}

function dashboardTrendBuckets(trips,startMs,endMs){
  const start=new Date(startMs),end=new Date(endMs);
  const days=Math.max(1,Math.ceil((end-start)/86400000)+1);
  const bucketCount=Math.min(7,days);
  const span=(endMs-startMs+1)/bucketCount;
  return Array.from({length:bucketCount},(_,i)=>{
    const bs=startMs+i*span;
    const be=i===bucketCount-1?endMs:startMs+(i+1)*span-1;
    const rows=trips.filter(t=>Number(t.createdAt||0)>=bs&&Number(t.createdAt||0)<=be);
    const d=new Date(bs);
    const e=new Date(be);
    const label=days<=7?d.toLocaleDateString("en-IN",{day:"2-digit",month:"short"}):(`${d.toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}-${e.toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}`);
    return {label,count:rows.length,margin:rows.reduce((s,t)=>s+Number(t.margin||0),0)};
  });
}

function dashboardHtml(){
  const range=getDashboardRange();
  const trips=state.trips.filter(t=>Number(t.createdAt||0)>=range.start&&Number(t.createdAt||0)<=range.end);
  const activeVehicles=state.vehicles.filter(v=>v.active!==false);
  const placed=trips.filter(t=>(t.status||"Vehicle Placed")==="Vehicle Placed").length;
  const transit=trips.filter(t=>t.status==="In Transit").length;
  const completed=trips.filter(t=>t.status==="Completed").length;
  const freight=trips.reduce((s,t)=>s+Number(t.freight||0),0);
  const margin=trips.reduce((s,t)=>s+Number(t.margin||0),0);
  const marginPct=freight?margin/freight*100:0;

  const activeVehicleNos=new Set(
    trips.filter(t=>["Vehicle Placed","In Transit"].includes(t.status||"Vehicle Placed"))
      .map(t=>t.vehicle).filter(Boolean)
  );
  const inTrip=Math.min(activeVehicleNos.size,activeVehicles.length);
  const idle=Math.max(activeVehicles.length-inTrip,0);
  const utilization=activeVehicles.length?Math.round(inTrip/activeVehicles.length*100):0;

  const today=new Date(); today.setHours(0,0,0,0);
  const completedToday=trips.filter(t=>t.status==="Completed" && Number(t.statusUpdatedAt||0)>=today.getTime()).length;
  const delayed=trips.filter(t=>{
    if(t.status==="Completed") return false;
    const hrs=Number(t.transitHours||0);
    return hrs>0 && Number(t.createdAt||0)+hrs*3600000 < Date.now();
  }).length;

  const compact=n=>{
    n=Number(n||0);
    if(Math.abs(n)>=10000000)return "₹ "+(n/10000000).toFixed(2)+" Cr";
    if(Math.abs(n)>=100000)return "₹ "+(n/100000).toFixed(2)+" L";
    return "₹ "+money(n);
  };

  const days=dashboardTrendBuckets(trips,range.start,range.end);
  const maxCount=Math.max(1,...days.map(d=>d.count));
  const maxMargin=Math.max(1,...days.map(d=>Math.abs(d.margin)));
  const plot={left:48,right:680,top:18,bottom:158};
  const step=(plot.right-plot.left)/(days.length-1);
  const yCount=v=>plot.bottom-(v/maxCount)*(plot.bottom-plot.top);
  const yMargin=v=>plot.bottom-(Math.abs(v)/maxMargin)*(plot.bottom-plot.top);
  const linePoints=days.map((d,i)=>`${plot.left+i*step},${yMargin(d.margin)}`).join(" ");
  const countTicks=[0,.25,.5,.75,1].map(p=>Math.round(maxCount*p));
  const chartBars=days.map((d,i)=>{
    const x=plot.left+i*step-17;
    const y=yCount(d.count);
    const h=Math.max(2,plot.bottom-y);
    const dotY=yMargin(d.margin);
    return `<g class="trend-svg-day" tabindex="0" role="button" data-start="${Math.floor(range.start+i*((range.end-range.start+1)/days.length))}" data-end="${Math.floor(i===days.length-1?range.end:range.start+(i+1)*((range.end-range.start+1)/days.length)-1)}" aria-label="${esc(d.label)}: ${d.count} trips">
      <rect class="trend-svg-hit" x="${Math.max(0,x-16)}" y="8" width="66" height="172" rx="8"></rect>
      <rect class="trend-svg-bar" x="${x}" y="${plot.bottom-h}" width="34" height="${h}" rx="7">
        <title>${esc(d.label)} — ${d.count} trips</title>
      </rect>
      <circle class="trend-svg-dot" cx="${plot.left+i*step}" cy="${dotY}" r="5">
        <title>${esc(d.label)} — Margin ₹${money(d.margin)}</title>
      </circle>
      <text class="trend-svg-label" x="${plot.left+i*step}" y="178" text-anchor="middle">${esc(d.label)}</text>
    </g>`;
  }).join("");
  const chartGrid=countTicks.map(v=>{
    const y=yCount(v);
    return `<g><line class="trend-gridline" x1="48" x2="680" y1="${y}" y2="${y}"/><text class="trend-y-label" x="40" y="${y+4}" text-anchor="end">${v}</text></g>`;
  }).join("");
  const chartHtml=`<svg class="trend-svg" viewBox="0 0 700 190" preserveAspectRatio="none" role="img" aria-label="Seven day trip and margin trend">
      <defs>
        <linearGradient id="tripBarGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#2f8cff"/><stop offset="100%" stop-color="#0d4e9b"/>
        </linearGradient>
        <filter id="trendGlow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      ${chartGrid}
      <polyline class="trend-svg-line" points="${linePoints}"/>
      ${chartBars}
    </svg>`;

  const hour=new Date().getHours();
  const greeting=hour<12?"Good Morning":hour<17?"Good Afternoon":"Good Evening";

  return `
  <section class="dashboard-filterbar">
    <div class="filter-title"><strong>Dashboard Period</strong><span>${esc(range.label)}</span></div>
    <div class="filter-controls">
      <select id="dashboardRange">
        <option value="thisWeek" ${state.dashboardFilter==="thisWeek"?"selected":""}>This Week</option>
        <option value="lastWeek" ${state.dashboardFilter==="lastWeek"?"selected":""}>Last Week</option>
        <option value="last7" ${state.dashboardFilter==="last7"?"selected":""}>Last 7 Days</option>
        <option value="yesterday" ${state.dashboardFilter==="yesterday"?"selected":""}>Yesterday</option>
        <option value="thisMonth" ${state.dashboardFilter==="thisMonth"?"selected":""}>This Month</option>
        <option value="lastMonth" ${state.dashboardFilter==="lastMonth"?"selected":""}>Last Month</option>
        <option value="custom" ${state.dashboardFilter==="custom"?"selected":""}>Custom Range</option>
      </select>
      <div id="customRangeFields" class="custom-range-fields ${state.dashboardFilter==="custom"?"":"hidden"}">
        <label>From <input id="dashboardFrom" type="date" value="${esc(state.dashboardFrom)}"></label>
        <label>To <input id="dashboardTo" type="date" value="${esc(state.dashboardTo)}"></label>
        <button id="applyDashboardRange" class="primary" type="button">Apply</button>
      </div>
    </div>
  </section>

  <section class="neo-kpis">
    <article class="neo-kpi cyan" role="button" tabindex="0" data-kpi="vehicles" aria-label="View vehicle details">
      <img src="./icon-vehicle.svg" alt="" />
      <div><span>Total Vehicles</span><strong>${activeVehicles.length}</strong><small>Active fleet</small></div>
    </article>
    <article class="neo-kpi purple" role="button" tabindex="0" data-kpi="trips" aria-label="View trip details">
      <img src="./icon-trips.svg" alt="" />
      <div><span>Total Trips</span><strong>${trips.length}</strong><small>${placed+transit} currently active</small></div>
    </article>
    <article class="neo-kpi orange" role="button" tabindex="0" data-kpi="revenue" aria-label="View revenue details">
      <img src="./icon-revenue.svg" alt="" />
      <div><span>Total Revenue</span><strong>${compact(freight)}</strong><small>Freight amount</small></div>
    </article>
    <article class="neo-kpi green" role="button" tabindex="0" data-kpi="margin" aria-label="View margin details">
      <img src="./icon-margin.svg" alt="" />
      <div><span>Vehicle Margin</span><strong>${compact(margin)}</strong><small>${marginPct.toFixed(1)}% of revenue</small></div>
    </article>
  </section>

  <section class="neo-dashboard-grid">
    <article class="neo-panel trend-panel">
      <div class="panel-title"><span>▥</span><h3>Vehicle Placement Trend</h3><div class="legend"><i class="cyan-dot"></i> Trips <i class="purple-dot"></i> Margin</div></div>
      <div class="trend-chart">${chartHtml}</div>
    </article>

    <article class="neo-panel quick-panel">
      <div class="panel-title"><span>⚡</span><h3>Quick Actions</h3></div>
      <div class="quick-grid">
        <button class="quick-action green" onclick="document.querySelector('[data-page=newtrip]').click()"><b>＋</b><span>New Trip</span></button>
        <button class="quick-action cyan" onclick="document.querySelector('[data-page=vehicles]').click()"><b>🚚</b><span>Add Vehicle</span></button>
        <button class="quick-action red" onclick="document.querySelector('[data-page=locations]').click()"><b class="location-pin" aria-hidden="true"><span></span></b><span>Add Location</span></button>
        <button class="quick-action orange" onclick="document.querySelector('[data-page=reports]').click()"><b>▥</b><span>View Reports</span></button>
      </div>
    </article>

    <article class="neo-panel utilization-panel">
      <div class="panel-title"><span>◎</span><h3>Fleet Utilization</h3></div>
      <div class="util-body">
        <div class="gauge" data-target="${utilization}" style="--target:${utilization};--gauge-progress:0">
          <span class="gauge-orbit orbit-one"></span>
          <span class="gauge-orbit orbit-two"></span>
          <span class="gauge-sheen"></span>
          <div><strong class="util-counter" data-target="${utilization}">0%</strong><span>Utilization</span></div>
        </div>
        <div class="util-list">
          <p class="util-row in-trip"><i class="cyan-dot"></i><span>In Trip</span><b class="util-number" data-target="${inTrip}">0</b></p>
          <p class="util-row available"><i class="orange-dot"></i><span>Available</span><b class="util-number" data-target="${idle}">0</b></p>
        </div>
      </div>
    </article>

    <article class="neo-panel recent-panel">
      <div class="panel-title"><span>🚚</span><h3>Recent Trips</h3><button class="text-link" onclick="document.querySelector('[data-page=trips]').click()">View All →</button></div>
      <div class="neo-trip-table">
        <div class="neo-trip-head"><span>Vehicle No.</span><span>From</span><span>To</span><span>Load (T)</span><span>Status</span><span>Margin</span></div>
        ${trips.slice(0,5).map(t=>`<div class="neo-trip-row"><span class="vehicle-cell">🚚 ${esc(t.vehicle||"-")}</span><span>${esc(t.from||"-")}</span><span>${esc(t.to||"-")}</span><span>${Number(t.weightTon||0).toFixed(1)}</span><span>${statusBadge(t.status)}</span><strong>₹ ${money(t.margin)}</strong></div>`).join("") || '<div class="empty">No recent trips</div>'}
      </div>
    </article>

    <article class="neo-panel alerts-panel">
      <div class="panel-title"><span>🔔</span><h3>Alerts & Updates</h3></div>
      <div class="alerts-list">
        <div class="alert-row green"><b>✓</b><span>${completedToday} Trips Completed Today</span><em>›</em></div>
        <div class="alert-row orange"><b>🚚</b><span>${placed} Vehicles Placed</span><em>›</em></div>
        <div class="alert-row cyan"><b>➜</b><span>${transit} Vehicles In Transit</span><em>›</em></div>
        ${delayed? `<div class="alert-row purple"><b>!</b><span>${delayed} Trip${delayed>1?"s":""} Delayed</span><em>›</em></div>`:""}
      </div>
    </article>
  </section>`;
}

function wireDashboard(){
  let selectedTrendGroup=null;
  const setTrendFocus=(group,persist=false)=>{
    const groups=[...document.querySelectorAll(".trend-svg-day")];
    groups.forEach(g=>{
      const active=g===group;
      g.classList.toggle("trend-active",active);
      g.classList.toggle("trend-muted",!!group&&!active);
    });
    if(persist) selectedTrendGroup=group;
  };
  const clearTrendHover=(group)=>{
    if(selectedTrendGroup){ setTrendFocus(selectedTrendGroup,false); return; }
    if(group?.classList.contains("trend-active")) return;
    document.querySelectorAll(".trend-svg-day").forEach(g=>g.classList.remove("trend-active","trend-muted"));
  };
  const rangeSelect=$("#dashboardRange");
  if(rangeSelect){
    rangeSelect.addEventListener("change",e=>{
      state.dashboardFilter=e.target.value;
      if(state.dashboardFilter!=="custom"){render();}
      else $("#customRangeFields")?.classList.remove("hidden");
    });
  }
  $("#applyDashboardRange")?.addEventListener("click",()=>{
    const from=$("#dashboardFrom")?.value||"",to=$("#dashboardTo")?.value||"";
    if(!from||!to){toast("Select From and To dates");return;}
    if(new Date(from)>new Date(to)){toast("From date cannot be after To date");return;}
    state.dashboardFrom=from;state.dashboardTo=to;state.dashboardFilter="custom";render();
  });
  const openTrendDay=(group)=>{
    const start=Number(group.dataset.start||0),end=Number(group.dataset.end||0);
    const rows=state.trips.filter(t=>Number(t.createdAt||0)>=start&&Number(t.createdAt||0)<=end).sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0));
    const freight=rows.reduce((s,t)=>s+Number(t.freight||0),0);
    const margin=rows.reduce((s,t)=>s+Number(t.margin||0),0);
    const label=group.getAttribute("aria-label")?.split(":")[0]||"Selected Period";
    modal(label+" Details", `
      <div class="mini-summary day-summary">
        <div><span>Trips</span><strong>${rows.length}</strong></div>
        <div><span>Freight</span><strong>₹ ${money(freight)}</strong></div>
        <div><span>Margin</span><strong>₹ ${money(margin)}</strong></div>
      </div>
      ${rows.length?`<div class="mini-list">${rows.map(t=>`<div class="mini-row"><div><strong>${esc(t.vehicle||"-")}</strong><small>${esc(t.from||"-")} → ${esc(t.to||"-")}</small></div><span>${statusBadge(t.status)}</span></div>`).join("")}</div>`:'<div class="empty">No trips for this day.</div>'}
    `);
  };
  const gauge=document.querySelector(".gauge[data-target]");
  if(gauge){
    const target=Math.max(0,Math.min(100,Number(gauge.dataset.target||0)));
    requestAnimationFrame(()=>requestAnimationFrame(()=>gauge.style.setProperty("--gauge-progress",String(target))));
    const start=performance.now(),duration=1100;
    const tick=now=>{
      const p=Math.min(1,(now-start)/duration);
      const eased=1-Math.pow(1-p,3);
      const value=Math.round(target*eased);
      const counter=gauge.querySelector(".util-counter");
      if(counter) counter.textContent=value+"%";
      if(p<1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  document.querySelectorAll(".util-number[data-target]").forEach(el=>{
    const target=Math.max(0,Number(el.dataset.target||0));
    const start=performance.now(),duration=850;
    const tick=now=>{
      const p=Math.min(1,(now-start)/duration);
      const eased=1-Math.pow(1-p,3);
      el.textContent=String(Math.round(target*eased));
      if(p<1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  document.querySelectorAll(".trend-svg-day").forEach(group=>{
    group.addEventListener("mouseenter",()=>setTrendFocus(group,false));
    group.addEventListener("mouseleave",()=>clearTrendHover(group));
    group.addEventListener("focus",()=>setTrendFocus(group,false));
    group.addEventListener("blur",()=>clearTrendHover(group));
    group.addEventListener("click",()=>{setTrendFocus(group,true);openTrendDay(group);});
    group.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setTrendFocus(group,true);openTrendDay(group);}});
  });

  const openKpi=(type)=>{
    const trips=state.trips;
    if(type==="vehicles"){
      const rows=state.vehicles.filter(v=>v.active!==false).slice(0,10);
      modal("Active Vehicles", rows.length ? `<div class="mini-list">${rows.map(v=>`<div class="mini-row"><strong>${esc(v.number)}</strong><span>${Number(v.mileage||0).toFixed(1)} km/L</span></div>`).join("")}</div><p class="note">Showing ${rows.length} of ${state.vehicles.filter(v=>v.active!==false).length} active vehicles.</p>` : '<div class="empty">No active vehicles.</div>');
      return;
    }
    if(type==="trips"){
      const rows=trips.slice(0,8);
      modal("Trip Overview", rows.length ? `<div class="mini-list">${rows.map(t=>`<div class="mini-row"><div><strong>${esc(t.vehicle||"-")}</strong><small>${esc(t.from||"-")} → ${esc(t.to||"-")}</small></div><span>${statusBadge(t.status)}</span></div>`).join("")}</div>` : '<div class="empty">No trips available.</div>');
      return;
    }
    if(type==="revenue"){
      const total=trips.reduce((s,t)=>s+Number(t.freight||0),0);
      const rows=[...trips].sort((a,b)=>Number(b.freight||0)-Number(a.freight||0)).slice(0,8);
      modal("Revenue Details", `<div class="mini-summary"><span>Total Freight Revenue</span><strong>₹ ${money(total)}</strong></div><div class="mini-list">${rows.map(t=>`<div class="mini-row"><div><strong>${esc(t.vehicle||"-")}</strong><small>${esc(t.from||"-")} → ${esc(t.to||"-")}</small></div><span>₹ ${money(t.freight)}</span></div>`).join("")}</div>`);
      return;
    }
    if(type==="margin"){
      const total=trips.reduce((s,t)=>s+Number(t.margin||0),0);
      const freight=trips.reduce((s,t)=>s+Number(t.freight||0),0);
      const pct=freight?total/freight*100:0;
      const rows=[...trips].sort((a,b)=>Number(b.margin||0)-Number(a.margin||0)).slice(0,8);
      modal("Margin Details", `<div class="mini-summary"><span>Total Vehicle Margin</span><strong>₹ ${money(total)} <small>(${pct.toFixed(1)}%)</small></strong></div><div class="mini-list">${rows.map(t=>`<div class="mini-row"><div><strong>${esc(t.vehicle||"-")}</strong><small>${esc(t.from||"-")} → ${esc(t.to||"-")}</small></div><span>₹ ${money(t.margin)}</span></div>`).join("")}</div>`);
    }
  };
  document.querySelectorAll(".neo-kpi[data-kpi]").forEach(card=>{
    card.addEventListener("click",()=>openKpi(card.dataset.kpi));
    card.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openKpi(card.dataset.kpi);}});
  });
}

function statusBadge(s){const c=s==="Completed"?"completed":s==="In Transit"?"transit":"placed";return `<span class="badge ${c}">${esc(s||"Vehicle Placed")}</span>`;}
function tripTable(rows,actions=true){
 if(!rows.length)return '<div class="card empty">No trips available.</div>';
 return `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Vehicle</th><th>Route</th><th>Vendor</th><th>Status</th><th>Freight</th><th>Margin</th><th>Audit</th>${actions?"<th>Actions</th>":""}</tr></thead><tbody>${rows.map(t=>`<tr>
 <td>${esc(dateTime(t.createdAt))}</td><td><strong>${esc(t.vehicle)}</strong></td><td>${esc(t.from)} → ${esc(t.to)}</td><td>${esc(t.vendor)}</td><td>${statusBadge(t.status)}</td>
 <td>₹ ${money(t.freight)}</td><td>₹ ${money(t.margin)} (${Number(t.marginPercent||0).toFixed(1)}%)</td>
 <td><div class="audit">Created: ${esc(t.createdBy||t.createdByEmail||"Legacy")}</div><div class="audit">Status: ${esc(t.statusUpdatedBy||t.statusUpdatedByEmail||"-")} · ${esc(dateTime(t.statusUpdatedAt))}</div></td>
 ${actions?`<td class="actions"><button class="secondary status-btn" data-id="${esc(t.id)}">Status</button> ${isAdmin()?'<button class="secondary edit-trip" data-id="'+esc(t.id)+'">Edit</button> ':''}${canDeleteTrips()?'<button class="danger delete-trip" data-id="'+esc(t.id)+'">Delete</button>':''}</td>`:""}
 </tr>`).join("")}</tbody></table></div>`;
}

function tripsHtml(){
 return `<div class="section-head"><h3>Trip List</h3><div class="toolbar"><input id="tripSearch" placeholder="Search vehicle, vendor, route..."><select id="tripStatusFilter"><option>All Status</option><option>Vehicle Placed</option><option>In Transit</option><option>Completed</option></select></div></div><div id="tripTableHost">${tripTable(state.trips)}</div>`;
}
function wireTrips(){
 const apply=()=>{const q=$("#tripSearch").value.toLowerCase(),s=$("#tripStatusFilter").value;const rows=state.trips.filter(t=>(s==="All Status"||(t.status||"Vehicle Placed")===s)&&[t.vehicle,t.vendor,t.from,t.to,t.createdBy].join(" ").toLowerCase().includes(q));$("#tripTableHost").innerHTML=tripTable(rows);wireTripButtons();};
 $("#tripSearch").addEventListener("input",apply);$("#tripStatusFilter").addEventListener("change",apply);wireTripButtons();
}
function wireTripButtons(){
 document.querySelectorAll(".status-btn").forEach(b=>b.onclick=()=>openStatus(b.dataset.id));
 document.querySelectorAll(".delete-trip").forEach(b=>b.onclick=()=>deleteTrip(b.dataset.id));
 document.querySelectorAll(".edit-trip").forEach(b=>b.onclick=()=>openEditTrip(b.dataset.id));
}

function modal(title,html){
 const frag=$("#modalTemplate").content.cloneNode(true),back=frag.querySelector(".modal-backdrop");back.querySelector("h3").textContent=title;back.querySelector(".modal-body").innerHTML=html;back.querySelector(".modal-close").onclick=()=>back.remove();back.addEventListener("click",e=>{if(e.target===back)back.remove();});document.body.appendChild(back);return back;
}
function openStatus(id){
 const t=state.trips.find(x=>x.id===id);if(!t)return;
 const m=modal("Update Trip Status",`<label>Trip Status<select id="statusSelect"><option>Vehicle Placed</option><option>In Transit</option><option>Completed</option></select></label><p class="note">Current: ${esc(t.status||"Vehicle Placed")}</p><button id="saveStatus" class="primary wide">Update Status</button>`);
 m.querySelector("#statusSelect").value=t.status||"Vehicle Placed";
 m.querySelector("#saveStatus").onclick=async()=>{
   const status=m.querySelector("#statusSelect").value;
   const oldStatus=t.status||"Vehicle Placed";
   await setDoc(doc(db,"trips",id),{status,statusUpdatedBy:state.profile.username,statusUpdatedByEmail:state.profile.loginEmail,statusUpdatedAt:Date.now(),updatedAt:Date.now()},{merge:true});
   if(status!==oldStatus){
     await createLiveNotification("Trip Status: "+status,(t.vehicle||"Vehicle")+" updated by "+state.profile.username,id,"trip_status");
   }
   m.remove();toast("Trip status updated");
 };
}
async function deleteTrip(id){if(!confirm("Delete this trip permanently?"))return;await deleteDoc(doc(db,"trips",id));toast("Trip deleted");}

function active(arr){return arr.filter(x=>x.active!==false)}
function picker(opts,selected="",placeholder=""){
  const head=placeholder?`<option value="" ${selected?"":"selected"} disabled>${esc(placeholder)}</option>`:"";
  return head+opts.map(x=>`<option ${x===selected?"selected":""}>${esc(x)}</option>`).join("");
}
function newTripHtml(){
 if(!canCreateTrips())return '<div class="card empty">You do not have permission to create trips.</div>';
 return `<form id="tripForm" class="card" autocomplete="off">
 <div class="form-grid">
  <label><span>Vendor / Transporter</span><select id="fVendor" required>${picker(active(state.vendors).map(x=>x.name),"","Select Vendor / Transporter")}</select></label>
  <label><span>Vehicle No</span><select id="fVehicle" required>${picker(active(state.vehicles).map(x=>x.number),"","Select Vehicle No")}</select></label>
  <label><span>Current Location</span><select id="fCurrent">${picker(active(state.locations).map(x=>x.name),"","Select Current Location")}</select></label>
  <label><span>From</span><select id="fFrom" required>${picker(active(state.locations).map(x=>x.name),"","Select From Location")}</select></label>
  <label><span>To</span><select id="fTo" required>${picker(active(state.locations).map(x=>x.name),"","Select To Location")}</select></label>
  <label><span>Freight Amount (₹)</span><input id="fFreight" type="number" min="0" step="0.01" required></label>
  <label><span>Advance (₹)</span><input id="fAdvance" type="number" min="0" step="0.01"></label>
  <label><span>Weight (Ton)</span><input id="fWeight" type="number" min="0" step="0.01"></label>
  <label><span>Trip Total KM</span><input id="fKm" type="number" min="0" step="0.01"></label>
  <label><span>Transit Hours</span><input id="fHours" type="number" min="0" step="0.01"></label>
  <label><span>Current Location to Origin KM</span><input id="fOriginKm" type="number" min="0" step="0.01"></label>
  <label><span>Vehicle Mileage (km/L)</span><select id="fMileage" required><option value="" selected disabled>Select Mileage</option>${(Array.from({length:36},(_,i)=>(2.5+i/10).toFixed(1))).map(x=>`<option>${x}</option>`).join("")}</select></label>
  <label><span>Loading Expense / Ton</span><input id="fLoad" type="number" min="0" step="0.01"></label>
  <label><span>Unloading Expense / Ton</span><input id="fUnload" type="number" min="0" step="0.01"></label>
  <label><span>Other Expense %</span><input id="fPct" type="number" min="0" step="0.01"></label>
  <label><span>FASTag</span><input id="fFastag" type="number" min="0" step="0.01"></label>
  <label><span>RTO / Tarpaulin</span><input id="fRto" type="number" min="0" step="0.01"></label>
  <label><span>Fixed Expenses</span><input id="fFixed" type="number" min="0" step="0.01"></label>
 </div>
 <div class="summary-row"><div class="summary"><span>Fuel Rate</span><strong>₹ ${money(state.fuelRate)}/L</strong></div><div class="summary"><span>Initial Status</span><strong>Vehicle Placed</strong></div><div class="summary"><span>Created By</span><strong>${esc(state.profile.username)}</strong></div></div>
 <button class="primary" style="margin-top:16px" type="submit">Save Trip</button>
 </form>`;
}
function wireNewTrip(){
 const form=$("#tripForm");
 if(form){
   form.reset();
   ["fFreight","fAdvance","fWeight","fKm","fHours","fOriginKm","fLoad","fUnload","fPct","fFastag","fRto","fFixed"].forEach(id=>{const el=$("#"+id);if(el)el.value="";});
 }
 const v=$("#fVehicle");const setMileage=()=>{const rec=state.vehicles.find(x=>x.number===v.value);$("#fMileage").value=rec?Number(rec.mileage).toFixed(1):""};v.addEventListener("change",setMileage);
 $("#tripForm").addEventListener("submit",async e=>{e.preventDefault();const n=id=>Number($("#"+id).value||0),now=Date.now(),id=uid();const freight=n("fFreight"),pct=n("fPct");
 const trip={id,createdAt:now,vendor:$("#fVendor").value,vehicle:$("#fVehicle").value,currentLocation:$("#fCurrent").value,from:$("#fFrom").value,to:$("#fTo").value,freight,netFreight:freight,advance:n("fAdvance"),weightTon:n("fWeight"),currentToOriginKm:n("fOriginKm"),totalKm:n("fKm"),transitHours:n("fHours"),mileage:n("fMileage"),fuelRate:state.fuelRate,fixedExpenses:n("fFixed"),fastag:n("fFastag"),rtoTarpaulin:n("fRto"),loadingUnloading:0,loadingExpensePerTon:n("fLoad"),unloadingExpensePerTon:n("fUnload"),expenseRules:pct>0?[{name:"Other Expense",percent:pct}]:[],createdBy:state.profile.username,createdByEmail:state.profile.loginEmail,status:"Vehicle Placed",statusUpdatedBy:state.profile.username,statusUpdatedByEmail:state.profile.loginEmail,statusUpdatedAt:now,updatedAt:now};
 await setDoc(doc(db,"trips",id),trip);
 await createLiveNotification("New Trip Created",trip.vehicle+" — "+trip.from+" → "+trip.to,id,"trip_created");
 toast("Trip created");navigate("trips");});
}

function openEditTrip(id){
 const t=state.trips.find(x=>x.id===id);if(!t||!isAdmin())return;
 const m=modal("Edit Trip",`<div class="form-grid">
 <label><span>Vendor</span><select id="eVendor">${picker(state.vendors.map(x=>x.name),t.vendor)}</select></label>
 <label><span>Vehicle</span><select id="eVehicle">${picker(state.vehicles.map(x=>x.number),t.vehicle)}</select></label>
 <label><span>From</span><select id="eFrom">${picker(state.locations.map(x=>x.name),t.from)}</select></label>
 <label><span>To</span><select id="eTo">${picker(state.locations.map(x=>x.name),t.to)}</select></label>
 <label><span>Freight</span><input id="eFreight" type="number" value="${Number(t.freight||0)}"></label>
 <label><span>Advance</span><input id="eAdvance" type="number" value="${Number(t.advance||0)}"></label>
 </div><button id="saveEditTrip" class="primary wide" style="margin-top:14px">Update Trip</button>`);
 m.querySelector("#saveEditTrip").onclick=async()=>{const freight=Number(m.querySelector("#eFreight").value||0);await setDoc(doc(db,"trips",id),{vendor:m.querySelector("#eVendor").value,vehicle:m.querySelector("#eVehicle").value,from:m.querySelector("#eFrom").value,to:m.querySelector("#eTo").value,freight,netFreight:freight,advance:Number(m.querySelector("#eAdvance").value||0),updatedAt:Date.now()},{merge:true});m.remove();toast("Trip updated");};
}

function masterHtml(type){
 if(!canManageMasters())return '<div class="card empty">You do not have permission to manage masters.</div>';
 const data=type==="vehicles"?state.vehicles:type==="vendors"?state.vendors:state.locations;
 const singular=type==="vehicles"?"Vehicle":type==="vendors"?"Vendor":"Location";
 return `<div class="section-head"><h3>${singular} Master</h3><button id="addMaster" class="primary">+ Add ${singular}</button></div>
 <div class="list">${data.map(x=>{const key=type==="vehicles"?x.number:x.name;return `<div class="list-row"><div class="grow"><strong>${esc(key)}</strong><small>${type==="vehicles"?esc(Number(x.mileage).toFixed(1)+" km/L"):(x.active===false?"Inactive":"Active")}</small></div>${isAdmin()?`<button class="secondary edit-master" data-key="${esc(key)}">Edit</button><button class="danger delete-master" data-key="${esc(key)}">Delete</button>`:""}</div>`}).join("")}</div>`;
}
function wireMaster(type){
 $("#addMaster")?.addEventListener("click",()=>openMaster(type,null));
 document.querySelectorAll(".edit-master").forEach(b=>b.onclick=()=>openMaster(type,b.dataset.key));
 document.querySelectorAll(".delete-master").forEach(b=>b.onclick=()=>deleteMaster(type,b.dataset.key));
}
function docId(value){return btoa(unescape(encodeURIComponent(value))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}
async function cascadeTrips(field,oldVal,newVal,extra={}){
 const snaps=await getDocs(collection(db,"trips"));let batch=writeBatch(db),count=0;
 for(const d of snaps.docs){const t=d.data();let changes={};if(field==="vehicle"&&t.vehicle===oldVal)changes={vehicle:newVal,...extra};if(field==="vendor"&&t.vendor===oldVal)changes={vendor:newVal};if(field==="location"){if(t.currentLocation===oldVal)changes.currentLocation=newVal;if(t.from===oldVal)changes.from=newVal;if(t.to===oldVal)changes.to=newVal;}if(Object.keys(changes).length){changes.updatedAt=Date.now();batch.set(d.ref,changes,{merge:true});count++;if(count%400===0){await batch.commit();batch=writeBatch(db);}}}
 if(count%400!==0)await batch.commit();
}
function openMaster(type,key){
 const old=key?(type==="vehicles"?state.vehicles.find(x=>x.number===key):(type==="vendors"?state.vendors:state.locations).find(x=>x.name===key)):null;
 const label=type==="vehicles"?"Vehicle":type==="vendors"?"Vendor":"Location";
 const m=modal((old?"Edit ":"Add ")+label,`<label>${label} ${type==="vehicles"?"Number":"Name"}<input id="masterName" value="${esc(key||"")}"></label>${type==="vehicles"?`<label>Mileage (km/L)<input id="masterMileage" type="number" min="2.5" max="6" step="0.1" value="${old?Number(old.mileage).toFixed(1):"3.0"}"></label>`:""}<button id="saveMaster" class="primary wide" style="margin-top:14px">Save</button>`);
 m.querySelector("#saveMaster").onclick=async()=>{const name=m.querySelector("#masterName").value.trim();if(!name)return;const data=type==="vehicles"?{number:name.toUpperCase(),mileage:Number(m.querySelector("#masterMileage").value||0),active:true,updatedAt:Date.now()}:{name,active:true,updatedAt:Date.now()};const oldKey=key;const newKey=type==="vehicles"?data.number:data.name;
 if(oldKey&&oldKey!==newKey){await setDoc(doc(db,type,docId(newKey)),data);if(type==="vehicles")await cascadeTrips("vehicle",oldKey,newKey,{mileage:data.mileage});if(type==="vendors")await cascadeTrips("vendor",oldKey,newKey);if(type==="locations")await cascadeTrips("location",oldKey,newKey);await deleteDoc(doc(db,type,docId(oldKey)));}
 else {await setDoc(doc(db,type,docId(newKey)),data,{merge:true});if(oldKey&&type==="vehicles")await cascadeTrips("vehicle",oldKey,newKey,{mileage:data.mileage});}
 m.remove();toast(label+" saved");};
}
async function deleteMaster(type,key){if(!isAdmin()||!confirm("Delete "+key+" from master? Existing trips will be kept."))return;await deleteDoc(doc(db,type,docId(key)));toast("Deleted from master");}

function reportsHtml(){
 const freight=state.trips.reduce((s,t)=>s+Number(t.freight||0),0),exp=state.trips.reduce((s,t)=>s+t.totalExpenses,0),margin=state.trips.reduce((s,t)=>s+t.margin,0);
 return `<div class="grid kpis"><div class="kpi"><div class="label">Freight</div><div class="value">₹ ${money(freight)}</div></div><div class="kpi"><div class="label">Expenses</div><div class="value">₹ ${money(exp)}</div></div><div class="kpi green"><div class="label">Margin</div><div class="value">₹ ${money(margin)}</div></div><div class="kpi"><div class="label">Trips</div><div class="value">${state.trips.length}</div></div></div>
 <div class="section-head"><h3>Trip Detail Report</h3><button id="csvBtn" class="secondary">Download CSV</button></div>${tripTable(state.trips,false)}`;
}

document.addEventListener("click",e=>{if(e.target?.id==="csvBtn"){const headers=["Date","Vendor","Vehicle","Current Location","From","To","Status","Freight","Expenses","Margin","Created By","Status Updated By","Status Updated At"];const rows=state.trips.map(t=>[dateTime(t.createdAt),t.vendor,t.vehicle,t.currentLocation,t.from,t.to,t.status,t.freight,t.totalExpenses,t.margin,t.createdBy||t.createdByEmail,t.statusUpdatedBy||t.statusUpdatedByEmail,dateTime(t.statusUpdatedAt)]);const csv=[headers,...rows].map(r=>r.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="cube-trip-report.csv";a.click();URL.revokeObjectURL(a.href);}});
