import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

export const DEFAULT_API='https://six-siege-api.rainlef.workers.dev';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const privateFields=new Set(['players','notes','private_json','owner_hash','ip_hash']);

async function readJSON(fetcher,url){
  const response=await fetcher(url,{headers:{Accept:'application/json'}});
  if(!response.ok)throw Error(`镜像源请求失败：${response.status} ${url}`);
  return response.json();
}

function validateRecord(record){
  if(!record||typeof record!=='object'||!uuid.test(record.id))throw Error('公开对局包含无效记录');
  for(const field of privateFields)if(Object.hasOwn(record,field))throw Error(`公开对局意外包含私密字段：${field}`);
}

async function saveJSON(path,value){await writeFile(path,JSON.stringify(value),'utf8');}

export async function buildCommunityMirror({output,fetcher=fetch,api=DEFAULT_API,now=()=>new Date()}={}){
  if(!output)throw Error('缺少镜像输出目录');
  const pagesDir=resolve(output,'pages'),matchesDir=resolve(output,'matches');
  await Promise.all([mkdir(pagesDir,{recursive:true}),mkdir(matchesDir,{recursive:true})]);

  const first=await readJSON(fetcher,`${api}/api/matches?page=1`);
  if(!Number.isInteger(first.total)||!Number.isInteger(first.pageSize)||first.pageSize<1||!Array.isArray(first.records))throw Error('公开对局列表格式无效');
  const pageCount=Math.max(1,Math.ceil(first.total/first.pageSize)),pages=[first];
  for(let page=2;page<=pageCount;page++)pages.push(await readJSON(fetcher,`${api}/api/matches?page=${page}`));

  const records=new Map();
  for(let index=0;index<pages.length;index++){
    const page=pages[index];
    if(page.total!==first.total||page.pageSize!==first.pageSize||!Array.isArray(page.records))throw Error('公开对局分页在镜像期间发生变化，请稍后重试');
    for(const record of page.records){validateRecord(record);if(records.has(record.id))throw Error(`公开对局编号重复：${record.id}`);records.set(record.id,record);}
    await saveJSON(resolve(pagesDir,`${index+1}.json`),page);
  }
  if(records.size!==first.total)throw Error(`公开对局数量不一致：期望 ${first.total}，实际 ${records.size}`);
  await Promise.all([...records].map(([id,record])=>saveJSON(resolve(matchesDir,`${id}.json`),record)));

  const snapshot=await readJSON(fetcher,`${api}/api/stats-snapshot`);
  if(snapshot?.schemaVersion!==2||!Array.isArray(snapshot.buckets))throw Error('统计快照格式无效');
  await saveJSON(resolve(output,'stats-snapshot.json'),snapshot);
  const manifest={generatedAt:now().toISOString(),total:first.total,pageSize:first.pageSize,pageCount,snapshotRevision:snapshot.revision};
  await saveJSON(resolve(output,'manifest.json'),manifest);
  return manifest;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const output=resolve(process.argv[2]||'site-dist/community-data');
  const manifest=await buildCommunityMirror({output});
  console.log(`社区公开镜像已生成：${manifest.total} 局，${manifest.pageCount} 页`);
}

