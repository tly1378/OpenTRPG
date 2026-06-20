import "./styles.css";
import { NetworkClient, type NetworkSnapshot } from "./networkClient";

type Vector2 = {
  x: number;
  y: number;
};

type Cell = {
  x: number;
  y: number;
};

type ClientPointEvent = {
  clientX: number;
  clientY: number;
};

type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
type AppMode = "art" | "logic" | "play";
type LogicTool = "add-token" | "wall";
type WallEdgeType = "vertical" | "horizontal";
type Identity =
  | {
      type: "admin";
      id: "host";
      name: "主持人";
    }
  | {
      type: "player";
      id: string;
      name: string;
    };

type SceneImage = {
  id: string;
  image: HTMLImageElement;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  rotation: number;
  z: number;
};

type SceneToken = {
  id: string;
  name: string;
  cell: Cell;
  color: string;
};

type MovingToken = {
  tokenId: string;
  path: Cell[];
  startedAt: number;
  duration: number;
};

type Interaction =
  | {
      type: "move-image";
      imageId: string;
      pointerId: number;
      startPointer: Vector2;
      startImage: Vector2;
    }
  | {
      type: "resize-image";
      imageId: string;
      pointerId: number;
      handle: ResizeHandle;
      startCenter: Vector2;
      startWidth: number;
      startHeight: number;
      startRotation: number;
    }
  | {
      type: "rotate-image";
      imageId: string;
      pointerId: number;
      startAngle: number;
      startRotation: number;
    }
  | {
      type: "pan-camera";
      pointerId: number;
      startPointer: Vector2;
      startCamera: Vector2;
    }
  | {
      type: "drag-token";
      tokenId: string;
      pointerId: number;
      startCell: Cell;
      targetCell: Cell;
      path: Cell[];
    };

function mustQuery<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`页面初始化失败：缺少 ${selector}。`);
  }

  return element;
}

const canvas = mustQuery<HTMLCanvasElement>("#world-canvas");
const identityScreen = mustQuery<HTMLElement>("#identity-screen");
const identityList = mustQuery<HTMLDivElement>("#identity-list");
const modeSelect = mustQuery<HTMLSelectElement>("#mode-select");
const uploadButton = mustQuery<HTMLLabelElement>("#upload-button");
const uploadInput = mustQuery<HTMLInputElement>("#image-upload");
const addTokenButton = mustQuery<HTMLButtonElement>("#add-token-button");
const wallModeButton = mustQuery<HTMLButtonElement>("#wall-mode-button");
const clearWallsButton = mustQuery<HTMLButtonElement>("#clear-walls-button");
const switchIdentityButton = mustQuery<HTMLButtonElement>("#switch-identity-button");
const identityBadge = mustQuery<HTMLSpanElement>("#identity-badge");
const dropOverlay = mustQuery<HTMLDivElement>("#drop-overlay");
const selectionPanel = mustQuery<HTMLDivElement>("#selection-panel");
const selectionTitle = mustQuery<HTMLDivElement>("#selection-title");
const resetSizeButton = mustQuery<HTMLButtonElement>("#reset-size");
const layerUpButton = mustQuery<HTMLButtonElement>("#layer-up");
const layerDownButton = mustQuery<HTMLButtonElement>("#layer-down");
const layerTopButton = mustQuery<HTMLButtonElement>("#layer-top");
const layerBottomButton = mustQuery<HTMLButtonElement>("#layer-bottom");

function mustGetCanvasContext(targetCanvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = targetCanvas.getContext("2d");

  if (!context) {
    throw new Error("页面初始化失败：当前浏览器不支持 Canvas 2D。");
  }

  return context;
}

const ctx = mustGetCanvasContext(canvas);
const latencyPanel = document.createElement("aside");
latencyPanel.className = "latency-panel";
latencyPanel.hidden = true;
document.body.append(latencyPanel);

const camera = {
  x: 0,
  y: 0,
  zoom: 1,
};

const pointer = {
  x: 0,
  y: 0,
};

const sceneImages: SceneImage[] = [];
const sceneTokens: SceneToken[] = [];
const blockedVerticalEdges = new Set<string>();
const blockedHorizontalEdges = new Set<string>();

let selectedImageId: string | null = null;
let selectedTokenId: string | null = null;
let currentIdentity: Identity | null = null;
let interaction: Interaction | null = null;
let appMode: AppMode = "art";
let logicTool: LogicTool = "wall";
let nextZ = 1;
let nextTokenIndex = 1;
let dragDepth = 0;
let movingToken: MovingToken | null = null;
let previewTokenPosition: Vector2 | null = null;
let previewPath: Cell[] = [];
let latestNetworkSnapshot: NetworkSnapshot = {
  status: "offline",
  clients: [],
  error: null,
};

const networkClient = new NetworkClient((snapshot) => {
  latestNetworkSnapshot = snapshot;
  renderLatencyPanel();
});

function formatLatency(latencyMs: number | null): string {
  return latencyMs === null ? "等待中" : `${latencyMs} ms`;
}

function renderLatencyPanel(): void {
  if (!isLoggedIn()) {
    latencyPanel.hidden = true;
    latencyPanel.replaceChildren();
    return;
  }

  const title = document.createElement("div");
  const status = document.createElement("div");
  const list = document.createElement("div");

  title.className = "latency-panel-title";
  status.className = `latency-panel-status is-${latestNetworkSnapshot.status}`;
  list.className = "latency-client-list";
  title.textContent = "服务器延迟";
  status.textContent =
    latestNetworkSnapshot.status === "online"
      ? "已连接"
      : latestNetworkSnapshot.status === "connecting"
        ? "连接中..."
        : "未连接";

  if (latestNetworkSnapshot.error) {
    const error = document.createElement("div");
    error.className = "latency-panel-error";
    error.textContent = latestNetworkSnapshot.error;
    list.append(error);
  }

  if (latestNetworkSnapshot.clients.length === 0) {
    const empty = document.createElement("div");
    empty.className = "latency-client-empty";
    empty.textContent = latestNetworkSnapshot.status === "online" ? "等待延迟数据..." : "等待服务器响应...";
    list.append(empty);
  } else {
    for (const client of latestNetworkSnapshot.clients) {
      const row = document.createElement("div");
      const name = document.createElement("span");
      const latency = document.createElement("span");

      row.className = "latency-client-row";
      name.textContent = `${client.identity.name} · ${client.identity.type === "admin" ? "管理员" : "玩家"}`;
      latency.textContent = formatLatency(client.latencyMs);
      row.append(name, latency);
      list.append(row);
    }
  }

  latencyPanel.replaceChildren(title, status, list);
  latencyPanel.hidden = false;
}

const HANDLE_RADIUS = 8;
const ROTATE_HANDLE_DISTANCE = 44;
const MIN_IMAGE_SIZE = 24;
const GRID_CELL_SIZE = 80;
const TOKEN_RADIUS = 24;
const TOKEN_COLORS = ["#f97316", "#22c55e", "#60a5fa", "#e879f9", "#facc15", "#fb7185"];
const TOKEN_STEP_ANIMATION_MS = 180;

function screenSize(): Vector2 {
  return {
    x: canvas.clientWidth,
    y: canvas.clientHeight,
  };
}

function screenToWorld(point: Vector2): Vector2 {
  const size = screenSize();

  return {
    x: (point.x - size.x / 2) / camera.zoom + camera.x,
    y: -(point.y - size.y / 2) / camera.zoom + camera.y,
  };
}

function worldToScreen(point: Vector2): Vector2 {
  const size = screenSize();

  return {
    x: (point.x - camera.x) * camera.zoom + size.x / 2,
    y: -(point.y - camera.y) * camera.zoom + size.y / 2,
  };
}

function rotate(point: Vector2, radians: number): Vector2 {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

function add(a: Vector2, b: Vector2): Vector2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

function subtract(a: Vector2, b: Vector2): Vector2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function distance(a: Vector2, b: Vector2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function sameCell(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y;
}

function cellKey(cell: Cell): string {
  return `${cell.x},${cell.y}`;
}

function edgeKey(edge: { x: number; y: number }): string {
  return `${edge.x},${edge.y}`;
}

function worldToCell(point: Vector2): Cell {
  return {
    x: Math.floor(point.x / GRID_CELL_SIZE),
    y: Math.floor(point.y / GRID_CELL_SIZE),
  };
}

function cellCenter(cell: Cell): Vector2 {
  return {
    x: (cell.x + 0.5) * GRID_CELL_SIZE,
    y: (cell.y + 0.5) * GRID_CELL_SIZE,
  };
}

function blockedEdgeSet(type: WallEdgeType): Set<string> {
  return type === "vertical" ? blockedVerticalEdges : blockedHorizontalEdges;
}

function hasBlockedEdge(type: WallEdgeType, x: number, y: number): boolean {
  return blockedEdgeSet(type).has(edgeKey({ x, y }));
}

function toggleBlockedEdge(type: WallEdgeType, x: number, y: number): void {
  const set = blockedEdgeSet(type);
  const key = edgeKey({ x, y });

  if (set.has(key)) {
    set.delete(key);
  } else {
    set.add(key);
  }
}

function getSelectedImage(): SceneImage | null {
  return sceneImages.find((image) => image.id === selectedImageId) ?? null;
}

function getSelectedToken(): SceneToken | null {
  return sceneTokens.find((token) => token.id === selectedTokenId) ?? null;
}

function isAdmin(): boolean {
  return currentIdentity?.type === "admin";
}

function isLoggedIn(): boolean {
  return currentIdentity !== null;
}

function canControlToken(token: SceneToken): boolean {
  return currentIdentity?.type === "admin" || currentIdentity?.id === token.id;
}

function availableModes(): AppMode[] {
  return isAdmin() ? ["art", "logic", "play"] : ["play"];
}

function rebuildModeOptions(): void {
  const modes = availableModes();
  const modeLabels: Record<AppMode, string> = {
    art: "美术地图",
    logic: "逻辑地图",
    play: "游玩模式",
  };

  modeSelect.replaceChildren(
    ...modes.map((mode) => {
      const option = document.createElement("option");
      option.value = mode;
      option.textContent = modeLabels[mode];
      return option;
    }),
  );
}

function renderIdentityList(): void {
  const identities: Identity[] = [
    { type: "admin", id: "host", name: "主持人" },
    ...sceneTokens.map((token) => ({
      type: "player" as const,
      id: token.id,
      name: token.name,
    })),
  ];

  identityList.replaceChildren(
    ...identities.map((identity) => {
      const button = document.createElement("button");
      const label = document.createElement("span");
      const type = document.createElement("span");

      button.type = "button";
      button.className = "identity-option";
      label.className = "identity-option-name";
      type.className = "identity-option-type";
      label.textContent = identity.name;
      type.textContent = identity.type === "admin" ? "管理员" : "玩家";
      button.append(label, type);
      button.addEventListener("click", () => enterIdentity(identity));

      return button;
    }),
  );
}

function enterIdentity(identity: Identity): void {
  currentIdentity = identity;
  identityScreen.hidden = true;
  identityBadge.textContent = `${identity.name} · ${identity.type === "admin" ? "管理员" : "玩家"}`;
  rebuildModeOptions();
  setAppMode(identity.type === "admin" ? "art" : "play");
  networkClient.connect(identity);
  renderLatencyPanel();
}

function showIdentityScreen(): void {
  currentIdentity = null;
  networkClient.disconnect();
  selectedImageId = null;
  selectedTokenId = null;
  interaction = null;
  previewPath = [];
  previewTokenPosition = null;
  identityBadge.textContent = "未登录";
  renderIdentityList();
  rebuildModeOptions();
  updateModeControls();
  updateSelectionPanel();
  identityScreen.hidden = false;
}

function normalizeZIndexes(): void {
  sceneImages
    .sort((a, b) => a.z - b.z)
    .forEach((image, index) => {
      image.z = index + 1;
    });
  nextZ = sceneImages.length + 1;
}

function sortedImagesAscending(): SceneImage[] {
  return [...sceneImages].sort((a, b) => a.z - b.z);
}

function resizeCanvas(): void {
  const dpr = window.devicePixelRatio || 1;
  const width = Math.floor(canvas.clientWidth * dpr);
  const height = Math.floor(canvas.clientHeight * dpr);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawGrid(): void {
  const size = screenSize();
  const topLeft = screenToWorld({ x: 0, y: 0 });
  const bottomRight = screenToWorld(size);
  const step = GRID_CELL_SIZE;
  const majorStep = step * 5;

  ctx.save();
  ctx.lineWidth = 1;

  for (let x = Math.floor(topLeft.x / step) * step; x <= bottomRight.x; x += step) {
    const screen = worldToScreen({ x, y: 0 }).x;
    const isMajor = Math.abs(x % majorStep) < 0.001;
    ctx.strokeStyle = isMajor ? "rgb(92 114 142 / 0.28)" : "rgb(92 114 142 / 0.14)";
    ctx.beginPath();
    ctx.moveTo(screen, 0);
    ctx.lineTo(screen, size.y);
    ctx.stroke();
  }

  for (let y = Math.floor(bottomRight.y / step) * step; y <= topLeft.y; y += step) {
    const screen = worldToScreen({ x: 0, y }).y;
    const isMajor = Math.abs(y % majorStep) < 0.001;
    ctx.strokeStyle = isMajor ? "rgb(92 114 142 / 0.28)" : "rgb(92 114 142 / 0.14)";
    ctx.beginPath();
    ctx.moveTo(0, screen);
    ctx.lineTo(size.x, screen);
    ctx.stroke();
  }

  const origin = worldToScreen({ x: 0, y: 0 });
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgb(104 191 255 / 0.68)";
  ctx.beginPath();
  ctx.moveTo(origin.x, 0);
  ctx.lineTo(origin.x, size.y);
  ctx.moveTo(0, origin.y);
  ctx.lineTo(size.x, origin.y);
  ctx.stroke();

  ctx.fillStyle = "#7fd3ff";
  ctx.font = "12px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("(0, 0)", origin.x + 8, origin.y - 8);
  ctx.restore();
}

function canMoveCardinal(from: Cell, to: Cell): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (Math.abs(dx) + Math.abs(dy) !== 1) {
    return false;
  }

  if (dx === 1) return !hasBlockedEdge("vertical", from.x + 1, from.y);
  if (dx === -1) return !hasBlockedEdge("vertical", from.x, from.y);
  if (dy === 1) return !hasBlockedEdge("horizontal", from.x, from.y + 1);

  return !hasBlockedEdge("horizontal", from.x, from.y);
}

function canMoveBetween(from: Cell, to: Cell): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (Math.abs(dx) + Math.abs(dy) === 1) {
    return canMoveCardinal(from, to);
  }

  if (Math.abs(dx) === 1 && Math.abs(dy) === 1) {
    const horizontalFirst = { x: from.x + dx, y: from.y };
    const verticalFirst = { x: from.x, y: from.y + dy };

    return (
      canMoveCardinal(from, horizontalFirst) &&
      canMoveCardinal(horizontalFirst, to) &&
      canMoveCardinal(from, verticalFirst) &&
      canMoveCardinal(verticalFirst, to)
    );
  }

  return false;
}

function occupiedByToken(cell: Cell, exceptTokenId?: string): boolean {
  return sceneTokens.some((token) => token.id !== exceptTokenId && sameCell(token.cell, cell));
}

function getNeighborCells(cell: Cell, tokenId: string): Array<{ cell: Cell; cost: number }> {
  const neighbors: Array<{ cell: Cell; cost: number }> = [];

  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      if (dx === 0 && dy === 0) continue;

      const next = { x: cell.x + dx, y: cell.y + dy };
      if (occupiedByToken(next, tokenId) || !canMoveBetween(cell, next)) {
        continue;
      }

      neighbors.push({
        cell: next,
        cost: Math.abs(dx) + Math.abs(dy) === 2 ? Math.SQRT2 : 1,
      });
    }
  }

  return neighbors;
}

function findPath(start: Cell, target: Cell, tokenId: string): Cell[] {
  if (sameCell(start, target)) {
    return [start];
  }

  const queue = new Map<string, { cell: Cell; priority: number }>();
  const cameFrom = new Map<string, string>();
  const costs = new Map<string, number>();
  const cells = new Map<string, Cell>();
  const startKey = cellKey(start);
  const targetKey = cellKey(target);
  const margin = 24;
  const minX = Math.min(start.x, target.x) - margin;
  const maxX = Math.max(start.x, target.x) + margin;
  const minY = Math.min(start.y, target.y) - margin;
  const maxY = Math.max(start.y, target.y) + margin;

  queue.set(startKey, { cell: start, priority: 0 });
  costs.set(startKey, 0);
  cells.set(startKey, start);

  while (queue.size > 0) {
    const current = [...queue.values()].sort((a, b) => a.priority - b.priority)[0];
    const currentKey = cellKey(current.cell);
    queue.delete(currentKey);

    if (currentKey === targetKey) {
      break;
    }

    for (const neighbor of getNeighborCells(current.cell, tokenId)) {
      if (neighbor.cell.x < minX || neighbor.cell.x > maxX || neighbor.cell.y < minY || neighbor.cell.y > maxY) {
        continue;
      }

      const neighborKey = cellKey(neighbor.cell);
      const nextCost = (costs.get(currentKey) ?? 0) + neighbor.cost;

      if (!costs.has(neighborKey) || nextCost < (costs.get(neighborKey) ?? Number.POSITIVE_INFINITY)) {
        costs.set(neighborKey, nextCost);
        cameFrom.set(neighborKey, currentKey);
        cells.set(neighborKey, neighbor.cell);
        queue.set(neighborKey, {
          cell: neighbor.cell,
          priority: nextCost + distance(neighbor.cell, target),
        });
      }
    }
  }

  if (!cameFrom.has(targetKey)) {
    return [];
  }

  const path: Cell[] = [target];
  let currentKey = targetKey;

  while (currentKey !== startKey) {
    const previousKey = cameFrom.get(currentKey);
    if (!previousKey) {
      return [];
    }

    const previousCell = cells.get(previousKey);
    if (!previousCell) {
      return [];
    }

    path.push(previousCell);
    currentKey = previousKey;
  }

  return path.reverse();
}

function nearestEditableEdge(worldPoint: Vector2): { type: WallEdgeType; x: number; y: number } {
  const cell = worldToCell(worldPoint);
  const localX = worldPoint.x - cell.x * GRID_CELL_SIZE;
  const localY = worldPoint.y - cell.y * GRID_CELL_SIZE;
  const left = localX;
  const right = GRID_CELL_SIZE - localX;
  const bottom = localY;
  const top = GRID_CELL_SIZE - localY;
  const minDistance = Math.min(left, right, bottom, top);

  if (minDistance === left) return { type: "vertical", x: cell.x, y: cell.y };
  if (minDistance === right) return { type: "vertical", x: cell.x + 1, y: cell.y };
  if (minDistance === bottom) return { type: "horizontal", x: cell.x, y: cell.y };

  return { type: "horizontal", x: cell.x, y: cell.y + 1 };
}

function drawWalls(): void {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(4, 6 * camera.zoom);
  ctx.strokeStyle = "#f97316";

  for (const key of blockedVerticalEdges) {
    const [x, y] = key.split(",").map(Number);
    const a = worldToScreen({ x: x * GRID_CELL_SIZE, y: y * GRID_CELL_SIZE });
    const b = worldToScreen({ x: x * GRID_CELL_SIZE, y: (y + 1) * GRID_CELL_SIZE });
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  for (const key of blockedHorizontalEdges) {
    const [x, y] = key.split(",").map(Number);
    const a = worldToScreen({ x: x * GRID_CELL_SIZE, y: y * GRID_CELL_SIZE });
    const b = worldToScreen({ x: (x + 1) * GRID_CELL_SIZE, y: y * GRID_CELL_SIZE });
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawCellHighlight(cell: Cell, color: string): void {
  const topLeft = worldToScreen({ x: cell.x * GRID_CELL_SIZE, y: (cell.y + 1) * GRID_CELL_SIZE });
  const bottomRight = worldToScreen({ x: (cell.x + 1) * GRID_CELL_SIZE, y: cell.y * GRID_CELL_SIZE });

  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
  ctx.restore();
}

function drawPath(path: Cell[]): void {
  if (path.length === 0) {
    return;
  }

  ctx.save();
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  path.forEach((cell, index) => {
    const point = worldToScreen(cellCenter(cell));
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();
  ctx.setLineDash([]);

  for (const cell of path) {
    const point = worldToScreen(cellCenter(cell));
    ctx.fillStyle = "rgb(56 189 248 / 0.9)";
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function tokenRenderPosition(token: SceneToken): Vector2 {
  if (interaction?.type === "drag-token" && interaction.tokenId === token.id && previewTokenPosition) {
    return previewTokenPosition;
  }

  if (movingToken?.tokenId === token.id) {
    return interpolateMovingToken(movingToken);
  }

  return cellCenter(token.cell);
}

function drawTokens(): void {
  for (const token of sceneTokens) {
    const worldPoint = tokenRenderPosition(token);
    const screenPoint = worldToScreen(worldPoint);
    const radius = TOKEN_RADIUS * camera.zoom;
    const isSelected = token.id === selectedTokenId;

    ctx.save();
    ctx.fillStyle = token.color;
    ctx.strokeStyle = isSelected ? "#ffffff" : "rgb(255 255 255 / 0.7)";
    ctx.lineWidth = isSelected ? 4 : 2;
    ctx.beginPath();
    ctx.arc(screenPoint.x, screenPoint.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#0f172a";
    ctx.font = `${Math.max(12, 14 * camera.zoom)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(token.name, screenPoint.x, screenPoint.y);
    ctx.restore();
  }
}

function interpolateMovingToken(animation: MovingToken): Vector2 {
  const elapsed = performance.now() - animation.startedAt;
  const progress = Math.min(elapsed / animation.duration, 1);
  const segmentProgress = progress * (animation.path.length - 1);
  const segmentIndex = Math.min(Math.floor(segmentProgress), animation.path.length - 2);
  const localProgress = easeInOutCubic(segmentProgress - segmentIndex);
  const from = cellCenter(animation.path[segmentIndex]);
  const to = cellCenter(animation.path[segmentIndex + 1]);

  return {
    x: from.x + (to.x - from.x) * localProgress,
    y: from.y + (to.y - from.y) * localProgress,
  };
}

function easeInOutCubic(value: number): number {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function drawImageEntity(entity: SceneImage): void {
  const screen = worldToScreen({ x: entity.x, y: entity.y });

  ctx.save();
  ctx.translate(screen.x, screen.y);
  ctx.rotate(-entity.rotation);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.drawImage(entity.image, -entity.width / 2, -entity.height / 2, entity.width, entity.height);
  ctx.restore();
}

function getImageCorners(entity: SceneImage): Record<"nw" | "ne" | "sw" | "se", Vector2> {
  const handles = getResizeHandlePositions(entity);

  return {
    nw: handles.nw,
    ne: handles.ne,
    sw: handles.sw,
    se: handles.se,
  };
}

function getResizeHandlePositions(entity: SceneImage): Record<ResizeHandle, Vector2> {
  const halfWidth = entity.width / 2;
  const halfHeight = entity.height / 2;

  return {
    nw: add({ x: entity.x, y: entity.y }, rotate({ x: -halfWidth, y: halfHeight }, entity.rotation)),
    n: add({ x: entity.x, y: entity.y }, rotate({ x: 0, y: halfHeight }, entity.rotation)),
    ne: add({ x: entity.x, y: entity.y }, rotate({ x: halfWidth, y: halfHeight }, entity.rotation)),
    e: add({ x: entity.x, y: entity.y }, rotate({ x: halfWidth, y: 0 }, entity.rotation)),
    se: add({ x: entity.x, y: entity.y }, rotate({ x: halfWidth, y: -halfHeight }, entity.rotation)),
    s: add({ x: entity.x, y: entity.y }, rotate({ x: 0, y: -halfHeight }, entity.rotation)),
    sw: add({ x: entity.x, y: entity.y }, rotate({ x: -halfWidth, y: -halfHeight }, entity.rotation)),
    w: add({ x: entity.x, y: entity.y }, rotate({ x: -halfWidth, y: 0 }, entity.rotation)),
  };
}

function getRotateHandlePosition(entity: SceneImage): Vector2 {
  return add(
    { x: entity.x, y: entity.y },
    rotate({ x: 0, y: entity.height / 2 + ROTATE_HANDLE_DISTANCE / camera.zoom }, entity.rotation),
  );
}

function drawSelection(entity: SceneImage): void {
  const corners = getImageCorners(entity);
  const handles = getResizeHandlePositions(entity);
  const cornerOrder: Array<"nw" | "ne" | "se" | "sw"> = ["nw", "ne", "se", "sw"];
  const handleOrder: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
  const screenCorners = cornerOrder.map((key) => worldToScreen(corners[key]));
  const screenHandles = handleOrder.map((key) => worldToScreen(handles[key]));
  const rotateHandle = worldToScreen(getRotateHandlePosition(entity));
  const topMiddle = {
    x: (screenCorners[0].x + screenCorners[1].x) / 2,
    y: (screenCorners[0].y + screenCorners[1].y) / 2,
  };

  ctx.save();
  ctx.strokeStyle = "#68bfff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  screenCorners.forEach((corner, index) => {
    if (index === 0) {
      ctx.moveTo(corner.x, corner.y);
    } else {
      ctx.lineTo(corner.x, corner.y);
    }
  });
  ctx.closePath();
  ctx.stroke();

  ctx.strokeStyle = "rgb(104 191 255 / 0.7)";
  ctx.beginPath();
  ctx.moveTo(topMiddle.x, topMiddle.y);
  ctx.lineTo(rotateHandle.x, rotateHandle.y);
  ctx.stroke();

  ctx.fillStyle = "#101319";
  ctx.strokeStyle = "#68bfff";
  for (const handle of screenHandles) {
    ctx.beginPath();
    ctx.rect(handle.x - HANDLE_RADIUS, handle.y - HANDLE_RADIUS, HANDLE_RADIUS * 2, HANDLE_RADIUS * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(rotateHandle.x, rotateHandle.y, HANDLE_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function render(): void {
  resizeCanvas();
  const size = screenSize();

  ctx.clearRect(0, 0, size.x, size.y);
  ctx.fillStyle = "#101319";
  ctx.fillRect(0, 0, size.x, size.y);
  drawGrid();

  for (const image of sortedImagesAscending()) {
    drawImageEntity(image);
  }

  drawWalls();
  if (previewPath.length > 0) {
    drawPath(previewPath);
  }
  drawTokens();

  const selectedImage = getSelectedImage();
  if (selectedImage) {
    drawSelection(selectedImage);
  }
}

function tick(): void {
  updateMovingTokenAnimation();
  render();
  updateSelectionPanel();
  requestAnimationFrame(tick);
}

function updateMovingTokenAnimation(): void {
  if (!movingToken) {
    return;
  }

  const progress = (performance.now() - movingToken.startedAt) / movingToken.duration;
  if (progress < 1) {
    return;
  }

  const token = sceneTokens.find((candidate) => candidate.id === movingToken?.tokenId);
  const finalCell = movingToken.path[movingToken.path.length - 1];
  if (token && finalCell) {
    token.cell = finalCell;
  }

  movingToken = null;
}

function pointInImage(entity: SceneImage, worldPoint: Vector2): boolean {
  const local = rotate(subtract(worldPoint, { x: entity.x, y: entity.y }), -entity.rotation);

  return Math.abs(local.x) <= entity.width / 2 && Math.abs(local.y) <= entity.height / 2;
}

function hitTestImage(worldPoint: Vector2): SceneImage | null {
  return [...sceneImages]
    .sort((a, b) => b.z - a.z)
    .find((image) => pointInImage(image, worldPoint)) ?? null;
}

function hitTestToken(worldPoint: Vector2): SceneToken | null {
  return [...sceneTokens]
    .reverse()
    .find((token) => distance(tokenRenderPosition(token), worldPoint) <= TOKEN_RADIUS + 8 / camera.zoom) ?? null;
}

function hitTestResizeHandle(screenPoint: Vector2): ResizeHandle | null {
  const selectedImage = getSelectedImage();
  if (!selectedImage) {
    return null;
  }

  const handles = getResizeHandlePositions(selectedImage);
  const handleOrder: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

  return (
    handleOrder.find((handle) => distance(worldToScreen(handles[handle]), screenPoint) <= HANDLE_RADIUS + 5) ?? null
  );
}

function hitTestRotateHandle(screenPoint: Vector2): boolean {
  const selectedImage = getSelectedImage();

  return selectedImage
    ? distance(worldToScreen(getRotateHandlePosition(selectedImage)), screenPoint) <= HANDLE_RADIUS + 6
    : false;
}

function setCursor(screenPoint: Vector2): void {
  if (interaction) {
    canvas.classList.add("is-dragging");
    return;
  }

  canvas.classList.remove("is-dragging");

  const resizeHandle = hitTestResizeHandle(screenPoint);
  const worldPoint = screenToWorld(screenPoint);

  const tokenHit = hitTestToken(worldPoint);

  if (isAdmin() && appMode === "art" && hitTestRotateHandle(screenPoint)) {
    canvas.style.cursor = "grab";
  } else if (isAdmin() && appMode === "art" && resizeHandle) {
    canvas.style.cursor = getResizeCursor(resizeHandle);
  } else if (isAdmin() && appMode === "logic" && logicTool === "wall") {
    canvas.style.cursor = "crosshair";
  } else if (isAdmin() && appMode === "logic" && logicTool === "add-token") {
    canvas.style.cursor = occupiedByToken(worldToCell(worldPoint)) ? "not-allowed" : "copy";
  } else if (isLoggedIn() && appMode === "play" && tokenHit && canControlToken(tokenHit)) {
    canvas.style.cursor = "grab";
  } else if (isAdmin() && appMode === "art" && hitTestImage(worldPoint)) {
    canvas.style.cursor = "move";
  } else {
    canvas.style.cursor = "default";
  }
}

function getResizeCursor(handle: ResizeHandle): string {
  if (handle === "n" || handle === "s") {
    return "ns-resize";
  }

  if (handle === "e" || handle === "w") {
    return "ew-resize";
  }

  if (handle === "ne" || handle === "sw") {
    return "nesw-resize";
  }

  return "nwse-resize";
}

function screenPointFromEvent(event: ClientPointEvent): Vector2 {
  const rect = canvas.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function getHandleSigns(handle: ResizeHandle): Vector2 {
  return {
    x: handle.includes("w") ? -1 : handle.includes("e") ? 1 : 0,
    y: handle.includes("s") ? -1 : handle.includes("n") ? 1 : 0,
  };
}

function resizeWithoutAspectLock(
  currentLocal: Vector2,
  state: Extract<Interaction, { type: "resize-image" }>,
): { centerLocal: Vector2; width: number; height: number } {
  const signs = getHandleSigns(state.handle);
  let left = -state.startWidth / 2;
  let right = state.startWidth / 2;
  let bottom = -state.startHeight / 2;
  let top = state.startHeight / 2;

  if (signs.x < 0) left = Math.min(currentLocal.x, right - MIN_IMAGE_SIZE);
  if (signs.x > 0) right = Math.max(currentLocal.x, left + MIN_IMAGE_SIZE);
  if (signs.y < 0) bottom = Math.min(currentLocal.y, top - MIN_IMAGE_SIZE);
  if (signs.y > 0) top = Math.max(currentLocal.y, bottom + MIN_IMAGE_SIZE);

  return {
    centerLocal: {
      x: (left + right) / 2,
      y: (bottom + top) / 2,
    },
    width: right - left,
    height: top - bottom,
  };
}

function resizeWithAspectLock(
  currentLocal: Vector2,
  state: Extract<Interaction, { type: "resize-image" }>,
): { centerLocal: Vector2; width: number; height: number } {
  const signs = getHandleSigns(state.handle);
  const aspectRatio = state.startWidth / state.startHeight;

  if (signs.x !== 0 && signs.y !== 0) {
    const anchorLocal = {
      x: -signs.x * state.startWidth * 0.5,
      y: -signs.y * state.startHeight * 0.5,
    };
    const widthCandidate = Math.max((currentLocal.x - anchorLocal.x) * signs.x, MIN_IMAGE_SIZE);
    const heightCandidate = Math.max((currentLocal.y - anchorLocal.y) * signs.y, MIN_IMAGE_SIZE);
    const scale = Math.max(widthCandidate / state.startWidth, heightCandidate / state.startHeight);
    const width = Math.max(state.startWidth * scale, MIN_IMAGE_SIZE);
    const height = Math.max(state.startHeight * scale, MIN_IMAGE_SIZE);
    const draggedLocal = {
      x: anchorLocal.x + signs.x * width,
      y: anchorLocal.y + signs.y * height,
    };

    return {
      centerLocal: {
        x: (anchorLocal.x + draggedLocal.x) / 2,
        y: (anchorLocal.y + draggedLocal.y) / 2,
      },
      width,
      height,
    };
  }

  if (signs.x !== 0) {
    const anchorX = -signs.x * state.startWidth * 0.5;
    let width = Math.max((currentLocal.x - anchorX) * signs.x, MIN_IMAGE_SIZE);
    let height = width / aspectRatio;

    if (height < MIN_IMAGE_SIZE) {
      height = MIN_IMAGE_SIZE;
      width = height * aspectRatio;
    }

    return {
      centerLocal: {
        x: anchorX + signs.x * width * 0.5,
        y: 0,
      },
      width,
      height,
    };
  }

  const anchorY = -signs.y * state.startHeight * 0.5;
  let height = Math.max((currentLocal.y - anchorY) * signs.y, MIN_IMAGE_SIZE);
  let width = height * aspectRatio;

  if (width < MIN_IMAGE_SIZE) {
    width = MIN_IMAGE_SIZE;
    height = width / aspectRatio;
  }

  return {
    centerLocal: {
      x: 0,
      y: anchorY + signs.y * height * 0.5,
    },
    width,
    height,
  };
}

function updateResizeInteraction(event: PointerEvent, state: Extract<Interaction, { type: "resize-image" }>): void {
  const entity = sceneImages.find((image) => image.id === state.imageId);
  if (!entity) {
    return;
  }

  const currentWorld = screenToWorld(screenPointFromEvent(event));
  const currentLocal = rotate(subtract(currentWorld, state.startCenter), -state.startRotation);
  const nextSize = event.shiftKey
    ? resizeWithAspectLock(currentLocal, state)
    : resizeWithoutAspectLock(currentLocal, state);
  const nextCenter = add(state.startCenter, rotate(nextSize.centerLocal, state.startRotation));

  entity.x = nextCenter.x;
  entity.y = nextCenter.y;
  entity.width = nextSize.width;
  entity.height = nextSize.height;
}

function updateRotateInteraction(event: PointerEvent, state: Extract<Interaction, { type: "rotate-image" }>): void {
  const entity = sceneImages.find((image) => image.id === state.imageId);
  if (!entity) {
    return;
  }

  const worldPoint = screenToWorld(screenPointFromEvent(event));
  const angle = Math.atan2(worldPoint.y - entity.y, worldPoint.x - entity.x);
  entity.rotation = state.startRotation + angle - state.startAngle;
}

function updateSelectionPanel(): void {
  const selectedImage = getSelectedImage();

  if (!selectedImage) {
    selectionPanel.classList.remove("is-open");
    selectionPanel.setAttribute("aria-hidden", "true");
    return;
  }

  selectionTitle.textContent = selectedImage.name;
  selectionPanel.classList.add("is-open");
  selectionPanel.setAttribute("aria-hidden", "false");
}

function selectImage(imageId: string | null): void {
  selectedImageId = imageId;
  if (imageId) {
    selectedTokenId = null;
  }
  updateSelectionPanel();
}

function selectToken(tokenId: string | null): void {
  selectedTokenId = tokenId;
  if (tokenId) {
    selectedImageId = null;
  }
  updateSelectionPanel();
}

function setAppMode(nextMode: AppMode): void {
  const modes = availableModes();
  appMode = modes.includes(nextMode) ? nextMode : modes[0];
  interaction = null;
  previewPath = [];
  previewTokenPosition = null;

  if (appMode !== "art") {
    selectedImageId = null;
  }

  if (appMode !== "play") {
    selectedTokenId = null;
  }

  updateModeControls();
  updateSelectionPanel();
}

function setLogicTool(nextTool: LogicTool): void {
  logicTool = nextTool;
  updateModeControls();
}

function updateModeControls(): void {
  if (!availableModes().includes(appMode)) {
    appMode = availableModes()[0];
  }

  modeSelect.value = appMode;
  modeSelect.disabled = !isLoggedIn();

  uploadInput.disabled = !isLoggedIn() || appMode !== "art" || !isAdmin();
  uploadButton.classList.toggle("is-disabled", uploadInput.disabled);
  uploadButton.classList.toggle("is-hidden", !isLoggedIn() || appMode !== "art" || !isAdmin());
  addTokenButton.disabled = !isLoggedIn() || appMode !== "logic" || !isAdmin();
  addTokenButton.classList.toggle("is-hidden", !isLoggedIn() || appMode !== "logic" || !isAdmin());
  wallModeButton.disabled = !isLoggedIn() || appMode !== "logic" || !isAdmin();
  wallModeButton.classList.toggle("is-hidden", !isLoggedIn() || appMode !== "logic" || !isAdmin());
  clearWallsButton.disabled = !isLoggedIn() || appMode !== "logic" || !isAdmin();
  clearWallsButton.classList.toggle("is-hidden", !isLoggedIn() || appMode !== "logic" || !isAdmin());
  resetSizeButton.disabled = !isLoggedIn() || appMode !== "art" || !isAdmin();
  layerUpButton.disabled = !isLoggedIn() || appMode !== "art" || !isAdmin();
  layerDownButton.disabled = !isLoggedIn() || appMode !== "art" || !isAdmin();
  layerTopButton.disabled = !isLoggedIn() || appMode !== "art" || !isAdmin();
  layerBottomButton.disabled = !isLoggedIn() || appMode !== "art" || !isAdmin();

  addTokenButton.classList.toggle("is-active", isAdmin() && appMode === "logic" && logicTool === "add-token");
  wallModeButton.classList.toggle("is-active", isAdmin() && appMode === "logic" && logicTool === "wall");
  addTokenButton.setAttribute("aria-pressed", String(isAdmin() && appMode === "logic" && logicTool === "add-token"));
  wallModeButton.setAttribute("aria-pressed", String(isAdmin() && appMode === "logic" && logicTool === "wall"));
  canvas.classList.toggle("is-wall-mode", isAdmin() && appMode === "logic" && logicTool === "wall");
  canvas.classList.toggle("is-art-mode", isLoggedIn() && appMode === "art");
  canvas.classList.toggle("is-play-mode", isLoggedIn() && appMode === "play");
}

function addTokenAtCell(cell: Cell): void {
  if (occupiedByToken(cell)) {
    return;
  }

  const tokenIndex = nextTokenIndex++;
  const token: SceneToken = {
    id: crypto.randomUUID(),
    name: `P${tokenIndex}`,
    cell,
    color: TOKEN_COLORS[(tokenIndex - 1) % TOKEN_COLORS.length],
  };

  sceneTokens.push(token);
  renderIdentityList();
  selectToken(token.id);
}

function addImageElement(imageElement: HTMLImageElement, name: string, worldPoint: Vector2): void {
  const maxInitialSize = 420;
  const ratio = imageElement.naturalWidth / imageElement.naturalHeight || 1;
  const width = ratio >= 1 ? maxInitialSize : maxInitialSize * ratio;
  const height = ratio >= 1 ? maxInitialSize / ratio : maxInitialSize;

  const entity: SceneImage = {
    id: crypto.randomUUID(),
    image: imageElement,
    name,
    x: worldPoint.x,
    y: worldPoint.y,
    width,
    height,
    originalWidth: imageElement.naturalWidth,
    originalHeight: imageElement.naturalHeight,
    rotation: 0,
    z: nextZ++,
  };

  sceneImages.push(entity);
  normalizeZIndexes();
  selectImage(entity.id);
}

async function loadImageFile(file: File, worldPoint: Vector2): Promise<void> {
  if (!file.type.startsWith("image/")) {
    return;
  }

  const url = URL.createObjectURL(file);
  const image = new Image();

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`无法读取图片：${file.name}`));
    image.src = url;
  });

  addImageElement(image, file.name, worldPoint);
}

function handleFiles(files: FileList | File[], screenPoint?: Vector2): void {
  const targetWorldPoint = screenToWorld(screenPoint ?? { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 });

  void Promise.all([...files].map((file) => loadImageFile(file, targetWorldPoint))).catch((error: unknown) => {
    console.error(error);
  });
}

function hasDraggedImage(event: DragEvent): boolean {
  const items = event.dataTransfer?.items;
  const files = event.dataTransfer?.files;

  if (items?.length) {
    return [...items].some((item) => item.kind === "file" && item.type.startsWith("image/"));
  }

  return files ? [...files].some((file) => file.type.startsWith("image/")) : false;
}

function moveLayer(direction: "up" | "down" | "top" | "bottom"): void {
  const selectedImage = getSelectedImage();
  if (!selectedImage) {
    return;
  }

  normalizeZIndexes();

  if (direction === "up") selectedImage.z += 1.5;
  if (direction === "down") selectedImage.z -= 1.5;
  if (direction === "top") selectedImage.z = nextZ + 1;
  if (direction === "bottom") selectedImage.z = -1;

  normalizeZIndexes();
}

function resetSelectedImageSize(): void {
  const selectedImage = getSelectedImage();
  if (!selectedImage) {
    return;
  }

  selectedImage.width = selectedImage.originalWidth;
  selectedImage.height = selectedImage.originalHeight;
}

modeSelect.addEventListener("change", () => {
  if (!isLoggedIn()) {
    return;
  }

  setAppMode(modeSelect.value as AppMode);
});

addTokenButton.addEventListener("click", () => {
  if (isAdmin() && appMode === "logic") {
    setLogicTool("add-token");
  }
});

wallModeButton.addEventListener("click", () => {
  if (isAdmin() && appMode === "logic") {
    setLogicTool("wall");
  }
});

clearWallsButton.addEventListener("click", () => {
  if (!isAdmin() || appMode !== "logic") {
    return;
  }

  blockedVerticalEdges.clear();
  blockedHorizontalEdges.clear();
  previewPath = [];
});

uploadInput.addEventListener("change", () => {
  if (isAdmin() && appMode === "art" && uploadInput.files) {
    handleFiles(uploadInput.files);
  }

  uploadInput.value = "";
});

canvas.addEventListener("pointerdown", (event) => {
  const screenPoint = screenPointFromEvent(event);
  const worldPoint = screenToWorld(screenPoint);
  pointer.x = screenPoint.x;
  pointer.y = screenPoint.y;

  if (event.button === 2) {
    event.preventDefault();
    selectedImageId = null;
    selectedTokenId = null;
    updateSelectionPanel();
    interaction = {
      type: "pan-camera",
      pointerId: event.pointerId,
      startPointer: screenPoint,
      startCamera: { x: camera.x, y: camera.y },
    };
    canvas.setPointerCapture(event.pointerId);
    setCursor(screenPoint);
    return;
  }

  if (!isLoggedIn()) {
    return;
  }

  const selectedImage = getSelectedImage();
  const rotateHandleHit = hitTestRotateHandle(screenPoint);
  const resizeHandle = hitTestResizeHandle(screenPoint);

  if (isAdmin() && appMode === "logic") {
    selectedImageId = null;
    selectedTokenId = null;
    updateSelectionPanel();

    if (logicTool === "add-token") {
      addTokenAtCell(worldToCell(worldPoint));
      return;
    }

    const edge = nearestEditableEdge(worldPoint);
    toggleBlockedEdge(edge.type, edge.x, edge.y);
    previewPath = [];
    return;
  }

  if (isAdmin() && appMode === "art" && selectedImage && rotateHandleHit) {
    const angle = Math.atan2(worldPoint.y - selectedImage.y, worldPoint.x - selectedImage.x);
    interaction = {
      type: "rotate-image",
      imageId: selectedImage.id,
      pointerId: event.pointerId,
      startAngle: angle,
      startRotation: selectedImage.rotation,
    };
  } else if (isAdmin() && appMode === "art" && selectedImage && resizeHandle) {
    interaction = {
      type: "resize-image",
      imageId: selectedImage.id,
      pointerId: event.pointerId,
      handle: resizeHandle,
      startCenter: { x: selectedImage.x, y: selectedImage.y },
      startWidth: selectedImage.width,
      startHeight: selectedImage.height,
      startRotation: selectedImage.rotation,
    };
  } else {
    const tokenHit = appMode === "play" ? hitTestToken(worldPoint) : null;
    const imageHit = isAdmin() && appMode === "art" ? hitTestImage(worldPoint) : null;

    if (tokenHit && canControlToken(tokenHit) && movingToken?.tokenId !== tokenHit.id) {
      const targetCell = worldToCell(worldPoint);
      const path = findPath(tokenHit.cell, targetCell, tokenHit.id);
      selectToken(tokenHit.id);
      previewTokenPosition = cellCenter(tokenHit.cell);
      previewPath = path;
      interaction = {
        type: "drag-token",
        tokenId: tokenHit.id,
        pointerId: event.pointerId,
        startCell: tokenHit.cell,
        targetCell,
        path,
      };
    } else if (imageHit) {
      selectImage(imageHit.id);
      interaction = {
        type: "move-image",
        imageId: imageHit.id,
        pointerId: event.pointerId,
        startPointer: worldPoint,
        startImage: { x: imageHit.x, y: imageHit.y },
      };
    } else {
      selectedImageId = null;
      selectedTokenId = null;
      updateSelectionPanel();
    }
  }

  if (interaction) {
    canvas.setPointerCapture(event.pointerId);
    setCursor(screenPoint);
  }
});

canvas.addEventListener("pointermove", (event) => {
  const screenPoint = screenPointFromEvent(event);
  const worldPoint = screenToWorld(screenPoint);
  pointer.x = screenPoint.x;
  pointer.y = screenPoint.y;

  const currentInteraction = interaction;

  if (!currentInteraction || currentInteraction.pointerId !== event.pointerId) {
    setCursor(screenPoint);
    return;
  }

  if (currentInteraction.type === "move-image") {
    const entity = sceneImages.find((image) => image.id === currentInteraction.imageId);
    if (entity) {
      entity.x = currentInteraction.startImage.x + worldPoint.x - currentInteraction.startPointer.x;
      entity.y = currentInteraction.startImage.y + worldPoint.y - currentInteraction.startPointer.y;
    }
  }

  if (currentInteraction.type === "resize-image") {
    updateResizeInteraction(event, currentInteraction);
  }

  if (currentInteraction.type === "rotate-image") {
    updateRotateInteraction(event, currentInteraction);
  }

  if (currentInteraction.type === "drag-token") {
    const targetCell = worldToCell(worldPoint);
    previewTokenPosition = cellCenter(targetCell);

    if (!sameCell(targetCell, currentInteraction.targetCell)) {
      const path = findPath(currentInteraction.startCell, targetCell, currentInteraction.tokenId);
      currentInteraction.targetCell = targetCell;
      currentInteraction.path = path;
      previewPath = path;
    }
  }

  if (currentInteraction.type === "pan-camera") {
    camera.x = currentInteraction.startCamera.x - (screenPoint.x - currentInteraction.startPointer.x) / camera.zoom;
    camera.y = currentInteraction.startCamera.y + (screenPoint.y - currentInteraction.startPointer.y) / camera.zoom;
  }

  setCursor(screenPoint);
});

canvas.addEventListener("pointerup", (event) => {
  const currentInteraction = interaction;

  if (currentInteraction?.pointerId === event.pointerId) {
    if (currentInteraction.type === "drag-token") {
      const token = sceneTokens.find((candidate) => candidate.id === currentInteraction.tokenId);
      if (token && currentInteraction.path.length > 1) {
        movingToken = {
          tokenId: token.id,
          path: currentInteraction.path,
          startedAt: performance.now(),
          duration: Math.max(1, currentInteraction.path.length - 1) * TOKEN_STEP_ANIMATION_MS,
        };
      }

      previewPath = [];
      previewTokenPosition = null;
    }

    interaction = null;
    canvas.releasePointerCapture(event.pointerId);
  }

  setCursor(screenPointFromEvent(event));
});

canvas.addEventListener("pointercancel", (event) => {
  if (interaction?.pointerId === event.pointerId) {
    if (interaction.type === "drag-token") {
      previewPath = [];
      previewTokenPosition = null;
    }

    interaction = null;
  }

  setCursor(screenPointFromEvent(event));
});

canvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    const before = screenToWorld(screenPointFromEvent(event));
    const zoomFactor = Math.exp(-event.deltaY * 0.001);
    camera.zoom = Math.min(4, Math.max(0.2, camera.zoom * zoomFactor));
    const after = screenToWorld(screenPointFromEvent(event));
    camera.x += before.x - after.x;
    camera.y += before.y - after.y;
  },
  { passive: false },
);

window.addEventListener("dragenter", (event) => {
  if (appMode !== "art" || !hasDraggedImage(event)) {
    return;
  }

  event.preventDefault();
  dragDepth += 1;
  dropOverlay.hidden = false;
});

window.addEventListener("dragover", (event) => {
  if (appMode !== "art" && hasDraggedImage(event)) {
    event.preventDefault();
    return;
  }

  if (!hasDraggedImage(event)) {
    return;
  }

  event.preventDefault();
});

window.addEventListener("dragleave", (event) => {
  if (appMode !== "art" || !hasDraggedImage(event)) {
    return;
  }

  event.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  dropOverlay.hidden = dragDepth === 0;
});

window.addEventListener("drop", (event) => {
  if (appMode !== "art") {
    if (hasDraggedImage(event)) {
      event.preventDefault();
    }

    dragDepth = 0;
    dropOverlay.hidden = true;
    return;
  }

  event.preventDefault();
  dragDepth = 0;
  dropOverlay.hidden = true;

  if (event.dataTransfer?.files.length) {
    handleFiles(event.dataTransfer.files, screenPointFromEvent(event));
  }
});

layerUpButton.addEventListener("click", () => moveLayer("up"));
layerDownButton.addEventListener("click", () => moveLayer("down"));
layerTopButton.addEventListener("click", () => moveLayer("top"));
layerBottomButton.addEventListener("click", () => moveLayer("bottom"));
resetSizeButton.addEventListener("click", resetSelectedImageSize);

switchIdentityButton.addEventListener("click", () => {
  showIdentityScreen();
});

window.addEventListener("resize", resizeCanvas);

renderIdentityList();
showIdentityScreen();
resizeCanvas();
requestAnimationFrame(tick);
