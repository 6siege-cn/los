import {chartSummary} from './model.js?v=history-1';
import {el} from '../operator-selection/src/match-card.js?v=winner-theme-1';
import {assets} from '../operator-selection/src/config.js';
export const percentage=value=>value===null?'—':(value*100).toFixed(1)+'%';
const svgNS='http://www.w3.org/2000/svg';
const versionLabel=row=>row.version==='family'?'同名合并':row.version==='legacy'?'历史版本':row.version.toUpperCase();
function svg(tag,attributes){const node=document.createElementNS(svgNS,tag);for(const [key,value] of Object.entries(attributes))node.setAttribute(key,value);return node;}
export function renderChart(rows,side,xMax){
  const summary=chartSummary(rows),card=el('article','scatter-card'),head=el('header','scatter-heading'),name=side==='attack'?'进攻方':'防守方';
  card.dataset.side=side;head.append(el('h2','',name+'干员'),el('span','',`${summary.rows.length} 名 · 出场率 / 胜率`));card.append(head);
  const legend=el('p','scatter-legend',summary.rows.length?`虚线均值：出场率 ${percentage(summary.meanPick)} · 胜率 ${percentage(summary.meanWin)}`:'等待有效对局数据');card.append(legend);
  const frame=el('div','scatter-frame'),plot=el('div','scatter-plot'),grid=svg('svg',{viewBox:'0 0 100 100',preserveAspectRatio:'none','aria-hidden':'true'});grid.classList.add('scatter-grid');
  for(let i=0;i<=5;i++){
    const p=i*20;grid.append(svg('line',{x1:p,x2:p,y1:0,y2:100,class:'grid-line'}),svg('line',{x1:0,x2:100,y1:p,y2:p,class:'grid-line'}));
    const x=el('span','scatter-x-tick',Math.round(xMax*i/5*100)+'%');x.style.left=p+'%';plot.append(x);
    const y=el('span','scatter-y-tick',(100-p)+'%');y.style.top=p+'%';plot.append(y);
  }
  if(summary.meanPick!==null)grid.append(svg('line',{x1:summary.meanPick/xMax*100,x2:summary.meanPick/xMax*100,y1:0,y2:100,class:'average-line'}),svg('line',{x1:0,x2:100,y1:(1-summary.meanWin)*100,y2:(1-summary.meanWin)*100,class:'average-line'}));
  plot.append(grid);frame.append(el('span','scatter-y-title','胜率'),plot,el('span','scatter-x-title','出场率'));card.append(frame);
  const inspector=el('div','scatter-inspector');inspector.setAttribute('aria-live','polite');inspector.append(el('p','',summary.rows.length?'悬停或点按徽标查看样本；重叠时可选择干员。':'当前筛选下没有有出场记录的干员。'));card.append(inspector);
  const targets=[];
  function inspect(row){
    for(const [op,b] of targets)b.setAttribute('aria-pressed',String(op.id===row.id));
    inspector.replaceChildren();const label=row.name+' · '+versionLabel(row);
    inspector.append(el('strong','',label),el('p','',`出场 ${row.picks} 次 · 获胜 ${row.wins} 次 · 统计分母 ${row.eligible} 局`),el('p','',`出场率 ${percentage(row.pickRate)} · 胜率 ${percentage(row.winRate)} · 禁用 ${row.bans} 次（${percentage(row.banRate)}，分母 ${row.banEligible} 局） · BP率 ${percentage(row.bpRate)}`));
    if(row.picks<5)inspector.append(el('p','sample-warning','样本少于 5 次，仅供参考。'));
    const rect=plot.getBoundingClientRect(),near=summary.rows.filter(op=>Math.abs(op.pickRate-row.pickRate)/xMax*rect.width<38&&Math.abs(op.winRate-row.winRate)*rect.height<38);
    if(near.length>1){const list=el('div','overlap-options');list.append(el('span','','附近干员：'));for(const op of near){const b=el('button','',op.name+' · '+versionLabel(op));b.type='button';b.setAttribute('aria-pressed',String(op.id===row.id));b.addEventListener('click',()=>inspect(op));list.append(b);}inspector.append(list);}
  }
  for(const row of summary.rows){
    const point=el('button','scatter-point');point.type='button';point.style.left=row.pickRate/xMax*100+'%';point.style.top=(1-row.winRate)*100+'%';point.dataset.sample=row.picks<5?'low':'normal';point.setAttribute('aria-label',`${row.name} ${versionLabel(row)}，出场 ${row.picks} 次，胜率 ${percentage(row.winRate)}`);point.setAttribute('aria-pressed','false');
    if(row.avatar){const img=el('img');img.src=assets.avatarURL(row.avatar);img.alt='';img.loading='lazy';point.append(img);}else point.append(el('span','historical-initials',row.name.slice(0,3)));
    if(!['off','family'].includes(row.version))point.append(el('span','point-version',row.version==='legacy'?'历史':row.version.toUpperCase()));
    point.addEventListener('click',()=>inspect(row));point.addEventListener('mouseenter',()=>inspect(row));point.addEventListener('focus',()=>inspect(row));targets.push([row,point]);plot.append(point);
  }
  if(!summary.rows.length)plot.append(el('div','scatter-empty','暂无数据'));
  return card;
}
