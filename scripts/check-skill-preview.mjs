import assert from 'node:assert/strict';
import {join} from 'node:path';
export async function checkSkillPreview(page,output){
  const dialog=page.locator('.skill-preview');
  const history=()=>page.locator('.sequence-track .done').count();
  const close=()=>page.getByRole('button',{name:'关闭技能',exact:true}).click();
  async function hold(locator){
    await locator.scrollIntoViewIfNeeded();const b=await locator.boundingBox();
    await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();
    await page.waitForTimeout(520);await page.mouse.up();await dialog.waitFor({state:'visible'});
  }
  await page.locator('.reset-button').click();await page.setViewportSize({width:1440,height:900});
  await hold(page.locator('[data-operator-id="sledge"]'));
  const text=await page.locator('.skill-preview-text').innerText();
  assert.ok(text.includes('战术突破锤'));assert.equal(await history(),0);
  assert.equal(await dialog.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;}),true);
  if(output)await page.screenshot({path:join(output,'skill-desktop.png')});await close();
  await page.locator('[data-operator-id="sledge"]').click();assert.equal(await history(),1);
  const pages=page.context().pages().length;
  await hold(page.locator('.panel-link [data-skill-id="sledge"]'));
  assert.equal(page.context().pages().length,pages);assert.equal(await history(),1);await close();
  await page.locator('[data-operator-id="smoke"]').click();assert.equal(await history(),2);
  const side=await page.locator('#tab-defense').getAttribute('aria-pressed');
  await hold(page.locator('.ban-slot[data-skill-id="smoke"]'));
  assert.ok((await page.locator('.skill-preview-text').innerText()).includes('毒气'));
  assert.equal(await page.locator('#tab-defense').getAttribute('aria-pressed'),side);await close();
  await hold(page.locator('[data-operator-id="smoke"]'));assert.equal(await history(),2);await close();
  await page.locator('#tab-attack').click();await hold(page.locator('[data-operator-id="altsledge"]'));
  assert.equal(await page.locator('.skill-preview-text').innerText(),text);
  assert.ok((await page.locator('#skill-preview-title').innerText()).includes('ALT'));await close();
  await page.locator('[data-operator-id="recruit_attack_1"]').focus();await page.keyboard.press('F1');
  assert.equal(await page.locator('.skill-preview-text').innerText(),'暂无技能描述');await page.keyboard.press('Escape');
  await page.locator('.reset-button').click();
  const b=await page.locator('[data-operator-id="sledge"]').boundingBox();
  await page.mouse.move(b.x+10,b.y+10);await page.mouse.down();await page.mouse.move(b.x+25,b.y+10);
  await page.waitForTimeout(520);await page.mouse.up();assert.equal(await dialog.isVisible(),false);assert.equal(await history(),0);
  const mobile=await page.context().browser().newContext({viewport:{width:320,height:568},isMobile:true,hasTouch:true});
  try{
    const touch=await mobile.newPage();await touch.goto(page.url());
    const target=touch.locator('[data-operator-id="brava"]');await target.waitFor();await target.scrollIntoViewIfNeeded();
    const cdp=await mobile.newCDPSession(touch);
    const box=await target.boundingBox(),point={x:box.x+box.width/2,y:box.y+box.height/2};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
    await touch.waitForTimeout(520);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await touch.locator('.skill-preview').waitFor({state:'visible'});
    assert.equal(await touch.locator('.sequence-track .done').count(),0);
    assert.equal(await touch.locator('.skill-preview').evaluate(el=>{const r=el.getBoundingClientRect();return Math.abs(r.bottom-innerHeight)<1&&r.height<=innerHeight/2+1&&r.left===0&&Math.abs(r.width-innerWidth)<1;}),true);
    assert.equal(await touch.locator('.skill-preview-text').evaluate(el=>el.scrollHeight>el.clientHeight),true);
    if(output)await touch.screenshot({path:join(output,'skill-mobile.png')});
    await touch.getByRole('button',{name:'关闭技能',exact:true}).tap();
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x,y:point.y-45}]});
    await touch.waitForTimeout(520);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.equal(await touch.locator('.skill-preview').isVisible(),false);
    assert.equal(await touch.locator('.sequence-track .done').count(),0);
  }finally{await mobile.close();}
}
