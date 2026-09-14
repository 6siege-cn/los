import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshotMatch,validateMatch,uniqueTags,marks} from '../operator-selection/src/match-records.js';
import {createDraft} from '../operator-selection/src/engine.js';
import {rules} from '../operator-selection/src/rules.js';
import operators from '../operator-selection/data/operators.js';
function current(ruleId='standard'){
  const draft=createDraft(rules[ruleId],operators);return {draft,ruleId,rule:rules[ruleId],operators,scope:{alt:true,diy:false},orderMode:'time'};
}
function completed(ruleId='standard'){
  const c=current(ruleId);while(!c.draft.snapshot().complete)c.draft.choose(operators.find(op=>c.draft.canChoose(op.id)).id);
  const record=snapshotMatch({...c,state:c.draft.snapshot()},'fixture','2026-09-15T00:00:00Z');
  return {...record,winner:'defense',ending:'歼灭敌方',endRound:'+'};
}
test('only finished drafts can become match records; both rules keep all history and ten picks',()=>{
  const c=current();assert.throws(()=>snapshotMatch({...c,state:c.draft.snapshot()},'x','2026-09-15'),/完成/);
  for(const id of ['standard','fiveBan']){
    const record=validateMatch(completed(id));assert.equal(record.picks.attack.length+record.picks.defense.length,10);
    assert.equal(record.history.length,id==='standard'?14:20);assert.equal(record.bans.attack.length,id==='standard'?2:5);
  }
});
test('record snapshots isolate history, metadata and operators from future edits',()=>{
  const original=completed();const copy=validateMatch(original);original.operators[0].name='CHANGED';original.rule.name='CHANGED';original.history.reverse();original.tags.push('CHANGED');
  assert.notEqual(copy.operators[0].name,'CHANGED');assert.notEqual(copy.rule.name,'CHANGED');assert.deepEqual(copy.tags,[]);
  assert.deepEqual(copy.history.map(e=>e.operatorId),completed().history.map(e=>e.operatorId));
});
test('validate result enums, marks only on selected operators, unique reusable tags',()=>{
  assert.deepEqual(uniqueTags([' RUSH ','rush','ＲＵＳＨ','偷人','偷人']),['RUSH','偷人']);
  assert.throws(()=>uniqueTags(['a'.repeat(25)]));
  for(const key of Object.keys(marks)){const record=completed();record.marks[record.picks.attack[0]]=key;assert.equal(validateMatch(record).marks[record.picks.attack[0]],key);}
  for(const change of [r=>r.winner='',r=>r.ending='invalid',r=>r.endRound='6',r=>r.marks[r.bans.attack[0]]='skull',r=>r.marks[r.picks.attack[0]]='invalid',r=>r.picks.attack.pop(),r=>r.tags=Array.from({length:21},(_,i)=>'tag'+i)]){
    const record=completed();change(record);assert.throws(()=>validateMatch(record));
  }
});
