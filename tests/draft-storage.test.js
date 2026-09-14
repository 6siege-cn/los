import test from 'node:test';
import assert from 'node:assert/strict';
import {captureDraft,restoreDraft,createDraftStorage,storageKey} from '../operator-selection/src/draft-storage.js';
import {createDraft} from '../operator-selection/src/engine.js';
import {rules} from '../operator-selection/src/rules.js';
import {orderModes} from '../operator-selection/src/operator-order.js';
import operators from '../operator-selection/data/operators.js';
const context={rules,orderModes,operators};
function capture(draft,ruleId='standard'){return captureDraft({draft,ruleId,rule:rules[ruleId],scope:{alt:true,diy:false},orderMode:'time',activeSide:'defense',operators});}
test('restore replays ban-first and preserves full undo history and settings',()=>{
  const draft=createDraft(rules.standard,operators);draft.choose('smoke');draft.choose('sledge');
  const restored=restoreDraft(capture(draft),context);
  assert.deepEqual(restored.draft.snapshot(),draft.snapshot());assert.equal(restored.orderMode,'time');assert.equal(restored.activeSide,'defense');
  assert.equal(restored.scope.diy,false);
  assert.ok(restored.draft.undo());assert.ok(restored.draft.undo());assert.equal(restored.draft.snapshot().history.length,0);
});
test('both completed rules restore and can undo all the way to the beginning',()=>{
  for(const ruleId of ['standard','fiveBan']){
    const draft=createDraft(rules[ruleId],operators);
    while(!draft.snapshot().complete)draft.choose(operators.find(op=>draft.canChoose(op.id)).id);
    const restored=restoreDraft(capture(draft,ruleId),context).draft;
    assert.deepEqual(restored.snapshot(),draft.snapshot());
    for(let i=draft.snapshot().history.length;i>0;i--)assert.ok(restored.undo());
    assert.equal(restored.snapshot().history.length,0);
  }
});
test('invalid schema, rules, data and impossible histories are rejected in full',()=>{
  const draft=createDraft(rules.standard,operators);draft.choose('sledge');const record=capture(draft);
  for(const mutate of [r=>r.version=99,r=>r.ruleId='missing',r=>r.ruleSignature='changed',r=>r.scope.alt=null,r=>r.orderMode='missing',r=>r.activeSide='missing',r=>r.history[0].type='ban',r=>r.history[0].operatorId='missing',r=>r.operatorSignatures[0]='changed']){
    const copy=structuredClone(record);mutate(copy);assert.throws(()=>restoreDraft(copy,context));
  }
});
test('storage serializes saves, detects conflicting pages and does not overwrite',async()=>{
  const values=new Map();const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  let conflicts=0;const a=createDraftStorage({storage}),b=createDraftStorage({storage,onConflict:()=>conflicts++});
  assert.equal(a.read(),null);b.read();await a.save({history:[1]});
  assert.equal(await b.save({history:[2]}),false);assert.equal(conflicts,1);assert.equal(JSON.parse(values.get(storageKey)).history[0],1);
  await Promise.all([a.save({history:[1,2]}),a.save(null)]);assert.equal(values.has(storageKey),false);
});
test('storage failures report instead of crashing or claiming a save',async()=>{
  let errors=0;const storage={getItem:()=>null,setItem:()=>{throw Error('QuotaExceeded');}};
  const store=createDraftStorage({storage,onError:()=>errors++});store.read();
  assert.equal(await store.save({}),false);assert.equal(errors,1);
});
