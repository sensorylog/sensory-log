import { SIGNAL_ITEMS } from "./signal-data.js";
import { getLocal } from "./core/storage.js";
import { normalizeSignalFeed, personalizeSignal } from "./core/signal-engine.js";

const SIGNAL_KEY="sensoryLogSignalPrefs_v1";
const CATEGORIES=["All","People","Apps","Research","Community"];
const FEED_URL="./signal-feed.json";
const MANUAL_KEY="sensoryLogPersonalManual_v1";

function prefs(){
  try{
    const value=JSON.parse(localStorage.getItem(SIGNAL_KEY)||"{}");
    return {enabled:true,paused:false,hidden:false,category:"All",...value};
  }catch{
    return {enabled:true,paused:false,hidden:false,category:"All"};
  }
}
function save(value){try{localStorage.setItem(SIGNAL_KEY,JSON.stringify(value));}catch{}}
function formatDate(value){
  const date=new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())?value:new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric",year:"numeric"}).format(date);
}
function escapeHtml(value){
  return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function sourceLink(item){
  if(!item.sourceUrl)return escapeHtml(item.source||"Source");
  return `<a href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.source||"Source")} ↗</a>`;
}
function validItem(item){
  return item && typeof item==="object"
    && typeof item.id==="string"
    && ["People","Apps","Research","Community"].includes(item.type)
    && /^\d{4}-\d{2}-\d{2}$/.test(item.date)
    && typeof item.title==="string" && item.title.length>0 && item.title.length<=180
    && typeof item.text==="string" && item.text.length>0 && item.text.length<=500
    && typeof item.source==="string" && item.source.length>0
    && /^https?:\/\//.test(item.sourceUrl||"");
}
async function loadFeed(){
  try{
    const response=await fetch(FEED_URL,{cache:"no-store",headers:{Accept:"application/json"}});
    if(!response.ok)throw new Error("Signal feed unavailable");
    const payload=await response.json();
    return Array.isArray(payload?.items)?normalizeSignalFeed(payload.items.filter(validItem),24):[];
  }catch(error){
    console.warn("[Sensory Log] Signal feed unavailable; using bundled items",error);
    return [];
  }
}
function filteredItems(items,category){
  return category==="All"?items:items.filter(item=>item.type===category);
}
function render(items=SIGNAL_ITEMS){
  const root=document.getElementById("slSignal");
  if(!root)return;
  const p=prefs();
  if(!p.enabled||p.hidden){root.hidden=true;return;}
  const visible=filteredItems(items,p.category);
  const current=visible[0]||items[0]||SIGNAL_ITEMS[0];

  root.hidden=false;
  if(p.paused){
    root.innerHTML=`<div class="sl-signal-inner sl-signal-paused" role="region" aria-label="Signal paused">
      <div class="sl-signal-content">
        <div class="sl-signal-heading"><span class="sl-signal-label">SIGNAL</span><span class="sl-signal-status">Paused</span></div>
        <p class="sl-signal-paused-copy">Signal is paused. Your check-ins and personal history are unaffected.</p>
      </div>
      <div class="sl-signal-actions"><button type="button" data-signal-pause>Resume</button><button type="button" data-signal-hide>Hide</button></div>
    </div>`;
    root.querySelector("[data-signal-pause]").onclick=()=>{const next=prefs();next.paused=false;save(next);render(items)};
    root.querySelector("[data-signal-hide]").onclick=()=>{const next=prefs();next.hidden=true;save(next);render(items)};
    return;
  }

  root.innerHTML=`<div class="sl-signal-inner" role="region" aria-label="Signal">
    <div class="sl-signal-content">
      <div class="sl-signal-heading"><span class="sl-signal-label">SIGNAL</span><span class="sl-signal-status">Curated context · ${formatDate(current.date)}</span></div>
      <article class="sl-signal-feature">
        <span class="sl-signal-type">${escapeHtml(current.type)}</span>
        <strong>${escapeHtml(current.title)}</strong>
        <p>${escapeHtml(current.text)}</p>
        <div class="sl-signal-meta"><span>Source: ${sourceLink(current)}</span><span>Editorial category: ${escapeHtml(current.type)}</span><span class="sl-signal-evidence">${escapeHtml(current.evidence||"reported")}</span></div>
      </article>
      <div class="sl-signal-items">${visible.slice(1,4).map(item=>`<article class="sl-signal-item"><div class="sl-signal-item-top"><span class="sl-signal-type">${escapeHtml(item.type)}</span><time datetime="${escapeHtml(item.date)}">${formatDate(item.date)}</time></div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.text)}</p><div class="sl-signal-meta">${sourceLink(item)} <span class="sl-signal-evidence">${escapeHtml(item.evidence||"reported")}</span></div></article>`).join("")}</div>
    </div>
    <div class="sl-signal-actions"><button type="button" data-signal-pause>${p.paused?"Resume":"Pause"}</button><button type="button" data-signal-hide>Hide</button></div>
  </div>`;
  root.querySelector("[data-signal-pause]").onclick=()=>{const next=prefs();next.paused=!next.paused;save(next);render(items)};
  root.querySelector("[data-signal-hide]").onclick=()=>{const next=prefs();next.hidden=true;save(next);render(items)};
}
function renderPage(items){
  const root=document.getElementById("view-signal");
  if(!root)return;
  const p=prefs();
  const active=CATEGORIES.includes(p.category)?p.category:"All";
  const visible=filteredItems(items,active);
  root.innerHTML=`<section class="sl-signal-page" aria-labelledby="signalTitle">
    <div class="sl-signal-page-head">
      <div class="app-kicker">Signal</div>
      <h2 id="signalTitle">What’s moving around neurodivergence.</h2>
      <p>A small, curated view of useful app, people, research and community updates. No endless scroll. No engagement score. Every item shows its source, date and editorial category.</p>
    </div>
    <div class="sl-signal-filters" role="group" aria-label="Signal categories">
      ${CATEGORIES.map(category=>`<button type="button" class="${category===active?"is-active":""}" data-signal-category="${category}">${category}</button>`).join("")}
    </div>
    <div class="sl-signal-list">
      ${visible.map(item=>`<article class="sl-signal-card">
        <div class="sl-signal-card-top"><span class="sl-signal-type">${escapeHtml(item.type)}</span><time datetime="${escapeHtml(item.date)}">${formatDate(item.date)}</time></div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.text)}</p>
        <div class="sl-signal-source"><span>Source: ${sourceLink(item)}</span><span>Category: ${escapeHtml(item.type)}</span><span>Evidence: ${escapeHtml(item.evidence||"reported")}</span><span>${escapeHtml(item.note)}</span></div>
      </article>`).join("")}
    </div>
    <div class="sl-signal-principles">
      <strong>How Signal works</strong>
      <p>Signal is curated rather than personalized from your Sensory Log data. It does not read your check-ins, sell attention, or use your history to rank stories.</p>
      <p>People = people and lived-experience voices · Apps = products and releases · Research = research or research reporting · Community = organizations and community updates.</p>
    </div>
  </section>`;
  root.querySelectorAll("[data-signal-category]").forEach(button=>button.onclick=()=>{
    const next=prefs();next.category=button.dataset.signalCategory;save(next);renderPage(items);render(items);
  });
}
export function init(){
  let root=document.getElementById("slSignal");
  if(!root){
    root=document.createElement("aside");
    root.id="slSignal";
    root.className="sl-signal";
    const anchor=document.getElementById("view-signal");
    if(anchor)anchor.appendChild(root);
  }
  Promise.all([loadFeed(), getLocal(MANUAL_KEY, null)]).then(([remote, manual])=>{
    const base=remote.length?remote:normalizeSignalFeed(SIGNAL_ITEMS);
    const items=personalizeSignal(base, manual || {});
    renderPage(items);
    render(items);
  });
}
export function setSignalVisible(enabled){
  const next=prefs();next.enabled=!!enabled;next.hidden=false;next.paused=false;save(next);
  Promise.all([loadFeed(), getLocal(MANUAL_KEY, null)]).then(([remote, manual])=>{
    const base=remote.length?remote:normalizeSignalFeed(SIGNAL_ITEMS);
    render(personalizeSignal(base, manual || {}));
  });
}
export function restoreSignal(){setSignalVisible(true)}
init();