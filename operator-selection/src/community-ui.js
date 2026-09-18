import {el,renderMatchCard} from './match-card.js?v=winner-theme-1';
import {mapNames,mapLabel,modeLabel,sideLabels,matchTypes} from './match-records.js';
import {API} from './match-sync.js';

const percent=value=>value===null?'—':(value*100).toFixed(1)+'%';
export function installCommunityViews({content,message,changeView,isCurrent,button,assets}){
  async function get(path){const response=await fetch(API+path,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('暂时无法读取社区数据');return response.json();}
  function error(token,retry){if(!isCurrent(token))return;message('社区暂时无法连接，本地对局仍可正常使用。');content.append(button('重新加载',retry));}
  function table(labels,rows){const wrap=el('div','community-table-wrap'),table=el('table','community-table'),head=el('thead'),tr=el('tr');for(const label of labels){const th=el('th','',label);th.scope='col';tr.append(th);}head.append(tr);const body=el('tbody');for(const cells of rows){const row=el('tr');for(const value of cells){const td=el('td');if(value instanceof Node)td.append(value);else td.textContent=String(value);row.append(td);}body.append(row);}table.append(head,body);wrap.append(table);return wrap;}
  async function matches(page=1){
    const token=changeView('公开对局');message('正在读取公开对局…');
    try{const data=await get('/api/matches?page='+page);if(!isCurrent(token))return;
      message(`共 ${data.total} 局 · 更新于 ${new Date(data.updatedAt).toLocaleString('zh-CN')} · 昵称与备注不公开`);
      if(!data.records.length)content.append(el('p','match-empty','还没有公开对局。'));
      const list=el('div','match-history-list');for(const record of data.records){const item=el('article','match-history-item');item.dataset.winner=record.winner;item.append(el('strong','',`${sideLabels[record.winner]}获胜 · ${record.rule.name}`),el('span','',new Date(record.savedAt).toLocaleString('zh-CN')),el('p','',`${mapLabel(record)} · ${modeLabel(record)} · ${matchTypes[record.matchType]}`),button('查看对局',()=>detail(record.id,page)));list.append(item);}content.append(list);
      const pages=el('div','match-actions'),prev=button('上一页',()=>matches(page-1)),next=button('下一页',()=>matches(page+1));prev.disabled=page===1;next.disabled=page*data.pageSize>=data.total;pages.append(prev,el('span','',`第 ${page} / ${Math.max(1,Math.ceil(data.total/data.pageSize))} 页`),next);content.append(pages);
    }catch{error(token,()=>matches(page));}
  }
  async function detail(id,page){const token=changeView('公开对局详情');message('正在读取…');try{const record=await get('/api/matches/'+id);if(!isCurrent(token))return;message(`${matchTypes[record.matchType]} · ${new Date(record.savedAt).toLocaleString('zh-CN')}`);content.append(renderMatchCard(record,assets),button('返回公开对局',()=>matches(page)));}catch{if(isCurrent(token)){message('无法读取该对局，可能已被上传者撤回。');content.append(button('返回公开对局',()=>matches(page)));}}}
  function stats(){
    const token=changeView('社区统计'),filters=el('div','match-fields community-filters'),result=el('div');content.append(filters,result);
    function select(label,items,value){const wrap=el('label','match-field'),input=el('select');input.setAttribute('aria-label',label);for(const [id,text] of items){const option=el('option','',text);option.value=id;input.append(option);}input.value=value;wrap.append(el('span','',label),input);filters.append(wrap);return input;}
    const map=select('统计地图',[['','全部地图'],...Object.entries(mapNames)],''),rule=select('统计规则',[['','全部规则'],['standard','标准规则'],['fiveBan','5ban']],''),type=select('统计类型',[...Object.entries(matchTypes),['all','全部类型']],'normal'),group=select('干员合并',[['0','按版本分别统计'],['1','同名干员合并']],'0');
    const side=select('干员阵营',[['attack','进攻'],['defense','防守']],'attack'),version=select('干员版本',[['','全部版本'],['off','OFF'],['alt','ALT'],['diy','DIY']],''),minimum=select('最低出场次数',[['0','全部样本'],['1','至少 1 次'],['5','至少 5 次'],['10','至少 10 次'],['20','至少 20 次']],'1'),sort=select('干员排序',[['picks','出场次数'],['wins','获胜次数'],['winRate','胜率'],['bans','禁用次数'],['banRate','禁用率'],['bpRate','BP率']],'picks');
    let data,requestId=0,operatorPage=1;
    function draw(){
      if(!data||!isCurrent(token))return;result.replaceChildren();
      const overview=el('div','community-summary');for(const [label,value] of [['有效对局',data.total],['进攻胜率',percent(data.attackWinRate)],['防守胜率',percent(data.total?data.defenseWins/data.total:null)]]){const tile=el('div');tile.append(el('span','',label),el('strong','',String(value)));overview.append(tile);}result.append(overview);
      result.append(el('p','match-muted',`当前范围：${mapNames[map.value]||'全部地图'} · ${rule.selectedOptions[0].textContent} · ${type.selectedOptions[0].textContent}。${data.total} 局，进攻 ${data.attackWins} 胜／防守 ${data.defenseWins} 胜。`));
      result.append(el('h3','','地图统计'));
      result.append(table(['地图','局数','使用占比','进攻胜率','防守胜率'],data.maps.map(m=>[button(mapNames[m.id],()=>{map.value=m.id;void load();}),m.total,percent(m.share),percent(m.attackWinRate),percent(m.total?m.defenseWins/m.total:null)])));
      result.append(el('h3','',map.value?mapNames[map.value]+' · 干员表现':'干员统计'));
      result.append(el('p','match-muted','胜率以出场数为分母；禁用率和 BP率以干员可选范围内的对局数为分母。禁用按被禁干员阵营计数。同名合并后每局只计一次。'));
      const rows=data.operators.filter(op=>op.side===side.value&&(!version.value||op.version===version.value||group.value==='1')&&op.picks>=Number(minimum.value)).sort((a,b)=>(b[sort.value]??-1)-(a[sort.value]??-1)||b.picks-a.picks||a.name.localeCompare(b.name));
      const pages=Math.max(1,Math.ceil(rows.length/20));operatorPage=Math.min(operatorPage,pages);
      result.append(table(['干员','出场','获胜','胜率','禁用','禁用率','BP率','可选局数'],rows.slice((operatorPage-1)*20,operatorPage*20).map(op=>[op.name+(op.version==='family'?'':' · '+op.version.toUpperCase()),op.picks,op.wins,percent(op.winRate),op.bans,percent(op.banRate),percent(op.bpRate),op.eligible])));
      if(!rows.length)result.append(el('p','match-empty','当前筛选下没有足够的样本。'));
      const pagination=el('div','match-actions'),prev=button('上一页',()=>{operatorPage--;draw();}),next=button('下一页',()=>{operatorPage++;draw();});prev.disabled=operatorPage===1;next.disabled=operatorPage===pages;pagination.append(prev,el('span','',`第 ${operatorPage} / ${pages} 页`),next);result.append(pagination);
    }
    async function load(){const id=++requestId;data=null;result.replaceChildren();message('正在计算社区统计…');version.disabled=group.value==='1';
      try{const value=await get('/api/stats?'+new URLSearchParams({map:map.value,rule:rule.value,type:type.value,family:group.value}));if(!isCurrent(token)||id!==requestId)return;data=value;operatorPage=1;message('更新于 '+new Date(data.updatedAt).toLocaleString('zh-CN')+' · 删除云端对局后，重新加载即更新统计');draw();}
      catch{if(isCurrent(token)&&id===requestId){message('社区暂时无法连接，本地对局仍可正常使用。');result.append(button('重新加载',load));}}
    }
    for(const input of [map,rule,type,group])input.addEventListener('change',load);
    for(const input of [side,version,minimum,sort])input.addEventListener('change',()=>{operatorPage=1;draw();});
    void load();
  }
  return {stats,matches};
}
