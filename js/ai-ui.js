import {AI_SHARE_OPTIONS,getAiSettings,setAiConsent,setAiProvider,askAi,getAiStatus} from "./ai.js";
import {getEntries} from "./core/storage.js";

function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

async function mount(){
 const anchor=document.getElementById("slReports")||document.querySelector(".backup-card");
 if(!anchor)return;
 const root=document.createElement("section");root.className="sl-ai";root.id="slAi";
 root.innerHTML=`<h2>Private AI reflection</h2>
 <p>AI is optional. Sensory Log stays usable without it. Choose exactly how much data an AI request may use.</p>
 <div class="sl-ai-controls">
 <select id="slAiShare" aria-label="AI data sharing level">${AI_SHARE_OPTIONS.map(x=>`<option value="${x.id}">${esc(x.label)} — ${esc(x.description)}</option>`).join("")}</select>
 <div id="slAiSelected" hidden></div>
 <select id="slAiProvider" aria-label="AI provider"><option value="gemini">Gemini via Firebase AI Logic</option><option value="puter">Puter (optional)</option><option value="local">Local reflection only</option></select>
 <div class="sl-ai-row"><input id="slAiQuestion" placeholder="Ask about your patterns…" aria-label="Ask AI about your patterns"/><button class="sl-ai-primary" id="slAiAsk">Reflect</button></div>
 </div><div class="sl-ai-status" id="slAiStatus"></div><div class="sl-ai-response" id="slAiResponse" hidden></div>`;
 anchor.insertAdjacentElement("afterend",root);

 const settings=getAiSettings();
 const share=root.querySelector("#slAiShare"),provider=root.querySelector("#slAiProvider"),selectedBox=root.querySelector("#slAiSelected");
 share.value=settings.consent;provider.value=settings.provider;

 async function renderSelected(){
   if(share.value!=="selected"){selectedBox.hidden=true;selectedBox.innerHTML="";return;}
   const entries=(await getEntries()).slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30);
   selectedBox.hidden=false;
   selectedBox.innerHTML='<div class="sl-ai-selection-label">Choose entries to share</div>'+(
     entries.length?entries.map((e,i)=>`<label class="sl-ai-entry"><input type="checkbox" data-ai-entry="${i}"><span>${esc(e.date)} · energy ${esc(e.energy)}/5 · sensory ${esc(e.overwhelm)}/5</span></label>`).join(""):'<div class="sl-ai-empty">No entries are saved yet.</div>'
   );
   selectedBox._entries=entries;
 }
 async function refresh(){
   const s=await getAiStatus();
   root.querySelector("#slAiStatus").textContent=s.consent==="none"?"AI off — your data stays local.":`Sharing: ${s.consent}. Provider: ${s.provider}.${s.available?"":" Provider is not configured, so local fallback will be used."}`;
   await renderSelected();
 }
 share.onchange=e=>{setAiConsent(e.target.value);refresh()};
 provider.onchange=e=>{setAiProvider(e.target.value);refresh()};
 root.querySelector("#slAiAsk").onclick=async()=>{
   const b=root.querySelector("#slAiAsk"),out=root.querySelector("#slAiResponse");
   b.disabled=true;b.textContent="Reflecting…";out.hidden=false;out.textContent="Working locally or through your selected provider…";
   const selected=share.value==="selected"?(selectedBox._entries||[]).filter((_,i)=>selectedBox.querySelector(`[data-ai-entry="${i}"]`)?.checked):[];
   const text=await askAi({question:root.querySelector("#slAiQuestion").value,selected});
   out.textContent=text;b.disabled=false;b.textContent="Reflect";
 };
 refresh();
}
mount();