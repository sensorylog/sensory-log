const CACHE="sensory-log-shell-v2";
const SHELL=["./","./index.html","./manifest.webmanifest"];

async function put(request,response){
  if(!response || !response.ok) return response;
  const cache=await caches.open(CACHE);
  await cache.put(request,response.clone());
  return response;
}

self.addEventListener("install",event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(SHELL))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET" || new URL(request.url).origin!==self.location.origin) return;

  event.respondWith((async()=>{
    const cached=await caches.match(request);
    const destination=request.destination;

    // HTML, JavaScript and CSS must be network-first so a new GitHub/Firebase
    // deployment is not trapped behind an old service-worker cache.
    const networkFirst=["document","script","style","manifest"].includes(destination);
    if(networkFirst){
      try{
        const response=await fetch(request,{cache:"no-store"});
        await put(request,response);
        return response;
      }catch{
        return cached || caches.match("./index.html");
      }
    }

    if(cached) return cached;

    try{
      const response=await fetch(request);
      return await put(request,response);
    }catch{
      return caches.match("./index.html");
    }
  })());
});

self.addEventListener("message",event=>{
  if(event.data?.type==="SKIP_WAITING") self.skipWaiting();
});
