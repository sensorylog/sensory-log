import { initializeFoundation } from "./core/foundation.js";
import { restoreSignal } from "./signal.js";
import { apply as applyPreferences } from "./preferences.js";
import { registerServiceWorker } from "./core/pwa.js";
import { waitForLicense } from "./license.js";

const ROUTES = Object.freeze({
  home: "view-home",
  checkin: "view-checkin",
  patterns: "view-patterns",
  regulate: "view-regulation",
  more: "view-more",
  history: "view-history",
  manual: "view-manual",
  reports: "view-reports",
  signal: "view-signal",
  backup: "view-backup",
  privacy: "view-privacy",
  about: "view-about",
  contact: "view-contact",
  terms: "view-terms"
});

const PRIMARY = ["home","checkin","patterns","regulate","more"];

const INFO_COPY = Object.freeze({
  about: {
    kicker:"About Sensory Log",
    title:"A calmer way to notice your patterns.",
    body:[
      "Sensory Log is a private, local-first tool for noticing energy, sensory load, recovery and the patterns that emerge over time.",
      "It is designed to help you understand your own experience without turning it into a diagnosis, a score, or a streak."
    ]
  },
  contact: {
    kicker:"Contact us",
    title:"Questions, feedback or support?",
    body:[
      "We want to hear when something is unclear, broken, or could be more useful.",
      "For support, product feedback, privacy questions, or other messages, use the contact method provided with your Sensory Log purchase or product receipt."
    ]
  },
  terms: {
    kicker:"Terms of Service",
    title:"Using Sensory Log",
    body:[
      "Sensory Log is provided as a personal reflection and journaling tool. It is not medical care, diagnosis, treatment, or a substitute for professional advice.",
      "You are responsible for the information you choose to enter and for deciding how you use observations from the app. Features may change as the product evolves.",
      "By using Sensory Log, you agree to use the app lawfully and not to misuse, disrupt, reverse-engineer, or attempt to gain unauthorized access to the service or its infrastructure.",
      "Because Sensory Log is local-first, you should keep your own backups of information you want to preserve. The app provides export tools for this purpose.",
      "These terms are intended as a clear product-use summary and do not replace any legally required rights or notices that apply in your jurisdiction."
    ]
  }
});

function renderInfoView(route){
  const copy=INFO_COPY[route];
  if(!copy) return;
  const root=document.getElementById(ROUTES[route]);
  if(!root || root.dataset.infoRendered==="true") return;
  root.dataset.infoRendered="true";
  root.innerHTML=`<article class="app-info-page">
    <button type="button" class="app-info-back" data-route="more" aria-label="Back to More">← More</button>
    <div class="app-kicker">${copy.kicker}</div>
    <h2>${copy.title}</h2>
    ${copy.body.map(p=>`<p>${p}</p>`).join("")}
  </article>`;
  root.querySelector("[data-route]").addEventListener("click",()=>setActive("more"));
}
let aiUiPromise = null;

async function loadOptionalReportsTools(){
  if(aiUiPromise) return aiUiPromise;
  aiUiPromise = import("./ai-ui.js").catch(error => {
    aiUiPromise = null;
    console.warn("[Sensory Log] Optional AI tools unavailable", error);
  });
  return aiUiPromise;
}

function routeFromHash(){
  const raw=(location.hash||"#home").slice(1).trim().toLowerCase();
  return ROUTES[raw] ? raw : "home";
}

function setActive(route, pushHash=true){
  const target=ROUTES[route] ? route : "home";
  Object.entries(ROUTES).forEach(([name,id])=>{
    const view=document.getElementById(id);
    if(view) view.classList.toggle("is-active", name===target);
  });
  wireTheme();
  document.querySelectorAll("[data-route]").forEach(btn=>{
    const isPrimary = btn.dataset.route === target;
    const isMoreChild = ["history","manual","reports","signal","backup","privacy"].includes(target) && btn.dataset.route === "more";
    btn.classList.toggle("active", isPrimary || isMoreChild);
    btn.setAttribute("aria-current",btn.classList.contains("active")?"page":"false");
  });
  document.title = target==="home" ? "Sensory Log" : target[0].toUpperCase()+target.slice(1)+" · Sensory Log";
  if(pushHash && location.hash!==("#"+target)) history.pushState(null,"","#"+target);
  // Route changes should reposition decisively, not animate the entire document.\n  // This avoids scroll drift and motion that can be disorienting on mobile.\n  window.scrollTo({top:0,behavior:"auto"});
  renderInfoView(target);
  const activeView=document.getElementById(ROUTES[target]);
  if(activeView){
    activeView.setAttribute("tabindex","-1");
    activeView.focus({preventScroll:true});
  }
  window.dispatchEvent(new CustomEvent("sensory-log:route-changed",{detail:{route:target}}));
  if(target==="reports") loadOptionalReportsTools();
}

waitForLicense()
  .then(() => initializeFoundation())
  .catch(error => console.error("[Sensory Log] License/Foundation", error));
applyPreferences();
registerServiceWorker();

function wireTheme(){
  const button=document.getElementById("themeBtn");
  if(!button) return;
  const apply=theme=>{
    const value=theme==="dark"?"dark":"light";
    document.documentElement.setAttribute("data-theme",value);
    try{localStorage.setItem("sensoryTheme",value)}catch{}
    button.textContent=value==="dark"?"◑":"◐";
  };
  // Dark is the intentional first-run appearance. Once the user chooses a theme,
  // remember that choice locally and never override it.
  let saved="dark";
  try{
    const stored=localStorage.getItem("sensoryTheme");
    if(stored==="dark" || stored==="light") saved=stored;
  }catch{}
  apply(saved);
  if(button.dataset.themeWired==="true") return;
  button.dataset.themeWired="true";
  button.addEventListener("click",()=>{
    apply(document.documentElement.getAttribute("data-theme")==="dark"?"light":"dark");
  });
}

function wire(){
  if(document.documentElement.dataset.shellWired==="true") return;
  document.documentElement.dataset.shellWired="true";
  document.querySelectorAll("[data-route]").forEach(btn=>{
    btn.addEventListener("click",()=>setActive(btn.dataset.route));
  });
  window.addEventListener("hashchange",()=>setActive(routeFromHash(),false));
  window.addEventListener("popstate",()=>setActive(routeFromHash(),false));
  document.querySelectorAll("[data-signal-restore]").forEach(btn=>btn.addEventListener("click",()=>restoreSignal()));
  setActive(routeFromHash(),false);
}

if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",wire,{once:true});
else wire();
