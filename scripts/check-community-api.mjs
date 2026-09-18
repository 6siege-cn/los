import assert from 'node:assert/strict';
import {createDraft} from '../operator-selection/src/engine.js';
import {rules} from '../operator-selection/src/rules.js';
import operators from '../operator-selection/data/operators.js';
import {snapshotMatch} from '../operator-selection/src/match-records.js';
import {uploadPayload} from '../operator-selection/src/match-sync.js';
const base=process.argv[2]||'http://127.0.0.1:8790';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Integration fixtures are only allowed on localhost');
const draft=createDraft(rules.standard,operators);while(!draft.snapshot().complete)draft.choose(operators.find(op=>draft.canChoose(op.id)).id);
const record={...snapshotMatch({state:draft.snapshot(),ruleId:'standard',rule:rules.standard,scope:{alt:true,diy:true},orderMode:'time',operators},crypto.randomUUID(),new Date().toISOString()),mapId:'bank',mode:'炸弹模式',winner:'attack',ending:'歼灭敌方',endRound:'3',matchType:'test',players:{attack:'private-test'},notes:'private-note'};
const token='c'.repeat(64),ids=[];
async function call(method,path,body,auth=token){const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+auth,'CF-Connecting-IP':'192.0.2.200'},body:body?JSON.stringify(uploadPayload(body)):undefined});const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));return data;}
try{
  ids.push(record.id);assert.equal((await call('POST','/api/matches',record)).status,'uploaded');
  assert.equal((await call('POST','/api/matches',record)).status,'uploaded');
  const duplicate={...record,id:crypto.randomUUID()};ids.push(duplicate.id);assert.equal((await call('POST','/api/matches',duplicate)).status,'duplicate');
  const publicData=await call('GET','/api/matches/'+record.id);assert.equal(publicData.notes,undefined);assert.equal(publicData.players,undefined);
  const stats=await call('GET','/api/stats?type=test&map=bank');assert.ok(stats.total>=1);
  await call('DELETE','/api/matches/'+duplicate.id);assert.equal((await call('GET','/api/matches/'+record.id)).id,record.id);
  await call('DELETE','/api/matches/'+record.id);assert.equal((await call('POST','/api/matches',record)).status,'deleted');
  const removed=await fetch(base+'/api/matches/'+record.id);assert.equal(removed.status,404);
  console.log('Real Worker / D1 integration passed: submit, retry, deduplicate, privacy, statistics, ownership and deletion.');
}finally{for(const id of ids)await call('DELETE','/api/matches/'+id);}
