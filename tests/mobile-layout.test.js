import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(
  new URL("../styles/standalone.css", import.meta.url),
  "utf8",
);
const app = readFileSync(new URL("../scripts/app.js", import.meta.url), "utf8");
const operatorCss = readFileSync(
  new URL("../styles/operator-selection.css", import.meta.url),
  "utf8",
);

test("page declares a mobile viewport and mobile map guidance", () => {
  assert.match(html, /name="viewport"/);
  assert.match(html, /class="mobile-map-help"/);
});

test("line of sight is automatic and has an accessible live result", () => {
  assert.doesNotMatch(html, /id="check-los"/);
  assert.match(html, /id="los-result"[\s\S]*aria-live="polite"/);
  assert.match(app, /requestAnimationFrame/);
  assert.match(app, /calculateCurrentLineOfSight/);
});

test("mobile controls remain in document flow with touch-sized targets", () => {
  assert.match(css, /@media \(max-width: 768px\)/);
  assert.match(css, /\.calculator-controls\s*\{[^}]*position: static/s);
  assert.match(css, /\.zoom-controls button\s*\{[^}]*height: 48px/s);
  assert.match(css, /\.canvas-wrapper\s*\{[^}]*58svh/s);
});

test("mobile view starts enlarged and supports drag-to-pan", () => {
  assert.match(app, /max-width: 768px[^?]*\? 250 : 100/);
  assert.match(app, /state\.panGesture/);
  assert.match(app, /canvasWrapper\.scrollLeft = state\.panGesture\.scrollLeft/);
});

test("map supports two-pointer pinch zoom", () => {
  assert.match(app, /activeTouchPointers/);
  assert.match(app, /beginPinchGesture/);
  assert.match(app, /updatePinchGesture/);
  assert.match(html, /双指缩放/);
});

test("visible interface copy is localized in Simplified Chinese", () => {
  assert.match(html, /<html lang="zh-CN">/);
  assert.match(html, /视线测量工具/);
  assert.match(html, /放置蓝方干员/);
  assert.match(app, /视线：可见/);
  assert.match(app, /杜斯妥也夫斯基咖啡馆/);
});

test("the line-of-sight rules panel is not rendered", () => {
  assert.doesNotMatch(html, /视线规则/);
  assert.doesNotMatch(html, /class="tactical-list"/);
});

test("the standalone line-of-sight title panel is not rendered", () => {
  assert.doesNotMatch(html, /id="page-title"/);
  assert.doesNotMatch(html, /class="tactical-header"/);
  assert.doesNotMatch(html, /class="tactical-header-decoration"/);
});

test("header branding and footer contact details are present", () => {
  assert.match(html, /<h1>《彩虹六号：围攻》桌游<\/h1>/);
  assert.match(html, /<p>QQ群：793079480<\/p>/);
  assert.doesNotMatch(html, /<h1>进阶工具<\/h1>/);
});

test("operator selection is linked beside the active sight tab", () => {
  assert.match(
    html,
    /active-nav-link[^>]*>视线测量<\/a>[\s\S]*href="\.\/operator-selection\/index\.html"[^>]*>干员选择<\/a>/,
  );
  assert.doesNotMatch(html, /nav-placeholder[^>]*aria-disabled="true"/);
  assert.match(css, /\.hidden-nav ul\s*\{[^}]*flex-direction: row/s);
});

test("operator grid keeps exactly ten square portraits per row", () => {
  assert.match(
    operatorCss,
    /\.operator-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(10,\s*minmax\(0,\s*1fr\)\)/,
  );
  assert.match(operatorCss, /\.operator-button\s*\{[^}]*aspect-ratio:\s*1/s);
  assert.doesNotMatch(
    operatorCss,
    /\.operator-grid\s*\{\s*grid-template-columns:\s*repeat\(auto-fill/m,
  );
});

test("weapon dice overlap from left to right while the group stays centered", () => {
  assert.match(operatorCss, /\.dice-row, \.stat-slot\s*\{[^}]*justify-content:center[^}]*gap:0/s);
  assert.match(operatorCss, /\.dice-row \.token\s*\{[^}]*position:relative[^}]*flex:0 0 27%/s);
  assert.match(operatorCss, /\.dice-row \.token \+ \.token\s*\{[^}]*margin-left:-4\.5%/s);
});
