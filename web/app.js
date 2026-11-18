
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getMessaging, getToken, onMessage, isSupported as messagingSupported } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-storage.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  onSnapshot, query, orderBy, writeBatch, runTransaction
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
const storage = getStorage(app);
const WEB_VERSION = "0.4.18";

const $ = s => document.querySelector(s);
const money = n => new Intl.NumberFormat("en-IN",{maximumFractionDigits:0}).format(Number(n||0));
const parseMoneyValue = v => {
  const cleaned=String(v??"").replace(/,/g,"").trim();
  const n=Number(cleaned);
  return Number.isFinite(n)?n:0;
};
const moneyInputValue = v => {
  const n=Number(v||0);
  return Number.isInteger(n)?String(n):String(Number(n.toFixed(2)));
};
const normalizeLegacyScalarValue = (value,maxReasonable) => {
  let v=parseMoneyValue(value);
  if(v<=maxReasonable) return v;
  while(v>maxReasonable && v/100>0) v/=100;
  return v;
};
const normalizeLegacyMoneyValue = (value,freight) => {
  const v=parseMoneyValue(value);
  const cap=Math.max(100000,parseMoneyValue(freight)*2);
  return (v>cap && v/100<=cap)?v/100:v;
};
const dateTime = ms => ms ? new Date(ms).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"}) : "-";
const esc = v => String(v ?? "").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const uid = () => crypto.randomUUID ? crypto.randomUUID() : (Date.now()+"-"+Math.random().toString(16).slice(2));

let state = {
  user:null, profile:null, role:null,
  trips:[], vehicles:[], vendors:[], locations:[], fuelRate:100, minMarginPercent:10,
  page:"dashboard", unsubs:[], dashboardFilter:"thisWeek", dashboardFrom:"", dashboardTo:"", trendFilter:"thisWeek", notifications:[],
  settingsTab:"users", settingsRoles:[], settingsUsers:[], settingsLoading:false, settingsLoaded:false
};

function toast(msg){ const el=$("#toast"); el.textContent=msg; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"),2200); }
function setSync(text, ok=true, mode="synced"){
 const el=$("#syncState"); if(!el)return;
 el.textContent="● "+text;
 el.dataset.state=mode;
 el.classList.toggle("sync-error",!ok);
 el.title="Database status: "+text;
}
function syncedNow(){
 const t=new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});
 setSync("Synced · "+t,true,"synced");
}
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

const AUDIT_FIELDS={
  vendor:"Vendor",vehicle:"Vehicle",currentLocation:"Current Location",from:"From",to:"To",
  freight:"Freight",advance:"Advance",weightTon:"Weight",totalKm:"Trip KM",currentToOriginKm:"Origin KM",
  transitHours:"Transit Hours",mileage:"Mileage",loadingExpensePerTon:"Loading Expense",
  unloadingExpensePerTon:"Unloading Expense",fastag:"FASTag",rtoTarpaulin:"RTO / Tarpaulin",
  fixedExpenses:"Fixed Expenses",status:"Status",attachments:"Documents"
};
function auditValue(v){
  if(Array.isArray(v)) return String(v.length)+" document(s)";
  if(v&&typeof v==="object") return JSON.stringify(v);
  return String(v??"");
}
function tripAuditChanges(before={},after={}){
  const changes=[];
  for(const [key,label] of Object.entries(AUDIT_FIELDS)){
    const a=auditValue(before?.[key]),b=auditValue(after?.[key]);
    if(a!==b) changes.push({field:key,label,before:a,after:b});
  }
  const oldPct=Number(before?.expenseRules?.[0]?.percent||0);
  const newPct=Number(after?.expenseRules?.[0]?.percent||0);
  if(oldPct!==newPct) changes.push({field:"otherExpensePercent",label:"Other Expense %",before:String(oldPct),after:String(newPct)});
  return changes;
}
async function logTripAudit(tripId,action,before={},after={},note=""){
  const changes=tripAuditChanges(before,after);
  const id=uid();
  try{
    await setDoc(doc(db,"tripAudit",id),{
      id,tripId,action,note,changes,
      tripNumber:after?.tripNumber||before?.tripNumber||"",
      vehicle:after?.vehicle||before?.vehicle||"",
      createdAt:Date.now(),
      userId:state.profile?.uid||"",
      username:state.profile?.username||"User",
      email:state.profile?.loginEmail||""
    });
  }catch(error){
    console.warn("Audit history write failed",error);
  }
}

function tripNumberDateKey(ms=Date.now()){
 const d=new Date(ms);
 return String(d.getFullYear()).slice(-2)+String(d.getMonth()+1).padStart(2,"0")+String(d.getDate()).padStart(2,"0");
}
function displayTripNumber(t){
 return t.tripNumber||("LEGACY-"+String(t.id||"").slice(0,8).toUpperCase());
}
async function nextTripNumber(ms=Date.now()){
 const key=tripNumberDateKey(ms);
 const counterRef=doc(db,"counters","trip-"+key);
 try{
   const seq=await runTransaction(db,async tx=>{
     const snap=await tx.get(counterRef);
     const current=snap.exists()?Number(snap.data().value||0):0;
     const next=current+1;
     tx.set(counterRef,{value:next,dateKey:key,updatedAt:Date.now()},{merge:true});
     return next;
   });
   return "CUBE-"+key+"-"+String(seq).padStart(4,"0");
 }catch(error){
   console.warn("Trip counter unavailable, using timestamp fallback",error);
   return "CUBE-"+key+"-"+String(ms).slice(-4);
 }
}

async function persistTrip(id,data,merge=true,auditAction="EDIT"){
  try{
    setSync("Saving...",true,"saving");
    const payload={...data,updatedAt:Date.now()};
    const before=state.trips.find(t=>t.id===id)||{};
    if(merge) await setDoc(doc(db,"trips",id),payload,{merge:true});
    else await setDoc(doc(db,"trips",id),payload);
    const after=merge?{...before,...payload}:payload;
    await logTripAudit(id,auditAction,before,after);
    syncedNow();
    return payload;
  }catch(error){
    console.error("Trip database write failed",error);
    setSync("Sync error",false,"error");
    toast("Database update failed. Please check connection and try again.");
    throw error;
  }
}

async function removeTripFromDatabase(id){
  try{
    setSync("Saving...",true,"saving");
    const before=state.trips.find(t=>t.id===id)||{};
    await logTripAudit(id,"DELETE",before,{},"Trip deleted");
    await deleteDoc(doc(db,"trips",id));
    syncedNow();
  }catch(error){
    console.error("Trip database delete failed",error);
    setSync("Sync error",false,"error");
    toast("Database delete failed. Please check connection and try again.");
    throw error;
  }
}

function handlingExpenses(t,freight,weight){
  const load=parseMoneyValue(t.loadingExpensePerTon);
  const unload=parseMoneyValue(t.unloadingExpensePerTon);
  const version=Number(t.expenseCalcVersion||0);
  const rawTotal=load+unload;

  // Version 3+ stores TOTAL loading/unloading rupee amounts.
  if(version>=3 || weight<=1 || rawTotal<=0){
    return {loading:load,unloading:unload,legacyTotalMode:false,legacyDecimalCorrected:false};
  }

  // Older Version 2 builds could receive total amounts such as 45000.00.
  // Do not multiply those values by vehicle tonnage when that would create
  // an obviously unrealistic expense.
  const multiplied=rawTotal*weight;
  const looksLikeTotalAmount=
    rawTotal>=5000 &&
    freight>0 &&
    rawTotal<=freight*2 &&
    multiplied>freight*1.25;

  if(looksLikeTotalAmount){
    return {loading:load,unloading:unload,legacyTotalMode:true,legacyDecimalCorrected:false};
  }

  // Genuine older per-ton values are still supported.
  return {loading:load*weight,unloading:unload*weight,legacyTotalMode:false,legacyDecimalCorrected:false};
}

function calcTrip(t){
  const freight=parseMoneyValue(t.freight), weight=Number(t.weightTon||0), km=Number(t.totalKm||0), mileage=Number(t.mileage||0), fuelRate=parseMoneyValue(t.fuelRate);
  const pct=(t.expenseRules||[]).reduce((s,r)=>s+freight*Number(r.percent||0)/100,0);
  const fuel=mileage>0?(km/mileage)*fuelRate:0;
  const handling=handlingExpenses(t,freight,weight);
  const legacyLU=parseMoneyValue(t.loadingUnloading);
  const exp=pct+fuel+parseMoneyValue(t.fixedExpenses)+parseMoneyValue(t.fastag)+parseMoneyValue(t.rtoTarpaulin)+legacyLU+handling.loading+handling.unloading;
  const margin=freight-exp;
  return {
    ...t,
    totalExpenses:exp,
    margin,
    marginPercent:freight?margin/freight*100:0,
    fuelExpense:fuel,
    percentageExpense:pct,
    loadingExpense:handling.loading,
    unloadingExpense:handling.unloading,
    legacyLoadingUnloadingExpense:legacyLU,
    legacyHandlingCorrected:handling.legacyTotalMode,
    legacyDecimalCorrected:handling.legacyDecimalCorrected
  };
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

async function migrateExistingTripsToV3(){
  if(!isAdmin()) return 0;

  const snap=await getDocs(collection(db,"trips"));
  let batch=writeBatch(db), pending=0, migrated=0;
  const now=Date.now();

  for(const d of snap.docs){
    const t=d.data();
    const expenseVersion=Number(t.expenseCalcVersion||0);
    const numericVersion=Number(t.numericDataVersion||0);
    if(expenseVersion>=3 && numericVersion>=2) continue;

    const freight=parseMoneyValue(t.freight);
    const weight=Number(t.weightTon||0);
    let totalLoading=parseMoneyValue(t.loadingExpensePerTon);
    let totalUnloading=parseMoneyValue(t.unloadingExpensePerTon);

    if(expenseVersion<3){
      const rawTotal=totalLoading+totalUnloading;
      if(weight>1 && rawTotal>0){
        const freightPerTon=freight>0 ? freight/weight : 0;
        const clearlyTotal=
          rawTotal>=5000 &&
          freightPerTon>0 &&
          rawTotal>freightPerTon*1.25;
        if(!clearlyTotal){
          totalLoading*=weight;
          totalUnloading*=weight;
        }
      }
    }

    const patch={
      loadingExpensePerTon: numericVersion<2 ? normalizeLegacyMoneyValue(totalLoading,freight) : totalLoading,
      unloadingExpensePerTon: numericVersion<2 ? normalizeLegacyMoneyValue(totalUnloading,freight) : totalUnloading,
      expenseCalcVersion:3,
      numericDataVersion:2,
      updatedAt:now
    };

    if(numericVersion<2){
      patch.totalKm=normalizeLegacyScalarValue(t.totalKm,10000);
      patch.currentToOriginKm=normalizeLegacyScalarValue(t.currentToOriginKm,10000);
      patch.transitHours=normalizeLegacyScalarValue(t.transitHours,1000);
      patch.fastag=normalizeLegacyMoneyValue(t.fastag,freight);
      patch.rtoTarpaulin=normalizeLegacyMoneyValue(t.rtoTarpaulin,freight);
      patch.fixedExpenses=normalizeLegacyMoneyValue(t.fixedExpenses,freight);
      patch.expenseRules=(Array.isArray(t.expenseRules)?t.expenseRules:[]).map(r=>({
        ...r,
        percent:normalizeLegacyScalarValue(r?.percent,100)
      }));
      patch.numericDataMigratedAt=now;
      patch.numericDataMigratedBy=state.profile?.username||"Admin";
    }
    if(expenseVersion<3){
      patch.legacyExpenseMigratedAt=now;
      patch.legacyExpenseMigratedBy=state.profile?.username||"Admin";
    }

    batch.set(d.ref,patch,{merge:true});
    pending++; migrated++;
    if(pending===400){
      await batch.commit();
      batch=writeBatch(db);
      pending=0;
    }
  }

  if(pending>0) await batch.commit();

  if(migrated>0){
    await setDoc(doc(db,"settings","tripNumericMigrationV2"),{
      completedAt:now,
      migratedTrips:migrated,
      completedBy:state.profile?.username||"Admin",
      numericVersion:2,
      expenseVersion:3
    },{merge:true});
  }
  return migrated;
}


function startLiveSync(){
  state.unsubs.forEach(f=>f()); state.unsubs=[];
  setSync(navigator.onLine?"Connecting...":"Offline",navigator.onLine,navigator.onLine?"connecting":"offline");
  const watch=(name,cb)=>state.unsubs.push(onSnapshot(collection(db,name),snap=>{cb(snap.docs.map(d=>({id:d.id,...d.data()}))); syncedNow(); render();},err=>{console.error(err);setSync("Sync error",false,"error");}));
  watch("trips",rows=>state.trips=rows.map(calcTrip).sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0)));
  watch("vehicles",rows=>state.vehicles=rows.map(x=>({number:x.number||x.id,mileage:Number(x.mileage||0),active:x.active!==false})).sort((a,b)=>a.number.localeCompare(b.number)));
  watch("vendors",rows=>state.vendors=rows.map(x=>({name:x.name||x.id,active:x.active!==false})).sort((a,b)=>a.name.localeCompare(b.name)));
  watch("locations",rows=>state.locations=rows.map(x=>({name:x.name||x.id,active:x.active!==false})).sort((a,b)=>a.name.localeCompare(b.name)));
  state.unsubs.push(onSnapshot(doc(db,"settings","fuelRate"),d=>{ if(d.exists()) state.fuelRate=Number(d.data().value||100); render(); }));
  state.unsubs.push(onSnapshot(doc(db,"settings","profitability"),d=>{
    if(d.exists()) state.minMarginPercent=Number(d.data().minMarginPercent??10);
  },err=>console.warn("Profitability settings unavailable",err)));
  state.unsubs.push(onSnapshot(collection(db,"notifications"),snap=>{
    state.notifications=snap.docs.map(d=>({id:d.id,...d.data()})).filter(visibleNotification).sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0)).slice(0,50);
    updateNotificationBadge();
  },err=>console.warn("Notifications listener unavailable",err)));
}

async function showApp(){
  $("#loginView").classList.add("hidden"); $("#appView").classList.remove("hidden");
  const avatar=$("#topAvatar"); if(avatar) avatar.textContent=(state.profile.username||"CU").trim().slice(0,2).toUpperCase();
  const topUserName=$("#topUserName"); if(topUserName) topUserName.textContent=state.profile.username||"User";
  const topUserRole=$("#topUserRole"); if(topUserRole) topUserRole.textContent=state.role.name||state.profile.roleId||"User";
  const newTripBtn=document.querySelector('[data-page="newtrip"]'); if(newTripBtn) newTripBtn.style.display=canCreateTrips()?"":"none";
  ["vehicles","vendors","locations"].forEach(p=>{const b=document.querySelector(`[data-page="${p}"]`);if(b)b.style.display=canManageMasters()?"":"none";});

  try{
    const migrated=await migrateExistingTripsToV3();
    if(migrated>0) toast(migrated+" existing trip"+(migrated===1?"":"s")+" corrected");
  }catch(err){
    console.error("Existing trip migration failed",err);
    toast("Existing trip correction could not complete");
  }

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
function notificationMeta(type){
 const map={
  trip_created:["🚚","Trip Created"],trip_status:["↻","Status"],margin_warning:["⚠","Margin"],
  document:["📎","Document"],trip_edit:["✎","Edited"],trip_delete:["🗑","Deleted"],
  delay:["⏱","Delay"],general:["🔔","General"]
 };
 return map[type]||map.general;
}
function openNotificationCenter(){
 localStorage.setItem("cube_notifications_seen_at",String(Date.now()));
 updateNotificationBadge();
 const types=[...new Set(state.notifications.map(n=>n.type||"general"))];
 const m=modal("Notifications",`
   <div class="notification-toolbar">
     <select id="notificationTypeFilter"><option value="">All Notifications</option>${types.map(t=>`<option value="${esc(t)}">${esc(notificationMeta(t)[1])}</option>`).join("")}</select>
     <button id="enablePushBtn" class="secondary" type="button">Enable Browser Push</button>
   </div>
   <div class="notification-center-note">Operational alerts are stored in Firebase and synchronized live while you are signed in.</div>
   <div id="notificationListHost"></div>
 `);
 const renderList=()=>{
   const type=m.querySelector("#notificationTypeFilter")?.value||"";
   const rows=state.notifications.filter(n=>!type||(n.type||"general")===type).slice(0,50);
   m.querySelector("#notificationListHost").innerHTML=rows.length?`<div class="notification-list">${rows.map(n=>{
     const meta=notificationMeta(n.type);
     return `<div class="notification-item">
       <div class="notification-item-icon">${meta[0]}</div>
       <div class="grow"><div class="notification-item-title"><strong>${esc(n.title||"CUBE Logistics")}</strong><span>${esc(meta[1])}</span></div><p>${esc(n.body||"")}</p><small>${esc(dateTime(n.createdAt))}</small></div>
     </div>`;
   }).join("")}</div>`:'<div class="empty">No notifications for this filter.</div>';
 };
 m.querySelector("#notificationTypeFilter")?.addEventListener("change",renderList);
 m.querySelector("#enablePushBtn")?.addEventListener("click",enableBrowserPush);
 renderList();
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

document.querySelector(".forgot-password-web")?.addEventListener("click",async()=>{
  const identity=$("#loginUser").value.trim();
  if(!identity){ $("#loginError").textContent="Enter your User ID first."; $("#loginUser").focus(); return; }
  if(!identity.includes("@")){ $("#loginError").textContent="For username accounts, please contact Admin to change the password."; return; }
  try{
    await sendPasswordResetEmail(auth,identity);
    $("#loginError").textContent="Password reset email sent.";
  }catch(err){
    console.error(err);
    $("#loginError").textContent="Unable to send password reset email.";
  }
});

onAuthStateChanged(auth,async user=>{
  state.user=user;
  if(!user){state.profile=null;state.role=null;state.unsubs.forEach(f=>f());state.unsubs=[];showLogin();return;}
  try{await loadProfile(user);await showApp();}catch(e){await signOut(auth);$("#loginError").textContent=e.message;}
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
window.addEventListener("offline",()=>setSync("Offline",false,"offline"));
window.addEventListener("online",()=>{setSync("Reconnecting...",true,"connecting");startLiveSync();});

document.addEventListener("keydown",e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();$("#globalSearch")?.focus();}
});
$("#menuBtn").addEventListener("click",()=>$("#menuBtn").setAttribute("aria-expanded",$(".sidebar").classList.toggle("open")));
$("#nav").addEventListener("click",e=>{const b=e.target.closest("[data-page]");if(b)navigate(b.dataset.page);});


function rolePermissionSummary(role){
 return [
   role.canCreateTrips?"Create Trips":"",
   role.canManageMasters?"Manage Masters":"",
   role.canDeleteTrips?"Delete Trips":"",
   role.canViewReports?"View Reports":"",
   role.canManageUsers?"Manage Users":""
 ].filter(Boolean).join(" • ")||"View only";
}
function roleIdFromName(value){
 return String(value||"").trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
}
async function loadSettingsData(){
 state.settingsLoading=true;
 if(state.page==="settings") render();
 try{
   const [rolesSnap,usersSnap]=await Promise.all([
     getDocs(collection(db,"roles")),
     getDocs(collection(db,"users"))
   ]);
   const roles=rolesSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.name||a.id).localeCompare(String(b.name||b.id)));
   const roleMap=new Map(roles.map(r=>[r.id,r]));
   const users=usersSnap.docs.map(d=>{
     const x=d.data(),roleId=x.roleId||x.role||"user";
     return {
       uid:x.uid||d.id,
       username:x.username||x.email||"user",
       loginEmail:x.loginEmail||x.email||"",
       roleId,
       active:x.active!==false,
       role:roleMap.get(roleId)||{id:roleId,name:roleId}
     };
   }).sort((a,b)=>a.username.localeCompare(b.username));
   state.settingsRoles=roles;
   state.settingsUsers=users;
   state.settingsLoaded=true;
 }catch(error){
   console.error("Settings data load failed",error);
   toast("Unable to load users and roles");
 }finally{
   state.settingsLoading=false;
   if(state.page==="settings") render();
 }
}
function settingsHtml(){
 const roles=state.settingsRoles||[];
 const users=state.settingsUsers||[];
 const admin=!!state.role?.canManageUsers;
 if(state.settingsLoading){
   return '<div class="settings-shell"><div class="settings-hero"><div><h3>Settings</h3><p>Loading users and roles...</p></div></div><div class="settings-loading">Loading settings…</div></div>';
 }
 const roleCards=roles.map(r=>`
   <div class="role-card">
     <div><strong>${esc(r.name||r.id)}</strong><small>${esc(rolePermissionSummary(r))}</small></div>
     <span class="role-id">${esc(r.id)}</span>
   </div>`).join("")||'<div class="empty">No roles available.</div>';

 if(!admin){
   return `<div class="settings-shell">
     <div class="settings-hero"><div><h3>Settings</h3><p>View account role and access permissions</p></div><span class="settings-version">Web v${WEB_VERSION}</span></div>
     <div class="settings-account-card">
       <div class="settings-account-avatar">${esc((state.profile?.username||"U").slice(0,2).toUpperCase())}</div>
       <div><span>Username</span><strong>${esc(state.profile?.username||"User")}</strong><span>Assigned Role</span><b>${esc(state.role?.name||state.profile?.roleId||"User")}</b></div>
     </div>
     <div class="settings-section-title"><h4>Available Roles</h4></div>
     <div class="role-card-grid">${roleCards}</div>
     <div class="settings-readonly-note">🔒 Only Admin can create or edit roles and users.</div>
   </div>`;
 }

 const roleOptions=roles.map(r=>`<option value="${esc(r.id)}">${esc(r.name||r.id)}</option>`).join("");
 return `<div class="settings-shell">
   <div class="settings-hero">
     <div><h3>Settings</h3><p>Manage application roles and users</p></div>
     <span class="settings-version">Web v${WEB_VERSION}</span>
   </div>
   <div class="settings-tabs">
     <button class="settings-tab ${state.settingsTab==="users"?"active":""}" data-settings-tab="users">Users</button>
     <button class="settings-tab ${state.settingsTab==="roles"?"active":""}" data-settings-tab="roles">Roles</button>
   </div>
   ${state.settingsTab==="users"?`
     <div class="settings-grid">
       <section class="settings-card create-user-card">
         <div class="settings-card-head"><div><h4>Create User</h4><p>Create the same account used by Web and Android.</p></div><span>＋</span></div>
         <form id="createUserForm" class="settings-form">
           <label><span>Username</span><input id="settingsUsername" autocomplete="off" minlength="3" required placeholder="Example: placement1"></label>
           <label><span>Password</span><input id="settingsPassword" type="password" minlength="6" required placeholder="Minimum 6 characters"></label>
           <label><span>Role</span><select id="settingsUserRole" required><option value="" disabled>Select Role</option>${roleOptions}</select></label>
           <button class="primary" type="submit">Create User</button>
         </form>
       </section>
       <section class="settings-card existing-users-card">
         <div class="settings-card-head"><div><h4>Existing Users</h4><p>${users.length} account${users.length===1?"":"s"}</p></div></div>
         <div class="settings-users-list">
           ${users.map(u=>`<div class="settings-user-row">
             <div class="settings-user-avatar">${esc((u.username||"U").slice(0,2).toUpperCase())}</div>
             <div class="grow"><strong>${esc(u.username)}</strong><small>${esc(u.loginEmail||"")} · ${u.active?"Active":"Inactive"}</small></div>
             <select class="user-role-select" data-user-id="${esc(u.uid)}" aria-label="Role for ${esc(u.username)}">
               ${roles.map(r=>`<option value="${esc(r.id)}" ${r.id===u.roleId?"selected":""}>${esc(r.name||r.id)}</option>`).join("")}
             </select>
           </div>`).join("")||'<div class="empty">No users found.</div>'}
         </div>
       </section>
     </div>
   `:`
     <div class="settings-grid">
       <section class="settings-card create-role-card">
         <div class="settings-card-head"><div><h4>Create Role</h4><p>Example: Admin, User, Manager, Accounts</p></div><span>＋</span></div>
         <form id="createRoleForm" class="settings-form">
           <label><span>Role Name</span><input id="settingsRoleName" minlength="2" required placeholder="Role name"></label>
           <div class="permission-grid">
             <label><input id="permCreateTrips" type="checkbox" checked> Create / Save Trips</label>
             <label><input id="permMasters" type="checkbox"> Manage Masters</label>
             <label><input id="permDeleteTrips" type="checkbox"> Delete Trips</label>
             <label><input id="permReports" type="checkbox" checked> View Reports</label>
             <label><input id="permUsers" type="checkbox"> Manage Roles & Users</label>
           </div>
           <button class="primary" type="submit">Create Role</button>
         </form>
       </section>
       <section class="settings-card available-roles-card">
         <div class="settings-card-head"><div><h4>Available Roles</h4><p>Shared by Android and Web.</p></div></div>
         <div class="role-card-grid">${roleCards}</div>
       </section>
     </div>
   `}
 </div>`;
}
async function createWebUser(username,password,roleId){
 const normalized=normalizeUsername(username);
 if(normalized.length<3) throw new Error("Username must have at least 3 characters");
 if(password.length<6) throw new Error("Password must have at least 6 characters");
 if(!roleId) throw new Error("Select a role");

 const usersSnap=await getDocs(collection(db,"users"));
 const duplicate=usersSnap.docs.some(d=>normalizeUsername(d.data().usernameLower||d.data().username||"")===normalized);
 if(duplicate) throw new Error("Username already exists");

 const internalEmail=normalized+"@cube.internal";
 const secondaryApp=initializeApp(firebaseConfig,"userCreator-"+Date.now());
 const secondaryAuth=getAuth(secondaryApp);
 try{
   const credential=await createUserWithEmailAndPassword(secondaryAuth,internalEmail,password);
   const newUid=credential.user?.uid;
   if(!newUid) throw new Error("Unable to create user");
   await setDoc(doc(db,"users",newUid),{
     uid:newUid,username:username.trim(),usernameLower:normalized,
     loginEmail:internalEmail,roleId,active:true,
     createdAt:Date.now(),updatedAt:Date.now()
   });
 }finally{
   try{await signOut(secondaryAuth);}catch{}
   try{await deleteApp(secondaryApp);}catch{}
 }
}
async function createWebRole(name,permissions){
 const id=roleIdFromName(name);
 if(name.trim().length<2||!id) throw new Error("Enter a valid role name");
 const ref=doc(db,"roles",id);
 if((await getDoc(ref)).exists()) throw new Error("Role already exists");
 await setDoc(ref,{
   id,name:name.trim(),
   canCreateTrips:!!permissions.canCreateTrips,
   canManageMasters:!!permissions.canManageMasters,
   canDeleteTrips:!!permissions.canDeleteTrips,
   canViewReports:!!permissions.canViewReports,
   canManageUsers:!!permissions.canManageUsers,
   updatedAt:Date.now()
 });
}
function wireSettings(){
 document.querySelectorAll("[data-settings-tab]").forEach(btn=>btn.onclick=()=>{
   state.settingsTab=btn.dataset.settingsTab;
   render();
 });
 if(!state.settingsLoaded&&!state.settingsLoading){
   loadSettingsData();
   return;
 }
 $("#createUserForm")?.addEventListener("submit",async e=>{
   e.preventDefault();
   const button=e.currentTarget.querySelector('button[type="submit"]');
   try{
     button.disabled=true;button.textContent="Creating...";
     await createWebUser($("#settingsUsername").value,$("#settingsPassword").value,$("#settingsUserRole").value);
     toast("User created successfully");
     await loadSettingsData();
   }catch(error){
     console.error(error);toast(error.message||"Unable to create user");
   }finally{if(button){button.disabled=false;button.textContent="Create User";}}
 });
 document.querySelectorAll(".user-role-select").forEach(select=>select.onchange=async()=>{
   const userId=select.dataset.userId,roleId=select.value;
   try{
     select.disabled=true;
     await setDoc(doc(db,"users",userId),{roleId,updatedAt:Date.now()},{merge:true});
     if(userId===state.profile?.uid){
       await loadProfile(state.user);
       const roleEl=$("#topUserRole");if(roleEl)roleEl.textContent=state.role.name||state.profile.roleId||"User";
     }
     toast("User role updated");
     await loadSettingsData();
   }catch(error){
     console.error(error);toast("Unable to update role");
     select.disabled=false;
   }
 });
 $("#createRoleForm")?.addEventListener("submit",async e=>{
   e.preventDefault();
   const button=e.currentTarget.querySelector('button[type="submit"]');
   try{
     button.disabled=true;button.textContent="Creating...";
     await createWebRole($("#settingsRoleName").value,{
       canCreateTrips:$("#permCreateTrips").checked,
       canManageMasters:$("#permMasters").checked,
       canDeleteTrips:$("#permDeleteTrips").checked,
       canViewReports:$("#permReports").checked,
       canManageUsers:$("#permUsers").checked
     });
     toast("Role created successfully");
     await loadSettingsData();
   }catch(error){
     console.error(error);toast(error.message||"Unable to create role");
   }finally{if(button){button.disabled=false;button.textContent="Create Role";}}
 });
}

function restoreStandardTopbar(){
 const titleBlock=$("#topbarTitleBlock");
 const search=$("#topSearchWrap");
 const topActions=$(".top-actions");
 if(titleBlock && !$("#pageTitle")){
   titleBlock.className="topbar-title-block";
   titleBlock.innerHTML='<h2 id="pageTitle">Dashboard</h2><p id="pageSubtitle"></p>';
 }
 if(search && topActions && search.parentElement!==topActions.parentElement){
   topActions.parentElement.insertBefore(search,topActions);
 }
 search?.classList.remove("dashboard-relocated-search");
}
function dashboardHeaderSummaryHtml(){
 const start=new Date();start.setHours(0,0,0,0);
 const today=state.trips.filter(t=>Number(t.createdAt||0)>=start.getTime());
 const active=state.trips.filter(t=>isTripOpenStatus(t.status)).length;
 const transit=state.trips.filter(t=>t.status==="In Transit").length;
 const completed=state.trips.filter(t=>t.status==="Completed"&&Number(t.statusUpdatedAt||0)>=start.getTime()).length;
 const revenue=today.reduce((sum,t)=>sum+Number(t.freight||0),0);
 const margin=today.reduce((sum,t)=>sum+Number(t.margin||0),0);
 const low=today.filter(t=>Number(t.margin||0)<0||Number(t.marginPercent||0)<Number(state.minMarginPercent||10)).length;
 const delayed=state.trips.filter(t=>isTripOpenStatus(t.status)&&Number(t.transitHours||0)>0&&Number(t.createdAt||0)+Number(t.transitHours||0)*3600000<Date.now()).length;
 return `<div class="header-ops-summary">
   <div class="header-ops-title"><span>☀</span><strong>Today's Operations</strong><button id="copyDailySummary" class="text-link" type="button">Copy</button></div>
   <div class="header-ops-metrics">
     <div><span>Trips</span><b>${today.length}</b></div>
     <div><span>Active</span><b>${active}</b></div>
     <div><span>Transit</span><b>${transit}</b></div>
     <div><span>Completed</span><b>${completed}</b></div>
     <div><span>Revenue</span><b>₹ ${money(revenue)}</b></div>
     <div><span>Margin</span><b class="${margin<0?"negative-value":"positive-value"}">₹ ${money(margin)}</b></div>
     <div><span>Low Margin</span><b>${low}</b></div>
     <div><span>Delayed</span><b>${delayed}</b></div>
   </div>
 </div>`;
}
function configureTopbarForPage(page){
 if(page!=="dashboard"){
   restoreStandardTopbar();
   return;
 }
 const titleBlock=$("#topbarTitleBlock");
 if(titleBlock){
   titleBlock.className="topbar-title-block dashboard-header-summary";
   titleBlock.innerHTML=dashboardHeaderSummaryHtml();
 }
 const search=$("#topSearchWrap");
 const slot=$("#dashboardSearchSlot");
 if(search&&slot){
   slot.appendChild(search);
   search.classList.add("dashboard-relocated-search");
 }
}

function navigate(page){
  state.page=page;
  document.querySelectorAll("#nav button").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  $(".sidebar").classList.remove("open"); $("#menuBtn").setAttribute("aria-expanded","false");
  if(page!=="dashboard"){
    restoreStandardTopbar();
    const titles={trips:["Trips","Live trip placement and status"],newtrip:["Create Trip","Add a new vehicle placement"],vehicles:["Vehicles","Vehicle master"],vendors:["Vendors","Vendor master"],locations:["Locations","Location master"],reports:["Reports","Operational and profitability summary"]};
    $("#pageTitle").textContent=titles[page]?.[0]||"CUBE";
    $("#pageSubtitle").textContent=titles[page]?.[1]||"";
  }
  render();
  configureTopbarForPage(page);
}

function render(){
  if(!state.profile)return;
  const root=$("#pageContent");
  if(state.page==="dashboard"){
    const search=$("#topSearchWrap"),topActions=$(".top-actions");
    if(search&&topActions&&root.contains(search)) topActions.parentElement.insertBefore(search,topActions);
    root.innerHTML=dashboardHtml();configureTopbarForPage("dashboard");wireDashboard();
  }
  if(state.page==="trips"){root.innerHTML=tripsHtml();wireTrips();}
  if(state.page==="newtrip"){root.innerHTML=newTripHtml();wireNewTrip();}
  if(state.page==="vehicles"){root.innerHTML=masterHtml("vehicles");wireMaster("vehicles");}
  if(state.page==="vendors"){root.innerHTML=masterHtml("vendors");wireMaster("vendors");}
  if(state.page==="locations"){root.innerHTML=masterHtml("locations");wireMaster("locations");}
  if(state.page==="reports"){root.innerHTML=reportsHtml();wireReports();}
  root.classList.remove("page-enter");
  requestAnimationFrame(()=>requestAnimationFrame(()=>root.classList.add("page-enter")));
}

function getPeriodRange(filter,customFrom="",customTo=""){
  const now=new Date(); now.setHours(23,59,59,999);
  const startOfDay=d=>{const x=new Date(d);x.setHours(0,0,0,0);return x};
  const endOfDay=d=>{const x=new Date(d);x.setHours(23,59,59,999);return x};
  let start,end=now,label="This Week";

  if(filter==="yesterday"){
    const d=new Date();d.setDate(d.getDate()-1);
    start=startOfDay(d);end=endOfDay(d);label="Yesterday";
  }else if(filter==="last7"){
    const d=new Date();d.setDate(d.getDate()-6);
    start=startOfDay(d);label="Last 7 Days";
  }else if(filter==="lastWeek"){
    const d=new Date();const day=d.getDay()||7;
    d.setDate(d.getDate()-day-6);
    start=startOfDay(d);
    end=new Date(start);end.setDate(end.getDate()+6);end=endOfDay(end);
    label="Last Week";
  }else if(filter==="thisMonth"){
    start=new Date(now.getFullYear(),now.getMonth(),1);
    label="This Month";
  }else if(filter==="lastMonth"){
    start=new Date(now.getFullYear(),now.getMonth()-1,1);
    end=new Date(now.getFullYear(),now.getMonth(),0,23,59,59,999);
    label="Last Month";
  }else if(filter==="custom" && customFrom && customTo){
    start=startOfDay(new Date(customFrom+"T00:00:00"));
    end=endOfDay(new Date(customTo+"T00:00:00"));
    label="Custom Range";
  }else{
    const d=new Date();const day=d.getDay()||7;
    d.setDate(d.getDate()-day+1);
    start=startOfDay(d);
    label="This Week";
  }
  return {start:start.getTime(),end:end.getTime(),label};
}

function getDashboardRange(){
  return getPeriodRange(state.dashboardFilter,state.dashboardFrom,state.dashboardTo);
}

function getTrendRange(){
  return getPeriodRange(state.trendFilter||"thisWeek");
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
  const trendRange=getTrendRange();
  const trendTrips=state.trips.filter(t=>Number(t.createdAt||0)>=trendRange.start&&Number(t.createdAt||0)<=trendRange.end);
  const activeVehicles=state.vehicles.filter(v=>v.active!==false);
  const placed=trips.filter(t=>(t.status||"Vehicle Placed")==="Vehicle Placed").length;
  const transit=trips.filter(t=>t.status==="In Transit").length;
  const completed=trips.filter(t=>t.status==="Completed").length;
  const freight=trips.reduce((s,t)=>s+Number(t.freight||0),0);
  const margin=trips.reduce((s,t)=>s+Number(t.margin||0),0);
  const marginPct=freight?margin/freight*100:0;

  const activeVehicleNos=new Set(
    trips.filter(t=>isTripOpenStatus(t.status))
      .map(t=>t.vehicle).filter(Boolean)
  );
  const inTrip=Math.min(activeVehicleNos.size,activeVehicles.length);
  const idle=Math.max(activeVehicles.length-inTrip,0);
  const utilization=activeVehicles.length?Math.round(inTrip/activeVehicles.length*100):0;

  const today=new Date(); today.setHours(0,0,0,0);
  const completedToday=trips.filter(t=>t.status==="Completed" && Number(t.statusUpdatedAt||0)>=today.getTime()).length;
  const delayed=trips.filter(t=>{
    if(["Completed","Cancelled"].includes(t.status)) return false;
    const hrs=Number(t.transitHours||0);
    return hrs>0 && Number(t.createdAt||0)+hrs*3600000 < Date.now();
  }).length;

  const todayStart=new Date();todayStart.setHours(0,0,0,0);
  const todayEnd=new Date();todayEnd.setHours(23,59,59,999);
  const todayTrips=state.trips.filter(t=>Number(t.createdAt||0)>=todayStart.getTime()&&Number(t.createdAt||0)<=todayEnd.getTime());
  const todayRevenue=todayTrips.reduce((sum,t)=>sum+Number(t.freight||0),0);
  const todayMargin=todayTrips.reduce((sum,t)=>sum+Number(t.margin||0),0);
  const todayLowMargin=todayTrips.filter(t=>Number(t.margin||0)<0||Number(t.marginPercent||0)<Number(state.minMarginPercent||10)).length;
  const todayInTransit=state.trips.filter(t=>t.status==="In Transit").length;
  const todayActive=state.trips.filter(t=>isTripOpenStatus(t.status)).length;


  const compact=n=>{
    n=Number(n||0);
    if(Math.abs(n)>=10000000)return "₹ "+(n/10000000).toFixed(2)+" Cr";
    if(Math.abs(n)>=100000)return "₹ "+(n/100000).toFixed(2)+" L";
    return "₹ "+money(n);
  };

  const trendFreight=trendTrips.reduce((sum,t)=>sum+Number(t.freight||0),0);
  const trendMargin=trendTrips.reduce((sum,t)=>sum+Number(t.margin||0),0);
  const trendMarginPct=trendFreight?trendMargin/trendFreight*100:0;
  const days=dashboardTrendBuckets(trendTrips,trendRange.start,trendRange.end);
  const totalTrendTrips=days.reduce((sum,d)=>sum+d.count,0);
  const avgMarginPerTrip=totalTrendTrips?trendMargin/totalTrendTrips:0;
  const bestDay=days.reduce((best,d)=>!best||d.margin>best.margin?d:best,null);

  const axisMoney=n=>{
    const a=Math.abs(Number(n||0));
    const sign=Number(n||0)<0?"-":"";
    if(a>=100000)return sign+"₹"+(a/100000).toFixed(a>=1000000?1:2)+"L";
    if(a>=1000)return sign+"₹"+(a/1000).toFixed(a>=10000?0:1)+"K";
    return sign+"₹"+Math.round(a);
  };

  const maxCount=Math.max(1,...days.map(d=>d.count));
  const rawMarginMin=Math.min(0,...days.map(d=>Number(d.margin||0)));
  const rawMarginMax=Math.max(0,...days.map(d=>Number(d.margin||0)));
  let marginSpan=Math.max(1,rawMarginMax-rawMarginMin);
  const marginMin=rawMarginMin<0?rawMarginMin-marginSpan*.12:0;
  const marginMax=rawMarginMax>0?rawMarginMax+marginSpan*.12:Math.max(1,marginSpan);
  marginSpan=Math.max(1,marginMax-marginMin);

  const plot={left:54,right:690,top:24,bottom:188};
  const step=days.length>1?(plot.right-plot.left)/(days.length-1):0;
  const xAt=i=>days.length>1?plot.left+i*step:(plot.left+plot.right)/2;
  const yCount=v=>plot.bottom-(v/maxCount)*(plot.bottom-plot.top);
  const yMargin=v=>plot.bottom-((Number(v||0)-marginMin)/marginSpan)*(plot.bottom-plot.top);
  const zeroY=yMargin(0);

  const points=days.map((d,i)=>({x:xAt(i),y:yMargin(d.margin)}));
  const smoothPath=pts=>{
    if(!pts.length)return "";
    if(pts.length===1)return `M ${pts[0].x} ${pts[0].y}`;
    let path=`M ${pts[0].x} ${pts[0].y}`;
    for(let i=0;i<pts.length-1;i++){
      const p=pts[i],n=pts[i+1];
      const midX=(p.x+n.x)/2;
      path+=` C ${midX} ${p.y}, ${midX} ${n.y}, ${n.x} ${n.y}`;
    }
    return path;
  };
  const linePath=smoothPath(points);

  const countTicks=[0,.25,.5,.75,1].map(p=>Math.round(maxCount*p)).filter((v,i,a)=>a.indexOf(v)===i);
  const marginTicks=[marginMin,0,marginMax].filter((v,i,a)=>i===0||Math.abs(v-a[i-1])>1);

  const chartGrid=countTicks.map(v=>{
    const y=yCount(v);
    return `<g><line class="trend-gridline" x1="${plot.left}" x2="${plot.right}" y1="${y}" y2="${y}"/><text class="trend-y-label" x="${plot.left-12}" y="${y+4}" text-anchor="end">${v}</text></g>`;
  }).join("");

  const rightAxis=marginTicks.map(v=>{
    const y=yMargin(v);
    return `<text class="trend-margin-axis-label" x="748" y="${y+4}" text-anchor="end">${esc(axisMoney(v))}</text>`;
  }).join("");

  const chartBars=days.map((d,i)=>{
    const x=xAt(i);
    const barW=days.length<=3?30:days.length<=5?24:20;
    const y=yCount(d.count);
    const h=Math.max(3,plot.bottom-y);
    const dotY=yMargin(d.margin);
    const avg=d.count?d.margin/d.count:0;
    const groupStart=Math.floor(trendRange.start+i*((trendRange.end-trendRange.start+1)/days.length));
    const groupEnd=Math.floor(i===days.length-1?trendRange.end:trendRange.start+(i+1)*((trendRange.end-trendRange.start+1)/days.length)-1);
    return `<g class="trend-svg-day" tabindex="0" role="button"
      data-start="${groupStart}" data-end="${groupEnd}"
      data-label="${esc(d.label)}" data-count="${d.count}"
      data-margin="${Number(d.margin||0)}" data-avg="${Number(avg||0)}"
      aria-label="${esc(d.label)}: ${d.count} trips, margin ₹${money(d.margin)}">
      <rect class="trend-svg-hit" x="${Math.max(0,x-32)}" y="${plot.top-6}" width="64" height="${plot.bottom-plot.top+36}" rx="10"></rect>
      <rect class="trend-svg-bar" x="${x-barW/2}" y="${plot.bottom-h}" width="${barW}" height="${h}" rx="7">
        <title>${esc(d.label)} — ${d.count} trips</title>
      </rect>
      <circle class="trend-svg-dot-ring" cx="${x}" cy="${dotY}" r="7"></circle>
      <circle class="trend-svg-dot" cx="${x}" cy="${dotY}" r="4.25">
        <title>${esc(d.label)} — Margin ₹${money(d.margin)}</title>
      </circle>
      <text class="trend-bar-value" x="${x}" y="${Math.max(plot.top+9,plot.bottom-h-8)}" text-anchor="middle">${d.count||""}</text>
      <text class="trend-svg-label" x="${x}" y="216" text-anchor="middle">${esc(d.label)}</text>
    </g>`;
  }).join("");

  const chartHtml=`<div class="trend-plot">
    <svg class="trend-svg" viewBox="0 0 760 230" preserveAspectRatio="none" role="img" aria-label="Trip count and vehicle margin trend">
      <defs>
        <linearGradient id="tripBarGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#2d8cff"/>
          <stop offset="55%" stop-color="#116bd3"/>
          <stop offset="100%" stop-color="#0b438f"/>
        </linearGradient>
        <linearGradient id="marginLineGradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#7c3aed"/>
          <stop offset="55%" stop-color="#9d45f5"/>
          <stop offset="100%" stop-color="#f97316"/>
        </linearGradient>
        <filter id="trendSoftShadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#0b438f" flood-opacity=".18"/>
        </filter>
      </defs>
      ${chartGrid}
      <line class="trend-zero-line" x1="${plot.left}" x2="${plot.right}" y1="${zeroY}" y2="${zeroY}"></line>
      <text class="trend-axis-caption" x="${plot.left}" y="12">TRIPS</text>
      <text class="trend-axis-caption trend-axis-caption-right" x="748" y="12" text-anchor="end">MARGIN</text>
      ${rightAxis}
      <path class="trend-svg-line" d="${linePath}"></path>
      ${chartBars}
    </svg>
    <div class="trend-tooltip" id="trendTooltip" aria-hidden="true"></div>
  </div>`;

  const trendInsights=`
    <div class="trend-insights">
      <div class="trend-insight"><span>Trips</span><strong>${totalTrendTrips}</strong><small>Selected period</small></div>
      <div class="trend-insight"><span>Total Margin</span><strong class="${trendMargin<0?"negative":""}">${compact(trendMargin)}</strong><small>${trendMarginPct.toFixed(1)}% of revenue</small></div>
      <div class="trend-insight"><span>Avg / Trip</span><strong class="${avgMarginPerTrip<0?"negative":""}">${compact(avgMarginPerTrip)}</strong><small>Margin efficiency</small></div>
      <div class="trend-insight"><span>Best Period</span><strong>${esc(bestDay?.label||"-")}</strong><small>${bestDay?`${axisMoney(bestDay.margin)} margin`:"No data"}</small></div>
    </div>`;


  const hour=new Date().getHours();
  const greeting=hour<12?"Good Morning":hour<17?"Good Afternoon":"Good Evening";

  return `
  <section class="dashboard-topstrip">
    <div class="dashboard-filterbar compact-dashboard-filter">
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
    </div>

    <div id="dashboardSearchSlot" class="dashboard-search-slot"></div>
  </section>

  <section class="neo-kpis">
    <article class="neo-kpi cyan" role="button" tabindex="0" data-kpi="vehicles" aria-label="View vehicle details">
      <img src="./icon-vehicle.svg" alt="" />
      <div><span>Total Vehicles</span><strong>${activeVehicles.length}</strong><small>Active fleet</small></div>
    </article>
    <article class="neo-kpi purple" role="button" tabindex="0" data-kpi="trips" aria-label="View trip details">
      <img src="./icon-trips.svg" alt="" />
      <div><span>Total Trips</span><strong>${trips.length}</strong><small>${inTrip} currently active</small></div>
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
      <div class="trend-panel-head">
        <div class="trend-title-wrap"><span class="trend-title-icon">▥</span><div><h3>Vehicle Placement Trend</h3><p>Trip volume and margin performance for ${esc(trendRange.label)}</p></div></div>
        <div class="trend-header-actions">
          <select id="trendRange" aria-label="Trend period">
            <option value="thisWeek" ${state.trendFilter==="thisWeek"?"selected":""}>This Week</option>
            <option value="lastWeek" ${state.trendFilter==="lastWeek"?"selected":""}>Last Week</option>
            <option value="last7" ${state.trendFilter==="last7"?"selected":""}>Last 7 Days</option>
            <option value="thisMonth" ${state.trendFilter==="thisMonth"?"selected":""}>This Month</option>
            <option value="lastMonth" ${state.trendFilter==="lastMonth"?"selected":""}>Last Month</option>
          </select>
          <div class="legend"><span><i class="cyan-dot"></i>Trips</span><span><i class="purple-dot"></i>Margin</span></div>
        </div>
      </div>
      ${trendInsights}
      <div class="trend-chart">${chartHtml}</div>
    </article>

    <article class="neo-panel utilization-panel dashboard-drill" role="button" tabindex="0" data-drill="utilization">
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
        <div class="alert-row green dashboard-drill" role="button" tabindex="0" data-drill="completed"><b>✓</b><span>${completedToday} Trips Completed Today</span><em>›</em></div>
        <div class="alert-row orange dashboard-drill" role="button" tabindex="0" data-drill="placed"><b>🚚</b><span>${placed} Vehicles Placed</span><em>›</em></div>
        <div class="alert-row cyan dashboard-drill" role="button" tabindex="0" data-drill="transit"><b>➜</b><span>${transit} Vehicles In Transit</span><em>›</em></div>
        ${delayed? `<div class="alert-row purple dashboard-drill" role="button" tabindex="0" data-drill="delayed"><b>!</b><span>${delayed} Trip${delayed>1?"s":""} Delayed</span><em>›</em></div>`:""}
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
  const trendRangeSelect=$("#trendRange");
  if(trendRangeSelect){
    trendRangeSelect.addEventListener("change",e=>{
      state.trendFilter=e.target.value;
      render();
    });
  }

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

  const trendTooltip=$("#trendTooltip");
  const positionTrendTooltip=(group,event)=>{
    if(!trendTooltip)return;
    const plot=document.querySelector(".trend-plot");
    if(!plot)return;
    const plotRect=plot.getBoundingClientRect();
    let x=plotRect.width/2,y=74;
    if(event?.clientX){
      x=event.clientX-plotRect.left;
      y=event.clientY-plotRect.top-12;
    }else{
      const gRect=group.getBoundingClientRect();
      x=gRect.left-plotRect.left+gRect.width/2;
      y=gRect.top-plotRect.top+10;
    }
    x=Math.max(96,Math.min(plotRect.width-96,x));
    y=Math.max(64,Math.min(plotRect.height-18,y));
    trendTooltip.style.left=x+"px";
    trendTooltip.style.top=y+"px";
  };
  const showTrendTooltip=(group,event)=>{
    if(!trendTooltip)return;
    const marginValue=Number(group.dataset.margin||0);
    const avgValue=Number(group.dataset.avg||0);
    trendTooltip.innerHTML=`<strong>${esc(group.dataset.label||"Selected period")}</strong>
      <div><span>Trips</span><b>${Number(group.dataset.count||0)}</b></div>
      <div><span>Margin</span><b class="${marginValue<0?"negative":""}">₹ ${money(marginValue)}</b></div>
      <div><span>Avg / Trip</span><b class="${avgValue<0?"negative":""}">₹ ${money(avgValue)}</b></div>
      <small>Click for trip details</small>`;
    trendTooltip.classList.add("visible");
    trendTooltip.setAttribute("aria-hidden","false");
    positionTrendTooltip(group,event);
  };
  const hideTrendTooltip=()=>{
    if(!trendTooltip)return;
    trendTooltip.classList.remove("visible");
    trendTooltip.setAttribute("aria-hidden","true");
  };

  document.querySelectorAll(".trend-svg-day").forEach(group=>{
    group.addEventListener("mouseenter",e=>{setTrendFocus(group,false);showTrendTooltip(group,e);});
    group.addEventListener("mousemove",e=>positionTrendTooltip(group,e));
    group.addEventListener("mouseleave",()=>{clearTrendHover(group);hideTrendTooltip();});
    group.addEventListener("focus",()=>{setTrendFocus(group,false);showTrendTooltip(group);});
    group.addEventListener("blur",()=>{clearTrendHover(group);hideTrendTooltip();});
    group.addEventListener("click",()=>{setTrendFocus(group,true);hideTrendTooltip();openTrendDay(group);});
    group.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setTrendFocus(group,true);hideTrendTooltip();openTrendDay(group);}});
  });

  const openKpi=(type)=>{
    const range=getDashboardRange();
    const trips=state.trips.filter(t=>Number(t.createdAt||0)>=range.start&&Number(t.createdAt||0)<=range.end);
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
      modal("Margin Details", `<div class="mini-summary"><span>Total Vehicle Margin</span><strong>₹ ${money(total)} <small>(${pct.toFixed(1)}%)</small></strong></div><div class="mini-list">${rows.map(t=>`<div class="mini-row margin-breakdown-row"><div class="grow"><strong>${esc(t.vehicle||"-")}</strong><small>${esc(t.from||"-")} → ${esc(t.to||"-")}</small><small>Freight ₹ ${money(t.freight)} · Fuel ₹ ${money(t.fuelExpense)} · Loading ₹ ${money(t.loadingExpense)} · Unloading ₹ ${money(t.unloadingExpense)} · FASTag ₹ ${money(t.fastag)} · RTO/Tarpaulin ₹ ${money(t.rtoTarpaulin)} · Fixed ₹ ${money(t.fixedExpenses)} · Other ₹ ${money(t.percentageExpense)}${Number(t.legacyLoadingUnloadingExpense||0)?` · Legacy L/U ₹ ${money(t.legacyLoadingUnloadingExpense)}`:""}${t.legacyHandlingCorrected?" · Legacy total corrected":""}${t.legacyDecimalCorrected?" · Decimal ×100 corrected":""}</small><small>Total Expenses ₹ ${money(t.totalExpenses)}</small></div><span>₹ ${money(t.margin)}</span></div>`).join("")}</div>`);
      return;
    }
    if(type==="utilization"){
      const rows=state.vehicles.filter(v=>v.active!==false).map(v=>({v,av:vehicleAvailability(v)}));
      modal("Fleet Utilization",`<div class="mini-list">${rows.map(x=>`<div class="mini-row"><div><strong>${esc(x.v.number)}</strong><small>${Number(x.v.mileage||0).toFixed(1)} km/L</small></div><span class="availability-badge ${esc(x.av.key)}">${esc(x.av.label)}</span></div>`).join("")}</div>`);
      return;
    }
    const statusRows=type==="completed"
      ? trips.filter(t=>t.status==="Completed"&&Number(t.statusUpdatedAt||0)>=new Date().setHours(0,0,0,0))
      : type==="placed"?trips.filter(t=>t.status==="Vehicle Placed")
      : type==="transit"?trips.filter(t=>t.status==="In Transit")
      : type==="delayed"?trips.filter(t=>!["Completed","Cancelled"].includes(t.status)&&Number(t.transitHours||0)>0&&Number(t.createdAt||0)+Number(t.transitHours||0)*3600000<Date.now())
      : [];
    if(statusRows.length||["completed","placed","transit","delayed"].includes(type)){
      const title=type==="completed"?"Completed Today":type==="placed"?"Vehicles Placed":type==="transit"?"In Transit":"Delayed Trips";
      modal(title,statusRows.length?`<div class="mini-list">${statusRows.map(t=>`<div class="mini-row"><div><strong>${esc(displayTripNumber(t))} · ${esc(t.vehicle||"-")}</strong><small>${esc(t.from||"-")} → ${esc(t.to||"-")}</small></div><span>${statusBadge(t.status)}</span></div>`).join("")}</div>`:'<div class="empty">No matching trips.</div>');
    }
  };
  document.querySelectorAll(".neo-kpi[data-kpi]").forEach(card=>{
    card.addEventListener("click",()=>openKpi(card.dataset.kpi));
    card.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openKpi(card.dataset.kpi);}});
  });
  document.querySelectorAll("[data-drill]").forEach(el=>{
    el.addEventListener("click",()=>openKpi(el.dataset.drill));
    el.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openKpi(el.dataset.drill);}});
  });
  $("#copyDailySummary")?.addEventListener("click",async()=>{
    const start=new Date();start.setHours(0,0,0,0);
    const today=state.trips.filter(t=>Number(t.createdAt||0)>=start.getTime());
    const revenue=today.reduce((s,t)=>s+Number(t.freight||0),0);
    const margin=today.reduce((s,t)=>s+Number(t.margin||0),0);
    const active=state.trips.filter(t=>isTripOpenStatus(t.status)).length;
    const transit=state.trips.filter(t=>t.status==="In Transit").length;
    const completed=state.trips.filter(t=>t.status==="Completed"&&Number(t.statusUpdatedAt||0)>=start.getTime()).length;
    const low=today.filter(t=>Number(t.margin||0)<0||Number(t.marginPercent||0)<Number(state.minMarginPercent||10)).length;
    const delayed=state.trips.filter(t=>isTripOpenStatus(t.status)&&Number(t.transitHours||0)>0&&Number(t.createdAt||0)+Number(t.transitHours||0)*3600000<Date.now()).length;
    const text=[
      "CUBE Logistics — Daily Operations Summary",
      new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}),
      "",
      "Trips Created: "+today.length,
      "Active Trips: "+active,
      "In Transit: "+transit,
      "Completed Today: "+completed,
      "Revenue: ₹"+money(revenue),
      "Margin: ₹"+money(margin),
      "Low Margin Trips: "+low,
      "Delayed Trips: "+delayed
    ].join("\n");
    try{await navigator.clipboard.writeText(text);toast("Daily summary copied");}
    catch{toast("Unable to copy summary");}
  });
}

function statusBadge(s){
 const status=s||"Vehicle Placed";
 const c=status==="Completed"?"completed":status==="Cancelled"?"cancelled":status==="In Transit"?"transit":status==="Loading"?"loading":status==="Reached"?"reached":status==="Unloading"?"unloading":status==="Created"?"created":"placed";
 return `<span class="badge ${c}">${esc(status)}</span>`;
}
function tripTable(rows,actions=true){
 if(!rows.length)return '<div class="card empty">No trips available.</div>';
 return `<div class="table-wrap"><table><thead><tr><th>Trip ID</th><th>Date</th><th>Vehicle</th><th>Route</th><th>Vendor</th><th>Status</th><th>Freight</th><th>Margin</th><th>Audit</th>${actions?"<th>Actions</th>":""}</tr></thead><tbody>${rows.map(t=>`<tr>
 <td><strong class="trip-number">${esc(displayTripNumber(t))}</strong></td><td>${esc(dateTime(t.createdAt))}</td><td><strong>${esc(t.vehicle)}</strong></td><td>${esc(t.from)} → ${esc(t.to)}</td><td>${esc(t.vendor)}</td><td>${statusBadge(t.status)}</td>
 <td>₹ ${money(t.freight)}</td><td>₹ ${money(t.margin)} (${Number(t.marginPercent||0).toFixed(1)}%)</td>
 <td><div class="audit">Created: ${esc(t.createdBy||t.createdByEmail||"Legacy")}</div><div class="audit">Status: ${esc(t.statusUpdatedBy||t.statusUpdatedByEmail||"-")} · ${esc(dateTime(t.statusUpdatedAt))}</div></td>
 ${actions?`<td class="actions compact-actions"><div class="trip-action-menu"><button class="secondary trip-actions-toggle" type="button" data-id="${esc(t.id)}" aria-expanded="false">Actions <span>▾</span></button><div class="trip-actions-panel hidden" data-menu-for="${esc(t.id)}"><button class="trip-action-item status-btn" data-id="${esc(t.id)}">Status</button><button class="trip-action-item docs-trip" data-id="${esc(t.id)}">Documents${(t.attachments||[]).length?` (${(t.attachments||[]).length})`:""}</button><button class="trip-action-item audit-trip" data-id="${esc(t.id)}">History</button>${isAdmin()?'<button class="trip-action-item edit-trip" data-id="'+esc(t.id)+'">Edit</button>':''}${canDeleteTrips()?'<button class="trip-action-item danger-item delete-trip" data-id="'+esc(t.id)+'">Delete</button>':''}</div></div></td>`:""}
 </tr>`).join("")}</tbody></table></div>`;
}

function tripsHtml(){
 const vendorOptions=[...new Set(state.trips.map(t=>t.vendor).filter(Boolean))].sort();
 const vehicleOptions=[...new Set(state.trips.map(t=>t.vehicle).filter(Boolean))].sort();
 return `<div class="section-head trip-search-head"><div><h3>Trip List</h3><p>Search and filter live trip records</p></div></div>
 <div class="advanced-search card">
   <div class="advanced-search-grid">
     <label><span>Search</span><input id="tripSearch" placeholder="Trip ID, vehicle, vendor, route, creator..."></label>
     <label><span>Status</span><select id="tripStatusFilter"><option>All Status</option>${TRIP_STATUSES.map(x=>`<option>${esc(x)}</option>`).join("")}</select></label>
     <label><span>Vehicle</span><select id="tripVehicleFilter"><option value="">All Vehicles</option>${vehicleOptions.map(x=>`<option>${esc(x)}</option>`).join("")}</select></label>
     <label><span>Vendor</span><select id="tripVendorFilter"><option value="">All Vendors</option>${vendorOptions.map(x=>`<option>${esc(x)}</option>`).join("")}</select></label>
     <label><span>From Date</span><input id="tripDateFrom" type="date"></label>
     <label><span>To Date</span><input id="tripDateTo" type="date"></label>
   </div>
   <div class="advanced-search-footer"><span id="tripResultCount">${state.trips.length} trips</span><button id="clearTripFilters" class="secondary" type="button">Clear Filters</button></div>
 </div>
 <div id="tripTableHost">${tripTable(state.trips)}</div>`;
}
function wireTrips(){
 const apply=()=>{
   const q=($("#tripSearch")?.value||"").trim().toLowerCase();
   const status=$("#tripStatusFilter")?.value||"All Status";
   const vehicle=$("#tripVehicleFilter")?.value||"";
   const vendor=$("#tripVendorFilter")?.value||"";
   const from=$("#tripDateFrom")?.value||"";
   const to=$("#tripDateTo")?.value||"";
   const fromMs=from?new Date(from+"T00:00:00").getTime():0;
   const toMs=to?new Date(to+"T23:59:59.999").getTime():Number.MAX_SAFE_INTEGER;
   const rows=state.trips.filter(t=>{
     const created=Number(t.createdAt||0);
     const haystack=[
       t.tripNumber,t.id,t.vehicle,t.vendor,t.currentLocation,t.from,t.to,t.status,t.createdBy,t.createdByEmail,
       dateTime(t.createdAt)
     ].join(" ").toLowerCase();
     return (status==="All Status"||(t.status||"Vehicle Placed")===status)
       &&(!vehicle||t.vehicle===vehicle)
       &&(!vendor||t.vendor===vendor)
       &&created>=fromMs&&created<=toMs
       &&(!q||haystack.includes(q));
   });
   $("#tripTableHost").innerHTML=tripTable(rows);
   const count=$("#tripResultCount");if(count)count.textContent=rows.length+" trip"+(rows.length===1?"":"s");
   wireTripButtons();
 };
 ["tripSearch","tripStatusFilter","tripVehicleFilter","tripVendorFilter","tripDateFrom","tripDateTo"].forEach(id=>{
   $("#"+id)?.addEventListener(id==="tripSearch"?"input":"change",apply);
 });
 $("#clearTripFilters")?.addEventListener("click",()=>{
   ["tripSearch","tripVehicleFilter","tripVendorFilter","tripDateFrom","tripDateTo"].forEach(id=>{const el=$("#"+id);if(el)el.value="";});
   if($("#tripStatusFilter"))$("#tripStatusFilter").value="All Status";
   apply();
 });
 wireTripButtons();
}
if(!document.documentElement.dataset.tripActionOutsideHandler){
 document.documentElement.dataset.tripActionOutsideHandler="1";
 document.addEventListener("click",e=>{
   if(!e.target.closest(".trip-action-menu"))closeTripActionMenus();
 });
}
function closeTripActionMenus(except=null){
 document.querySelectorAll(".trip-actions-panel").forEach(panel=>{
   if(panel!==except)panel.classList.add("hidden");
 });
 document.querySelectorAll(".trip-actions-toggle").forEach(btn=>{
   const panel=document.querySelector('[data-menu-for="'+CSS.escape(btn.dataset.id)+'"]');
   btn.setAttribute("aria-expanded",panel&&!panel.classList.contains("hidden")?"true":"false");
 });
}
function wireTripButtons(){
 document.querySelectorAll(".trip-actions-toggle").forEach(btn=>btn.onclick=e=>{
   e.stopPropagation();
   const panel=document.querySelector('[data-menu-for="'+CSS.escape(btn.dataset.id)+'"]');
   if(!panel)return;
   const opening=panel.classList.contains("hidden");
   closeTripActionMenus(panel);
   panel.classList.toggle("hidden",!opening);
   btn.setAttribute("aria-expanded",opening?"true":"false");
 });
 document.querySelectorAll(".status-btn").forEach(b=>b.onclick=()=>{closeTripActionMenus();openStatus(b.dataset.id);});
 document.querySelectorAll(".delete-trip").forEach(b=>b.onclick=()=>{closeTripActionMenus();deleteTrip(b.dataset.id);});
 document.querySelectorAll(".edit-trip").forEach(b=>b.onclick=()=>{closeTripActionMenus();openEditTrip(b.dataset.id);});
 document.querySelectorAll(".audit-trip").forEach(b=>b.onclick=()=>{closeTripActionMenus();openTripAudit(b.dataset.id);});
 document.querySelectorAll(".docs-trip").forEach(b=>b.onclick=()=>{closeTripActionMenus();openTripDocuments(b.dataset.id);});
}

async function openTripDocuments(tripId){
 const t=state.trips.find(x=>x.id===tripId);if(!t)return;
 const renderDocs=()=>{
   const current=state.trips.find(x=>x.id===tripId)||t;
   const files=current.attachments||[];
   return `
     <div class="document-panel">
       <div class="document-trip-head"><strong>${esc(displayTripNumber(current))}</strong><span>${esc(current.vehicle||"")} · ${esc(current.from||"")} → ${esc(current.to||"")}</span></div>
       <div class="document-list">${files.length?files.map(a=>`<div class="document-row">
         <div class="document-icon">📎</div>
         <div class="grow"><a href="${esc(a.url||"#")}" target="_blank" rel="noopener"><strong>${esc(a.name||"Document")}</strong></a><small>${esc(a.category||"Proof")} · ${a.size?Math.round(a.size/1024)+" KB":""} · ${esc(dateTime(a.uploadedAt))}</small></div>
         ${isAdmin()?`<button class="danger delete-document" data-doc-id="${esc(a.id)}">Delete</button>`:""}
       </div>`).join(""):'<div class="empty">No documents attached yet.</div>'}</div>
       ${canCreateTrips()?`<div class="document-upload">
         <label><span>Document Type</span><select id="docCategory"><option>LR Copy</option><option>POD</option><option>Invoice</option><option>FASTag Receipt</option><option>RTO Receipt</option><option>Loading Proof</option><option>Unloading Proof</option><option>Other</option></select></label>
         <label><span>Select File</span><input id="docFile" type="file" accept=".pdf,image/*"></label>
         <button id="uploadTripDocument" class="primary" type="button">Upload Document</button>
         <p class="note">PDF or image, maximum 10 MB.</p>
       </div>`:""}
     </div>`;
 };
 const m=modal("Trip Documents",renderDocs());
 const wire=()=>{
   const upload=m.querySelector("#uploadTripDocument");
   if(upload)upload.onclick=async()=>{
     const file=m.querySelector("#docFile")?.files?.[0];
     const category=m.querySelector("#docCategory")?.value||"Other";
     if(!file){toast("Select a document first");return;}
     if(file.size>10*1024*1024){toast("File must be 10 MB or smaller");return;}
     const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
     const path="tripDocuments/"+tripId+"/"+Date.now()+"-"+safeName;
     try{
       setSync("Uploading...",true,"saving");
       const objectRef=storageRef(storage,path);
       await uploadBytes(objectRef,file,{contentType:file.type||"application/octet-stream"});
       const url=await getDownloadURL(objectRef);
       const current=state.trips.find(x=>x.id===tripId)||t;
       const attachment={id:uid(),name:file.name,category,type:file.type||"",size:file.size,path,url,uploadedAt:Date.now(),uploadedBy:state.profile.username};
       await persistTrip(tripId,{attachments:[...(current.attachments||[]),attachment]},true,"DOCUMENT");
       await createLiveNotification("Document Added",displayTripNumber(current)+" · "+category,tripId,"document");
       m.querySelector(".modal-body").innerHTML=renderDocs();
       wire();toast("Document uploaded");
     }catch(error){console.error(error);setSync("Sync error",false,"error");toast("Document upload failed");}
   };
   m.querySelectorAll(".delete-document").forEach(btn=>btn.onclick=async()=>{
     if(!confirm("Delete this document?"))return;
     const current=state.trips.find(x=>x.id===tripId)||t;
     const attachment=(current.attachments||[]).find(a=>a.id===btn.dataset.docId);
     if(!attachment)return;
     try{
       if(attachment.path)await deleteObject(storageRef(storage,attachment.path)).catch(()=>{});
       await persistTrip(tripId,{attachments:(current.attachments||[]).filter(a=>a.id!==attachment.id)},true,"DOCUMENT");
       m.querySelector(".modal-body").innerHTML=renderDocs();wire();toast("Document deleted");
     }catch(error){console.error(error);toast("Unable to delete document");}
   });
 };
 wire();
}

async function openTripAudit(tripId){
 const m=modal("Trip History",'<div class="empty">Loading history...</div>');
 try{
   const snap=await getDocs(collection(db,"tripAudit"));
   const rows=snap.docs.map(d=>d.data()).filter(x=>x.tripId===tripId).sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0));
   m.querySelector(".modal-body").innerHTML=rows.length?`
     <div class="audit-timeline">${rows.map(a=>`<div class="audit-event">
       <div class="audit-event-head"><strong>${esc(a.action||"UPDATE")}</strong><span>${esc(dateTime(a.createdAt))}</span></div>
       <div class="audit-event-user">${esc(a.username||a.email||"User")}${a.note?" · "+esc(a.note):""}</div>
       ${(a.changes||[]).length?`<div class="audit-changes">${a.changes.map(c=>`<div><b>${esc(c.label||c.field)}</b><span>${esc(c.before||"—")} → ${esc(c.after||"—")}</span></div>`).join("")}</div>`:'<div class="audit-event-user">No field-level changes recorded.</div>'}
     </div>`).join("")}</div>`
     :'<div class="empty">No audit history recorded for this trip yet.</div>';
 }catch(error){
   console.error(error);
   m.querySelector(".modal-body").innerHTML='<div class="empty">Unable to load audit history.</div>';
 }
}

function modal(title,html){
 const frag=$("#modalTemplate").content.cloneNode(true),back=frag.querySelector(".modal-backdrop");back.querySelector("h3").textContent=title;back.querySelector(".modal-body").innerHTML=html;back.querySelector(".modal-close").onclick=()=>back.remove();back.addEventListener("click",e=>{if(e.target===back)back.remove();});document.body.appendChild(back);return back;
}
function openStatus(id){
 const t=state.trips.find(x=>x.id===id);if(!t)return;
 const m=modal("Update Trip Status",`<label>Trip Status<select id="statusSelect">${TRIP_STATUSES.map(x=>`<option>${esc(x)}</option>`).join("")}</select></label><p class="note">Current: ${esc(t.status||"Vehicle Placed")}</p><button id="saveStatus" class="primary wide">Update Status</button>`);
 m.querySelector("#statusSelect").value=t.status||"Vehicle Placed";
 m.querySelector("#saveStatus").onclick=async()=>{
   const status=m.querySelector("#statusSelect").value;
   const oldStatus=t.status||"Vehicle Placed";
   await persistTrip(id,{status,statusUpdatedBy:state.profile.username,statusUpdatedByEmail:state.profile.loginEmail,statusUpdatedAt:Date.now()},true,"STATUS");
   if(status!==oldStatus){
     await createLiveNotification("Trip Status: "+status,(t.vehicle||"Vehicle")+" updated by "+state.profile.username,id,"trip_status");
   }
   m.remove();toast("Trip status updated");
 };
}
async function deleteTrip(id){
 if(!confirm("Delete this trip permanently?"))return;
 const t=state.trips.find(x=>x.id===id);
 await removeTripFromDatabase(id);
 if(t)await createLiveNotification("Trip Deleted",displayTripNumber(t)+" · "+(t.vehicle||"Vehicle")+" deleted by "+state.profile.username,id,"trip_delete");
 toast("Trip deleted");
}

const TRIP_STATUSES=["Created","Vehicle Placed","Loading","In Transit","Reached","Unloading","Completed","Cancelled"];
const ACTIVE_TRIP_STATUSES=new Set(["Created","Vehicle Placed","Loading","In Transit","Reached","Unloading"]);

function isTripOpenStatus(status){
  return ACTIVE_TRIP_STATUSES.has(status||"Vehicle Placed");
}
function activeTripForVehicle(vehicle,excludeId=""){
  return state.trips.find(t=>t.id!==excludeId&&t.vehicle===vehicle&&isTripOpenStatus(t.status));
}
function vehicleAvailability(vehicleOrNumber,excludeTripId=""){
  const vehicle=typeof vehicleOrNumber==="string"
    ? state.vehicles.find(v=>v.number===vehicleOrNumber)
    : vehicleOrNumber;
  if(!vehicle) return {key:"unknown",label:"Unknown"};
  if(vehicle.active===false) return {key:"maintenance",label:"Maintenance / Inactive"};
  const trip=activeTripForVehicle(vehicle.number,excludeTripId);
  if(!trip) return {key:"available",label:"Available"};
  const status=trip.status||"Vehicle Placed";
  if(status==="In Transit") return {key:"transit",label:"In Transit",trip};
  if(["Reached","Unloading"].includes(status)) return {key:"unloading",label:"At Unloading",trip};
  if(status==="Loading") return {key:"loading",label:"Loading",trip};
  if(status==="Created") return {key:"reserved",label:"Reserved",trip};
  return {key:"assigned",label:"Vehicle Placed",trip};
}
function vehiclePickerOptions(selected="",excludeTripId=""){
  return state.vehicles.map(v=>{
    const availability=vehicleAvailability(v,excludeTripId);
    const disabled=availability.key!=="available"&&v.number!==selected;
    return `<option value="${esc(v.number)}" ${v.number===selected?"selected":""} ${disabled?"disabled":""}>${esc(v.number)} — ${esc(availability.label)}</option>`;
  }).join("");
}
function showDuplicateTrip(existing){
  modal("Vehicle Already Assigned",`
    <div class="duplicate-warning">
      <strong>${esc(existing.vehicle||"Vehicle")} already has an active trip.</strong>
      <p>${esc(existing.from||"-")} → ${esc(existing.to||"-")}</p>
      <div class="mini-summary">
        <div><span>Status</span><strong>${esc(existing.status||"Vehicle Placed")}</strong></div>
        <div><span>Created</span><strong>${esc(dateTime(existing.createdAt))}</strong></div>
        <div><span>Trip</span><strong>${esc(displayTripNumber(existing))}</strong></div>
      </div>
      <p class="note">Complete or cancel the current trip before creating another active trip for this vehicle.</p>
    </div>
  `);
}

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
  <label><span>Vehicle No</span><select id="fVehicle" required><option value="" selected disabled>Select Vehicle No</option>${vehiclePickerOptions()}</select><small class="field-help">Only available vehicles can be selected.</small></label>
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
  <label><span>Loading Expense</span><input id="fLoad" type="number" min="0" step="0.01"></label>
  <label><span>Unloading Expense</span><input id="fUnload" type="number" min="0" step="0.01"></label>
  <label><span>Other Expense %</span><input id="fPct" type="number" min="0" step="0.01"></label>
  <label><span>FASTag</span><input id="fFastag" type="number" min="0" step="0.01"></label>
  <label><span>RTO / Tarpaulin</span><input id="fRto" type="number" min="0" step="0.01"></label>
  <label><span>Fixed Expenses</span><input id="fFixed" type="number" min="0" step="0.01"></label>
 </div>
 <div class="summary-row"><div class="summary"><span>Fuel Rate</span><strong>₹ ${money(state.fuelRate)}/L</strong></div><div class="summary"><span>Initial Status</span><strong>Created</strong></div><div class="summary"><span>Created By</span><strong>${esc(state.profile.username)}</strong></div></div>
 <div id="profitabilityPreview" class="profitability-preview neutral">
   <div><span>Estimated Margin</span><strong>Enter freight and expenses</strong></div>
   <small>Margin warning threshold: ${Number(state.minMarginPercent||10).toFixed(1)}%</small>
 </div>
 <button class="primary" style="margin-top:16px" type="submit">Save Trip</button>
 </form>`;
}
function wireNewTrip(){
 const form=$("#tripForm");
 if(form){
   form.reset();
   ["fFreight","fAdvance","fWeight","fKm","fHours","fOriginKm","fLoad","fUnload","fPct","fFastag","fRto","fFixed"].forEach(id=>{const el=$("#"+id);if(el)el.value="";});
 }
 const v=$("#fVehicle");const setMileage=()=>{const rec=state.vehicles.find(x=>x.number===v.value);$("#fMileage").value=rec?Number(rec.mileage).toFixed(1):"";previewProfitability();};
 const formNumber=id=>parseMoneyValue($("#"+id)?.value);
 const previewProfitability=()=>{
   const preview=$("#profitabilityPreview"); if(!preview)return null;
   const freight=formNumber("fFreight");
   if(freight<=0){
     preview.className="profitability-preview neutral";
     preview.innerHTML='<div><span>Estimated Margin</span><strong>Enter freight and expenses</strong></div><small>Margin warning threshold: '+Number(state.minMarginPercent||10).toFixed(1)+'%</small>';
     return null;
   }
   const temp=calcTrip({
     freight,netFreight:freight,
     totalKm:formNumber("fKm"),mileage:Number($("#fMileage")?.value||0),fuelRate:state.fuelRate,
     fixedExpenses:formNumber("fFixed"),fastag:formNumber("fFastag"),rtoTarpaulin:formNumber("fRto"),
     loadingUnloading:0,loadingExpensePerTon:formNumber("fLoad"),unloadingExpensePerTon:formNumber("fUnload"),
     expenseCalcVersion:3,weightTon:formNumber("fWeight"),
     expenseRules:formNumber("fPct")>0?[{name:"Other Expense",percent:formNumber("fPct")}]:[]
   });
   const threshold=Number(state.minMarginPercent||10);
   const health=temp.margin<0?"danger":temp.marginPercent<threshold?"warning":"healthy";
   const label=temp.margin<0?"Negative Margin":temp.marginPercent<threshold?"Low Margin":"Healthy Margin";
   preview.className="profitability-preview "+health;
   preview.innerHTML='<div><span>'+label+'</span><strong>₹ '+money(temp.margin)+' · '+temp.marginPercent.toFixed(1)+'%</strong></div><small>Total expense ₹ '+money(temp.totalExpenses)+' · Minimum target '+threshold.toFixed(1)+'%</small>';
   return temp;
 };
 ["fFreight","fWeight","fKm","fLoad","fUnload","fPct","fFastag","fRto","fFixed","fMileage"].forEach(id=>{
   $("#"+id)?.addEventListener("input",previewProfitability);
   $("#"+id)?.addEventListener("change",previewProfitability);
 });
 v.addEventListener("change",setMileage);
 previewProfitability();
 $("#tripForm").addEventListener("submit",async e=>{e.preventDefault();
 const n=id=>Number($("#"+id).value||0);
 const m=id=>parseMoneyValue($("#"+id).value);
 const now=Date.now(),id=uid(),freight=m("fFreight"),pct=n("fPct");
 const weight=m("fWeight"),loadPerTon=m("fLoad"),unloadPerTon=m("fUnload");
 const selectedVehicle=$("#fVehicle").value;
 const existing=activeTripForVehicle(selectedVehicle);
 if(existing){showDuplicateTrip(existing);return;}
 const preview=previewProfitability();
 const threshold=Number(state.minMarginPercent||10);
 if(preview && (preview.margin<0 || preview.marginPercent<threshold)){
   const ok=confirm((preview.margin<0?"Negative":"Low")+" margin: ₹ "+money(preview.margin)+" ("+preview.marginPercent.toFixed(1)+"%). Save this trip anyway?");
   if(!ok)return;
 }
 const tripNumber=await nextTripNumber(now);
 const trip={id,tripNumber,createdAt:now,vendor:$("#fVendor").value,vehicle:selectedVehicle,currentLocation:$("#fCurrent").value,from:$("#fFrom").value,to:$("#fTo").value,freight,netFreight:freight,advance:m("fAdvance"),weightTon:weight,currentToOriginKm:m("fOriginKm"),totalKm:m("fKm"),transitHours:m("fHours"),mileage:n("fMileage"),fuelRate:state.fuelRate,fixedExpenses:m("fFixed"),fastag:m("fFastag"),rtoTarpaulin:m("fRto"),loadingUnloading:0,loadingExpensePerTon:loadPerTon,unloadingExpensePerTon:unloadPerTon,expenseCalcVersion:3,numericDataVersion:2,expenseRules:pct>0?[{name:"Other Expense",percent:pct}]:[],createdBy:state.profile.username,createdByEmail:state.profile.loginEmail,status:"Created",statusUpdatedBy:state.profile.username,statusUpdatedByEmail:state.profile.loginEmail,statusUpdatedAt:now,updatedAt:now};
 await persistTrip(id,trip,false,"CREATE");
 await createLiveNotification("New Trip Created",trip.vehicle+" — "+trip.from+" → "+trip.to,id,"trip_created");
 const savedCalc=calcTrip(trip);
 if(savedCalc.margin<0 || savedCalc.marginPercent<Number(state.minMarginPercent||10)){
   await createLiveNotification("Margin Warning",trip.vehicle+" margin ₹"+money(savedCalc.margin)+" ("+savedCalc.marginPercent.toFixed(1)+"%)",id,"margin_warning");
 }
 toast("Trip created");navigate("trips");});
}

function openEditTrip(id){
 const t=state.trips.find(x=>x.id===id);if(!t||!isAdmin())return;
 const pct=Number(t.expenseRules?.[0]?.percent||0);
 const m=modal("Edit Trip",`<div class="form-grid">
 <label><span>Vendor</span><select id="eVendor">${picker(state.vendors.map(x=>x.name),t.vendor)}</select></label>
 <label><span>Vehicle</span><select id="eVehicle">${vehiclePickerOptions(t.vehicle,t.id)}</select></label>
 <label><span>Current Location</span><select id="eCurrent">${picker(state.locations.map(x=>x.name),t.currentLocation)}</select></label>
 <label><span>From</span><select id="eFrom">${picker(state.locations.map(x=>x.name),t.from)}</select></label>
 <label><span>To</span><select id="eTo">${picker(state.locations.map(x=>x.name),t.to)}</select></label>
 <label><span>Freight</span><input id="eFreight" type="number" step="0.01" value="${moneyInputValue(t.freight||0)}"></label>
 <label><span>Advance</span><input id="eAdvance" type="number" step="0.01" value="${moneyInputValue(t.advance||0)}"></label>
 <label><span>Weight (Ton)</span><input id="eWeight" type="number" step="0.01" value="${moneyInputValue(t.weightTon||0)}"></label>
 <label><span>Trip KM</span><input id="eKm" type="number" step="0.01" value="${moneyInputValue(t.totalKm||0)}"></label>
 <label><span>Origin KM</span><input id="eOriginKm" type="number" step="0.01" value="${moneyInputValue(t.currentToOriginKm||0)}"></label>
 <label><span>Transit Hours</span><input id="eHours" type="number" step="0.01" value="${moneyInputValue(t.transitHours||0)}"></label>
 <label><span>Mileage</span><input id="eMileage" type="number" step="0.1" min="2.5" max="6.0" value="${Number(t.mileage||0).toFixed(1)}"></label>
 <label><span>Loading Expense</span><input id="eLoad" type="number" step="0.01" value="${moneyInputValue(t.loadingExpense||t.loadingExpensePerTon||0)}"></label>
 <label><span>Unloading Expense</span><input id="eUnload" type="number" step="0.01" value="${moneyInputValue(t.unloadingExpense||t.unloadingExpensePerTon||0)}"></label>
 <label><span>Other Expense %</span><input id="ePct" type="number" step="0.01" value="${moneyInputValue(pct)}"></label>
 <label><span>FASTag</span><input id="eFastag" type="number" step="0.01" value="${moneyInputValue(t.fastag||0)}"></label>
 <label><span>RTO / Tarpaulin</span><input id="eRto" type="number" step="0.01" value="${moneyInputValue(t.rtoTarpaulin||0)}"></label>
 <label><span>Fixed Expenses</span><input id="eFixed" type="number" step="0.01" value="${moneyInputValue(t.fixedExpenses||0)}"></label>
 </div><button id="saveEditTrip" class="primary wide" style="margin-top:14px">Update Trip</button>`);
 const n=id=>Number(m.querySelector(id)?.value||0);
 const moneyN=id=>parseMoneyValue(m.querySelector(id)?.value);
 m.querySelector("#saveEditTrip").onclick=async()=>{
   const freight=moneyN("#eFreight"), mileage=n("#eMileage"), pctValue=moneyN("#ePct");
   const selectedVehicle=m.querySelector("#eVehicle").value;
   const conflicting=activeTripForVehicle(selectedVehicle,id);
   if(conflicting){showDuplicateTrip(conflicting);return;}
   if(freight<=0){toast("Enter a valid freight amount");return;}
   if(mileage<2.5||mileage>6.0){toast("Mileage must be between 2.5 and 6.0");return;}
   const patch={
     vendor:m.querySelector("#eVendor").value,
     vehicle:m.querySelector("#eVehicle").value,
     currentLocation:m.querySelector("#eCurrent").value,
     from:m.querySelector("#eFrom").value,
     to:m.querySelector("#eTo").value,
     freight,netFreight:freight,
     advance:moneyN("#eAdvance"),
     weightTon:moneyN("#eWeight"),
     totalKm:moneyN("#eKm"),
     currentToOriginKm:moneyN("#eOriginKm"),
     transitHours:moneyN("#eHours"),
     mileage,
     fuelRate:state.fuelRate,
     loadingExpensePerTon:moneyN("#eLoad"),
     unloadingExpensePerTon:moneyN("#eUnload"),
     loadingUnloading:0,
     expenseRules:pctValue>0?[{name:"Other Expense",percent:pctValue}]:[],
     fastag:moneyN("#eFastag"),
     rtoTarpaulin:moneyN("#eRto"),
     fixedExpenses:moneyN("#eFixed"),
     expenseCalcVersion:3,
     numericDataVersion:2,
     updatedAt:Date.now()
   };
   await persistTrip(id,patch,true,"EDIT");
   const updated=calcTrip({...t,...patch});
   state.trips=state.trips.map(x=>x.id===id?updated:x);
   await createLiveNotification("Trip Updated",displayTripNumber(updated)+" · "+updated.vehicle+" updated by "+state.profile.username,id,"trip_edit");
   if(updated.margin<0 || updated.marginPercent<Number(state.minMarginPercent||10)){
     await createLiveNotification("Margin Warning",displayTripNumber(updated)+" margin ₹"+money(updated.margin)+" ("+updated.marginPercent.toFixed(1)+"%)",id,"margin_warning");
   }
   m.remove();
   render();
   toast("Trip updated");
 };
}

function masterHtml(type){
 if(!canManageMasters())return '<div class="card empty">You do not have permission to manage masters.</div>';
 const data=type==="vehicles"?state.vehicles:type==="vendors"?state.vendors:state.locations;
 const singular=type==="vehicles"?"Vehicle":type==="vendors"?"Vendor":"Location";
 return `<div class="section-head"><h3>${singular} Master</h3><button id="addMaster" class="primary">+ Add ${singular}</button></div>
 <div class="list">${data.map(x=>{const key=type==="vehicles"?x.number:x.name;const av=type==="vehicles"?vehicleAvailability(x):null;return `<div class="list-row"><div class="grow"><strong>${esc(key)}</strong><small>${type==="vehicles"?esc(Number(x.mileage).toFixed(1)+" km/L"):(x.active===false?"Inactive":"Active")}</small></div>${type==="vehicles"?`<span class="availability-badge ${av.key}">${esc(av.label)}</span>`:""}${isAdmin()?`<button class="secondary edit-master" data-key="${esc(key)}">Edit</button><button class="danger delete-master" data-key="${esc(key)}">Delete</button>`:""}</div>`}).join("")}</div>`;
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

function vendorPerformanceRows(){
 const groups=new Map();
 state.trips.forEach(t=>{
   const key=t.vendor||"Unassigned";
   const g=groups.get(key)||{vendor:key,trips:0,freight:0,margin:0,km:0,weight:0,completed:0,cancelled:0};
   g.trips++;g.freight+=Number(t.freight||0);g.margin+=Number(t.margin||0);
   g.km+=Number(t.totalKm||0);g.weight+=Number(t.weightTon||0);
   if(t.status==="Completed")g.completed++;
   if(t.status==="Cancelled")g.cancelled++;
   groups.set(key,g);
 });
 return [...groups.values()].map(g=>({
   ...g,
   avgMargin:g.trips?g.margin/g.trips:0,
   freightPerKm:g.km?g.freight/g.km:0,
   freightPerTon:g.weight?g.freight/g.weight:0,
   completionRate:g.trips?g.completed/g.trips*100:0
 })).sort((a,b)=>b.margin-a.margin);
}
function vendorPerformanceHtml(){
 const rows=vendorPerformanceRows();
 const top=rows[0];
 return `<section class="performance-section">
   <div class="section-head performance-head"><div><h3>Vendor Performance</h3><p>Commercial and operational performance by transporter</p></div>${top?`<span class="performance-highlight">Top margin: ${esc(top.vendor)} · ₹ ${money(top.margin)}</span>`:""}</div>
   <div class="performance-table-wrap"><table class="performance-table">
    <thead><tr><th>Vendor</th><th>Trips</th><th>Freight</th><th>Margin</th><th>Avg Margin / Trip</th><th>₹ / KM</th><th>₹ / Ton</th><th>Completed</th><th>Completion</th></tr></thead>
    <tbody>${rows.map((r,i)=>`<tr>
      <td><div class="ranked-name"><span>${i+1}</span><strong>${esc(r.vendor)}</strong></div></td>
      <td>${r.trips}</td><td>₹ ${money(r.freight)}</td>
      <td class="${r.margin<0?"negative-value":"positive-value"}">₹ ${money(r.margin)}</td>
      <td>₹ ${money(r.avgMargin)}</td><td>₹ ${money(r.freightPerKm)}</td><td>₹ ${money(r.freightPerTon)}</td>
      <td>${r.completed}${r.cancelled?` <small>· ${r.cancelled} cancelled</small>`:""}</td><td>${r.completionRate.toFixed(0)}%</td>
    </tr>`).join("")||'<tr><td colspan="9" class="empty">No vendor performance data yet.</td></tr>'}</tbody>
   </table></div>
 </section>`;
}
function vehicleUtilization30Days(vehicleNo){
 const end=Date.now(),start=end-30*86400000;
 let occupied=0;
 state.trips.filter(t=>t.vehicle===vehicleNo).forEach(t=>{
   const a=Math.max(start,Number(t.createdAt||0));
   let b=isTripOpenStatus(t.status)?end:Number(t.statusUpdatedAt||t.updatedAt||t.createdAt||0);
   b=Math.min(end,Math.max(a,b));
   occupied+=Math.max(0,b-a);
 });
 return Math.min(100,occupied/(30*86400000)*100);
}
function vehiclePerformanceRows(){
 return state.vehicles.map(v=>{
   const trips=state.trips.filter(t=>t.vehicle===v.number);
   const revenue=trips.reduce((s,t)=>s+Number(t.freight||0),0);
   const expenses=trips.reduce((s,t)=>s+Number(t.totalExpenses||0),0);
   const margin=trips.reduce((s,t)=>s+Number(t.margin||0),0);
   const km=trips.reduce((s,t)=>s+Number(t.totalKm||0),0);
   const mileageValues=trips.map(t=>Number(t.mileage||0)).filter(x=>x>0);
   const avgMileage=mileageValues.length?mileageValues.reduce((a,b)=>a+b,0)/mileageValues.length:Number(v.mileage||0);
   const availability=vehicleAvailability(v);
   return {vehicle:v.number,trips:trips.length,revenue,expenses,margin,km,avgMileage,utilization:vehicleUtilization30Days(v.number),availability};
 }).sort((a,b)=>b.margin-a.margin);
}
function vehiclePerformanceHtml(){
 const rows=vehiclePerformanceRows();
 return `<section class="performance-section">
   <div class="section-head performance-head"><div><h3>Vehicle Performance</h3><p>Revenue, cost, KM, profitability and rolling 30-day utilization</p></div></div>
   <div class="performance-table-wrap"><table class="performance-table">
    <thead><tr><th>Vehicle</th><th>Status</th><th>Trips</th><th>Total KM</th><th>Revenue</th><th>Expenses</th><th>Margin</th><th>Avg Mileage</th><th>30D Utilization</th></tr></thead>
    <tbody>${rows.map(r=>`<tr>
      <td><strong>${esc(r.vehicle)}</strong></td>
      <td><span class="availability-badge ${esc(r.availability.key)}">${esc(r.availability.label)}</span></td>
      <td>${r.trips}</td><td>${money(r.km)}</td><td>₹ ${money(r.revenue)}</td><td>₹ ${money(r.expenses)}</td>
      <td class="${r.margin<0?"negative-value":"positive-value"}">₹ ${money(r.margin)}</td>
      <td>${Number(r.avgMileage||0).toFixed(1)} km/L</td><td>${r.utilization.toFixed(0)}%</td>
    </tr>`).join("")||'<tr><td colspan="9" class="empty">No vehicle performance data yet.</td></tr>'}</tbody>
   </table></div>
 </section>`;
}

function reportsHtml(){
 const freight=state.trips.reduce((s,t)=>s+Number(t.freight||0),0),exp=state.trips.reduce((s,t)=>s+t.totalExpenses,0),margin=state.trips.reduce((s,t)=>s+t.margin,0);
 return `<div class="grid kpis"><div class="kpi"><div class="label">Freight</div><div class="value">₹ ${money(freight)}</div></div><div class="kpi"><div class="label">Expenses</div><div class="value">₹ ${money(exp)}</div></div><div class="kpi green"><div class="label">Margin</div><div class="value">₹ ${money(margin)}</div></div><div class="kpi"><div class="label">Trips</div><div class="value">${state.trips.length}</div></div></div>
 ${isAdmin()?`<div class="report-setting-card"><div><strong>Margin Alert Threshold</strong><small>Trips below this margin % are flagged as low-margin.</small></div><div class="report-setting-control"><input id="marginThresholdInput" type="number" min="-100" max="100" step="0.5" value="${Number(state.minMarginPercent||10)}"><span>%</span><button id="saveMarginThreshold" class="secondary" type="button">Save</button></div></div>`:""}
 ${vendorPerformanceHtml()}
 ${vehiclePerformanceHtml()}
 <div class="section-head"><h3>Trip Detail Report</h3><button id="csvBtn" class="secondary">Download CSV</button></div>${tripTable(state.trips,false)}`;
}

function wireReports(){
 $("#saveMarginThreshold")?.addEventListener("click",async()=>{
   const value=Number($("#marginThresholdInput")?.value||10);
   if(!Number.isFinite(value)){toast("Enter a valid margin threshold");return;}
   await setDoc(doc(db,"settings","profitability"),{minMarginPercent:value,updatedAt:Date.now(),updatedBy:state.profile.username},{merge:true});
   state.minMarginPercent=value;
   toast("Margin threshold updated");
 });
}

document.addEventListener("click",e=>{if(e.target?.id==="csvBtn"){const headers=["Trip ID","Date","Vendor","Vehicle","Current Location","From","To","Status","Freight","Expenses","Margin","Created By","Status Updated By","Status Updated At"];const rows=state.trips.map(t=>[displayTripNumber(t),dateTime(t.createdAt),t.vendor,t.vehicle,t.currentLocation,t.from,t.to,t.status,t.freight,t.totalExpenses,t.margin,t.createdBy||t.createdByEmail,t.statusUpdatedBy||t.statusUpdatedByEmail,dateTime(t.statusUpdatedAt)]);const csv=[headers,...rows].map(r=>r.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="cube-trip-report.csv";a.click();URL.revokeObjectURL(a.href);}});

