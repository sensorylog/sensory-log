import {AI_SHARE_OPTIONS,getAiSettings,setAiConsent,setAiProvider,askAi,getAiStatus} from "./ai.js";

function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
async function mount(){
 const anchor=document.getElementById("slReports")||document.querySelector(".backup-card");
 if(!anchor)return;
 const root=document.createElement("section");root.className="sl-ai";root.id="slAi";
 root.innerHTML=`<h2>Private AI reflection</h2>
 <p>AI is optional. Sensory Log stays usable without it. Choose exactly how much data an AI request may use.</p>
 <div class="sl-ai-controls">
 <select id="slAiShare" aria-label="AI data sharing level">${AI_SHARE_OPTIONS.map(x=>`<option value="${x.id}">${esc(x.label)} — ${esc(x.description)}</option>`).join("")}</select>
 <select id="slAiProvider" aria-label="AI provider"><option value="gemini">Gemini via Firebase AI Logic</option><option value="puter">Puter (optional)</option><option value="local">Local reflection only</option></select>
 <div class="sl-ai-row"><input id="slAiQuestion" placeholder="Ask about your patterns…" aria-label="Ask AI about your patterns"/><button class="sl-ai-primary" id="slAiAsk">Reflect</button></div>
 </div><div class="sl-ai-status" id="slAiStatus"></div><div class="sl-ai-response" id="slAiResponse" hidden></div>`;
 anchor.insertAdjacentElement("afterend",root);
 const settings=getAiSettings();
 root.querySelector("#slAiShare").value=settings.consent;
 root.querySelector("#slAiProvider").value=settings.provider;
 async function refresh(){const s=await getAiStatus();root.querySelector("#slAiStatus").textContent=s.consent==="none"?"AI off — your data stays local.":`Sharing: ${s.consent}. Provider: ${s.provider}.${s.available?"":" Provider is not configured, so local fallback will be used."}`}
 root.querySelector("#slAiShare").onchange=e=>{setAiConsent(e.target.value);refresh()};
 root.querySelector("#slAiProvider").onchange=e=>{setAiProvider(e.target.value);refresh()};
 root.querySelector("#slAiAsk").onclick=async()=>{
   const b=root.querySelector("#slAiAsk"),out=root.querySelector("#slAiResponse");
   b.disabled=true;b.textContent="Reflecting…";out.hidden=false;out.textContent="Working locally or through your selected provider…";
   const text=await askAi({question:root.querySelector("#slAiQuestion").value});
   out.textContent=text;b.disabled=false;b.textContent="Reflect";
 };
 refresh();
}
mount();