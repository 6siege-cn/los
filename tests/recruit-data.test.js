import test from 'node:test';
import assert from 'node:assert/strict';
import operators from '../operator-selection/data/operators.js';

test('all four recruits use the corrected ordered weapon dice and expectations',()=>{
  const light=['yellow_dice','yellow_dice','orange_dice','orange_dice'];
  const heavy=['broken_orange_dice','orange_dice','red_dice','red_dice'];
  const medium=['yellow_dice','orange_dice','orange_dice','red_dice'];
  for(const side of ['attack','defense'])for(const hp of [4,6]){
    const matches=operators.filter(op=>op.name==='RECRUIT'&&op.side===side&&op.hp==='health_'+hp);
    assert.equal(matches.length,1);
    const [op]=matches;
    assert.deepEqual(op.close,hp===4?light:heavy);
    assert.deepEqual(op.medium,medium);
    assert.deepEqual(op.long,hp===4?heavy:light);
    assert.equal(op.closeExpectedDamage,hp===4?5:5.5);
    assert.equal(op.mediumExpectedDamage,6);
    assert.equal(op.longExpectedDamage,hp===4?5.5:5);
    assert.equal(op.totalExpectedDamage,16.5);
  }
});
