/**
 * Sensory Log — Phase I Ask Your Data engine.
 * Deterministic, local-first query execution.
 */
import { deriveState } from "./state-engine.js";
import { buildPatternIntelligence } from "./pattern-engine.js";
import { buildPersonalModel } from "./manual-engine.js";

export const QUERY_ENGINE_VERSION = 1;
export const QUERY_INTENTS = Object.freeze(["summary","trend","relationship","helpful","drains","recovery","manual"]);

const finite=v=>v===null||v===undefined||v===""?null:Number.isFinite(Number(v))?Number(v):null;
const avg=values=>{const v=values.map(finite).filter(x=>x!==null);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null};
const round=(v,d=1)=>Number.isFinite(v)?Math.round(v*10**d)/10**d:null;
const sortEntries=entries=>Array.isArray(entries)?entries.filter(e=>e?.date).slice().sort((a,b)=>a.date.localeCompare(b.date)):[];
const windowRows=(entries,days="all")=>{
 const rows=sortEntries(entries); if(days==="all") return rows;
 const n=Math.max(1,Number(days)||30), end=rows.at(-1)?.date; if(!end)return [];
 const endDate=new Date(end+"T00:00:00"), start=new Date(endDate); start.setDate(start.getDate()-n+1);
 return rows.filter(e=>{const d=new Date(e.date+"T00:00:00");return d>=start&&d<=endDate});
};
const counts=(rows,field)=>{const m=new Map();rows.forEach(e=>(Array.isArray(e[field])?e[field]:[]).forEach(v=>m.set(v,(m.get(v)||0)+1)));return [...m.entries()].sort((a,b)=>b[1]-a[1]).map(([value,count])=>({value,count}))};

export function normalizeQuery(input={}){
 const q=input&&typeof input==="object"?input:{};
 const intent=QUERY_INTENTS.includes(q.intent)?q.intent:"summary";
 const days=q.days==="all"?"all":[7,30,90].includes(Number(q.days))?Number(q.days):30;
 return {version:QUERY_ENGINE_VERSION,intent,days};
}

export function executeQuery(entries=[],manual={},query={}){
 const spec=normalizeQuery(query), rows=windowRows(entries,spec.days);
 const state=deriveState(rows,rows.at(-1)?.date);
 const patterns=buildPatternIntelligence(rows,{window:rows.length||30});
 const personal=buildPersonalModel(manual,rows);
 const provenance={windowDays:spec.days,sampleDays:rows.length,dates:{from:rows[0]?.date||null,to:rows.at(-1)?.date||null}};
 let result;
 if(spec.intent==="summary") result={title:"Your recent summary",facts:[
   rows.length?"You logged "+rows.length+" day"+(rows.length===1?"":"s")+" in this period.":"There are no logged days in this period.",
   "Average energy: "+(round(avg(rows.map(e=>e.energy)))??"—")+"/5.",
   "Average sensory load: "+(round(avg(rows.map(e=>e.overwhelm)))??"—")+"/5."
 ]};
 else if(spec.intent==="trend") result={title:"Recent trends",facts:Object.entries(patterns.trends.trends).map(([field,x])=>field+": "+(x.first??"—")+" → "+(x.second??"—")+" ("+(x.difference==null?"not enough repeated observations":(x.difference>0?"+":"")+x.difference)+").")};
 else if(spec.intent==="relationship") result={title:"Observed relationships",facts:patterns.relationships.map(x=>x.label+": "+x.a+"/5 vs "+x.b+"/5 next-day energy ("+x.nA+" vs "+x.nB+" observations).")};
 else if(spec.intent==="helpful") result={title:"What you logged as helpful",facts:counts(rows,"helped").slice(0,5).map(x=>x.value+": "+x.count+" day"+(x.count===1?"":"s")+"." )};
 else if(spec.intent==="drains") result={title:"What you logged as draining",facts:counts(rows,"drains").slice(0,5).map(x=>x.value+": "+x.count+" day"+(x.count===1?"":"s")+"." )};
 else if(spec.intent==="recovery") result={title:"Recovery observations",facts:[
   "Average recovery need: "+(round(avg(rows.map(e=>e.recovery)))??"—")+"/5.",
   "High-recovery days (4–5): "+rows.filter(e=>finite(e.recovery)>=4).length+".",
   "Current derived state: "+(state.capacity==null?"unknown":state.capacity.toFixed(1)+"/5 capacity")+"."
 ]};
 else result={title:"Your personal model",facts:[
   "Declared sensory preferences: "+(personal.declared.sensory.preferences.join(", ")||"none recorded")+".",
   "Declared helpful inputs: "+(personal.declared.sensory.helpfulInputs.join(", ")||"none recorded")+".",
   "Declared communication preferences: "+(personal.declared.communication.preferred.join(", ")||"none recorded")+"."
 ]};
 return Object.freeze({version:QUERY_ENGINE_VERSION,query:spec,result,provenance,guardrails:["descriptive only","no diagnosis","no causal claims"]});
}
