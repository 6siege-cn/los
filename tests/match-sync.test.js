import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {createMatchStore,snapshotMatch} from '../operator-selection/src/match-records.js';
import {drainOutbox,uploadPayload} from '../operator-selection/src/match-sync.js';
import {createDraft} from '../operator-selection/src/engine.js';
import {rules} from '../operator-selection/src/rules.js';
import operators from '../operator-selection/data/operators.js';
function fixture(){const draft=createDraft(rules.standard,operators);while(!draft.snapshot().complete)draft.choose(operators.find(op=>draft.canChoose(op.id)).id);return {...snapshotMatch({state:draft.snapshot(),ruleId:'standard',rule:rules.standard,scope:{alt:true,diy:false},orderMode:'time',operators},crypto.randomUUID(),new Date().toISOString()),mapId:'bank',mode:'炸弹模式',winner:'attack',ending:'歼灭敌方',endRound:'2',matchType:'normal',players:{attack:' Alice ',defense:'Bob'},notes:'选填'};}
test('legacy database upgrade keeps records and never silently opts old records in',async()=>{
  const indexedDB=new IDBFactory(),record=fixture();
  await new Promise((resolve,reject)=>{const req=indexedDB.open('six-siege-los-match-records',1);req.onupgradeneeded=()=>{req.result.createObjectStore('matches',{keyPath:'id'}).add(record);req.result.createObjectStore('tags',{keyPath:'key'});};req.onsuccess=()=>{req.result.close();resolve();};req.onerror=()=>reject(req.error);});
  const store=createMatchStore(indexedDB);assert.equal((await store.records())[0].id,record.id);assert.deepEqual(await store.pending(),[]);assert.deepEqual(await store.nicknames(),[]);
});
test('record and upload are atomic, opt-out stays local, nickname suggestions persist',async()=>{
  const store=createMatchStore(new IDBFactory()),record=fixture();await store.save(record,{upload:true});assert.equal((await store.pending()).length,1);assert.deepEqual((await store.nicknames()).sort(),['Alice','Bob']);
  const job=(await store.pending())[0];assert.equal(job.token.length,64);assert.equal(uploadPayload(job.record).operators,undefined);
  await assert.rejects(store.save(record,{upload:true}));assert.equal((await store.pending())[0].token,job.token);
  await store.save(fixture());assert.equal((await store.records()).length,2);assert.equal((await store.pending()).length,1);
});
test('network failure retries durably, success and quota stop; failed upload never removes local records',async()=>{
  const store=createMatchStore(new IDBFactory());await store.save(fixture(),{upload:true});
  await drainOutbox(store,{now:()=>100,fetcher:async()=>{throw Error('offline');}});assert.equal((await store.pending())[0].nextAt,15100);assert.equal((await store.records()).length,1);
  let requests=0;await drainOutbox(store,{now:()=>200,fetcher:async()=>{requests++;}});assert.equal(requests,0);
  await drainOutbox(store,{now:()=>16000,fetcher:async()=>Response.json({status:'uploaded'})});assert.deepEqual(await store.pending(),[]);assert.equal((await store.records())[0].cloud.status,'uploaded');
  await store.save(fixture(),{upload:true});await drainOutbox(store,{fetcher:async()=>Response.json({status:'quota'})});assert.deepEqual(await store.pending(),[]);assert.ok((await store.records()).some(r=>r.cloud.status==='quota'));
});
test('deletion during in-flight upload cannot be overwritten by its completion',async()=>{
  const store=createMatchStore(new IDBFactory()),record=fixture();await store.save(record,{upload:true});const job=(await store.pending())[0];
  await store.remove(record.id,{cloud:true});await store.settle(job,{status:'uploaded'});
  assert.deepEqual(await store.records(),[]);assert.equal((await store.pending())[0].action,'delete');
  await drainOutbox(store,{fetcher:async(url,init)=>{assert.equal(init.method,'DELETE');return Response.json({status:'deleted'});}});assert.deepEqual(await store.pending(),[]);
});
test('offline deletion persists; delete-only-local cancels pending work and keeps cloud untouched',async()=>{
  const store=createMatchStore(new IDBFactory()),a=fixture(),b=fixture();await store.save(a,{upload:true});await store.save(b,{upload:true});await store.remove(a.id,{cloud:true});await store.remove(b.id,{cloud:false});
  await drainOutbox(store,{fetcher:async()=>{throw Error('offline');}});assert.equal((await store.pending()).length,1);assert.equal((await store.pending())[0].action,'delete');assert.deepEqual(await store.records(),[]);
});
