import {el,renderMatchCard} from './match-card.js?v=winner-theme-1';
import {mapLabel,modeLabel,sideLabels,matchTypes} from './match-records.js?v=community-1';
import {API} from './match-sync.js';
import {renderHistoricalCard,publicDateLabel} from './historical-card.js?v=history-1';

// Public records are deliberately separate from delayed aggregate snapshots.
export function installCommunityViews({content,message,changeView,isCurrent,button,assets}){
  async function get(path){const response=await fetch(API+path,{signal:AbortSignal.timeout(20000),cache:'no-store'});if(!response.ok)throw Error('暂时无法读取社区数据');return response.json();}
  async function matches(page=1){
    const token=changeView('公开对局');message('正在读取公开对局…');
    try{const data=await get('/api/matches?page='+page);if(!isCurrent(token))return;
      message(`共 ${data.total} 局 · 昵称与备注不公开 · 公开列表与定时统计分开更新`);
      if(!data.records.length)content.append(el('p','match-empty','还没有公开对局。'));
      const list=el('div','match-history-list');for(const record of data.records){const item=el('article','match-history-item');item.dataset.winner=record.winner;item.append(el('strong','',`${sideLabels[record.winner]}获胜 · ${record.rule.name}`),el('span','',publicDateLabel(record)),el('p','',`${mapLabel(record)} · ${modeLabel(record)} · ${record.source?.kind==='xlsx'?'历史导入':matchTypes[record.matchType]}`),button('查看对局',()=>detail(record.id,page)));list.append(item);}content.append(list);
      const pages=el('div','match-actions'),prev=button('上一页',()=>matches(page-1)),next=button('下一页',()=>matches(page+1));prev.disabled=page===1;next.disabled=page*data.pageSize>=data.total;pages.append(prev,el('span','',`第 ${page} / ${Math.max(1,Math.ceil(data.total/data.pageSize))} 页`),next);content.append(pages);
    }catch{if(isCurrent(token)){message('社区暂时无法连接。');content.append(button('重新加载',()=>matches(page)));}}
  }
  async function detail(id,page){const token=changeView('公开对局详情');message('正在读取…');try{const record=await get('/api/matches/'+id);if(!isCurrent(token))return;message(`${record.source?.kind==='xlsx'?'历史导入':matchTypes[record.matchType]} · ${publicDateLabel(record)}`);content.append(record.source?.kind==='xlsx'?renderHistoricalCard(record,assets):renderMatchCard(record,assets),button('返回公开对局',()=>matches(page)));}catch{if(isCurrent(token)){message('无法读取该对局，可能已被上传者撤回。');content.append(button('返回公开对局',()=>matches(page)));}}}
  return {matches,stats:()=>{location.href=new URL('../../statistics/',import.meta.url).href;}};
}
