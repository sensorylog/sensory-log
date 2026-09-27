import { getEntries } from "./core/storage.js";

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
 ["Quiet alone time","A low-demand reset when social input is the main load."],
 ["Low lighting","Useful when visual input feels like too much."],
 ["Headphones / ear protection","Reduce incoming sound without needing to explain."],
 ["Movement / walk","A body-based reset when stillness feels difficult."],
 ["Weighted pressure","Familiar pressure can feel grounding for some people."],
 ["Familiar music / show","Predictable input can be easier than new input."],
 ["Food / water","Check basic body needs before interpreting everything else."],
 ["Stimming freely","Let your body use a familiar regulating movement or action."]
];

let active=null, timer=null, remaining=0, mountRoot=null;

const esc=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const getHelpCounts=entries=>{
 const c={}; entries.forEach(e=>(e.helped||[]).forEach(h=>c[h]=(c[h]||0)+1));
 return c;
};

function ensureStyles(){
 if(document.querySelector('link[data-regulation-styles]'))return;
 const l=document.createElement("link");l.rel="stylesheet";l.href="./styles/regulation.css";l.dataset.regulationStyles="";document.head.appendChild(l);
}
function stopTimer(){if(timer){clearInterval(timer);timer=null}remaining=0}
function buzz(pattern){try{if(navigator.vibrate)navigator.vibrate(pattern)}catch{}}
function renderSession(){
 const el=mountRoot.querySelector(".sl-reg-session");
 if(!el)return;
 if(!active){el.innerHTML="";return}
 el.innerHTML=`<div class="sl-reg-session-inner">
   <div class="sl-reg-session-kicker">Regulation mode</div>
   <h3>${esc(active.label)}</h3>
   <p>${esc(active.sub)}</p>
   <ol>${active.steps.map((s,i)=>`<li><span>${i+1}</span><div>${esc(s)}</div></li>`).join("")}</ol>
   <div class="sl-reg-timer" aria-live="polite">
     <div class="sl-reg-timer-value" id="slRegTimer">${remaining?String(remaining):"2:00"}</div>
     <div class="sl-reg-timer-actions"><button type="button" data-reg-action="start">Start 2-minute reset</button><button type="button" data-reg-action="stop">Stop</button></div>
   </div>
   <div class="sl-reg-check"><span>After this, how do you feel?</span><div><button data-reg-feedback="easier" type="button">Easier</button><button data-reg-feedback="same" type="button">About the same</button><button data-reg-feedback="harder" type="button">Harder</button></div></div>
   <button class="sl-reg-close" type="button" data-reg-action="close">Back to modes</button>
 </div>`;
}
function startTimer(){
 stopTimer();remaining=120;updateTimer();buzz([35]);timer=setInterval(()=>{remaining--;updateTimer();if(remaining<=0){stopTimer();buzz([45,70,45]);}},1000)
}
function updateTimer(){
 const el=mountRoot?.querySelector("#slRegTimer");if(!el)return;
 const m=Math.floor(remaining/60),s=String(remaining%60).padStart(2,"0");el.textContent=`${m}:${s}`;
}
function bind(){
 mountRoot.querySelectorAll("[data-reg-mode]").forEach(b=>b.onclick=()=>{active=MODES.find(x=>x.id===b.dataset.regMode)||null;stopTimer();renderSession();mountRoot.querySelector(".sl-reg-session")?.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion:reduce)").matches?"auto":"smooth",block:"nearest"})});
 mountRoot.querySelectorAll("[data-reg-action]").forEach(b=>b.onclick=()=>{
   if(b.dataset.regAction==="start")startTimer();
   if(b.dataset.regAction==="stop")stopTimer(),updateTimer();
   if(b.dataset.regAction==="close")stopTimer(),active=null,renderSession();
 });
 mountRoot.querySelectorAll("[data-reg-feedback]").forEach(b=>b.onclick=()=>{
   const status=mountRoot.querySelector(".sl-reg-feedback-status"); if(status) status.textContent="Noted. You don't need to rate yourself.";
   buzz(b.dataset.regFeedback==="easier"?[25]:[]);
 });
}

export async function mountRegulation(){
 ensureStyles();
 try{
  const entries=await getEntries(),counts=getHelpCounts(entries);
  const personalized=TOOLKIT.map(([name,desc])=>({name,desc,count:counts[name]||0})).sort((a,b)=>b.count-a.count);
  mountRoot=document.getElementById("slRegulation");
  if(!mountRoot){mountRoot=document.createElement("section");mountRoot.id="slRegulation";mountRoot.className="sl-regulation";document.getElementById("view-regulation")?.appendChild(mountRoot)}
  mountRoot.innerHTML=`<div class="sl-reg-head"><div><div class="sl-reg-kicker">Regulation</div><h2>I need help right now</h2><p>No diagnosis. No score. Pick the closest state and use only what feels useful.</p></div></div>
  <div class="sl-reg-modes" aria-label="Regulation modes">${MODES.map(m=>`<button type="button" class="sl-reg-mode" data-reg-mode="${m.id}"><strong>${esc(m.label)}</strong><span>${esc(m.sub)}</span></button>`).join("")}</div>
  <div class="sl-reg-session" aria-live="polite"></div>
  <div class="sl-reg-toolkit"><div class="sl-reg-toolkit-head"><div><div class="sl-reg-kicker">Your toolkit</div><h3>Things you've said can help</h3></div><span class="sl-reg-note">Your history only</span></div>
  <div class="sl-reg-tools">${personalized.slice(0,6).map(x=>`<div class="sl-reg-tool"><strong>${esc(x.name)}</strong><span>${esc(x.desc)}</span>${x.count?`<small>Logged as helpful ${x.count} time${x.count===1?"":"s"}</small>`:"<small>Not logged yet</small>"}</div>`).join("")}</div></div>
  <div class="sl-reg-feedback-status" aria-live="polite"></div>`;
  bind();
 }catch(e){console.error("Sensory Log Regulation",e)}
}
