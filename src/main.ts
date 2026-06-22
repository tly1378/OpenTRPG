import "./styles.css";
import {
  BrickWall,
  DoorOpen,
  Eraser,
  EyeOff,
  LandPlot,
  MessageCircle,
  RefreshCw,
  Trash2,
  Upload,
  Users,
  createIcons,
} from "lucide";
import { GRID_CELL_SIZE, TOKEN_STEP_ANIMATION_MS } from "./constants";
import { mustGetCanvasContext, mustQuery } from "./dom";
import { add, rotate } from "./geometry";
import {
  blockedEdgeSet,
  cellCenter,
  edgeKey,
  findClosedRegion,
  findPath as findGridPath,
  movementBlockedEdgeSets as buildMovementBlockedEdgeSets,
  nearestEditableEdge,
  occupiedByToken as isCellOccupiedByToken,
  roomBoundaryEdgeSets,
  roomKeyFromCells,
  sameCell,
  worldToCell,
} from "./grid";
import {
  computeImageResize,
  getResizeCursor,
  getResizeHandlePositions,
} from "./imageTransform";
import { defaultImageDropPoint, hasDraggedImage, loadImageFile, loadImageFiles, loadImageSource } from "./imageImport";
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
import { createSceneCharacter, createSceneImage, createSceneToken, moveImageLayer, normalizeImageZIndexes, resetImageSize } from "./sceneActions";
import type {
  AppMode,
  Cell,
  EditMode,
  Identity,
  Interaction,
  LogicTool,
  MovingToken,
  SceneDoor,
  SceneCharacter,
  SceneImage,
  SceneImageSnapshot,
  SceneRoom,
  SceneToken,
  Vector2,
  WallEdgeType,
  ChatMessage,
  GridIntersection,
  WallEdge,
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
const wallModeButton = mustQuery<HTMLButtonElement>("#wall-mode-button");
const doorModeButton = mustQuery<HTMLButtonElement>("#door-mode-button");
const roomModeButton = mustQuery<HTMLButtonElement>("#room-mode-button");
const clearWallsButton = mustQuery<HTMLButtonElement>("#clear-walls-button");
const logicMapVisibilityButton = mustQuery<HTMLButtonElement>("#logic-map-visibility-button");
const switchIdentityButton = mustQuery<HTMLButtonElement>("#switch-identity-button");
const chatToggleButton = mustQuery<HTMLButtonElement>("#chat-toggle-button");
const characterToggleButton = mustQuery<HTMLButtonElement>("#character-toggle-button");
const identityBadge = mustQuery<HTMLSpanElement>("#identity-badge");
const dropOverlay = mustQuery<HTMLDivElement>("#drop-overlay");
const chatPanel = mustQuery<HTMLElement>("#chat-panel");
const chatCloseButton = mustQuery<HTMLButtonElement>("#chat-close-button");
const chatMessageList = mustQuery<HTMLDivElement>("#chat-message-list");
const characterPanel = mustQuery<HTMLElement>("#character-panel");
const characterCloseButton = mustQuery<HTMLButtonElement>("#character-close-button");
const addCharacterButton = mustQuery<HTMLButtonElement>("#add-character-button");
const characterList = mustQuery<HTMLDivElement>("#character-list");
const selectionPanel = mustQuery<HTMLDivElement>("#selection-panel");
const selectionEyebrow = mustQuery<HTMLDivElement>("#selection-eyebrow");
const selectionTitle = mustQuery<HTMLDivElement>("#selection-title");
const imageSelectionControls = mustQuery<HTMLDivElement>("#image-selection-controls");
const imageSelectionActions = mustQuery<HTMLDivElement>("#image-selection-actions");
const imageSelectionDanger = mustQuery<HTMLDivElement>("#image-selection-danger");
const resetSizeButton = mustQuery<HTMLButtonElement>("#reset-size");
const layerUpButton = mustQuery<HTMLButtonElement>("#layer-up");
const layerDownButton = mustQuery<HTMLButtonElement>("#layer-down");
const layerTopButton = mustQuery<HTMLButtonElement>("#layer-top");
const layerBottomButton = mustQuery<HTMLButtonElement>("#layer-bottom");
const deleteImageButton = mustQuery<HTMLButtonElement>("#delete-image");
const tokenSelectionForm = mustQuery<HTMLFormElement>("#token-selection-form");
const tokenNameDisplay = mustQuery<HTMLDivElement>("#token-name-display");
const tokenNameValue = mustQuery<HTMLSpanElement>("#token-name-value");
const editTokenNameButton = mustQuery<HTMLButtonElement>("#edit-token-name");
const tokenNameInput = mustQuery<HTMLInputElement>("#token-name-input");
const avatarUploadButton = mustQuery<HTMLLabelElement>("#avatar-upload-button");
const avatarUploadInput = mustQuery<HTMLInputElement>("#avatar-upload-input");
const avatarAdjustControls = mustQuery<HTMLDivElement>("#avatar-adjust-controls");
const editAvatarButton = mustQuery<HTMLButtonElement>("#edit-avatar");
const resetAvatarAdjustmentButton = mustQuery<HTMLButtonElement>("#reset-avatar-adjustment");
const tokenPanelHelp = mustQuery<HTMLParagraphElement>("#token-panel-help");
const tokenInspectorOverlay = mustQuery<HTMLElement>("#token-inspector-overlay");
const closeTokenInspectorButton = mustQuery<HTMLButtonElement>("#close-token-inspector");
const tokenInstanceActions = mustQuery<HTMLDivElement>("#token-instance-actions");
const deleteTokenInstanceButton = mustQuery<HTMLButtonElement>("#delete-token-instance");
const doorSelectionForm = mustQuery<HTMLFormElement>("#door-selection-form");
const doorBlocksMovementInput = mustQuery<HTMLInputElement>("#door-blocks-movement-input");
const roomSelectionForm = mustQuery<HTMLFormElement>("#room-selection-form");
const roomNameInput = mustQuery<HTMLInputElement>("#room-name-input");
const deleteRoomButton = mustQuery<HTMLButtonElement>("#delete-room");
const avatarEditorOverlay = mustQuery<HTMLElement>("#avatar-editor-overlay");
const avatarEditorStage = mustQuery<HTMLDivElement>("#avatar-editor-stage");
const avatarEditorImage = mustQuery<HTMLImageElement>("#avatar-editor-image");
const cancelAvatarEditButton = mustQuery<HTMLButtonElement>("#cancel-avatar-edit");
const saveAvatarEditButton = mustQuery<HTMLButtonElement>("#save-avatar-edit");
const dicePanel = mustQuery<HTMLElement>("#dice-panel");
const diceOptionButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".dice-option"));
const diceAdjustButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".dice-adjust-button[data-die]"));
const diceRollButton = mustQuery<HTMLButtonElement>("#dice-roll");
const diceClearButton = mustQuery<HTMLButtonElement>("#dice-clear");
const diceModifierInput = mustQuery<HTMLInputElement>("#dice-modifier");
const diceModifierDecreaseButton = mustQuery<HTMLButtonElement>("#dice-modifier-decrease");
const diceModifierIncreaseButton = mustQuery<HTMLButtonElement>("#dice-modifier-increase");

const ctx = mustGetCanvasContext(canvas);
createIcons({
  icons: {
    BrickWall,
    DoorOpen,
    Eraser,
    EyeOff,
    LandPlot,
    MessageCircle,
    RefreshCw,
    Trash2,
    Upload,
    Users,
  },
  nameAttr: "data-lucide",
  attrs: {
    "aria-hidden": "true",
    class: "tool-icon",
    focusable: "false",
  },
});
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
const sceneCharacters: SceneCharacter[] = [];
const sceneTokens: SceneToken[] = [];
const tokenAvatarImages = new Map<string, { src: string; image: HTMLImageElement }>();
const blockedVerticalEdges = new Set<string>();
const blockedHorizontalEdges = new Set<string>();
const sceneDoors = new Map<string, SceneDoor>();
const sceneRooms: SceneRoom[] = [];
const chatMessages: ChatMessage[] = [];

let selectedImageId: string | null = null;
let selectedTokenId: string | null = null;
let inspectedCharacterId: string | null = null;
let selectedDoorId: string | null = null;
let selectedRoomId: string | null = null;
let currentIdentity: Identity | null = null;
let interaction: Interaction | null = null;
let appMode: AppMode = "play";
let editMode: EditMode = "background";
let logicTool: LogicTool = "wall";
let isLogicMapVisible = true;
let nextZ = 1;
let nextTokenIndex = 1;
let dragDepth = 0;
let movingTokens: MovingToken[] = [];
let previewTokenPosition: Vector2 | null = null;
let previewPath: Cell[] = [];
let previewRoomCells: Cell[] = [];
let hoverWallIntersection: GridIntersection | null = null;
let previewWallEdges: WallEdge[] = [];
let previewWallTargetBlocked = true;
let imageSnapshotVersion = 0;
let tokenNameEditing = false;
let isChatPanelOpen = false;
let isCharacterPanelOpen = false;
const pendingTokenNames = new Map<string, string>();
const diceSides = [4, 6, 8, 10, 12, 20, 100] as const;
type DiceSides = (typeof diceSides)[number];
const selectedDice = new Map<DiceSides, number>();
let avatarEditor:
  | {
      tokenId: string;
      src: string;
      image: HTMLImageElement;
      scale: number;
      offsetX: number;
      offsetY: number;
      drag:
        | {
            pointerId: number;
            startPointer: Vector2;
            startOffsetX: number;
            startOffsetY: number;
          }
        | null;
    }
  | null = null;
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
  applyChatMessages,
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

function formatChatTime(createdAt: number): string {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(createdAt));
}

function formatCell(cell: Cell): string {
  return `(${cell.x}, ${cell.y})`;
}

function applyChatMessages(messages: ChatMessage[], mode: "replace" | "append"): void {
  if (mode === "replace") {
    chatMessages.splice(0, chatMessages.length, ...messages);
  } else {
    const knownMessageIds = new Set(chatMessages.map((message) => message.id));
    chatMessages.push(...messages.filter((message) => !knownMessageIds.has(message.id)));
  }

  chatMessages.sort((a, b) => a.createdAt - b.createdAt);
  renderChatPanel();
}

function renderChatPanel(): void {
  const canShowChat = isPlayMode();

  if (!canShowChat) {
    isChatPanelOpen = false;
  }

  chatToggleButton.classList.toggle("is-hidden", !canShowChat);
  chatToggleButton.classList.toggle("is-active", canShowChat && isChatPanelOpen);
  chatToggleButton.disabled = !canShowChat;
  chatToggleButton.setAttribute("aria-pressed", String(canShowChat && isChatPanelOpen));
  chatToggleButton.setAttribute("aria-label", isChatPanelOpen ? "关闭聊天" : "打开聊天");
  chatPanel.hidden = !canShowChat;
  chatPanel.classList.toggle("is-open", canShowChat && isChatPanelOpen);
  chatPanel.setAttribute("aria-hidden", String(!canShowChat || !isChatPanelOpen));

  if (chatMessages.length === 0) {
    const empty = document.createElement("div");
    empty.className = "chat-empty";
    empty.textContent = "投骰和移动记录会显示在这里。";
    chatMessageList.replaceChildren(empty);
    return;
  }

  const elements = chatMessages.map((message) => {
    const item = document.createElement("article");
    const meta = document.createElement("div");
    const author = document.createElement("span");
    const time = document.createElement("span");

    item.className = "chat-message";
    meta.className = "chat-message-meta";
    author.className = "chat-message-author";
    author.textContent = message.authorName;
    time.textContent = formatChatTime(message.createdAt);
    meta.append(author, time);

    if (message.kind === "dice") {
      const formula = document.createElement("div");
      const total = document.createElement("div");
      const detail = document.createElement("div");

      formula.className = "chat-dice-formula";
      total.className = "chat-dice-total";
      detail.className = "chat-dice-detail";
      formula.textContent = message.formula;
      total.textContent = `总和 ${message.total}`;
      detail.textContent = message.detail;
      item.append(meta, formula, total, detail);
    } else {
      const summary = document.createElement("div");
      const detail = document.createElement("div");

      summary.className = "chat-move-summary";
      detail.className = "chat-move-detail";
      summary.textContent = `${message.tokenName} 移动了 ${message.distance} 格`;
      detail.textContent = `${formatCell(message.fromCell)} 到 ${formatCell(message.toCell)}，斜向按 1 格计算`;
      item.append(meta, summary, detail);
    }

    return item;
  });

  chatMessageList.replaceChildren(...elements);
  requestAnimationFrame(() => {
    chatMessageList.scrollTop = chatMessageList.scrollHeight;
  });
}

function setChatPanelOpen(open: boolean): void {
  isChatPanelOpen = open && isPlayMode();
  renderChatPanel();
}

function renderCharacterPanel(): void {
  const canShowCharacters = isAdmin();

  if (!canShowCharacters) {
    isCharacterPanelOpen = false;
  }

  characterToggleButton.classList.toggle("is-hidden", !canShowCharacters);
  characterToggleButton.classList.toggle("is-active", canShowCharacters && isCharacterPanelOpen);
  characterToggleButton.disabled = !canShowCharacters;
  characterToggleButton.setAttribute("aria-pressed", String(canShowCharacters && isCharacterPanelOpen));
  characterToggleButton.setAttribute("aria-label", isCharacterPanelOpen ? "关闭角色管理" : "打开角色管理");
  characterPanel.hidden = !canShowCharacters;
  characterPanel.classList.toggle("is-open", canShowCharacters && isCharacterPanelOpen);
  characterPanel.setAttribute("aria-hidden", String(!canShowCharacters || !isCharacterPanelOpen));
  addCharacterButton.disabled = !canShowCharacters;

  if (sceneCharacters.length === 0) {
    const empty = document.createElement("div");
    empty.className = "character-empty";
    empty.textContent = "还没有角色。";
    characterList.replaceChildren(empty);
    return;
  }

  const elements = sceneCharacters.map((character) => {
    const row = document.createElement("div");
    const entry = document.createElement("button");
    const avatar = document.createElement("span");
    const text = document.createElement("span");
    const name = document.createElement("span");
    const status = document.createElement("span");
    const deleteButton = document.createElement("button");
    const isOnMap = sceneTokens.some((token) => token.id === character.id);
    const avatarImage = tokenAvatarImages.get(character.id);

    row.className = "character-row";
    row.classList.toggle("is-on-map", isOnMap);
    entry.type = "button";
    entry.className = "character-entry";
    entry.draggable = true;
    entry.dataset.characterId = character.id;
    avatar.className = "character-avatar";
    avatar.style.setProperty("--character-color", character.color);
    text.className = "character-text";
    name.className = "character-name";
    status.className = "character-status";
    name.textContent = character.name;
    status.textContent = isOnMap ? "已在地图上" : "可拖入地图";

    if (avatarImage) {
      const image = document.createElement("img");
      const diameter = 100;
      const radius = diameter / 2;
      const scale = character.avatarScale ?? 1;
      const offsetX = (character.avatarOffsetX ?? 0) * radius;
      const offsetY = (character.avatarOffsetY ?? 0) * radius;
      const ratio = avatarImage.image.naturalWidth / avatarImage.image.naturalHeight || 1;
      const width = ratio >= 1 ? diameter * scale * ratio : diameter * scale;
      const height = ratio >= 1 ? diameter * scale : (diameter * scale) / ratio;

      image.src = avatarImage.src;
      image.alt = `${character.name} 头像`;
      image.style.width = `${width}%`;
      image.style.height = `${height}%`;
      image.style.left = `${50 + offsetX}%`;
      image.style.top = `${50 + offsetY}%`;
      avatar.append(image);
    } else {
      avatar.textContent = character.name.trim().slice(0, 1).toUpperCase() || "P";
    }

    deleteButton.type = "button";
    deleteButton.className = "delete-character-button";
    deleteButton.setAttribute("aria-label", `删除角色 ${character.name}`);
    deleteButton.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Z"/><path d="M6 9h12l-1 12H7L6 9Zm4 2v8h2v-8h-2Zm4 0v8h2v-8h-2Z"/></svg>';
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteCharacter(character.id);
    });

    entry.addEventListener("click", () => openTokenInspector(character.id));
    entry.addEventListener("dragstart", (event) => {
      if (!event.dataTransfer || !isAdmin()) {
        return;
      }

      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData("application/x-trpg-character-id", character.id);
      event.dataTransfer.setData("text/plain", character.id);
    });

    text.append(name, status);
    entry.append(avatar, text);
    row.append(entry, deleteButton);
    return row;
  });

  characterList.replaceChildren(...elements);
  createIcons({
    icons: { Trash2 },
    nameAttr: "data-lucide",
    attrs: {
      "aria-hidden": "true",
      class: "tool-icon",
      focusable: "false",
    },
  });
}

function setCharacterPanelOpen(open: boolean): void {
  isCharacterPanelOpen = open && isAdmin();
  renderCharacterPanel();
}

function isDiceSides(value: number): value is DiceSides {
  return diceSides.includes(value as DiceSides);
}

function parseDiceButton(button: HTMLButtonElement): DiceSides | null {
  const sides = Number(button.dataset.die);
  return isDiceSides(sides) ? sides : null;
}

function canUseDicePanel(): boolean {
  return isLoggedIn() && appMode === "play";
}

function getDiceModifier(): number {
  const value = Number(diceModifierInput.value);
  return Number.isFinite(value) ? Math.trunc(value) : 0;
}

function formatDiceModifier(modifier: number): string | null {
  if (modifier === 0) {
    return null;
  }

  return modifier > 0 ? `+ ${modifier}` : `- ${Math.abs(modifier)}`;
}

function formatDiceSelection(): string {
  const parts = diceSides
    .map((sides) => {
      const count = selectedDice.get(sides) ?? 0;
      return count > 0 ? `${count}d${sides}` : null;
    })
    .filter((part): part is string => part !== null);
  const modifier = formatDiceModifier(getDiceModifier());

  if (parts.length === 0) {
    return "";
  }

  return modifier === null ? parts.join(" + ") : `${parts.join(" + ")} ${modifier}`;
}

function renderDicePanel(): void {
  dicePanel.hidden = !canUseDicePanel();

  for (const button of diceOptionButtons) {
    const sides = parseDiceButton(button);
    const count = sides === null ? 0 : (selectedDice.get(sides) ?? 0);

    button.classList.toggle("is-selected", count > 0);

    if (sides === null) {
      continue;
    }

    if (count === 0) {
      button.textContent = `d${sides}`;
      continue;
    }

    const countElement = document.createElement("span");
    const sidesElement = document.createElement("span");
    countElement.className = "dice-option-count";
    sidesElement.textContent = `d${sides}`;
    countElement.textContent = String(count);
    button.replaceChildren(countElement, sidesElement);
  }

  for (const button of diceAdjustButtons) {
    const sides = parseDiceButton(button);
    const count = sides === null ? 0 : (selectedDice.get(sides) ?? 0);
    button.disabled = button.dataset.diceAction === "decrease" && count === 0;
  }

  diceRollButton.disabled = selectedDice.size === 0;
}

function changeDieSelection(sides: DiceSides, delta: number): void {
  const nextCount = Math.max(0, (selectedDice.get(sides) ?? 0) + delta);

  if (nextCount === 0) {
    selectedDice.delete(sides);
  } else {
    selectedDice.set(sides, nextCount);
  }

  renderDicePanel();
}

function clearDiceSelection(): void {
  selectedDice.clear();
  diceModifierInput.value = "0";
  renderDicePanel();
}

function changeDiceModifier(delta: number): void {
  diceModifierInput.value = String(getDiceModifier() + delta);
  renderDicePanel();
}

function rollDie(sides: DiceSides): number {
  return Math.floor(Math.random() * sides) + 1;
}

function rollSelectedDice(): void {
  if (selectedDice.size === 0) {
    return;
  }

  let total = 0;
  const details: string[] = [];
  const modifier = getDiceModifier();
  const formula = formatDiceSelection();

  for (const sides of diceSides) {
    const count = selectedDice.get(sides) ?? 0;

    if (count === 0) {
      continue;
    }

    const rolls = Array.from({ length: count }, () => rollDie(sides));
    const subtotal = rolls.reduce((sum, roll) => sum + roll, 0);
    total += subtotal;
    details.push(`${count}d${sides}: ${rolls.join(", ")}`);
  }

  total += modifier;

  if (modifier !== 0) {
    details.push(`加值: ${modifier > 0 ? "+" : ""}${modifier}`);
  }

  networkClient.sendDiceChatMessage({
    kind: "dice",
    formula,
    total,
    detail: details.join(" · "),
  });
  setChatPanelOpen(true);
  clearDiceSelection();
}

function getSelectedImage(): SceneImage | null {
  return sceneImages.find((image) => image.id === selectedImageId) ?? null;
}

function getSelectedToken(): SceneToken | null {
  return sceneTokens.find((token) => token.id === selectedTokenId) ?? null;
}

function getInspectedCharacter(): SceneCharacter | null {
  return sceneCharacters.find((character) => character.id === inspectedCharacterId) ?? null;
}

function getInspectedTokenInstance(): SceneToken | null {
  return inspectedCharacterId ? (sceneTokens.find((token) => token.id === inspectedCharacterId) ?? null) : null;
}

function getSelectedDoor(): SceneDoor | null {
  return selectedDoorId ? (sceneDoors.get(selectedDoorId) ?? null) : null;
}

function getSelectedRoom(): SceneRoom | null {
  return sceneRooms.find((room) => room.id === selectedRoomId) ?? null;
}

function doorId(door: Pick<SceneDoor, "type" | "x" | "y">): string {
  return `${door.type}:${door.x},${door.y}`;
}

function movementBlockedEdgeSets(): { vertical: Set<string>; horizontal: Set<string> } {
  return buildMovementBlockedEdgeSets(blockedVerticalEdges, blockedHorizontalEdges, sceneDoors.values());
}

function closedRegionAt(worldPoint: Vector2): Cell[] {
  const boundaryEdges = roomBoundaryEdgeSets(blockedVerticalEdges, blockedHorizontalEdges, sceneDoors.values());
  return findClosedRegion(worldToCell(worldPoint), boundaryEdges.vertical, boundaryEdges.horizontal);
}

function findRoomByCells(cells: Cell[]): SceneRoom | null {
  const key = roomKeyFromCells(cells);
  return sceneRooms.find((room) => roomKeyFromCells(room.cells) === key) ?? null;
}

function distanceToEdge(worldPoint: Vector2, edge: Pick<SceneDoor, "type" | "x" | "y">): number {
  if (edge.type === "vertical") {
    const x = edge.x * GRID_CELL_SIZE;
    const minY = edge.y * GRID_CELL_SIZE;
    const maxY = (edge.y + 1) * GRID_CELL_SIZE;
    return Math.hypot(worldPoint.x - x, worldPoint.y - Math.min(maxY, Math.max(minY, worldPoint.y)));
  }

  const y = edge.y * GRID_CELL_SIZE;
  const minX = edge.x * GRID_CELL_SIZE;
  const maxX = (edge.x + 1) * GRID_CELL_SIZE;
  return Math.hypot(worldPoint.x - Math.min(maxX, Math.max(minX, worldPoint.x)), worldPoint.y - y);
}

function hitTestDoor(worldPoint: Vector2): SceneDoor | null {
  const edge = nearestEditableEdge(worldPoint);
  const door = sceneDoors.get(doorId(edge));
  if (!door) {
    return null;
  }

  return distanceToEdge(worldPoint, door) <= Math.max(4, 10 / camera.zoom) ? door : null;
}

function nearestGridIntersection(worldPoint: Vector2): GridIntersection {
  return {
    x: Math.round(worldPoint.x / GRID_CELL_SIZE),
    y: Math.round(worldPoint.y / GRID_CELL_SIZE),
  };
}

function hitTestWallIntersection(worldPoint: Vector2): GridIntersection | null {
  const intersection = nearestGridIntersection(worldPoint);
  const intersectionWorld = {
    x: intersection.x * GRID_CELL_SIZE,
    y: intersection.y * GRID_CELL_SIZE,
  };
  const hitRadius = Math.min(GRID_CELL_SIZE * 0.45, 12 / camera.zoom);
  const distance = Math.hypot(worldPoint.x - intersectionWorld.x, worldPoint.y - intersectionWorld.y);

  return distance <= hitRadius ? intersection : null;
}

function wallDragTarget(start: GridIntersection, worldPoint: Vector2): GridIntersection {
  const rawTarget = nearestGridIntersection(worldPoint);
  const dx = rawTarget.x - start.x;
  const dy = rawTarget.y - start.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return { x: rawTarget.x, y: start.y };
  }

  return { x: start.x, y: rawTarget.y };
}

function wallEdgesBetween(start: GridIntersection, target: GridIntersection): WallEdge[] {
  if (start.y === target.y) {
    const minX = Math.min(start.x, target.x);
    const maxX = Math.max(start.x, target.x);
    return Array.from({ length: maxX - minX }, (_, index) => ({
      type: "horizontal",
      x: minX + index,
      y: start.y,
    }));
  }

  const minY = Math.min(start.y, target.y);
  const maxY = Math.max(start.y, target.y);
  return Array.from({ length: maxY - minY }, (_, index) => ({
    type: "vertical",
    x: start.x,
    y: minY + index,
  }));
}

function wallEdgesTargetBlocked(edges: WallEdge[]): boolean {
  const firstEdge = edges[0];

  if (!firstEdge) {
    return true;
  }

  return !blockedEdgeSet(firstEdge.type, blockedVerticalEdges, blockedHorizontalEdges).has(edgeKey(firstEdge));
}

function updateWallHover(worldPoint: Vector2): void {
  hoverWallIntersection = canDrawWalls() ? hitTestWallIntersection(worldPoint) : null;
}

function sceneImageSnapshot(image: SceneImage): SceneImageSnapshot {
  const { image: _imageElement, ...snapshot } = image;
  return { ...snapshot };
}

function sceneImageSnapshots(): SceneImageSnapshot[] {
  return sceneImages.map(sceneImageSnapshot);
}

function syncTokenAvatarImages(): void {
  const activeCharacterIds = new Set(sceneCharacters.map((character) => character.id));
  for (const characterId of tokenAvatarImages.keys()) {
    const character = sceneCharacters.find((candidate) => candidate.id === characterId);
    if (!activeCharacterIds.has(characterId) || !character?.avatarSrc) {
      tokenAvatarImages.delete(characterId);
    }
  }

  for (const character of sceneCharacters) {
    const avatarSrc = character.avatarSrc;
    if (!avatarSrc || tokenAvatarImages.get(character.id)?.src === avatarSrc) {
      continue;
    }

    void loadImageSource(avatarSrc, `${character.name} 头像`)
      .then((image) => {
        if (sceneCharacters.some((candidate) => candidate.id === character.id && candidate.avatarSrc === avatarSrc)) {
          tokenAvatarImages.set(character.id, { src: avatarSrc, image });
        }
      })
      .catch((error: unknown) => {
        console.error(error);
      });
  }
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

function isEditingBackground(): boolean {
  return isAdmin() && appMode === "edit" && editMode === "background";
}

function isEditingBlocking(): boolean {
  return isAdmin() && appMode === "edit" && editMode === "blocking";
}

function isEditingRooms(): boolean {
  return isAdmin() && appMode === "edit" && editMode === "rooms";
}

function canDrawWalls(): boolean {
  return isEditingBlocking() && logicTool === "wall";
}

function isPlayMode(): boolean {
  return isLoggedIn() && appMode === "play";
}

function shouldShowLogicMap(): boolean {
  return !isPlayMode() || isLogicMapVisible;
}

function canControlToken(token: SceneCharacter): boolean {
  return currentIdentity?.type === "admin" || currentIdentity?.id === token.id;
}

function canInspectToken(): boolean {
  return isLoggedIn();
}

function canInspectDoor(): boolean {
  return isPlayMode() && isAdmin() && shouldShowLogicMap();
}

function canInspectRoom(): boolean {
  return isEditingRooms();
}

function isTokenAnimating(tokenId: string): boolean {
  return movingTokens.some((animation) => animation.tokenId === tokenId);
}

function availableModes(): AppMode[] {
  return isAdmin() ? ["edit", "play"] : ["play"];
}

function rebuildModeOptions(): void {
  rebuildModeSelectOptions(modeSelect, availableModes());
  rebuildEditModeSelectOptions(editModeSelect, ["background", "blocking", "rooms"]);
}

function renderIdentityList(): void {
  renderIdentityOptions(identityList, buildIdentities(sceneCharacters), enterIdentity);
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

  const nextCharacters = snapshot.characters.map((character) => ({ ...character }));
  const { tokens } = snapshot;
  const previousTokens = new Map(sceneTokens.map((token) => [token.id, token]));
  const nextTokens = tokens.map((token) => ({ ...token, cell: { ...token.cell } }));
  for (const character of nextCharacters) {
    const pendingName = pendingTokenNames.get(character.id);
    if (!pendingName) {
      continue;
    }

    if (character.name === pendingName) {
      pendingTokenNames.delete(character.id);
    } else {
      character.name = pendingName;
    }
  }
  const nextCharacterIds = new Set(nextCharacters.map((character) => character.id));
  for (const characterId of pendingTokenNames.keys()) {
    if (!nextCharacterIds.has(characterId)) {
      pendingTokenNames.delete(characterId);
    }
  }
  const nextCharactersById = new Map(nextCharacters.map((character) => [character.id, character]));
  for (const token of nextTokens) {
    const character = nextCharactersById.get(token.id);
    if (character) {
      Object.assign(token, character, { cell: token.cell });
    }
  }

  const shouldExitDeletedIdentity =
    currentIdentity?.type === "player" && !nextCharacters.some((character) => character.id === currentIdentity?.id);
  const startedAt = performance.now();
  const animations: MovingToken[] = [];
  const movementBlockedEdges = movementBlockedEdgeSets();

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
      movementBlockedEdges.vertical,
      movementBlockedEdges.horizontal,
    );
    const animationPath = path.length > 1 ? path : [previousToken.cell, token.cell];

    animations.push({
      tokenId: token.id,
      path: animationPath.map((cell) => ({ ...cell })),
      startedAt,
      duration: Math.max(1, animationPath.length - 1) * TOKEN_STEP_ANIMATION_MS,
    });
  }

  sceneCharacters.splice(0, sceneCharacters.length, ...nextCharacters);
  sceneTokens.splice(0, sceneTokens.length, ...nextTokens);
  syncTokenAvatarImages();
  blockedVerticalEdges.clear();
  blockedHorizontalEdges.clear();
  for (const edge of snapshot.blockedVerticalEdges) {
    blockedVerticalEdges.add(edge);
  }
  for (const edge of snapshot.blockedHorizontalEdges) {
    blockedHorizontalEdges.add(edge);
  }
  sceneDoors.clear();
  for (const door of snapshot.doors) {
    sceneDoors.set(doorId(door), { ...door });
  }
  sceneRooms.splice(
    0,
    sceneRooms.length,
    ...snapshot.rooms.map((room) => ({
      ...room,
      cells: room.cells.map((cell) => ({ ...cell })),
    })),
  );
  nextTokenIndex = nextAvailableTokenIndex();

  if (selectedTokenId && !sceneTokens.some((token) => token.id === selectedTokenId)) {
    selectedTokenId = null;
  }

  if (inspectedCharacterId && !sceneCharacters.some((character) => character.id === inspectedCharacterId)) {
    inspectedCharacterId = null;
    tokenNameEditing = false;
  }

  if (selectedDoorId && !sceneDoors.has(selectedDoorId)) {
    selectedDoorId = null;
  }

  if (selectedRoomId && !sceneRooms.some((room) => room.id === selectedRoomId)) {
    selectedRoomId = null;
  }

  if (currentIdentity?.type === "player") {
    const currentCharacter = sceneCharacters.find((character) => character.id === currentIdentity?.id);
    if (currentCharacter && currentIdentity.name !== currentCharacter.name) {
      currentIdentity = { ...currentIdentity, name: currentCharacter.name };
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
  previewRoomCells = [];
  renderIdentityList();
  renderCharacterPanel();
  updateTokenInspector();
  updateSelectionPanel();

  if (shouldExitDeletedIdentity) {
    showIdentityScreen();
  }
}

function nextAvailableTokenIndex(): number {
  const maxTokenIndex = sceneCharacters.reduce((maxIndex, character) => {
    const match = /^P(\d+)$/.exec(character.name);
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
  inspectedCharacterId = null;
  selectedDoorId = null;
  selectedRoomId = null;
  interaction = null;
  previewPath = [];
  previewRoomCells = [];
  previewTokenPosition = null;
  isCharacterPanelOpen = false;
  identityBadge.textContent = identityLabel(null);
  renderIdentityList();
  rebuildModeOptions();
  updateModeControls();
  updateTokenInspector();
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
      tokenAvatarImages: new Map([...tokenAvatarImages].map(([tokenId, avatar]) => [tokenId, avatar.image])),
      blockedVerticalEdges,
      blockedHorizontalEdges,
      doors: [...sceneDoors.values()],
      selectedDoorId,
      rooms: sceneRooms,
      selectedRoomId,
      previewRoomCells,
      showLogicMap: shouldShowLogicMap(),
      previewPath,
      selectedImage: getSelectedImage(),
      selectedTokenId,
      interaction,
      movingTokens,
      previewTokenPosition,
      hoverWallIntersection: canDrawWalls() ? hoverWallIntersection : null,
      previewWallEdges,
      previewWallTargetBlocked,
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

function hitTestRoom(worldPoint: Vector2): SceneRoom | null {
  const targetCell = worldToCell(worldPoint);
  return [...sceneRooms].reverse().find((room) => room.cells.some((cell) => sameCell(cell, targetCell))) ?? null;
}

function updateRoomPreview(worldPoint: Vector2): void {
  previewRoomCells = isEditingRooms() && logicTool === "room" ? closedRegionAt(worldPoint) : [];
}

function hitTestResizeHandle(screenPoint: Vector2) {
  return findHitResizeHandle(getSelectedImage(), screenPoint, { zoom: camera.zoom, worldToScreen });
}

function hitTestRotateHandle(screenPoint: Vector2): boolean {
  return findHitRotateHandle(getSelectedImage(), screenPoint, { zoom: camera.zoom, worldToScreen });
}

function setCursor(screenPoint: Vector2): void {
  if (interaction) {
    canvas.classList.toggle("is-dragging", interaction.type !== "draw-wall");
    canvas.style.cursor = interaction.type === "draw-wall" ? "crosshair" : "grabbing";
    return;
  }

  canvas.classList.remove("is-dragging");

  const resizeHandle = hitTestResizeHandle(screenPoint);
  const worldPoint = screenToWorld(screenPoint);

  const tokenHit = hitTestToken(worldPoint);
  const doorHit = canInspectDoor() ? hitTestDoor(worldPoint) : null;
  const roomHit = isEditingRooms() && logicTool === "inspect-room" ? hitTestRoom(worldPoint) : null;

  if (isEditingBackground() && hitTestRotateHandle(screenPoint)) {
    canvas.style.cursor = "grab";
  } else if (isEditingBackground() && resizeHandle) {
    canvas.style.cursor = getResizeCursor(resizeHandle);
  } else if ((isEditingBlocking() && (logicTool === "wall" || logicTool === "door")) || (isEditingRooms() && logicTool === "room")) {
    canvas.style.cursor = "crosshair";
  } else if (roomHit) {
    canvas.style.cursor = "pointer";
  } else if (doorHit) {
    canvas.style.cursor = "pointer";
  } else if (isPlayMode() && tokenHit && canControlToken(tokenHit)) {
    canvas.style.cursor = "grab";
  } else if (isEditingBackground() && hitTestImage(worldPoint)) {
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
  const selectedDoor = canInspectDoor() ? getSelectedDoor() : null;
  const selectedRoom = canInspectRoom() ? getSelectedRoom() : null;

  if (!selectedImage && !selectedDoor && !selectedRoom) {
    selectionPanel.classList.remove("is-open");
    selectionPanel.setAttribute("aria-hidden", "true");
    return;
  }

  if (selectedImage) {
    tokenNameEditing = false;
    selectionEyebrow.textContent = "图片检视";
    selectionTitle.textContent = selectedImage.name;
    imageSelectionControls.hidden = false;
    imageSelectionActions.hidden = false;
    imageSelectionDanger.hidden = false;
    doorSelectionForm.hidden = true;
    roomSelectionForm.hidden = true;
  }

  if (selectedDoor) {
    tokenNameEditing = false;
    selectionEyebrow.textContent = "门检视";
    selectionTitle.textContent = `${selectedDoor.type === "vertical" ? "纵向" : "横向"}门 (${selectedDoor.x}, ${selectedDoor.y})`;
    imageSelectionControls.hidden = true;
    imageSelectionActions.hidden = true;
    imageSelectionDanger.hidden = true;
    doorSelectionForm.hidden = false;
    roomSelectionForm.hidden = true;
    doorBlocksMovementInput.checked = !selectedDoor.isOpen;
    doorBlocksMovementInput.disabled = !isAdmin();
  }

  if (selectedRoom) {
    tokenNameEditing = false;
    selectionEyebrow.textContent = "房间检视";
    selectionTitle.textContent = selectedRoom.name || "未命名房间";
    imageSelectionControls.hidden = true;
    imageSelectionActions.hidden = true;
    imageSelectionDanger.hidden = true;
    doorSelectionForm.hidden = true;
    roomSelectionForm.hidden = false;
    if (document.activeElement !== roomNameInput) {
      roomNameInput.value = selectedRoom.name;
    }
  }

  selectionPanel.classList.add("is-open");
  selectionPanel.setAttribute("aria-hidden", "false");
}

function updateTokenInspector(): void {
  const character = getInspectedCharacter();

  if (!character || !canInspectToken()) {
    tokenInspectorOverlay.hidden = true;
    tokenNameEditing = false;
    return;
  }

  const tokenInstance = getInspectedTokenInstance();
  const canEditToken = canControlToken(character);
  const isEditingTokenName = tokenNameEditing && canEditToken;

  tokenInspectorOverlay.hidden = false;
  tokenNameDisplay.hidden = false;
  tokenNameValue.textContent = character.name;
  tokenNameValue.hidden = isEditingTokenName;
  editTokenNameButton.disabled = !canEditToken;
  tokenNameInput.hidden = !isEditingTokenName;
  tokenNameInput.disabled = !canEditToken;
  avatarUploadInput.disabled = !canEditToken;
  avatarUploadButton.classList.toggle("is-disabled", !canEditToken);
  avatarAdjustControls.hidden = !character.avatarSrc;
  editAvatarButton.disabled = !canEditToken;
  resetAvatarAdjustmentButton.disabled = !canEditToken;
  tokenInstanceActions.hidden = !isAdmin() || !tokenInstance;
  deleteTokenInstanceButton.disabled = !isAdmin() || !tokenInstance;
  tokenPanelHelp.textContent = canEditToken ? "修改后会同步到所有客户端。" : "只有主持人或该角色玩家可以修改姓名。";

  if (document.activeElement !== tokenNameInput || !isEditingTokenName) {
    tokenNameInput.value = character.name;
  }
}

function openTokenInspector(characterId: string): void {
  if (!sceneCharacters.some((character) => character.id === characterId)) {
    return;
  }

  inspectedCharacterId = characterId;
  tokenNameEditing = false;
  updateTokenInspector();
}

function closeTokenInspector(): void {
  inspectedCharacterId = null;
  tokenNameEditing = false;
  updateTokenInspector();
}

function selectImage(imageId: string | null): void {
  selectedImageId = imageId;
  if (imageId) {
    selectedTokenId = null;
    closeTokenInspector();
    selectedDoorId = null;
  }
  updateSelectionPanel();
}

function selectToken(tokenId: string | null, inspect = false): void {
  selectedTokenId = tokenId;
  if (tokenId) {
    selectedImageId = null;
    selectedDoorId = null;
    selectedRoomId = null;
    if (inspect) {
      openTokenInspector(tokenId);
    }
  } else {
    selectedTokenId = null;
  }
  updateSelectionPanel();
}

function selectDoor(door: SceneDoor | null): void {
  selectedDoorId = door ? doorId(door) : null;
  if (door) {
    selectedImageId = null;
    selectedTokenId = null;
    closeTokenInspector();
    selectedRoomId = null;
  }
  updateSelectionPanel();
}

function selectRoom(roomId: string | null): void {
  selectedRoomId = roomId;
  if (roomId) {
    selectedImageId = null;
    selectedTokenId = null;
    closeTokenInspector();
    selectedDoorId = null;
  }
  updateSelectionPanel();
}

function setAppMode(nextMode: AppMode): void {
  const modes = availableModes();
  appMode = modes.includes(nextMode) ? nextMode : modes[0];
  interaction = null;
  previewPath = [];
  previewTokenPosition = null;

  if (!isEditingBackground()) {
    selectedImageId = null;
  }

  if (!isPlayMode()) {
    selectedTokenId = null;
    isChatPanelOpen = false;
  }

  if (!canInspectDoor()) {
    selectedDoorId = null;
  }

  if (!canInspectRoom()) {
    selectedRoomId = null;
    previewRoomCells = [];
  }

  updateModeControls();
  renderCharacterPanel();
  updateTokenInspector();
  updateSelectionPanel();
}

function setEditMode(nextMode: EditMode): void {
  editMode = nextMode;
  interaction = null;
  previewPath = [];
  previewTokenPosition = null;

  if (editMode === "blocking" && logicTool !== "wall" && logicTool !== "door") {
    logicTool = "wall";
  } else if (editMode === "rooms") {
    logicTool = "inspect-room";
  }

  if (!isEditingBackground()) {
    selectedImageId = null;
  }

  if (!canInspectDoor()) {
    selectedDoorId = null;
  }

  if (!canInspectRoom()) {
    selectedRoomId = null;
    previewRoomCells = [];
  }

  updateModeControls();
  updateSelectionPanel();
}

function setLogicTool(nextTool: LogicTool): void {
  logicTool = nextTool;
  previewRoomCells = [];
  updateModeControls();
}

function setLogicMapVisible(visible: boolean): void {
  isLogicMapVisible = visible;
  if (!shouldShowLogicMap()) {
    selectedDoorId = null;
  }
  updateModeControls();
  updateSelectionPanel();
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
      wallModeButton,
      doorModeButton,
      roomModeButton,
      clearWallsButton,
      logicMapVisibilityButton,
      resetSizeButton,
      layerUpButton,
      layerDownButton,
      layerTopButton,
      layerBottomButton,
      deleteImageButton,
      canvas,
    },
    {
      appMode,
      editMode,
      logicTool,
      isLogicMapVisible,
      isLoggedIn: isLoggedIn(),
      isAdmin: isAdmin(),
    },
  );
  renderDicePanel();
  renderChatPanel();
  renderCharacterPanel();
}

function addCharacter(): void {
  const tokenIndex = nextTokenIndex++;
  const character = createSceneCharacter(tokenIndex);

  sceneCharacters.push(character);
  renderIdentityList();
  renderCharacterPanel();
  openTokenInspector(character.id);
  networkClient.sendCharacterAdded(character);
}

function placeCharacterAtCell(characterId: string, cell: Cell): void {
  if (!isAdmin() || isCellOccupiedByToken(cell, sceneTokens) || sceneTokens.some((token) => token.id === characterId)) {
    return;
  }

  const character = sceneCharacters.find((candidate) => candidate.id === characterId);
  if (!character) {
    return;
  }

  const token = createSceneToken(character, cell);
  sceneTokens.push(token);
  selectedTokenId = token.id;
  renderCharacterPanel();
  updateTokenInspector();
  networkClient.sendTokenAdded(token);
}

function addTokenAtCell(cell: Cell): void {
  if (isCellOccupiedByToken(cell, sceneTokens)) {
    return;
  }

  const tokenIndex = nextTokenIndex++;
  const character = createSceneCharacter(tokenIndex);
  const token = createSceneToken(character, cell);

  sceneCharacters.push(character);
  sceneTokens.push(token);
  renderIdentityList();
  renderCharacterPanel();
  openTokenInspector(token.id);
  networkClient.sendCharacterAdded(character);
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
  previewPath = [];
  previewTokenPosition = null;
  renderCharacterPanel();
  updateTokenInspector();
  updateSelectionPanel();
  networkClient.sendTokenDeleted(tokenId);
}

function deleteCharacter(characterId: string): void {
  if (!isAdmin()) {
    return;
  }

  const characterIndex = sceneCharacters.findIndex((character) => character.id === characterId);
  if (characterIndex === -1) {
    return;
  }

  sceneCharacters.splice(characterIndex, 1);
  const tokenIndex = sceneTokens.findIndex((token) => token.id === characterId);
  if (tokenIndex !== -1) {
    sceneTokens.splice(tokenIndex, 1);
  }
  pendingTokenNames.delete(characterId);
  movingTokens = movingTokens.filter((animation) => animation.tokenId !== characterId);
  if (selectedTokenId === characterId) {
    selectedTokenId = null;
  }
  if (inspectedCharacterId === characterId) {
    inspectedCharacterId = null;
    tokenNameEditing = false;
  }
  previewPath = [];
  previewTokenPosition = null;
  renderIdentityList();
  renderCharacterPanel();
  updateTokenInspector();
  updateSelectionPanel();
  networkClient.sendCharacterDeleted(characterId);
}

function toggleDoorAtEdge(edge: { type: WallEdgeType; x: number; y: number }): void {
  const id = doorId(edge);
  const existingDoor = sceneDoors.get(id);

  if (existingDoor) {
    sceneDoors.delete(id);
    if (selectedDoorId === id) {
      selectedDoorId = null;
    }
    previewPath = [];
    updateSelectionPanel();
    networkClient.sendDoorDeleted(edge.type, edge.x, edge.y);
    return;
  }

  const door: SceneDoor = { ...edge, isOpen: true };
  const wallSet = blockedEdgeSet(edge.type, blockedVerticalEdges, blockedHorizontalEdges);
  const wallKey = edgeKey(edge);
  if (wallSet.delete(wallKey)) {
    networkClient.sendBlockedEdgeChanged(edge.type, edge.x, edge.y, false);
  }

  sceneDoors.set(id, door);
  previewPath = [];
  networkClient.sendDoorChanged(door);
}

function applyWallEdges(edges: WallEdge[], blocked: boolean): void {
  if (edges.length === 0) {
    return;
  }

  for (const edge of edges) {
    const wallSet = blockedEdgeSet(edge.type, blockedVerticalEdges, blockedHorizontalEdges);
    const wallKey = edgeKey(edge);

    if (blocked) {
      const doorIdAtEdge = doorId(edge);
      if (sceneDoors.delete(doorIdAtEdge)) {
        if (selectedDoorId === doorIdAtEdge) {
          selectedDoorId = null;
        }
        networkClient.sendDoorDeleted(edge.type, edge.x, edge.y);
      }

      if (!wallSet.has(wallKey)) {
        wallSet.add(wallKey);
        networkClient.sendBlockedEdgeChanged(edge.type, edge.x, edge.y, true);
      }
    } else if (wallSet.delete(wallKey)) {
      networkClient.sendBlockedEdgeChanged(edge.type, edge.x, edge.y, false);
    }
  }

  previewPath = [];
  updateSelectionPanel();
}

function updateSelectedDoorState(isOpen: boolean): void {
  const door = getSelectedDoor();
  if (!door || !canInspectDoor() || door.isOpen === isOpen) {
    return;
  }

  door.isOpen = isOpen;
  previewPath = [];
  networkClient.sendDoorChanged(door);
  updateSelectionPanel();
}

function selectRoomFromCells(cells: Cell[]): void {
  if (cells.length === 0) {
    return;
  }

  const existingRoom = findRoomByCells(cells);
  if (existingRoom) {
    selectRoom(existingRoom.id);
    return;
  }

  const room: SceneRoom = {
    id: `room-${crypto.randomUUID()}`,
    name: "",
    cells: cells.map((cell) => ({ ...cell })),
  };

  sceneRooms.push(room);
  previewRoomCells = [];
  selectRoom(room.id);
  networkClient.sendRoomUpdated(room);
}

function updateSelectedRoomName(name: string): void {
  const room = getSelectedRoom();
  if (!room || !canInspectRoom()) {
    return;
  }

  const nextName = name.trim().slice(0, 32);
  if (room.name === nextName) {
    return;
  }

  room.name = nextName;
  networkClient.sendRoomUpdated(room);
  updateSelectionPanel();
}

function deleteSelectedRoom(): void {
  const selectedRoom = getSelectedRoom();
  if (!selectedRoom || !canInspectRoom()) {
    return;
  }

  const roomIndex = sceneRooms.findIndex((room) => room.id === selectedRoom.id);
  if (roomIndex === -1) {
    return;
  }

  sceneRooms.splice(roomIndex, 1);
  selectedRoomId = null;
  previewRoomCells = [];
  updateSelectionPanel();
  networkClient.sendRoomDeleted(selectedRoom.id);
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

function deleteSelectedImage(): void {
  const selectedImage = getSelectedImage();
  if (!selectedImage || !isEditingBackground()) {
    return;
  }

  const imageIndex = sceneImages.findIndex((image) => image.id === selectedImage.id);
  if (imageIndex === -1) {
    return;
  }

  sceneImages.splice(imageIndex, 1);
  normalizeZIndexes();
  selectedImageId = null;
  if (
    interaction &&
    (interaction.type === "move-image" || interaction.type === "resize-image" || interaction.type === "rotate-image") &&
    interaction.imageId === selectedImage.id
  ) {
    interaction = null;
  }
  updateSelectionPanel();
  networkClient.sendImageDeleted(selectedImage.id);
}

function syncTokenInstanceFromCharacter(character: SceneCharacter): void {
  const token = sceneTokens.find((candidate) => candidate.id === character.id);
  if (!token) {
    return;
  }

  Object.assign(token, character, { cell: token.cell });
}

function sendTokenNameUpdate(character: SceneCharacter): void {
  pendingTokenNames.set(character.id, character.name);
  networkClient.sendCharacterUpdated(character);
}

function updateSelectedTokenName(name: string): void {
  const token = getInspectedCharacter();
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
  renderCharacterPanel();
  syncTokenInstanceFromCharacter(token);
  updateTokenInspector();
  sendTokenNameUpdate(token);
}

function startTokenNameEditing(): void {
  const token = getInspectedCharacter();
  if (!token || !canControlToken(token)) {
    return;
  }

  tokenNameEditing = true;
  updateTokenInspector();
  tokenNameInput.focus();
  tokenNameInput.select();
}

function stopTokenNameEditing(): void {
  if (!tokenNameEditing) {
    return;
  }

  updateSelectedTokenName(tokenNameInput.value);
  tokenNameEditing = false;
  updateTokenInspector();
}

function updateTokenAvatar(token: SceneCharacter): void {
  syncTokenInstanceFromCharacter(token);
  renderCharacterPanel();
  updateTokenInspector();
  networkClient.sendCharacterUpdated(token);
}

async function uploadSelectedTokenAvatar(file: File): Promise<void> {
  const token = getInspectedCharacter();
  if (!token || !canControlToken(token)) {
    return;
  }

  const loadedAvatar = await loadImageFile(file);
  if (!loadedAvatar) {
    return;
  }

  openAvatarEditor(token, loadedAvatar.src, loadedAvatar.image, {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });
}

async function editSelectedTokenAvatar(): Promise<void> {
  const token = getInspectedCharacter();
  if (!token || !canControlToken(token) || !token.avatarSrc) {
    return;
  }

  const cachedAvatar = tokenAvatarImages.get(token.id);
  const image =
    cachedAvatar?.src === token.avatarSrc ? cachedAvatar.image : await loadImageSource(token.avatarSrc, `${token.name} 头像`);

  openAvatarEditor(token, token.avatarSrc, image, {
    scale: token.avatarScale ?? 1,
    offsetX: token.avatarOffsetX ?? 0,
    offsetY: token.avatarOffsetY ?? 0,
  });
}

function resetSelectedTokenAvatarAdjustment(): void {
  const token = getInspectedCharacter();
  if (!token || !canControlToken(token) || !token.avatarSrc) {
    return;
  }

  token.avatarScale = 1;
  token.avatarOffsetX = 0;
  token.avatarOffsetY = 0;
  updateTokenAvatar(token);
}

function avatarEditorMaskSize(): number {
  return avatarEditorStage.clientWidth * 0.72;
}

function clampAvatarEditorTransform(
  editor: Pick<NonNullable<typeof avatarEditor>, "image">,
  transform: { scale: number; offsetX: number; offsetY: number },
): { scale: number; offsetX: number; offsetY: number } {
  const maskSize = avatarEditorMaskSize();
  const maskRadius = maskSize / 2;
  const ratio = editor.image.naturalWidth / editor.image.naturalHeight || 1;
  const scale = Math.min(3, Math.max(1, transform.scale));
  const imageWidth = ratio >= 1 ? maskSize * scale * ratio : maskSize * scale;
  const imageHeight = ratio >= 1 ? maskSize * scale : (maskSize * scale) / ratio;
  const maxOffsetX = Math.max(0, (imageWidth - maskSize) / 2) / maskRadius;
  const maxOffsetY = Math.max(0, (imageHeight - maskSize) / 2) / maskRadius;

  return {
    scale,
    offsetX: Math.min(maxOffsetX, Math.max(-maxOffsetX, transform.offsetX)),
    offsetY: Math.min(maxOffsetY, Math.max(-maxOffsetY, transform.offsetY)),
  };
}

function renderAvatarEditor(): void {
  if (!avatarEditor) {
    avatarEditorOverlay.hidden = true;
    return;
  }

  avatarEditorOverlay.hidden = false;
  const nextTransform = clampAvatarEditorTransform(avatarEditor, avatarEditor);
  avatarEditor.scale = nextTransform.scale;
  avatarEditor.offsetX = nextTransform.offsetX;
  avatarEditor.offsetY = nextTransform.offsetY;

  const maskSize = avatarEditorMaskSize();
  const maskRadius = maskSize / 2;
  const ratio = avatarEditor.image.naturalWidth / avatarEditor.image.naturalHeight || 1;
  const width = ratio >= 1 ? maskSize * avatarEditor.scale * ratio : maskSize * avatarEditor.scale;
  const height = ratio >= 1 ? maskSize * avatarEditor.scale : (maskSize * avatarEditor.scale) / ratio;

  avatarEditorImage.src = avatarEditor.src;
  avatarEditorImage.style.width = `${width}px`;
  avatarEditorImage.style.height = `${height}px`;
  avatarEditorImage.style.left = `${avatarEditorStage.clientWidth / 2 + avatarEditor.offsetX * maskRadius}px`;
  avatarEditorImage.style.top = `${avatarEditorStage.clientHeight / 2 + avatarEditor.offsetY * maskRadius}px`;
  avatarEditorImage.style.transform = "translate(-50%, -50%)";
}

function openAvatarEditor(
  token: SceneCharacter,
  src: string,
  image: HTMLImageElement,
  transform: { scale: number; offsetX: number; offsetY: number },
): void {
  avatarEditor = {
    tokenId: token.id,
    src,
    image,
    scale: transform.scale,
    offsetX: transform.offsetX,
    offsetY: transform.offsetY,
    drag: null,
  };
  renderAvatarEditor();
}

function closeAvatarEditor(): void {
  avatarEditor = null;
  avatarEditorStage.classList.remove("is-dragging");
  avatarEditorOverlay.hidden = true;
}

function saveAvatarEditor(): void {
  if (!avatarEditor) {
    return;
  }

  const token = sceneCharacters.find((candidate) => candidate.id === avatarEditor?.tokenId);
  if (!token || !canControlToken(token)) {
    closeAvatarEditor();
    return;
  }

  const transform = clampAvatarEditorTransform(avatarEditor, avatarEditor);
  token.avatarSrc = avatarEditor.src;
  token.avatarScale = transform.scale;
  token.avatarOffsetX = transform.offsetX;
  token.avatarOffsetY = transform.offsetY;
  tokenAvatarImages.set(token.id, { src: avatarEditor.src, image: avatarEditor.image });
  updateTokenAvatar(token);
  closeAvatarEditor();
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

wallModeButton.addEventListener("click", () => {
  if (isEditingBlocking()) {
    setLogicTool("wall");
  }
});

doorModeButton.addEventListener("click", () => {
  if (isEditingBlocking()) {
    setLogicTool("door");
  }
});

roomModeButton.addEventListener("click", () => {
  if (isEditingRooms()) {
    setLogicTool(logicTool === "room" ? "inspect-room" : "room");
  }
});

clearWallsButton.addEventListener("click", () => {
  if (!isEditingBlocking()) {
    return;
  }

  const shouldClearWalls = window.confirm("确定要清空所有阻挡边和门吗？此操作会同步到所有客户端。");
  if (!shouldClearWalls) {
    return;
  }

  blockedVerticalEdges.clear();
  blockedHorizontalEdges.clear();
  sceneDoors.clear();
  selectedDoorId = null;
  previewPath = [];
  previewWallEdges = [];
  networkClient.sendBlockedEdgesCleared();
});

logicMapVisibilityButton.addEventListener("click", () => {
  if (!isPlayMode()) {
    return;
  }

  setLogicMapVisible(!isLogicMapVisible);
});

uploadInput.addEventListener("change", () => {
  if (isEditingBackground() && uploadInput.files) {
    handleFiles(uploadInput.files);
  }

  uploadInput.value = "";
});

function draggedCharacterId(event: DragEvent): string | null {
  return event.dataTransfer?.getData("application/x-trpg-character-id") || null;
}

canvas.addEventListener("dragover", (event) => {
  if (!isAdmin() || !event.dataTransfer?.types.includes("application/x-trpg-character-id")) {
    return;
  }

  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
});

canvas.addEventListener("drop", (event) => {
  const characterId = draggedCharacterId(event);
  if (!isAdmin() || !characterId) {
    return;
  }

  event.preventDefault();
  placeCharacterAtCell(characterId, worldToCell(screenToWorld(screenPointFromEvent(event))));
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
    closeTokenInspector();
    selectedDoorId = null;
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

  if (isEditingBlocking() || isEditingRooms()) {
    selectedImageId = null;
    selectedTokenId = null;

    if (isEditingRooms()) {
      if (logicTool !== "room") {
        selectRoom(hitTestRoom(worldPoint)?.id ?? null);
        return;
      }

      selectedRoomId = null;
      updateSelectionPanel();
      const region = previewRoomCells.length > 0 ? previewRoomCells : closedRegionAt(worldPoint);
      selectRoomFromCells(region);
      return;
    }

    selectedRoomId = null;
    updateSelectionPanel();

    if (!isEditingBlocking()) {
      return;
    }

    if (logicTool === "door") {
      const edge = nearestEditableEdge(worldPoint);
      toggleDoorAtEdge(edge);
      return;
    }

    const start = hitTestWallIntersection(worldPoint);
    if (!start) {
      hoverWallIntersection = null;
      return;
    }

    hoverWallIntersection = start;
    previewWallEdges = [];
    previewWallTargetBlocked = true;
    interaction = {
      type: "draw-wall",
      pointerId: event.pointerId,
      start,
      target: start,
      targetBlocked: true,
      edges: [],
    };
    canvas.setPointerCapture(event.pointerId);
    setCursor(screenPoint);
    return;
  }

  if (isEditingBackground() && selectedImage && rotateHandleHit) {
    const angle = Math.atan2(worldPoint.y - selectedImage.y, worldPoint.x - selectedImage.x);
    interaction = {
      type: "rotate-image",
      imageId: selectedImage.id,
      pointerId: event.pointerId,
      startAngle: angle,
      startRotation: selectedImage.rotation,
    };
  } else if (isEditingBackground() && selectedImage && resizeHandle) {
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
    const doorHit = canInspectDoor() ? hitTestDoor(worldPoint) : null;
    const imageHit = isEditingBackground() ? hitTestImage(worldPoint) : null;

    if (doorHit) {
      selectDoor(doorHit);
    } else if (tokenHit && canControlToken(tokenHit) && !isTokenAnimating(tokenHit.id)) {
      const targetCell = worldToCell(worldPoint);
      const movementBlockedEdges = movementBlockedEdgeSets();
      const path = findGridPath(
        tokenHit.cell,
        targetCell,
        tokenHit.id,
        sceneTokens,
        movementBlockedEdges.vertical,
        movementBlockedEdges.horizontal,
      );
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
      selectedDoorId = null;
      selectedRoomId = null;
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
    updateRoomPreview(worldPoint);
    updateWallHover(worldPoint);
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
      const movementBlockedEdges = movementBlockedEdgeSets();
      const path = findGridPath(
        currentInteraction.startCell,
        targetCell,
        currentInteraction.tokenId,
        sceneTokens,
        movementBlockedEdges.vertical,
        movementBlockedEdges.horizontal,
      );
      currentInteraction.targetCell = targetCell;
      currentInteraction.path = path;
      previewPath = path;
    }
  }

  if (currentInteraction.type === "draw-wall") {
    currentInteraction.target = wallDragTarget(currentInteraction.start, worldPoint);
    currentInteraction.edges = wallEdgesBetween(currentInteraction.start, currentInteraction.target);
    currentInteraction.targetBlocked = wallEdgesTargetBlocked(currentInteraction.edges);
    hoverWallIntersection = currentInteraction.start;
    previewWallEdges = currentInteraction.edges;
    previewWallTargetBlocked = currentInteraction.targetBlocked;
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
        networkClient.sendTokenMoved(token, currentInteraction.path);
      }

      previewPath = [];
      previewTokenPosition = null;
    }

    if (currentInteraction.type === "draw-wall") {
      applyWallEdges(currentInteraction.edges, currentInteraction.targetBlocked);
      previewWallEdges = [];
      previewWallTargetBlocked = true;
      hoverWallIntersection = hitTestWallIntersection(screenToWorld(screenPointFromEvent(event)));
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

    if (interaction.type === "draw-wall") {
      previewWallEdges = [];
      previewWallTargetBlocked = true;
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

canvas.addEventListener("pointerleave", () => {
  previewRoomCells = [];
  hoverWallIntersection = null;
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
  if (!isEditingBackground() || !hasDraggedImage(event)) {
    return;
  }

  event.preventDefault();
  dragDepth += 1;
  dropOverlay.hidden = false;
});

window.addEventListener("dragover", (event) => {
  if (!isEditingBackground() && hasDraggedImage(event)) {
    event.preventDefault();
    return;
  }

  if (!hasDraggedImage(event)) {
    return;
  }

  event.preventDefault();
});

window.addEventListener("dragleave", (event) => {
  if (!isEditingBackground() || !hasDraggedImage(event)) {
    return;
  }

  event.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  dropOverlay.hidden = dragDepth === 0;
});

window.addEventListener("drop", (event) => {
  if (!isEditingBackground()) {
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
deleteImageButton.addEventListener("click", deleteSelectedImage);
deleteRoomButton.addEventListener("click", deleteSelectedRoom);
diceOptionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const sides = parseDiceButton(button);

    if (sides !== null) {
      changeDieSelection(sides, 1);
    }
  });
});
diceAdjustButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const sides = parseDiceButton(button);

    if (sides !== null) {
      changeDieSelection(sides, button.dataset.diceAction === "decrease" ? -1 : 1);
    }
  });
});
diceRollButton.addEventListener("click", rollSelectedDice);
diceClearButton.addEventListener("click", () => clearDiceSelection());
diceModifierInput.addEventListener("input", renderDicePanel);
diceModifierDecreaseButton.addEventListener("click", () => changeDiceModifier(-1));
diceModifierIncreaseButton.addEventListener("click", () => changeDiceModifier(1));
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
doorBlocksMovementInput.addEventListener("change", () => {
  updateSelectedDoorState(!doorBlocksMovementInput.checked);
});
roomNameInput.addEventListener("input", () => {
  updateSelectedRoomName(roomNameInput.value);
});
roomSelectionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateSelectedRoomName(roomNameInput.value);
  roomNameInput.blur();
});
avatarUploadInput.addEventListener("change", () => {
  const file = avatarUploadInput.files?.[0];
  if (file) {
    void uploadSelectedTokenAvatar(file).catch((error: unknown) => {
      console.error(error);
    });
  }

  avatarUploadInput.value = "";
});
editAvatarButton.addEventListener("click", () => {
  void editSelectedTokenAvatar().catch((error: unknown) => {
    console.error(error);
  });
});
resetAvatarAdjustmentButton.addEventListener("click", resetSelectedTokenAvatarAdjustment);
avatarEditorStage.addEventListener("pointerdown", (event) => {
  if (!avatarEditor || event.button !== 0) {
    return;
  }

  event.preventDefault();
  avatarEditor.drag = {
    pointerId: event.pointerId,
    startPointer: { x: event.clientX, y: event.clientY },
    startOffsetX: avatarEditor.offsetX,
    startOffsetY: avatarEditor.offsetY,
  };
  avatarEditorStage.classList.add("is-dragging");
  avatarEditorStage.setPointerCapture(event.pointerId);
});
avatarEditorStage.addEventListener("pointermove", (event) => {
  if (!avatarEditor?.drag || avatarEditor.drag.pointerId !== event.pointerId) {
    return;
  }

  const maskRadius = avatarEditorMaskSize() / 2;
  const nextTransform = clampAvatarEditorTransform(avatarEditor, {
    scale: avatarEditor.scale,
    offsetX: avatarEditor.drag.startOffsetX + (event.clientX - avatarEditor.drag.startPointer.x) / maskRadius,
    offsetY: avatarEditor.drag.startOffsetY + (event.clientY - avatarEditor.drag.startPointer.y) / maskRadius,
  });

  avatarEditor.scale = nextTransform.scale;
  avatarEditor.offsetX = nextTransform.offsetX;
  avatarEditor.offsetY = nextTransform.offsetY;
  renderAvatarEditor();
});
avatarEditorStage.addEventListener("pointerup", (event) => {
  if (avatarEditor?.drag?.pointerId === event.pointerId) {
    avatarEditor.drag = null;
    avatarEditorStage.classList.remove("is-dragging");
    avatarEditorStage.releasePointerCapture(event.pointerId);
  }
});
avatarEditorStage.addEventListener("pointercancel", (event) => {
  if (avatarEditor?.drag?.pointerId === event.pointerId) {
    avatarEditor.drag = null;
    avatarEditorStage.classList.remove("is-dragging");
  }
});
avatarEditorStage.addEventListener(
  "wheel",
  (event) => {
    if (!avatarEditor) {
      return;
    }

    event.preventDefault();
    const zoomFactor = Math.exp(-event.deltaY * 0.001);
    const nextTransform = clampAvatarEditorTransform(avatarEditor, {
      scale: avatarEditor.scale * zoomFactor,
      offsetX: avatarEditor.offsetX,
      offsetY: avatarEditor.offsetY,
    });

    avatarEditor.scale = nextTransform.scale;
    avatarEditor.offsetX = nextTransform.offsetX;
    avatarEditor.offsetY = nextTransform.offsetY;
    renderAvatarEditor();
  },
  { passive: false },
);
cancelAvatarEditButton.addEventListener("click", closeAvatarEditor);
saveAvatarEditButton.addEventListener("click", saveAvatarEditor);

switchIdentityButton.addEventListener("click", () => {
  showIdentityScreen();
});
chatToggleButton.addEventListener("click", () => {
  setChatPanelOpen(!isChatPanelOpen);
});
chatCloseButton.addEventListener("click", () => {
  setChatPanelOpen(false);
});
characterToggleButton.addEventListener("click", () => {
  setCharacterPanelOpen(!isCharacterPanelOpen);
});
characterCloseButton.addEventListener("click", () => {
  setCharacterPanelOpen(false);
});
addCharacterButton.addEventListener("click", addCharacter);
closeTokenInspectorButton.addEventListener("click", closeTokenInspector);
tokenInspectorOverlay.addEventListener("click", (event) => {
  if (event.target === tokenInspectorOverlay) {
    closeTokenInspector();
  }
});
deleteTokenInstanceButton.addEventListener("click", () => {
  const token = getInspectedTokenInstance();
  if (token && isAdmin()) {
    deleteToken(token.id);
  }
});

window.addEventListener("resize", () => {
  resizeCanvas();
  renderAvatarEditor();
});

renderIdentityList();
showIdentityScreen();
renderDicePanel();
renderChatPanel();
renderCharacterPanel();
updateTokenInspector();
resizeCanvas();
requestAnimationFrame(tick);
