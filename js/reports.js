import { getEntries } from "./core/storage.js";
import { parseLocalDate, localDateString } from "./core/date.js";

const state = { entries: [], days: 30, includeNotes: false };
let root = null;

const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));

const avg = values => {
  const a = values.filter(v => Number.isFinite(v));
  return a.length ? a.reduce((x,y)=>x+y,0) / a.length : null;
};
const fmt = v => v == null ? "—" : Number(v).toFixed(1);
const dayLabel = date => {
  const d = parseLocalDate(date);
  return d ? new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric",year:"numeric"}).format(d) : date;
};
const inWindow = (e, days) => {
  if (!e?.date) return false;
  if (days === "all") return true;
  const end = parseLocalDate(localDateString());
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - Number(days) + 1);
  const d = parseLocalDate(e.date);
  return !!d && d >= start && d <= end;
};

function metricBlock(label, values, note="") {
  return `<article class="sl-report-metric">
    <span>${esc(label)}</span>
    <strong>${fmt(avg(values))}<small>/5</small></strong>
    ${note ? `<em>${esc(note)}</em>` : ""}
  </article>`;
}

function frequencyList(entries, field, limit=5) {
  const counts = new Map();
  entries.forEach(e => (e[field] || []).forEach(v => counts.set(v,(counts.get(v)||0)+1)));
  return [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,limit);
}

function evidencePatterns(rows) {
  const cards = [];
  const paired = rows.slice().sort((a,b)=>a.date.localeCompare(b.date));
  const nextDay = (predicate) => {
    const selected = [];
    paired.forEach((e,i) => {
      const n = paired[i+1];
      if (!n || parseLocalDate(n.date)?.getTime() !== parseLocalDate(e.date)?.getTime() + 86400000) return;
      if (predicate(e) && n.energy > 0) selected.push(n.energy);
    });
    return selected;
  };
  const highMask = nextDay(e => Number(e.masking) >= 2);
  const lowMask = nextDay(e => Number(e.masking) <= 1);
  if (highMask.length >= 2 && lowMask.length >= 2) {
    const a=avg(highMask), b=avg(lowMask);
    cards.push({
      title:"Masking and the following day",
      text:`Following ${highMask.length} days with higher logged masking, next-day energy averaged ${fmt(a)}/5; following ${lowMask.length} lighter-masking days, it averaged ${fmt(b)}/5.`,
      evidence:`${highMask.length + lowMask.length} consecutive day-pairs`
    });
  }
  const highLoad=rows.filter(e=>e.overwhelm>=4 && e.energy>0).map(e=>e.energy);
  const lowLoad=rows.filter(e=>e.overwhelm>0 && e.overwhelm<=2 && e.energy>0).map(e=>e.energy);
  if(highLoad.length>=2 && lowLoad.length>=2) {
    cards.push({
      title:"Sensory load and logged energy",
      text:`Higher sensory-load days averaged ${fmt(avg(highLoad))}/5 energy across ${highLoad.length} entries; lower-load days averaged ${fmt(avg(lowLoad))}/5 across ${lowLoad.length} entries.`,
      evidence:`${highLoad.length + lowLoad.length} same-day observations`
    });
  }
  const goodSleep=nextDay(e=>Number(e.sleepQuality)>=4);
  const poorSleep=nextDay(e=>Number(e.sleepQuality)>0 && Number(e.sleepQuality)<=2);
  if(goodSleep.length>=2 && poorSleep.length>=2) {
    cards.push({
      title:"Sleep quality and the following day",
      text:`Following higher-quality sleep, next-day energy averaged ${fmt(avg(goodSleep))}/5 across ${goodSleep.length} pairs; following lower-quality sleep, it averaged ${fmt(avg(poorSleep))}/5 across ${poorSleep.length} pairs.`,
      evidence:`${goodSleep.length + poorSleep.length} consecutive day-pairs`
    });
  }
  return cards.slice(0,4);
}

function periodLabel(days){return days==="all"?"All time":String(days)+" days"}
function compareWindow(rows,days){if(days==="all"||!rows.length)return null;const end=parseLocalDate(localDateString()),span=Number(days),start=new Date(end.getFullYear(),end.getMonth(),end.getDate()-span),prevEnd=new Date(end.getFullYear(),end.getMonth(),end.getDate()-1);const prev=state.entries.filter(e=>{const d=parseLocalDate(e.date);return d&&d>=start&&d<=prevEnd});const mean=f=>avg(prev.filter(e=>e[f]>0).map(e=>e[f]));return {energy:mean("energy"),sensory:mean("overwhelm"),days:prev.length}}
function trendLine(rows,field){const points=rows.filter(e=>e[field]>0).slice(-14);if(points.length<2)return "";const w=280,h=54,coords=points.map((e,i)=>((i/(points.length-1))*w)+","+(h-((e[field]-1)/4)*h)).join(" ");return "<div class=\"sl-report-trend\" aria-label=\""+esc(field)+" trend\"><svg viewBox=\"0 0 "+w+" "+h+"\" aria-hidden=\"true\"><polyline points=\""+coords+"\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg></div>"}
function render() {
  const rows = state.entries.filter(e => inWindow(e,state.days)).sort((a,b)=>a.date.localeCompare(b.date));
  const energy=rows.filter(e=>e.energy>0).map(e=>e.energy);
  const sensory=rows.filter(e=>e.overwhelm>0).map(e=>e.overwhelm);
  const masking=rows.filter(e=>e.masking!=null).map(e=>e.masking);
  const recovery=rows.filter(e=>e.recovery>0).map(e=>e.recovery);
  const social=rows.filter(e=>e.socialBattery>0).map(e=>e.socialBattery);
  const sleep=rows.filter(e=>e.sleepQuality>0).map(e=>e.sleepQuality);
  const supports=frequencyList(rows,"helped");
  const drains=frequencyList(rows,"drains");
  const patterns=evidencePatterns(rows);
  const first=rows[0]?.date, last=rows[rows.length-1]?.date;
  const comparison=compareWindow(rows,state.days);
  const measured=rows.filter(e=>e.energy>0||e.overwhelm>0||e.recovery>0||e.sleepQuality>0||e.socialBattery>0).length;
  const completeness=rows.length?Math.round(measured/rows.length*100):0;

  root.innerHTML = `
    <section class="sl-report-hero">
      <div>
        <div class="sl-report-kicker">Personal report</div>
        <h2>Your Sensory Log report</h2>
        <p>A compact view of what you recorded in this period. It describes observations from your own data; it is not a diagnosis or medical assessment.</p>
      </div>
      <div class="sl-report-range">${first ? esc(dayLabel(first))+" → "+esc(dayLabel(last)) : "No entries in this period"}<small>${periodLabel(state.days)} view</small></div>
    </section>

    <section class="sl-report-controls" aria-label="Report controls">
      <div>
        <span class="sl-report-control-label">Time window</span>
        <div class="sl-report-options">
          ${[7,30,90,"all"].map(d=>`<button type="button" class="${state.days===d?"active":""}" data-report-days="${d}">${d==="all"?"All time":d+" days"}</button>`).join("")}
        </div>
      </div>
      <label class="sl-report-check"><input type="checkbox" id="slReportNotes" ${state.includeNotes?"checked":""}/> Include written notes in the printable report</label>
      <div class="sl-report-actions">
        <button type="button" class="sl-report-primary" data-report-print>Print / Save as PDF</button>
      </div>
    </section>

    ${!rows.length ? `<section class="sl-report-empty"><strong>Nothing to report for this window.</strong><span>Choose a longer window or log a day when it feels manageable.</span></section>` : `
      <section class="sl-report-section">
        <div class="sl-report-section-head"><div><div class="sl-report-kicker">Snapshot</div><h3>Your recorded signals</h3></div><span>${rows.length} logged day${rows.length===1?"":"s"}</span></div>
        <div class="sl-report-metrics">
          ${metricBlock("Energy",energy)}
          ${metricBlock("Sensory load",sensory)}
          ${metricBlock("Masking",masking,"0 none · 3 = 6h+")}
          ${metricBlock("Recovery needed",recovery)}
          ${metricBlock("Social battery",social)}
          ${metricBlock("Sleep quality",sleep)}
        </div>
      </section>
      <div class="sl-report-trends"><div><span>Energy trend</span>${trendLine(rows,"energy")}</div><div><span>Sensory-load trend</span>${trendLine(rows,"overwhelm")}</div></div>
      ${comparison ? `<section class="sl-report-section"><div class="sl-report-section-head"><div><div class="sl-report-kicker">Context</div><h3>This period compared with the previous one</h3></div></div><div class="sl-report-comparison"><div><span>Previous period</span><strong>${comparison.days} logged day${comparison.days===1?"":"s"}</strong></div><div><span>Energy average</span><strong>${comparison.energy==null?"—":fmt(comparison.energy)+"/5"}</strong></div><div><span>Sensory load</span><strong>${comparison.sensory==null?"—":fmt(comparison.sensory)+"/5"}</strong></div></div><p class="sl-report-muted">Descriptive comparison only; it does not establish cause.</p></section>` : ""}
      <section class="sl-report-section">
        <div class="sl-report-section-head"><div><div class="sl-report-kicker">Context</div><h3>What appeared most often</h3></div><span>${completeness}% of days had at least one measured signal</span></div>
        <div class="sl-report-columns">
          <div><h4>Common drains</h4>${drains.length ? drains.map(([x,n])=>`<div class="sl-report-list-row"><span>${esc(x)}</span><strong>${n} day${n===1?"":"s"}</strong></div>`).join("") : '<p class="sl-report-muted">No drains recorded.</p>'}</div>
          <div><h4>What helped</h4>${supports.length ? supports.map(([x,n])=>`<div class="sl-report-list-row"><span>${esc(x)}</span><strong>${n} day${n===1?"":"s"}</strong></div>`).join("") : '<p class="sl-report-muted">No support strategies recorded.</p>'}</div>
        </div>
      </section>

      <section class="sl-report-section">
        <div class="sl-report-section-head"><div><div class="sl-report-kicker">Evidence</div><h3>Repeated observations</h3></div></div>
        ${patterns.length ? patterns.map(p=>`<article class="sl-report-evidence"><h4>${esc(p.title)}</h4><p>${esc(p.text)}</p><small>Based on ${esc(p.evidence)}. This is an observed comparison, not proof of cause.</small></article>`).join("") : '<div class="sl-report-empty compact"><strong>Not enough repeated observations yet.</strong><span>Reports stay quiet rather than filling the page with weak conclusions.</span></div>'}
      </section>

      <section class="sl-report-section">
        <div class="sl-report-section-head"><div><div class="sl-report-kicker">Support context</div><h3>Lower-capacity days</h3></div></div>
        ${(() => {
          const low=rows.filter(e=>e.energy>0&&e.energy<=2);
          const high=rows.filter(e=>e.overwhelm>=4);
          return `<div class="sl-report-support-grid">
            <div><strong>${low.length}</strong><span>days at energy 1–2/5</span></div>
            <div><strong>${high.length}</strong><span>days at sensory load 4–5/5</span></div>
            <div><strong>${rows.filter(e=>e.meltdown===2).length}</strong><span>days marked meltdown/shutdown occurred</span></div>
          </div>`;
        })()}
      </section>

      ${state.includeNotes ? `
      <section class="sl-report-section sl-report-notes">
        <div class="sl-report-section-head"><div><div class="sl-report-kicker">Private notes</div><h3>Written notes from this period</h3></div></div>
        ${rows.filter(e=>e.note).map(e=>`<article><time>${esc(dayLabel(e.date))}</time><p>${esc(e.note)}</p></article>`).join("") || '<p class="sl-report-muted">No written notes in this period.</p>'}
      </section>` : ""}

      <section class="sl-report-footer">
        <strong>About this report</strong>
        <p>This report uses only the entries saved in Sensory Log for the selected period. Missing values are left out of averages. Comparisons are descriptive and do not establish medical causation, diagnosis, or prognosis.</p>
        <p>Generated locally on ${esc(dayLabel(localDateString()))}. Share only what you are comfortable sharing.</p>
      </section>
    `}
  `;
  bind();
}

function bind() {
  root.querySelectorAll("[data-report-days]").forEach(b=>b.setAttribute("aria-pressed",String(state.days===(b.dataset.reportDays==="all"?"all":Number(b.dataset.reportDays)))));
  root.querySelectorAll("[data-report-days]").forEach(b=>b.onclick=()=>{ state.days=b.dataset.reportDays==="all"?"all":Number(b.dataset.reportDays); render(); });
  const notes=root.querySelector("#slReportNotes");
  if(notes) notes.onchange=()=>{state.includeNotes=notes.checked;render();};
  const print=root.querySelector("[data-report-print]");
  if(print) print.onclick=()=>window.print();
}

export async function mountReports() {
  try {
    state.entries=await getEntries();
    root=document.getElementById("slReports");
    if(!root){
      root=document.createElement("section");
      root.id="slReports";
      root.className="sl-reports";
      document.getElementById("view-reports")?.appendChild(root);
    }
    render();
  } catch(error) {
    console.error("Sensory Log Reports",error);
  }
}
window.addEventListener("sensory-log:entries-changed",async()=>{state.entries=await getEntries();if(root)render()});
mountReports();
