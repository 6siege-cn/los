import test from 'node:test';
import assert from 'node:assert/strict';
import {rules} from '../operator-selection/src/rules.js';
import {createDraft} from '../operator-selection/src/engine.js';
import {captureDraft,restoreDraft} from '../operator-selection/src/draft-storage.js';
import {snapshotMatch,validateMatch} from '../operator-selection/src/match-records.js';
import {orderModes} from '../operator-selection/src/operator-order.js';
import operators from '../operator-selection/data/operators.js';

test('自由 BP 在进攻与防守操作间循环，且每次可选择或禁用',()=>{
  const draft=createDraft(rules.free,operators);
  assert.deepEqual(draft.snapshot().available.map(step=>[step.side,step.type,step.target]),[
    ['attack','pick','attack'],['attack','ban','defense']
  ]);
  assert.ok(draft.choose('smoke'));
  assert.deepEqual(draft.snapshot().available.map(step=>[step.side,step.type,step.target]),[
    ['defense','pick','defense'],['defense','ban','attack']
  ]);
  assert.ok(draft.choose('sledge'));
  assert.deepEqual(draft.snapshot().bans,{attack:['smoke'],defense:['sledge']});
});

test('自由 BP 可随时停止和继续，但双方必须各选满五人才可保存',()=>{
  const draft=createDraft(rules.free,operators);draft.choose('sledge');draft.choose('smoke');
  assert.equal(draft.snapshot().complete,false);assert.ok(draft.stop());assert.equal(draft.snapshot().complete,true);
  const context={state:draft.snapshot(),ruleId:'free',rule:rules.free,scope:{alt:true,diy:false},orderMode:'time',operators};
  assert.throws(()=>snapshotMatch(context,'free-fixture','2026-09-28T00:00:00Z'),/各选满 5 人/);
  assert.ok(draft.resume());assert.equal(draft.snapshot().complete,false);
  while(Object.values(draft.snapshot().picks).some(ids=>ids.length<5)){
    const pick=draft.snapshot().available.find(step=>step.type==='pick');
    assert.ok(draft.choose(operators.find(op=>op.side===pick.target&&draft.canChoose(op.id)).id));
  }
  draft.stop();const record=snapshotMatch({...context,state:draft.snapshot()},'free-fixture','2026-09-28T00:00:00Z');
  assert.equal(record.picks.attack.length,5);assert.equal(record.picks.defense.length,5);
  assert.doesNotThrow(()=>validateMatch({...record,mapId:'bank',mode:'炸弹模式',winner:'attack',ending:'歼灭敌方',endRound:'1'}));
});

test('自由 BP 每边最多禁用十人，停止状态可恢复',()=>{
  const draft=createDraft(rules.free,operators);
  for(let i=0;i<20;i++){
    const ban=draft.snapshot().available.find(step=>step.type==='ban');
    assert.ok(ban);assert.ok(draft.choose(operators.find(op=>op.side===ban.target&&draft.canChoose(op.id)).id));
  }
  assert.equal(draft.snapshot().bans.attack.length,10);assert.equal(draft.snapshot().bans.defense.length,10);
  assert.ok(draft.snapshot().available.every(step=>step.type==='pick'));
  draft.stop();
  const saved=captureDraft({draft,ruleId:'free',rule:rules.free,scope:{alt:true,diy:false},orderMode:'time',activeSide:'attack',operators});
  const restored=restoreDraft(saved,{rules,orderModes,operators}).draft;
  assert.equal(restored.snapshot().stopped,true);assert.deepEqual(restored.snapshot().history,draft.snapshot().history);
});

test('自由 BP 拒绝第十一个单方禁用',()=>{
  const draft=createDraft(rules.free,operators);
  for(let i=0;i<20;i++){
    const ban=draft.snapshot().available.find(step=>step.type==='ban');
    draft.choose(operators.find(op=>op.side===ban.target&&draft.canChoose(op.id)).id);
  }
  const state=draft.snapshot();
  assert.equal(state.bans.attack.length,10);assert.equal(state.bans.defense.length,10);
  assert.equal(state.available.some(step=>step.type==='ban'),false);
});
