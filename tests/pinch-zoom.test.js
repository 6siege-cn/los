import assert from "node:assert/strict";
import test from "node:test";

import { calculatePinchTransform, pointerPair } from "../scripts/pinch-zoom.js";

test("pointer pair reports distance and midpoint", () => {
  assert.deepEqual(
    pointerPair(
      { clientX: 10, clientY: 20 },
      { clientX: 40, clientY: 60 },
    ),
    { distance: 50, midpoint: { x: 25, y: 40 } },
  );
});

test("pinch zoom keeps the original content point under the midpoint", () => {
  const transform = calculatePinchTransform({
    start: {
      distance: 100,
      zoom: 250,
      contentX: 150,
      contentY: 200,
    },
    first: { clientX: 0, clientY: 50 },
    second: { clientX: 200, clientY: 50 },
    wrapperLeft: 0,
    wrapperTop: 0,
  });
  assert.equal(transform.zoom, 500);
  assert.equal(transform.scrollLeft, 200);
  assert.equal(transform.scrollTop, 350);
});

test("pinch zoom respects minimum and maximum limits", () => {
  const common = {
    start: { distance: 100, zoom: 250, contentX: 50, contentY: 50 },
    wrapperLeft: 0,
    wrapperTop: 0,
  };
  const minimum = calculatePinchTransform({
    ...common,
    first: { clientX: 49, clientY: 0 },
    second: { clientX: 51, clientY: 0 },
  });
  const maximum = calculatePinchTransform({
    ...common,
    first: { clientX: -500, clientY: 0 },
    second: { clientX: 500, clientY: 0 },
  });
  assert.equal(minimum.zoom, 50);
  assert.equal(maximum.zoom, 1000);
});
