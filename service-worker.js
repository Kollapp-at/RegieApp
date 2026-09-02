const CACHE="haspl-regieapp-v0.19.0-shell-1";
const RUNTIME="haspl-regieapp-v0.19.0-runtime-1";
const SHELL=["./","./index.html","./styles.css","./manifest.webmanifest","./version.json","./icon.svg","./icon-180.png","./icon-192.png","./icon-512.png","./assets/haspl-logo.png","./assets/jszip.min.js","./assets/pdf.min.mjs","./assets/pdf.worker.min.mjs","./assets/jspdf.umd.min.js","./assets/jspdf.plugin.autotable.min.js","./js/theme.js","./js/auth.js","./js/db.js","./js/api.js","./js/sync.js","./js/drawing.js","./js/lv-import.js","./js/print.js","./js/app.js","./js/weekly.js","./js/v050-search.js"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE&&key!==RUNTIME&&key.startsWith("haspl-regieapp-")).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
  const req=event.request;if(req.method!=="GET")return;const url=new URL(req.url);
  if(url.origin===self.location.origin&&url.pathname.startsWith("/api/")){event.respondWith(fetch(new Request(req,{cache:"no-store"})));return}
  if(req.mode==="navigate"){event.respondWith(fetch(new Request(req,{cache:"no-store"})).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put("./index.html",copy)).catch(()=>{});return res}).catch(()=>caches.match("./index.html")));return}
  if(url.origin===self.location.origin){event.respondWith(fetch(new Request(req,{cache:"no-store"})).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{})}return res}).catch(()=>caches.match(req)));return}
  event.respondWith(caches.match(req).then(hit=>{const network=fetch(req).then(res=>{if(res&&(res.ok||res.type==="opaque")){const copy=res.clone();caches.open(RUNTIME).then(c=>c.put(req,copy)).catch(()=>{})}return res}).catch(()=>hit);return hit||network}));
});
self.addEventListener("message",event=>{if(event.data?.type==="SKIP_WAITING")self.skipWaiting()});
