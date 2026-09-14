// Size information from four overlapping dice and one stat icon, never spare width.
export function fitDetails(region){
  const update=()=>{
    const strips=matchMedia('(max-width:1000px) and (max-aspect-ratio:1/1)').matches;
    const gap=innerHeight<=500&&!strips?1:4;
    const rowHeight=(region.clientHeight-4*gap)/5;
    const cardHeight=strips?48:Math.min(70,rowHeight);
    const stat=strips?16:Math.min(24,(cardHeight-8)/2);
    const available=strips?(region.clientWidth-16)/5:Infinity;
    const dice=Math.max(1,Math.min((cardHeight-10)/3,(available-stat-10)/3.5));
    const infoWidth=3.5*dice+stat+10;
    const portrait=Math.min(rowHeight,innerWidth>1000?112:innerHeight<=500?44:72);
    for(const [key,value] of Object.entries({dice,stat,infoWidth,cardHeight,portrait,teamWidth:portrait+4+infoWidth})){
      region.style.setProperty('--detail-'+key,value+'px');
    }
    region.classList.toggle('compact-side-columns',!strips);
  };
  new ResizeObserver(update).observe(region);
  window.addEventListener('resize',update);
  update();
}
