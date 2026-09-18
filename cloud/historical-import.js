// Offline administrator import only; never accepted by the public submission endpoint.
import {createHash} from 'node:crypto';
import {catalog,fingerprint} from './domain.js';
import {operatorFamily} from '../operator-selection/src/identity.js';
import {historicalCatalog} from './historical-catalog.js';
export {historicalCatalog};
const hash=value=>createHash('sha256').update(value).digest('hex');
const normalized=value=>String(value??'').normalize('NFKC').trim();
const mapIds={club:'clubhouse',clubhouse:'clubhouse',consulate:'consulate',bank:'bank',kafe:'kafe',oregon:'oregon',aregon:'oregon',chalet:'chalet',coastline:'coastline',border:'border'};
const currentById=new Map(catalog.map(op=>[op.id,op])),oldByName=new Map(historicalCatalog.map(op=>[op.id.replace('historical_',''),op]));
export function normalizeHistoricalRow(input,{source='对局日志.xlsx',importedAt=new Date().toISOString()}={}){
  const c=Object.fromEntries(Object.entries(input.cells).map(([key,value])=>[key.replace(/\d/g,''),normalized(value)]));
  const notes=[c.Z,c.AA].filter(Boolean).join('\n'),description=[c.O,notes,c.AH].filter(Boolean).join(' '),reasons=[],warnings=[];
  if(/教学|萌新|推新/.test(description))reasons.push('教学或新手教学局');
  if(/测试/.test(description))reasons.push('测试规则');
  if(/封盘/.test(description))reasons.push('封盘未完成');
  if(/数据不足|ban位没/.test(description))reasons.push('明确标记数据不完整');
  const winner=c.O==='进攻'?'attack':['防守','防守(肃清区域)'].includes(c.O)?'defense':null;
  if(!winner&&!reasons.length)reasons.push('缺少有效胜负');
  const mapId=mapIds[c.D?.toLowerCase()];if(!mapId)reasons.push('地图无法确定：'+(c.D||'空白'));
  const resolve=(value,side)=>{
    let key=value.toLowerCase().replace(/\s/g,'');if(key==='forst'){key='frost';warnings.push('forst 更正为 frost');}
    if(key.startsWith('off')&&currentById.has(key.slice(3)))key=key.slice(3);
    const op=currentById.get(key)||oldByName.get(key);if(!op){reasons.push('无法识别干员：'+value);return null;}
    if(op.side!==side)reasons.push('干员阵营错误：'+value);return op;
  };
  const read=(cols,side)=>[...cols].filter(k=>c[k]).map(k=>resolve(c[k],side)).filter(Boolean);
  const attack=read('EFGHI','attack'),defense=read('JKLMN','defense'),bannedAttack=read('PQRST','attack'),bannedDefense=read('UVWXY','defense');
  if(attack.length!==5||defense.length!==5)reasons.push('双方阵容不是完整的 5 名干员');
  const used=[...attack,...defense,...bannedAttack,...bannedDefense],families=used.map(operatorFamily);
  if(new Set(families).size!==families.length)reasons.push('选禁中存在重复干员或同名版本冲突');
  if(bannedAttack.length!==bannedDefense.length)reasons.push('双方禁用数量不一致');
  const is5ban=/(?:^|[^a-z0-9])5\s*b(?:an)?(?=$|[^a-z])/i.test(description);
  if(is5ban&&(bannedAttack.length!==5||bannedDefense.length!==5))reasons.push('5ban 禁用记录不完整');
  const ruleId=is5ban||bannedAttack.length===5&&bannedDefense.length===5?'fiveBan':bannedAttack.length===2&&bannedDefense.length===2?'standard':'historical';
  const ruleName=ruleId==='fiveBan'?'5ban':ruleId==='standard'?'标准规则':'历史规则未确认';
  if(!is5ban&&ruleId!=='historical')warnings.push('规则由双方禁用数量识别');
  if(ruleId==='historical')warnings.push('原表不足以确认当前规则');
  const serial=Number(c.A),playedOn=c.A&&Number.isFinite(serial)&&serial>20000&&serial<70000?new Date(Date.UTC(1899,11,30)+Math.floor(serial)*86400000).toISOString().slice(0,10):null;
  if(!playedOn)warnings.push('日期未记录');
  if(playedOn&&playedOn>importedAt.slice(0,10))reasons.push('日期晚于导入日');
  const mode=/人质/.test(description)?'人质模式':/肃清/.test(description)?'肃清威胁':/拆弹|炸弹/.test(description)?'炸弹模式':'模式未记录';
  const bansRecorded=bannedAttack.length>0&&bannedDefense.length>0;
  if(!bansRecorded)warnings.push('禁用未记录，不计入禁用率分母');
  if(used.some(op=>op.historicalOnly))warnings.push('含历史独立干员');
  const record={version:3,savedAt:importedAt,ruleId,rule:{name:ruleName},scope:{alt:null,diy:null},orderMode:null,history:[],
    picks:{attack:attack.map(o=>o.id),defense:defense.map(o=>o.id)},bans:{attack:bannedDefense.map(o=>o.id),defense:bannedAttack.map(o=>o.id)},
    operators:[...new Map(used.map(op=>[op.id,op])).values()],mapId,mode,winner,ending:null,endRound:null,marks:{},tags:[],matchType:'normal',
    source:{kind:'xlsx',label:source,sheet:'日志',row:input.row,playedOn,bansRecorded,ruleInferred:!is5ban&&ruleId!=='historical',scopeUnrecorded:true}};
  const privateData={players:{attack:c.B||'',defense:c.C||''},notes};
  // A dated match follows the live same-day fingerprint. Undated matches deduplicate only exact source content.
  const fp=hash(fingerprint(record)),identity=playedOn?playedOn+'|'+fp:JSON.stringify([fp,c.A||'',privateData]);
  const idHash=hash('xlsx-history-v1|'+identity);record.id=`${idHash.slice(0,8)}-${idHash.slice(8,12)}-4${idHash.slice(13,16)}-a${idHash.slice(17,20)}-${idHash.slice(20,32)}`;
  return {row:input.row,reasons:[...new Set(reasons)],warnings:[...new Set(warnings)],record,privateData,fingerprint:fp,day:playedOn||'undated:'+record.id};
}
export function prepareHistoricalImport(rows,options){
  const seen=new Map(),accepted=[],excluded=[];
  for(const row of rows){const item=normalizeHistoricalRow(row,options);if(!item.reasons.length){const key=item.day+'|'+item.fingerprint;if(seen.has(key))item.reasons.push('与第 '+seen.get(key)+' 行重复');else seen.set(key,item.row);}
    (item.reasons.length?excluded:accepted).push(item);
  }
  return {accepted,excluded};
}
const sql=value=>value===null?'NULL':"'"+String(value).replaceAll("'","''")+"'";
export const refreshHistoricalSnapshotSQL="DELETE FROM stats_buckets;\nINSERT INTO stats_buckets SELECT * FROM stats_source_buckets;\nUPDATE stats_meta SET revision=(SELECT revision FROM stats_state WHERE id=1),generated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),checked_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=1;\n";
export function historicalImportSQL(plan,{ownerHash,sourceHash}){
  const statements=[];
  for(const item of plan.accepted){
    const record={...item.record,source:{...item.record.source,fileHash:sourceHash}},values=[record.id,ownerHash,item.day,item.fingerprint,'history:'+sourceHash,record.savedAt,JSON.stringify(record),JSON.stringify(item.privateData)].map(sql);
    statements.push(`INSERT OR IGNORE INTO matches(id,owner_hash,day,fingerprint,ip_hash,received_at,public_json,private_json) SELECT ${values.join(',')} WHERE NOT EXISTS(SELECT 1 FROM submissions WHERE id=${sql(record.id)} AND status='deleted');`);
    statements.push(`INSERT OR IGNORE INTO submissions(id,owner_hash,status,match_id,created_at) SELECT id,owner_hash,'uploaded',id,received_at FROM matches WHERE id=${sql(record.id)} AND owner_hash=${sql(ownerHash)} AND deleted=0;`);
  }
  return statements.join('\n')+'\n'+refreshHistoricalSnapshotSQL;
}
export function historicalRollbackSQL({ownerHash,sourceHash}){
  return `UPDATE submissions SET status='deleted',match_id=NULL WHERE id IN(SELECT id FROM matches WHERE owner_hash=${sql(ownerHash)} AND json_extract(public_json,'$.source.fileHash')=${sql(sourceHash)});\nUPDATE matches SET deleted=1,public_json=NULL,private_json=NULL WHERE owner_hash=${sql(ownerHash)} AND json_extract(public_json,'$.source.fileHash')=${sql(sourceHash)};\n`+refreshHistoricalSnapshotSQL;
}
