// Owner verified Spark and registered Web App Check on 2026-11-27. Recheck billing before future changes.
// Never put a Gemini Developer API key here. These are public Firebase web settings.
export const cloudConfig=Object.freeze({enabled:true,sparkVerified:true,appId:"1:771656307864:web:91249084815c43570ceced",recaptchaSiteKey:"6LdoqjQuAAAAABXUSWE7qWMxjYKCkwZ_y8Mqy6Q-",model:"gemini-3.5-flash-lite"});
// Fleet routing sends only generic fleet vocabulary. General questions are routed automatically in the unified assistant. No identifiers, amounts,
// locations, names, dates, trip records, or arbitrary text are forwarded.
const words=new Set("a about all am an any are at available availability best can completed completion cost costs could current currently delay delayed delays expense expenses fleet for free freight get give has have highest how i in is it list load loads low margin margins me month monthly most much now of on open operation operations overdue performance placement placements please profit profitable ready recorded report revenue run show status summary take the this to total transit trip trips truck trucks utilization utilisation vehicle vehicles what which who with would you".split(" "));
export function safeQuestion(value){
 const s=String(value??"").trim().toLowerCase();
 if(!s||s.length>160||!/^[a-z ?.,'-]+$/.test(s))return null;
 const cleaned=s.replace(/[?.,'-]/g," ").replace(/ +/g," ").trim();
 return cleaned.split(" ").every(w=>words.has(w))?cleaned:null;
}
export function cloudReady(c){return c?.enabled===true&&c?.sparkVerified===true&&typeof c.appId==="string"&&/^1:\d+:web:[a-f0-9]+$/i.test(c.appId)&&typeof c.recaptchaSiteKey==="string"&&c.recaptchaSiteKey.length>15&&c.model==="gemini-3.5-flash-lite";}
export function createCloudRouter({config=cloudConfig,isAuthorized,loadModel,questions}){
 let modelPromise;
 return async q=>{
  const safe=safeQuestion(q);
  if(!cloudReady(config)||!safe||!isAuthorized())return null;
  try{
   if(!modelPromise)modelPromise=Promise.resolve().then(loadModel).catch(e=>{modelPromise=null;throw e;});
   const model=await modelPromise;
   if(!isAuthorized())return null;
   const prompt="Return exactly one supported intent key, or NONE. Current month and current fleet only. Do not answer, calculate, or execute actions. Intent keys: "+JSON.stringify(questions)+". Generic question: "+JSON.stringify(safe);
   const result=await model.generateContent(prompt);
   if(!isAuthorized())return null;
   const key=String(result.response.text()).trim();
   return Object.hasOwn(questions,key)?key:null;
  }catch{return null;}
 };
}
// Lazily initialize the same Firebase app. The Gemini key stays behind Firebase AI Logic.
export function firebaseCloudModel(app,config=cloudConfig){
 let servicePromise;
 async function service(){
  if(!cloudReady(config)||app.options.appId!==config.appId)throw Error("Gemini setup incomplete");
  if(!servicePromise)servicePromise=(async()=>{
   const [check,ai]=await Promise.all([
    import("https://www.gstatic.com/firebasejs/12.14.0/firebase-app-check.js"),
    import("https://www.gstatic.com/firebasejs/12.14.0/firebase-ai.js")
   ]);
   let attestation;
   try{attestation=check.getAppCheck(app);}catch{}
   if(!attestation)attestation=check.initializeAppCheck(app,{provider:new check.ReCaptchaEnterpriseProvider(config.recaptchaSiteKey),isTokenAutoRefreshEnabled:true});
   await check.getToken(attestation);
   return {ai,service:ai.getAI(app,{backend:new ai.GoogleAIBackend(),useLimitedUseAppCheckTokens:true})};
  })().catch(error=>{servicePromise=null;throw error;});
  return servicePromise;
 }
 return async(general=false)=>{
  const {ai,service:backend}=await service();
  return ai.getGenerativeModel(backend,{model:config.model,generationConfig:{temperature:general?0.4:0,maxOutputTokens:general?1536:128}});
 };
}
export function generalError(error){
 const raw=String(error?.code??"")+" "+String(error?.message??"");
 if(/429|quota|resource.exhausted|rate.limit/i.test(raw))return "Gemini free quota or rate limit reached. Try again later. Fleet analytics still works.";
 if(/app.check|attestation|recaptcha/i.test(raw))return "Gemini could not verify this browser with App Check. Use the official website and refresh; check that scripts are not blocked.";
 if(/403|401|permission.denied|unauthorized|forbidden/i.test(raw))return "Gemini access was denied. Check Firebase AI Logic, App Check and API restrictions.";
 if(/404|not.found/i.test(raw))return "Gemini model or API endpoint is unavailable. Check the configured model.";
 return "Gemini could not respond right now. Check your connection or try again. Fleet analytics still works.";
}
export function createGeneralAI({config=cloudConfig,isAuthorized,loadModel}){
 let modelPromise;
 return async question=>{
  const q=String(question??"").trim();
  if(!isAuthorized())return {ok:false,text:"Sign in required."};
  if(!cloudReady(config))return {ok:false,text:"Gemini is not configured."};
  if(!q||q.length>1000)return {ok:false,text:"Enter a question of up to 1,000 characters."};
  try{
   if(!modelPromise)modelPromise=Promise.resolve().then(()=>loadModel(true)).catch(e=>{modelPromise=null;throw e;});
   const model=await modelPromise;
   if(!isAuthorized())return {ok:false,text:"Sign in required."};
   const prompt="You are CUBE AI, a general-purpose assistant. Answer the user's question directly and clearly in the language used by the user, including Tamil. You have no access to their company records, live fleet, web search or tools. Never claim to have read or changed such data. For actual company figures, say that the unified assistant can answer supported fleet queries from local records; never guess those figures. Say when uncertain. User question: "+JSON.stringify(q);
   const response=await model.generateContent(prompt);
   if(!isAuthorized())return {ok:false,text:"Sign in required."};
   const answer=String(response.response.text()??"").trim();
   return answer?{ok:true,text:answer}:{ok:false,text:"Gemini returned no text. Rephrase your question."};
  }catch(error){return {ok:false,text:generalError(error)};}
 };
}

export function createFleetPlanner({config=cloudConfig,isAuthorized,loadModel}){
 let pending;
 return async safeQuestion=>{
  if(!cloudReady(config)||!isAuthorized()||!safeQuestion||!/^[a-z ]{1,240}$/.test(safeQuestion))return null;
  try{
   if(!pending)pending=Promise.resolve().then(()=>loadModel(true)).catch(e=>{pending=null;throw e;});
   const model=await pending;
   if(!isAuthorized())return null;
   const prompt="You are a read-only fleet query planner. You have no data. Return only JSON, or null if unclear. Allowed keys: metric (trips,revenue,margin,expenses,fuel,toll,distance,weight,advance,balance,marginPercent,summary), period (thisMonth only), status (all,active,transit,completed,delayed,low,loading,unloading,cancelled), group (none,vehicle,vendor,route), action (sum,list,rankHigh,rankLow), limit (1 to 40). Never invent records or financial values. Question keywords: "+JSON.stringify(safeQuestion);
   const r=await model.generateContent(prompt);
   if(!isAuthorized())return null;
   const text=String(r.response.text()||"").trim().replace(/^\x60\x60\x60(?:json)?\s*/i,"").replace(/\s*\x60\x60\x60$/,"");
   return JSON.parse(text);
  }catch{return null;}
 };
}
