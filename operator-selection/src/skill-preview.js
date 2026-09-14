const mobileQuery='(max-width:760px), (pointer:coarse) and (max-width:1100px)';
export function installSkillPreview(board,{byId,avatarURL}){
  const dialog=document.createElement('dialog');dialog.className='skill-preview';
  dialog.setAttribute('aria-labelledby','skill-preview-title');
  dialog.innerHTML='<header class="skill-preview-header"><h2 id="skill-preview-title"></h2><button type="button" class="skill-preview-close" aria-label="关闭技能">×</button></header><div class="skill-preview-text" tabindex="0"></div>';
  document.body.append(dialog);
  const close=dialog.querySelector('button'),body=dialog.querySelector('.skill-preview-text');
  const mobile=matchMedia(mobileQuery);
  let anchor=null,gesture=null,suppressClick=false;
  const cancel=()=>{if(gesture)clearTimeout(gesture.timer);gesture=null;};
  function position(){
    if(!dialog.open)return;
    if(!anchor?.isConnected){dialog.close();return;}
    if(mobile.matches){dialog.style.removeProperty('left');dialog.style.removeProperty('top');return;}
    const a=anchor.getBoundingClientRect(),d=dialog.getBoundingClientRect(),gap=12;
    const x=a.right+gap+d.width<=innerWidth-gap?a.right+gap:a.left-gap-d.width;
    dialog.style.left=Math.max(gap,Math.min(x,innerWidth-d.width-gap))+'px';
    dialog.style.top=Math.max(gap,Math.min(a.top,innerHeight-d.height-gap))+'px';
  }
  function show(target){
    const op=byId.get(target.dataset.skillId);if(!op)return;
    anchor=target;dialog.style.setProperty('--skill-side',`var(--${op.side})`);
    dialog.querySelector('h2').textContent=op.name+(op.version&&op.version!=='off'?' · '+op.version.toUpperCase():'');
    let portrait=dialog.querySelector('img');
    if(!portrait){portrait=document.createElement('img');portrait.className='skill-preview-avatar';portrait.alt='';dialog.querySelector('header').prepend(portrait);}
    portrait.src=avatarURL(op.avatar);
    body.textContent=op.skill||'暂无技能描述';body.scrollTop=0;
    if(!dialog.open)dialog.showModal();position();close.focus({preventScroll:true});
  }
  close.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{
    const r=dialog.getBoundingClientRect();
    if(event.target===dialog&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))dialog.close();
  });
  dialog.addEventListener('close',()=>{cancel();if(anchor?.isConnected)(anchor.closest('a,button')||anchor).focus({preventScroll:true});anchor=null;});
  document.addEventListener('pointerdown',event=>{
    if(gesture){suppressClick=true;cancel();return;}
    suppressClick=false;
    if(dialog.open||event.button!==0||event.isPrimary===false)return;
    const target=event.target.closest('[data-skill-id]');if(!target||!board.contains(target))return;
    const press={id:event.pointerId,x:event.clientX,y:event.clientY,target,timer:null};gesture=press;
    press.timer=setTimeout(()=>{
      if(gesture!==press||!target.isConnected)return;
      suppressClick=true;show(target);
    },450);
  },true);
  document.addEventListener('pointermove',event=>{
    if(gesture&&event.pointerId===gesture.id&&Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>10){suppressClick=true;cancel();}
  },{capture:true,passive:true});
  for(const type of ['pointerup','pointercancel'])document.addEventListener(type,cancel,true);
  // A successful long press must never bubble into pick/ban, faction switch or panel navigation.
  document.addEventListener('click',event=>{if(suppressClick){suppressClick=false;event.preventDefault();event.stopImmediatePropagation();}},true);
  // Capture before browser image/link handling, including the selected portrait's outer control.
  for(const type of ['contextmenu','selectstart','dragstart'])document.addEventListener(type,event=>{
    const target=event.target instanceof Element?event.target:event.target.parentElement;
    if(target?.closest('[data-skill-id], .panel-link')){event.preventDefault();event.stopImmediatePropagation();}
  },{capture:true,passive:false});
  board.addEventListener('keydown',event=>{
    const target=event.target.closest('[data-skill-id]');
    if(target&&event.key==='F1'){event.preventDefault();show(target);}
  });
  board.addEventListener('scroll',()=>{cancel();if(dialog.open)dialog.close();},true);
  window.addEventListener('blur',cancel);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
  window.addEventListener('resize',()=>{cancel();position();});
  mobile.addEventListener('change',position);
  new MutationObserver(()=>{if(anchor&&!anchor.isConnected&&dialog.open)dialog.close();if(gesture&&!gesture.target.isConnected)cancel();}).observe(board,{childList:true,subtree:true});
}
