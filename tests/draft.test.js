import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import operators from '../operator-selection/data/operators.js';
import {assets} from '../operator-selection/src/config.js';
import {rules,compileRule} from '../operator-selection/src/rules.js';
import {createDraft} from '../operator-selection/src/engine.js';
import {operatorFamily,versionLabel} from '../operator-selection/src/identity.js';
import {readOperators} from '../scripts/build-operators.mjs';

test('standard schedule preserves all fourteen actions and six rounds',()=>{
  assert.deepEqual(compileRule(rules.standard).map(s=>s.side+':'+s.type),[
    'attack:pick','attack:ban','defense:pick','defense:ban',
    'attack:pick','attack:pick','defense:pick','defense:pick','defense:ban',
    'attack:pick','attack:pick','attack:ban','defense:pick','defense:pick'
  ]);
});
test('complete draft can undo every action and branch from an earlier state',()=>{
  const d=createDraft(rules.standard,operators), snapshots=[d.snapshot()];
  while(!d.snapshot().complete){
    assert.equal(d.choose('missing'),false);
    const wrong=operators.find(o=>!d.snapshot().available.some(s=>s.target===o.side));
    if(wrong)assert.equal(d.choose(wrong.id),false);
    const op=operators.find(o=>d.canChoose(o.id));assert.ok(op);
    assert.equal(d.choose(op.id),true);assert.equal(d.canChoose(op.id),false);
    snapshots.push(d.snapshot());
  }
  const end=d.snapshot();
  assert.equal(end.picks.attack.length,5);assert.equal(end.picks.defense.length,5);
  assert.equal(end.bans.attack.length,2);assert.equal(end.bans.defense.length,2);
  for(const id of end.bans.attack)assert.equal(operators.find(o=>o.id===id).side,'defense');
  assert.equal(d.choose(operators[0].id),false);
  for(let i=13;i>=0;i--){assert.equal(d.undo(),true);assert.deepEqual(d.snapshot(),snapshots[i]);}
  assert.equal(d.undo(),false);
  assert.equal(d.choose('ash'),true);d.undo();assert.equal(d.choose('sledge'),true);
  assert.deepEqual(d.snapshot().picks.attack,['sledge']);
});
test('alternative schedules reuse pick and enemy-ban semantics',()=>{
  const rule={teamSize:1,rounds:[{side:'defense',actions:[['ban',1],['pick',1]]}]};
  const d=createDraft(rule,operators);
  assert.equal(d.choose('ash'),true);assert.equal(d.choose('smoke'),true);
  assert.equal(d.snapshot().complete,true);d.undo();assert.equal(d.snapshot().step.type,'pick');
});
test('every within-round ordering respects quotas and can be fully undone',()=>{
  const permutations=items=>items.length===0?[[]]:[...new Set(items)].flatMap(type=>{
    const rest=[...items];rest.splice(rest.indexOf(type),1);
    return permutations(rest).map(tail=>[type,...tail]);
  });
  const orders=rules.standard.rounds.reduce((paths,round)=>{
    const types=round.actions.flatMap(([type,count])=>Array(count).fill(type));
    return paths.flatMap(path=>permutations(types).map(order=>[...path,order]));
  },[[]]);
  assert.equal(orders.length,36);
  for(const order of orders){
    const d=createDraft(rules.standard,operators), snapshots=[d.snapshot()];
    order.forEach((types,roundIndex)=>{
      for(const type of types){
        const state=d.snapshot();assert.equal(state.step.round,roundIndex+1);
        const action=state.available.find(s=>s.type===type);assert.ok(action);
        const op=operators.find(o=>o.side===action.target&&d.canChoose(o.id));
        assert.ok(op);assert.equal(d.choose(op.id),true);
        assert.equal(d.snapshot().history.at(-1).type,type);
        const next=d.snapshot();
        for(const candidate of operators){
          const expected=next.available.some(s=>s.target===candidate.side)&&!next.history.some(e=>operatorFamily(operators.find(o=>o.id===e.operatorId))===operatorFamily(candidate));
          assert.equal(d.canChoose(candidate.id),expected);
        }
        snapshots.push(next);
      }
    });
    assert.equal(d.snapshot().complete,true);
    for(let i=snapshots.length-2;i>=0;i--){d.undo();assert.deepEqual(d.snapshot(),snapshots[i]);}
  }
});
test('ban first stays in round one and undo allows changing that decision',()=>{
  const d=createDraft(rules.standard,operators);
  assert.equal(d.choose('smoke'),true);
  assert.deepEqual(d.snapshot().bans.attack,['smoke']);
  assert.equal(d.snapshot().step.round,1);
  assert.deepEqual(d.snapshot().available.map(s=>s.type),['pick']);
  assert.equal(d.choose('mute'),false);
  assert.equal(d.choose('sledge'),true);
  assert.equal(d.snapshot().step.round,2);
  d.undo();assert.deepEqual(d.snapshot().picks.attack,[]);
  assert.deepEqual(d.snapshot().bans.attack,['smoke']);
  d.undo();assert.equal(d.canChoose('smoke'),true);
  assert.equal(d.choose('ash'),true);
  assert.deepEqual(d.snapshot().available.map(s=>s.type),['ban']);
});
test('CSV and browser data agree; every referenced asset exists',()=>{
  assert.deepEqual(readOperators(),operators);
  assert.equal(new Set(operators.map(o=>o.id)).size,operators.length);
  for(const o of operators){
    assert.ok(existsSync(new URL(o.avatar,assets.avatarBase)),o.id+' avatar');
    assert.ok(existsSync(new URL(o.panel,assets.panelBase)),o.id+' panel');
    for(const key of ['close','medium','long']){
      assert.ok(o[key].length<=4);
      for(const token of o[key])assert.ok(assets.tokens[token]&&existsSync(new URL(assets.tokens[token])),token);
    }
    for(const key of ['hp','destruction'])assert.ok(assets.tokens[o[key]]&&existsSync(new URL(assets.tokens[o[key]])),o.id+key);
  }
  for(const icon of Object.values(assets.icons))assert.ok(existsSync(new URL(icon.url)));
});
test('all alternate versions share pick/ban locks, preserve the chosen ID, and unlock on undo',()=>{
  for(const alt of operators.filter(o=>o.version!=='off')){
    const original=operators.find(o=>o.version==='off'&&operatorFamily(o)===operatorFamily(alt));
    assert.ok(original,alt.id);
    for(const [chosen,other] of [[alt,original],[original,alt]]){
      for(const type of ['pick','ban']){
        const side=type==='pick'?chosen.side:chosen.side==='attack'?'defense':'attack';
        const d=createDraft({rounds:[{side,actions:[[type,2]]}]},operators);
        assert.equal(d.choose(chosen.id),true);
        const before=d.snapshot();
        assert.equal(before.history[0].operatorId,chosen.id);
        assert.equal(d.canChoose(other.id),false);
        assert.equal(d.choose(other.id),false);
        assert.deepEqual(d.snapshot(),before);
        assert.equal(d.undo(),true);
        assert.equal(d.canChoose(chosen.id),true);
        assert.equal(d.canChoose(other.id),true);
        assert.equal(d.choose(other.id),true);
      }
    }
  }
});
test('a ban prevents later picks of all versions; a pick also prevents later bans',()=>{
  for(const type of ['pick','ban']){
    const side=type==='pick'?'attack':'defense';
    const otherType=type==='pick'?'ban':'pick';
    const d=createDraft({rounds:[{side,actions:[[type,1]]},{side:side==='attack'?'defense':'attack',actions:[[otherType,1]]}]},operators);
    assert.equal(d.choose('altsledge'),true);
    assert.equal(d.snapshot().step.round,2);
    assert.equal(d.choose('sledge'),false);
    assert.equal(d.choose('altsledge'),false);
    assert.equal(d.choose('ash'),true);
    d.undo();assert.equal(d.canChoose('sledge'),false);
    d.undo();assert.equal(d.canChoose('sledge'),true);
  }
});
test('version labels cover any non-off version',()=>{
  assert.equal(versionLabel({version:'off'}),'');
  assert.equal(versionLabel({version:'alt'}),'ALT');
  assert.equal(versionLabel({version:'v2'}),'V2');
});
