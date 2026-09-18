import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {normalizeHistoricalRow,prepareHistoricalImport,historicalImportSQL,historicalRollbackSQL,historicalCatalog} from '../cloud/historical-import.js';
import {aggregateSnapshot} from '../statistics/model.js';
import {catalog,cleanRecord} from '../cloud/domain.js';
function row(overrides={},number=2){const cells={A:'45000',D:'club',E:'sledge',F:'ash',G:'thermite',H:'iq',I:'glaz',J:'smoke',K:'mute',L:'castle',M:'pulse',N:'jager',O:'进攻',P:'ace',Q:'ying',R:'zero',S:'finka',T:'fuze',U:'bandit',V:'doc',W:'rook',X:'kapkan',Y:'tachanka',Z:'5b；正常对局',B:'私人玩家',C:'另一玩家',...overrides};return {row:number,cells:Object.fromEntries(Object.entries(cells).filter(([,v])=>v!==undefined).map(([k,v])=>[k+number,v]))};}
const options={importedAt:'2026-09-18T10:00:00Z'};
test('5b mapping preserves ban targets without fabricating chronology, modes or ending',()=>{
  const item=normalizeHistoricalRow(row(),options);assert.deepEqual(item.reasons,[]);assert.equal(item.record.ruleId,'fiveBan');assert.equal(item.record.mapId,'clubhouse');assert.equal(item.record.source.playedOn,'2023-03-15');
  assert.deepEqual(item.record.bans.attack,['bandit','doc','rook','kapkan','tachanka']);assert.equal(item.record.bans.defense[0],'ace');assert.equal(item.record.mode,'模式未记录');assert.equal(item.record.ending,null);assert.deepEqual(item.record.history,[]);
  assert.equal(item.record.players,undefined);assert.equal(item.privateData.players.attack,'私人玩家');assert.throws(()=>cleanRecord(item.record));
});
test('abnormal labels, incomplete lineups, conflicts and unclear maps are excluded; ordinary play mistakes are retained',()=>{
  for(const changes of [{Z:'教学局'},{Z:'萌新局'},{Z:'推新局'},{Z:'测试新规则'},{Z:'封盘'},{O:'进攻(数据不足)'},{E:undefined},{P:'sledge'},{D:'C'},{J:'ash'},{O:undefined},{Y:undefined}])assert.ok(normalizeHistoricalRow(row(changes),options).reasons.length,JSON.stringify(changes));
  assert.equal(normalizeHistoricalRow(row({Z:'5b；2v2，计时，失误多，经验不足，教训很多'}),options).reasons.length,0);
});
test('unknown dates and bans stay unknown; historical operators are not silently remapped to ALT',()=>{
  const emptyBans=Object.fromEntries([...'PQRSTUVWXY'].map(k=>[k,undefined]));
  const item=normalizeHistoricalRow(row({...emptyBans,A:'视频来源',Z:undefined,E:'offglaz',I:'deimos',J:'extachanka'}),options);
  assert.deepEqual(item.reasons,[]);assert.equal(item.record.source.playedOn,null);assert.equal(item.record.source.bansRecorded,false);assert.equal(item.record.ruleId,'historical');assert.equal(item.record.picks.defense[0],'historical_extachanka');assert.equal(item.record.picks.attack[0],'glaz');
  assert.ok(!JSON.stringify(item.record).includes('视频来源'));assert.equal(item.record.scope.alt,null);
});
test('same dated matchup deduplicates; undated matches do not invent shared days',()=>{
  const plan=prepareHistoricalImport([row(),row({B:'其他玩家',Z:'5ban'},3),row({A:undefined},4),row({A:undefined,B:'另一组玩家'},5)],options);
  assert.equal(plan.accepted.length,3);assert.equal(plan.excluded.length,1);
  assert.equal(normalizeHistoricalRow(row(),options).record.id,normalizeHistoricalRow(row({},999),options).record.id);
});
test('SQL import is retry-safe, keeps private fields separate, aggregates missing bans correctly and rolls back only its own batch',()=>{
  const db=new DatabaseSync(':memory:');for(const file of readdirSync(new URL('../cloud/migrations/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort())db.exec(readFileSync(new URL('../cloud/migrations/'+file,import.meta.url),'utf8'));
  const noBans=Object.fromEntries([...'PQRSTUVWXY'].map(k=>[k,undefined])),plan=prepareHistoricalImport([row(),row({...noBans,A:undefined,Z:'notes with apostrophe: it\'s fine'},3)],options),auth={ownerHash:'owner',sourceHash:'source'};
  const sql=historicalImportSQL(plan,auth);db.exec(sql);db.exec(sql);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM matches').get().n,2);assert.equal(db.prepare('SELECT SUM(used) AS n FROM daily_quota').get().n,2);
  const rows=db.prepare('SELECT public_json,private_json FROM matches').all();assert.ok(rows.every(r=>!r.public_json.includes('私人玩家')));assert.ok(rows.every(r=>r.private_json.includes('私人玩家')));
  const buckets=db.prepare('SELECT * FROM stats_buckets').all().map(r=>({key:JSON.parse(r.key),total:r.total,attackWins:r.attack_wins,operators:JSON.parse(r.operators)}));
  const stats=aggregateSnapshot({catalog:[...catalog,...historicalCatalog],buckets});assert.equal(stats.total,2);assert.equal(stats.historicalTotal,2);assert.equal(stats.missingBans,1);
  const ace=stats.operators.find(o=>o.id==='ace'),sledge=stats.operators.find(o=>o.id==='sledge');assert.equal(ace.bans,1);assert.equal(ace.banEligible,1);assert.equal(ace.banRate,1);assert.equal(sledge.pickRate,1);assert.equal(sledge.bpRate,null);
  const unrelated=prepareHistoricalImport([row({A:'45001'},9)],options);db.exec(historicalImportSQL(unrelated,{ownerHash:'other',sourceHash:'other'}));
  db.exec(historicalRollbackSQL(auth));assert.equal(db.prepare('SELECT COUNT(*) AS n FROM matches WHERE deleted=0').get().n,1);
  db.exec(sql);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM matches WHERE deleted=0').get().n,1);db.close();
});
