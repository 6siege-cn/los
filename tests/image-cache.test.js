import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import manifest from '../operator-selection/src/asset-manifest.js';
import operators from '../operator-selection/data/operators.js';

const worker=readFileSync(new URL('../operator-selection/sw.js',import.meta.url),'utf8');
const scope='https://example.test/los/operator-selection/';
function harness({core=['assets/optimized/dice-v1.webp'],panels=[],storage=new Map(),failCache=false,fetcher}={}){
  const handlers={},requests=[];
  const caches={async open(name){
    if(failCache)throw Error('Storage denied');
    if(!storage.has(name))storage.set(name,new Map());
    const entries=storage.get(name);
    const key=value=>typeof value==='string'?value:value.url;
    return {async match(url){return entries.get(key(url))?.clone();},async put(url,response){entries.set(key(url),response.clone());},
      async keys(){return [...entries.keys()].map(url=>({url}));},async delete(url){return entries.delete(key(url));}};
  }};
  const self={registration:{scope},IMAGE_MANIFEST:{core,panels},skipWaiting:async()=>{},clients:{claim:async()=>{}},addEventListener:(name,handler)=>{handlers[name]=handler;}};
  vm.runInNewContext(worker,{self,caches,URL,Map,Set,Promise,importScripts:()=>{},fetch:async url=>{
    requests.push(url);return fetcher?fetcher(url):new Response('image bytes',{headers:{'Content-Type':'image/webp'}});
  }});
  return {storage,requests,async fetch(path,method='GET'){
    let response;const work=[];
    handlers.fetch({request:{url:new URL(path,scope).href,method},respondWith:p=>{response=p;},waitUntil:p=>work.push(p)});
    const result=await response;await Promise.all(work);return result;
  },async event(type,data){let work;handlers[type]({data,waitUntil:p=>{work=p;}});await work;}};
}
test('repeat and offline image access uses persistent cache across worker restarts',async()=>{
  const first=harness();assert.equal(await (await first.fetch('assets/optimized/dice-v1.webp')).text(),'image bytes');
  const next=harness({storage:first.storage,fetcher:()=>{throw Error('offline');}});
  assert.equal(await (await next.fetch('assets/optimized/dice-v1.webp')).text(),'image bytes');
  assert.equal(next.requests.length,0);
});
test('new image versions load fresh while unchanged images remain cached; other pages are ignored',async()=>{
  const old=harness({core:['assets/optimized/dice-v1.webp','assets/optimized/avatar.svg']});
  await old.event('message',{type:'WARM_IMAGES'});
  const next=harness({storage:old.storage,core:['assets/optimized/dice-v2.webp','assets/optimized/avatar.svg']});
  await next.event('activate');await next.event('message',{type:'WARM_IMAGES'});
  assert.deepEqual(next.requests,[scope+'assets/optimized/dice-v2.webp']);
  assert.equal(await next.fetch('index.html'),undefined);
  assert.equal(await next.fetch('src/app.js'),undefined);
  assert.equal(await next.fetch('data/operators.js'),undefined);
  assert.equal(await next.fetch('../chess-clock/index.html'),undefined);
  assert.equal(await next.fetch('assets/optimized/dice-v2.webp','POST'),undefined);
});
test('panels load on demand and stay bounded under concurrent requests',async()=>{
  const panels=Array.from({length:30},(_,i)=>`assets/optimized/panel-${i}.webp`);
  const h=harness({panels});await h.event('message',{type:'WARM_IMAGES'});
  assert.equal(h.requests.length,1);
  await Promise.all(panels.map(path=>h.fetch(path)));
  const cache=[...h.storage.entries()].find(([name])=>name.endsWith(':panels-v1'))[1];
  assert.equal(cache.size,24);
});
test('cache failures fall back to network and error/HTML responses are never cached',async()=>{
  const h=harness({failCache:true});assert.equal((await h.fetch('assets/optimized/dice-v1.webp')).status,200);
  for(const response of [new Response('missing',{status:404}),new Response('fallback HTML',{headers:{'Content-Type':'text/html'}})]){
    const invalid=harness({fetcher:()=>response.clone()});
    await invalid.fetch('assets/optimized/dice-v1.webp');await invalid.fetch('assets/optimized/dice-v1.webp');
    assert.equal(invalid.requests.length,2);
  }
});
test('all optimized assets match their sources and every operator reference is covered',()=>{
  const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
  const base=new URL('../operator-selection/',import.meta.url);
  for(const item of manifest.sources){
    assert.equal(digest(readFileSync(new URL(item.source,base))),item.sourceHash,'Rebuild optimized asset: '+item.source);
    assert.equal(digest(readFileSync(new URL(item.path,base))),item.outputHash,item.path);
  }
  for(const op of operators){
    assert.ok(manifest.avatars[op.avatar]);assert.ok(manifest.panels[op.panel]);
    for(const key of [op.hp,op.destruction,...op.close,...op.medium,...op.long])assert.ok(manifest.tokens[key],key);
  }
});
