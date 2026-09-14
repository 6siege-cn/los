import test from 'node:test';
import assert from 'node:assert/strict';
import operators from '../operator-selection/data/operators.js';
import {sortOperators} from '../operator-selection/src/operator-order.js';
const op=(id,version,hp,totalExpectedDamage)=>({id,name:id,version,hp:'health_'+hp,totalExpectedDamage,closeExpectedDamage:0,mediumExpectedDamage:0,longExpectedDamage:0});
test('health first, recruits last within equal health, then damage irrespective of version',()=>{
  const source=[op('recruit_attack_1','off',1,99),op('diy','diy',1,99),op('alt','alt',1,99),op('healthy','off',6,99),op('low','off',4,10),op('high','off',4,15.5),op('tie','off',4,15.5)];
  const before=structuredClone(source);
  assert.deepEqual(sortOperators(source).map(op=>op.id),['diy','alt','recruit_attack_1','high','tie','low','healthy']);
  assert.deepEqual(sortOperators([op('recruit_defense_1','off',4,99),op('normal','off',4,1),op('higher_hp','off',5,99)]).map(op=>op.id),['normal','recruit_defense_1','higher_hp']);
  assert.deepEqual(source,before);
});
test('actual rosters retain every entry and obey all six priorities',()=>{
  for(const side of ['attack','defense']){
    const source=operators.filter(op=>op.side===side),sorted=sortOperators(source);
    assert.equal(sorted.length,source.length);
    assert.deepEqual(new Set(sorted.map(op=>op.id)),new Set(source.map(op=>op.id)));
    const rank=op=>[Number(op.hp.split('_')[1]),Number(op.name==='RECRUIT'),-op.totalExpectedDamage,-op.closeExpectedDamage,-op.mediumExpectedDamage,-op.longExpectedDamage];
    for(let i=1;i<sorted.length;i++){
      const a=rank(sorted[i-1]),b=rank(sorted[i]);
      const differing=a.findIndex((value,k)=>value!==b[k]);
      assert.ok(differing===-1||a[differing]<b[differing],sorted[i].id);
    }
    assert.deepEqual(sortOperators(sorted),sorted);
  }
});
test('equal totals break ties by close, then medium, then long damage',()=>{
  // Synthetic totals isolate even the mathematically redundant final tie-break.
  const make=(id,close,medium,long)=>({...op(id,'off',4,12),closeExpectedDamage:close,mediumExpectedDamage:medium,longExpectedDamage:long});
  const source=[make('close',3,9,9),make('medium',4,2,9),make('long',4,3,1),make('first',4,3,2),make('tie',4,3,2)];
  assert.deepEqual(sortOperators(source).map(op=>op.id),['first','tie','long','medium','close']);
});
