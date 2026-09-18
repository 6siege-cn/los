export const API=['localhost','127.0.0.1'].includes(globalThis.location?.hostname)?location.origin:'https://six-siege-api.rainlef.workers.dev';
export const syncLabels={pending:'将在联网时自动提交',uploaded:'已提交至社区',duplicate:'社区已有相同对局，未重复计数',quota:'当天提交额度已满，仅保留本地',removed:'相同云端对局已撤回',deleted:'云端已撤回',invalid:'未通过云端校验，仅保留本地'};
export function uploadPayload(record){return Object.fromEntries(['id','savedAt','ruleId','scope','orderMode','history','picks','bans','mapId','mode','winner','ending','endRound','players','notes','matchType'].map(key=>[key,record[key]]));}
export async function drainOutbox(store,{fetcher=fetch,now=Date.now}={}){
  // Process withdrawals first so that an upload backlog never delays deletion.
  const jobs=(await store.pending()).sort((a,b)=>Number(b.action==='delete')-Number(a.action==='delete'));
  for(const job of jobs){
    if(job.nextAt>now())continue;
    try{
      const response=await fetcher(API+'/api/matches'+(job.action==='delete'?'/'+job.id:''),{method:job.action==='delete'?'DELETE':'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+job.token},body:job.action==='upload'?JSON.stringify(uploadPayload(job.record)):undefined,signal:AbortSignal.timeout(15000)});
      if(!response.ok){if(job.action==='upload'&&[400,403,413,415].includes(response.status)){await store.settle(job,{status:'invalid'});continue;}throw Error('Retry');}
      const result=await response.json();
      if(!['uploaded','duplicate','quota','removed','deleted'].includes(result.status))throw Error('Unexpected response');
      await store.settle(job,{status:result.status});
    }catch{await store.settle(job,{status:'pending',retryAt:now()+Math.min(3600000,15000*2**Math.min(job.attempts,8))});}
  }
}
export function startMatchSync(store){
  let running=false;
  const sync=async()=>{if(running||navigator.onLine===false)return;running=true;
    try{if(navigator.locks)await navigator.locks.request('six-siege-match-sync',{ifAvailable:true},lock=>lock?drainOutbox(store):undefined);else await drainOutbox(store);}catch{/* Local storage errors are displayed by the record UI. */}finally{running=false;}
  };
  window.addEventListener('online',sync);document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});
  setInterval(()=>{if(!document.hidden)sync();},30000);void sync();return sync;
}
