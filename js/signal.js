import { getEntries } from "./core/storage.js";

const DEFAULT_ITEMS=[
 {title:"Your data, your pace",text:"Signal is designed to surface useful context without turning your day into a feed.",type:"Product"},
 {title:"Pause is always allowed",text:"If a moving signal feels like too much, stop, hide, or revisit it later.",type:"Accessibility"},
 {title:"Patterns need repetition",text:"Sensory Log deliberately waits for repeated observations instead of inventing certainty from one day.",type:"Insight"}
];
const SIGNAL_KEY="sensoryLogSignalPrefs_v1";
const FEED_URL="";

function prefs(){try{return JSON.parse(localStorage.getItem(SIGNAL_KEY))||{enabled:true,paused:false,hidden:false}}catch{return {enabled:true,paused:false,hidden:false}}}
function save(p){try{localStorage.setItem(SIGNAL_KEY,JSON.stringify(p))}catch{}}

async function remoteSignals(){
  if(!FEED_URL) return [];
  try{
    const r=await fetch(FEED_URL,{headers:{Accept:"application/json"},cache:"no-store"});
    if(!r.ok) throw new Error("Signal feed unavailable");
    const data=await r.json();
    return Array.isArray(data?.items)?data.items.slice(0,8):[];
  }catch{return []}
}

function render(items){
  const root=document.getElementById("slSignal");
  if(!root)return;
  const p=prefs();
  if(!p.enabled||p.hidden){root.hidden=true;return}
  root.hidden=false;
  const current=items[0]||DEFAULT_ITEMS[0];
  root.innerHTML=`<div class="sl-signal-inner" role="region" aria-label="Signal">
    <span class="sl-signal-label">SIGNAL</span>
    <div class="sl-signal-text"><strong>${escapeHtml(current.title)}</strong><span> — ${escapeHtml(current.text)}</span></div>
    <div class="sl-signal-actions">
      <button type="button" data-signal-pause>${p.paused?"Resume":"Pause"}</button>
      <button type="button" data-signal-hide>Hide</button>
    </div>
  </div>`;
  root.querySelector("[data-signal-pause]").onclick=()=>{const x=prefs();x.paused=!x.paused;save(x);if(x.paused)render([current]);else init();};
  root.querySelector("[data-signal-hide]").onclick=()=>{const x=prefs();x.hidden=true;save(x);render(items)};
}
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
export async function init(){
  let root=document.getElementById("slSignal");
  if(!root){ root=document.createElement("aside"); root.id="slSignal"; root.className="sl-signal"; const anchor=document.getElementById("view-signal"); if(anchor) anchor.appendChild(root); }
  const p=prefs();
  if(p.paused){render(DEFAULT_ITEMS);return}
  const remote=await remoteSignals();
  render(remote.length?remote:DEFAULT_ITEMS);
}
export function setSignalVisible(enabled){const p=prefs();p.enabled=!!enabled;p.hidden=false;save(p);init()}
init();