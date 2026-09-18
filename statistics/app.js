import {createSnapshotClient} from './cache.js';
import {aggregateSnapshot} from './model.js';
import {renderChart,percentage} from './chart.js';
import {el} from '../operator-selection/src/match-card.js?v=winner-theme-1';
import {assets} from '../operator-selection/src/config.js';
import {mapNames,modes,matchTypes} from '../operator-selection/src/match-records.js?v=community-1';
import {installCommunityViews} from '../operator-selection/src/community-ui.js?v=statistics-2';

const content=document.querySelector('#statistics-content'),filters=document.querySelector('#statistics-filters'),status=document.querySelector('#statistics-status'),time=document.querySelector('#snapshot-time'),refresh=document.querySelector('#refresh-statistics');
let storage;try{storage=localStorage;}catch{}
const client=createSnapshotClient({storage,url:['localhost','127.0.0.1'].includes(location.hostname)?location.origin+'/api/stats-snapshot':undefined});
let snapshot=client.peek(),view='overview',viewToken=0,operatorPage=1,sortKey='picks',side='attack',cooldown=0,refreshTimer;
const controls={};
function button(label,action){const b=el('button','',label);b.type='button';b.addEventListener('click',action);return b;}
function select(key,label,items,initial){const wrap=el('label'),input=el('select');input.name=key;input.setAttribute('aria-label',label);for(const [value,text] of items){const option=el('option','',text);option.value=value;input.append(option);}input.value=initial;wrap.append(el('span','',label),input);filters.append(wrap);controls[key]=input;input.addEventListener('change',()=>{operatorPage=1;render();});}
select('mapId','地图',[['','全部地图'],...Object.entries(mapNames)],'');
select('ruleId','规则',[['','全部规则'],['standard','标准规则'],['fiveBan','5ban']],'');
select('mode','模式',[['','全部模式'],...modes.map(m=>[m,m])],'');
select('matchType','对局类型',Object.entries(matchTypes).concat([['all','全部类型']]),'normal');
select('version','干员版本',[['','全部版本'],['off','OFF'],['alt','ALT'],['diy','DIY']],'');
select('family','版本统计',[['0','分别统计'],['1','同名合并']],'0');
select('minimum','最低出场',[['1','至少 1 次'],['5','至少 5 次'],['10','至少 10 次'],['20','至少 20 次'],['0','全部干员']],'1');
function values(){return {...Object.fromEntries(Object.entries(controls).map(([key,input])=>[key,input.value])),family:controls.family.value==='1'};}
const publicViews=installCommunityViews({content,message:text=>{status.textContent=text;},button,assets,changeView:()=>{content.replaceChildren();status.textContent='';return ++viewToken;},isCurrent:token=>token===viewToken&&view==='matches'});
function activate(next){view=next;viewToken++;filters.hidden=view==='matches';for(const b of document.querySelectorAll('[data-view]')){if(b.dataset.view===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}history.replaceState(null,'','#'+view);if(view==='matches'){void publicViews.matches();}else{status.textContent='';render();}}
for(const b of document.querySelectorAll('[data-view]'))b.addEventListener('click',()=>activate(b.dataset.view));
function table(labels,rows){const wrap=el('div','community-table-wrap'),table=el('table','community-table'),head=el('thead'),tr=el('tr');for(const label of labels){const th=el('th','',label);th.scope='col';tr.append(th);}head.append(tr);const body=el('tbody');for(const cells of rows){const row=el('tr');for(const value of cells){const td=el('td');if(value instanceof Node)td.append(value);else td.textContent=String(value);row.append(td);}body.append(row);}table.append(head,body);wrap.append(table);return wrap;}
function render(){
  if(view==='matches')return;content.replaceChildren();
  if(!snapshot){content.append(el('p','match-empty','尚未载入统计数据。'));return;}
  const f=values(),data=aggregateSnapshot(snapshot,f),summary=el('section','statistics-summary');summary.setAttribute('aria-label','对局总览');
  const visible=data.operators.filter(op=>op.picks>=Number(f.minimum));
  for(const [label,value] of [['有效对局',data.total],['进攻胜率',percentage(data.attackWinRate)],['防守胜率',percentage(data.total?data.defenseWins/data.total:null)],['有出场的干员',visible.filter(op=>op.picks>0).length]]){const card=el('div');card.append(el('span','',label),el('strong','',String(value)));summary.append(card);}content.append(summary);
  const scope=el('p','statistics-scope',Object.values(controls).map(c=>c.selectedOptions[0].textContent).join(' · '));content.append(scope);
  if(view==='overview'){
    const maxPick=Math.max(.1,...visible.map(op=>op.pickRate??0)),xMax=Math.min(1,Math.max(.2,Math.ceil((maxPick+.04)*10)/10));
    const pair=el('div','chart-pair');for(const side of ['attack','defense'])pair.append(renderChart(visible.filter(op=>op.side===side),side,xMax));content.append(pair);
    content.append(el('p','statistics-scope','虚线为当前图中可见干员的算术平均值，与总览的阵营胜率不同。虚线边框表示出场不足 5 次。没有出场的干员不绘制胜率点。'));
    return;
  }
  content.append(el('h2','','地图表现'),table(['地图','对局','使用占比','进攻胜率','防守胜率'],data.maps.map(m=>[button(mapNames[m.id],()=>{controls.mapId.value=m.id;operatorPage=1;render();}),m.total,percentage(m.share),percentage(m.attackWinRate),percentage(m.total?m.defenseWins/m.total:null)])));
  content.append(el('h2','',f.mapId?mapNames[f.mapId]+' · 干员表现':'干员明细'));
  const toolbar=el('div','detail-toolbar');
  function field(label,items,value,change){const wrap=el('label'),input=el('select');input.setAttribute('aria-label',label);for(const [key,text] of items){const op=el('option','',text);op.value=key;input.append(op);}input.value=value;input.addEventListener('change',()=>{change(input.value);operatorPage=1;render();});wrap.append(el('span','',label),input);toolbar.append(wrap);}
  field('阵营',[['attack','进攻'],['defense','防守']],side,v=>side=v);field('排序',[['picks','出场数'],['pickRate','出场率'],['wins','获胜数'],['winRate','胜率'],['bans','禁用数'],['banRate','禁用率'],['bpRate','BP率']],sortKey,v=>sortKey=v);content.append(toolbar);
  const rows=visible.filter(op=>op.side===side).sort((a,b)=>(b[sortKey]??-1)-(a[sortKey]??-1)||b.picks-a.picks||a.name.localeCompare(b.name)),pages=Math.max(1,Math.ceil(rows.length/20));operatorPage=Math.min(operatorPage,pages);
  content.append(table(['干员','出场','出场率','获胜','胜率','禁用','禁用率','BP率','可选局数'],rows.slice((operatorPage-1)*20,operatorPage*20).map(op=>[op.name+(op.version==='family'?' · 合并':' · '+op.version.toUpperCase()),op.picks,percentage(op.pickRate),op.wins,percentage(op.winRate),op.bans,percentage(op.banRate),percentage(op.bpRate),op.eligible])));
  if(!rows.length)content.append(el('p','match-empty','当前筛选下没有足够的样本。'));
  const pager=el('div','match-actions'),prev=button('上一页',()=>{operatorPage--;render();}),next=button('下一页',()=>{operatorPage++;render();});prev.disabled=operatorPage===1;next.disabled=operatorPage===pages;pager.append(prev,el('span','',`第 ${operatorPage} / ${pages} 页`),next);content.append(pager);
  content.append(el('p','statistics-scope','胜率以出场数为分母；出场率、禁用率、BP率以干员可参与的有效对局为分母。同名版本先合并计数，再计算比例。'));
}
function updateTime(){time.textContent=snapshot?`数据生成于 ${new Date(snapshot.generatedAt).toLocaleString('zh-CN',{hour12:false})} · 最近核对 ${new Date(snapshot.checkedAt).toLocaleString('zh-CN',{hour12:false})}`:'暂无统计快照';}
function refreshState(){clearTimeout(refreshTimer);const remaining=cooldown-Date.now();refresh.disabled=remaining>0;refresh.textContent=remaining>0?'稍后可检查更新':'检查更新';refresh.title=remaining>0?'为减少请求，5 分钟内不重复检查。':'获取已发布的统计，不触发重新计算。';if(remaining>0)refreshTimer=setTimeout(refreshState,remaining+50);}
async function load(force=false){refresh.disabled=true;const result=await client.load({force});if(result.data)snapshot=result.data;cooldown=result.cooldownUntil;updateTime();render();if(view!=='matches'){status.textContent=result.error||(snapshot&&Date.now()-Date.parse(snapshot.checkedAt)>2*3600000?'统计更新暂有延迟，正在显示最近可用数据。':'统计每小时汇总；筛选和切换图表不产生请求。');}refreshState();}
refresh.addEventListener('click',()=>{void load(true);});
activate(['overview','details','matches'].includes(location.hash.slice(1))?location.hash.slice(1):'overview');updateTime();void load();
