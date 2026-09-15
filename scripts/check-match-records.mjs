import assert from 'node:assert/strict';
import {join} from 'node:path';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
const require=createRequire(import.meta.url);
let sharp;
try{sharp=require('sharp');}catch{sharp=createRequire(join(dirname(process.execPath),'../package.json'))('sharp');}
async function verifyPortraitPixels(download,record){
  const chunks=[];for await(const chunk of await download.createReadStream())chunks.push(chunk);
  const {data,info}=await sharp(Buffer.concat(chunks)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(info.width,1200);
  for(const [i,side] of ['attack','defense'].entries())for(const kind of ['picks','bans']){
    record[kind][side].forEach((id,j)=>{
      const size=kind==='picks'?96:70,x=48+i*576+j*106,y=kind==='picks'?284:466;
      let painted=0;
      // Exclude the corner version/mark and the name; blank avatar squares must fail.
      for(let dy=8;dy<size-30;dy++)for(let dx=8;dx<size-8;dx++){
        const offset=((y+dy)*info.width+x+dx)*4;
        if(data[offset]!==36||data[offset+1]!==45||data[offset+2]!==54)painted++;
      }
      assert.ok(painted>50,`Missing exported ${kind} portrait: ${id}`);
    });
  }
}
export async function checkMatchRecords(source,output){
  const context=await source.context().browser().newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});
  try{
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(source.url());
    await page.locator('.menu-button').tap();assert.equal(await page.locator('.match-save-entry').isDisabled(),true);
    await page.getByRole('button',{name:'关闭对局记录',exact:true}).tap();
    await page.locator('#tab-defense').tap();await page.locator('[data-operator-id="smoke"]').tap();await page.locator('[data-operator-id="altsledge"]').tap();
    for(let i=2;i<14;i++)await page.locator('.operator-button[aria-disabled="false"]').first().tap();
    await page.locator('.menu-button').tap();await page.locator('.match-save-entry').tap();
    assert.equal(await page.locator('[data-mark-id]').count(),10);
    await page.getByRole('button',{name:'保存对局记录',exact:true}).tap();assert.equal(await page.locator('.match-form').count(),1);
    assert.equal(await page.locator('select[name=mapId] option').count(),9);
    assert.equal(await page.locator('select[name=mode] option').count(),4);
    await page.getByRole('combobox',{name:'地图',exact:true}).selectOption('kafe');
    await page.getByRole('combobox',{name:'模式',exact:true}).selectOption('人质模式');
    await page.getByRole('combobox',{name:'获胜方',exact:true}).selectOption('attack');
    await page.getByRole('combobox',{name:'结束方式',exact:true}).selectOption('解救人质');
    await page.getByRole('combobox',{name:'结束回合',exact:true}).selectOption('+');
    await page.locator('.match-tag-choices').getByRole('button',{name:'RUSH',exact:true}).tap();
    await page.getByRole('textbox',{name:'自定义标签',exact:true}).fill('合作突击');await page.getByRole('button',{name:'添加标签',exact:true}).tap();
    await page.getByRole('textbox',{name:'自定义标签',exact:true}).fill(' rush ');await page.getByRole('button',{name:'添加标签',exact:true}).tap();
    assert.equal(await page.locator('.match-card .match-tag').count(),2);
    const ids=await page.locator('[data-mark-id]').evaluateAll(nodes=>nodes.slice(0,4).map(n=>n.dataset.markId));
    for(const [i,label] of ['向上大拇指','向下大拇指','骷髅头','瞄准准星'].entries()){
      const target=page.locator(`[data-mark-id="${ids[i]}"]`);await target.tap();
      assert.equal(await page.locator('dialog[open]').count(),1);
      assert.equal(await page.locator('.match-marker-popover button').count(),4);
      assert.equal(await page.locator('.match-marker-popover').evaluate(node=>{const r=node.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&getComputedStyle(node).gridTemplateColumns.split(' ').length===2;}),true);
      if(output&&i===0)await page.screenshot({path:join(output,'match-marker-popover-mobile.png')});
      await page.getByRole('button',{name:label,exact:true}).tap();
    }
    assert.equal(await page.locator('.match-card .match-mark').count(),4);
    const lastPortrait=page.locator('[data-mark-id]').last();
    await lastPortrait.tap();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.match-marker-popover').isVisible(),false);
    assert.equal(await page.locator('.match-dialog').isVisible(),true);
    await lastPortrait.tap();await lastPortrait.tap();
    assert.equal(await page.locator('.match-marker-popover').isVisible(),false);
    await lastPortrait.tap();await page.locator('.match-dialog-head h2').tap();
    assert.equal(await page.locator('.match-marker-popover').isVisible(),false);
    await page.setViewportSize({width:1366,height:900});await lastPortrait.click();
    assert.equal(await page.locator('.match-marker-popover').evaluate(node=>{const r=node.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}),true);
    if(output)await page.screenshot({path:join(output,'match-marker-popover-desktop.png')});
    await page.keyboard.press('Escape');await page.setViewportSize({width:390,height:844});
    // Keyboard alternative and clear, then replace, do not trigger draft actions.
    await page.locator(`[data-mark-id="${ids[0]}"]`).focus();await page.keyboard.press('Enter');
    assert.equal(await page.getByRole('button',{name:'向上大拇指',exact:true}).getAttribute('aria-pressed'),'true');
    await page.getByRole('button',{name:'向上大拇指',exact:true}).tap();
    assert.equal(await page.locator('.match-card .match-mark').count(),3);
    await page.locator(`[data-mark-id="${ids[0]}"]`).focus();await page.keyboard.press('Enter');await page.getByRole('button',{name:'向上大拇指',exact:true}).tap();
    assert.equal(await page.locator('.sequence-track .done').count(),14);
    if(output)await page.screenshot({path:join(output,'match-editor-mobile.png')});
    await page.getByRole('button',{name:'保存对局记录',exact:true}).tap();
    await page.getByRole('button',{name:'下载图片',exact:true}).waitFor();
    assert.ok((await page.locator('.match-status').innerText()).includes('已保存'));
    const record=await page.evaluate(async()=>{const {createMatchStore}=await import('./src/match-records.js');const rows=await createMatchStore(indexedDB).records();if(rows.length!==1)throw Error('Unexpected record count');return rows[0];});
    assert.equal(record.mapId,'kafe');assert.equal(record.mode,'人质模式');assert.equal(record.ending,'解救人质');
    assert.match(await page.locator('.match-meta').innerText(),/杜斯妥也夫斯基咖啡馆/);
    assert.equal(record.history[0].type,'ban');assert.equal(record.history[1].operatorId,'altsledge');assert.equal(record.history.length,14);
    assert.equal(Object.keys(record.marks).length,4);assert.deepEqual(record.tags,['RUSH','合作突击']);assert.equal(record.endRound,'+');
    for(const [width,height] of [[390,844],[1366,900],[667,300]]){
      await page.setViewportSize({width,height});await page.locator('.match-card').scrollIntoViewIfNeeded();
      assert.equal(await page.locator('.match-dialog').evaluate(node=>node.scrollWidth<=node.clientWidth),true);
      if(output)await page.screenshot({path:join(output,`match-detail-${width}x${height}.png`)});
    }
    await page.setViewportSize({width:390,height:844});
    // Reproduce zero layout dimensions and prohibit the SVG canvas path. Decoding must finish before drawing.
    await page.evaluate(()=>{
      window.exportOriginalDraw=CanvasRenderingContext2D.prototype.drawImage;
      window.exportOriginalDecode=HTMLImageElement.prototype.decode;
      window.exportDimensions=['width','height'].map(key=>[key,Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,key)]);
      for(const [key] of window.exportDimensions)Object.defineProperty(HTMLImageElement.prototype,key,{configurable:true,get:()=>0});
      HTMLImageElement.prototype.decode=async function(){await window.exportOriginalDecode.call(this);await new Promise(r=>setTimeout(r,40));this.exportDecoded=true;};
      CanvasRenderingContext2D.prototype.drawImage=function(img,...args){
        if(img instanceof HTMLImageElement){if(!img.exportDecoded||!img.src.includes('.png'))throw Error('Export must draw decoded PNG images');}
        return window.exportOriginalDraw.call(this,img,...args);
      };
    });
    const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'下载图片',exact:true}).tap();const download=await downloadPromise;
    assert.equal(await download.failure(),null);assert.match(download.suggestedFilename(),/\.png$/);
    await verifyPortraitPixels(download,record);
    await page.waitForFunction(async()=>{
      const {assets}=await import('./src/config.js?v=png-export-1');
      const {createMatchStore}=await import('./src/match-records.js');
      const [record]=await createMatchStore(indexedDB).records();
      return (await Promise.all(record.operators.map(op=>caches.match(assets.exportAvatarURL(op.avatar))))).every(Boolean);
    });
    await context.setOffline(true);
    assert.equal(await page.evaluate(async()=>{
      const {assets}=await import('./src/config.js?v=png-export-1');
      const {createMatchStore}=await import('./src/match-records.js');
      const [record]=await createMatchStore(indexedDB).records();
      return (await Promise.all(record.operators.map(async op=>(await fetch(assets.exportAvatarURL(op.avatar))).ok))).every(Boolean);
    }),true,'Export avatars should remain available from the offline image cache');
    await context.setOffline(false);
    await page.evaluate(()=>{
      CanvasRenderingContext2D.prototype.drawImage=window.exportOriginalDraw;
      HTMLImageElement.prototype.decode=window.exportOriginalDecode;
      for(const [key,descriptor] of window.exportDimensions)Object.defineProperty(HTMLImageElement.prototype,key,descriptor);
    });
    if(output){const path=join(output,'match-card.png');await download.saveAs(path);const png=await readFile(path);assert.equal(png.readUInt32BE(16),1200);assert.ok(png.readUInt32BE(20)>900);}
    await page.getByRole('button',{name:'关闭对局记录',exact:true}).click();await page.locator('.reset-button').click();await page.reload();
    await page.locator('.menu-button').click();await page.getByRole('button',{name:'查看对局',exact:true}).click();
    assert.equal(await page.locator('.match-card .match-mark').count(),4);assert.equal(await page.locator('.match-card .match-tag').count(),2);
    await page.getByRole('button',{name:'关闭对局记录',exact:true}).click();
    await page.locator('.settings-button').click();await page.locator('.rule-select').selectOption('fiveBan');await page.getByRole('button',{name:'完成',exact:true}).click();
    for(let i=0;i<20;i++)await page.locator('.operator-button[aria-disabled="false"]').first().click();
    await page.locator('.menu-button').click();await page.locator('.match-save-entry').click();
    await page.locator('.match-tag-choices').getByRole('button',{name:'合作突击',exact:true}).waitFor();
    assert.equal(await page.locator('.match-card .match-bans .match-portrait').count(),10);
    // Test append-only concurrent writes and failed saves against a real browser database.
    assert.equal(await page.evaluate(async()=>{
      const {createMatchStore}=await import('./src/match-records.js');const store=createMatchStore(indexedDB),[record]=await store.records();
      await Promise.all([store.save({...record,id:'concurrent-a'}),store.save({...record,id:'concurrent-b'})]);
      let rejected=false;try{await store.save(record);}catch{rejected=true;}
      return rejected&&(await store.records()).length===3;
    }),true);
    await page.getByRole('combobox',{name:'地图',exact:true}).selectOption('oregon');
    await page.getByRole('combobox',{name:'模式',exact:true}).selectOption('肃清威胁');
    await page.getByRole('combobox',{name:'获胜方',exact:true}).selectOption('defense');
    await page.getByRole('combobox',{name:'结束方式',exact:true}).selectOption('对手投降');
    await page.getByRole('combobox',{name:'结束回合',exact:true}).selectOption('5');
    await page.evaluate(()=>{window.originalRecordAdd=IDBObjectStore.prototype.add;IDBObjectStore.prototype.add=function(){throw Error('模拟存储失败');};});
    await page.getByRole('button',{name:'保存对局记录',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('.match-status').textContent.includes('操作失败'));
    assert.equal(await page.getByRole('combobox',{name:'获胜方',exact:true}).inputValue(),'defense');
    await page.evaluate(()=>{IDBObjectStore.prototype.add=window.originalRecordAdd;document.querySelector('.match-form').requestSubmit();document.querySelector('.match-form').requestSubmit();});
    await page.getByRole('button',{name:'下载图片',exact:true}).waitFor();
    assert.equal(await page.evaluate(async()=>{const {createMatchStore}=await import('./src/match-records.js');return (await createMatchStore(indexedDB).records()).length;}),4);
    const fiveBanDownload=page.waitForEvent('download');await page.getByRole('button',{name:'下载图片',exact:true}).click();const fiveBanImage=await fiveBanDownload;
    assert.equal(await fiveBanImage.failure(),null);if(output)await fiveBanImage.saveAs(join(output,'match-five-ban.png'));
    const fiveRecord=await page.evaluate(async()=>{const {createMatchStore}=await import('./src/match-records.js');return (await createMatchStore(indexedDB).records()).find(r=>r.history.length===20);});
    await verifyPortraitPixels(fiveBanImage,fiveRecord);
    const failedExport=await page.evaluate(async record=>{
      const {matchPNG}=await import('./src/match-card.js?v=png-export-1');
      const {assets}=await import('./src/config.js?v=png-export-1');
      try{await matchPNG(record,{...assets,exportAvatarURL:()=> 'data:image/png;base64,broken'});return false;}catch{return true;}
    },record);
    assert.equal(failedExport,true,'Invalid images must reject instead of producing blank portraits');
    assert.deepEqual(errors,[]);
    console.log('Match records: completion gate, mobile marks, tags, history, reset independence, PNG and concurrent saves passed.');
  }finally{await context.close();}
}
