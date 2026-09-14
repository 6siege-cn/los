// Registration and persistence are optional; image URLs work without either API.
export async function startImageCache(){
  if(!isSecureContext||!('serviceWorker' in navigator))return;
  try{
    const registration=await navigator.serviceWorker.register(new URL('../sw.js',import.meta.url),{updateViaCache:'none'});
    await navigator.serviceWorker.ready;
    const warm=()=>{
      const connection=navigator.connection;
      if(connection?.saveData||['slow-2g','2g'].includes(connection?.effectiveType))return;
      (navigator.serviceWorker.controller||registration.active)?.postMessage({type:'WARM_IMAGES'});
    };
    if('requestIdleCallback' in window)requestIdleCallback(warm,{timeout:5000});else setTimeout(warm,1000);
    navigator.serviceWorker.addEventListener('controllerchange',warm);
    // A browser may decline; regular persistent Cache Storage still works.
    const persist=()=>{navigator.storage?.persist?.().catch(()=>{});};
    document.addEventListener('pointerdown',persist,{once:true});
  }catch(error){console.info('Image cache unavailable; using regular image loading.',error.name);}
}
