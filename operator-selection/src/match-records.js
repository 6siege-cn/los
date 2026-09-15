import {mapNames} from '../../scripts/map-names.js';
export {mapNames};
export const modes=Object.freeze(['炸弹模式','人质模式','肃清威胁']);
export const mapLabel=record=>mapNames[record.mapId]||(record.version===1?'地图未记录':'地图待选');
export const modeLabel=record=>record.mode||(record.version===1?'模式未记录':'模式待选');
export const presetTags=Object.freeze(['RUSH','偷人','好运','超时','白给']);
export const marks=Object.freeze({'thumbs-up':'向上大拇指','thumbs-down':'向下大拇指',skull:'骷髅头',crosshair:'瞄准准星'});
export const sideLabels=Object.freeze({attack:'进攻方',defense:'防守方'});
export const endings=Object.freeze(['拆除炸弹','歼灭敌方','对手投降','解救人质','时间用尽','计分获胜']);
export const endRounds=Object.freeze(['1','2','3','4','5','+']);
export const normalizeTag=value=>String(value).normalize('NFKC').trim().replace(/\s+/g,' ');
export const tagKey=value=>normalizeTag(value).toLocaleLowerCase();
export function uniqueTags(values){
  const seen=new Set();return values.map(normalizeTag).filter(value=>{const key=tagKey(value);if(!value||seen.has(key))return false;if(value.length>24)throw Error('标签最多 24 个字符');seen.add(key);return true;});
}
export function snapshotMatch({state,ruleId,rule,scope,orderMode,operators},id,date){
  if(!state.complete||Object.values(state.picks).some(ids=>ids.length!==5))throw Error('完成十名干员的选禁后才能保存对局');
  const ids=new Set(state.history.map(event=>event.operatorId));
  return structuredClone({version:2,id,savedAt:date,ruleId,rule,scope,orderMode,history:state.history,picks:state.picks,bans:state.bans,
    operators:operators.filter(op=>ids.has(op.id)),mapId:'',mode:'',winner:'',ending:'',endRound:'',marks:{},tags:[]});
}
export function validateMatch(record){
  if(!record||![1,2].includes(record.version)||typeof record.id!=='string'||!record.id||!Number.isFinite(Date.parse(record.savedAt))||
    !Object.hasOwn(sideLabels,record.winner)||!endings.includes(record.ending)||!endRounds.includes(record.endRound))throw Error('请选择获胜方、结束方式和结束回合');
  if((record.version===2||record.mapId!==undefined)&&!Object.hasOwn(mapNames,record.mapId))throw Error('请选择地图');
  if((record.version===2||record.mode!==undefined)&&!modes.includes(record.mode))throw Error('请选择模式');
  if(!Array.isArray(record.history)||!Array.isArray(record.operators)||!record.rule?.name||typeof record.scope?.alt!=='boolean'||typeof record.scope?.diy!=='boolean')throw Error('对局数据不完整');
  const selected=[];
  for(const side of Object.keys(sideLabels)){
    if(!Array.isArray(record.picks?.[side])||record.picks[side].length!==5||!Array.isArray(record.bans?.[side]))throw Error('对局阵容不完整');
    for(const type of ['pick','ban']){
      const ids=record[type==='pick'?'picks':'bans'][side];
      if(JSON.stringify(ids)!==JSON.stringify(record.history.filter(e=>e.side===side&&e.type===type).map(e=>e.operatorId)))throw Error('对局历史不匹配');
      for(const id of ids)if(!record.operators.some(op=>op.id===id))throw Error('缺少历史干员数据');
    }
    selected.push(...record.picks[side]);
  }
  if(new Set(record.history.map(e=>e.operatorId)).size!==record.history.length)throw Error('对局含重复干员');
  for(const [id,mark] of Object.entries(record.marks??{}))if(!selected.includes(id)||!Object.hasOwn(marks,mark))throw Error('干员标记无效');
  const tags=uniqueTags(record.tags??[]);if(tags.length>20)throw Error('每局最多 20 个标签');
  return structuredClone({...record,tags});
}
export const scopeLabel=scope=>['OFF',...(scope.alt?['ALT']:[]),...(scope.diy?['DIY']:[])].join(' / ');
export const operatorLabel=op=>op.name+(op.version&&op.version!=='off'?' · '+op.version.toUpperCase():'');
export const historyLabel=(record,event,index)=>`${String(index+1).padStart(2,'0')} · ${sideLabels[event.side]}${event.type==='pick'?'选择':'禁用'} ${operatorLabel(record.operators.find(op=>op.id===event.operatorId))}`;

// Separate database from the current draft. Saving a record and its tag library is atomic.
export function createMatchStore(indexedDB){
  let database;
  function open(){return database??=new Promise((resolve,reject)=>{
    if(!indexedDB){reject(Error('浏览器不支持本地对局存储'));return;}
    const request=indexedDB.open('six-siege-los-match-records',1);
    request.onupgradeneeded=()=>{const db=request.result;db.createObjectStore('matches',{keyPath:'id'});db.createObjectStore('tags',{keyPath:'key'});};
    request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();resolve(db);};
    request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('请关闭其他旧页面后重试'));
  });}
  async function list(store){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(store),request=tx.objectStore(store).getAll();tx.oncomplete=()=>resolve(request.result);tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);});}
  return {
    async records(){return (await list('matches')).sort((a,b)=>b.savedAt.localeCompare(a.savedAt)||b.id.localeCompare(a.id));},
    async tags(){return uniqueTags([...presetTags,...(await list('tags')).map(tag=>tag.label)]);},
    async save(value){const record=validateMatch(value),db=await open();return new Promise((resolve,reject)=>{
      const tx=db.transaction(['matches','tags'],'readwrite');tx.objectStore('matches').add(record);
      for(const label of record.tags)tx.objectStore('tags').put({key:tagKey(label),label});
      tx.oncomplete=()=>resolve(record);tx.onabort=()=>reject(tx.error??Error('保存失败'));tx.onerror=()=>reject(tx.error);
    });}
  };
}
