import { SIGNAL_ITEMS } from "./signal-data.js";

const SIGNAL_KEY="sensoryLogSignalPrefs_v1";

function prefs(){
  try{
    const value=JSON.parse(localStorage.getItem(SIGNAL_KEY)||"{}");
    return {enabled:true,paused:false,hidden:false,...value};
  }catch{
    return {enabled:true,paused:false,hidden:false};
  }
}

function save(value){
  try{localStorage.setItem(SIGNAL_KEY,JSON.stringify(value));}catch{}
}

function formatDate(value){
  const date=new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric",year:"numeric"}).format(date);
}

function escapeHtml(value){
  return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
}

function sourceLink(item){
  if(!item.sourceUrl)return escapeHtml(item.source||"Source");
  return `<a href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.source||"Source")} ↗</a>`;
}

function render(){
  const root=document.getElementById("slSignal");
  if(!root)return;

  const p=prefs();
  if(!p.enabled||p.hidden){
    root.hidden=true;
    return;
  }

  const items=SIGNAL_ITEMS;
  if(p.paused){
    root.hidden=false;
    root.innerHTML=`<div class="sl-signal-inner" role="region" aria-label="Signal paused">
      <div class="sl-signal-content"><div class="sl-signal-heading"><span class="sl-signal-label">SIGNAL</span><span class="sl-signal-status">Paused</span></div><div class="sl-signal-feature"><p>Signal is paused. Nothing new is being surfaced here.</p></div></div>
      <div class="sl-signal-actions"><button type="button" data-signal-pause>Resume</button><button type="button" data-signal-hide>Hide</button></div>
    </div>`;
    root.querySelector("[data-signal-pause]").onclick=()=>{const next=prefs();next.paused=false;save(next);render()};
    root.querySelector("[data-signal-hide]").onclick=()=>{const next=prefs();next.hidden=true;save(next);render()};
    return;
  }
  const current=items[0];
  root.hidden=false;
  root.innerHTML=`<div class="sl-signal-inner" role="region" aria-label="Signal">
    <div class="sl-signal-content">
      <div class="sl-signal-heading">
        <span class="sl-signal-label">SIGNAL</span>
        <span class="sl-signal-status">Fresh context · ${formatDate(current.date)}</span>
      </div>
      <article class="sl-signal-feature">
        <span class="sl-signal-type">${escapeHtml(current.type)}</span>
        <strong>${escapeHtml(current.title)}</strong>
        <p>${escapeHtml(current.text)}</p>
        <div class="sl-signal-meta">${sourceLink(current)}<span>${escapeHtml(current.note)}</span></div>
      </article>
      <div class="sl-signal-items">
        ${items.slice(1,5).map(item=>`<article class="sl-signal-item">
          <div class="sl-signal-item-top"><span class="sl-signal-type">${escapeHtml(item.type)}</span><time datetime="${escapeHtml(item.date)}">${formatDate(item.date)}</time></div>
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(item.text)}</p>
          <div class="sl-signal-meta">${sourceLink(item)}</div>
        </article>`).join("")}
      </div>
    </div>
    <div class="sl-signal-actions">
      <button type="button" data-signal-pause>${p.paused?"Resume":"Pause"}</button>
      <button type="button" data-signal-hide>Hide</button>
    </div>
  </div>`;

  root.querySelector("[data-signal-pause]").onclick=()=>{
    const next=prefs();
    next.paused=!next.paused;
    save(next);
    render();
  };
  root.querySelector("[data-signal-hide]").onclick=()=>{
    const next=prefs();
    next.hidden=true;
    save(next);
    render();
  };
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
  render();
}

export function setSignalVisible(enabled){
  const next=prefs();
  next.enabled=!!enabled;
  next.hidden=false;
  next.paused=false;
  save(next);
  render();
}

export function restoreSignal(){setSignalVisible(true)}

init();