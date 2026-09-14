import operators from '../data/operators.js?v=overview-audit-2';
import {assets,settings} from './config.js?v=314fc524c626546c';
import {rules,actions} from './rules.js';
import {createDraft} from './engine.js';
import {operatorFamily,versionLabel} from './identity.js';
import {startImageCache} from './image-cache.js';
import {fitCatalogue} from './responsive-grid.js';
const rule=rules[settings.rule], draft=createDraft(rule,operators), byId=new Map(operators.map(op=>[op.id,op]));
const board=document.querySelector('.operator-board');
let activeSide='attack';
const scroll={attack:0,defense:0};
const sideName={attack:'进攻方',defense:'防守方'};
function node(tag,className='',text='') {const el=document.createElement(tag);el.className=className;el.textContent=text;return el;}
function icon(key) {
  const el=node('span','ui-icon');el.setAttribute('aria-hidden','true');
  el.style.setProperty('--icon-url', 'url("'+assets.icons[key].url+'")');
  el.style.transform='rotate('+assets.icons[key].rotation+'deg)';return el;
}
function picture(src,alt,className='') {const img=node('img',className);img.decoding='async';img.src=src;img.alt=alt;img.draggable=false;return img;}
function displayName(op){return op.name+(versionLabel(op)?'（'+versionLabel(op)+'）':'');}
function avatar(op){return picture(assets.avatarURL(op.avatar),displayName(op),'avatar');}
function appendVersion(el,op){if(versionLabel(op))el.append(node('span','variant',versionLabel(op)));}
function token(key){if(!assets.tokens[key])throw Error('未知素材 '+key);return picture(assets.tokens[key],key,'token');}
function card(op) {
  const el=node('div','info-card'), weapon=node('div','weapon-grid'), stats=node('div','stat-column');
  for(const [key,label] of [['close','近距离'],['medium','中距离'],['long','远距离']]){
    const line=node('div','dice-row');line.setAttribute('aria-label',label);
    if(op)for(const tokenKey of op[key])line.append(token(tokenKey));weapon.append(line);
  }
  for(const key of ['hp','destruction']){const slot=node('div','stat-slot');if(op)slot.append(token(op[key]));stats.append(slot);}
  el.append(weapon,stats);return el;
}
function renderTeam(side,state){
  const list=document.querySelector('.team-column--'+side+' .team-list');list.replaceChildren();
  for(let i=0;i<rule.teamSize;i++){
    const op=byId.get(state.picks[side][i]),row=node('article','team-row'),slot=node('div','operator-slot');
    if(op){slot.append(avatar(op));appendVersion(slot,op);slot.title=displayName(op); // The CSV owns the panel source.
      const link=node('a','panel-link');link.href=assets.panelURL(op.panel);link.target='_blank';link.rel='noopener';link.title='查看 '+op.name+' 干员面板';link.setAttribute('aria-label',link.title);link.append(slot);row.append(link);
    } else row.append(slot);
    row.append(card(op));list.append(row);
  }
  // Ban slots belong to the acting side; therefore contain enemy portraits.
  const banSlots=document.querySelector('.ban-side--'+side+' .ban-slots');banSlots.replaceChildren();
  const capacity=state.steps.filter(s=>s.side===side&&s.type==='ban').length;
  for(let i=0;i<capacity;i++){const slot=node('span','ban-slot');const op=byId.get(state.bans[side][i]);if(op){slot.append(avatar(op));slot.title=sideName[side]+'禁用 '+op.name;}banSlots.append(slot);}
}
const pool=document.querySelector('.operator-pool');pool.replaceChildren();
const tabs=node('div','side-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','干员阵营');
for(const side of ['attack','defense']){
  const button=node('button','side-tab');button.type='button';button.id='tab-'+side;button.dataset.side=side;button.setAttribute('role','tab');button.setAttribute('aria-label',sideName[side]);button.setAttribute('aria-controls','operator-list');button.title=sideName[side];button.append(icon(side));
  button.addEventListener('click',()=>switchSide(side));
  button.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();switchSide(e.key==='Home'?'attack':e.key==='End'?'defense':activeSide==='attack'?'defense':'attack');document.getElementById('tab-'+activeSide).focus();}});
  tabs.append(button);
}
const grid=node('div','operator-grid');grid.id='operator-list';grid.setAttribute('role','tabpanel');grid.tabIndex=0;pool.append(tabs,grid);
function switchSide(side){scroll[activeSide]=grid.scrollTop;activeSide=side;renderGrid(draft.snapshot());}
function renderGrid(state){
  for(const b of tabs.children){const selected=b.dataset.side===activeSide;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;}
  grid.setAttribute('aria-labelledby','tab-'+activeSide);grid.replaceChildren();
  for(const op of operators.filter(op=>op.side===activeSide)){
    const event=state.history.find(e=>operatorFamily(byId.get(e.operatorId))===operatorFamily(op)),button=node('button','operator-button');
    button.type='button';button.dataset.operatorId=op.id;button.append(avatar(op));
    const name=displayName(op),otherVersion=event&&event.operatorId!==op.id&&event.type==='pick';button.title=name;
    button.setAttribute('aria-label',name+(otherVersion?' · 其他版本已选择':event?' · 已'+actions[event.type].label:''));
    button.disabled=!draft.canChoose(op.id);
    appendVersion(button,op);
    if(event){button.classList.add(otherVersion?'is-version-locked':'is-'+event.type);button.style.setProperty('--owner-color',settings.colors[event.side]);if(!otherVersion)button.append(icon(event.type));}
    button.addEventListener('click',()=>{if(draft.choose(op.id)){const next=draft.snapshot();scroll[activeSide]=grid.scrollTop;if(next.step&&!next.available.some(s=>s.target===activeSide))activeSide=next.step.target;render();}});
    grid.append(button);
  }
  grid.scrollTop=scroll[activeSide];
}
const footer=document.querySelector('.sequence-region');footer.replaceChildren();
const track=node('ol','sequence-track'),undo=node('button','undo-button');undo.type='button';undo.append(icon('undo'),document.createTextNode('撤回'));undo.addEventListener('click',()=>{const last=draft.snapshot().history.at(-1);if(draft.undo()){activeSide=last.target;render();}});footer.append(track,undo);
const phase=document.querySelector('.phase-block');phase.setAttribute('aria-live','polite');
function render(){
  const state=draft.snapshot();for(const side of ['attack','defense'])renderTeam(side,state);
  const tasks=[...new Set(state.available.map(s=>s.type))].map(type=>actions[type].label+' '+state.available.filter(s=>s.type===type).length);
  phase.replaceChildren(node('span','eyebrow',rule.name),node('strong','',state.step?sideName[state.step.side]+' · '+tasks.join(' / '):'选用完成'),node('span','timer-placeholder',state.step?'第 '+state.step.round+' / '+rule.rounds.length+' 轮 · 顺序不限':'5 对 5'));
  track.replaceChildren();state.timeline.forEach((step,i)=>{const current=i>=state.history.length&&step.round===state.step?.round;const li=node('li',i<state.history.length?'done':current?'current':'');li.style.setProperty('--owner-color',settings.colors[step.side]);li.title=sideName[step.side]+' '+actions[step.type].label+sideName[step.target];li.setAttribute('aria-label',li.title);if(current)li.setAttribute('aria-current','step');li.append(icon(step.type));track.append(li);});
  undo.disabled=!state.history.length;renderGrid(state);
}
render();
fitCatalogue(grid);
if(document.readyState==='complete')startImageCache();
else window.addEventListener('load',startImageCache,{once:true});
