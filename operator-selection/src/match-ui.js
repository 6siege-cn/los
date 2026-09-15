import {createMatchStore,snapshotMatch,validateMatch,presetTags,uniqueTags,tagKey,marks,sideLabels,endings,endRounds,operatorLabel,mapNames,modes,mapLabel,modeLabel} from './match-records.js';
import {el,renderMatchCard,matchPNG} from './match-card.js?v=map-mode-1';
export function installMatchRecords(menuButton,{getCurrent,assets}){
  const store=createMatchStore(globalThis.indexedDB);
  const dialog=el('dialog','match-dialog');dialog.id='match-records';dialog.setAttribute('aria-labelledby','match-dialog-title');
  const head=el('header','match-dialog-head'),title=el('h2','','对局记录');title.id='match-dialog-title';
  const close=button('关闭',()=>dialog.close());close.setAttribute('aria-label','关闭对局记录');head.append(title,close);
  const nav=el('nav','match-nav'),saveEntry=button('保存对局',()=>edit()),historyEntry=button('历史对局',()=>history());
  saveEntry.className='match-save-entry';nav.append(saveEntry,historyEntry);
  const status=el('p','match-status');status.setAttribute('role','status');
  const content=el('div','match-content');dialog.append(head,nav,status,content);document.body.append(dialog);
  const markerPopover=el('div','match-marker-popover');markerPopover.id='match-marker-popover';markerPopover.setAttribute('role','group');markerPopover.setAttribute('aria-label','选择干员标记');markerPopover.hidden=true;dialog.append(markerPopover);
  if(typeof markerPopover.showPopover==='function')markerPopover.setAttribute('popover','manual');
  let viewToken=0,editor=null,markAnchor=null;
  function button(label,action){const b=el('button','',label);b.type='button';b.addEventListener('click',action);return b;}
  function message(text){status.textContent=text;}
  function changeView(label){viewToken++;editor=null;closeMarks();title.textContent=label;content.replaceChildren();message('');dialog.scrollTop=0;return viewToken;}
  function fail(error){message('操作失败：'+(error?.message||'浏览器存储不可用')+'。未保存的内容仍保留在当前窗口。');}
  menuButton.title='对局记录';menuButton.setAttribute('aria-label','对局记录');menuButton.setAttribute('aria-haspopup','dialog');menuButton.setAttribute('aria-controls',dialog.id);
  menuButton.addEventListener('click',()=>{
    saveEntry.disabled=!getCurrent().state.complete;saveEntry.title=saveEntry.disabled?'完成全部选禁后可保存':'';
    if(!dialog.open)dialog.showModal();history();
  });
  dialog.addEventListener('close',()=>{viewToken++;closeMarks();});
  async function history(){
    const token=changeView('历史对局');message('读取本机记录…');
    try{
      const records=await store.records();if(token!==viewToken)return;
      message('记录仅保存在当前浏览器，清理网站数据会丢失；建议下载图片留存。');
      if(!records.length){content.append(el('p','match-empty','还没有保存的对局。完成选禁后，点击“保存对局”记录结果。'));return;}
      const list=el('div','match-history-list');content.append(list);let count=0;
      const more=button('加载更多',appendPage);
      function appendPage(){for(const record of records.slice(count,count+10)){
        const item=el('article','match-history-item');
        item.append(el('strong','',`${sideLabels[record.winner]??'未知'}获胜 · ${record.rule?.name??'未知规则'}`),el('span','',new Date(record.savedAt).toLocaleString('zh-CN',{hour12:false})),el('p','',`${mapLabel(record)} · ${modeLabel(record)} · ${record.ending} · 回合 ${record.endRound}`));
        const tags=el('div','match-tags');for(const tag of record.tags??[])tags.append(el('span','match-tag',tag));item.append(tags,button('查看对局',()=>detail(record)));list.append(item);
      }count+=10;more.hidden=count>=records.length;}
      content.append(more);appendPage();
    }catch(error){if(token===viewToken)fail(error);}
  }
  function detail(record,saved=false){
    changeView('对局详情');
    try{validateMatch(record);}catch{message('这条记录已损坏或版本不兼容，无法显示；原记录未删除。');return;}
    if(saved)message('对局已保存到本机。');content.append(renderMatchCard(record,assets));
    const actions=el('div','match-actions');actions.append(button('下载图片',event=>download(record,event.currentTarget)),button('返回历史',history));content.append(actions);
  }
  async function download(record,b){
    b.disabled=true;message('正在生成图片…');
    try{const blob=await matchPNG(record,assets),url=URL.createObjectURL(blob),link=el('a');link.href=url;link.download='six-siege-'+record.savedAt.replace(/[:.]/g,'-')+'.png';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);message('图片已生成，已交给浏览器下载。');}
    catch(error){message('下载失败：'+error.message+'。已保存的对局不受影响。');}finally{b.disabled=false;}
  }
  async function edit(){
    if(!getCurrent().state.complete){message('完成全部选禁后才能保存对局。');return;}
    const token=changeView('保存对局');
    try{
      const record=snapshotMatch(getCurrent(),crypto.randomUUID(),new Date().toISOString());editor=record;
      let tagOptions=uniqueTags(presetTags);
      const form=el('form','match-form'),fields=el('div','match-fields');
      function selectField(key,label,values){
        const wrapper=el('label','match-field'),select=el('select');select.name=key;select.required=true;select.setAttribute('aria-label',label);
        const placeholder=el('option','','请选择');placeholder.value='';select.append(placeholder);
        for(const [value,name] of values){const option=el('option','',name);option.value=value;select.append(option);}
        select.addEventListener('change',()=>{record[key]=select.value;refreshCard();});wrapper.append(el('span','',label),select);fields.append(wrapper);
      }
      selectField('mapId','地图',Object.entries(mapNames));selectField('mode','模式',modes.map(v=>[v,v]));
      selectField('winner','获胜方',Object.entries(sideLabels));selectField('ending','结束方式',endings.map(v=>[v,v]));selectField('endRound','结束回合',endRounds.map(v=>[v,v]));form.append(fields);
      const tagSection=el('fieldset','match-tag-section');tagSection.append(el('legend','','对局标签'));
      const tagChoices=el('div','match-tag-choices'),custom=el('div','match-custom-tag'),input=el('input');input.type='text';input.maxLength=24;input.placeholder='自定义标签（最多24字）';input.setAttribute('aria-label','自定义标签');
      function chooseTag(value){const key=tagKey(value),found=record.tags.some(tag=>tagKey(tag)===key);if(found)record.tags=record.tags.filter(tag=>tagKey(tag)!==key);else if(record.tags.length<20)record.tags=uniqueTags([...record.tags,value]);else{message('每局最多 20 个标签。');return;}drawTags();refreshCard();}
      function drawTags(){tagChoices.replaceChildren();for(const value of tagOptions){const b=button(value,()=>chooseTag(value));b.setAttribute('aria-pressed',String(record.tags.some(tag=>tagKey(tag)===tagKey(value))));tagChoices.append(b);}}
      function addTag(){const [value]=uniqueTags([input.value]);if(!value){message('请输入标签名称。');return;}tagOptions=uniqueTags([...tagOptions,value]);if(!record.tags.some(tag=>tagKey(tag)===tagKey(value)))chooseTag(value);else drawTags();input.value='';}
      custom.append(input,button('添加标签',addTag));input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();addTag();}});
      tagSection.append(tagChoices,custom);form.append(tagSection);
      form.append(el('p','match-muted','点击阵容头像选择标记，再次选择当前标记即可取消。'));
      const preview=el('div','match-preview');
      function refreshCard(){closeMarks();preview.replaceChildren(renderMatchCard(record,assets,{editable:true}));}
      const refresh=()=>refreshCard();editor={record,refresh};
      refreshCard();drawTags();form.append(preview);
      const submit=el('button','match-submit','保存对局记录');submit.type='submit';form.append(submit);content.append(form);
      form.addEventListener('submit',async event=>{
        event.preventDefault();if(submit.disabled)return;
        const current=getCurrent().state;
        if(!current.complete||JSON.stringify(current.history)!==JSON.stringify(record.history)){message('当前选禁已变化，请重新打开保存对局。');return;}
        record.savedAt=new Date().toISOString();
        try{validateMatch(record);}catch(error){message(error.message);return;}
        submit.disabled=true;message('正在保存…');
        try{const saved=await store.save(record);if(token===viewToken)detail(saved,true);}catch(error){if(token===viewToken){submit.disabled=false;fail(error);}}
      });
      try{tagOptions=await store.tags();if(token===viewToken){tagOptions=uniqueTags([...tagOptions,...record.tags]);drawTags();}}catch(error){if(token===viewToken)message('标签库读取失败；可继续填写，保存时会再次尝试。');}
    }catch(error){fail(error);}
  }
  function closeMarks(restoreFocus=false){
    const previous=markAnchor;markAnchor=null;previous?.setAttribute('aria-expanded','false');
    if(markerPopover.hasAttribute('popover')&&markerPopover.matches(':popover-open'))markerPopover.hidePopover();
    markerPopover.hidden=true;
    if(restoreFocus&&previous?.isConnected)previous.focus({preventScroll:true});
  }
  function positionMarks(){
    if(!markAnchor?.isConnected){closeMarks();return;}
    const a=markAnchor.querySelector('.match-face').getBoundingClientRect(),d=markerPopover.getBoundingClientRect(),r=dialog.getBoundingClientRect(),gap=8;
    const left=Math.max(gap,r.left+gap),right=Math.min(innerWidth-gap,r.right-gap),top=Math.max(gap,head.getBoundingClientRect().bottom+gap),bottom=Math.min(innerHeight-gap,r.bottom-gap);
    let x=a.right+gap;if(x+d.width>right)x=a.left-gap-d.width;
    markerPopover.style.left=Math.max(left,Math.min(x,right-d.width))+'px';
    markerPopover.style.top=Math.max(top,Math.min(a.top+(a.height-d.height)/2,bottom-d.height))+'px';
  }
  function showMarks(target){
    if(!editor?.record)return;if(markAnchor===target){closeMarks();return;}
    closeMarks();markAnchor=target;const id=target.dataset.markId,{record,refresh}=editor,op=record.operators.find(o=>o.id===id);
    markerPopover.setAttribute('aria-label','标记 '+operatorLabel(op));markerPopover.replaceChildren();
    target.setAttribute('aria-expanded','true');target.setAttribute('aria-controls',markerPopover.id);
    for(const [key,label] of Object.entries(marks)){
      const b=button('',()=>{
        if(record.marks[id]===key)delete record.marks[id];else record.marks[id]=key;
        refresh();[...content.querySelectorAll('[data-mark-id]')].find(node=>node.dataset.markId===id)?.focus({preventScroll:true});
      });b.setAttribute('aria-label',label);b.title=label;b.setAttribute('aria-pressed',String(record.marks[id]===key));
      const img=el('img');img.src=assets.recordMarks[key];img.alt='';b.append(img);markerPopover.append(b);
    }
    markerPopover.hidden=false;if(markerPopover.hasAttribute('popover'))markerPopover.showPopover();positionMarks();
    (markerPopover.querySelector('[aria-pressed="true"]')||markerPopover.querySelector('button')).focus({preventScroll:true});
  }
  document.addEventListener('pointerdown',event=>{if(markAnchor&&!markerPopover.contains(event.target)&&!event.target.closest('[data-mark-id]'))closeMarks();},true);
  document.addEventListener('keydown',event=>{if(markAnchor&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();closeMarks(true);}},true);
  dialog.addEventListener('scroll',()=>closeMarks(),true);window.addEventListener('blur',()=>closeMarks());window.addEventListener('resize',()=>{if(markAnchor)positionMarks();});
  content.addEventListener('contextmenu',event=>{if(event.target.closest('[data-mark-id]'))event.preventDefault();});
  content.addEventListener('click',event=>{const target=event.target.closest('[data-mark-id]');if(target){event.preventDefault();showMarks(target);}});
}
