import test from 'node:test';
import assert from 'node:assert/strict';
import operators from '../operator-selection/data/operators.js';
import {calculateExpectedDamage} from '../operator-selection/src/expected-damage.js';

test('damage weights include all colors and zero for every broken die',()=>{
  const result=calculateExpectedDamage({close:['yellow_dice','orange_dice','red_dice'],medium:['broken_yellow_dice','broken_orange_dice','broken_red_dice'],long:[]});
  assert.deepEqual(result,{closeExpectedDamage:4.5,mediumExpectedDamage:0,longExpectedDamage:0,totalExpectedDamage:4.5});
  assert.throws(()=>calculateExpectedDamage({close:['unknown_dice'],medium:[],long:[]}),/Unknown damage die/);
});

test('every roster entry has independently verified numeric expectations',()=>{
  const expected={yellow_dice:1,orange_dice:1.5,red_dice:2,broken_yellow_dice:0,broken_orange_dice:0,broken_red_dice:0};
  for(const op of operators){
    let total=0;
    for(const range of ['close','medium','long']){
      const value=op[range].reduce((sum,die)=>sum+expected[die],0);
      assert.ok(Number.isFinite(value),op.id);
      assert.equal(op[range+'ExpectedDamage'],value,op.id+' '+range);
      total+=value;
    }
    assert.equal(op.totalExpectedDamage,total,op.id);
  }
  const sledge=operators.find(op=>op.id==='sledge');
  assert.deepEqual(calculateExpectedDamage(sledge),{closeExpectedDamage:6.5,mediumExpectedDamage:5,longExpectedDamage:4,totalExpectedDamage:15.5});
  const alts=operators.filter(op=>op.version==='alt');
  assert.ok(alts.some(op=>op.totalExpectedDamage!==operators.find(base=>base.version==='off'&&base.name===op.name&&base.side===op.side).totalExpectedDamage));
});
