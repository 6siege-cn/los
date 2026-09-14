import operators from '../data/operators.js?v=recruit-correction-1';
import {assets,settings} from './config.js?v=faction-colors-1';
import {rules,actions} from './rules.js?v=five-ban-1';
import {createDraft} from './engine.js';
import {operatorFamily,versionLabel} from './identity.js';
import {startImageCache} from './image-cache.js';
import {fitCatalogue} from './responsive-grid.js';
import {fitDetails} from './compact-details.js';
import {defaultScope,inScope} from './operator-scope.js';
import {sortOperators} from './operator-order.js?v=recruit-correction-1';
import {installSkillPreview} from './skill-preview.js?v=native-menu-2';
let scope={...defaultScope};
const availableOperators=()=>operators.filter(op=>inScope(op,scope));
let ruleId=settings.rule, rule=rules[ruleId], draft=createDraft(rule,availableOperators());
const byId=new Map(operators.map(op=>[op.id,op]));
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
    if(op){slot.dataset.skillId=op.id;slot.append(avatar(op));appendVersion(slot,op);slot.title=displayName(op); // The CSV owns the panel source.
      const link=node('button','panel-link');link.type='button';link.title='查看 '+op.name+' 干员面板';link.setAttribute('aria-label',link.title);link.addEventListener('click',()=>window.open(assets.panelURL(op.panel),'_blank','noopener'));link.append(slot);row.append(link);
    } else row.append(slot);
    row.append(card(op));list.append(row);
  }
  // Ban slots belong to the acting side; therefore contain enemy portraits.
  const banSlots=document.querySelector('.ban-side--'+side+' .ban-slots');banSlots.replaceChildren();
  const capacity=state.steps.filter(s=>s.side===side&&s.type==='ban').length;
  banSlots.parentElement.dataset.banCount=capacity;
  for(let i=0;i<capacity;i++){const slot=node('span','ban-slot');const op=byId.get(state.bans[side][i]);if(op){slot.dataset.skillId=op.id;slot.append(avatar(op));slot.title=sideName[side]+'禁用 '+op.name;}banSlots.append(slot);}
}
const pool=document.querySelector('.operator-pool');pool.replaceChildren();
const tabs=[];
for(const side of ['attack','defense']){
  const previous=document.querySelector('.ban-side--'+side);
  const button=node('button',previous.className);button.type='button';button.id='tab-'+side;button.dataset.side=side;button.setAttribute('aria-label','切换到'+sideName[side]+'干员列表');button.setAttribute('aria-controls','operator-list');button.title=sideName[side];
  const slots=node('span','ban-slots');slots.setAttribute('aria-label',sideName[side]+'禁用的干员');
  button.append(icon(side),slots);previous.replaceWith(button);
  button.addEventListener('click',()=>switchSide(side));
  button.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();switchSide(e.key==='Home'?'attack':e.key==='End'?'defense':activeSide==='attack'?'defense':'attack');document.getElementById('tab-'+activeSide).focus();}});
  tabs.push(button);
}
const grid=node('div','operator-grid');grid.id='operator-list';grid.setAttribute('role','region');grid.tabIndex=0;pool.append(grid);
function switchSide(side){scroll[activeSide]=grid.scrollTop;activeSide=side;renderGrid(draft.snapshot());}
function renderGrid(state){
  for(const b of tabs){const selected=b.dataset.side===activeSide;b.setAttribute('aria-pressed',String(selected));}
  grid.setAttribute('aria-labelledby','tab-'+activeSide);grid.replaceChildren();
  for(const op of sortOperators(availableOperators().filter(op=>op.side===activeSide))){
    const event=state.history.find(e=>operatorFamily(byId.get(e.operatorId))===operatorFamily(op)),button=node('button','operator-button');
    button.type='button';button.dataset.operatorId=op.id;button.dataset.skillId=op.id;button.setAttribute('aria-description','长按或按 F1 查看技能');button.append(avatar(op));
    const name=displayName(op),otherVersion=event&&event.operatorId!==op.id&&event.type==='pick';button.title=name;
    button.setAttribute('aria-label',name+(otherVersion?' · 其他版本已选择':event?' · 已'+actions[event.type].label:''));
    button.setAttribute('aria-disabled',String(!draft.canChoose(op.id)));
    appendVersion(button,op);
    if(event){button.classList.add(otherVersion?'is-version-locked':'is-'+event.type);button.style.setProperty('--owner-color',settings.colors[event.side]);if(!otherVersion)button.append(icon(event.type));}
    button.addEventListener('click',()=>{if(draft.choose(op.id)){const next=draft.snapshot();scroll[activeSide]=grid.scrollTop;if(next.step&&!next.available.some(s=>s.target===activeSide))activeSide=next.step.target;render();}});
    grid.append(button);
  }
  grid.scrollTop=scroll[activeSide];
}
const footer=document.querySelector('.sequence-region');footer.replaceChildren();
const track=node('ol','sequence-track'),undo=node('button','undo-button');undo.type='button';undo.append(icon('undo'));undo.title='撤回';undo.addEventListener('click',()=>{const last=draft.snapshot().history.at(-1);if(draft.undo()){activeSide=last.target;render();}});footer.append(track);
const phase=document.querySelector('.phase-block');phase.setAttribute('aria-live','polite');
const ruleCell=node('label','rule-control'),ruleSelect=node('select','rule-select');
ruleSelect.setAttribute('aria-label','选择生效规则');
for(const [id,value] of Object.entries(rules)){const option=node('option','',value.name);option.value=id;ruleSelect.append(option);}
ruleCell.append(icon('rules'),ruleSelect);
const controls=node('div','phase-actions'),reset=node('button','reset-button');reset.type='button';reset.title='重置';
reset.prepend(icon('reset'));
undo.setAttribute('aria-label','撤回上一步');reset.setAttribute('aria-label','重置到初始状态');
controls.append(undo,reset);phase.before(controls);
const toolsCell=node('div','phase-tools'),settingsButton=node('button','settings-button');
settingsButton.type='button';settingsButton.title='干员范围设置';settingsButton.setAttribute('aria-label',settingsButton.title);settingsButton.setAttribute('aria-haspopup','dialog');settingsButton.append(icon('settings'));
toolsCell.append(ruleCell,settingsButton);phase.after(toolsCell);
const scopeDialog=node('dialog','scope-dialog');scopeDialog.id='operator-scope';
const scopeTitle=node('h2','','干员范围');scopeTitle.id='scope-title';scopeDialog.setAttribute('aria-labelledby',scopeTitle.id);
scopeDialog.append(scopeTitle,node('p','','官方干员始终开放，以下版本可独立开关。'));
const scopeInputs={};
for(const key of Object.keys(defaultScope)){
  const label=node('label','scope-option'),input=node('input');input.type='checkbox';input.checked=scope[key];input.name=key;
  label.append(node('span','',key.toUpperCase()),input);scopeDialog.append(label);scopeInputs[key]=input;
  input.addEventListener('change',()=>{
    if(draft.snapshot().history.length){input.checked=scope[key];return;}
    scope[key]=input.checked;restart(ruleId);
  });
}
const closeScope=node('button','scope-close','完成');closeScope.type='button';closeScope.addEventListener('click',()=>scopeDialog.close());scopeDialog.append(closeScope);document.body.append(scopeDialog);
settingsButton.setAttribute('aria-controls',scopeDialog.id);
settingsButton.addEventListener('click',()=>{if(!draft.snapshot().history.length)scopeDialog.showModal();});
function restart(id){
  ruleId=id;rule=rules[id];draft=createDraft(rule,availableOperators());
  activeSide='attack';scroll.attack=0;scroll.defense=0;render();
}
ruleSelect.addEventListener('change',()=>{
  if(draft.snapshot().history.length||!Object.hasOwn(rules,ruleSelect.value)){ruleSelect.value=ruleId;return;}
  restart(ruleSelect.value);
});
reset.addEventListener('click',()=>{scope={...defaultScope};scopeDialog.close();restart(settings.rule);});
function render(){
  const state=draft.snapshot();for(const side of ['attack','defense'])renderTeam(side,state);
  ruleSelect.value=ruleId;ruleSelect.disabled=state.history.length>0;
  settingsButton.disabled=state.history.length>0;
  settingsButton.title=settingsButton.disabled?'撤回全部操作或重置后可修改干员范围':'干员范围设置';
  for(const [key,input] of Object.entries(scopeInputs)){input.checked=scope[key];input.disabled=settingsButton.disabled;}
  ruleCell.classList.toggle('is-locked',ruleSelect.disabled);
  ruleCell.title=ruleSelect.disabled?'撤回全部操作或重置后可更换规则':'选择生效规则';
  track.style.gridTemplateColumns=`repeat(${state.timeline.length},minmax(0,1fr))`;
  const tasks=[...new Set(state.available.map(s=>s.type))].map(type=>actions[type].label+' '+state.available.filter(s=>s.type===type).length);
  phase.replaceChildren(node('span','eyebrow',rule.name),node('strong','',state.step?sideName[state.step.side]+' · '+tasks.join(' / '):'选用完成'),node('span','timer-placeholder',state.step?'第 '+state.step.round+' / '+rule.rounds.length+' 轮 · 顺序不限':'5 对 5'));
  track.replaceChildren();state.timeline.forEach((step,i)=>{const current=i>=state.history.length&&step.round===state.step?.round;const li=node('li',i<state.history.length?'done':current?'current':'');li.style.setProperty('--owner-color',settings.colors[step.side]);li.title=sideName[step.side]+' '+actions[step.type].label+sideName[step.target];li.setAttribute('aria-label',li.title);if(current)li.setAttribute('aria-current','step');li.append(icon(step.type));track.append(li);});
  undo.disabled=!state.history.length;renderGrid(state);
}
render();
installSkillPreview(board,{byId,avatarURL:assets.avatarURL});
fitDetails(document.querySelector('.selection-region'));
fitCatalogue(grid);
if(document.readyState==='complete')startImageCache();
else window.addEventListener('load',startImageCache,{once:true});
