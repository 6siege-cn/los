// Browser integration check: npm run verify-images (Playwright + installed Edge).
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,join,extname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import manifest from '../operator-selection/src/asset-manifest.js';
const require=createRequire(import.meta.url);
let chromium;
try{({chromium}=require('playwright'));}
catch{({chromium}=createRequire(join(dirname(process.execPath),'../package.json'))('playwright'));}
const root=fileURLToPath(new URL('../',import.meta.url));
const types={'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const imageRequests=[];
const server=createServer(async(req,res)=>{
  try{
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(!path.startsWith('/los/')){res.writeHead(404).end();return;}
    const target=resolve(root,'.'+path.slice(4)+(path.endsWith('/')?'index.html':''));
    if(!target.startsWith(root)){res.writeHead(403).end();return;}
    if(path.includes('/assets/optimized/'))imageRequests.push(path);
    const body=await readFile(target);
    res.writeHead(200,{'Content-Type':types[extname(target)]||'application/octet-stream','Cache-Control':'no-store'}).end(body);
  }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const coreCount=new Set([...Object.values(manifest.avatars),...Object.values(manifest.tokens),...Object.values(manifest.icons)]).size;
  const base=origin+'/los/operator-selection/';
  await page.goto(base+'index.html');
  assert.equal(await page.locator('.side-tabs,.side-tab').count(),0);
  await page.locator('#tab-defense').click();
  assert.equal(await page.locator('#tab-defense').getAttribute('aria-pressed'),'true');
  await page.locator('#tab-defense').press('ArrowLeft');
  assert.equal(await page.locator('#tab-attack').getAttribute('aria-pressed'),'true');
  await page.waitForFunction(async expected=>{
    const names=await caches.keys(),name=names.find(n=>n.endsWith(':core-v1'));
    return navigator.serviceWorker.controller&&name&&(await (await caches.open(name)).keys()).length===expected;
  },coreCount,{timeout:60000});
  await page.locator('[data-operator-id="sledge"]').click();
  await page.waitForFunction(()=>[...document.images].every(img=>img.complete&&img.naturalWidth>0));
  const firstRequests=imageRequests.length;
  imageRequests.length=0;
  await page.reload();
  await page.locator('[data-operator-id="sledge"]').click();
  await page.waitForFunction(()=>[...document.images].every(img=>img.complete&&img.naturalWidth>0));
  assert.equal(imageRequests.length,0,'Repeat visit must avoid image network downloads');
  const panel=await page.locator('.panel-link').first().getAttribute('href');
  assert.ok(panel.endsWith('.webp'));
  assert.equal(await page.evaluate(async url=>(await fetch(url)).status,panel),200);
  assert.equal(imageRequests.length,1,'Only the opened panel should load');
  imageRequests.length=0;
  await context.setOffline(true);
  assert.equal(await page.evaluate(async url=>(await fetch(url)).status,panel),200);
  const token=base+Object.values(manifest.tokens)[0];
  assert.equal(await page.evaluate(async url=>(await fetch(url)).status,token),200);
  assert.equal(imageRequests.length,0);
  await page.locator('#tab-defense').click();
  await page.waitForFunction(()=>[...document.images].every(img=>img.complete&&img.naturalWidth>0));
  await context.setOffline(false);
  const output=process.argv[2];
  if(output){await mkdir(output,{recursive:true});await page.screenshot({path:join(output,'desktop.png'),fullPage:true});}
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.locator('.operator-button').first().evaluate(el=>el.getBoundingClientRect().width>=64));
  assert.equal(await page.locator('.team-column--attack .info-card').first().evaluate(card=>{
    const bounds=card.getBoundingClientRect();
    return [...card.querySelectorAll('img')].every(img=>img.getBoundingClientRect().bottom<=bounds.bottom+1);
  }),true,'Images must fit inside the compact information card');
  assert.equal(await page.locator('.team-column--attack .dice-row').first().evaluate(row=>{
    const dice=[...row.children].map(el=>el.getBoundingClientRect());
    const bounds=row.getBoundingClientRect();
    return dice.slice(1).every((b,i)=>b.left<dice[i].right)&&Math.abs((dice[0].left+dice.at(-1).right)/2-(bounds.left+bounds.right)/2)<1;
  }),true,'Dice must remain overlapped and centered on mobile');
  if(output)await page.screenshot({path:join(output,'mobile.png'),fullPage:true});
  // Fill every pick/ban slot, then exercise all layouts with real rendered data.
  for(let i=0;i<13;i++)await page.locator('.operator-button:not(:disabled)').first().click();
  assert.equal(await page.locator('.panel-link').count(),10);
  const layouts=[];
  for(const [width,height] of [[320,568],[360,640],[390,844],[430,932],[768,1024],[820,1180],[1024,768],[1366,768],[1440,900],[1920,1080],[844,390],[667,375],[844,320],[800,300],[667,300],[960,360]]){
    await page.setViewportSize({width,height});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const metrics=await page.evaluate(()=>{
      const rect=s=>document.querySelector(s).getBoundingClientRect();
      const squares=[...document.querySelectorAll('.operator-button,.operator-slot,.ban-slot')].map(el=>el.getBoundingClientRect());
      return {bottom:rect('.sequence-region').bottom,top:rect('.ban-region').top,overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight,navTop:rect('.hidden-nav').top,
        matrix:rect('.operator-button').width,selected:rect('.operator-slot').width,
        square:squares.every(r=>Math.abs(r.width-r.height)<1),
        teams:[...document.querySelectorAll('.panel-link')].every(el=>{const r=el.getBoundingClientRect();return r.top>=rect('.ban-region').bottom&&r.bottom<=rect('.sequence-region').top;}),
        gridHeight:rect('.operator-grid').height};
    });
    const controlGeometry=await page.evaluate(()=>['.phase-tools','.phase-actions','.phase-block','.phase-block .eyebrow','.phase-block strong','.phase-block .timer-placeholder'].map(s=>[s,document.querySelector(s).getBoundingClientRect().toJSON()]));
    assert.equal(await page.evaluate(()=>{
      const rule=document.querySelector('.phase-tools').getBoundingClientRect(),actions=document.querySelector('.phase-actions').getBoundingClientRect();
      const phase=document.querySelector('.phase-block').getBoundingClientRect();
      return Math.abs(rule.width-actions.width)<1&&actions.right<=phase.left+1&&rule.left>=phase.right-1&&[...document.querySelector('.phase-block').children].every(el=>{const r=el.getBoundingClientRect();return r.top>=phase.top&&r.bottom<=phase.bottom+1;});
    }),true,`Symmetric controls and phase text must fit at ${width}x${height}: ${JSON.stringify(controlGeometry)}`);
    assert.ok(metrics.bottom<=height+1&&metrics.top>=0,JSON.stringify({width,height,...metrics}));
    assert.ok(!metrics.overflow&&metrics.square&&metrics.teams,JSON.stringify({width,height,...metrics}));
    assert.ok(metrics.matrix>=63&&metrics.selected>=(height<=370?28:43)&&metrics.gridHeight>=64,JSON.stringify({width,height,...metrics}));
    layouts.push({width,height,...metrics});
    assert.equal(await page.locator('.team-row .info-card').evaluateAll(cards=>cards.every(card=>{
      const box=card.getBoundingClientRect();
      return [...card.querySelectorAll('img')].every(img=>{const r=img.getBoundingClientRect();return r.left>=box.left-1&&r.right<=box.right+1&&r.top>=box.top-1&&r.bottom<=box.bottom+1;})&&[...card.querySelectorAll('.dice-row')].every(row=>{
        const dice=row.querySelector('img');return !dice||Math.abs(row.clientWidth-3.5*dice.getBoundingClientRect().width)<1;
      });
    })),true,`Details must fit their icons without unused dice columns at ${width}x${height}`);
    if(output)await page.screenshot({path:join(output,`${width}x${height}.png`),fullPage:true});
    if(height<=370){
      assert.equal(await page.locator('.team-list').first().evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),1);
      assert.equal(await page.locator('.team-row > .info-card').evaluateAll(cards=>cards.every(el=>getComputedStyle(el).display!=='none')),true);
    }
  }
  for(let i=0;i<14;i++)await page.locator('.undo-button').click();
  assert.equal(await page.locator('.panel-link,.info-card img,.ban-slot img').count(),0);
  assert.equal(await page.locator('.rule-select').isEnabled(),true);
  await page.locator('.operator-button:not(:disabled)').first().click();
  assert.equal(await page.locator('.rule-select').isDisabled(),true);
  await page.locator('.reset-button').click();
  assert.equal(await page.locator('.panel-link,.info-card img,.ban-slot img,.sequence-track .done').count(),0);
  assert.equal(await page.locator('.undo-button').isDisabled(),true);
  assert.equal(await page.locator('#tab-attack').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('.rule-select').isEnabled(),true);
  // Supply an additional rule only in this isolated test, exercising registry extension.
  await page.route('**/rules.js',async route=>{
    const response=await route.fetch();
    await route.fulfill({response,body:await response.text()+`\nrules.fixture={...rules.standard,name:'测试规则',rounds:rules.standard.rounds.map(r=>({...r,side:opposite(r.side)}))};`});
  });
  await page.reload();
  await page.locator('.rule-select').selectOption('fixture');
  assert.ok((await page.locator('.phase-block').innerText()).includes('测试规则'));
  assert.ok((await page.locator('.phase-block strong').innerText()).startsWith('防守方'));
  await page.locator('.operator-button:not(:disabled)').first().click();
  assert.equal(await page.locator('.rule-select').isDisabled(),true);
  await page.locator('.reset-button').click();
  assert.equal(await page.locator('.rule-select').inputValue(),'standard');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({coreImages:coreCount,firstVisitNetworkRequests:firstRequests,repeatVisitImageDownloads:0,offlinePanel:true,offlineTokens:true,offlineFactionSwitch:true,layouts,pageErrors:errors}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
