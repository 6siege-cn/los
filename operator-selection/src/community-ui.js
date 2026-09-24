import {el,renderMatchCard} from './match-card.js?v=winner-theme-1';
import {mapNames,modes,endings,endRounds,mapLabel,modeLabel,sideLabels,matchTypes} from './match-records.js?v=community-1';
import {API} from './match-sync.js';
import {renderHistoricalCard,publicDateLabel} from './historical-card.js?v=history-1';

// Public records are deliberately separate from delayed aggregate snapshots.
export function installCommunityViews({content,message,changeView,isCurrent,button,assets}){
  let adminPassword='';
  async function request(path,options={}){
    const response=await fetch(API+path,{signal:AbortSignal.timeout(20000),cache:'no-store',...options});
    const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||'社区服务暂时不可用');return data;
  }
  const get=path=>request(path);
  function recordList(data,page,open,action='查看对局'){
    if(!data.records.length)content.append(el('p','match-empty','还没有公开对局。'));
    const list=el('div','match-history-list');for(const record of data.records){const item=el('article','match-history-item');item.dataset.winner=record.winner;item.append(el('strong','',`${sideLabels[record.winner]}获胜 · ${record.rule.name}`),el('span','',publicDateLabel(record)),el('p','',`${mapLabel(record)} · ${modeLabel(record)} · ${record.source?.kind==='xlsx'?'历史导入':matchTypes[record.matchType]}`),button(action,()=>open(record,page)));list.append(item);}content.append(list);
  }
  function pageControls(data,page,open){
    const controls=el('div','match-actions'),prev=button('上一页',()=>open(page-1)),next=button('下一页',()=>open(page+1));prev.disabled=page===1;next.disabled=page*data.pageSize>=data.total;controls.append(prev,el('span','',`第 ${page} / ${Math.max(1,Math.ceil(data.total/data.pageSize))} 页`),next);content.append(controls);
  }
  function adminEntry(){
    const form=el('form','admin-entry'),password=el('input');password.type='password';password.autocomplete='current-password';password.setAttribute('aria-label','管理员密码');
    const manage=button('管理',()=>{});manage.type='submit';form.append(password,manage);form.addEventListener('submit',event=>{event.preventDefault();adminPassword=password.value;void adminMatches();});content.append(form);
  }
  async function matches(page=1){
    const token=changeView('公开对局');message('正在读取公开对局…');
    try{const data=await get('/api/matches?page='+page);if(!isCurrent(token))return;
      message(`共 ${data.total} 局 · 昵称与备注不公开 · 公开列表与定时统计分开更新`);recordList(data,page,(record,current)=>detail(record.id,current));pageControls(data,page,matches);adminEntry();
    }catch{if(isCurrent(token)){message('社区暂时无法连接。');content.append(button('重新加载',()=>matches(page)));}}
  }
  async function detail(id,page){const token=changeView('公开对局详情');message('正在读取…');try{const record=await get('/api/matches/'+id);if(!isCurrent(token))return;message(`${record.source?.kind==='xlsx'?'历史导入':matchTypes[record.matchType]} · ${publicDateLabel(record)}`);content.append(record.source?.kind==='xlsx'?renderHistoricalCard(record,assets):renderMatchCard(record,assets),button('返回公开对局',()=>matches(page)));}catch{if(isCurrent(token)){message('无法读取该对局，可能已被上传者撤回。');content.append(button('返回公开对局',()=>matches(page)));}}}
  const adminHeaders=()=>({'Content-Type':'application/json',Authorization:'Bearer '+adminPassword});
  async function adminMatches(page=1){
    const token=changeView('对局管理');message('正在验证…');
    try{const data=await request('/api/admin/matches?page='+page,{headers:adminHeaders()});if(!isCurrent(token))return;
      message(`管理员模式 · 共 ${data.total} 局`);recordList(data,page,(record,current)=>adminEdit(record,current),'编辑');pageControls(data,page,adminMatches);content.append(button('退出管理',()=>{adminPassword='';void matches();}));
    }catch(error){adminPassword='';if(isCurrent(token)){message(error.message);adminEntry();content.append(button('返回公开对局',()=>matches()));}}
  }
  function adminEdit(record,page){
    changeView('编辑公开对局');message(record.id);content.append(record.source?.kind==='xlsx'?renderHistoricalCard(record,assets):renderMatchCard(record,assets));
    const form=el('form','match-form admin-form'),fields=el('div','match-fields'),draft=Object.fromEntries(['mapId','mode','winner','matchType',...(record.version===3?[]:['ending','endRound'])].map(key=>[key,record[key]]));
    function selectField(key,label,items){const wrapper=el('label','match-field'),select=el('select');select.name=key;for(const [value,text] of items){const option=el('option','',text);option.value=value;select.append(option);}select.value=record[key]??'';select.addEventListener('change',()=>{draft[key]=select.value||null;});wrapper.append(el('span','',label),select);fields.append(wrapper);}
    selectField('mapId','地图',Object.entries(mapNames));selectField('mode','模式',[...modes.map(value=>[value,value]),...(record.version===3?[['模式未记录','模式未记录']]:[])]);selectField('winner','获胜方',Object.entries(sideLabels));selectField('matchType','对局类型',Object.entries(matchTypes));
    if(record.version!==3){selectField('ending','结束方式',endings.map(value=>[value,value]));selectField('endRound','结束回合',endRounds.map(value=>[value,value]));}
    const actions=el('div','match-actions'),save=button('保存修改',()=>{}),remove=button('删除对局',()=>adminDelete(record,page));save.type='submit';actions.append(save,remove,button('取消',()=>adminMatches(page)));form.append(fields,actions);form.addEventListener('submit',async event=>{event.preventDefault();save.disabled=true;message('正在保存…');try{await request('/api/admin/matches/'+record.id,{method:'PATCH',headers:adminHeaders(),body:JSON.stringify(draft)});await adminMatches(page);}catch(error){save.disabled=false;message(error.message);}});content.append(form);
  }
  function adminDelete(record,page){
    changeView('删除公开对局');message(record.id);content.append(el('p','','确定要删除这条公开对局吗？删除后无法从管理界面恢复，昵称和备注也会一并清除。'));
    const actions=el('div','match-actions'),remove=button('确认删除',async()=>{remove.disabled=true;message('正在删除…');try{await request('/api/admin/matches/'+record.id,{method:'DELETE',headers:adminHeaders()});await adminMatches(page);}catch(error){remove.disabled=false;message(error.message);}});actions.append(remove,button('取消',()=>adminEdit(record,page)));content.append(actions);
  }
  return {matches,stats:()=>{location.href=new URL('../../statistics/',import.meta.url).href;}};
}
