import "./styles.css";
import { GRID_CELL_SIZE } from "./core/constants";
import { AvatarEditorController } from "./controllers/avatarEditorController";
import { BackgroundImageController } from "./controllers/backgroundImageController";
import { CharacterTokenController } from "./controllers/characterTokenController";
import { installCanvasInteractions } from "./modules/canvas/canvasInteractions";
import { createAppContext } from "./core/appContext";
import { createAppState } from "./core/appState";
import { DiceController } from "./controllers/diceController";
import { queryDomRefs } from "./controllers/domRefs";
import { installControlEventHandlers } from "./controllers/eventHandlers";
import { LogicMapController } from "./controllers/logicMapController";
import { renderSelectionPanel as renderSelectionInspectorPanel, renderTokenInspector as renderTokenInspectorPanel } from "./controllers/selectionInspector";
import { add, rotate } from "./utilities/geometry";
import {
  movementBlockedEdgeSets as buildMovementBlockedEdgeSets,
  nearestEditableEdge,
  sameCell,
  worldToCell,
} from "./modules/grid/grid";
import {
  computeImageResize,
  getResizeCursor,
  getResizeHandlePositions,
} from "./modules/image/imageTransform";
import {
  hitTestImage as findHitImage,
  hitTestResizeHandle as findHitResizeHandle,
  hitTestRotateHandle as findHitRotateHandle,
  hitTestToken as findHitToken,
} from "./modules/canvas/hitTesting";
import {
  buildIdentities,
  identityLabel,
  rebuildEditModeOptions as rebuildEditModeSelectOptions,
  rebuildModeOptions as rebuildModeSelectOptions,
  renderIdentityList as renderIdentityOptions,
} from "./modules/identity/identityUi";
import {
  closedRegionAt as findClosedRegionAt,
  doorId,
  findRoomByCells as findRoomByCellsInRooms,
  hitTestDoor as findHitDoor,
  hitTestWallIntersection as findHitWallIntersection,
  wallDragTarget,
  wallEdgesBetween,
  wallEdgesTargetBlocked as findWallEdgesTargetBlocked,
} from "./modules/grid/logicMapUtils";
import { updateModeControls as applyModeControls } from "./modules/identity/modeControls";
import { createNetworkSyncAdapter } from "./services/networkSync";
import { createSceneSnapshotApplier, sceneImageSnapshot, sceneImageSnapshots } from "./services/sceneSnapshotSync";
import { CharacterPanelController, ChatPanelController, LatencyPanelController } from "./controllers/panels";
import { renderScene } from "./modules/canvas/renderer";
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
  GridIntersection,
  WallEdge,
} from "./core/types";
import { createViewport } from "./modules/canvas/viewport";

const {
  canvas,
  ctx,
  latencyPanel,
  identityScreen,
  identityList,
  modeSelectLabel,
  modeSelect,
  editModeSelectLabel,
  editModeSelect,
  uploadButton,
  uploadInput,
  wallModeButton,
  doorModeButton,
  roomModeButton,
  clearWallsButton,
  logicMapVisibilityButton,
  switchIdentityButton,
  chatToggleButton,
  characterToggleButton,
  identityBadge,
  dropOverlay,
  chatPanel,
  chatCloseButton,
  chatMessageList,
  characterPanel,
  characterCloseButton,
  addCharacterButton,
  characterList,
  selectionPanel,
  selectionEyebrow,
  selectionTitle,
  imageSelectionControls,
  imageSelectionActions,
  imageSelectionDanger,
  resetSizeButton,
  layerUpButton,
  layerDownButton,
  layerTopButton,
  layerBottomButton,
  deleteImageButton,
  tokenSelectionForm,
  tokenNameDisplay,
  tokenNameValue,
  editTokenNameButton,
  tokenNameInput,
  avatarUploadButton,
  avatarUploadInput,
  avatarAdjustControls,
  editAvatarButton,
  resetAvatarAdjustmentButton,
  tokenPanelHelp,
  tokenNpcTypeControls,
  tokenNpcTypeInput,
  tokenInspectorOverlay,
  closeTokenInspectorButton,
  tokenInstanceActions,
  deleteTokenInstanceButton,
  doorSelectionForm,
  doorBlocksMovementInput,
  roomSelectionForm,
  roomNameInput,
  deleteRoomButton,
  avatarEditorOverlay,
  avatarEditorStage,
  avatarEditorImage,
  cancelAvatarEditButton,
  saveAvatarEditButton,
  dicePanel,
  diceOptionButtons,
  diceAdjustButtons,
  diceRollButton,
  diceClearButton,
  diceModifierInput,
  diceModifierDecreaseButton,
  diceModifierIncreaseButton,
} = queryDomRefs();

const appState = createAppState();
const {
  camera,
  pointer,
  sceneImages,
  sceneCharacters,
  sceneTokens,
  tokenAvatarImages,
  blockedVerticalEdges,
  blockedHorizontalEdges,
  sceneDoors,
  sceneRooms,
  pendingTokenNames,
} = appState;
const viewport = createViewport(canvas, ctx, camera);
const { resizeCanvas, screenPointFromEvent, screenSize, screenToWorld, worldToScreen } = viewport;

let {
  selectedImageId,
  selectedTokenId,
  inspectedCharacterId,
  selectedDoorId,
  selectedRoomId,
  currentIdentity,
  interaction,
  appMode,
  editMode,
  logicTool,
  isLogicMapVisible,
  nextZ,
  nextTokenIndex,
  dragDepth,
  movingTokens,
  previewTokenPosition,
  previewPath,
  previewRoomCells,
  hoverWallIntersection,
  previewWallEdges,
  previewWallTargetBlocked,
  tokenNameEditing,
} = appState;
const latencyPanelController = new LatencyPanelController(latencyPanel, isLoggedIn);
const chatPanelController = new ChatPanelController(
  {
    panel: chatPanel,
    toggleButton: chatToggleButton,
    messageList: chatMessageList,
  },
  isPlayMode,
);
const diceController = new DiceController(
  {
    panel: dicePanel,
    optionButtons: diceOptionButtons,
    adjustButtons: diceAdjustButtons,
    rollButton: diceRollButton,
    modifierInput: diceModifierInput,
  },
  () => isLoggedIn() && appMode === "play",
  (message) => networkClient.sendDiceChatMessage(message),
  () => setChatPanelOpen(true),
);
const characterPanelController = new CharacterPanelController(
  {
    panel: characterPanel,
    toggleButton: characterToggleButton,
    addButton: addCharacterButton,
    list: characterList,
  },
  {
    canShowCharacters: isAdmin,
    isAdmin,
    characters: () => sceneCharacters,
    tokens: () => sceneTokens,
    avatarImages: () => tokenAvatarImages,
  },
  {
    deleteCharacter,
    openTokenInspector,
  },
);
const avatarEditorController = new AvatarEditorController(
  {
    overlay: avatarEditorOverlay,
    stage: avatarEditorStage,
    image: avatarEditorImage,
  },
  {
    inspectedCharacter: getInspectedCharacter,
    canControlToken,
    characters: () => sceneCharacters,
    avatarImages: () => tokenAvatarImages,
  },
  {
    updateTokenAvatar,
  },
);

const networkClient = createNetworkSyncAdapter({
  latencyPanel: latencyPanelController,
  chatPanel: chatPanelController,
  applySceneSnapshot,
});

const appContext = createAppContext({
  collections: {
    sceneImages,
    sceneCharacters,
    sceneTokens,
    tokenAvatarImages,
    blockedVerticalEdges,
    blockedHorizontalEdges,
    sceneDoors,
    sceneRooms,
    pendingTokenNames,
  },
  state: {
    getMovingTokens: () => movingTokens,
    setMovingTokens: (nextMovingTokens: MovingToken[]) => {
      movingTokens = nextMovingTokens;
    },
    getSelectedImageId: () => selectedImageId,
    setSelectedImageId: (imageId: string | null) => {
      selectedImageId = imageId;
    },
    getSelectedTokenId: () => selectedTokenId,
    setSelectedTokenId: (tokenId: string | null) => {
      selectedTokenId = tokenId;
    },
    getInspectedCharacterId: () => inspectedCharacterId,
    setInspectedCharacterId: (characterId: string | null) => {
      inspectedCharacterId = characterId;
    },
    getSelectedDoorId: () => selectedDoorId,
    setSelectedDoorId: (doorIdValue: string | null) => {
      selectedDoorId = doorIdValue;
    },
    getSelectedRoomId: () => selectedRoomId,
    setSelectedRoomId: (roomId: string | null) => {
      selectedRoomId = roomId;
    },
    getCurrentIdentity: () => currentIdentity,
    setCurrentIdentity: (identity: Identity | null) => {
      currentIdentity = identity;
    },
    getNextZ: () => nextZ,
    setNextZ: (nextImageZ: number) => {
      nextZ = nextImageZ;
    },
    getNextTokenIndex: () => nextTokenIndex,
    setNextTokenIndex: (nextIndex: number) => {
      nextTokenIndex = nextIndex;
    },
    getInteraction: () => interaction,
    setInteraction: (nextInteraction: Interaction | null) => {
      interaction = nextInteraction;
    },
    getAppMode: () => appMode,
    getLogicTool: () => logicTool,
    getIsLogicMapVisible: () => isLogicMapVisible,
    getPreviewRoomCells: () => previewRoomCells,
    setPreviewRoomCells: (cells: Cell[]) => {
      previewRoomCells = cells;
    },
    setPreviewTokenPosition: (position: Vector2 | null) => {
      previewTokenPosition = position;
    },
    setPreviewPath: (path: Cell[]) => {
      previewPath = path;
    },
    setHoverWallIntersection: (intersection: GridIntersection | null) => {
      hoverWallIntersection = intersection;
    },
    setPreviewWallEdges: (edges: WallEdge[]) => {
      previewWallEdges = edges;
    },
    setPreviewWallTargetBlocked: (blocked: boolean) => {
      previewWallTargetBlocked = blocked;
    },
    getDragDepth: () => dragDepth,
    setDragDepth: (depth: number) => {
      dragDepth = depth;
    },
    setTokenNameEditing: (editing: boolean) => {
      tokenNameEditing = editing;
    },
    clearTokenNameEditing: () => {
      tokenNameEditing = false;
    },
    clearPreviewState: () => {
      previewPath = [];
      previewTokenPosition = null;
      previewRoomCells = [];
    },
  },
  ui: {
    renderIdentityList,
    renderCharacterPanel,
    openTokenInspector,
    updateTokenInspector,
    updateSelectionPanel,
    showIdentityScreen,
    selectImage,
    selectRoom,
    updateIdentityBadge: (identity: Identity) => {
      identityBadge.textContent = identityLabel(identity);
    },
  },
  network: {
    updateIdentity: (identity: Identity) => networkClient.updateIdentity(identity),
    sendCharacterAdded: (character: SceneCharacter) => networkClient.sendCharacterAdded(character),
    sendCharacterUpdated: (character: SceneCharacter) => networkClient.sendCharacterUpdated(character),
    sendCharacterDeleted: (characterId: string) => networkClient.sendCharacterDeleted(characterId),
    sendTokenAdded: (token: SceneToken) => networkClient.sendTokenAdded(token),
    sendTokenDeleted: (tokenId: string) => networkClient.sendTokenDeleted(tokenId),
    sendImageAdded: (image: SceneImageSnapshot) => networkClient.sendImageAdded(image),
    sendImageUpdated: (image: SceneImageSnapshot) => networkClient.sendImageUpdated(image),
    sendImagesUpdated: (images: SceneImageSnapshot[]) => networkClient.sendImagesUpdated(images),
    sendImageDeleted: (imageId: string) => networkClient.sendImageDeleted(imageId),
    sendDoorChanged: (door: SceneDoor) => networkClient.sendDoorChanged(door),
    sendDoorDeleted: (type: WallEdgeType, x: number, y: number) => networkClient.sendDoorDeleted(type, x, y),
    sendBlockedEdgeChanged: (type: WallEdgeType, x: number, y: number, blocked: boolean) =>
      networkClient.sendBlockedEdgeChanged(type, x, y, blocked),
    sendBlockedEdgesCleared: () => networkClient.sendBlockedEdgesCleared(),
    sendRoomUpdated: (room: SceneRoom) => networkClient.sendRoomUpdated(room),
    sendRoomDeleted: (roomId: string) => networkClient.sendRoomDeleted(roomId),
  },
});

const sceneSnapshotApplier = createSceneSnapshotApplier({
  ...appContext.collections,
  ...appContext.state,
  updateNetworkIdentity: appContext.network.updateIdentity,
  updateIdentityBadge: appContext.ui.updateIdentityBadge,
  renderIdentityList: appContext.ui.renderIdentityList,
  renderCharacterPanel: appContext.ui.renderCharacterPanel,
  updateTokenInspector: appContext.ui.updateTokenInspector,
  updateSelectionPanel: appContext.ui.updateSelectionPanel,
  showIdentityScreen: appContext.ui.showIdentityScreen,
});

const characterTokenController = new CharacterTokenController(
  {
    ...appContext.collections,
    ...appContext.state,
  },
  {
    isAdmin,
    canControlToken,
    getInspectedCharacter,
  },
  {
    tokenNameInput,
  },
  {
    renderIdentityList: appContext.ui.renderIdentityList,
    renderCharacterPanel: appContext.ui.renderCharacterPanel,
    openTokenInspector: appContext.ui.openTokenInspector,
    updateTokenInspector: appContext.ui.updateTokenInspector,
    updateSelectionPanel: appContext.ui.updateSelectionPanel,
    updateIdentityBadge: appContext.ui.updateIdentityBadge,
  },
  appContext.network,
);
const backgroundImageController = new BackgroundImageController(
  {
    canvas,
    sceneImages: appContext.collections.sceneImages,
    getNextZ: appContext.state.getNextZ,
    setNextZ: appContext.state.setNextZ,
    getSelectedImage,
    setSelectedImageId: appContext.state.setSelectedImageId,
    getInteraction: appContext.state.getInteraction,
    setInteraction: appContext.state.setInteraction,
  },
  {
    screenToWorld,
  },
  {
    isEditingBackground,
  },
  {
    selectImage: appContext.ui.selectImage,
    updateSelectionPanel: appContext.ui.updateSelectionPanel,
  },
  appContext.network,
);
const logicMapController = new LogicMapController(
  {
    ...appContext.collections,
    ...appContext.state,
  },
  {
    canInspectDoor,
    canInspectRoom,
    getSelectedDoor,
    getSelectedRoom,
  },
  {
    selectRoom: appContext.ui.selectRoom,
    updateSelectionPanel: appContext.ui.updateSelectionPanel,
  },
  appContext.network,
);

function renderLatencyPanel(): void {
  latencyPanelController.render();
}

function renderChatPanel(): void {
  chatPanelController.render();
}

function setChatPanelOpen(open: boolean): void {
  chatPanelController.setOpen(open);
}

function renderCharacterPanel(): void {
  characterPanelController.render();
}

function setCharacterPanelOpen(open: boolean): void {
  characterPanelController.setOpen(open);
}

function renderDicePanel(): void {
  diceController.render();
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

function movementBlockedEdgeSets(): { vertical: Set<string>; horizontal: Set<string> } {
  return buildMovementBlockedEdgeSets(blockedVerticalEdges, blockedHorizontalEdges, sceneDoors.values());
}

function closedRegionAt(worldPoint: Vector2): Cell[] {
  return findClosedRegionAt(worldPoint, blockedVerticalEdges, blockedHorizontalEdges, sceneDoors.values());
}

function findRoomByCells(cells: Cell[]): SceneRoom | null {
  return findRoomByCellsInRooms(sceneRooms, cells);
}

function hitTestDoor(worldPoint: Vector2): SceneDoor | null {
  return findHitDoor(worldPoint, sceneDoors, camera.zoom);
}

function hitTestWallIntersection(worldPoint: Vector2): GridIntersection | null {
  return findHitWallIntersection(worldPoint, camera.zoom);
}

function wallEdgesTargetBlocked(edges: WallEdge[]): boolean {
  return findWallEdgesTargetBlocked(edges, blockedVerticalEdges, blockedHorizontalEdges);
}

function updateWallHover(worldPoint: Vector2): void {
  hoverWallIntersection = canDrawWalls() ? hitTestWallIntersection(worldPoint) : null;
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
  return isEditingBlocking();
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
  if (token.isNpc) {
    return currentIdentity?.type === "admin";
  }

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
  rebuildEditModeSelectOptions(editModeSelect, ["background", "blocking"]);
}

function renderIdentityList(): void {
  renderIdentityOptions(identityList, buildIdentities(sceneCharacters), enterIdentity);
}

function applySceneSnapshot(snapshot: Parameters<typeof sceneSnapshotApplier>[0]): void {
  sceneSnapshotApplier(snapshot);
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
  characterPanelController.setOpen(false);
  identityBadge.textContent = identityLabel(null);
  renderIdentityList();
  rebuildModeOptions();
  updateModeControls();
  updateTokenInspector();
  updateSelectionPanel();
  identityScreen.hidden = false;
}

function normalizeZIndexes(): void {
  backgroundImageController.normalizeZIndexes();
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

function roomAtCell(targetCell: Cell): SceneRoom | null {
  return [...sceneRooms].reverse().find((room) => room.cells.some((cell) => sameCell(cell, targetCell))) ?? null;
}

function hitTestRoom(worldPoint: Vector2): SceneRoom | null {
  return roomAtCell(worldToCell(worldPoint));
}

function updateRoomPreview(worldPoint: Vector2): void {
  previewRoomCells = isEditingRooms() && logicTool === "room" && !hitTestRoom(worldPoint) ? closedRegionAt(worldPoint) : [];
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
  const roomHit = isEditingRooms() && (logicTool === "room" || logicTool === "inspect-room") ? hitTestRoom(worldPoint) : null;

  if (isEditingBackground() && hitTestRotateHandle(screenPoint)) {
    canvas.style.cursor = "grab";
  } else if (isEditingBackground() && resizeHandle) {
    canvas.style.cursor = getResizeCursor(resizeHandle);
  } else if (roomHit) {
    canvas.style.cursor = "pointer";
  } else if ((isEditingBlocking() && (logicTool === "wall" || logicTool === "door")) || (isEditingRooms() && logicTool === "room")) {
    canvas.style.cursor = "crosshair";
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
  renderSelectionInspectorPanel({
    elements: {
      selectionPanel,
      selectionEyebrow,
      selectionTitle,
      imageSelectionControls,
      imageSelectionActions,
      imageSelectionDanger,
      doorSelectionForm,
      doorBlocksMovementInput,
      roomSelectionForm,
      roomNameInput,
    },
    selectedImage: getSelectedImage(),
    selectedDoor: canInspectDoor() ? getSelectedDoor() : null,
    selectedRoom: canInspectRoom() ? getSelectedRoom() : null,
    isAdmin: isAdmin(),
    clearTokenNameEditing: () => {
      tokenNameEditing = false;
    },
  });
}

function updateTokenInspector(): void {
  const character = getInspectedCharacter();
  const canEditToken = character ? canControlToken(character) : false;
  renderTokenInspectorPanel({
    elements: {
      tokenInspectorOverlay,
      tokenNameDisplay,
      tokenNameValue,
      editTokenNameButton,
      tokenNameInput,
      avatarUploadInput,
      avatarUploadButton,
      avatarAdjustControls,
      editAvatarButton,
      resetAvatarAdjustmentButton,
      tokenInstanceActions,
      deleteTokenInstanceButton,
      tokenPanelHelp,
      tokenNpcTypeControls,
      tokenNpcTypeInput,
    },
    character,
    tokenInstance: getInspectedTokenInstance(),
    canInspectToken: canInspectToken(),
    canControlToken: canEditToken,
    isAdmin: isAdmin(),
    isEditingTokenName: tokenNameEditing && canEditToken,
    clearTokenNameEditing: () => {
      tokenNameEditing = false;
    },
  });
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
    chatPanelController.setOpen(false);
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

  if (editMode === "blocking" && logicTool !== "wall" && logicTool !== "door" && logicTool !== "room" && logicTool !== "inspect-room") {
    logicTool = "wall";
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
  characterTokenController.addCharacter();
}

function updateCharacterIsNpc(isNpc: boolean): void {
  characterTokenController.updateCharacterIsNpc(isNpc);
}

function placeCharacterAtCell(characterId: string, cell: Cell): void {
  characterTokenController.placeCharacterAtCell(characterId, cell);
}

function addTokenAtCell(cell: Cell): void {
  characterTokenController.addTokenAtCell(cell);
}

function deleteToken(tokenId: string): void {
  previewPath = [];
  previewTokenPosition = null;
  characterTokenController.deleteToken(tokenId);
}

function deleteCharacter(characterId: string): void {
  previewPath = [];
  previewTokenPosition = null;
  characterTokenController.deleteCharacter(characterId);
}

function toggleDoorAtEdge(edge: { type: WallEdgeType; x: number; y: number }): void {
  logicMapController.toggleDoorAtEdge(edge);
}

function applyWallEdges(edges: WallEdge[], blocked: boolean): void {
  logicMapController.applyWallEdges(edges, blocked);
}

function updateSelectedDoorState(isOpen: boolean): void {
  logicMapController.updateSelectedDoorState(isOpen);
}

function selectRoomFromCells(cells: Cell[]): void {
  logicMapController.selectRoomFromCells(cells);
}

function updateSelectedRoomName(name: string): void {
  logicMapController.updateSelectedRoomName(name);
}

function deleteSelectedRoom(): void {
  logicMapController.deleteSelectedRoom();
}

function handleFiles(files: FileList | File[], screenPoint?: Vector2): void {
  backgroundImageController.handleFiles(files, screenPoint);
}

function moveLayer(direction: "up" | "down" | "top" | "bottom"): void {
  backgroundImageController.moveLayer(direction);
}

function resetSelectedImageSize(): void {
  backgroundImageController.resetSelectedImageSize();
}

function deleteSelectedImage(): void {
  backgroundImageController.deleteSelectedImage();
}

function updateSelectedTokenName(name: string): void {
  characterTokenController.updateSelectedTokenName(name);
}

function startTokenNameEditing(): void {
  characterTokenController.startTokenNameEditing();
}

function stopTokenNameEditing(): void {
  if (!tokenNameEditing) {
    return;
  }

  characterTokenController.stopTokenNameEditing();
}

function updateTokenAvatar(token: SceneCharacter): void {
  characterTokenController.updateTokenAvatar(token);
}

async function uploadSelectedTokenAvatar(file: File): Promise<void> {
  await avatarEditorController.uploadSelected(file);
}

async function editSelectedTokenAvatar(): Promise<void> {
  await avatarEditorController.editSelected();
}

function resetSelectedTokenAvatarAdjustment(): void {
  avatarEditorController.resetSelectedAdjustment();
}

function renderAvatarEditor(): void {
  avatarEditorController.render();
}

function closeAvatarEditor(): void {
  avatarEditorController.close();
}

function saveAvatarEditor(): void {
  avatarEditorController.save();
}

clearWallsButton.addEventListener("click", () => {
  if (!isEditingBlocking()) {
    return;
  }

  logicMapController.clearBlockingLayer();
});

installCanvasInteractions({
  elements: {
    canvas,
    dropOverlay,
  },
  viewport: {
    screenPointFromEvent,
    screenToWorld,
  },
  state: {
    pointer,
    camera,
    sceneImages,
    sceneTokens,
    ...appContext.state,
  },
  queries: {
    isAdmin,
    isLoggedIn,
    isEditingBlocking,
    isEditingBackground,
    isPlayMode,
    canInspectDoor,
    canInspectToken,
    canControlToken,
    isTokenAnimating,
    getSelectedImage,
    hitTestRotateHandle,
    hitTestResizeHandle,
    hitTestRoom,
    hitTestWallIntersection,
    hitTestToken,
    hitTestDoor,
    hitTestImage,
    movementBlockedEdgeSets,
    sceneImageSnapshot,
  },
  actions: {
    closeTokenInspector,
    updateSelectionPanel,
    setCursor,
    placeCharacterAtCell,
    selectRoom,
    closedRegionAt,
    selectRoomFromCells,
    toggleDoorAtEdge,
    selectToken,
    selectDoor,
    selectImage,
    updateRoomPreview,
    updateWallHover,
    updateResizeInteraction,
    updateRotateInteraction,
    wallDragTarget,
    wallEdgesBetween,
    wallEdgesTargetBlocked,
    applyWallEdges,
    handleFiles,
  },
  network: {
    sendImageUpdated: (image) => networkClient.sendImageUpdated(image),
    sendTokenMoved: (token, path) => networkClient.sendTokenMoved(token, path),
  },
});

installControlEventHandlers({
  elements: {
    modeSelect,
    editModeSelect,
    wallModeButton,
    doorModeButton,
    roomModeButton,
    logicMapVisibilityButton,
    uploadInput,
    layerUpButton,
    layerDownButton,
    layerTopButton,
    layerBottomButton,
    deleteImageButton,
    deleteRoomButton,
    diceOptionButtons,
    diceAdjustButtons,
    diceRollButton,
    diceClearButton,
    diceModifierInput,
    diceModifierDecreaseButton,
    diceModifierIncreaseButton,
    resetSizeButton,
    editTokenNameButton,
    tokenNameInput,
    tokenSelectionForm,
    doorBlocksMovementInput,
    roomNameInput,
    roomSelectionForm,
    avatarUploadInput,
    editAvatarButton,
    resetAvatarAdjustmentButton,
    cancelAvatarEditButton,
    saveAvatarEditButton,
    switchIdentityButton,
    chatToggleButton,
    chatCloseButton,
    characterToggleButton,
    characterCloseButton,
    addCharacterButton,
    closeTokenInspectorButton,
    tokenInspectorOverlay,
    deleteTokenInstanceButton,
    tokenNpcTypeInput,
  },
  state: {
    isLoggedIn,
    isAdmin,
    isEditingBlocking,
    isEditingRooms,
    isEditingBackground,
    isPlayMode,
    appMode: appContext.state.getAppMode,
    logicTool: appContext.state.getLogicTool,
    isLogicMapVisible: appContext.state.getIsLogicMapVisible,
    isChatPanelOpen: () => chatPanelController.isOpen,
    isCharacterPanelOpen: () => characterPanelController.isOpen,
    inspectedTokenInstance: getInspectedTokenInstance,
  },
  actions: {
    setAppMode,
    setEditMode,
    setLogicTool,
    setLogicMapVisible,
    handleFiles,
    moveLayer,
    deleteSelectedImage,
    deleteSelectedRoom,
    parseDiceButton: (button) => diceController.parseButton(button),
    changeDieSelection: (sides, delta) => diceController.changeSelection(sides, delta),
    rollSelectedDice: () => diceController.rollSelected(),
    clearDiceSelection: () => diceController.clearSelection(),
    renderDicePanel,
    changeDiceModifier: (delta) => diceController.changeModifier(delta),
    resetSelectedImageSize,
    startTokenNameEditing,
    updateSelectedTokenName,
    stopTokenNameEditing,
    updateSelectedDoorState,
    updateSelectedRoomName,
    uploadSelectedTokenAvatar,
    editSelectedTokenAvatar,
    resetSelectedTokenAvatarAdjustment,
    closeAvatarEditor,
    saveAvatarEditor,
    showIdentityScreen,
    setChatPanelOpen,
    setCharacterPanelOpen,
    addCharacter,
    updateCharacterIsNpc,
    closeTokenInspector,
    deleteToken,
  },
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
