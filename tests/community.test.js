import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker from '../cloud/worker.js';
import {statistics,cleanRecord,fingerprint,beijingDay} from '../cloud/domain.js';
import {createDraft} from '../operator-selection/src/engine.js';
import {rules} from '../operator-selection/src/rules.js';
import operators from '../operator-selection/data/operators.js';
import {snapshotMatch} from '../operator-selection/src/match-records.js';
import {rebuildSnapshot,readSnapshot} from '../cloud/snapshots.js';
import {catalog} from '../cloud/domain.js';
import {aggregateSnapshot} from '../statistics/model.js';

export function fixture(overrides={}){
  const draft=createDraft(rules.standard,operators.filter(op=>op.version==='off'));
  while(!draft.snapshot().complete)draft.choose(operators.find(op=>draft.canChoose(op.id)).id);
  return {...snapshotMatch({state:draft.snapshot(),ruleId:'standard',rule:rules.standard,scope:{alt:false,diy:false},orderMode:'time',operators},crypto.randomUUID(),new Date().toISOString()),mapId:'consulate',mode:'炸弹模式',winner:'attack',ending:'歼灭敌方',endRound:'3',matchType:'normal',players:{attack:'私人昵称',defense:'另一昵称'},notes:'私人备注',...overrides};
}
function database(){
  const db=new DatabaseSync(':memory:');for(const file of readdirSync(new URL('../cloud/migrations/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort())db.exec(readFileSync(new URL('../cloud/migrations/'+file,import.meta.url),'utf8'));
  function prepare(sql,params=[]){const run=()=>{const stmt=db.prepare(sql);return stmt.columns().length?stmt.all(...params):((stmt.run(...params)),[]);};return {bind:(...values)=>prepare(sql,values),first:async()=>run()[0]??null,all:async()=>({results:run()}),run};}
  return {db,env:{IP_HASH_SALT:'test-only-salt',DB:{prepare,batch:async statements=>{db.exec('BEGIN');try{const values=statements.map(s=>({results:s.run()}));db.exec('COMMIT');return values;}catch(error){db.exec('ROLLBACK');throw error;}}}}};
}
const token='a'.repeat(64);
function request(method,path,body,auth=token,ip='192.0.2.1') {return new Request('https://example.test'+path,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+auth,'CF-Connecting-IP':ip},body:body?JSON.stringify(body):undefined});}
async function send(env,record,auth=token,ip){return (await worker.fetch(request('POST','/api/matches',record,auth,ip),env)).json();}
const get=async(env,path)=>(await worker.fetch(request('GET',path),env)).json();

test('server validates actual catalog, scope and replay instead of trusting snapshots',()=>{
  const valid=fixture();assert.equal(cleanRecord(valid).record.operators.length,14);
  const forged=structuredClone(valid);forged.operators[0].name='<script>';assert.notEqual(cleanRecord(forged).record.operators[0].name,'<script>');
  for(const mutate of [r=>r.history[0].side='defense',r=>r.history.pop(),r=>r.picks.attack.reverse(),r=>r.ruleId='unknown',r=>r.notes='x'.repeat(1001),r=>r.matchType='other']){const r=structuredClone(valid);mutate(r);assert.throws(()=>cleanRecord(r));}
});
test('fingerprint ignores ordering and private metadata but preserves rules, sides, versions, winner',()=>{
  const a=fixture(),b=structuredClone(a);b.picks.attack.reverse();b.bans.defense.reverse();b.notes='different';b.players={};assert.equal(fingerprint(a),fingerprint(b));
  for(const key of ['mapId','mode','ruleId','winner'])assert.notEqual(fingerprint(a),fingerprint({...a,[key]:'other'}));
  assert.equal(beijingDay(new Date('2026-09-18T15:59:59Z')),'2026-09-18');assert.equal(beijingDay(new Date('2026-09-18T16:00:00Z')),'2026-09-19');
});
test('concurrent submissions count once, duplicate cannot delete owner and reads omit private data',async()=>{
  const {env,db}=database(),a=fixture(),b={...a,id:crypto.randomUUID()};
  const responses=await Promise.all([send(env,a),send(env,b,'b'.repeat(64),'192.0.2.2')]);assert.deepEqual(responses.map(r=>r.status).sort(),['duplicate','uploaded']);
  const owner=responses[0].status==='uploaded'?a:b,duplicate=owner===a?b:a,ownerToken=owner===a?token:'b'.repeat(64),duplicateToken=owner===a?'b'.repeat(64):token;
  const listing=await get(env,'/api/matches');assert.equal(listing.total,1);assert.ok(!JSON.stringify(listing).includes('私人'));assert.equal(listing.records[0].players,undefined);
  await worker.fetch(request('DELETE','/api/matches/'+duplicate.id,null,duplicateToken),env);assert.equal((await get(env,'/api/matches')).total,1);
  assert.equal((await worker.fetch(request('DELETE','/api/matches/'+owner.id,null,duplicateToken),env)).status,403);
  await worker.fetch(request('DELETE','/api/matches/'+owner.id,null,ownerToken),env);assert.equal((await get(env,'/api/matches')).total,0);
  assert.equal(db.prepare('SELECT private_json FROM matches').get().private_json,null);
  assert.equal((await send(env,owner,ownerToken)).status,'deleted');
});
test('five-new-matches quota is atomic; duplicates and retries do not consume it; delete does not refund it',async()=>{
  const {env,db}=database(),maps=['consulate','clubhouse','bank','kafe','chalet','oregon'];
  const rows=maps.map(mapId=>fixture({mapId}));
  const result=await Promise.all(rows.map(r=>send(env,r)));assert.equal(result.filter(r=>r.status==='uploaded').length,5);assert.equal(result.filter(r=>r.status==='quota').length,1);
  const first=rows[result.findIndex(r=>r.status==='uploaded')];assert.equal((await send(env,first)).status,'uploaded');
  assert.equal((await send(env,{...first,id:crypto.randomUUID()})).status,'duplicate');
  await worker.fetch(request('DELETE','/api/matches/'+first.id),env);
  assert.equal(db.prepare('SELECT used FROM daily_quota').get().used,5);
  assert.equal((await send(env,fixture({mapId:'border'}))).status,'quota');
  assert.equal((await send(env,fixture({mapId:'border'}),token,'192.0.2.3')).status,'uploaded');
});
test('withdraw-before-upload tombstone prevents resurrection and terminal outcomes survive day changes',async()=>{
  const {env,db}=database(),a=fixture();await worker.fetch(request('DELETE','/api/matches/'+a.id),env);
  assert.equal((await send(env,a)).status,'deleted');assert.equal((await get(env,'/api/matches')).total,0);
  const b=fixture();assert.equal((await send(env,b)).status,'uploaded');db.exec("UPDATE matches SET day='2000-01-01'");assert.equal((await send(env,b)).status,'uploaded');assert.equal((await get(env,'/api/matches')).total,1);
});
test('stats use eligible scope, banned faction, map/rule/type filters and family counts',()=>{
  const a=cleanRecord(fixture()).record,b=cleanRecord(fixture({scope:{alt:true,diy:false},mapId:'bank',winner:'defense'})).record,c={...a,matchType:'teaching'};
  const data=statistics([a,b,c]);assert.equal(data.total,2);assert.equal(data.attackWinRate,.5);
  const picked=data.operators.find(op=>op.id===a.picks.attack[0]);assert.equal(picked.picks,2);assert.equal(picked.winRate,.5);assert.equal(picked.eligible,2);
  const alt=data.operators.find(op=>op.version==='alt');assert.equal(alt.eligible,1);
  const banned=data.operators.find(op=>op.id===a.bans.attack[0]);assert.equal(banned.side,'defense');assert.equal(banned.bans,2);assert.equal(banned.banRate,1);
  assert.equal(statistics([a,b,c],{mapId:'bank'}).total,1);assert.equal(statistics([a,b,c],{ruleId:'fiveBan'}).total,0);assert.equal(statistics([a,b,c],{matchType:'teaching'}).total,1);
  const family=statistics([a,b],{family:true}).operators.find(op=>op.name===picked.name&&op.side===picked.side);assert.equal(family.picks,2);assert.equal(family.eligible,2);
});
test('API fails closed on missing configuration, foreign origins, bad tokens and oversized bodies',async()=>{
  const {env}=database(),r=fixture();assert.equal((await worker.fetch(request('POST','/api/matches',r,'bad'),env)).status,400);
  const foreign=request('POST','/api/matches',r);foreign.headers.set('Origin','https://untrusted.test');assert.equal((await worker.fetch(foreign,env)).status,403);
  assert.equal((await worker.fetch(request('POST','/api/matches',{...r,notes:'x'.repeat(40000)}),env)).status,413);
  delete env.IP_HASH_SALT;assert.equal((await worker.fetch(request('POST','/api/matches',r),env)).status,503);
});

test('administrator password protects listing, edits any match and deletes private data',async()=>{
  const {env,db}=database(),record=fixture();env.ADMIN_PASSWORD='correct horse battery staple';assert.equal((await send(env,record)).status,'uploaded');
  const admin=(method,path,body,password=env.ADMIN_PASSWORD)=>worker.fetch(request(method,'/api/admin'+path,body,password),env);
  assert.equal((await admin('GET','/matches',null,'wrong')).status,401);
  let response=await admin('GET','/matches');assert.equal(response.status,200);assert.equal((await response.json()).total,1);
  const before=db.prepare('SELECT revision FROM stats_state').get().revision;
  response=await admin('PATCH','/matches/'+record.id,{mapId:'bank',winner:'defense'});assert.equal(response.status,200);assert.equal((await response.json()).record.mapId,'bank');
  const publicRecord=await get(env,'/api/matches/'+record.id);assert.equal(publicRecord.winner,'defense');assert.equal(db.prepare('SELECT revision FROM stats_state').get().revision,before+1);assert.match(db.prepare('SELECT private_json FROM matches').get().private_json,/私人昵称/);
  assert.equal((await admin('DELETE','/matches/'+record.id,null,'wrong')).status,401);assert.equal((await get(env,'/api/matches')).total,1);
  assert.equal((await admin('DELETE','/matches/'+record.id)).status,200);assert.equal((await get(env,'/api/matches')).total,0);assert.equal(db.prepare('SELECT private_json FROM matches').get().private_json,null);
});

test('snapshot publishes SQL aggregates only on change and matches the original statistics',async()=>{
  const {env,db}=database(),records=[fixture(),fixture({mapId:'bank',winner:'defense',scope:{alt:true,diy:false}}),fixture({mapId:'bank',matchType:'teaching'})];
  for(const r of records)assert.equal((await send(env,r)).status,'uploaded');
  assert.equal((await get(env,'/api/stats')).total,0);
  assert.equal(await rebuildSnapshot(env.DB,'2026-09-18T10:00:00.000Z'),true);
  const snapshot=await get(env,'/api/stats-snapshot');assert.equal(snapshot.buckets.length,3);assert.ok(!JSON.stringify(snapshot).includes('私人'));
  for(const filters of [{},{mapId:'bank'},{matchType:'all'},{matchType:'teaching'},{family:true},{ruleId:'fiveBan'}]){
    const actual=aggregateSnapshot(snapshot,filters),expected=statistics(records.map(r=>cleanRecord(r).record),filters);
    assert.equal(actual.total,expected.total);assert.equal(actual.attackWinRate,expected.attackWinRate);
    for(const row of expected.operators){const got=actual.operators.find(r=>r.id===row.id);for(const key of ['picks','wins','bans','eligible','pickRate','winRate','banRate','bpRate'])assert.equal(got[key],row[key],row.id+' '+key);}
  }
  await worker.fetch(request('DELETE','/api/matches/'+records[0].id),env);
  assert.equal((await get(env,'/api/matches')).total,2);assert.equal((await get(env,'/api/stats')).total,2);
  await worker.scheduled({},env);assert.equal((await get(env,'/api/stats')).total,1);
  const published=await readSnapshot(env.DB,catalog);
  db.exec('DROP VIEW stats_source_buckets');
  assert.equal(await rebuildSnapshot(env.DB,'2026-09-18T12:00:00.000Z'),false);
  const unchanged=await readSnapshot(env.DB,catalog);assert.equal(unchanged.generatedAt,published.generatedAt);assert.equal(unchanged.checkedAt,'2026-09-18T12:00:00.000Z');
  db.exec('UPDATE stats_state SET revision=revision+1');
  await assert.rejects(rebuildSnapshot(env.DB));assert.deepEqual(await readSnapshot(env.DB,catalog),unchanged);
  db.close();
});

test('snapshot migration bootstraps pre-existing records and concurrent rebuilds preserve totals',async()=>{
  const {env,db}=database();await send(env,fixture());
  db.exec('DROP TRIGGER stats_insert; DROP TRIGGER stats_delete; DROP VIEW stats_source_buckets; DROP TABLE stats_buckets; DROP TABLE stats_meta; DROP TABLE stats_state;');
  db.exec(readFileSync(new URL('../cloud/migrations/0002_statistics_snapshots.sql',import.meta.url),'utf8'));
  assert.equal(aggregateSnapshot(await readSnapshot(env.DB,catalog)).total,1);
  await send(env,fixture({mapId:'bank'}));await Promise.all([rebuildSnapshot(env.DB),rebuildSnapshot(env.DB)]);
  assert.equal(aggregateSnapshot(await readSnapshot(env.DB,catalog)).total,2);db.close();
});
