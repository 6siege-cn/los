import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(
  new URL("../styles/standalone.css", import.meta.url),
  "utf8",
);
const app = readFileSync(new URL("../scripts/app.js", import.meta.url), "utf8");

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
