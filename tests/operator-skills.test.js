import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import operators from '../operator-selection/data/operators.js';
import {parseCSV,readOperators} from '../scripts/build-operators.mjs';
import {normalizeSkillText} from '../scripts/normalize-skill-text.mjs';
const data=new URL('../operator-selection/data/',import.meta.url);
const skills=JSON.parse(readFileSync(new URL('operator-skills.json',data),'utf8'));

test('skills use a single normalized text field without redundant paragraph copies',()=>{
  assert.equal(Object.keys(skills).length,68);
  for(const text of Object.values(skills)){
    assert.equal(typeof text,'string');
    assert.equal(text,normalizeSkillText(text));
    assert.doesNotMatch(text,/^\//m);
  }
  assert.equal(normalizeSkillText('  /行动-门/窗\r\n /反应-和/或\n '),'行动-门/窗\n反应-和/或');
  assert.ok(skills.sledge.startsWith('战术突破锤\n'));
  assert.ok(skills.kapkan.startsWith('防止攻入装置\n'));
  assert.ok(skills.osa.startsWith('防弹橘色\n'));
  assert.ok(skills.mira.includes('设置-'));
});

test('all ALT operators share the exact skill text of their same-name OFF version',()=>{
  assert.deepEqual(readOperators(),operators);
  assert.equal(operators.filter(op=>typeof op.skill==='string').length,83);
  const alts=operators.filter(op=>op.version==='alt');
  assert.equal(alts.length,15);
  for(const op of alts){
    const original=operators.find(base=>base.version==='off'&&base.name===op.name&&base.side===op.side);
    assert.ok(original?.skill,op.id);
    assert.equal(op.skill,original.skill);
  }
  for(const op of operators.filter(op=>op.name==='RECRUIT'))assert.equal(op.skill,null);
});

test('skill normalization leaves existing stats, versions and assets unchanged',()=>{
  const rows=parseCSV(readFileSync(new URL('operators.csv',data),'utf8'));
  for(const row of rows){
    const {skill,...op}=operators.find(op=>op.id===row.id);
    for(const k of ['close','medium','long'])row[k]=JSON.parse(row[k]);
    assert.deepEqual(op,row);
  }
});
