import { SIGNAL_ITEMS } from "./signal-data.js";

const SIGNAL_KEY="sensoryLogSignalPrefs_v1";
const CATEGORIES=["All","People","Apps","Research","Community"];

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
function filteredItems(category){
  return category==="All"?SIGNAL_ITEMS:SIGNAL_ITEMS.filter(item=>item.type===category);
}
function render(){
  const root=document.getElementById("slSignal");
  if(!root)return;
  const p=prefs();
  if(!p.enabled||p.hidden){root.hidden=true;return;}
  const items=filteredItems(p.category);
  const current=items[0]||SIGNAL_ITEMS[0];
  root.hidden=false;
  root.innerHTML=`<div class="sl-signal-inner" role="region" aria-label="Signal">
    <div class="sl-signal-content">
      <div class="sl-signal-heading"><span class="sl-signal-label">SIGNAL</span><span class="sl-signal-status">Curated context · ${formatDate(current.date)}</span></div>
      <article class="sl-signal-feature">
        <span class="sl-signal-type">${escapeHtml(current.type)}</span>
        <strong>${escapeHtml(current.title)}</strong>
        <p>${escapeHtml(current.text)}</p>
        <div class="sl-signal-meta">${sourceLink(current)}</div>
      </article>
      <div class="sl-signal-items">${items.slice(1,4).map(item=>`<article class="sl-signal-item"><div class="sl-signal-item-top"><span class="sl-signal-type">${escapeHtml(item.type)}</span><time datetime="${escapeHtml(item.date)}">${formatDate(item.date)}</time></div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.text)}</p><div class="sl-signal-meta">${sourceLink(item)}</div></article>`).join("")}</div>
    </div>
    <div class="sl-signal-actions"><button type="button" data-signal-pause>${p.paused?"Resume":"Pause"}</button><button type="button" data-signal-hide>Hide</button></div>
  </div>`;
  root.querySelector("[data-signal-pause]").onclick=()=>{const next=prefs();next.paused=!next.paused;save(next);render()};
  root.querySelector("[data-signal-hide]").onclick=()=>{const next=prefs();next.hidden=true;save(next);render()};
}
function renderPage(){
  const root=document.getElementById("view-signal");
  if(!root)return;
  const p=prefs();
  const active=CATEGORIES.includes(p.category)?p.category:"All";
  const items=filteredItems(active);
  root.innerHTML=`<section class="sl-signal-page" aria-labelledby="signalTitle">
    <div class="sl-signal-page-head">
      <div class="app-kicker">Signal</div>
      <h2 id="signalTitle">What’s moving around neurodivergence.</h2>
      <p>A small, curated view of useful app, people, research and community updates. No endless scroll. No engagement score. Sources are always shown.</p>
    </div>
    <div class="sl-signal-filters" role="group" aria-label="Signal categories">
      ${CATEGORIES.map(category=>`<button type="button" class="${category===active?"is-active":""}" data-signal-category="${category}">${category}</button>`).join("")}
    </div>
    <div class="sl-signal-list">
      ${items.map(item=>`<article class="sl-signal-card">
        <div class="sl-signal-card-top"><span class="sl-signal-type">${escapeHtml(item.type)}</span><time datetime="${escapeHtml(item.date)}">${formatDate(item.date)}</time></div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.text)}</p>
        <div class="sl-signal-source"><span>${sourceLink(item)}</span><span>${escapeHtml(item.note)}</span></div>
      </article>`).join("")}
    </div>
    <div class="sl-signal-principles">
      <strong>How Signal works</strong>
      <p>Signal is curated rather than personalized from your Sensory Log data. It does not read your check-ins, sell attention, or use your history to rank stories.</p>
    </div>
  </section>`;
  root.querySelectorAll("[data-signal-category]").forEach(button=>button.onclick=()=>{
    const next=prefs();next.category=button.dataset.signalCategory;save(next);renderPage();render();
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
  renderPage();
  render();
}
export function setSignalVisible(enabled){
  const next=prefs();next.enabled=!!enabled;next.hidden=false;next.paused=false;save(next);render();
}
export function restoreSignal(){setSignalVisible(true)}
init();