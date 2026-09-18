import test from 'node:test';
import assert from 'node:assert/strict';
import {createSnapshotClient,CACHE_KEY,FRESH_MS,COOLDOWN_MS} from '../statistics/cache.js';
import {aggregateSnapshot,chartSummary} from '../statistics/model.js';
const catalog=[{id:'a',name:'A',side:'attack',version:'off',avatar:'a.png'},{id:'alt-a',name:'A',side:'attack',version:'alt',avatar:'aa.png'},{id:'b',name:'B',side:'defense',version:'off',avatar:'b.png'}];
const data={schemaVersion:1,revision:1,generatedAt:'2026-09-18T10:00:00Z',checkedAt:'2026-09-18T10:00:00Z',catalog,buckets:[{key:['bank','standard','炸弹模式','normal',false,false],total:9,attackWins:3,operators:{a:[9,3,0],b:[3,2,2]}},{key:['bank','standard','炸弹模式','normal',true,false],total:1,attackWins:1,operators:{'alt-a':[1,1,0]}}]};
function harness(){let time=0,calls=0,fail=false;const values=new Map(),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};const options={storage,locks:null,now:()=>time,fetcher:async()=>{calls++;if(fail)throw Error('offline');return {ok:true,json:async()=>structuredClone(data)};}};return {options,storage,client:createSnapshotClient(options),advance:ms=>time+=ms,fail:()=>fail=true,calls:()=>calls};}
test('snapshot cache coalesces requests, survives reload and enforces refresh cooldown',async()=>{
  const h=harness();const [a,b]=await Promise.all([h.client.load(),h.client.load({force:true})]);assert.deepEqual(a,b);assert.equal(h.calls(),1);
  await h.client.load({force:true});assert.equal(h.calls(),1);
  h.advance(COOLDOWN_MS);await createSnapshotClient(h.options).load();assert.equal(h.calls(),1);
  await h.client.load({force:true});assert.equal(h.calls(),2);
  h.advance(FRESH_MS);await h.client.load();assert.equal(h.calls(),3);
});
test('failed fetch keeps old snapshot, throttles retries, and rejects malformed cached data',async()=>{
  const h=harness();await h.client.load();h.advance(FRESH_MS);h.fail();const result=await h.client.load();assert.deepEqual(result.data,data);assert.ok(result.error);
  await h.client.load({force:true});assert.equal(h.calls(),2);
  h.storage.setItem(CACHE_KEY,JSON.stringify({data:{schemaVersion:1}}));assert.equal(h.client.peek(),null);
});
test('private browsing storage failures still retain in-memory cache',async()=>{
  let calls=0;const client=createSnapshotClient({locks:null,storage:{getItem(){throw Error();},setItem(){throw Error();}},fetcher:async()=>{calls++;return {ok:true,json:async()=>data};}});
  await client.load();await client.load();assert.equal(calls,1);assert.deepEqual(client.peek(),data);
});
test('shared browser lock prevents simultaneous tabs requesting twice',async()=>{
  const h=harness();let queue=Promise.resolve();h.options.locks={request:(_name,fn)=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;}};
  await Promise.all([createSnapshotClient(h.options).load(),createSnapshotClient(h.options).load()]);assert.equal(h.calls(),1);
});
test('family ratios sum counts, optional versions use eligible scope and averages use visible points',()=>{
  const merged=aggregateSnapshot(data,{family:true}).operators.find(r=>r.name==='A');assert.equal(merged.picks,10);assert.equal(merged.eligible,10);assert.equal(merged.winRate,.4);
  const alt=aggregateSnapshot(data,{version:'alt'}).operators;assert.equal(alt.length,1);assert.equal(alt[0].eligible,1);assert.equal(alt[0].pickRate,1);
  assert.equal(aggregateSnapshot(data,{mode:'other'}).total,0);
  const summary=chartSummary([{picks:9,pickRate:.9,winRate:1/3},{picks:1,pickRate:1,winRate:1},{picks:0,pickRate:0,winRate:null}]);assert.equal(summary.rows.length,2);assert.equal(summary.meanWin,2/3);assert.equal(summary.meanPick,.95);
});
