import "./styles.css";
import { TOKEN_STEP_ANIMATION_MS } from "./constants";
import { mustGetCanvasContext, mustQuery } from "./dom";
import { add, rotate } from "./geometry";
import {
  cellCenter,
  findPath as findGridPath,
  nearestEditableEdge,
  occupiedByToken as isCellOccupiedByToken,
  sameCell,
  toggleBlockedEdge as toggleGridBlockedEdge,
  worldToCell,
} from "./grid";
import {
  computeImageResize,
  getResizeCursor,
  getResizeHandlePositions,
} from "./imageTransform";
import { defaultImageDropPoint, hasDraggedImage, loadImageFiles } from "./imageImport";
import {
  hitTestImage as findHitImage,
  hitTestResizeHandle as findHitResizeHandle,
  hitTestRotateHandle as findHitRotateHandle,
  hitTestToken as findHitToken,
} from "./hitTesting";
import { buildIdentities, identityLabel, rebuildModeOptions as rebuildModeSelectOptions, renderIdentityList as renderIdentityOptions } from "./identityUi";
import { updateModeControls as applyModeControls } from "./modeControls";
import { NetworkClient, type NetworkSnapshot } from "./networkClient";
import { renderScene } from "./renderer";
import { createSceneImage, createSceneToken, moveImageLayer, normalizeImageZIndexes, resetImageSize } from "./sceneActions";
import type {
  AppMode,
  Cell,
  Identity,
  Interaction,
  LogicTool,
  MovingToken,
  SceneImage,
  SceneToken,
  Vector2,
} from "./types";
import { createViewport } from "./viewport";

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
const viewport = createViewport(canvas, ctx, camera);
const { resizeCanvas, screenPointFromEvent, screenSize, screenToWorld, worldToScreen } = viewport;

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
  rebuildModeSelectOptions(modeSelect, availableModes());
}

function renderIdentityList(): void {
  renderIdentityOptions(identityList, buildIdentities(sceneTokens), enterIdentity);
}

function enterIdentity(identity: Identity): void {
  currentIdentity = identity;
  identityScreen.hidden = true;
  identityBadge.textContent = identityLabel(identity);
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
  identityBadge.textContent = identityLabel(null);
  renderIdentityList();
  rebuildModeOptions();
  updateModeControls();
  updateSelectionPanel();
  identityScreen.hidden = false;
}

function normalizeZIndexes(): void {
  nextZ = normalizeImageZIndexes(sceneImages);
}

function render(): void {
  resizeCanvas();
  renderScene(
    ctx,
    {
      camera,
      screenSize,
      screenToWorld,
      worldToScreen,
    },
    {
      images: sceneImages,
      tokens: sceneTokens,
      blockedVerticalEdges,
      blockedHorizontalEdges,
      previewPath,
      selectedImage: getSelectedImage(),
      selectedTokenId,
      interaction,
      movingToken,
      previewTokenPosition,
    },
  );
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

function hitTestImage(worldPoint: Vector2): SceneImage | null {
  return findHitImage(sceneImages, worldPoint);
}

function hitTestToken(worldPoint: Vector2): SceneToken | null {
  return findHitToken(sceneTokens, worldPoint, { interaction, movingToken, previewTokenPosition }, camera.zoom);
}

function hitTestResizeHandle(screenPoint: Vector2) {
  return findHitResizeHandle(getSelectedImage(), screenPoint, { zoom: camera.zoom, worldToScreen });
}

function hitTestRotateHandle(screenPoint: Vector2): boolean {
  return findHitRotateHandle(getSelectedImage(), screenPoint, { zoom: camera.zoom, worldToScreen });
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
    canvas.style.cursor = isCellOccupiedByToken(worldToCell(worldPoint), sceneTokens) ? "not-allowed" : "copy";
  } else if (isLoggedIn() && appMode === "play" && tokenHit && canControlToken(tokenHit)) {
    canvas.style.cursor = "grab";
  } else if (isAdmin() && appMode === "art" && hitTestImage(worldPoint)) {
    canvas.style.cursor = "move";
  } else {
    canvas.style.cursor = "default";
  }
}

function updateResizeInteraction(event: PointerEvent, state: Extract<Interaction, { type: "resize-image" }>): void {
  const entity = sceneImages.find((image) => image.id === state.imageId);
  if (!entity) {
    return;
  }

  const currentWorld = screenToWorld(screenPointFromEvent(event));
  const nextSize = computeImageResize(currentWorld, state, event.shiftKey);
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

  applyModeControls(
    {
      modeSelect,
      uploadInput,
      uploadButton,
      addTokenButton,
      wallModeButton,
      clearWallsButton,
      resetSizeButton,
      layerUpButton,
      layerDownButton,
      layerTopButton,
      layerBottomButton,
      canvas,
    },
    {
      appMode,
      logicTool,
      isLoggedIn: isLoggedIn(),
      isAdmin: isAdmin(),
    },
  );
}

function addTokenAtCell(cell: Cell): void {
  if (isCellOccupiedByToken(cell, sceneTokens)) {
    return;
  }

  const tokenIndex = nextTokenIndex++;
  const token = createSceneToken(cell, tokenIndex);

  sceneTokens.push(token);
  renderIdentityList();
  selectToken(token.id);
}

function addImageElement(imageElement: HTMLImageElement, name: string, worldPoint: Vector2): void {
  const entity = createSceneImage(imageElement, name, worldPoint, nextZ++);

  sceneImages.push(entity);
  normalizeZIndexes();
  selectImage(entity.id);
}

function handleFiles(files: FileList | File[], screenPoint?: Vector2): void {
  const targetWorldPoint = screenToWorld(screenPoint ?? defaultImageDropPoint(canvas));

  void loadImageFiles(files)
    .then((loadedImages) => {
      for (const loadedImage of loadedImages) {
        addImageElement(loadedImage.image, loadedImage.name, targetWorldPoint);
      }
    })
    .catch((error: unknown) => {
      console.error(error);
    });
}

function moveLayer(direction: "up" | "down" | "top" | "bottom"): void {
  const selectedImage = getSelectedImage();
  if (!selectedImage) {
    return;
  }

  nextZ = moveImageLayer(sceneImages, selectedImage, direction, nextZ);
}

function resetSelectedImageSize(): void {
  const selectedImage = getSelectedImage();
  if (!selectedImage) {
    return;
  }

  resetImageSize(selectedImage);
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
    toggleGridBlockedEdge(edge.type, edge.x, edge.y, blockedVerticalEdges, blockedHorizontalEdges);
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
      const path = findGridPath(tokenHit.cell, targetCell, tokenHit.id, sceneTokens, blockedVerticalEdges, blockedHorizontalEdges);
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
      const path = findGridPath(
        currentInteraction.startCell,
        targetCell,
        currentInteraction.tokenId,
        sceneTokens,
        blockedVerticalEdges,
        blockedHorizontalEdges,
      );
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
