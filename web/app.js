import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
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
  page:"dashboard", unsubs:[]
};

function toast(msg){ const el=$("#toast"); el.textContent=msg; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"),2200); }
function setSync(text, ok=true){ const el=$("#syncState"); el.textContent=(ok?"● ":"● ")+text; el.style.color=ok?"#087A36":"#B42318"; }
function normalizeUsername(v){ return v.trim().toLowerCase().replace(/[^a-z0-9._-]/g,""); }
function loginIdentity(v){ const s=v.trim(); return s.includes("@") ? s : normalizeUsername(s)+"@cube.internal"; }
function isAdmin(){ return !!(state.role?.canManageUsers && state.role?.canManageMasters); }
function canManageMasters(){ return !!state.role?.canManageMasters; }
function canCreateTrips(){ return !!state.role?.canCreateTrips; }
function canDeleteTrips(){ return !!state.role?.canDeleteTrips; }

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
}

function showApp(){
  $("#loginView").classList.add("hidden"); $("#appView").classList.remove("hidden");
  $("#userSummary").innerHTML=`<strong>${esc(state.profile.username)}</strong><br>${esc(state.role.name||state.profile.roleId)}`;
  const newTripBtn=document.querySelector('[data-page="newtrip"]'); if(newTripBtn) newTripBtn.style.display=canCreateTrips()?"":"none";
  ["vehicles","vendors","locations"].forEach(p=>{const b=document.querySelector(`[data-page="${p}"]`);if(b)b.style.display=canManageMasters()?"":"none";});
  startLiveSync(); navigate("dashboard");
}
function showLogin(){ $("#appView").classList.add("hidden"); $("#loginView").classList.remove("hidden"); }

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
$("#refreshBtn").addEventListener("click",()=>{setSync("Refreshing...");state.unsubs.forEach(f=>f());startLiveSync();toast("Live data refreshed");});
$("#menuBtn").addEventListener("click",()=>$("#menuBtn").setAttribute("aria-expanded",$(".sidebar").classList.toggle("open")));
$("#nav").addEventListener("click",e=>{const b=e.target.closest("[data-page]");if(b)navigate(b.dataset.page);});

function navigate(page){
  state.page=page;
  document.querySelectorAll("#nav button").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  $(".sidebar").classList.remove("open"); $("#menuBtn").setAttribute("aria-expanded","false");
  const titles={dashboard:["Dashboard","Transport operations overview"],trips:["Trips","Live trip placement and status"],newtrip:["Create Trip","Add a new vehicle placement"],vehicles:["Vehicles","Vehicle master"],vendors:["Vendors","Vendor master"],locations:["Locations","Location master"],reports:["Reports","Operational and profitability summary"]};
  $("#pageTitle").textContent=titles[page]?.[0]||"CUBE";$("#pageSubtitle").textContent=titles[page]?.[1]||"";
  render();
}

function render(){
  if(!state.profile)return;
  const root=$("#pageContent");
  if(state.page==="dashboard")root.innerHTML=dashboardHtml();
  if(state.page==="trips"){root.innerHTML=tripsHtml();wireTrips();}
  if(state.page==="newtrip"){root.innerHTML=newTripHtml();wireNewTrip();}
  if(state.page==="vehicles"){root.innerHTML=masterHtml("vehicles");wireMaster("vehicles");}
  if(state.page==="vendors"){root.innerHTML=masterHtml("vendors");wireMaster("vendors");}
  if(state.page==="locations"){root.innerHTML=masterHtml("locations");wireMaster("locations");}
  if(state.page==="reports")root.innerHTML=reportsHtml();
}

function dashboardHtml(){
  const placed=state.trips.filter(t=>(t.status||"Vehicle Placed")==="Vehicle Placed").length;
  const transit=state.trips.filter(t=>t.status==="In Transit").length, completed=state.trips.filter(t=>t.status==="Completed").length;
  const freight=state.trips.reduce((s,t)=>s+Number(t.freight||0),0), exp=state.trips.reduce((s,t)=>s+t.totalExpenses,0), margin=state.trips.reduce((s,t)=>s+t.margin,0);
  return `
  <div class="dashboard-intro">
    <h2>Hello, ${esc(state.profile.username)}</h2>
    <p>Transport Operations Dashboard</p>
  </div>
  <div class="grid dashboard-kpis">
    <div class="kpi blue"><div class="label">Trips</div><div class="value">${state.trips.length}</div></div>
    <div class="kpi green"><div class="label">Freight Amount</div><div class="value">₹ ${money(freight)}</div></div>
    <div class="kpi orange"><div class="label">Total Expenses</div><div class="value">₹ ${money(exp)}</div></div>
    <div class="kpi green"><div class="label">Margin</div><div class="value">₹ ${money(margin)}</div></div>
    <div class="kpi green margin-percent"><div class="label">Margin %</div><div class="value">${freight?(margin/freight*100).toFixed(2):"0.00"}%</div></div>
  </div>
  <div class="section-head"><h3>Trip Status</h3></div>
  <div class="grid status-overview">
    <div class="card">${statusBadge("Vehicle Placed")} <strong>${placed}</strong></div>
    <div class="card">${statusBadge("In Transit")} <strong>${transit}</strong></div>
    <div class="card">${statusBadge("Completed")} <strong>${completed}</strong></div>
  </div>
  <div class="section-head"><h3>Latest Trips</h3><button class="secondary" onclick="document.querySelector('[data-page=trips]').click()">View all</button></div>
  ${tripTable(state.trips.slice(0,8),false)}`;
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
 m.querySelector("#saveStatus").onclick=async()=>{const status=m.querySelector("#statusSelect").value;await setDoc(doc(db,"trips",id),{status,statusUpdatedBy:state.profile.username,statusUpdatedByEmail:state.profile.loginEmail,statusUpdatedAt:Date.now(),updatedAt:Date.now()},{merge:true});m.remove();toast("Trip status updated");};
}
async function deleteTrip(id){if(!confirm("Delete this trip permanently?"))return;await deleteDoc(doc(db,"trips",id));toast("Trip deleted");}

function active(arr){return arr.filter(x=>x.active!==false)}
function picker(opts,selected=""){return opts.map(x=>`<option ${x===selected?"selected":""}>${esc(x)}</option>`).join("")}
function newTripHtml(){
 if(!canCreateTrips())return '<div class="card empty">You do not have permission to create trips.</div>';
 return `<form id="tripForm" class="card">
 <div class="form-grid">
  <label><span>Vendor / Transporter</span><select id="fVendor" required>${picker(active(state.vendors).map(x=>x.name))}</select></label>
  <label><span>Vehicle No</span><select id="fVehicle" required>${picker(active(state.vehicles).map(x=>x.number))}</select></label>
  <label><span>Current Location</span><select id="fCurrent">${picker(active(state.locations).map(x=>x.name))}</select></label>
  <label><span>From</span><select id="fFrom" required>${picker(active(state.locations).map(x=>x.name))}</select></label>
  <label><span>To</span><select id="fTo" required>${picker(active(state.locations).map(x=>x.name))}</select></label>
  <label><span>Freight Amount (₹)</span><input id="fFreight" type="number" min="0" step="0.01" required></label>
  <label><span>Advance (₹)</span><input id="fAdvance" type="number" min="0" step="0.01" value="0"></label>
  <label><span>Weight (Ton)</span><input id="fWeight" type="number" min="0" step="0.01" value="0"></label>
  <label><span>Trip Total KM</span><input id="fKm" type="number" min="0" step="0.01" value="0"></label>
  <label><span>Transit Hours</span><input id="fHours" type="number" min="0" step="0.01" value="0"></label>
  <label><span>Current Location to Origin KM</span><input id="fOriginKm" type="number" min="0" step="0.01" value="0"></label>
  <label><span>Vehicle Mileage (km/L)</span><select id="fMileage">${(Array.from({length:36},(_,i)=>(2.5+i/10).toFixed(1))).map(x=>`<option>${x}</option>`).join("")}</select></label>
  <label><span>Loading Expense / Ton</span><input id="fLoad" type="number" min="0" step="0.01" value="0"></label>
  <label><span>Unloading Expense / Ton</span><input id="fUnload" type="number" min="0" step="0.01" value="0"></label>
  <label><span>Other Expense %</span><input id="fPct" type="number" min="0" step="0.01" value="0"></label>
  <label><span>FASTag</span><input id="fFastag" type="number" min="0" step="0.01" value="0"></label>
  <label><span>RTO / Tarpaulin</span><input id="fRto" type="number" min="0" step="0.01" value="0"></label>
  <label><span>Fixed Expenses</span><input id="fFixed" type="number" min="0" step="0.01" value="0"></label>
 </div>
 <div class="summary-row"><div class="summary"><span>Fuel Rate</span><strong>₹ ${money(state.fuelRate)}/L</strong></div><div class="summary"><span>Initial Status</span><strong>Vehicle Placed</strong></div><div class="summary"><span>Created By</span><strong>${esc(state.profile.username)}</strong></div></div>
 <button class="primary" style="margin-top:16px" type="submit">Save Trip</button>
 </form>`;
}
function wireNewTrip(){
 const v=$("#fVehicle");const setMileage=()=>{const rec=state.vehicles.find(x=>x.number===v.value);if(rec)$("#fMileage").value=Number(rec.mileage).toFixed(1)};v.addEventListener("change",setMileage);setMileage();
 $("#tripForm").addEventListener("submit",async e=>{e.preventDefault();const n=id=>Number($("#"+id).value||0),now=Date.now(),id=uid();const freight=n("fFreight"),pct=n("fPct");
 const trip={id,createdAt:now,vendor:$("#fVendor").value,vehicle:$("#fVehicle").value,currentLocation:$("#fCurrent").value,from:$("#fFrom").value,to:$("#fTo").value,freight,netFreight:freight,advance:n("fAdvance"),weightTon:n("fWeight"),currentToOriginKm:n("fOriginKm"),totalKm:n("fKm"),transitHours:n("fHours"),mileage:n("fMileage"),fuelRate:state.fuelRate,fixedExpenses:n("fFixed"),fastag:n("fFastag"),rtoTarpaulin:n("fRto"),loadingUnloading:0,loadingExpensePerTon:n("fLoad"),unloadingExpensePerTon:n("fUnload"),expenseRules:pct>0?[{name:"Other Expense",percent:pct}]:[],createdBy:state.profile.username,createdByEmail:state.profile.loginEmail,status:"Vehicle Placed",statusUpdatedBy:state.profile.username,statusUpdatedByEmail:state.profile.loginEmail,statusUpdatedAt:now,updatedAt:now};
 await setDoc(doc(db,"trips",id),trip);toast("Trip created");navigate("trips");});
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
