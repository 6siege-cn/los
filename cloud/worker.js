import {cleanRecord,digest,fingerprint,beijingDay,catalog} from './domain.js';
import {readSnapshot,rebuildSnapshot} from './snapshots.js';
import {aggregateSnapshot} from '../statistics/model.js';
import {historicalCatalog} from './historical-catalog.js';
import {mapNames,modes,endings,endRounds,sideLabels,matchTypes as publicMatchTypes} from '../operator-selection/src/match-records.js';

const allowedOrigin='https://6siege-cn.github.io';
const headers={'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':allowedOrigin,'Access-Control-Allow-Methods':'GET, POST, PATCH, DELETE, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail=(message,status)=>Object.assign(Error(message),{status});
async function identity(request,id){
  const token=request.headers.get('Authorization')?.replace(/^Bearer /,'');
  if(!uuid.test(id)||!token||!/^\w{64}$/.test(token))throw fail('无效的提交凭据',400);
  return digest(token);
}
async function administrator(request,env){
  if(!env.ADMIN_PASSWORD)throw fail('管理员功能尚未配置',503);
  const supplied=request.headers.get('Authorization')?.replace(/^Bearer /,'')??'';
  const [actual,expected]=await Promise.all([digest(supplied),digest(env.ADMIN_PASSWORD)]);
  let difference=0;for(let i=0;i<expected.length;i++)difference|=actual.charCodeAt(i)^expected.charCodeAt(i);
  if(!supplied||difference)throw fail('管理员密码错误',401);
}
async function readJSON(request){
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw fail('需要 JSON 数据',415);
  const reader=request.body?.getReader();if(!reader)throw fail('缺少数据',400);
  const chunks=[];let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>32768){await reader.cancel();throw fail('对局数据过大',413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw fail('数据格式错误',400);}
}
async function submit(request,env){
  const input=await readJSON(request),id=input?.id,owner=await identity(request,id),now=new Date().toISOString();
  const existing=await env.DB.prepare('SELECT status,match_id,owner_hash FROM submissions WHERE id=?').bind(id).first();
  if(existing){if(existing.owner_hash!==owner)throw fail('提交凭据不匹配',403);return json({status:existing.status,matchId:existing.match_id});}
  let record,privateData;try{({record,privateData}=cleanRecord(input));}catch(e){throw fail(e.message,400);}
  const ip=request.headers.get('CF-Connecting-IP');
  if(!ip||!env.IP_HASH_SALT)throw fail('提交服务尚未配置完成',503);
  const day=beijingDay(new Date(now)),hash=await digest(fingerprint(record)),ipHash=await digest(env.IP_HASH_SALT+'|'+day+'|'+ip);
  record.savedAt=now; // Public date is the server receipt time, never a client-controlled quota date.
  const sql=(query,...values)=>env.DB.prepare(query).bind(...values);
  const results=await env.DB.batch([
    sql('INSERT OR IGNORE INTO submissions(id,owner_hash,status,created_at) VALUES(?,?,?,?)',id,owner,'pending',now),
    sql(`INSERT OR IGNORE INTO matches(id,owner_hash,day,fingerprint,ip_hash,received_at,public_json,private_json)
      SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM submissions WHERE id=? AND owner_hash=? AND status='pending')
      AND COALESCE((SELECT used FROM daily_quota WHERE day=? AND ip_hash=?),0)<5`,id,owner,day,hash,ipHash,now,JSON.stringify(record),JSON.stringify(privateData),id,owner,day,ipHash),
    sql(`UPDATE submissions SET match_id=(SELECT id FROM matches WHERE day=? AND fingerprint=?),
      status=CASE WHEN EXISTS(SELECT 1 FROM matches WHERE day=? AND fingerprint=? AND deleted=1) THEN 'removed'
      WHEN EXISTS(SELECT 1 FROM matches WHERE id=?) THEN 'uploaded'
      WHEN EXISTS(SELECT 1 FROM matches WHERE day=? AND fingerprint=?) THEN 'duplicate' ELSE 'quota' END
      WHERE id=? AND owner_hash=? AND status='pending'`,day,hash,day,hash,id,day,hash,id,owner),
    sql('SELECT status,match_id,owner_hash FROM submissions WHERE id=?',id)
  ]);
  const row=results.at(-1).results[0];if(row.owner_hash!==owner)throw fail('提交凭据不匹配',403);
  return json({status:row.status,matchId:row.match_id});
}
async function remove(request,env,id){
  const owner=await identity(request,id),now=new Date().toISOString(),sql=(q,...v)=>env.DB.prepare(q).bind(...v);
  const result=await env.DB.batch([
    sql("INSERT OR IGNORE INTO submissions(id,owner_hash,status,created_at) VALUES(?,?,'deleted',?)",id,owner,now),
    sql('UPDATE matches SET deleted=1,public_json=NULL,private_json=NULL WHERE id=? AND owner_hash=?',id,owner),
    sql("UPDATE submissions SET status='deleted',match_id=NULL WHERE id=? AND owner_hash=?",id,owner),
    sql('SELECT owner_hash FROM submissions WHERE id=?',id)
  ]);
  if(result.at(-1).results[0].owner_hash!==owner)throw fail('没有删除权限',403);
  return json({status:'deleted'});
}
const adminFields=new Set(['mapId','mode','winner','ending','endRound','matchType']);
function applyAdminChanges(record,input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw fail('修改内容无效',400);
  const keys=Object.keys(input);if(!keys.length||keys.some(key=>!adminFields.has(key)))throw fail('修改内容无效',400);
  const next={...record,...Object.fromEntries(keys.map(key=>[key,input[key]]))};
  if(!Object.hasOwn(mapNames,next.mapId)||!Object.hasOwn(sideLabels,next.winner)||!Object.hasOwn(publicMatchTypes,next.matchType))throw fail('地图、获胜方或对局类型无效',400);
  if(!modes.includes(next.mode)&&!(next.version===3&&next.mode==='模式未记录'))throw fail('模式无效',400);
  if(next.version===3){
    if(next.ending!==null&&!endings.includes(next.ending))throw fail('结束方式无效',400);
    if(next.endRound!==null&&!endRounds.includes(next.endRound))throw fail('结束回合无效',400);
    return next;
  }
  try{return cleanRecord(next).record;}catch(error){throw fail(error.message,400);}
}
async function adminList(env,url){
  const page=Math.max(1,Math.min(100000,Number.parseInt(url.searchParams.get('page'))||1)),limit=20;
  const results=await env.DB.batch([env.DB.prepare('SELECT COUNT(*) AS total FROM matches WHERE deleted=0'),env.DB.prepare('SELECT public_json FROM matches WHERE deleted=0 ORDER BY received_at DESC,id DESC LIMIT ? OFFSET ?').bind(limit,(page-1)*limit)]);
  return json({records:results[1].results.map(row=>JSON.parse(row.public_json)),total:results[0].results[0].total,page,pageSize:limit});
}
async function adminUpdate(request,env,id){
  if(!uuid.test(id))throw fail('对局编号无效',400);
  const row=await env.DB.prepare('SELECT day,public_json FROM matches WHERE id=? AND deleted=0').bind(id).first();if(!row)throw fail('对局不存在或已删除',404);
  const record=applyAdminChanges(JSON.parse(row.public_json),await readJSON(request));
  record.id=id;const hash=await digest(fingerprint(record));
  const duplicate=await env.DB.prepare('SELECT id FROM matches WHERE day=? AND fingerprint=? AND id!=? AND deleted=0').bind(row.day,hash,id).first();
  if(duplicate)throw fail('修改后会与另一条对局重复',409);
  await env.DB.prepare('UPDATE matches SET fingerprint=?,public_json=? WHERE id=? AND deleted=0').bind(hash,JSON.stringify(record),id).run();
  return json({record});
}
async function adminRemove(env,id){
  if(!uuid.test(id))throw fail('对局编号无效',400);
  const found=await env.DB.prepare('SELECT id FROM matches WHERE id=? AND deleted=0').bind(id).first();if(!found)throw fail('对局不存在或已删除',404);
  const sql=(query,...values)=>env.DB.prepare(query).bind(...values);
  await env.DB.batch([sql('UPDATE matches SET deleted=1,public_json=NULL,private_json=NULL WHERE id=?',id),sql("UPDATE submissions SET status='deleted',match_id=NULL WHERE match_id=? OR id=?",id,id)]);
  return json({status:'deleted'});
}
async function snapshotResponse(request,env,ctx){
  const key=new Request(new URL('/api/stats-snapshot?v=2',request.url)),cache=globalThis.caches?.default;
  const cached=cache?await cache.match(key):null;if(cached)return cached;
  const data=await readSnapshot(env.DB,[...catalog,...historicalCatalog]),response=new Response(JSON.stringify(data),{headers:{...headers,'Cache-Control':'public, max-age=300'}});
  if(cache&&ctx)ctx.waitUntil(cache.put(key,response.clone()).catch(()=>{}));
  return response;
}
export default {async scheduled(event,env){await rebuildSnapshot(env.DB);},async fetch(request,env,ctx){
  try{
    const url=new URL(request.url),path=url.pathname;
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(['POST','PATCH','DELETE'].includes(request.method)&&request.headers.get('Origin')&&request.headers.get('Origin')!==allowedOrigin)throw fail('来源不允许',403);
    if(path==='/api/health')return json({ok:true,version:3});
    const adminSingle=path.match(/^\/api\/admin\/matches\/([^/]+)$/);
    if(path==='/api/admin/matches'||adminSingle){
      await administrator(request,env);
      if(request.method==='GET'&&path==='/api/admin/matches')return await adminList(env,url);
      if(request.method==='PATCH'&&adminSingle)return await adminUpdate(request,env,adminSingle[1]);
      if(request.method==='DELETE'&&adminSingle)return await adminRemove(env,adminSingle[1]);
    }
    if(request.method==='POST'&&path==='/api/matches')return await submit(request,env);
    const single=path.match(/^\/api\/matches\/([^/]+)$/);
    if(request.method==='DELETE'&&single)return await remove(request,env,single[1]);
    if(request.method==='GET'&&single){const r=await env.DB.prepare('SELECT public_json FROM matches WHERE id=? AND deleted=0').bind(single[1]).first();return r?json(JSON.parse(r.public_json)):json({error:'对局不存在或已撤回'},404);}
    if(request.method==='GET'&&path==='/api/matches'){
      const page=Math.max(1,Math.min(100000,Number.parseInt(url.searchParams.get('page'))||1)),limit=20;
      const results=await env.DB.batch([env.DB.prepare('SELECT COUNT(*) AS total FROM matches WHERE deleted=0'),env.DB.prepare('SELECT public_json FROM matches WHERE deleted=0 ORDER BY received_at DESC,id DESC LIMIT ? OFFSET ?').bind(limit,(page-1)*limit)]);
      return json({records:results[1].results.map(r=>JSON.parse(r.public_json)),total:results[0].results[0].total,page,pageSize:limit,updatedAt:new Date().toISOString()});
    }
    if(request.method==='GET'&&path==='/api/stats-snapshot')return await snapshotResponse(request,env,ctx);
    if(request.method==='GET'&&path==='/api/stats'){
      const snapshot=await (await snapshotResponse(request,env,ctx)).json();
      const filters={mapId:url.searchParams.get('map')||'',ruleId:url.searchParams.get('rule')||'',matchType:url.searchParams.get('type')||'normal',family:url.searchParams.get('family')==='1'};
      return json({...aggregateSnapshot(snapshot,filters),filters,updatedAt:snapshot.generatedAt});
    }
    return json({error:'接口不存在'},404);
  }catch(error){return json({error:error.status?error.message:'服务暂时不可用，请稍后重试'},error.status||503);}
}};
