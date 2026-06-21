import "./styles.css";
import { TOKEN_STEP_ANIMATION_MS } from "./constants";
import { mustGetCanvasContext, mustQuery } from "./dom";
import { add, rotate } from "./geometry";
import {
  blockedEdgeSet,
  cellCenter,
  edgeKey,
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
import { defaultImageDropPoint, hasDraggedImage, loadImageFiles, loadImageSource } from "./imageImport";
import {
  hitTestImage as findHitImage,
  hitTestResizeHandle as findHitResizeHandle,
  hitTestRotateHandle as findHitRotateHandle,
  hitTestToken as findHitToken,
} from "./hitTesting";
import {
  buildIdentities,
  identityLabel,
  rebuildEditModeOptions as rebuildEditModeSelectOptions,
  rebuildModeOptions as rebuildModeSelectOptions,
  renderIdentityList as renderIdentityOptions,
} from "./identityUi";
import { updateModeControls as applyModeControls } from "./modeControls";
import { NetworkClient, type NetworkSnapshot, type SceneSnapshot } from "./networkClient";
import { renderScene } from "./renderer";
import { createSceneImage, createSceneToken, moveImageLayer, normalizeImageZIndexes, resetImageSize } from "./sceneActions";
import type {
  AppMode,
  Cell,
  EditMode,
  Identity,
  Interaction,
  LogicTool,
  MovingToken,
  SceneImage,
  SceneImageSnapshot,
  SceneToken,
  Vector2,
} from "./types";
import { createViewport } from "./viewport";

const canvas = mustQuery<HTMLCanvasElement>("#world-canvas");
const identityScreen = mustQuery<HTMLElement>("#identity-screen");
const identityList = mustQuery<HTMLDivElement>("#identity-list");
const modeSelectLabel = mustQuery<HTMLLabelElement>(".mode-select-label");
const modeSelect = mustQuery<HTMLSelectElement>("#mode-select");
const editModeSelectLabel = mustQuery<HTMLLabelElement>(".edit-mode-select-label");
const editModeSelect = mustQuery<HTMLSelectElement>("#edit-mode-select");
const uploadButton = mustQuery<HTMLLabelElement>("#upload-button");
const uploadInput = mustQuery<HTMLInputElement>("#image-upload");
const addTokenButton = mustQuery<HTMLButtonElement>("#add-token-button");
const deleteTokenButton = mustQuery<HTMLButtonElement>("#delete-token-button");
const wallModeButton = mustQuery<HTMLButtonElement>("#wall-mode-button");
const clearWallsButton = mustQuery<HTMLButtonElement>("#clear-walls-button");
const switchIdentityButton = mustQuery<HTMLButtonElement>("#switch-identity-button");
const identityBadge = mustQuery<HTMLSpanElement>("#identity-badge");
const dropOverlay = mustQuery<HTMLDivElement>("#drop-overlay");
const selectionPanel = mustQuery<HTMLDivElement>("#selection-panel");
const selectionEyebrow = mustQuery<HTMLDivElement>("#selection-eyebrow");
const selectionTitle = mustQuery<HTMLDivElement>("#selection-title");
const imageSelectionControls = mustQuery<HTMLDivElement>("#image-selection-controls");
const imageSelectionActions = mustQuery<HTMLDivElement>("#image-selection-actions");
const resetSizeButton = mustQuery<HTMLButtonElement>("#reset-size");
const layerUpButton = mustQuery<HTMLButtonElement>("#layer-up");
const layerDownButton = mustQuery<HTMLButtonElement>("#layer-down");
const layerTopButton = mustQuery<HTMLButtonElement>("#layer-top");
const layerBottomButton = mustQuery<HTMLButtonElement>("#layer-bottom");
const tokenSelectionForm = mustQuery<HTMLFormElement>("#token-selection-form");
const tokenNameDisplay = mustQuery<HTMLDivElement>("#token-name-display");
const tokenNameValue = mustQuery<HTMLSpanElement>("#token-name-value");
const editTokenNameButton = mustQuery<HTMLButtonElement>("#edit-token-name");
const tokenNameField = mustQuery<HTMLLabelElement>("#token-name-field");
const tokenNameInput = mustQuery<HTMLInputElement>("#token-name-input");
const tokenPanelHelp = mustQuery<HTMLParagraphElement>("#token-panel-help");

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
let inspectedTokenId: string | null = null;
let currentIdentity: Identity | null = null;
let interaction: Interaction | null = null;
let appMode: AppMode = "play";
let editMode: EditMode = "art";
let logicTool: LogicTool = "wall";
let nextZ = 1;
let nextTokenIndex = 1;
let dragDepth = 0;
let movingTokens: MovingToken[] = [];
let previewTokenPosition: Vector2 | null = null;
let previewPath: Cell[] = [];
let imageSnapshotVersion = 0;
let tokenNameEditing = false;
const pendingTokenNames = new Map<string, string>();
let latestNetworkSnapshot: NetworkSnapshot = {
  status: "offline",
  clients: [],
  error: null,
};

const networkClient = new NetworkClient(
  (snapshot) => {
    latestNetworkSnapshot = snapshot;
    renderLatencyPanel();
  },
  applySceneSnapshot,
);

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
      name.textContent = `${client.identity.name} · ${
        client.identity.type === "admin" ? "管理员" : client.identity.type === "player" ? "玩家" : "选择身份中"
      }`;
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

function getInspectedToken(): SceneToken | null {
  return sceneTokens.find((token) => token.id === inspectedTokenId) ?? null;
}

function sceneImageSnapshot(image: SceneImage): SceneImageSnapshot {
  const { image: _imageElement, ...snapshot } = image;
  return { ...snapshot };
}

function sceneImageSnapshots(): SceneImageSnapshot[] {
  return sceneImages.map(sceneImageSnapshot);
}

function updateNextZFromImages(): void {
  nextZ = Math.max(0, ...sceneImages.map((image) => image.z)) + 1;
}

function isAdmin(): boolean {
  return currentIdentity?.type === "admin";
}

function isLoggedIn(): boolean {
  return currentIdentity !== null;
}

function isEditingArt(): boolean {
  return isAdmin() && appMode === "edit" && editMode === "art";
}

function isEditingLogic(): boolean {
  return isAdmin() && appMode === "edit" && editMode === "logic";
}

function isPlayMode(): boolean {
  return isLoggedIn() && appMode === "play";
}

function canControlToken(token: SceneToken): boolean {
  return currentIdentity?.type === "admin" || currentIdentity?.id === token.id;
}

function canInspectToken(): boolean {
  return isPlayMode();
}

function isTokenAnimating(tokenId: string): boolean {
  return movingTokens.some((animation) => animation.tokenId === tokenId);
}

function availableModes(): AppMode[] {
  return isAdmin() ? ["edit", "play"] : ["play"];
}

function rebuildModeOptions(): void {
  rebuildModeSelectOptions(modeSelect, availableModes());
  rebuildEditModeSelectOptions(editModeSelect, ["art", "logic"]);
}

function renderIdentityList(): void {
  renderIdentityOptions(identityList, buildIdentities(sceneTokens), enterIdentity);
}

async function applyImageSnapshots(snapshots: SceneImageSnapshot[]): Promise<void> {
  const version = ++imageSnapshotVersion;
  const existingImages = new Map(sceneImages.map((image) => [image.id, image]));
  const nextImages = await Promise.all(
    snapshots.map(async (snapshot): Promise<SceneImage | null> => {
      const existingImage = existingImages.get(snapshot.id);
      if (existingImage?.src === snapshot.src) {
        Object.assign(existingImage, snapshot);
        return existingImage;
      }

      try {
        const imageElement = await loadImageSource(snapshot.src, snapshot.name);
        return {
          ...snapshot,
          image: imageElement,
        };
      } catch (error) {
        console.error(error);
        return null;
      }
    }),
  );

  if (version !== imageSnapshotVersion) {
    return;
  }

  sceneImages.splice(0, sceneImages.length, ...nextImages.filter((image): image is SceneImage => image !== null));
  updateNextZFromImages();

  if (selectedImageId && !sceneImages.some((image) => image.id === selectedImageId)) {
    selectedImageId = null;
  }

  updateSelectionPanel();
}

function applySceneSnapshot(snapshot: SceneSnapshot): void {
  void applyImageSnapshots(snapshot.images);

  const { tokens } = snapshot;
  const previousTokens = new Map(sceneTokens.map((token) => [token.id, token]));
  const nextTokens = tokens.map((token) => ({ ...token, cell: { ...token.cell } }));
  for (const token of nextTokens) {
    const pendingName = pendingTokenNames.get(token.id);
    if (!pendingName) {
      continue;
    }

    if (token.name === pendingName) {
      pendingTokenNames.delete(token.id);
    } else {
      token.name = pendingName;
    }
  }
  const nextTokenIds = new Set(nextTokens.map((token) => token.id));
  for (const tokenId of pendingTokenNames.keys()) {
    if (!nextTokenIds.has(tokenId)) {
      pendingTokenNames.delete(tokenId);
    }
  }

  const shouldExitDeletedIdentity =
    currentIdentity?.type === "player" && !nextTokens.some((token) => token.id === currentIdentity?.id);
  const startedAt = performance.now();
  const animations: MovingToken[] = [];

  for (const token of nextTokens) {
    const previousToken = previousTokens.get(token.id);
    if (!previousToken || sameCell(previousToken.cell, token.cell) || isTokenAnimating(token.id)) {
      continue;
    }

    const path = findGridPath(
      previousToken.cell,
      token.cell,
      token.id,
      sceneTokens,
      blockedVerticalEdges,
      blockedHorizontalEdges,
    );
    const animationPath = path.length > 1 ? path : [previousToken.cell, token.cell];

    animations.push({
      tokenId: token.id,
      path: animationPath.map((cell) => ({ ...cell })),
      startedAt,
      duration: Math.max(1, animationPath.length - 1) * TOKEN_STEP_ANIMATION_MS,
    });
  }

  sceneTokens.splice(0, sceneTokens.length, ...nextTokens);
  blockedVerticalEdges.clear();
  blockedHorizontalEdges.clear();
  for (const edge of snapshot.blockedVerticalEdges) {
    blockedVerticalEdges.add(edge);
  }
  for (const edge of snapshot.blockedHorizontalEdges) {
    blockedHorizontalEdges.add(edge);
  }
  nextTokenIndex = nextAvailableTokenIndex();

  if (selectedTokenId && !sceneTokens.some((token) => token.id === selectedTokenId)) {
    selectedTokenId = null;
  }

  if (inspectedTokenId && !sceneTokens.some((token) => token.id === inspectedTokenId)) {
    inspectedTokenId = null;
    tokenNameEditing = false;
  }

  if (currentIdentity?.type === "player") {
    const currentToken = sceneTokens.find((token) => token.id === currentIdentity?.id);
    if (currentToken && currentIdentity.name !== currentToken.name) {
      currentIdentity = { ...currentIdentity, name: currentToken.name };
      networkClient.updateIdentity(currentIdentity);
      identityBadge.textContent = identityLabel(currentIdentity);
    }
  }

  movingTokens = [
    ...movingTokens.filter((animation) => sceneTokens.some((token) => token.id === animation.tokenId)),
    ...animations,
  ];

  previewPath = [];
  previewTokenPosition = null;
  renderIdentityList();
  updateSelectionPanel();

  if (shouldExitDeletedIdentity) {
    showIdentityScreen();
  }
}

function nextAvailableTokenIndex(): number {
  const maxTokenIndex = sceneTokens.reduce((maxIndex, token) => {
    const match = /^P(\d+)$/.exec(token.name);
    return match ? Math.max(maxIndex, Number.parseInt(match[1], 10)) : maxIndex;
  }, 0);

  return maxTokenIndex + 1;
}

function enterIdentity(identity: Identity): void {
  currentIdentity = identity;
  identityScreen.hidden = true;
  identityBadge.textContent = identityLabel(identity);
  rebuildModeOptions();
  setAppMode(identity.type === "admin" ? "edit" : "play");
  networkClient.connect(identity);
  renderLatencyPanel();
}

function showIdentityScreen(): void {
  currentIdentity = null;
  networkClient.connect();
  selectedImageId = null;
  selectedTokenId = null;
  inspectedTokenId = null;
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
      movingTokens,
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
  const now = performance.now();
  movingTokens = movingTokens.filter((animation) => (now - animation.startedAt) / animation.duration < 1);
}

function hitTestImage(worldPoint: Vector2): SceneImage | null {
  return findHitImage(sceneImages, worldPoint);
}

function hitTestToken(worldPoint: Vector2): SceneToken | null {
  return findHitToken(sceneTokens, worldPoint, { interaction, movingTokens, previewTokenPosition }, camera.zoom);
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

  if (isEditingArt() && hitTestRotateHandle(screenPoint)) {
    canvas.style.cursor = "grab";
  } else if (isEditingArt() && resizeHandle) {
    canvas.style.cursor = getResizeCursor(resizeHandle);
  } else if (isEditingLogic() && logicTool === "wall") {
    canvas.style.cursor = "crosshair";
  } else if (isEditingLogic() && logicTool === "add-token") {
    canvas.style.cursor = isCellOccupiedByToken(worldToCell(worldPoint), sceneTokens) ? "not-allowed" : "copy";
  } else if (isEditingLogic() && logicTool === "delete-token") {
    canvas.style.cursor = tokenHit ? "pointer" : "default";
  } else if (isPlayMode() && tokenHit && canControlToken(tokenHit)) {
    canvas.style.cursor = "grab";
  } else if (isEditingArt() && hitTestImage(worldPoint)) {
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
  const selectedToken = canInspectToken() ? getInspectedToken() : null;

  if (!selectedImage && !selectedToken) {
    selectionPanel.classList.remove("is-open");
    selectionPanel.setAttribute("aria-hidden", "true");
    tokenNameEditing = false;
    return;
  }

  if (selectedImage) {
    tokenNameEditing = false;
    selectionEyebrow.textContent = "图片检视";
    selectionTitle.textContent = selectedImage.name;
    imageSelectionControls.hidden = false;
    imageSelectionActions.hidden = false;
    tokenSelectionForm.hidden = true;
  }

  if (selectedToken) {
    const canEditToken = canControlToken(selectedToken);
    const isEditingTokenName = tokenNameEditing && canEditToken;

    selectionEyebrow.textContent = "角色检视";
    selectionTitle.textContent = selectedToken.name;
    imageSelectionControls.hidden = true;
    imageSelectionActions.hidden = true;
    tokenSelectionForm.hidden = false;
    tokenNameDisplay.hidden = isEditingTokenName;
    tokenNameValue.textContent = selectedToken.name;
    editTokenNameButton.disabled = !canEditToken;
    tokenNameField.hidden = !isEditingTokenName;
    tokenNameInput.disabled = !canEditToken;
    tokenPanelHelp.textContent = canEditToken ? "修改后会同步到所有客户端。" : "只有主持人或该角色玩家可以修改姓名。";

    if (document.activeElement !== tokenNameInput || !isEditingTokenName) {
      tokenNameInput.value = selectedToken.name;
    }
  }

  selectionPanel.classList.add("is-open");
  selectionPanel.setAttribute("aria-hidden", "false");
}

function selectImage(imageId: string | null): void {
  selectedImageId = imageId;
  if (imageId) {
    selectedTokenId = null;
    inspectedTokenId = null;
    tokenNameEditing = false;
  }
  updateSelectionPanel();
}

function selectToken(tokenId: string | null, inspect = false): void {
  selectedTokenId = tokenId;
  if (tokenId) {
    selectedImageId = null;
    if (inspect && inspectedTokenId !== tokenId) {
      tokenNameEditing = false;
    }
    inspectedTokenId = inspect ? tokenId : inspectedTokenId;
  } else {
    inspectedTokenId = null;
    tokenNameEditing = false;
  }
  updateSelectionPanel();
}

function setAppMode(nextMode: AppMode): void {
  const modes = availableModes();
  appMode = modes.includes(nextMode) ? nextMode : modes[0];
  interaction = null;
  previewPath = [];
  previewTokenPosition = null;

  if (!isEditingArt()) {
    selectedImageId = null;
  }

  if (!isPlayMode()) {
    selectedTokenId = null;
    inspectedTokenId = null;
    tokenNameEditing = false;
  }

  updateModeControls();
  updateSelectionPanel();
}

function setEditMode(nextMode: EditMode): void {
  editMode = nextMode;
  interaction = null;
  previewPath = [];
  previewTokenPosition = null;

  if (!isEditingArt()) {
    selectedImageId = null;
  }

  if (!isEditingLogic()) {
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
      modeSelectLabel,
      modeSelect,
      editModeSelectLabel,
      editModeSelect,
      uploadInput,
      uploadButton,
      addTokenButton,
      deleteTokenButton,
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
      editMode,
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
  networkClient.sendTokenAdded(token);
}

function deleteToken(tokenId: string): void {
  const tokenIndex = sceneTokens.findIndex((token) => token.id === tokenId);
  if (tokenIndex === -1) {
    return;
  }

  sceneTokens.splice(tokenIndex, 1);
  pendingTokenNames.delete(tokenId);
  movingTokens = movingTokens.filter((animation) => animation.tokenId !== tokenId);
  if (selectedTokenId === tokenId) {
    selectedTokenId = null;
  }
  if (inspectedTokenId === tokenId) {
    inspectedTokenId = null;
    tokenNameEditing = false;
  }
  previewPath = [];
  previewTokenPosition = null;
  renderIdentityList();
  updateSelectionPanel();
  networkClient.sendTokenDeleted(tokenId);
}

function addImageElement(imageElement: HTMLImageElement, src: string, name: string, worldPoint: Vector2): void {
  const entity = createSceneImage(imageElement, src, name, worldPoint, nextZ++);

  sceneImages.push(entity);
  normalizeZIndexes();
  selectImage(entity.id);
  networkClient.sendImageAdded(sceneImageSnapshot(entity));
}

function handleFiles(files: FileList | File[], screenPoint?: Vector2): void {
  const targetWorldPoint = screenToWorld(screenPoint ?? defaultImageDropPoint(canvas));

  void loadImageFiles(files)
    .then((loadedImages) => {
      for (const loadedImage of loadedImages) {
        addImageElement(loadedImage.image, loadedImage.src, loadedImage.name, targetWorldPoint);
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
  networkClient.sendImagesUpdated(sceneImageSnapshots());
}

function resetSelectedImageSize(): void {
  const selectedImage = getSelectedImage();
  if (!selectedImage) {
    return;
  }

  resetImageSize(selectedImage);
  networkClient.sendImageUpdated(sceneImageSnapshot(selectedImage));
}

function sendTokenNameUpdate(token: SceneToken): void {
  pendingTokenNames.set(token.id, token.name);
  networkClient.sendTokenUpdated(token);
}

function updateSelectedTokenName(name: string): void {
  const token = getInspectedToken();
  const normalizedName = name.trim();
  if (!token || !canControlToken(token) || normalizedName.length === 0 || token.name === normalizedName) {
    return;
  }

  token.name = normalizedName.slice(0, 24);

  if (currentIdentity?.type === "player" && currentIdentity.id === token.id) {
    currentIdentity = { ...currentIdentity, name: token.name };
    networkClient.updateIdentity(currentIdentity);
    identityBadge.textContent = identityLabel(currentIdentity);
  }

  renderIdentityList();
  updateSelectionPanel();
  sendTokenNameUpdate(token);
}

function startTokenNameEditing(): void {
  const token = getInspectedToken();
  if (!token || !canControlToken(token)) {
    return;
  }

  tokenNameEditing = true;
  updateSelectionPanel();
  tokenNameInput.focus();
  tokenNameInput.select();
}

function stopTokenNameEditing(): void {
  if (!tokenNameEditing) {
    return;
  }

  updateSelectedTokenName(tokenNameInput.value);
  tokenNameEditing = false;
  updateSelectionPanel();
}

modeSelect.addEventListener("change", () => {
  if (!isLoggedIn()) {
    return;
  }

  setAppMode(modeSelect.value as AppMode);
});

editModeSelect.addEventListener("change", () => {
  if (!isAdmin() || appMode !== "edit") {
    return;
  }

  setEditMode(editModeSelect.value as EditMode);
});

addTokenButton.addEventListener("click", () => {
  if (isEditingLogic()) {
    setLogicTool("add-token");
  }
});

deleteTokenButton.addEventListener("click", () => {
  if (isEditingLogic()) {
    setLogicTool("delete-token");
  }
});

wallModeButton.addEventListener("click", () => {
  if (isEditingLogic()) {
    setLogicTool("wall");
  }
});

clearWallsButton.addEventListener("click", () => {
  if (!isEditingLogic()) {
    return;
  }

  blockedVerticalEdges.clear();
  blockedHorizontalEdges.clear();
  previewPath = [];
  networkClient.sendBlockedEdgesCleared();
});

uploadInput.addEventListener("change", () => {
  if (isEditingArt() && uploadInput.files) {
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
    inspectedTokenId = null;
    tokenNameEditing = false;
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

  if (isEditingLogic()) {
    selectedImageId = null;
    selectedTokenId = null;
    inspectedTokenId = null;
    tokenNameEditing = false;
    updateSelectionPanel();

    if (logicTool === "add-token") {
      addTokenAtCell(worldToCell(worldPoint));
      return;
    }

    if (logicTool === "delete-token") {
      const tokenHit = hitTestToken(worldPoint);
      if (tokenHit) {
        deleteToken(tokenHit.id);
      }
      return;
    }

    const edge = nearestEditableEdge(worldPoint);
    const set = blockedEdgeSet(edge.type, blockedVerticalEdges, blockedHorizontalEdges);
    const key = edgeKey(edge);
    const blocked = !set.has(key);
    toggleGridBlockedEdge(edge.type, edge.x, edge.y, blockedVerticalEdges, blockedHorizontalEdges);
    previewPath = [];
    networkClient.sendBlockedEdgeChanged(edge.type, edge.x, edge.y, blocked);
    return;
  }

  if (isEditingArt() && selectedImage && rotateHandleHit) {
    const angle = Math.atan2(worldPoint.y - selectedImage.y, worldPoint.x - selectedImage.x);
    interaction = {
      type: "rotate-image",
      imageId: selectedImage.id,
      pointerId: event.pointerId,
      startAngle: angle,
      startRotation: selectedImage.rotation,
    };
  } else if (isEditingArt() && selectedImage && resizeHandle) {
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
    const tokenHit = isPlayMode() ? hitTestToken(worldPoint) : null;
    const imageHit = isEditingArt() ? hitTestImage(worldPoint) : null;

    if (tokenHit && canControlToken(tokenHit) && !isTokenAnimating(tokenHit.id)) {
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
      inspectedTokenId = null;
      tokenNameEditing = false;
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
    if (
      currentInteraction.type === "move-image" ||
      currentInteraction.type === "resize-image" ||
      currentInteraction.type === "rotate-image"
    ) {
      const image = sceneImages.find((candidate) => candidate.id === currentInteraction.imageId);
      if (image) {
        networkClient.sendImageUpdated(sceneImageSnapshot(image));
      }
    }

    if (currentInteraction.type === "drag-token") {
      const token = sceneTokens.find((candidate) => candidate.id === currentInteraction.tokenId);
      if (token && currentInteraction.path.length > 1) {
        const finalCell = currentInteraction.path[currentInteraction.path.length - 1];
        token.cell = { ...finalCell };
        movingTokens = movingTokens.filter((animation) => animation.tokenId !== token.id);
        movingTokens.push({
          tokenId: token.id,
          path: currentInteraction.path.map((cell) => ({ ...cell })),
          startedAt: performance.now(),
          duration: Math.max(1, currentInteraction.path.length - 1) * TOKEN_STEP_ANIMATION_MS,
        });
        networkClient.sendTokenMoved(token);
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

canvas.addEventListener("dblclick", (event) => {
  if (!canInspectToken()) {
    return;
  }

  const tokenHit = hitTestToken(screenToWorld(screenPointFromEvent(event)));
  if (!tokenHit) {
    return;
  }

  event.preventDefault();
  selectToken(tokenHit.id, true);
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
  if (!isEditingArt() || !hasDraggedImage(event)) {
    return;
  }

  event.preventDefault();
  dragDepth += 1;
  dropOverlay.hidden = false;
});

window.addEventListener("dragover", (event) => {
  if (!isEditingArt() && hasDraggedImage(event)) {
    event.preventDefault();
    return;
  }

  if (!hasDraggedImage(event)) {
    return;
  }

  event.preventDefault();
});

window.addEventListener("dragleave", (event) => {
  if (!isEditingArt() || !hasDraggedImage(event)) {
    return;
  }

  event.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  dropOverlay.hidden = dragDepth === 0;
});

window.addEventListener("drop", (event) => {
  if (!isEditingArt()) {
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
editTokenNameButton.addEventListener("click", startTokenNameEditing);
tokenNameInput.addEventListener("input", () => {
  updateSelectedTokenName(tokenNameInput.value);
});
tokenNameInput.addEventListener("change", () => {
  updateSelectedTokenName(tokenNameInput.value);
});
tokenNameInput.addEventListener("blur", stopTokenNameEditing);
tokenSelectionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateSelectedTokenName(tokenNameInput.value);
  stopTokenNameEditing();
});

switchIdentityButton.addEventListener("click", () => {
  showIdentityScreen();
});

window.addEventListener("resize", resizeCanvas);

renderIdentityList();
showIdentityScreen();
resizeCanvas();
requestAnimationFrame(tick);
