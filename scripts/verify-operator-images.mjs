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
  assert.equal(await page.locator('.operator-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),10);
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
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({coreImages:coreCount,firstVisitNetworkRequests:firstRequests,repeatVisitImageDownloads:0,offlinePanel:true,offlineTokens:true,offlineFactionSwitch:true,mobileColumns:10,pageErrors:errors}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
