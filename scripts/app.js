import { checkLineOfSight as calculateLineOfSight } from "./los-engine.js";

const canvas = document.querySelector("#map-canvas");
const context = canvas.getContext("2d");
const canvasWrapper = document.querySelector("#canvas-wrapper");
const canvasContainer = document.querySelector("#canvas-container");
const mapSelect = document.querySelector("#map-select");
const tooltip = document.querySelector("#drag-tooltip");
const placeBlueButton = document.querySelector("#place-blue");
const placeOrangeButton = document.querySelector("#place-orange");
const resetButton = document.querySelector("#reset-map");
const clearSmokesButton = document.querySelector("#clear-smokes");
const smokeInstructions = document.querySelector("#smoke-instructions");
const resultPanel = document.querySelector("#los-result");
const resultIcon = document.querySelector("#los-result-icon");
const resultText = document.querySelector("#los-result-text");
const resultReason = document.querySelector("#los-result-reason");
const zoomOutButton = document.querySelector("#zoom-out");
const zoomResetButton = document.querySelector("#zoom-reset");
const zoomInButton = document.querySelector("#zoom-in");
const toast = document.querySelector("#status-toast");
const smokeButtons = [...document.querySelectorAll("[data-smoke-width]")];

const WALL_COLORS = {
  main: "#dbdfae",
  red: "#d32f2f",
  orange: "#f57c00",
  window: "#0288d1",
};

let scheduledCalculation = null;

const state = {
  maps: [],
  map: null,
  image: null,
  blue: null,
  orange: null,
  activeTeam: null,
  brokenWalls: { red: new Set(), orange: new Set(), windows: new Set() },
  smokes: [],
  selectedSmokePattern: null,
  hoverCell: null,
  hoverWall: null,
  draggingTeam: null,
  panGesture: null,
  pendingCanvasClick: false,
  result: null,
  zoom: 100,
};

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("visible"), 2200);
}

function invalidateResult() {
  if (!state.blue || !state.orange || !state.map) {
    state.result = null;
    resultPanel.hidden = true;
    if (scheduledCalculation !== null) {
      cancelAnimationFrame(scheduledCalculation);
      scheduledCalculation = null;
    }
    return;
  }

  if (scheduledCalculation === null) {
    scheduledCalculation = requestAnimationFrame(() => {
      scheduledCalculation = null;
      calculateCurrentLineOfSight();
    });
  }
}

function normalizeWall(raw) {
  return {
    start: raw.start,
    end: raw.end,
    thickness: raw.thickness ?? 0.2,
    offset: raw.offset ?? 0,
    startExtension: raw.startExtension ?? 0,
    endExtension: raw.endExtension ?? 0,
  };
}

function resetMapState() {
  const map = state.map;
  state.blue = null;
  state.orange = null;
  state.activeTeam = null;
  state.smokes = [];
  state.selectedSmokePattern = null;
  state.hoverCell = null;
  state.hoverWall = null;
  state.draggingTeam = null;
  state.brokenWalls = {
    red: new Set(map.redWalls.map((_, index) => index)),
    orange: new Set(map.orangeWalls.map((_, index) => index)),
    windows: new Set(map.windows.map((_, index) => index)),
  };
  invalidateResult();
  updateControls();
}

function loadMap(mapId) {
  const selected = state.maps.find((map) => map.id === mapId);
  if (!selected) return;
  state.map = selected;
  resetMapState();

  const image = new Image();
  image.addEventListener("load", () => {
    if (state.map !== selected) return;
    state.image = image;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvasWrapper.scrollLeft = 0;
    canvasWrapper.scrollTop = 0;
    draw();
  });
  image.addEventListener("error", () => {
    showToast(`Could not load ${selected.name}`);
  });
  state.image = null;
  image.src = `./assets/${selected.id}.jpg`;
  draw();
}

function gridMetrics() {
  if (!state.map) return null;
  const { gridOffset, gridSize } = state.map;
  const width = state.image?.naturalWidth ?? canvas.width;
  const height = state.image?.naturalHeight ?? canvas.height;
  const availableWidth = width - gridOffset.x - gridOffset.right;
  const availableHeight = height - gridOffset.y - gridOffset.bottom;
  return {
    left: gridOffset.x,
    top: gridOffset.y,
    right: gridOffset.x + gridSize.width * Math.min(
      availableWidth / gridSize.width,
      availableHeight / gridSize.height,
    ),
    bottom: gridOffset.y + gridSize.height * Math.min(
      availableWidth / gridSize.width,
      availableHeight / gridSize.height,
    ),
    cellSize: Math.min(
      availableWidth / gridSize.width,
      availableHeight / gridSize.height,
    ),
  };
}

function eventPoint(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
    y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
  };
}

function gridCellAt(point) {
  const metrics = gridMetrics();
  if (!metrics || !state.map) return null;
  if (
    point.x < metrics.left ||
    point.y < metrics.top ||
    point.x > metrics.right ||
    point.y > metrics.bottom
  ) {
    return null;
  }
  const cell = {
    x: Math.floor((point.x - metrics.left) / metrics.cellSize),
    y: Math.floor((point.y - metrics.top) / metrics.cellSize),
  };
  if (
    cell.x < 0 ||
    cell.y < 0 ||
    cell.x >= state.map.gridSize.width ||
    cell.y >= state.map.gridSize.height
  ) {
    return null;
  }
  return cell;
}

function cellCenter(cell) {
  const metrics = gridMetrics();
  return {
    x: metrics.left + (cell.x + 0.5) * metrics.cellSize,
    y: metrics.top + (cell.y + 0.5) * metrics.cellSize,
  };
}

function unitDirection(start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  return length === 0 ? { x: 0, y: 0 } : { x: dx / length, y: dy / length };
}

function wallPolygon(wall) {
  const normalized = normalizeWall(wall);
  const direction = unitDirection(normalized.start, normalized.end);
  const normal = { x: -direction.y, y: direction.x };
  const start = {
    x: normalized.start.x - direction.x * normalized.startExtension,
    y: normalized.start.y - direction.y * normalized.startExtension,
  };
  const end = {
    x: normalized.end.x + direction.x * normalized.endExtension,
    y: normalized.end.y + direction.y * normalized.endExtension,
  };
  const offset = {
    x: normal.x * normalized.offset,
    y: normal.y * normalized.offset,
  };
  const halfThickness = normalized.thickness / 2;
  return [
    {
      x: start.x + offset.x - normal.x * halfThickness,
      y: start.y + offset.y - normal.y * halfThickness,
    },
    {
      x: end.x + offset.x - normal.x * halfThickness,
      y: end.y + offset.y - normal.y * halfThickness,
    },
    {
      x: end.x + offset.x + normal.x * halfThickness,
      y: end.y + offset.y + normal.y * halfThickness,
    },
    {
      x: start.x + offset.x + normal.x * halfThickness,
      y: start.y + offset.y + normal.y * halfThickness,
    },
  ];
}

function gridPointToCanvas(point) {
  const metrics = gridMetrics();
  return {
    x: metrics.left + point.x * metrics.cellSize,
    y: metrics.top + point.y * metrics.cellSize,
  };
}

function canvasWallPolygon(wall) {
  return wallPolygon(wall).map(gridPointToCanvas);
}

function triangleArea(a, b, c) {
  return 0.5 * Math.abs(
    a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y),
  );
}

function pointInTriangle(point, a, b, c) {
  const area = triangleArea(a, b, c);
  const parts =
    triangleArea(point, b, c) +
    triangleArea(a, point, c) +
    triangleArea(a, b, point);
  return Math.abs(area - parts) < 0.01;
}

function pointInPolygon(point, polygon) {
  return (
    pointInTriangle(point, polygon[0], polygon[1], polygon[2]) ||
    pointInTriangle(point, polygon[0], polygon[2], polygon[3])
  );
}

function findOptionalWall(point) {
  if (!state.map) return null;
  const groups = [
    ["red", state.map.redWalls],
    ["orange", state.map.orangeWalls],
    ["windows", state.map.windows],
  ];
  for (const [kind, walls] of groups) {
    for (let index = walls.length - 1; index >= 0; index -= 1) {
      if (pointInPolygon(point, canvasWallPolygon(walls[index]))) {
        return { kind, index };
      }
    }
  }
  return null;
}

function playerAt(point) {
  const metrics = gridMetrics();
  if (!metrics) return null;
  const radius = metrics.cellSize / 3;
  for (const team of ["orange", "blue"]) {
    const player = state[team];
    if (!player) continue;
    const center = cellCenter(player);
    if (Math.hypot(point.x - center.x, point.y - center.y) <= radius) {
      return team;
    }
  }
  return null;
}

function smokeAt(cell) {
  for (let index = state.smokes.length - 1; index >= 0; index -= 1) {
    const smoke = state.smokes[index];
    if (
      cell.x >= smoke.position.x &&
      cell.x < smoke.position.x + smoke.pattern.width &&
      cell.y >= smoke.position.y &&
      cell.y < smoke.position.y + smoke.pattern.height
    ) {
      return index;
    }
  }
  return -1;
}

function toggleOptionalWall(hit) {
  const indices = state.brokenWalls[hit.kind];
  if (indices.has(hit.index)) {
    indices.delete(hit.index);
  } else {
    indices.add(hit.index);
  }
  invalidateResult();
  draw();
}

function placeSelectedPlayer(cell) {
  if (state.activeTeam) {
    state[state.activeTeam] = { ...cell };
    state.activeTeam = null;
  } else if (!state.blue) {
    state.blue = { ...cell };
  } else if (!state.orange) {
    state.orange = { ...cell };
  } else {
    return false;
  }
  invalidateResult();
  updateControls();
  draw();
  return true;
}

function handleCanvasAction(point) {
  const cell = gridCellAt(point);
  if (!cell) return;

  if (state.selectedSmokePattern) {
    const pattern = state.selectedSmokePattern;
    if (
      cell.x + pattern.width <= state.map.gridSize.width &&
      cell.y + pattern.height <= state.map.gridSize.height
    ) {
      state.smokes.push({ position: { ...cell }, pattern: { ...pattern } });
      state.selectedSmokePattern = null;
      invalidateResult();
      updateControls();
      draw();
    }
    return;
  }

  if (!state.activeTeam) {
    const smokeIndex = smokeAt(cell);
    if (smokeIndex >= 0) {
      state.smokes.splice(smokeIndex, 1);
      invalidateResult();
      updateControls();
      draw();
      return;
    }

    const wall = findOptionalWall(point);
    if (wall) {
      toggleOptionalWall(wall);
      return;
    }
  }

  placeSelectedPlayer(cell);
}

function drawWall(wall, color) {
  const polygon = canvasWallPolygon(wall);
  context.beginPath();
  context.moveTo(polygon[0].x, polygon[0].y);
  for (let index = 1; index < polygon.length; index += 1) {
    context.lineTo(polygon[index].x, polygon[index].y);
  }
  context.closePath();
  context.fillStyle = color;
  context.fill();
}

function drawGrid() {
  const metrics = gridMetrics();
  const { gridSize } = state.map;
  context.strokeStyle = "rgba(255, 255, 255, 0.15)";
  context.lineWidth = 1;
  for (let x = 0; x <= gridSize.width; x += 1) {
    const canvasX = metrics.left + x * metrics.cellSize;
    context.beginPath();
    context.moveTo(canvasX, metrics.top);
    context.lineTo(canvasX, metrics.bottom);
    context.stroke();
  }
  for (let y = 0; y <= gridSize.height; y += 1) {
    const canvasY = metrics.top + y * metrics.cellSize;
    context.beginPath();
    context.moveTo(metrics.left, canvasY);
    context.lineTo(metrics.right, canvasY);
    context.stroke();
  }
}

function drawWalls() {
  for (const wall of state.map.walls) drawWall(wall, WALL_COLORS.main);
  const groups = [
    ["red", state.map.redWalls],
    ["orange", state.map.orangeWalls],
    ["windows", state.map.windows],
  ];
  for (const [kind, walls] of groups) {
    walls.forEach((wall, index) => {
      if (!state.brokenWalls[kind].has(index)) {
        drawWall(wall, WALL_COLORS[kind === "windows" ? "window" : kind]);
      }
    });
  }
}

function drawSmokeCell(cellX, cellY, alpha = 0.72) {
  const metrics = gridMetrics();
  const x = metrics.left + cellX * metrics.cellSize;
  const y = metrics.top + cellY * metrics.cellSize;
  context.save();
  context.globalAlpha = alpha;
  context.fillStyle = "#aaaaaa";
  context.fillRect(x, y, metrics.cellSize, metrics.cellSize);
  context.fillStyle = "#666666";
  context.beginPath();
  context.arc(
    x + metrics.cellSize / 2,
    y + metrics.cellSize / 2,
    metrics.cellSize / 5,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.restore();
}

function drawSmokes() {
  for (const smoke of state.smokes) {
    for (let x = 0; x < smoke.pattern.width; x += 1) {
      for (let y = 0; y < smoke.pattern.height; y += 1) {
        drawSmokeCell(smoke.position.x + x, smoke.position.y + y);
      }
    }
  }

  const preview = state.selectedSmokePattern;
  const cell = state.hoverCell;
  if (
    preview &&
    cell &&
    cell.x + preview.width <= state.map.gridSize.width &&
    cell.y + preview.height <= state.map.gridSize.height
  ) {
    for (let x = 0; x < preview.width; x += 1) {
      for (let y = 0; y < preview.height; y += 1) {
        drawSmokeCell(cell.x + x, cell.y + y, 0.4);
      }
    }
  }
}

function drawPlayer(player, color, active) {
  if (!player) return;
  const metrics = gridMetrics();
  const center = cellCenter(player);
  const radius = metrics.cellSize / 3;
  context.beginPath();
  context.arc(center.x, center.y, radius, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();
  context.strokeStyle = "white";
  context.lineWidth = 2;
  context.stroke();
  if (active) {
    context.beginPath();
    context.arc(center.x, center.y, radius + 4, 0, Math.PI * 2);
    context.strokeStyle = "rgba(255, 255, 255, 0.75)";
    context.lineWidth = 2;
    context.stroke();
  }
}

function drawLineOfSight() {
  if (!state.result || !state.blue || !state.orange) return;
  const metrics = gridMetrics();
  const blue = cellCenter(state.blue);
  const orange = cellCenter(state.orange);
  context.beginPath();
  context.moveTo(blue.x, blue.y);
  context.lineTo(orange.x, orange.y);
  context.strokeStyle = state.result.hasLineOfSight
    ? "rgba(105, 240, 174, 0.9)"
    : "rgba(255, 255, 0, 0.9)";
  context.lineWidth = 0.025 * metrics.cellSize;
  context.stroke();
}

function draw() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!state.map || !state.image) {
    context.fillStyle = "#000";
    context.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }
  context.drawImage(state.image, 0, 0, canvas.width, canvas.height);
  drawGrid();
  drawWalls();
  drawSmokes();
  drawPlayer(state.blue, "#4f8bff", state.draggingTeam === "blue");
  drawPlayer(state.orange, "#ff7f50", state.draggingTeam === "orange");
  drawLineOfSight();
}

function updateTooltip() {
  if (state.draggingTeam) {
    tooltip.textContent = `Drag the ${state.draggingTeam} player to another cell`;
  } else if (state.selectedSmokePattern) {
    tooltip.textContent = `Click to place ${state.selectedSmokePattern.width} × ${state.selectedSmokePattern.height} smoke`;
  } else if (state.activeTeam) {
    tooltip.textContent = `Click a grid cell to place the ${state.activeTeam} player`;
  } else {
    tooltip.innerHTML =
      "1. First click adds Blue Player<br>" +
      "2. Second click adds Orange Player<br>" +
      "3. Click breakable walls to toggle them<br>" +
      "4. Drag players to move them";
  }
}

function updateControls() {
  placeBlueButton.textContent = state.blue ? "Blue Player ✓" : "Place Blue Player";
  placeOrangeButton.textContent = state.orange ? "Orange Player ✓" : "Place Orange Player";
  placeBlueButton.classList.toggle("player-placed", Boolean(state.blue));
  placeOrangeButton.classList.toggle("player-placed", Boolean(state.orange));
  placeBlueButton.disabled = state.activeTeam === "blue";
  placeOrangeButton.disabled = state.activeTeam === "orange";
  smokeButtons.forEach((button) => {
    const matches =
      state.selectedSmokePattern &&
      Number(button.dataset.smokeWidth) === state.selectedSmokePattern.width &&
      Number(button.dataset.smokeHeight) === state.selectedSmokePattern.height;
    button.classList.toggle("selected", Boolean(matches));
  });

  smokeInstructions.hidden = !state.selectedSmokePattern;
  if (state.selectedSmokePattern) {
    smokeInstructions.textContent =
      `Click on the map to place the ${state.selectedSmokePattern.width} × ` +
      `${state.selectedSmokePattern.height} smoke`;
  }
  clearSmokesButton.hidden = state.smokes.length === 0;
  clearSmokesButton.textContent = `Clear All Smokes (${state.smokes.length})`;
  updateTooltip();
}

function updateResultPanel(result) {
  resultPanel.hidden = false;
  resultPanel.classList.toggle("has-los", result.hasLineOfSight);
  resultPanel.classList.toggle("no-los", !result.hasLineOfSight);
  resultIcon.textContent = result.hasLineOfSight ? "✓" : "×";
  resultText.textContent = result.hasLineOfSight
    ? "Line of Sight: YES"
    : "Line of Sight: NO";
  if (result.blockedBySmoke) {
    resultReason.textContent = "Blocked by smoke";
  } else if (result.blockedByWalls) {
    const labels = result.blockingWalls.map(
      (wall) => `${wall.kind} #${wall.index + 1}`,
    );
    resultReason.textContent = `Blocked by ${labels.join(", ")}`;
  } else {
    resultReason.textContent = "The sight strip is clear";
  }
}

function calculateCurrentLineOfSight() {
  if (!state.blue || !state.orange || !state.map) return;
  try {
    const result = calculateLineOfSight({
      map: state.map,
      blue: state.blue,
      orange: state.orange,
      brokenWalls: state.brokenWalls,
      smokes: state.smokes,
    });
    state.result = result;
    updateResultPanel(result);
    draw();
  } catch (error) {
    showToast(error.message);
  }
}

function setZoom(value) {
  state.zoom = Math.max(50, Math.min(1000, value));
  canvasContainer.style.width = `${state.zoom}%`;
  zoomResetButton.textContent = `${state.zoom}%`;
}

function preferredZoom() {
  return window.matchMedia("(max-width: 768px)").matches ? 250 : 100;
}

canvas.addEventListener("pointerdown", (event) => {
  const point = eventPoint(event);
  const team = playerAt(point);
  if (team) {
    state.draggingTeam = team;
    state.activeTeam = null;
    state.pendingCanvasClick = false;
    canvas.setPointerCapture(event.pointerId);
    updateControls();
    draw();
    event.preventDefault();
  } else {
    state.pendingCanvasClick = true;
    const mapCanPan =
      canvasContainer.scrollWidth > canvasWrapper.clientWidth ||
      canvasContainer.scrollHeight > canvasWrapper.clientHeight;
    if (mapCanPan) {
      state.panGesture = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        scrollLeft: canvasWrapper.scrollLeft,
        scrollTop: canvasWrapper.scrollTop,
        moved: false,
      };
      canvas.setPointerCapture(event.pointerId);
    }
  }
});

canvas.addEventListener("pointermove", (event) => {
  if (state.panGesture?.pointerId === event.pointerId) {
    const deltaX = event.clientX - state.panGesture.clientX;
    const deltaY = event.clientY - state.panGesture.clientY;
    if (Math.hypot(deltaX, deltaY) > 8) {
      state.panGesture.moved = true;
      state.pendingCanvasClick = false;
    }
    if (state.panGesture.moved) {
      canvasWrapper.scrollLeft = state.panGesture.scrollLeft - deltaX;
      canvasWrapper.scrollTop = state.panGesture.scrollTop - deltaY;
      event.preventDefault();
      return;
    }
  }
  const point = eventPoint(event);
  state.hoverCell = gridCellAt(point);
  state.hoverWall = findOptionalWall(point);
  if (state.draggingTeam && state.hoverCell) {
    state[state.draggingTeam] = { ...state.hoverCell };
    invalidateResult();
    updateControls();
  }
  draw();
});

canvas.addEventListener("pointerup", (event) => {
  const point = eventPoint(event);
  const wasPanning = state.panGesture?.moved ?? false;
  state.panGesture = null;
  if (wasPanning) {
    state.pendingCanvasClick = false;
    return;
  }
  if (state.draggingTeam) {
    state.draggingTeam = null;
    updateControls();
    draw();
    return;
  }
  if (state.pendingCanvasClick) handleCanvasAction(point);
  state.pendingCanvasClick = false;
});

canvas.addEventListener("pointercancel", () => {
  state.draggingTeam = null;
  state.panGesture = null;
  state.pendingCanvasClick = false;
  updateControls();
  draw();
});

canvas.addEventListener("pointerleave", () => {
  if (!state.draggingTeam) {
    state.hoverCell = null;
    state.hoverWall = null;
    draw();
  }
});

mapSelect.addEventListener("change", (event) => loadMap(event.target.value));

placeBlueButton.addEventListener("click", () => {
  state.activeTeam = state.activeTeam === "blue" ? null : "blue";
  state.selectedSmokePattern = null;
  updateControls();
  draw();
});

placeOrangeButton.addEventListener("click", () => {
  state.activeTeam = state.activeTeam === "orange" ? null : "orange";
  state.selectedSmokePattern = null;
  updateControls();
  draw();
});

smokeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const pattern = {
      width: Number(button.dataset.smokeWidth),
      height: Number(button.dataset.smokeHeight),
    };
    const selected = state.selectedSmokePattern;
    state.selectedSmokePattern =
      selected && selected.width === pattern.width && selected.height === pattern.height
        ? null
        : pattern;
    state.activeTeam = null;
    updateControls();
    draw();
  });
});

clearSmokesButton.addEventListener("click", () => {
  state.smokes = [];
  invalidateResult();
  updateControls();
  draw();
});

resetButton.addEventListener("click", () => {
  resetMapState();
  draw();
});

zoomOutButton.addEventListener("click", () => setZoom(state.zoom - 50));
zoomResetButton.addEventListener("click", () => setZoom(preferredZoom()));
zoomInButton.addEventListener("click", () => setZoom(state.zoom + 50));

async function initialize() {
  try {
    const response = await fetch("./data/maps.json");
    if (!response.ok) throw new Error("Could not load map definitions");
    state.maps = await response.json();
    for (const map of state.maps) {
      const option = document.createElement("option");
      option.value = map.id;
      option.textContent = map.name;
      mapSelect.append(option);
    }
    setZoom(preferredZoom());
    loadMap(state.maps[0].id);
  } catch (error) {
    showToast(error.message);
  }
}

initialize();
