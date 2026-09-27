import { getEntries } from "./core/storage.js";
import { buildPatternIntelligence } from "./core/pattern-engine.js";

const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt = n => n == null ? "—" : Number(n).toFixed(1);

function ensureStyles(){
  if(document.querySelector('link[data-pattern-styles]')) return;
  const link=document.createElement("link");
  link.rel="stylesheet";
  link.href="./styles/patterns.css";
  link.dataset.patternStyles="";
  document.head.appendChild(link);
}

function hideLegacy(){
  ["windowRow","metricRow","chartArea","weekdayArea","trendArea","insightArea","logArea"].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.hidden=true;
  });
}

function evidence(detail){
  return `<details class="sl-pattern-evidence"><summary>What this is based on</summary><div class="sl-pattern-detail">${detail}</div></details>`;
}

function card({eyebrow,title,body,detail,meta,action}){
  return `<article class="sl-pattern-card">
    <div class="sl-pattern-eyebrow">${esc(eyebrow)}</div>
    <h3 class="sl-pattern-title">${esc(title)}</h3>
    <p class="sl-pattern-body">${body}</p>
    ${evidence(detail)}
    <p class="sl-pattern-meta">${esc(meta)}</p>
    ${action ? `<button class="sl-pattern-action" type="button" data-pattern-route="${esc(action.route)}">${esc(action.label)}</button>` : ""}
  </article>`;
}

function relationshipCards(intelligence){
  return intelligence.relationships
    .filter(r=>Math.abs(r.difference ?? 0)>=0.35)
    .slice(0,3)
    .map(r=>{
      const direction=r.difference>0?"higher":"lower";
      return card({
        eyebrow:"Signal relationship",
        title:`${r.label} shows a ${direction} next-day energy average`,
        body:`The first group averaged <strong>${fmt(r.a)}/5</strong> and the comparison group averaged <strong>${fmt(r.b)}/5</strong>.`,
        detail:`This is a descriptive comparison from your logged history. It does not establish causation. The groups contain ${r.nA} and ${r.nB} observations.`,
        meta:`Evidence: ${r.nA + r.nB} observations · ${r.measure === "nextDayEnergy" ? "consecutive day pairs" : "same-day entries"}`
      });
    });
}

function signatureCards(intelligence){
  return intelligence.signatures.slice(0,3).map(s=>{
    const noun=s.label.includes("strategy")?"strategy":"drain";
    return card({
      eyebrow:"Recurring signature",
      title:`${s.value} keeps showing up on lower-energy days`,
      body:`“${esc(s.value)}” appeared on <strong>${s.count}</strong> of ${s.sampleSize} lower-energy days in this window.`,
      detail:`This is a frequency pattern, not an explanation. It means the item was logged repeatedly when energy was 1–2/5.`,
      meta:`Evidence: ${s.count}/${s.sampleSize} lower-energy days · ${noun}`,
      action:{route:"history",label:"Review those days"}
    });
  });
}

function recoveryCard(intelligence){
  const groups=intelligence.recovery.groups;
  const available=[["higher recovery need",groups.high],["moderate recovery need",groups.moderate],["lower recovery need",groups.low]]
    .filter(([,g])=>g.sampleSize>=3);
  if(available.length<2) return null;
  const text=available.map(([label,g])=>`${label}: <strong>${fmt(g.value)}/5</strong> next-day energy (${g.sampleSize} observations)`).join(" · ");
  return card({
    eyebrow:"Recovery curve",
    title:"What tends to follow different recovery-need days",
    body:text,
    detail:"The groups describe what your next-day energy looked like after different recovery-need levels. This is not a prediction and does not prove that recovery need caused the following energy level.",
    meta:`Evidence: ${intelligence.recovery.sampleSize} consecutive day-pairs`,
    action:{route:"regulate",label:"Open regulation"}
  });
}

function trendCard(intelligence){
  const candidates=Object.entries(intelligence.trends.trends)
    .filter(([,t])=>t.difference!==null && Math.abs(t.difference)>=0.4)
    .sort((a,b)=>Math.abs(b[1].difference)-Math.abs(a[1].difference));
  if(!candidates.length) return null;
  const [field,t]=candidates[0];
  const labels={energy:"energy",overwhelm:"sensory load",sleepQuality:"sleep quality",socialBattery:"social battery",recovery:"recovery need"};
  const direction=t.difference>0?"higher":"lower";
  return card({
    eyebrow:"Long-term trend",
    title:`${labels[field]} is ${direction} in the newer part of this window`,
    body:`The earlier portion averaged <strong>${fmt(t.first)}/5</strong>; the newer portion averaged <strong>${fmt(t.second)}/5</strong>.`,
    detail:"The window is split into an earlier and newer portion. Trends describe change across your logs; they are not forecasts.",
    meta:`Evidence: ${t.sampleFirst} earlier observations · ${t.sampleSecond} newer observations`
  });
}

function render(entries){
  ensureStyles();
  hideLegacy();
  let root=document.getElementById("slPatterns");
  if(!root){
    root=document.createElement("section");
    root.id="slPatterns";
    root.className="sl-patterns";
    const heading=document.querySelector("h2");
    if(heading && heading.textContent.trim()==="Patterns") heading.replaceWith(root);
    else document.getElementById("view-patterns")?.appendChild(root);
  }

  const intelligence=buildPatternIntelligence(entries,{window:30});
  const enough=intelligence.sampleDays>=5;
  const cards=[];
  if(enough){
    cards.push(...relationshipCards(intelligence),...signatureCards(intelligence));
    const recovery=recoveryCard(intelligence);
    if(recovery) cards.push(recovery);
    const trend=trendCard(intelligence);
    if(trend) cards.push(trend);
  }

  root.innerHTML=`<div class="sl-pattern-head">
    <div>
      <div class="sl-pattern-kicker">Pattern intelligence</div>
      <h2>What your history is showing</h2>
      <p>Patterns are observations from your own entries. They are not diagnoses, predictions, or proof of cause.</p>
    </div>
    <div class="sl-pattern-count" aria-label="${intelligence.sampleDays} logged days">${intelligence.sampleDays} day${intelligence.sampleDays===1?"":"s"} logged</div>
  </div>
  ${!enough ? `<div class="sl-pattern-empty"><strong>A few more days will make this useful.</strong><span>Keep logging only what feels manageable. Pattern intelligence waits for repeated evidence instead of forcing a conclusion.</span><button class="sl-pattern-action" type="button" data-pattern-route="checkin">Add a check-in</button></div>` :
    cards.length ? `<div class="sl-pattern-grid">${cards.slice(0,7).join("")}</div>` :
    `<div class="sl-pattern-empty"><strong>Nothing is repeating clearly yet.</strong><span>There is no need to force a conclusion. Keep logging what matters and let the picture change with more observations.</span><button class="sl-pattern-action" type="button" data-pattern-route="checkin">Add a check-in</button></div>`}
  ${enough ? `<div class="sl-pattern-foot">The engine uses descriptive comparisons, minimum samples, and your saved history only. Adding or removing entries can change the picture.</div>` : ""}`;
}

export async function mountPatternIntelligence(){
  try{render(await getEntries())}
  catch(error){console.error("Sensory Log Pattern Intelligence",error);render([])}
}

let refreshQueued=false;
window.addEventListener("sensory-log:entries-changed",()=>{
  if(refreshQueued)return;
  refreshQueued=true;
  requestAnimationFrame(async()=>{refreshQueued=false;await mountPatternIntelligence()});
});

document.addEventListener("click",event=>{
  const button=event.target.closest("[data-pattern-route]");
  if(!button)return;
  const route=button.dataset.patternRoute;
  if(!route)return;
  document.querySelector(`[data-route="${CSS.escape(route)}"]`)?.click();
});

mountPatternIntelligence();
