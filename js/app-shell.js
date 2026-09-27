import "./core/foundation.js";

const ROUTES = Object.freeze({
  home: "view-home",
  checkin: "view-checkin",
  patterns: "view-patterns",
  regulate: "view-regulation",
  more: "view-more",
  history: "view-history",
  manual: "view-manual",
  reports: "view-reports",
  signal: "view-signal"
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
  document.querySelectorAll("[data-route]").forEach(btn=>{
    btn.classList.toggle("active", btn.dataset.route===target || (target==="more" && ["history","manual","reports","signal"].includes(target) && btn.dataset.route==="more"));
    btn.setAttribute("aria-current",btn.classList.contains("active")?"page":"false");
  });
  document.title = target==="home" ? "Sensory Log" : target[0].toUpperCase()+target.slice(1)+" · Sensory Log";
  if(pushHash && location.hash!==("#"+target)) history.replaceState(null,"","#"+target);
  window.scrollTo({top:0,behavior:document.documentElement.dataset.motion==="reduced"?"auto":"smooth"});
}

initializeFoundation().catch(error => console.error("[Sensory Log] Foundation", error));

function wire(){
  document.querySelectorAll("[data-route]").forEach(btn=>{
    btn.addEventListener("click",()=>setActive(btn.dataset.route));
  });
  window.addEventListener("hashchange",()=>setActive(routeFromHash(),false));
  setActive(routeFromHash(),false);
}

if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",wire,{once:true});
else wire();
