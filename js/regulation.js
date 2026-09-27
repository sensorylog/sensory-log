import { getEntries, saveEntries } from "./core/storage.js";
import { localDateString } from "./core/date.js";
import { deriveState } from "./core/state-engine.js";
import { buildRegulationPlan } from "./core/regulation-engine.js";

const MODES=[
 {id:"sensory",label:"Too much sensory input",sub:"Lower what is reaching you.",steps:["Move somewhere quieter or visually simpler.","Lower the light or cover your eyes if that feels better.","Reduce conversation, notifications, and other incoming demands.","Give yourself a few minutes before deciding what comes next."]},
 {id:"thoughts",label:"My thoughts won't stop",sub:"Give your attention one smaller place to land.",steps:["Put both feet somewhere supported.","Name one thing you can see, one thing you can hear, and one body sensation.","Take one slower breath without trying to make it perfect.","Choose only the next tiny action."]},
 {id:"shutdown",label:"Shutdown may be coming",sub:"Reduce demands before they become harder.",steps:["Stop adding new tasks for a moment.","Use the most familiar low-input place available.","If talking is hard, use a short message or gesture instead.","Rest first. Decisions can wait."]},
 {id:"agitated",label:"I'm angry or agitated",sub:"Create space before solving the problem.",steps:["Increase physical space from the trigger if you can.","Pause messages or conversations that can wait.","Try movement, pressure, cold water, or another familiar reset.","Return to the situation only when your body has more room."]},
 {id:"start",label:"I can't start",sub:"Make the first action almost too small to fail.",steps:["Pick one task, not the whole task.","Make the first action take about two minutes.","Remove one obstacle before asking yourself for effort.","Stopping after the first step is allowed."]},
 {id:"away",label:"I need to get away",sub:"Find a safer, lower-demand space.",steps:["Move toward a familiar quiet place if you can.","Reduce people, noise, light, and decisions.","Take essentials with you: water, headphones, medication if prescribed, or a comfort item.","Give yourself permission to leave the situation."]},
 {id:"unknown",label:"I don't know what I need",sub:"You do not have to know yet.",steps:["Pause instead of forcing an explanation.","Check: sensory load, energy, body tension, hunger/thirst, and social demand.","Change one input at a time.","Notice whether the next few minutes feel easier, the same, or harder."]}
];

const TOOLKIT=[
 ["Quiet alone time","A low-demand reset when social input is the main load."],["Low lighting","Useful when visual input feels like too much."],["Headphones / ear protection","Reduce incoming sound without needing to explain."],["Movement / walk","A body-based reset when stillness feels difficult."],["Weighted pressure","Familiar pressure can feel grounding for some people."],["Familiar music / show","Predictable input can be easier than new input."],["Food / water","Check basic body needs before interpreting everything else."],["Stimming freely","Let your body use a familiar regulating movement or action."]
];

let active=null,timer=null,remaining=0,mountRoot=null,sessionStartedAt=null,currentPlan=null;

const esc=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const getHelpCounts=entries=>{const c={};entries.forEach(e=>(e.helped||[]).forEach(h=>c[h]=(c[h]||0)+1));return c;};

function ensureStyles(){if(document.querySelector('link[data-regulation-styles]'))return;const l=document.createElement("link");l.rel="stylesheet";l.href="./styles/regulation.css";l.dataset.regulationStyles="";document.head.appendChild(l)}
function stopTimer(){if(timer){clearInterval(timer);timer=null}remaining=0}
function buzz(pattern){try{if(navigator.vibrate)navigator.vibrate(pattern)}catch{}}

function renderSession(){
 const el=mountRoot?.querySelector(".sl-reg-session");if(!el)return;
 if(!active){el.innerHTML="";return}
 el.innerHTML=`<div class="sl-reg-session-inner">
   <div class="sl-reg-session-kicker">Regulation mode</div><h3>${esc(active.label)}</h3><p>${esc(active.sub)}</p>
   <ol>${active.steps.map((s,i)=>`<li><span>${i+1}</span><div>${esc(s)}</div></li>`).join("")}</ol>
   <div class="sl-reg-timer" aria-live="polite"><div class="sl-reg-timer-value" id="slRegTimer">${remaining?String(remaining):"2:00"}</div><div class="sl-reg-timer-actions"><button type="button" data-reg-action="start">Start 2-minute reset</button><button type="button" data-reg-action="stop">Stop</button></div></div>
   <div class="sl-reg-check"><span>After this, how do you feel?</span><div><button data-reg-feedback="easier" type="button">Easier</button><button data-reg-feedback="same" type="button">About the same</button><button data-reg-feedback="harder" type="button">Harder</button></div></div>
   <button class="sl-reg-close" type="button" data-reg-action="close">Back to modes</button>
 </div>`;
 bindSession();
}

function startTimer(){stopTimer();sessionStartedAt=Date.now();remaining=120;updateTimer();buzz([35]);timer=setInterval(()=>{remaining--;updateTimer();if(remaining<=0){stopTimer();buzz([45,70,45])}},1000)}
function updateTimer(){const el=mountRoot?.querySelector("#slRegTimer");if(!el)return;const m=Math.floor(remaining/60),s=String(remaining%60).padStart(2,"0");el.textContent=`${m}:${s}`}

async function recordFeedback(feedback){
 if(!active||!sessionStartedAt)return;
 const entries=await getEntries(),date=localDateString(),current=entries.find(e=>e.date===date);
 if(!current)return;
 const tags=Array.isArray(current.helped)?current.helped:[],label=`Regulation: ${active.label} · ${feedback}`;
 const helped=tags.includes(label)?tags:[...tags,label];
 const result=await saveEntries([...entries.filter(e=>e.date!==date),{...current,helped}]);
 if(result.ok)window.dispatchEvent(new CustomEvent("sensory-log:entries-changed"));
}

function bindSession(){
 mountRoot.querySelectorAll("[data-reg-action]").forEach(b=>b.onclick=()=>{if(b.dataset.regAction==="start")startTimer();if(b.dataset.regAction==="stop"){stopTimer();updateTimer()}if(b.dataset.regAction==="close"){stopTimer();sessionStartedAt=null;active=null;renderSession()}});
 mountRoot.querySelectorAll("[data-reg-feedback]").forEach(b=>b.onclick=()=>{mountRoot.querySelectorAll("[data-reg-feedback]").forEach(x=>x.setAttribute("aria-pressed",x===b?"true":"false"));const status=mountRoot.querySelector(".sl-reg-feedback-status");if(status)status.textContent="Noted. You don't need to rate yourself.";buzz(b.dataset.regFeedback==="easier"?[25]:[]);recordFeedback(b.dataset.regFeedback).catch(e=>console.error("[Sensory Log] Regulation feedback",e))});
}

function selectMode(id,source="manual"){
 active=MODES.find(x=>x.id===id)||MODES.find(x=>x.id==="unknown");
 stopTimer();sessionStartedAt=null;
 mountRoot.querySelectorAll("[data-reg-mode]").forEach(x=>x.setAttribute("aria-pressed",x.dataset.regMode===active.id?"true":"false"));
 const status=mountRoot.querySelector(".sl-reg-plan-status");
 if(status)status.textContent=source==="recommended"?"Suggested from your current signals. Use it only if it feels right.":"Selected by you.";
 renderSession();
 mountRoot.querySelector(".sl-reg-session")?.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion:reduce)").matches?"auto":"smooth",block:"nearest"});
}

function renderPlan(plan){
 currentPlan=plan;
 const primary=plan.primary;
 const status=mountRoot.querySelector(".sl-reg-plan");
 if(!status)return;
 status.innerHTML=`<div class="sl-reg-plan-kicker">Based on your latest check-in</div>
   <h3>${esc(primary.title)}</h3><p>${esc(primary.summary)}</p>
   <div class="sl-reg-plan-actions">${primary.actions.slice(0,3).map((x,i)=>`<div><span>${i+1}</span>${esc(x)}</div>`).join("")}</div>
   <div class="sl-reg-plan-meta">${esc(plan.stateSummary)} · confidence ${Math.round((plan.confidence||0)*100)}%</div>
   <button type="button" class="sl-reg-use" data-reg-recommended="${esc(primary.mode)}">Use this direction</button>
   ${plan.alternatives.length?`<button type="button" class="sl-reg-alt" data-reg-alternative="${esc(plan.alternatives[0].mode)}">See another direction</button>`:""}`;
 status.hidden=false;
 status.querySelector("[data-reg-recommended]")?.addEventListener("click",e=>selectMode(e.currentTarget.dataset.regRecommended,"recommended"));
 status.querySelector("[data-reg-alternative]")?.addEventListener("click",e=>selectMode(e.currentTarget.dataset.regAlternative,"recommended"));
}

function bindModes(){mountRoot.querySelectorAll("[data-reg-mode]").forEach(b=>b.onclick=()=>selectMode(b.dataset.regMode))}

export async function mountRegulation(){
 ensureStyles();
 try{
  const entries=await getEntries(),counts=getHelpCounts(entries),state=deriveState(entries,localDateString()),plan=buildRegulationPlan(state);
  const personalized=TOOLKIT.map(([name,desc])=>({name,desc,count:counts[name]||0})).sort((a,b)=>b.count-a.count);
  mountRoot=document.getElementById("slRegulation");
  if(!mountRoot){mountRoot=document.createElement("section");mountRoot.id="slRegulation";mountRoot.className="sl-regulation";document.getElementById("view-regulation")?.appendChild(mountRoot)}
  mountRoot.innerHTML=`<div class="sl-reg-head"><div><div class="sl-reg-kicker">Regulation</div><h2>What would help right now?</h2><p>Start with your current signals, then choose the smallest useful action. Nothing here is a diagnosis or prescription.</p></div></div>
  <section class="sl-reg-plan" aria-live="polite"></section>
  <div class="sl-reg-plan-status" role="status" aria-live="polite"></div>
  <div class="sl-reg-modes" aria-label="Regulation modes">${MODES.map(m=>`<button type="button" class="sl-reg-mode" aria-pressed="false" data-reg-mode="${m.id}"><strong>${esc(m.label)}</strong><span>${esc(m.sub)}</span></button>`).join("")}</div>
  <div class="sl-reg-session" aria-live="polite"></div>
  <div class="sl-reg-toolkit"><div class="sl-reg-toolkit-head"><div><div class="sl-reg-kicker">Your toolkit</div><h3>Things you've said can help</h3></div><span class="sl-reg-note">Your history only</span></div><div class="sl-reg-tools">${personalized.slice(0,6).map(x=>`<div class="sl-reg-tool"><strong>${esc(x.name)}</strong><span>${esc(x.desc)}</span>${x.count?`<small>Logged as helpful ${x.count} time${x.count===1?"":"s"}</small>`:"<small>Not logged yet</small>"}</div>`).join("")}</div></div>
  <div class="sl-reg-feedback-status" aria-live="polite"></div>`;
  renderPlan(plan);bindModes();
 }catch(e){console.error("Sensory Log Regulation",e)}
}
window.addEventListener("sensory-log:entries-changed",()=>{mountRegulation()});
mountRegulation();
