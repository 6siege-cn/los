import test from 'node:test';
import assert from 'node:assert/strict';
import {rules,compileRule} from '../operator-selection/src/rules.js';
import {createDraft} from '../operator-selection/src/engine.js';
import operators from '../operator-selection/data/operators.js';

test('5ban follows all twelve ordered phases and can undo all twenty actions',()=>{
  const expected=[['defense','ban',1],['attack','pick',1],['attack','ban',1],['defense','pick',1],['defense','ban',2],['attack','pick',2],['attack','ban',2],['defense','pick',2],['defense','ban',2],['attack','pick',2],['attack','ban',2],['defense','pick',2]];
  const steps=compileRule(rules.fiveBan);
  assert.equal(steps.length,20);
  assert.deepEqual(rules.fiveBan.rounds.map(r=>[r.side,...r.actions[0]]),expected);
  const draft=createDraft(rules.fiveBan,operators),snapshots=[draft.snapshot()];
  for(const [index,[side,type,count]] of expected.entries()){
    for(let i=0;i<count;i++){
      const state=draft.snapshot();
      assert.equal(state.step.round,index+1);
      assert.ok(state.available.every(s=>s.side===side&&s.type===type));
      assert.equal(state.available.length,count-i);
      const op=operators.find(op=>draft.canChoose(op.id));
      assert.equal(op.side,type==='pick'?side:side==='attack'?'defense':'attack');
      assert.ok(draft.choose(op.id));snapshots.push(draft.snapshot());
    }
  }
  assert.equal(draft.snapshot().complete,true);
  for(const side of ['attack','defense']){
    assert.equal(draft.snapshot().picks[side].length,5);
    assert.equal(draft.snapshot().bans[side].length,5);
  }
  for(let i=19;i>=0;i--){assert.ok(draft.undo());assert.deepEqual(draft.snapshot(),snapshots[i]);}
  assert.equal(draft.undo(),false);
});
