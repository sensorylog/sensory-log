import { getEntries } from "./core/storage.js";
import { localDateString, parseLocalDate } from "./core/date.js";

const root=document.querySelector(".wrap");
if(!root) throw new Error("Sensory Log home root unavailable");
const esc=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const today=localDateString();

function scale(id,cls){
  const b=document.querySelector("#"+id+" button."+cls);
  if(!b) return 0;
  const n=parseInt(b.textContent,10);
  return Number.isFinite(n)?n:0;
}
function masking(){
  const b=document.querySelector("#maskingChips .active");
  if(!b)return null;
  const t=b.textContent.trim();
  if(t==="None")return 0;
  if(t.indexOf("1")>=0)return 1;
  if(t.indexOf("3")>=0)return 2;
  return 3;
}
function live(){
  return {energy:scale("energyScale","on-energy"),overwhelm:scale("overwhelmScale","on-overwhelm"),recovery:scale("recoveryScale","on-recovery"),social:scale("socialScale","on-social"),masking:masking()};
}
function effective(entries){
  const saved=entries.find(e=>e.date===today)||null, l=live();
  return {energy:l.energy||saved?.energy||0,overwhelm:l.overwhelm||saved?.overwhelm||0,recovery:l.recovery||saved?.recovery||0,social:l.social||saved?.socialBattery||0,masking:l.masking??saved?.masking??null};
}
function message(s){
  if(!s.energy)return ["Your state is waiting","Start with a small check-in. Nothing needs to be perfect."];
  if(s.overwhelm>=4)return ["A lot is reaching you","Your sensory load is high today. Reducing input may be useful before adding more demands."];
  if(s.energy<=2&&s.recovery>=4)return ["Capacity looks low","You’re logging low energy with a high need for recovery. Protecting space may help."];
  if(s.masking>=2&&s.energy<=3)return ["You may need more room","Today includes heavier masking alongside lower energy. Notice what feels easier when you can unmask."];
  if(s.energy>=4&&s.overwhelm<=2)return ["Your state looks steadier","Energy is relatively solid and sensory load is not especially high in today’s check-in."];
  if(s.recovery>=4)return ["Recovery is asking for attention","Your recovery rating is high. Consider checking what has actually helped on similar days."];
  return ["Your state is mixed","Nothing needs to be solved here. The useful part is noticing what is present."];
}
function need(s){
  if(!s.energy)return ["Start wherever you are","A one-minute check-in is enough. You can leave anything else blank."];
  if(s.overwhelm>=4)return ["Less input","Quiet, lower light, fewer conversations, or a familiar environment may be worth trying."];
  if(s.energy<=2)return ["Lower the demand","Choose the smallest next action and leave room for recovery rather than pushing through."];
  if(s.recovery>=4)return ["Recovery space","Look back at strategies that have helped you recover without adding more stimulation."];
  if(s.masking>=2)return ["Less performance","If it is safe to do so, notice where you can reduce social or sensory masking."];
  return ["Keep observing","Your current signals do not point to one obvious need. That is useful information too."];
}
function dateLabel(v){const d=parseLocalDate(v);return d?new Intl.DateTimeFormat(undefined,{weekday:"short",month:"short",day:"numeric"}).format(d):v}
function shortDate(v){const d=parseLocalDate(v);return d?new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric"}).format(d):v}
function metric(label,v){return '<div class="sl-metric"><div class="sl-metric-label">'+label+'</div><div class="sl-metric-value">'+(v||"—")+'<span>'+(v?" / 5":"")+'</span></div><div class="sl-metric-bar"><i style="width:'+(v?clamp(v/5*100,0,100):0)+'%"></i></div></div>'}

function render(entries){
  let home=document.getElementById("slHome");
  if(!home){home=document.createElement("section");home.id="slHome";home.className="sl-home";const tip=document.getElementById("phoneTip");root.insertBefore(home,tip||root.firstChild)}
  const s=effective(entries),m=message(s),n=need(s);
  const hist=entries.filter(e=>e.energy>0).sort((a,b)=>a.date.localeCompare(b.date));
  const prior=hist.filter(e=>e.date!==today).slice(-7).map(e=>e.energy),base=avg(prior);
  const delta=base&&s.energy?s.energy-base:null;
  const recent=hist.slice(-7).reverse();
  const days=recent.length?recent.map(e=>'<div class="sl-day"><div class="sl-day-date">'+esc(shortDate(e.date))+'</div><div class="sl-day-score">'+e.energy+'/5</div><div class="sl-day-note">'+(e.overwhelm?"load "+e.overwhelm:"no load")+'</div></div>').join(""):'<p class="sl-home-empty">Your recent state will appear here as you log days.</p>';
  const mask=s.masking===null?"":'<div class="sl-baseline" style="margin-top:15px"><div class="sl-baseline-row"><span>Masking</span><strong>'+(s.masking===0?"None":s.masking===1?"1–2 hours":s.masking===2?"3–5 hours":"6+ hours")+'</strong></div></div>';
  home.innerHTML='<section class="sl-home-hero" aria-labelledby="slHomeTitle"><div class="sl-home-kicker">Today · '+esc(dateLabel(today))+'</div><h2 id="slHomeTitle" class="sl-home-title">How are you, right now?</h2><p class="sl-home-date">A private read of what you have logged — not a diagnosis, and not a score you need to chase.</p><div class="sl-state-orb" aria-hidden="true"><div class="sl-state-score">'+(s.energy||"—")+'</div></div><p class="sl-state-caption">'+esc(m[0])+'</p><p class="sl-state-detail">'+esc(m[1])+'</p><div class="sl-home-actions"><button type="button" class="sl-home-action primary" data-sl-scroll="checkin">Check in</button><button type="button" class="sl-home-action" data-sl-scroll="patterns">See patterns</button></div></section><section class="sl-home-section" aria-labelledby="slSignalsTitle"><div class="sl-home-section-head"><h3 id="slSignalsTitle" class="sl-home-section-title">Your signals</h3><span class="sl-home-section-meta">today</span></div><div class="sl-metrics">'+metric("Energy",s.energy)+metric("Sensory load",s.overwhelm)+metric("Recovery",s.recovery)+metric("Social battery",s.social)+'</div></section><section class="sl-home-section" aria-labelledby="slNeedTitle"><div class="sl-home-section-head"><h3 id="slNeedTitle" class="sl-home-section-title">What might you need?</h3></div><div class="sl-need"><div class="sl-need-mark" aria-hidden="true"></div><div class="sl-need-copy"><strong>'+esc(n[0])+'</strong><span>'+esc(n[1])+'</span></div></div>'+mask+'</section><section class="sl-home-section" aria-labelledby="slBaselineTitle"><div class="sl-home-section-head"><h3 id="slBaselineTitle" class="sl-home-section-title">Your baseline</h3><span class="sl-home-section-meta">last 7 logged days</span></div>'+(base?'<div class="sl-baseline"><div class="sl-baseline-row"><span>Average energy</span><strong>'+base.toFixed(1)+' / 5</strong></div><div class="sl-baseline-row"><span>Today vs baseline</span><strong>'+(delta>0?"↑ ":delta<0?"↓ ":"=")+Math.abs(delta).toFixed(1)+'</strong></div></div>':'<p class="sl-home-empty">A personal baseline needs a few logged days. It is calculated from your own history, not a generic target.</p>')+'</section><section class="sl-home-section" aria-labelledby="slRecentTitle" style="grid-column:1/-1"><div class="sl-home-section-head"><h3 id="slRecentTitle" class="sl-home-section-title">Recent rhythm</h3><span class="sl-home-section-meta">most recent first</span></div><div class="sl-recent">'+days+'</div></section>';
  home.querySelectorAll("[data-sl-scroll]").forEach(btn=>btn.onclick=()=>{const t=btn.dataset.slScroll==="checkin"?document.querySelector(".card"):document.getElementById("chartArea");if(t)t.scrollIntoView({behavior:document.documentElement.dataset.motion==="reduced"?"auto":"smooth",block:"start"})});
}
async function refresh(){try{render(await getEntries())}catch(e){console.error("Sensory Log Home",e);render([])}}
refresh();
const card=document.querySelector(".card");
if(card){const o=new MutationObserver(()=>{clearTimeout(o._t);o._t=setTimeout(refresh,100)});o.observe(card,{subtree:true,childList:true,attributes:true})}
window.addEventListener("storage",refresh);
setInterval(refresh,2500);
