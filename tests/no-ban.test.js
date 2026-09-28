import test from 'node:test';
import assert from 'node:assert/strict';
import {rules,compileRule} from '../operator-selection/src/rules.js';
import {createDraft} from '../operator-selection/src/engine.js';
import operators from '../operator-selection/data/operators.js';

test('无ban沿用标准规则的选人顺序且不产生禁用',()=>{
  const expected=[['attack',1],['defense',1],['attack',2],['defense',2],['attack',2],['defense',2]];
  assert.deepEqual(rules.noBan.rounds.map(round=>[round.side,round.actions[0][1]]),expected);
  const steps=compileRule(rules.noBan);
  assert.equal(steps.length,10);assert.ok(steps.every(step=>step.type==='pick'&&step.side===step.target));
  const draft=createDraft(rules.noBan,operators);
  for(const [round,[side,count]] of expected.entries())for(let i=0;i<count;i++){
    const state=draft.snapshot();assert.equal(state.step.round,round+1);assert.ok(state.available.every(step=>step.side===side&&step.type==='pick'));
    assert.ok(draft.choose(operators.find(op=>op.side===side&&draft.canChoose(op.id)).id));
  }
  const state=draft.snapshot();assert.equal(state.complete,true);
  assert.equal(state.picks.attack.length,5);assert.equal(state.picks.defense.length,5);
  assert.deepEqual(state.bans,{attack:[],defense:[]});
});
