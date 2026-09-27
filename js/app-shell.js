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
  terms: "view-terms",
  how: "view-how"
});

const PRIMARY = ["home","checkin","patterns","regulate","more"];

const INFO_COPY = Object.freeze({
  about: {
    kicker:"About Sensory Log",
    title:"A calmer way to notice what matters.",
    intro:"Sensory Log is a private, local-first space for noticing energy, sensory load, recovery and the patterns that emerge over time.",
    sections:[
      ["Notice","Log what is happening without turning your experience into a score, streak or diagnosis."],
      ["Understand","Use your own history to see repeated patterns and context over time."],
      ["Regulate","Choose small, practical actions that fit how you feel right now."]
    ]
  },
  contact: {
    kicker:"Contact us",
    title:"Talk to a real person.",
    intro:"Found a bug, have feedback, need help with your purchase, or want to ask a product question? Start here.",
    sections:[
      ["Purchase & account","For purchase or access questions, open your Sensory Log purchase page on Gumroad and use the seller contact/support option there."],
      ["Product feedback","Tell us what feels unclear, what broke, or what would make Sensory Log more useful. Include your device/browser and what you expected to happen if you are reporting a bug."],
      ["Before you send","Please do not include passwords, payment details, license keys, or private journal entries unless they are genuinely necessary for support."]
    ],
    actions:[{label:"Open Sensory Log on Gumroad",href:"https://jbstoresfind.gumroad.com/l/sensory-log"}]
  },
  how: {
    kicker:"How Sensory Log works",
    title:"A simple loop: notice, understand, regulate.",
    intro:"Sensory Log is built around one practical cycle. You check in with what is happening, look back when you need context, and choose a response that fits the moment.",
    sections:[
      ["1. Start with a check-in","When you have something to notice, open Check in. Record what you are experiencing using the controls available there. You do not need to make the entry perfect; the value comes from building an honest record over time."],
      ["2. Let Home orient you","Home is the starting point for the day. It brings your current state, signals and useful next actions together without asking you to manage a long list of features."],
      ["3. Look for patterns later","Patterns is for reflection, not judgement. Use your history to compare days and notice repeated relationships in your own experience. A pattern in your log is a clue to explore, not a diagnosis or a rule."],
      ["4. Regulate when you need to","Regulate is for the present moment. Choose an available regulation mode and follow the session at your own pace. The goal is to give you a practical next step, not to force a particular outcome."],
      ["5. Keep context in Signal","Signal surfaces useful context separately from your personal log. It is there to help you explore information without making the feed the centre of the product."],
      ["6. Use More for your deeper tools","More contains History, My Manual, Reports, Signal, Your Data and Privacy Center, plus product information and support. These are deeper tools; you do not need to visit them every day."],
      ["Your data is yours to manage","Your Data provides export/import tools, while Privacy Center gives you controls around stored information. Keep an export of anything you want to preserve independently of the browser or account."],
      ["What Sensory Log is not","Sensory Log is a personal reflection and wellness tool. It does not diagnose conditions, provide medical treatment, or replace professional care. Do not use an app recommendation as a substitute for urgent or professional help."]
    ]
  },
  terms: {
    kicker:"Terms of Service",
    title:"Simple terms for using Sensory Log.",
    intro:"These terms describe the intended use of the product. They are written to be readable rather than hidden behind legal language.",
    sections:[
      ["1. What Sensory Log is","Sensory Log is a personal reflection and journaling tool. It is not medical care, diagnosis, treatment, or a substitute for professional advice."],
      ["2. Your information","You are responsible for the information you choose to enter and for keeping backups of anything you want to preserve. The app provides export tools for this purpose."],
      ["3. Local-first design","Core journal information is designed to remain on your device. Optional features can involve external services when you explicitly use them; those services have their own terms and privacy practices."],
      ["4. Account and access","A Firebase account and valid product entitlement are used to unlock the purchased product. You must keep your account secure and must not bypass access controls."],
      ["5. Acceptable use","Use Sensory Log lawfully and do not interfere with, disrupt, or attempt unauthorized access to the app or its supporting infrastructure."],
      ["6. Changes","Features, content and supporting services may change as the product evolves."],
      ["7. Service availability","Online account, licensing and optional external features depend on third-party infrastructure and may occasionally be unavailable. Your local core log is designed to remain usable independently where the browser permits."],
      ["8. Your rights","These terms do not remove consumer, privacy, or other rights that cannot lawfully be excluded in your jurisdiction."]
    ]
  }
});

function renderInfoView(route){
  const copy=INFO_COPY[route];
  if(!copy) return;
  const root=document.getElementById(ROUTES[route]);
  if(!root || root.dataset.infoRendered==="true") return;
  root.dataset.infoRendered="true";
  const sections=copy.sections.map(([heading,body])=>`<section class="app-info-section"><h3>${heading}</h3><p>${body}</p></section>`).join("");
  const actions=(copy.actions||[]).map(action=>`<a class="app-info-action" href="${action.href}" target="_blank" rel="noopener noreferrer">${action.label}<span aria-hidden="true">↗</span></a>`).join("");
  root.innerHTML=`<article class="app-info-page">
    <div class="app-info-topbar">
      <button type="button" class="app-info-back" data-route="more" aria-label="Back to More"><span aria-hidden="true">←</span><span>More</span></button>
      <span class="app-info-page-label">Sensory Log</span>
    </div>
    <div class="app-kicker">${copy.kicker}</div>
    <h2>${copy.title}</h2>
    <p class="app-info-intro">${copy.intro}</p>
    <div class="app-info-sections">${sections}</div>
    ${actions ? `<div class="app-info-actions">${actions}</div>` : ""}
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
  document.body.classList.toggle("is-info-route",["about","contact","terms","how"].includes(target));
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
  document.title = target==="home" ? "Sensory Log" : target==="how" ? "How Sensory Log Works · Sensory Log" : target[0].toUpperCase()+target.slice(1)+" · Sensory Log";
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
