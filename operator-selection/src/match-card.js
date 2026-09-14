import {sideLabels,scopeLabel,operatorLabel,historyLabel,marks} from './match-records.js';
export function el(tag,className='',text=''){const node=document.createElement(tag);node.className=className;node.textContent=text;return node;}
const dateLabel=record=>new Date(record.savedAt).toLocaleString('zh-CN',{hour12:false});
const resultLabel=record=>record.winner?`${sideLabels[record.winner]}获胜`:'待填写结果';
export function portrait(op,record,assets,editable=false){
  const box=el(editable?'button':'div','match-portrait');
  if(editable){box.type='button';box.dataset.markId=op.id;box.setAttribute('aria-label','标记 '+operatorLabel(op));box.setAttribute('aria-expanded','false');box.title='点击选择标记，再次选择当前标记即可取消';}
  const face=el('span','match-face'),img=el('img');img.src=assets.avatarURL(op.avatar);img.alt=op.name;img.draggable=false;face.append(img);
  if(op.version!=='off')face.append(el('span','match-version',op.version.toUpperCase()));
  if(record.marks[op.id]){const mark=el('img','match-mark');mark.src=assets.recordMarks[record.marks[op.id]];mark.alt=marks[record.marks[op.id]];face.append(mark);}
  box.append(face,el('span','match-name',op.name));return box;
}
export function renderMatchCard(record,assets,{editable=false}={}){
  const card=el('article','match-card');card.setAttribute('aria-label','对局卡片');
  const header=el('header','match-card-header');header.append(el('span','match-kicker','SIX SIEGE · 对局记录'),el('h2','',resultLabel(record)),el('time','',dateLabel(record)));
  if(record.winner)header.style.borderColor=`var(--${record.winner})`;
  const meta=el('div','match-meta');meta.append(el('span','',record.rule.name),el('span','','范围 '+scopeLabel(record.scope)),el('span','',record.ending||'结束方式待选'),el('span','',record.endRound?'结束回合 '+record.endRound:'结束回合待选'));
  card.append(header,meta);
  const teams=el('div','match-teams');
  for(const side of Object.keys(sideLabels)){
    const team=el('section','match-team');team.style.setProperty('--team-color',`var(--${side})`);team.append(el('h3','',sideLabels[side]));
    const picks=el('div','match-picks');for(const id of record.picks[side])picks.append(portrait(record.operators.find(op=>op.id===id),record,assets,editable));team.append(picks);
    team.append(el('h4','','禁用敌方'));
    const bans=el('div','match-bans');for(const id of record.bans[side])bans.append(portrait(record.operators.find(op=>op.id===id),record,assets));team.append(bans);teams.append(team);
  }
  card.append(teams);
  const tags=el('div','match-tags');for(const tag of record.tags)tags.append(el('span','match-tag',tag));if(!record.tags.length)tags.append(el('span','match-muted','未添加标签'));card.append(tags);
  const log=el('details','match-log');log.append(el('summary','',`选禁历史 · ${record.history.length} 次操作`));
  const list=el('ol');record.history.forEach((event,i)=>list.append(el('li','',historyLabel(record,event,i))));log.append(list);card.append(log);return card;
}
const imagePromises=new Map();
function loadImage(url){if(!url)return Promise.reject(Error('缺少头像素材'));if(!imagePromises.has(url))imagePromises.set(url,new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>{imagePromises.delete(url);reject(Error('图片加载失败，请联网后重试'));};image.src=url;}));return imagePromises.get(url);}
export async function matchPNG(record,assets){
  const pictures=new Map(await Promise.all(record.operators.map(async op=>[op.id,await loadImage(assets.avatarURL(op.avatar))])));
  const markerImages=new Map(await Promise.all([...new Set(Object.values(record.marks))].map(async key=>[key,await loadImage(assets.recordMarks[key])])));
  await document.fonts?.ready;
  const canvas=document.createElement('canvas');canvas.width=1200;
  let ctx=canvas.getContext('2d');ctx.font='22px "Microsoft YaHei", sans-serif';
  const tagRows=[[]];let tagWidth=0;
  for(const tag of record.tags){const w=ctx.measureText(tag).width+28;if(tagWidth+w>1104){tagRows.push([]);tagWidth=0;}tagRows.at(-1).push({tag,w});tagWidth+=w+10;}
  canvas.height=720+tagRows.length*42+Math.ceil(record.history.length/2)*32;
  ctx=canvas.getContext('2d');const text=(s,x,y,size=22,color='#e6e6e6')=>{ctx.fillStyle=color;ctx.font=`${size}px "Microsoft YaHei", sans-serif`;ctx.fillText(s,x,y);};
  const rect=(x,y,w,h,fill)=>{ctx.fillStyle=fill;ctx.fillRect(x,y,w,h);};
  const colors={attack:'#009BCB',defense:'#E48B00'};
  rect(0,0,1200,canvas.height,'#10151a');rect(24,24,1152,canvas.height-48,'#171e25');
  rect(24,24,1152,5,colors[record.winner]||'#88949f');
  text('SIX SIEGE  /  对局记录',48,74,22,'#91a0ad');text(resultLabel(record),48,128,40);text(dateLabel(record),790,76,20,'#91a0ad');
  text(record.rule.name+'    范围 '+scopeLabel(record.scope),48,176,23);
  text(record.ending+'    结束回合 '+record.endRound,720,176,23);
  function drawPortrait(id,x,y,size){
    const op=record.operators.find(op=>op.id===id),image=pictures.get(id);rect(x,y,size,size,'#242d36');
    const ratio=Math.min((size-8)/image.width,(size-8)/image.height);ctx.drawImage(image,x+(size-image.width*ratio)/2,y+(size-image.height*ratio)/2,image.width*ratio,image.height*ratio);
    if(op.version!=='off'){rect(x,y+size-22,42,22,'#080c10');text(op.version.toUpperCase(),x+3,y+size-5,14);}
    if(record.marks[id]){rect(x+size-30,y+size-30,30,30,'#080c10');ctx.drawImage(markerImages.get(record.marks[id]),x+size-27,y+size-27,24,24);}
    // Fit long names without clipping or truncating them in exported cards.
    let font=17;ctx.font=`${font}px sans-serif`;while(ctx.measureText(op.name).width>size&&font>9){font--;ctx.font=`${font}px sans-serif`;}
    text(op.name,x,y+size+24,font);
  }
  for(const [i,side] of Object.keys(sideLabels).entries()){
    const x=48+i*576;rect(x,220,528,3,colors[side]);text(sideLabels[side],x,261,26,colors[side]);
    record.picks[side].forEach((id,j)=>drawPortrait(id,x+j*106,284,96));
    text('禁用敌方',x,446,19,'#91a0ad');record.bans[side].forEach((id,j)=>drawPortrait(id,x+j*106,466,70));
  }
  let y=606;for(const row of tagRows){let x=48;for(const {tag,w} of row){rect(x,y,w,32,'#303b45');text(tag,x+14,y+23,22);x+=w+10;}y+=42;}
  if(!record.tags.length)text('未添加标签',48,630,20,'#91a0ad');
  text('选禁历史',48,y+30,24);y+=66;
  record.history.forEach((event,i)=>text(historyLabel(record,event,i),48+(i%2)*576,y+Math.floor(i/2)*32,17));
  text('SIX SIEGE LOS · 本机对局记录',48,canvas.height-44,16,'#91a0ad');
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('无法生成图片')),'image/png'));
}
