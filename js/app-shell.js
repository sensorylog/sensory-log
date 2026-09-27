import { initializeFoundation } from "./core/foundation.js";
import { restoreSignal } from "./signal.js";

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
  backup: "view-backup"
});

const PRIMARY = ["home","checkin","patterns","regulate","more"];

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
    const isMoreChild = ["history","manual","reports","signal","backup"].includes(target) && btn.dataset.route === "more";
    btn.classList.toggle("active", isPrimary || isMoreChild);
    btn.setAttribute("aria-current",btn.classList.contains("active")?"page":"false");
  });
  document.title = target==="home" ? "Sensory Log" : target[0].toUpperCase()+target.slice(1)+" · Sensory Log";
  if(pushHash && location.hash!==("#"+target)) history.replaceState(null,"","#"+target);
  window.scrollTo({top:0,behavior:document.documentElement.dataset.motion==="reduced"?"auto":"smooth"});
}

initializeFoundation().catch(error => console.error("[Sensory Log] Foundation", error));

function wireTheme(){
  const button=document.getElementById("themeBtn");
  if(!button) return;
  const apply=theme=>{
    const value=theme==="dark"?"dark":"light";
    document.documentElement.setAttribute("data-theme",value);
    try{localStorage.setItem("sensoryTheme",value)}catch{}
    button.textContent=value==="dark"?"◑":"◐";
  };
  let saved="light";
  try{saved=localStorage.getItem("sensoryTheme")||"light"}catch{}
  apply(saved);
  if(button.dataset.themeWired==="true") return;
  button.dataset.themeWired="true";
  button.addEventListener("click",()=>{
    apply(document.documentElement.getAttribute("data-theme")==="dark"?"light":"dark");
  });
}

function wire(){
  document.querySelectorAll("[data-route]").forEach(btn=>{
    btn.addEventListener("click",()=>setActive(btn.dataset.route));
  });
  window.addEventListener("hashchange",()=>setActive(routeFromHash(),false));
  document.querySelectorAll("[data-signal-restore]").forEach(btn=>btn.addEventListener("click",()=>restoreSignal()));
  setActive(routeFromHash(),false);
}

if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",wire,{once:true});
else wire();
