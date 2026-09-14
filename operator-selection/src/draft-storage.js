import {createDraft} from './engine.js';
import {inScope} from './operator-scope.js';
export const storageKey='six-siege-los:operator-draft:v1';
const dataSignature=op=>JSON.stringify([op.id,op.name,op.version,op.side,op.hp,op.close,op.medium,op.long,op.destruction,op.skill]);
export function captureDraft({ruleId,rule,scope,orderMode,activeSide,draft,operators}){
  const history=draft.snapshot().history;
  return {version:1,ruleId,ruleSignature:JSON.stringify(rule),scope:{...scope},orderMode,activeSide,
    history,operatorSignatures:history.map(event=>dataSignature(operators.find(op=>op.id===event.operatorId)))};
}
export function restoreDraft(record,{rules,orderModes,operators}){
  if(!record||record.version!==1||!Object.hasOwn(rules,record.ruleId)||record.ruleSignature!==JSON.stringify(rules[record.ruleId])||
    !Object.hasOwn(orderModes,record.orderMode)||!['attack','defense'].includes(record.activeSide)||
    typeof record.scope?.alt!=='boolean'||typeof record.scope?.diy!=='boolean'||!Array.isArray(record.history)||
    !Array.isArray(record.operatorSignatures)||record.history.length!==record.operatorSignatures.length)throw Error('保存记录格式或规则已变化');
  const draft=createDraft(rules[record.ruleId],operators.filter(op=>inScope(op,record.scope)));
  if(record.history.length>draft.snapshot().steps.length)throw Error('选禁历史长度无效');
  for(const [i,event] of record.history.entries()){
    const op=operators.find(op=>op.id===event?.operatorId);
    if(!op||record.operatorSignatures[i]!==dataSignature(op)||!draft.choose(op.id))throw Error('干员数据或选禁历史已变化');
    const actual=draft.snapshot().history.at(-1);
    if(Object.keys(actual).some(key=>actual[key]!==event[key]))throw Error('选禁轮次不匹配');
  }
  return {draft,ruleId:record.ruleId,scope:{...record.scope},orderMode:record.orderMode,activeSide:record.activeSide};
}

// Compare before writing. Web Locks serializes competing pages where supported.
export function createDraftStorage({storage,locks,onConflict=()=>{},onError=()=>{}}){
  let expected=null,blocked=false,queue=Promise.resolve();
  function read(){expected=storage.getItem(storageKey);return expected===null?null:JSON.parse(expected);}
  function check(){
    if(blocked)return false;
    if(storage.getItem(storageKey)!==expected){blocked=true;onConflict();return false;}
    return true;
  }
  function save(record){
    const next=record===null?null:JSON.stringify(record);
    const write=()=>{
      if(!check())return false;
      if(next===expected)return true;
      if(next===null)storage.removeItem(storageKey);else storage.setItem(storageKey,next);
      expected=next;return true;
    };
    queue=queue.then(()=>locks?.request?locks.request(storageKey,write):write()).catch(error=>{blocked=true;onError(error);return false;});
    return queue;
  }
  return {read,save,check:()=>{try{return check();}catch(error){blocked=true;onError(error);return false;}}};
}
