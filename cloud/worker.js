import {cleanRecord,digest,fingerprint,beijingDay,statistics} from './domain.js';

const allowedOrigin='https://6siege-cn.github.io';
const headers={'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':allowedOrigin,'Access-Control-Allow-Methods':'GET, POST, DELETE, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail=(message,status)=>Object.assign(Error(message),{status});
async function identity(request,id){
  const token=request.headers.get('Authorization')?.replace(/^Bearer /,'');
  if(!uuid.test(id)||!token||!/^\w{64}$/.test(token))throw fail('无效的提交凭据',400);
  return digest(token);
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
export default {async fetch(request,env){
  try{
    const url=new URL(request.url),path=url.pathname;
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(['POST','DELETE'].includes(request.method)&&request.headers.get('Origin')&&request.headers.get('Origin')!==allowedOrigin)throw fail('来源不允许',403);
    if(path==='/api/health')return json({ok:true,version:1});
    if(request.method==='POST'&&path==='/api/matches')return await submit(request,env);
    const single=path.match(/^\/api\/matches\/([^/]+)$/);
    if(request.method==='DELETE'&&single)return await remove(request,env,single[1]);
    if(request.method==='GET'&&single){const r=await env.DB.prepare('SELECT public_json FROM matches WHERE id=? AND deleted=0').bind(single[1]).first();return r?json(JSON.parse(r.public_json)):json({error:'对局不存在或已撤回'},404);}
    if(request.method==='GET'&&path==='/api/matches'){
      const page=Math.max(1,Math.min(100000,Number.parseInt(url.searchParams.get('page'))||1)),limit=20;
      const results=await env.DB.batch([env.DB.prepare('SELECT COUNT(*) AS total FROM matches WHERE deleted=0'),env.DB.prepare('SELECT public_json FROM matches WHERE deleted=0 ORDER BY received_at DESC,id DESC LIMIT ? OFFSET ?').bind(limit,(page-1)*limit)]);
      return json({records:results[1].results.map(r=>JSON.parse(r.public_json)),total:results[0].results[0].total,page,pageSize:limit,updatedAt:new Date().toISOString()});
    }
    if(request.method==='GET'&&path==='/api/stats'){
      const rows=await env.DB.prepare('SELECT public_json FROM matches WHERE deleted=0').all();
      const filters={mapId:url.searchParams.get('map')||'',ruleId:url.searchParams.get('rule')||'',matchType:url.searchParams.get('type')||'normal',family:url.searchParams.get('family')==='1'};
      return json({...statistics(rows.results.map(r=>JSON.parse(r.public_json)),filters),filters,updatedAt:new Date().toISOString()});
    }
    return json({error:'接口不存在'},404);
  }catch(error){return json({error:error.status?error.message:'服务暂时不可用，请稍后重试'},error.status||503);}
}};
