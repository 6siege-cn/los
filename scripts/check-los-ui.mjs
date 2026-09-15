import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname, join, extname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
let chromium;
try { ({chromium} = require('playwright')); }
catch { ({chromium} = createRequire(join(dirname(process.execPath), '../package.json'))('playwright')); }
const root = fileURLToPath(new URL('../', import.meta.url));
const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.jpg':'image/jpeg', '.svg':'image/svg+xml'};
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const path = resolve(root, '.' + decodeURIComponent(url.pathname) + (url.pathname.endsWith('/') ? 'index.html' : ''));
    if (!path.startsWith(root)) { res.writeHead(403).end(); return; }
    res.writeHead(200, {'Content-Type': types[extname(path)] || 'application/octet-stream'}).end(await readFile(path));
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({channel:'msedge', headless:true});
const output = resolve(root, '../los-ui-qa');
await mkdir(output, {recursive:true});
try {
  for (const [width,height] of [[1440,900],[768,1024],[390,844],[320,568],[844,390],[667,300]]) {
    const context = await browser.newContext({viewport:{width,height}, isMobile:width<900, hasTouch:width<900});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => document.querySelector('#map-canvas').width > 800 && document.querySelector('#map-select').options.length > 0);
    const geometry = await page.evaluate(() => {
      const map = document.querySelector('#canvas-wrapper').getBoundingClientRect();
      const tools = document.querySelector('.calculator-controls').getBoundingClientRect();
      return {overflow:document.documentElement.scrollWidth > innerWidth, bottom:tools.bottom, mapHeight:map.height, overlap:Math.max(map.left,tools.left)<Math.min(map.right,tools.right) && Math.max(map.top,tools.top)<Math.min(map.bottom,tools.bottom)};
    });
    assert.equal(geometry.overflow, false, `${width}: horizontal overflow`);
    assert.equal(geometry.overlap, false, `${width}: controls cover map`);
    assert.ok(geometry.bottom <= height + 1, `${width}: tools outside viewport ${JSON.stringify(geometry)}`);
    assert.ok(geometry.mapHeight >= 130);
    await page.locator('#zoom-in').click();
    await page.locator('#zoom-reset').click();
    await page.locator('#place-blue').click();
    assert.equal(await page.locator('#place-blue').getAttribute('aria-pressed'), 'true');
    const canvas = page.locator('#map-canvas');
    await canvas.click({position:{x:100,y:100}});
    await page.locator('#place-orange').click();
    await canvas.click({position:{x:145,y:145}});
    await page.locator('#los-result').waitFor({state:'visible'});
    await page.locator('[data-smoke-width="2"][data-smoke-height="2"]').click();
    await canvas.click({position:{x:180,y:100}});
    await page.locator('#clear-smokes').waitFor({state:'visible'});
    await page.screenshot({path:join(output, `${width}x${height}.png`)});
    await page.locator('#clear-smokes').click();
    await page.locator('#reset-map').click();
    assert.equal(await page.locator('#los-result').isVisible(), false);
    await page.locator('#map-select').selectOption({index:1});
    assert.deepEqual(errors, []);
    console.log(`${width}x${height}: layout, placement, automatic result, smoke, reset and map switching passed`);
    await context.close();
  }
} finally { await browser.close(); await new Promise(r => server.close(r)); }
