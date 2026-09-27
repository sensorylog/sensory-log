import { getEntries } from "./core/storage.js";
import { parseLocalDate } from "./core/date.js";

const MIN_GROUP = 3;
const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const avg = a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : null;
const fmt = n => n == null ? "—" : n.toFixed(1);
const pct = n => Math.round(n * 100);
const dateLabel = v => {
  const d = parseLocalDate(v);
  return d ? new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric"}).format(d) : v;
};
const consecutivePairs = sorted => {
  const out=[];
  for(let i=0;i<sorted.length-1;i++){
    const a=parseLocalDate(sorted[i].date), b=parseLocalDate(sorted[i+1].date);
    if(a && b && Math.round((b-a)/86400000)===1) out.push({prev:sorted[i],next:sorted[i+1]});
  }
  return out;
};
const values = (rows,key) => rows.map(e=>Number(e[key])).filter(Number.isFinite);
const meanDiff = (a,b) => {
  if(a.length<MIN_GROUP || b.length<MIN_GROUP) return null;
  return {a:avg(a),b:avg(b),diff:avg(a)-avg(b),nA:a.length,nB:b.length};
};
const evidenceText = (windowLabel, groups) => `Based on ${groups} observations in ${windowLabel}. This is a description of your logged history, not proof that one signal caused another.`;

function ensureStyles(){
  if(document.querySelector('link[data-pattern-styles]')) return;
  const link=document.createElement("link");
  link.rel="stylesheet"; link.href="./styles/patterns.css"; link.dataset.patternStyles="";
  document.head.appendChild(link);
}

function hideLegacy(){
  ["windowRow","metricRow","chartArea","weekdayArea","trendArea","insightArea","logArea"].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.hidden=true;
  });
}

function card({eyebrow,title,body,evidence,detail,kind="",action=null}){
  return `<article class="sl-pattern-card ${kind}" tabindex="0">
    <div class="sl-pattern-eyebrow">${esc(eyebrow)}</div>
    <h3 class="sl-pattern-title">${esc(title)}</h3>
    <p class="sl-pattern-body">${body}</p>
    <details class="sl-pattern-evidence">
      <summary>What this is based on</summary>
      <div class="sl-pattern-detail">${detail}</div>
    </details>
    <p class="sl-pattern-meta">${esc(evidence)}</p>
    ${action ? `<button class="sl-pattern-action" type="button" data-pattern-route="${esc(action.route)}">${esc(action.label)}</button>` : ""}
  </article>`;
}

function buildCards(entries){
  const sorted=[...entries].filter(e=>e && e.date).sort((a,b)=>a.date.localeCompare(b.date));
  const cards=[];
  if(sorted.length<5) return {cards,sorted};

  const windowDays=30;
  const windowRows=sorted.slice(-windowDays);
  const windowLabel=windowRows.length<windowDays ? `your ${windowRows.length} logged days` : "your most recent 30 logged days";

  const pairs=consecutivePairs(sorted);
  const pairWindow=pairs.slice(-30);

  // Masking → next-day energy
  const heavy=pairWindow.filter(p=>p.prev.masking!=null && p.prev.masking>=2);
  const light=pairWindow.filter(p=>p.prev.masking!=null && p.prev.masking<2);
  const mask=meanDiff(heavy.map(p=>p.next.energy).filter(Boolean),light.map(p=>p.next.energy).filter(Boolean));
  if(mask && Math.abs(mask.diff)>=0.35){
    const lower=mask.a<mask.b;
    cards.push(card({
      eyebrow:"Masking → next day",
      title:`${lower?"Lower":"Higher"} next-day energy after heavier masking`,
      body:`After 3+ hours of masking, next-day energy averaged <strong>${fmt(mask.a)}/5</strong>; after lighter masking it averaged <strong>${fmt(mask.b)}/5</strong>.`,
      evidence:`Evidence: ${mask.nA} heavier-masking days vs ${mask.nB} lighter-masking days`,
      detail:evidenceText("the most recent 30 consecutive day-pairs",mask.nA+mask.nB)+`<br><br>Observed difference: ${fmt(Math.abs(mask.diff))} points on the 1–5 energy scale.`
    }));
  }

  // Sleep quality → next-day energy
  const goodSleep=pairWindow.filter(p=>p.prev.sleepQuality>=4 && p.next.energy>0);
  const poorSleep=pairWindow.filter(p=>p.prev.sleepQuality>0 && p.prev.sleepQuality<=2 && p.next.energy>0);
  const sleep=meanDiff(goodSleep.map(p=>p.next.energy),poorSleep.map(p=>p.next.energy));
  if(sleep && Math.abs(sleep.diff)>=0.35){
    cards.push(card({
      eyebrow:"Sleep → next day",
      title:`${sleep.diff>0?"Higher":"Lower"} next-day energy after higher-quality sleep`,
      body:`After sleep quality of 4–5/5, next-day energy averaged <strong>${fmt(sleep.a)}/5</strong>; after 1–2/5, it averaged <strong>${fmt(sleep.b)}/5</strong>.`,
      evidence:`Evidence: ${sleep.nA} higher-quality nights vs ${sleep.nB} lower-quality nights`,
      detail:evidenceText("the most recent 30 consecutive day-pairs",sleep.nA+sleep.nB)+`<br><br>Observed difference: ${fmt(Math.abs(sleep.diff))} points.`
    }));
  }

  // Sensory load vs same-day energy: descriptive, not predictive.
  const highLoad=windowRows.filter(e=>e.overwhelm>=4 && e.energy>0);
  const lowerLoad=windowRows.filter(e=>e.overwhelm>0 && e.overwhelm<=2 && e.energy>0);
  const sensory=meanDiff(highLoad.map(e=>e.energy),lowerLoad.map(e=>e.energy));
  if(sensory && Math.abs(sensory.diff)>=0.4){
    cards.push(card({
      eyebrow:"Sensory load",
      title:`${sensory.diff<0?"Lower":"Higher"} energy was logged on higher-load days`,
      body:`Days with sensory saturation at 4–5/5 had an average energy of <strong>${fmt(sensory.a)}/5</strong>, compared with <strong>${fmt(sensory.b)}/5</strong> on 1–2/5 days.`,
      evidence:`Evidence: ${sensory.nA} higher-load days vs ${sensory.nB} lower-load days`,
      detail:evidenceText(windowLabel,sensory.nA+sensory.nB)+`<br><br>This compares signals recorded on the same day; it does not establish direction or cause.`
    }));
  }

  // Helpful strategies associated with next-day energy.
  const helpCounts={};
  sorted.forEach(e=>(e.helped||[]).forEach(h=>helpCounts[h]=(helpCounts[h]||0)+1));
  const helpCandidates=Object.entries(helpCounts).filter(([,n])=>n>=MIN_GROUP).sort((a,b)=>b[1]-a[1]);
  for(const [help] of helpCandidates){
    const withHelp=pairWindow.filter(p=>(p.prev.helped||[]).includes(help) && p.next.energy>0);
    const withoutHelp=pairWindow.filter(p=>!(p.prev.helped||[]).includes(help) && p.next.energy>0);
    const result=meanDiff(withHelp.map(p=>p.next.energy),withoutHelp.map(p=>p.next.energy));
    if(result && result.diff>=0.4){
      cards.push(card({
        eyebrow:"Recovery strategy",
        title:`Higher next-day energy on days logged with “${help}”`,
        body:`The next day averaged <strong>${fmt(result.a)}/5</strong> after days where this strategy was logged, versus <strong>${fmt(result.b)}/5</strong> when it was not logged.`,
        evidence:`Evidence: ${result.nA} days with this strategy vs ${result.nB} without it`,
        detail:evidenceText("the most recent 30 consecutive day-pairs",result.nA+result.nB)+`<br><br>Observed difference: ${fmt(result.diff)} points. A logged strategy may also reflect the kind of day you were already having.`,
        kind:"supportive",
        action:{route:"regulate",label:"Open regulation"}
      }));
      break;
    }
  }

  // Drains on low-energy days: frequency only.
  const low=windowRows.filter(e=>e.energy>0 && e.energy<=2);
  if(low.length>=4){
    const counts={};
    low.forEach(e=>(e.drains||[]).forEach(d=>counts[d]=(counts[d]||0)+1));
    const top=Object.entries(counts).filter(([,n])=>n>=2).sort((a,b)=>b[1]-a[1]).slice(0,3);
    if(top.length){
      const list=top.map(([d,n])=>`<strong>${esc(d)}</strong> (${n}/${low.length})`).join(", ");
      cards.push(card({
        eyebrow:"Low-energy context",
        title:"What showed up most often on lower-energy days",
        body:`Among your ${low.length} days logged at 1–2/5 energy, the most frequent drains were ${list}.`,
        evidence:`Evidence: ${low.length} lower-energy days in ${windowLabel}`,
        detail:evidenceText(windowLabel,low.length)+`<br><br>This is a frequency pattern only. A frequent drain is not necessarily the reason energy was low.`,
        action:{route:"history",label:"Review those days"}
      }));
    }
  }

  // Weekday pattern with minimum two observations each and meaningful spread.
  const buckets=Array.from({length:7},()=>[]);
  windowRows.forEach(e=>{if(e.energy>0){const d=parseLocalDate(e.date);if(d)buckets[d.getDay()].push(e.energy)}});
  const wk=buckets.map(a=>a.length>=2?avg(a):null);
  const valid=wk.filter(v=>v!=null);
  if(valid.length>=3 && Math.max(...valid)-Math.min(...valid)>=0.7){
    const max=Math.max(...valid), min=Math.min(...valid);
    const names=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const high=names[wk.indexOf(max)], lowDay=names[wk.indexOf(min)];
    cards.push(card({
      eyebrow:"Weekly rhythm",
      title:`Your logged energy varies across the week`,
      body:`In this window, average energy was <strong>${fmt(max)}/5</strong> on ${high} and <strong>${fmt(min)}/5</strong> on ${lowDay}. Other days may have too little data to compare.`,
      evidence:`Evidence: ${valid.length} weekdays with at least 2 observations`,
      detail:evidenceText(windowLabel,valid.length)+`<br><br>Weekday averages are descriptive and can change as more days are logged.`
    }));
  }

  // Outlier card.
  const vals=values(windowRows,"overwhelm");
  if(vals.length>=6){
    const m=avg(vals), sd=Math.sqrt(avg(vals.map(v=>(v-m)**2)))||0;
    const spikes=windowRows.filter(e=>e.overwhelm>0 && sd>0 && (e.overwhelm-m)/sd>=1.6).slice(-3);
    if(spikes.length){
      cards.push(card({
        eyebrow:"Unusual sensory days",
        title:"A few days sat well above your usual sensory-load range",
        body:`Your recent range has ${spikes.length} notable high-load day${spikes.length===1?"":"s"}: <strong>${spikes.map(e=>esc(dateLabel(e.date))).join(", ")}</strong>.`,
        evidence:`Evidence: ${vals.length} sensory-load observations`,
        detail:evidenceText(windowLabel,vals.length)+`<br><br>“Unusual” here means substantially above your own recent average, not abnormal or clinically meaningful.`,
        action:{route:"history",label:"Review those days"}
      }));
    }
  }

  return {cards:cards.slice(0,7),sorted};
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
  const {cards,sorted}=buildCards(entries);
  const enough=sorted.length>=5;
  root.innerHTML=`<div class="sl-pattern-head">
    <div>
      <div class="sl-pattern-kicker">Pattern intelligence</div>
      <h2>What your history is showing</h2>
      <p>Patterns are observations from your own entries. They are not diagnoses, predictions, or proof of cause.</p>
    </div>
    <div class="sl-pattern-count" aria-label="${sorted.length} logged days">${sorted.length} day${sorted.length===1?"":"s"} logged</div>
  </div>
  ${!enough ? `<div class="sl-pattern-empty"><strong>A few more days will make this useful.</strong><span>Keep logging only what feels manageable. Pattern cards appear once there is enough repeated information to compare.</span><button class="sl-pattern-action" type="button" data-pattern-route="checkin">Add a check-in</button></div>` :
    cards.length ? `<div class="sl-pattern-grid">${cards.join("")}</div>` :
    `<div class="sl-pattern-empty"><strong>Nothing is repeating clearly yet.</strong><span>There is no need to force a conclusion. Keep logging what matters and let the picture change with more observations.</span><button class="sl-pattern-action" type="button" data-pattern-route="checkin">Add a check-in</button></div>`}
  ${enough ? `<div class="sl-pattern-foot">The comparisons update from your saved history. Adding or removing entries can change them.</div>` : ""}`;
}

export async function mountPatternIntelligence(){
  try{render(await getEntries())}catch(error){console.error("Sensory Log Pattern Intelligence",error);render([])}
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
