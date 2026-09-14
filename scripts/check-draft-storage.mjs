import assert from 'node:assert/strict';
import {storageKey} from '../operator-selection/src/draft-storage.js';
export async function checkDraftStorage(page){
  const stored=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),storageKey);
  const history=()=>page.locator('.sequence-track .done').count();
  await page.locator('.reset-button').click();
  await page.locator('.settings-button').click();
  await page.locator('.order-select').selectOption('time');
  await page.getByRole('checkbox',{name:'DIY',exact:true}).uncheck();
  await page.getByRole('button',{name:'完成',exact:true}).click();
  await page.locator('#tab-defense').click();await page.locator('[data-operator-id="smoke"]').click();
  await page.locator('[data-operator-id="altsledge"]').click();
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.history.length===2,storageKey);
  const before=await stored();await page.reload();
  assert.equal(await history(),2);assert.equal(await page.locator('.order-select').inputValue(),'time');
  assert.equal(await page.locator('.panel-link [data-skill-id="altsledge"]').count(),1);
  assert.equal(await page.locator('.ban-slot[data-skill-id="smoke"]').count(),1);
  assert.deepEqual((await stored()).history,before.history);
  await page.locator('.undo-button').click();assert.equal(await page.locator('.panel-link,.info-card img').count(),0);
  await page.locator('.undo-button').click();assert.equal(await history(),0);
  await page.locator('.settings-button').click();assert.equal(await page.getByRole('checkbox',{name:'DIY',exact:true}).isChecked(),false);
  await page.getByRole('button',{name:'完成',exact:true}).click();
  const second=await page.context().newPage();
  try{
    await second.goto(page.url());
    await page.locator('#tab-attack').click();await page.locator('[data-operator-id="sledge"]').click();
    await second.locator('.storage-dialog').waitFor({state:'visible'});
    await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.history.length===1,storageKey);
    const newest=await stored();
    await second.getByRole('button',{name:'载入最新记录',exact:true}).click();
    await second.waitForFunction(()=>document.querySelectorAll('.sequence-track .done').length===1);
    assert.deepEqual((await stored()).history,newest.history);
  }finally{await second.close();}
  await page.locator('.reset-button').click();
  await page.waitForFunction(key=>localStorage.getItem(key)===null,storageKey);
  await page.reload();assert.equal(await history(),0);assert.equal(await page.locator('.order-select').inputValue(),'speedWeapon');
  await page.evaluate(key=>localStorage.setItem(key,'{broken'),storageKey);await page.reload();
  await page.locator('.storage-dialog').waitFor({state:'visible'});
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),storageKey),'{broken');
  await page.getByRole('button',{name:'清除旧记录，开始新局',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('.storage-dialog[open]'));
  assert.equal(await history(),0);
}
