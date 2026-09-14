import test from 'node:test';
import assert from 'node:assert/strict';
import operators from '../operator-selection/data/operators.js';
import {timeOrder} from '../operator-selection/data/operator-time-order.js';
import {sortOperators,normalizeOperatorName} from '../operator-selection/src/operator-order.js';
const op=(name,version='off',side='attack')=>({name,version,side,id:name+version});
test('screenshot lists preserve all 76 positions, excluding only Striker and Sentry',()=>{
  assert.equal(timeOrder.attack.length,38);assert.equal(timeOrder.defense.length,38);
  for(const names of Object.values(timeOrder))assert.equal(new Set(names).size,names.length);
  assert.deepEqual(timeOrder.attack.slice(0,10),['SLEDGE','THATCHER','ASH','THERMITE','TWITCH','MONTAGNE','GLAZ','FUZE','BLITZ','IQ']);
  assert.deepEqual(timeOrder.defense.slice(0,10),['SMOKE','MUTE','CASTLE','PULSE','DOC','ROOK','KAPKAN','TACHANKA','JÄGER','BANDIT']);
  assert.deepEqual(timeOrder.attack.slice(-6),['GRIM','BRAVA','RAM','DEIMOS','RAUORA','SOLID SNAKE']);
  assert.deepEqual(timeOrder.defense.slice(-6),['SOLIS','FENRIR','TUBARÃO','SKOPÓS','DENARI','NOOR']);
  assert.ok(!Object.values(timeOrder).flat().some(name=>['STRIKER','SENTRY'].includes(name)));
});
test('time groups matching names in screenshot order, then OFF ALT DIY; unknown names last',()=>{
  const input=[op('NEW','diy'),op('ASH'),op('sledge','alt'),op('NEW','off'),op('SLEDGE','diy'),op('Sledge'),op('STRIKER')];
  const before=structuredClone(input);
  assert.deepEqual(sortOperators(input,'time').map(o=>o.id),['Sledgeoff','sledgealt','SLEDGEdiy','ASHoff','NEWoff','NEWdiy','STRIKERoff']);
  assert.deepEqual(input,before);
  assert.deepEqual(sortOperators([op('NOOR','off','defense'),op('SKOPOS','alt','defense'),op('TUBARAO','off','defense'),op('SKOPÓS','off','defense')],'time').map(o=>o.name),['TUBARAO','SKOPÓS','SKOPOS','NOOR']);
});
test('accented names match current data and every non-recruit is covered',()=>{
  for(const [plain,accented] of [['NOKK','NØKK'],['CAPITAO','CAPITÃO'],['JAGER','JÄGER'],['SOLIDSNAKE','Solid Snake']])assert.equal(normalizeOperatorName(plain),normalizeOperatorName(accented));
  for(const op of operators.filter(o=>o.name!=='RECRUIT'))assert.ok(timeOrder[op.side].some(name=>normalizeOperatorName(name)===normalizeOperatorName(op.name)),op.name);
  assert.throws(()=>sortOperators([], 'unknown'),/Unknown operator order/);
});
