import {geminiConfig} from "./gemini-config.mjs";
import {configured,cloudIntent,MODEL} from "./gemini-router.mjs";
export function createGeminiAdapter(app,authorized){
 let initialization;
 async function getModel(){
  if(!configured(geminiConfig)||!authorized())throw Error("Gemini not enabled");
  if(!initialization)initialization=(async()=>{
   const [check,ai]=await Promise.all([
    import("https://www.gstatic.com/firebasejs/13.4.0/firebase-app-check.js"),
    import("https://www.gstatic.com/firebasejs/13.4.0/firebase-ai.js")
   ]);
   const appCheck=check.initializeAppCheck(app,{provider:new check.ReCaptchaV3Provider(geminiConfig.recaptchaSiteKey),isTokenAutoRefreshEnabled:false});
   return {appCheck,check,model:ai.getGenerativeModel(ai.getAI(app,{backend:new ai.GoogleAIBackend()}),{model:MODEL,generationConfig:{temperature:0,maxOutputTokens:32}})};
  })();
  return initialization;
 }
 return {enabled:configured(geminiConfig),async route(q,consent){
  return cloudIntent(q,{config:geminiConfig,consent,authorized,generate:async prompt=>{
    const {appCheck,check,model}=await getModel();
    const token=await check.getToken(appCheck);
    if(!token?.token||!authorized())throw Error("App Check or session unavailable");
    const response=await model.generateContent(prompt);
    return response.response.text();
  }});
 }};
}
