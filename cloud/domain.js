import operators from '../operator-selection/data/operators.js';
import {rules} from '../operator-selection/src/rules.js';
import {createDraft} from '../operator-selection/src/engine.js';
import {validateMatch} from '../operator-selection/src/match-records.js';
import {operatorFamily} from '../operator-selection/src/identity.js';

export const matchTypes={normal:'普通',teaching:'教学',test:'测试',incomplete:'数据不完整'};
export const catalog=operators.map(({id,name,side,version,avatar,familyId})=>({id,name,side,version,avatar,...(familyId?{familyId}:{})}));
const byId=new Map(catalog.map(op=>[op.id,op]));
export const beijingDay=(date=new Date())=>new Date(+date+8*3600000).toISOString().slice(0,10);
export async function digest(text){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export function fingerprint(record){
  return JSON.stringify([record.mapId,record.mode,record.ruleId,...['picks','bans'].flatMap(kind=>['attack','defense'].map(side=>[...record[kind][side]].sort())),record.winner]);
}
export function cleanRecord(input){
  if(!input||!Object.hasOwn(rules,input.ruleId)||!Object.hasOwn(matchTypes,input.matchType)||!Array.isArray(input.history)||input.history.length>20)throw Error('无效的对局规则或类型');
  if(typeof input.scope?.alt!=='boolean'||typeof input.scope?.diy!=='boolean')throw Error('无效的干员范围');
  const available=operators.filter(op=>op.version==='off'||input.scope[op.version]===true);
  const draft=createDraft(rules[input.ruleId],available);
  for(const event of input.history){
    if(!event||!draft.choose(event.operatorId))throw Error('选禁阵容不符合规则');
    const actual=draft.snapshot().history.at(-1);
    if(['side','type','round','target'].some(key=>actual[key]!==event[key]))throw Error('选禁顺序不符合规则');
  }
  const state=draft.snapshot();if(!state.complete)throw Error('对局选禁未完成');
  const used=new Set(state.history.map(e=>e.operatorId));
  const record=validateMatch({version:2,id:input.id,savedAt:input.savedAt,ruleId:input.ruleId,rule:{name:rules[input.ruleId].name},scope:{alt:input.scope.alt,diy:input.scope.diy},orderMode:input.orderMode==='time'?'time':'side',history:state.history,picks:state.picks,bans:state.bans,operators:catalog.filter(op=>used.has(op.id)),mapId:input.mapId,mode:input.mode,winner:input.winner,ending:input.ending,endRound:input.endRound,marks:{},tags:[],matchType:input.matchType});
  if(JSON.stringify(input.picks)!==JSON.stringify(record.picks)||JSON.stringify(input.bans)!==JSON.stringify(record.bans))throw Error('阵容与选禁记录不一致');
  const plain=(value,max)=>{if(value===undefined)return '';if(typeof value!=='string'||value.length>max)throw Error('昵称或备注过长');return value.normalize('NFKC').trim();};
  return {record,privateData:{players:{attack:plain(input.players?.attack,40),defense:plain(input.players?.defense,40)},notes:plain(input.notes,1000)}};
}
export function statistics(records,{mapId='',ruleId='',matchType='normal',family=false}={}){
  const selected=records.filter(r=>(!mapId||r.mapId===mapId)&&(!ruleId||r.ruleId===ruleId)&&(matchType==='all'||r.matchType===matchType));
  const rows=new Map(),maps=new Map();
  for(const op of catalog){const key=family?operatorFamily(op):op.id;if(!rows.has(key))rows.set(key,{id:key,name:op.name,side:op.side,version:family?'family':op.version,picks:0,wins:0,bans:0,eligible:0});}
  let attackWins=0;
  for(const r of selected){
    if(r.winner==='attack')attackWins++;
    const map=maps.get(r.mapId)??{id:r.mapId,total:0,attackWins:0};map.total++;map.attackWins+=Number(r.winner==='attack');maps.set(r.mapId,map);
    const eligible=new Set(catalog.filter(op=>op.version==='off'||r.scope[op.version]).map(op=>family?operatorFamily(op):op.id));
    for(const key of eligible)rows.get(key).eligible++;
    for(const side of ['attack','defense']){
      for(const id of r.picks[side]){const op=byId.get(id),row=rows.get(family?operatorFamily(op):id);row.picks++;row.wins+=Number(side===r.winner);}
      // Stored ban sides identify the actor, not the banned operator's faction.
      for(const id of r.bans[side]){const op=byId.get(id);rows.get(family?operatorFamily(op):id).bans++;}
    }
  }
  const rate=(n,d)=>d?n/d:null;
  return {total:selected.length,attackWins,defenseWins:selected.length-attackWins,attackWinRate:rate(attackWins,selected.length),operators:[...rows.values()].map(r=>({...r,winRate:rate(r.wins,r.picks),pickRate:rate(r.picks,r.eligible),banRate:rate(r.bans,r.eligible),bpRate:rate(r.picks+r.bans,r.eligible)})),maps:[...maps.values()].map(m=>({...m,defenseWins:m.total-m.attackWins,attackWinRate:rate(m.attackWins,m.total),share:rate(m.total,selected.length)}))};
}
