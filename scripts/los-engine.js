const DEFAULT_LINE_THICKNESS = 0.025;
const PARALLEL_EPSILON = 1e-10;
const DUPLICATE_POINT_EPSILON = 1e-5;

function segmentIntersection(firstStart, firstEnd, secondStart, secondEnd) {
  const firstDx = firstEnd.x - firstStart.x;
  const firstDy = firstEnd.y - firstStart.y;
  const secondDx = secondEnd.x - secondStart.x;
  const secondDy = secondEnd.y - secondStart.y;
  const denominator = firstDx * secondDy - firstDy * secondDx;

  if (Math.abs(denominator) < PARALLEL_EPSILON) {
    return { intersects: false };
  }

  const offsetX = secondStart.x - firstStart.x;
  const offsetY = secondStart.y - firstStart.y;
  const firstFraction =
    (offsetX * secondDy - offsetY * secondDx) / denominator;
  const secondFraction =
    (offsetX * firstDy - offsetY * firstDx) / denominator;

  if (
    firstFraction < 0 ||
    firstFraction > 1 ||
    secondFraction < 0 ||
    secondFraction > 1
  ) {
    return { intersects: false };
  }

  return {
    intersects: true,
    point: {
      x: firstStart.x + firstFraction * firstDx,
      y: firstStart.y + firstFraction * firstDy,
    },
    firstFraction,
    secondFraction,
  };
}

function distance(first, second) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function distanceToSegment(point, start, end) {
  const length = distance(start, end);
  if (length === 0) return distance(point, start);

  const projection = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * (end.x - start.x) +
        (point.y - start.y) * (end.y - start.y)) /
        (length * length),
    ),
  );
  const nearest = {
    x: start.x + projection * (end.x - start.x),
    y: start.y + projection * (end.y - start.y),
  };
  return distance(point, nearest);
}

function sideOfLine(point, start, end) {
  const crossProduct =
    (end.x - start.x) * (point.y - start.y) -
    (end.y - start.y) * (point.x - start.x);
  if (Math.abs(crossProduct) < PARALLEL_EPSILON) return 0;
  return crossProduct > 0 ? 1 : -1;
}

function cellCenter(cell) {
  return { x: cell.x + 0.5, y: cell.y + 0.5 };
}

function unitDirection(start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  return length === 0 ? { x: 0, y: 0 } : { x: dx / length, y: dy / length };
}

function perpendicular(vector) {
  return { x: -vector.y, y: vector.x };
}

function normalizeWall(wall) {
  return {
    start: wall.start,
    end: wall.end,
    thickness: wall.thickness ?? 0.2,
    offset: wall.offset ?? 0,
    startExtension: wall.startExtension ?? 0,
    endExtension: wall.endExtension ?? 0,
  };
}

function wallPolygon(rawWall) {
  const wall = normalizeWall(rawWall);
  const direction = unitDirection(wall.start, wall.end);
  const normal = perpendicular(direction);
  const extendedStart = {
    x: wall.start.x - direction.x * wall.startExtension,
    y: wall.start.y - direction.y * wall.startExtension,
  };
  const extendedEnd = {
    x: wall.end.x + direction.x * wall.endExtension,
    y: wall.end.y + direction.y * wall.endExtension,
  };
  const offsetX = normal.x * wall.offset;
  const offsetY = normal.y * wall.offset;
  const halfThickness = wall.thickness / 2;

  return [
    {
      x: extendedStart.x + offsetX - normal.x * halfThickness,
      y: extendedStart.y + offsetY - normal.y * halfThickness,
    },
    {
      x: extendedEnd.x + offsetX - normal.x * halfThickness,
      y: extendedEnd.y + offsetY - normal.y * halfThickness,
    },
    {
      x: extendedEnd.x + offsetX + normal.x * halfThickness,
      y: extendedEnd.y + offsetY + normal.y * halfThickness,
    },
    {
      x: extendedStart.x + offsetX + normal.x * halfThickness,
      y: extendedStart.y + offsetY + normal.y * halfThickness,
    },
  ];
}

function stripEdges(start, end, lineThickness) {
  const normal = perpendicular(unitDirection(start, end));
  const halfThickness = lineThickness / 2;
  const positive = {
    x: normal.x * halfThickness,
    y: normal.y * halfThickness,
  };
  const negative = { x: -positive.x, y: -positive.y };

  return [
    [
      { x: start.x + positive.x, y: start.y + positive.y },
      { x: end.x + positive.x, y: end.y + positive.y },
    ],
    [
      { x: start.x + negative.x, y: start.y + negative.y },
      { x: end.x + negative.x, y: end.y + negative.y },
    ],
  ];
}

function segmentHitsPolygon(start, end, polygon) {
  return polygon.some((edgeStart, edgeIndex) => {
    const edgeEnd = polygon[(edgeIndex + 1) % polygon.length];
    return segmentIntersection(start, end, edgeStart, edgeEnd).intersects;
  });
}

function polygonProtrudesAcrossLine(polygon, lineStart, lineEnd) {
  let hasPositiveSide = false;
  let hasNegativeSide = false;
  for (const vertex of polygon) {
    if (distanceToSegment(vertex, lineStart, lineEnd) <= 0) continue;
    const side = sideOfLine(vertex, lineStart, lineEnd);
    if (side > 0) hasPositiveSide = true;
    if (side < 0) hasNegativeSide = true;
    if (hasPositiveSide && hasNegativeSide) return true;
  }
  return false;
}

function inspectPolygonIntersections(lineStart, lineEnd, polygon, wallIndex) {
  const intersections = [];
  polygon.forEach((edgeStart, edgeIndex) => {
    const edgeEnd = polygon[(edgeIndex + 1) % polygon.length];
    const intersection = segmentIntersection(lineStart, lineEnd, edgeStart, edgeEnd);
    if (!intersection.intersects) return;
    intersections.push({
      wallIndex,
      point: intersection.point,
      edgeIndex,
      distance: 0,
      side: sideOfLine(intersection.point, lineStart, lineEnd),
    });
  });

  polygon.forEach((vertex, edgeIndex) => {
    const vertexDistance = distanceToSegment(vertex, lineStart, lineEnd);
    if (vertexDistance > 0) return;
    const duplicate = intersections.some(
      (item) =>
        Math.abs(item.point.x - vertex.x) < DUPLICATE_POINT_EPSILON &&
        Math.abs(item.point.y - vertex.y) < DUPLICATE_POINT_EPSILON,
    );
    if (!duplicate) {
      intersections.push({
        wallIndex,
        point: vertex,
        edgeIndex,
        distance: vertexDistance,
        side: sideOfLine(vertex, lineStart, lineEnd),
      });
    }
  });

  return {
    intersections,
    protrudes: polygonProtrudesAcrossLine(polygon, lineStart, lineEnd),
  };
}

function traceWalls(startCell, endCell, walls, lineThickness) {
  const start = cellCenter(startCell);
  const end = cellCenter(endCell);
  const [positiveEdge, negativeEdge] = stripEdges(start, end, lineThickness);
  const intersections = [];
  const protrudingWallIndices = [];
  const blockingWallIndices = [];

  walls.forEach((wall, wallIndex) => {
    const polygon = wallPolygon(wall);
    const diagnostics = inspectPolygonIntersections(start, end, polygon, wallIndex);
    intersections.push(...diagnostics.intersections);
    if (diagnostics.protrudes) protrudingWallIndices.push(wallIndex);
    if (
      segmentHitsPolygon(...positiveEdge, polygon) &&
      segmentHitsPolygon(...negativeEdge, polygon)
    ) {
      blockingWallIndices.push(wallIndex);
    }
  });

  return {
    hasLineOfSight: blockingWallIndices.length === 0,
    intersections,
    protrudingWallIndices,
    blockingWallIndices,
  };
}

function segmentHitsSmokeCell(start, end, cellX, cellY) {
  const polygon = [
    { x: cellX, y: cellY },
    { x: cellX + 1, y: cellY },
    { x: cellX + 1, y: cellY + 1 },
    { x: cellX, y: cellY + 1 },
  ];
  if (segmentHitsPolygon(start, end, polygon)) return true;
  // Smoke includes its boundary. This also catches a sight line that begins in
  // smoke or starts exactly on its edge and travels out of it.
  const startInside =
    start.x >= cellX && start.x <= cellX + 1 && start.y >= cellY && start.y <= cellY + 1;
  const endInside =
    end.x >= cellX && end.x <= cellX + 1 && end.y >= cellY && end.y <= cellY + 1;
  return startInside || endInside;
}

function smokeBlocksLine(start, end, smokes) {
  for (const smoke of smokes) {
    for (let dx = 0; dx < smoke.pattern.width; dx += 1) {
      for (let dy = 0; dy < smoke.pattern.height; dy += 1) {
        const cellX = smoke.position.x + dx;
        const cellY = smoke.position.y + dy;
        if (segmentHitsSmokeCell(start, end, cellX, cellY)) {
          return true;
        }
      }
    }
  }
  return false;
}

function activeWalls(map, brokenWalls) {
  const walls = [...map.walls];
  const references = map.walls.map((_, index) => ({ kind: "main", index }));
  const groups = [
    ["red", map.redWalls, brokenWalls.red],
    ["orange", map.orangeWalls, brokenWalls.orange],
    ["window", map.windows, brokenWalls.windows],
  ];
  for (const [kind, group, broken] of groups) {
    group.forEach((wall, index) => {
      if (broken.has(index)) return;
      walls.push(wall);
      references.push({ kind, index });
    });
  }
  return { walls, references };
}

export function checkLineOfSight({
  map,
  blue,
  orange,
  brokenWalls,
  smokes = [],
  lineThickness = DEFAULT_LINE_THICKNESS,
}) {
  const active = activeWalls(map, brokenWalls);
  const wallTrace = traceWalls(blue, orange, active.walls, lineThickness);
  const blockingWalls = wallTrace.blockingWallIndices.map(
    (index) => active.references[index],
  );

  if (!wallTrace.hasLineOfSight) {
    return {
      hasLineOfSight: false,
      blockedByWalls: true,
      blockedBySmoke: false,
      blockingWalls,
      intersections: wallTrace.intersections,
      protrudingWallIndices: wallTrace.protrudingWallIndices,
    };
  }

  const blockedBySmoke = smokeBlocksLine(
    cellCenter(blue),
    cellCenter(orange),
    smokes,
  );
  return {
    hasLineOfSight: !blockedBySmoke,
    blockedByWalls: false,
    blockedBySmoke,
    blockingWalls: [],
    intersections: wallTrace.intersections,
    protrudingWallIndices: wallTrace.protrudingWallIndices,
  };
}

export const geometry = { segmentIntersection, wallPolygon };
