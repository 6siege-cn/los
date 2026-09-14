/* Cache only content-addressed images. HTML, scripts and game data stay network-backed. */
importScripts('./cache-manifest.js?v=d035f7e5720d0198');
const scope=self.registration.scope;
const coreURLs=new Set(self.IMAGE_MANIFEST.core.map(path=>new URL(path,scope).href));
const panelURLs=new Set(self.IMAGE_MANIFEST.panels.map(path=>new URL(path,scope).href));
const prefix='operator-images:'+new URL(scope).pathname;
const coreCache=prefix+':core-v1',panelCache=prefix+':panels-v1';
const PANEL_LIMIT=24;
const pending=new Map();
let writes=Promise.resolve();

async function save(url,response,name){
  // Serialize writes so concurrent panel downloads cannot exceed the limit.
  writes=writes.catch(()=>{}).then(async()=>{
    const cache=await caches.open(name);
    if(name===panelCache){
      const keys=await cache.keys();
      if(!await cache.match(url))for(const key of keys.slice(0,Math.max(0,keys.length-PANEL_LIMIT+1)))await cache.delete(key);
    }
    await cache.put(url,response);
  }).catch(()=>{}); // A quota/private-mode failure must never break image loading.
  await writes;
}
async function imageResponse(url){
  const name=coreURLs.has(url)?coreCache:panelCache;
  try{const cached=await (await caches.open(name)).match(url);if(cached)return cached;}catch{}
  if(!pending.has(url)){
    pending.set(url,(async()=>{
      const response=await fetch(url);
      if(response.ok&&response.headers.get('Content-Type')?.startsWith('image/'))await save(url,response.clone(),name);
      return response;
    })());
  }
  try{return (await pending.get(url)).clone();}finally{pending.delete(url);}
}
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  try{
    for(const [name,allowed] of [[coreCache,coreURLs],[panelCache,panelURLs]]){
      const cache=await caches.open(name);
      for(const key of await cache.keys())if(!allowed.has(key.url))await cache.delete(key);
    }
  }catch{}
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=event.request.url;
  if(!coreURLs.has(url)&&!panelURLs.has(url))return;
  const result=imageResponse(url);
  event.respondWith(result);
  event.waitUntil(result.then(()=>{},()=>{}));
});
let warming;
self.addEventListener('message',event=>{
  if(event.data?.type!=='WARM_IMAGES')return;
  if(!warming)warming=(async()=>{
    const queue=[...coreURLs];
    await Promise.all(Array.from({length:3},async()=>{
      while(queue.length){const url=queue.shift();try{await imageResponse(url);}catch{}}
    }));
  })().finally(()=>{warming=null;});
  event.waitUntil(warming);
});
