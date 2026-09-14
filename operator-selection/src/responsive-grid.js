// Choose the largest square that shows the full catalogue when desktop space permits.
// On phones the CSS minimum wins: scroll the catalogue instead of shrinking targets.
export function fitCatalogue(grid) {
  const update=()=>{
    if(window.innerWidth<=1000){grid.style.removeProperty('grid-template-columns');return;}
    const width=grid.clientWidth,height=grid.clientHeight,count=grid.children.length;
    if(!width||!height||!count)return;
    const gap=parseFloat(getComputedStyle(grid).columnGap)||0;
    let columns=Math.max(1,Math.floor((width+gap)/(88+gap)));
    for(let c=1;c<=count;c++){
      const size=(width-gap*(c-1))/c,rows=Math.ceil(count/c);
      if(size<=160&&size>=72&&rows*size+(rows-1)*gap<=height){columns=c;break;}
    }
    const value=`repeat(${columns}, minmax(0, 1fr))`;
    if(grid.style.gridTemplateColumns!==value)grid.style.gridTemplateColumns=value;
  };
  const observer=new ResizeObserver(update);
  observer.observe(grid);
  const children=new MutationObserver(update);
  children.observe(grid,{childList:true});
  window.addEventListener('resize',update);
  update();
}
