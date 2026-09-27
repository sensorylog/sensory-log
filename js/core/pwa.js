export function registerServiceWorker(){
  if(!("serviceWorker" in navigator)) return Promise.resolve(null);
  return navigator.serviceWorker.register("./sw.js",{scope:"./"}).then(registration=>{
    registration.addEventListener("updatefound",()=>{
      const worker=registration.installing;
      if(!worker)return;
      worker.addEventListener("statechange",()=>{
        if(worker.state==="installed" && navigator.serviceWorker.controller){
          window.dispatchEvent(new CustomEvent("sensory-log:app-update",{detail:{registration}}));
        }
      });
    });
    return registration;
  }).catch(error=>{
    console.warn("[Sensory Log] Offline shell unavailable",error);
    return null;
  });
}
