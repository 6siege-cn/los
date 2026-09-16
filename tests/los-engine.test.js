import assert from "node:assert/strict";
import test from "node:test";

import { checkLineOfSight, geometry } from "../scripts/los-engine.js";

const emptyMap = {
  walls: [],
  redWalls: [],
  orangeWalls: [],
  windows: [],
};

const noBrokenWalls = () => ({
  red: new Set(),
  orange: new Set(),
  windows: new Set(),
});

const verticalWall = {
  start: { x: 1, y: 0 },
  end: { x: 1, y: 1 },
  thickness: 0.2,
};

test("inclusive segment intersection", () => {
  const result = geometry.segmentIntersection(
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 1, y: -1 },
    { x: 1, y: 1 },
  );
  assert.equal(result.intersects, true);
  assert.deepEqual(result.point, { x: 1, y: 0 });
});

test("parallel segments do not intersect", () => {
  const result = geometry.segmentIntersection(
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 1, y: 0 },
    { x: 3, y: 0 },
  );
  assert.equal(result.intersects, false);
});

test("a permanent wall blocks the line of sight", () => {
  const result = checkLineOfSight({
    map: { ...emptyMap, walls: [verticalWall] },
    blue: { x: 0, y: 0 },
    orange: { x: 2, y: 0 },
    brokenWalls: noBrokenWalls(),
  });
  assert.equal(result.hasLineOfSight, false);
  assert.equal(result.blockedByWalls, true);
  assert.deepEqual(result.blockingWalls, [{ kind: "main", index: 0 }]);
});

test("an opened optional wall is ignored", () => {
  const map = { ...emptyMap, redWalls: [verticalWall] };
  const intact = checkLineOfSight({
    map,
    blue: { x: 0, y: 0 },
    orange: { x: 2, y: 0 },
    brokenWalls: noBrokenWalls(),
  });
  const opened = checkLineOfSight({
    map,
    blue: { x: 0, y: 0 },
    orange: { x: 2, y: 0 },
    brokenWalls: { ...noBrokenWalls(), red: new Set([0]) },
  });
  assert.equal(intact.hasLineOfSight, false);
  assert.equal(opened.hasLineOfSight, true);
});

test("smoke between non-adjacent players blocks sight", () => {
  const result = checkLineOfSight({
    map: emptyMap,
    blue: { x: 0, y: 0 },
    orange: { x: 4, y: 0 },
    brokenWalls: noBrokenWalls(),
    smokes: [
      {
        position: { x: 2, y: 0 },
        pattern: { width: 1, height: 1 },
      },
    ],
  });
  assert.equal(result.hasLineOfSight, false);
  assert.equal(result.blockedBySmoke, true);
});

test("smoke directly between nearby players blocks sight", () => {
  for (const [blue, orange, smoke] of [
    [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 0 }],
    [{ x: 0, y: 0 }, { x: 0, y: 2 }, { x: 0, y: 1 }],
  ]) {
    const result = checkLineOfSight({
      map: emptyMap,
      blue,
      orange,
      brokenWalls: noBrokenWalls(),
      smokes: [
        {
          position: smoke,
          pattern: { width: 1, height: 1 },
        },
      ],
    });
    assert.equal(result.hasLineOfSight, false);
    assert.equal(result.blockedBySmoke, true);
  }
});
