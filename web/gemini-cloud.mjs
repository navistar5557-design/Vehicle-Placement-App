// Cloud AI is opt-in and disabled until the owner verifies Spark and registers App Check.
// Never put a Gemini Developer API key here. These are public Firebase web settings.
export const cloudConfig=Object.freeze({enabled:false,sparkVerified:false,appId:"",recaptchaSiteKey:"",model:"gemini-3.5-flash-lite"});
// Only generic fleet vocabulary may leave the browser. No identifiers, amounts,
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
 return async()=>{
  if(!cloudReady(config)||app.options.appId!==config.appId)throw Error("Gemini setup incomplete");
  const [check,ai]=await Promise.all([
   import("https://www.gstatic.com/firebasejs/12.14.0/firebase-app-check.js"),
   import("https://www.gstatic.com/firebasejs/12.14.0/firebase-ai.js")
  ]);
  const attestation=check.initializeAppCheck(app,{provider:new check.ReCaptchaEnterpriseProvider(config.recaptchaSiteKey),isTokenAutoRefreshEnabled:true});
  await check.getToken(attestation);
  const service=ai.getAI(app,{backend:new ai.GoogleAIBackend(),useLimitedUseAppCheckTokens:true});
  return ai.getGenerativeModel(service,{model:config.model,generationConfig:{temperature:0,maxOutputTokens:64}});
 };
}
