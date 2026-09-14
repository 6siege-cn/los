import assert from 'node:assert/strict';
import {join} from 'node:path';
import {readFile} from 'node:fs/promises';
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
    await page.getByRole('combobox',{name:'获胜方',exact:true}).selectOption('attack');
    await page.getByRole('combobox',{name:'结束方式',exact:true}).selectOption('拆除炸弹');
    await page.getByRole('combobox',{name:'结束回合',exact:true}).selectOption('+');
    await page.locator('.match-tag-choices').getByRole('button',{name:'RUSH',exact:true}).tap();
    await page.getByRole('textbox',{name:'自定义标签',exact:true}).fill('合作突击');await page.getByRole('button',{name:'添加标签',exact:true}).tap();
    await page.getByRole('textbox',{name:'自定义标签',exact:true}).fill(' rush ');await page.getByRole('button',{name:'添加标签',exact:true}).tap();
    assert.equal(await page.locator('.match-card .match-tag').count(),2);
    const ids=await page.locator('[data-mark-id]').evaluateAll(nodes=>nodes.slice(0,4).map(n=>n.dataset.markId));
    const cdp=await context.newCDPSession(page);
    for(const [i,label] of ['向上大拇指','向下大拇指','骷髅头','瞄准准星'].entries()){
      const target=page.locator(`[data-mark-id="${ids[i]}"]`);await target.scrollIntoViewIfNeeded();const box=await target.boundingBox();
      const point={x:box.x+box.width/2,y:box.y+box.width/2};
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await page.waitForTimeout(550);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await page.getByRole('button',{name:label,exact:true}).tap();
    }
    assert.equal(await page.locator('.match-card .match-mark').count(),4);
    // Keyboard alternative and clear, then replace, do not trigger draft actions.
    await page.locator(`[data-mark-id="${ids[0]}"]`).focus();await page.keyboard.press('Enter');await page.getByRole('button',{name:'清除标记',exact:true}).tap();
    assert.equal(await page.locator('.match-card .match-mark').count(),3);
    await page.locator(`[data-mark-id="${ids[0]}"]`).focus();await page.keyboard.press('Enter');await page.getByRole('button',{name:'向上大拇指',exact:true}).tap();
    assert.equal(await page.locator('.sequence-track .done').count(),14);
    if(output)await page.screenshot({path:join(output,'match-editor-mobile.png')});
    await page.getByRole('button',{name:'保存对局记录',exact:true}).tap();
    await page.getByRole('button',{name:'下载图片',exact:true}).waitFor();
    assert.ok((await page.locator('.match-status').innerText()).includes('已保存'));
    const record=await page.evaluate(async()=>{const {createMatchStore}=await import('./src/match-records.js');const rows=await createMatchStore(indexedDB).records();if(rows.length!==1)throw Error('Unexpected record count');return rows[0];});
    assert.equal(record.history[0].type,'ban');assert.equal(record.history[1].operatorId,'altsledge');assert.equal(record.history.length,14);
    assert.equal(Object.keys(record.marks).length,4);assert.deepEqual(record.tags,['RUSH','合作突击']);assert.equal(record.endRound,'+');
    for(const [width,height] of [[390,844],[1366,900],[667,300]]){
      await page.setViewportSize({width,height});await page.locator('.match-card').scrollIntoViewIfNeeded();
      assert.equal(await page.locator('.match-dialog').evaluate(node=>node.scrollWidth<=node.clientWidth),true);
      if(output)await page.screenshot({path:join(output,`match-detail-${width}x${height}.png`)});
    }
    const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'下载图片',exact:true}).click();const download=await downloadPromise;
    assert.equal(await download.failure(),null);assert.match(download.suggestedFilename(),/\.png$/);
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
    assert.deepEqual(errors,[]);
    console.log('Match records: completion gate, mobile marks, tags, history, reset independence, PNG and concurrent saves passed.');
  }finally{await context.close();}
}
