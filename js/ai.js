import { getEntries } from "./core/storage.js";

const CONSENT_KEY="sensoryLogAiConsent_v1";
const PROVIDER_KEY="sensoryLogAiProvider_v1";

export const AI_SHARE_OPTIONS=[
  {id:"none",label:"Nothing",description:"AI stays off."},
  {id:"selected",label:"Selected entries",description:"Only entries you explicitly choose."},
  {id:"patterns",label:"My patterns",description:"Derived summaries, not your full journal."},
  {id:"history",label:"Complete history",description:"All saved entries for the request."}
];

export function getAiSettings(){
  try{return {
    consent:localStorage.getItem(CONSENT_KEY)||"none",
    provider:localStorage.getItem(PROVIDER_KEY)||"gemini"
  }}catch{return {consent:"none",provider:"gemini"}}
}
export function setAiConsent(value){
  if(!AI_SHARE_OPTIONS.some(x=>x.id===value)) throw new Error("Invalid AI sharing level");
  localStorage.setItem(CONSENT_KEY,value);
}
export function setAiProvider(value){
  if(!["gemini","puter","local"].includes(value)) throw new Error("Invalid AI provider");
  localStorage.setItem(PROVIDER_KEY,value);
}

function localReflection(entries,question=""){
  if(!entries.length) return "There is not enough logged data yet. A few check-ins can give Sensory Log something real to reflect on.";
  const recent=entries.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,7);
  const avg=k=>{const v=recent.map(e=>Number(e[k])).filter(Number.isFinite);return v.length?(v.reduce((a,b)=>a+b,0)/v.length).toFixed(1):"—"};
  return question
    ? `I can answer this from your saved data only when an AI provider is enabled. Locally, I can see ${recent.length} recent entries: energy ${avg("energy")}/5 and sensory load ${avg("overwhelm")}/5.`
    : `Local reflection: your last ${recent.length} logged days average ${avg("energy")}/5 energy and ${avg("overwhelm")}/5 sensory load. This is descriptive only, not a diagnosis.`;
}

async function firebaseGemini(prompt){
  const config=window.SENSORY_LOG_FIREBASE_CONFIG;
  if(!config?.apiKey||!config?.projectId) throw new Error("Firebase AI is not configured yet.");
  throw new Error("Firebase AI Logic adapter is awaiting the project's generated Firebase web configuration.");
}

async function puter(prompt){
  if(!window.puter?.ai?.chat) throw new Error("Puter is unavailable. Sensory Log does not require a Puter account.");
  const result=await window.puter.ai.chat(prompt);
  return typeof result==="string"?result:(result?.message?.content||result?.text||"");
}

function compactEntry(e,includeNotes){
  const x={...e};
  if(!includeNotes) delete x.note;
  return x;
}

async function buildPayload(mode,question,selected=[]){
  const entries=await getEntries();
  if(mode==="none") return null;
  if(mode==="selected") return selected.map(e=>compactEntry(e,false));
  if(mode==="patterns"){
    const rows=entries.slice(-30);
    return {sampleSize:rows.length,observations:{
      averageEnergy:rows.length?rows.reduce((a,e)=>a+(Number(e.energy)||0),0)/rows.length:null,
      averageSensoryLoad:rows.length?rows.reduce((a,e)=>a+(Number(e.overwhelm)||0),0)/rows.length:null
    }};
  }
  return entries.map(e=>compactEntry(e,false));
}

export async function askAi({question="",selected=[]}={}){
  const settings=getAiSettings();
  const payload=await buildPayload(settings.consent,question,selected);
  if(!payload) return localReflection(await getEntries(),question);
  const prompt=`You are Sensory Log's private reflection assistant for a neurodivergent user.
Use only the supplied observations. Do not diagnose, predict medical outcomes, or claim causation.
Distinguish observations from possibilities. Keep the answer concise and practical.
User question: ${question||"What stands out in my recent data?"}
Data:
${JSON.stringify(payload)}`;
  try{
    if(settings.provider==="puter") return await puter(prompt);
    if(settings.provider==="gemini") return await firebaseGemini(prompt);
    return localReflection(await getEntries(),question);
  }catch(error){
    console.warn("Sensory Log AI provider unavailable:",error);
    return `AI is unavailable right now, so Sensory Log kept your data local. ${localReflection(await getEntries(),question)}`;
  }
}

export async function getAiStatus(){
  const s=getAiSettings();
  return {provider:s.provider,consent:s.consent,available:s.provider==="local"||!!window.puter?.ai?.chat||!!window.SENSORY_LOG_FIREBASE_CONFIG?.projectId};
}