import { getEntries } from "./core/storage.js";
import { parseLocalDate, localDateString } from "./core/date.js";

let entries=[];
let cursor=new Date();
let selectedDate=localDateString();
let root=null;

const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pad=n=>String(n).padStart(2,"0");
const dateKey=(y,m,d)=>`${y}-${pad(m+1)}-${pad(d)}`;
const monthName=d=>new Intl.DateTimeFormat(undefined,{month:"long",year:"numeric"}).format(d);
const dayName=d=>new Intl.DateTimeFormat(undefined,{weekday:"short",month:"short",day:"numeric"}).format(d);

function ensureStyles(){
 if(document.querySelector('link[data-history-styles]'))return;
 const l=document.createElement("link");l.rel="stylesheet";l.href="./styles/history.css";l.dataset.historyStyles="";document.head.appendChild(l);
}
function entryFor(date){return entries.find(e=>e.date===date)}
function monthStats(){
 const y=cursor.getFullYear(),m=cursor.getMonth();
 const rows=entries.filter(e=>{const d=parseLocalDate(e.date);return d&&d.getFullYear()===y&&d.getMonth()===m});
 const energy=rows.map(e=>Number(e.energy)).filter(v=>v>0);
 const sensory=rows.map(e=>Number(e.overwhelm)).filter(v=>v>0);
 return {rows,avgEnergy:energy.length?energy.reduce((a,b)=>a+b,0)/energy.length:null,avgSensory:sensory.length?sensory.reduce((a,b)=>a+b,0)/sensory.length:null};
}
function goToDate(date){
 selectedDate=date;
 window.dispatchEvent(new CustomEvent("sensory-log:open-date",{detail:{date}}));
 window.location.hash="#checkin";
}
function render(){
 const y=cursor.getFullYear(),m=cursor.getMonth();
 const first=new Date(y,m,1), last=new Date(y,m+1,0);
 const start=(first.getDay()+6)%7;
 const cells=[];
 for(let i=0;i<start;i++)cells.push('<div class="sl-cal-cell sl-cal-empty" aria-hidden="true"></div>');
 for(let d=1;d<=last.getDate();d++){
  const date=dateKey(y,m,d), e=entryFor(date), today=date===localDateString();
  const energy=e?.energy||0, sensory=e?.overwhelm||0;
  const label=e?`${dayName(parseLocalDate(date))}; energy ${energy} of 5; sensory load ${sensory} of 5`:`${dayName(parseLocalDate(date))}; no entry`;
  cells.push(`<button type="button" class="sl-cal-cell ${e?"has-entry":""} ${today?"is-today":""} ${date===selectedDate?"is-selected":""}" data-history-date="${date}" aria-label="${esc(label)}">
    <span class="sl-cal-day">${d}</span>
    ${e?`<span class="sl-cal-mark" aria-hidden="true"><i style="--level:${energy}"></i></span><span class="sl-cal-energy">${energy}/5</span>`:"<span class=\"sl-cal-empty-label\">—</span>"}
  </button>`);
 }
 const s=monthStats();
 const selected=entryFor(selectedDate);
 root.innerHTML=`<section class="sl-history-head">
   <div><div class="sl-history-kicker">Calendar & history</div><h2>Your history</h2><p>See your logged days without turning your life into a spreadsheet.</p></div>
   <button type="button" class="sl-history-today" data-history-action="today">Today</button>
 </section>
 <section class="sl-history-shell">
   <div class="sl-history-nav">
     <button type="button" aria-label="Previous month" data-history-action="prev">‹</button>
     <strong>${monthName(cursor)}</strong>
     <button type="button" aria-label="Next month" data-history-action="next">›</button>
   </div>
   <div class="sl-cal-week" aria-hidden="true">${["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(x=>`<span>${x}</span>`).join("")}</div>
   <div class="sl-cal-grid">${cells.join("")}</div>
   <div class="sl-history-summary">
     <div><strong>${s.rows.length}</strong><span>logged day${s.rows.length===1?"":"s"}</span></div>
     <div><strong>${s.avgEnergy==null?"—":s.avgEnergy.toFixed(1)}</strong><span>avg energy</span></div>
     <div><strong>${s.avgSensory==null?"—":s.avgSensory.toFixed(1)}</strong><span>avg sensory load</span></div>
   </div>
 </section>
 ${selected?detail(selected):`<section class="sl-history-detail sl-history-empty"><strong>Pick a logged day to inspect it.</strong><span>The calendar is for browsing; editing still happens in the check-in above.</span></section>`}
 <section class="sl-history-list">
   <div class="sl-history-list-head"><h3>Recent entries</h3><span>${entries.length} total</span></div>
   ${entries.length?entries.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,12).map(e=>row(e)).join(""):'<p class="sl-history-muted">No days logged yet.</p>'}
 </section>`;
 bind();
}
function detail(e){
 const chips=[...(e.drains||[]).slice(0,3),...(e.helped||[]).slice(0,3)];
 return `<section class="sl-history-detail"><div class="sl-history-detail-top"><div><div class="sl-history-kicker">Selected day</div><h3>${esc(dayName(parseLocalDate(e.date)))}</h3></div><button type="button" class="sl-history-edit" data-history-date="${e.date}">Open check-in</button></div>
 <div class="sl-history-metrics"><div><span>Energy</span><strong>${e.energy == null || e.energy === 0 ? "—" : e.energy}/5</strong></div><div><span>Sensory</span><strong>${e.overwhelm == null || e.overwhelm === 0 ? "—" : e.overwhelm}/5</strong></div><div><span>Recovery</span><strong>${e.recovery == null || e.recovery === 0 ? "—" : e.recovery}/5</strong></div><div><span>Social</span><strong>${e.socialBattery == null || e.socialBattery === 0 ? "—" : e.socialBattery}/5</strong></div></div>
 ${chips.length?`<div class="sl-history-chips">${chips.map(x=>`<span>${esc(x)}</span>`).join("")}</div>`:""}
 ${e.note?`<p class="sl-history-note">“${esc(e.note)}”</p>`:""}
 </section>`;
}
function row(e){
 return `<button type="button" class="sl-history-row ${e.date===selectedDate?"is-selected":""}" data-history-date="${e.date}"><span><strong>${esc(dayName(parseLocalDate(e.date)))}</strong><small>${e.note?esc(e.note):"No note"}</small></span><span class="sl-history-row-value"><strong>${e.energy||"—"}/5</strong><small>energy</small></span></button>`;
}
function bind(){
 root.querySelectorAll("[data-history-action]").forEach(b=>b.onclick=()=>{
  const a=b.dataset.historyAction;
  if(a==="prev")cursor=new Date(cursor.getFullYear(),cursor.getMonth()-1,1);
  if(a==="next")cursor=new Date(cursor.getFullYear(),cursor.getMonth()+1,1);
  if(a==="today"){cursor=new Date();selectedDate=localDateString();}
  render();
 });
 root.querySelectorAll("[data-history-date]").forEach(b=>b.onclick=()=>{
  const date=b.dataset.historyDate;
  const d=parseLocalDate(date);
  selectedDate=date;
  if(b.classList.contains("sl-history-edit")) goToDate(date);
  else if(d){cursor=new Date(d.getFullYear(),d.getMonth(),1);render();}
 });
}
window.addEventListener("sensory-log:entries-changed", async () => { entries=await getEntries(); render(); });

export async function mountHistory(){
 ensureStyles();
 try{entries=await getEntries();root=document.getElementById("slHistory");if(!root){root=document.createElement("section");root.id="slHistory";root.className="sl-history";document.getElementById("view-history")?.appendChild(root)}render();}
 catch(e){console.error("Sensory Log Calendar",e)}
}

mountHistory();
