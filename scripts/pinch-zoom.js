export function pointerPair(first, second) {
  return {
    distance: Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY),
    midpoint: {
      x: (first.clientX + second.clientX) / 2,
      y: (first.clientY + second.clientY) / 2,
    },
  };
}

export function calculatePinchTransform({
  start,
  first,
  second,
  wrapperLeft,
  wrapperTop,
  minZoom = 50,
  maxZoom = 1000,
}) {
  const current = pointerPair(first, second);
  const distanceRatio = start.distance > 0 ? current.distance / start.distance : 1;
  const zoom = Math.round(
    Math.max(minZoom, Math.min(maxZoom, start.zoom * distanceRatio)),
  );
  const contentScale = zoom / start.zoom;

  return {
    zoom,
    scrollLeft:
      start.contentX * contentScale - (current.midpoint.x - wrapperLeft),
    scrollTop:
      start.contentY * contentScale - (current.midpoint.y - wrapperTop),
  };
}
