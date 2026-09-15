import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import operators from '../operator-selection/data/operators.js';
import assets from '../operator-selection/src/export-assets.js';
test('every roster avatar and match mark has a sized content-addressed PNG export',async()=>{
  for(const operator of operators)assert.ok(assets.avatars[operator.avatar],operator.id);
  assert.deepEqual(Object.keys(assets.marks),['thumbs-up','thumbs-down','skull','crosshair']);
  for(const [group,size] of [['avatars',192],['marks',64]])for(const path of Object.values(assets[group])){
    const bytes=await readFile(new URL('../operator-selection/'+path,import.meta.url));
    assert.equal(bytes.subarray(1,4).toString(),'PNG');
    assert.equal(bytes.readUInt32BE(16),size);assert.equal(bytes.readUInt32BE(20),size);
    assert.ok(path.includes(createHash('sha256').update(bytes).digest('hex').slice(0,20)));
  }
});
