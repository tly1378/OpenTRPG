import { GRID_CELL_SIZE, HANDLE_RADIUS, TOKEN_RADIUS } from "./constants";
import { easeInOutCubic } from "./geometry";
import { cellCenter } from "./grid";
import { getImageCorners, getResizeHandlePositions, getRotateHandlePosition } from "./imageTransform";
import type { Cell, Interaction, MovingToken, ResizeHandle, SceneImage, SceneToken, Vector2 } from "./types";

type Viewport = {
  camera: { x: number; y: number; zoom: number };
  screenSize: () => Vector2;
  screenToWorld: (point: Vector2) => Vector2;
  worldToScreen: (point: Vector2) => Vector2;
};

export type RenderState = {
  images: SceneImage[];
  tokens: SceneToken[];
  blockedVerticalEdges: Set<string>;
  blockedHorizontalEdges: Set<string>;
  previewPath: Cell[];
  selectedImage: SceneImage | null;
  selectedTokenId: string | null;
  interaction: Interaction | null;
  movingTokens: MovingToken[];
  previewTokenPosition: Vector2 | null;
};

export function renderScene(ctx: CanvasRenderingContext2D, viewport: Viewport, state: RenderState): void {
  const size = viewport.screenSize();

  ctx.clearRect(0, 0, size.x, size.y);
  ctx.fillStyle = "#101319";
  ctx.fillRect(0, 0, size.x, size.y);
  drawGrid(ctx, viewport);

  for (const image of [...state.images].sort((a, b) => a.z - b.z)) {
    drawImageEntity(ctx, viewport, image);
  }

  drawWalls(ctx, viewport, state.blockedVerticalEdges, state.blockedHorizontalEdges);
  if (state.previewPath.length > 0) {
    drawPath(ctx, viewport, state.previewPath);
  }
  drawTokens(ctx, viewport, state);

  if (state.selectedImage) {
    drawSelection(ctx, viewport, state.selectedImage);
  }
}

export function tokenRenderPosition(token: SceneToken, state: Pick<RenderState, "interaction" | "movingTokens" | "previewTokenPosition">): Vector2 {
  if (state.interaction?.type === "drag-token" && state.interaction.tokenId === token.id && state.previewTokenPosition) {
    return state.previewTokenPosition;
  }

  const movingToken = state.movingTokens.find((animation) => animation.tokenId === token.id);
  if (movingToken) {
    return interpolateMovingToken(movingToken);
  }

  return cellCenter(token.cell);
}

function drawGrid(ctx: CanvasRenderingContext2D, viewport: Viewport): void {
  const size = viewport.screenSize();
  const topLeft = viewport.screenToWorld({ x: 0, y: 0 });
  const bottomRight = viewport.screenToWorld(size);
  const step = GRID_CELL_SIZE;
  const majorStep = step * 5;

  ctx.save();
  ctx.lineWidth = 1;

  for (let x = Math.floor(topLeft.x / step) * step; x <= bottomRight.x; x += step) {
    const screen = viewport.worldToScreen({ x, y: 0 }).x;
    const isMajor = Math.abs(x % majorStep) < 0.001;
    ctx.strokeStyle = isMajor ? "rgb(92 114 142 / 0.28)" : "rgb(92 114 142 / 0.14)";
    ctx.beginPath();
    ctx.moveTo(screen, 0);
    ctx.lineTo(screen, size.y);
    ctx.stroke();
  }

  for (let y = Math.floor(bottomRight.y / step) * step; y <= topLeft.y; y += step) {
    const screen = viewport.worldToScreen({ x: 0, y }).y;
    const isMajor = Math.abs(y % majorStep) < 0.001;
    ctx.strokeStyle = isMajor ? "rgb(92 114 142 / 0.28)" : "rgb(92 114 142 / 0.14)";
    ctx.beginPath();
    ctx.moveTo(0, screen);
    ctx.lineTo(size.x, screen);
    ctx.stroke();
  }

  const origin = viewport.worldToScreen({ x: 0, y: 0 });
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

function drawWalls(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  blockedVerticalEdges: Set<string>,
  blockedHorizontalEdges: Set<string>,
): void {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(4, 6 * viewport.camera.zoom);
  ctx.strokeStyle = "#f97316";

  for (const key of blockedVerticalEdges) {
    const [x, y] = key.split(",").map(Number);
    const a = viewport.worldToScreen({ x: x * GRID_CELL_SIZE, y: y * GRID_CELL_SIZE });
    const b = viewport.worldToScreen({ x: x * GRID_CELL_SIZE, y: (y + 1) * GRID_CELL_SIZE });
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  for (const key of blockedHorizontalEdges) {
    const [x, y] = key.split(",").map(Number);
    const a = viewport.worldToScreen({ x: x * GRID_CELL_SIZE, y: y * GRID_CELL_SIZE });
    const b = viewport.worldToScreen({ x: (x + 1) * GRID_CELL_SIZE, y: y * GRID_CELL_SIZE });
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawPath(ctx: CanvasRenderingContext2D, viewport: Viewport, path: Cell[]): void {
  ctx.save();
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  path.forEach((cell, index) => {
    const point = viewport.worldToScreen(cellCenter(cell));
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();
  ctx.setLineDash([]);

  for (const cell of path) {
    const point = viewport.worldToScreen(cellCenter(cell));
    ctx.fillStyle = "rgb(56 189 248 / 0.9)";
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawTokens(ctx: CanvasRenderingContext2D, viewport: Viewport, state: RenderState): void {
  for (const token of state.tokens) {
    const worldPoint = tokenRenderPosition(token, state);
    const screenPoint = viewport.worldToScreen(worldPoint);
    const radius = TOKEN_RADIUS * viewport.camera.zoom;
    const isSelected = token.id === state.selectedTokenId;

    ctx.save();
    ctx.fillStyle = token.color;
    ctx.strokeStyle = isSelected ? "#ffffff" : "rgb(255 255 255 / 0.7)";
    ctx.lineWidth = isSelected ? 4 : 2;
    ctx.beginPath();
    ctx.arc(screenPoint.x, screenPoint.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#0f172a";
    ctx.font = `${Math.max(12, 14 * viewport.camera.zoom)}px ui-sans-serif, system-ui, sans-serif`;
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

function drawImageEntity(ctx: CanvasRenderingContext2D, viewport: Viewport, entity: SceneImage): void {
  const screen = viewport.worldToScreen({ x: entity.x, y: entity.y });

  ctx.save();
  ctx.translate(screen.x, screen.y);
  ctx.rotate(-entity.rotation);
  ctx.scale(viewport.camera.zoom, viewport.camera.zoom);
  ctx.drawImage(entity.image, -entity.width / 2, -entity.height / 2, entity.width, entity.height);
  ctx.restore();
}

function drawSelection(ctx: CanvasRenderingContext2D, viewport: Viewport, entity: SceneImage): void {
  const corners = getImageCorners(entity);
  const handles = getResizeHandlePositions(entity);
  const cornerOrder: Array<"nw" | "ne" | "se" | "sw"> = ["nw", "ne", "se", "sw"];
  const handleOrder: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
  const screenCorners = cornerOrder.map((key) => viewport.worldToScreen(corners[key]));
  const screenHandles = handleOrder.map((key) => viewport.worldToScreen(handles[key]));
  const rotateHandle = viewport.worldToScreen(getRotateHandlePosition(entity, viewport.camera.zoom));
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
