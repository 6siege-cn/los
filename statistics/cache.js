export const CACHE_KEY='six-siege:statistics-snapshot:v1';
export const FRESH_MS=30*60*1000,COOLDOWN_MS=5*60*1000;
export function validSnapshot(value){const count=n=>Number.isSafeInteger(n)&&n>=0;return value?.schemaVersion===1&&count(value.revision)&&Number.isFinite(Date.parse(value.generatedAt))&&Number.isFinite(Date.parse(value.checkedAt))&&Array.isArray(value.catalog)&&value.catalog.every(op=>typeof op.id==='string'&&typeof op.name==='string'&&typeof op.avatar==='string'&&['attack','defense'].includes(op.side)&&['off','alt','diy'].includes(op.version))&&Array.isArray(value.buckets)&&value.buckets.every(b=>Array.isArray(b.key)&&b.key.length===6&&count(b.total)&&count(b.attackWins)&&b.attackWins<=b.total&&b.operators&&typeof b.operators==='object'&&Object.values(b.operators).every(c=>Array.isArray(c)&&c.length===3&&c.every(count)));}
export function createSnapshotClient({storage,fetcher=fetch,now=Date.now,locks=globalThis.navigator?.locks,url='https://six-siege-api.rainlef.workers.dev/api/stats-snapshot'}={}){
  let memory={},pending;
  function read(){try{const saved=JSON.parse(storage?.getItem(CACHE_KEY)||'null');if(saved&&typeof saved==='object')memory=saved;}catch{}return memory;}
  function write(value){memory=value;try{storage?.setItem(CACHE_KEY,JSON.stringify(value));}catch{}}
  function peek(){const saved=read();return validSnapshot(saved.data)?saved.data:null;}
  async function run(force){
    const saved=read(),data=validSnapshot(saved.data)?saved.data:null,time=now();
    const age=time-(saved.fetchedAt??0),sinceAttempt=time-(saved.lastAttemptAt??0);
    const cooldownUntil=(saved.lastAttemptAt??0)+COOLDOWN_MS;
    if((data&&!force&&age>=0&&age<FRESH_MS)||(Number.isFinite(saved.lastAttemptAt)&&sinceAttempt>=0&&sinceAttempt<COOLDOWN_MS))return {data,cached:true,cooldownUntil,error:data?null:'暂时无法获取统计，请稍后再试。'};
    write({...saved,data,lastAttemptAt:time});
    try{
      const response=await fetcher(url,{signal:AbortSignal.timeout(20000),cache:'no-cache'});
      if(!response.ok)throw Error('统计服务暂时不可用');const next=await response.json();if(!validSnapshot(next))throw Error('统计数据格式不兼容');
      write({data:next,fetchedAt:now(),lastAttemptAt:time});return {data:next,cached:false,cooldownUntil:time+COOLDOWN_MS,error:null};
    }catch{return {data,cached:true,cooldownUntil:time+COOLDOWN_MS,error:data?'连接暂时不可用，正在显示已保存的统计。':'暂时无法获取统计，请稍后再试。'};}
  }
  function load({force=false}={}){if(!pending)pending=(locks?locks.request('six-siege-statistics-fetch',()=>run(force)):run(force)).finally(()=>{pending=null;});return pending;}
  return {peek,load};
}
