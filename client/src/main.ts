import "./styles.css";
import { GRID_CELL_SIZE } from "./core/constants";
import { AvatarEditorController } from "./controllers/avatarEditorController";
import { BackgroundImageController } from "./controllers/backgroundImageController";
import { CharacterTokenController } from "./controllers/characterTokenController";
import { ItemController } from "./controllers/itemController";
import { installCanvasInteractions } from "./modules/canvas/canvasInteractions";
import { createAppContext } from "./core/appContext";
import { createAppState } from "./core/appState";
import { DiceController } from "./controllers/diceController";
import { DiceRollDisplayController } from "./controllers/diceRollDisplayController";
import { queryDomRefs } from "./controllers/domRefs";
import { installControlEventHandlers } from "./controllers/eventHandlers";
import { LogicMapController } from "./controllers/logicMapController";
import { renderSelectionPanel as renderSelectionInspectorPanel, renderItemDefinitionInspector as renderItemDefinitionInspectorPanel, renderItemInstanceInspector as renderItemInstanceInspectorPanel, renderTokenInspector as renderTokenInspectorPanel, renderWarehouseOverlay as renderWarehouseOverlayPanel } from "./controllers/selectionInspector";
import { WarehouseController } from "./controllers/warehouseController";
import { add, rotate } from "./utilities/geometry";
import {
  movementBlockedEdgeSets as buildMovementBlockedEdgeSets,
  nearestEditableEdge,
  sameCell,
  worldToCell,
} from "./modules/grid/grid";
import { getItemStackForInstance } from "./modules/items/itemStacks";
import { backpackWarehouseId, findGroundItemStack, getBackpackWarehouseItems, getGroundWarehouseItems, groundWarehouseId } from "./modules/warehouses/warehouses";
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
  hitTestItemInstance as findHitItemInstance,
} from "./modules/canvas/hitTesting";
import {
  buildIdentities,
  identityLabel,
  rebuildEditModeOptions as rebuildEditModeSelectOptions,
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
import { createSceneSyncApplier, sceneImageSnapshot, sceneImageSnapshots } from "./services/sceneSnapshotSync";
import { CharacterPanelController, ChatPanelController, ItemPanelController, LatencyPanelController } from "./controllers/panels";
import { renderScene } from "./modules/canvas/renderer";
import type {
  AppMode,
  Cell,
  DiceRollVisibility,
  EditMode,
  Identity,
  Interaction,
  LogicTool,
  MovingToken,
  SceneDoor,
  SceneCharacter,
  CharacterStatsUpdateScope,
  SceneImage,
  SceneImageSnapshot,
  SceneItemDefinition,
  SceneItemInstance,
  SceneBackpackItem,
  TokenInspectorTab,
  WarehouseItemEntry,
  WarehouseOverlayMode,
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
  diceOverlayRoot,
  diceHiddenLogContainer,
  identityScreen,
  identityList,
  modeToggle,
  modeToggleOptions,
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
  itemToggleButton,
  itemPanel,
  itemCloseButton,
  addItemButton,
  itemList,
  itemDefinitionInspectorOverlay,
  closeItemDefinitionInspectorButton,
  itemDefinitionSelectionForm,
  itemNameDisplay,
  itemNameValue,
  editItemNameButton,
  itemNameInput,
  itemDescriptionInput,
  itemIconUploadButton,
  itemIconUploadInput,
  itemIconAdjustControls,
  editItemIconButton,
  resetItemIconAdjustmentButton,
  deleteItemDefinitionButton,
  itemDefinitionPanelHelp,
  itemInstanceInspectorOverlay,
  closeItemInstanceInspectorButton,
  itemInstanceSelectionForm,
  itemInstanceIconPreview,
  itemInstanceNameValue,
  itemInstanceDescriptionValue,
  itemInstanceQuantityValue,
  itemInstanceQuantityEdit,
  itemQuantityInput,
  deleteItemInstanceButton,
  splitItemInstanceButton,
  takeItemInstanceButton,
  discardItemInstanceButton,
  itemSplitPopover,
  itemSplitSlider,
  itemSplitValue,
  cancelItemSplitButton,
  confirmItemSplitButton,
  avatarEditorTitle,
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
  tokenInspectorTabStats,
  tokenInspectorTabProfile,
  tokenInspectorTabBackpack,
  tokenInspectorTabBackground,
  tokenStatsPanel,
  tokenStatsList,
  tokenProfilePanel,
  tokenBackpackPanel,
  tokenBackpackTitle,
  tokenBackpackList,
  tokenBackpackHelp,
  tokenBackgroundPanel,
  tokenBackgroundList,
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
  diceFocusLabel,
  diceOptionButtons,
  diceAdjustButtons,
  diceRollButton,
  diceModifierInput,
  diceModifierDecreaseButton,
  diceModifierIncreaseButton,
  warehouseOverlay,
  closeWarehouseOverlayButton,
  warehouseOverlayEyebrow,
  warehouseOverlayTitle,
  warehouseSingleView,
  warehouseSingleList,
  warehouseTransferView,
  warehouseTransferGroundTitle,
  warehouseTransferGroundList,
  warehouseTransferBackpackTitle,
  warehouseTransferBackpackList,
  warehouseOverlayHelp,
} = queryDomRefs();

const appState = createAppState();
const {
  camera,
  pointer,
  sceneImages,
  sceneCharacters,
  sceneTokens,
  sceneItemDefinitions,
  sceneItemInstances,
  sceneBackpackItems,
  tokenAvatarImages,
  itemIconImages,
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
  inspectedItemDefinitionId,
  inspectedItemInstanceId,
  inspectedBackpackItemId,
  selectedItemInstanceId,
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
  nextItemIndex,
  dragDepth,
  movingTokens,
  previewTokenPosition,
  previewPath,
  previewRoomCells,
  hoverWallIntersection,
  previewWallEdges,
  previewWallTargetBlocked,
  tokenNameEditing,
  itemNameEditing,
  itemDescriptionEditing,
  tokenInspectorTab,
  warehouseOverlayCell,
  warehouseOverlayMode,
} = appState;
let adminUnfocusedRollVisibility: "hidden" | "public" = "hidden";
let inspectedItemSingleFocus = false;
let itemSplitPopoverOpen = false;
const latencyPanelController = new LatencyPanelController(latencyPanel, isLoggedIn);
const chatPanelController = new ChatPanelController(
  {
    panel: chatPanel,
    toggleButton: chatToggleButton,
    messageList: chatMessageList,
  },
  isPlayMode,
);
const diceRollDisplayController = new DiceRollDisplayController(
  diceOverlayRoot,
  diceHiddenLogContainer,
  latencyPanel,
  {
    isAdmin,
    isLoggedIn,
    tokens: () => sceneTokens,
    getTokenRenderState: () => ({
      interaction,
      movingTokens,
      previewTokenPosition,
    }),
    worldToScreen,
    cameraZoom: () => camera.zoom,
  },
);
const diceController = new DiceController(
  {
    panel: dicePanel,
    focusLabel: diceFocusLabel,
    optionButtons: diceOptionButtons,
    adjustButtons: diceAdjustButtons,
    rollButton: diceRollButton,
    modifierInput: diceModifierInput,
  },
  () => isLoggedIn() && appMode === "play",
  getRollTargetTokenId,
  getAdminRollVisibility,
  getDiceFocusLabel,
  toggleAdminRollVisibility,
  (message) => networkClient.sendDiceChatMessage(message),
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
    duplicateCharacter,
    openTokenInspector,
  },
);
const itemPanelController = new ItemPanelController(
  {
    panel: itemPanel,
    toggleButton: itemToggleButton,
    addButton: addItemButton,
    list: itemList,
  },
  {
    canShowItems: isAdmin,
    isAdmin,
    definitions: () => sceneItemDefinitions,
    instances: () => sceneItemInstances,
    iconImages: () => itemIconImages,
  },
  {
    deleteItemDefinition,
    openItemDefinitionInspector,
  },
);

let avatarEditorController: AvatarEditorController;

let sceneSync: ReturnType<typeof createSceneSyncApplier>;

const networkClient = createNetworkSyncAdapter({
  latencyPanel: latencyPanelController,
  chatPanel: chatPanelController,
  diceRollDisplay: diceRollDisplayController,
  sceneSync: {
    applySnapshot: (snapshot) => sceneSync.applySnapshot(snapshot),
    applyPatch: (patch) => sceneSync.applyPatch(patch),
  },
});

const appContext = createAppContext({
  collections: {
    sceneImages,
    sceneCharacters,
    sceneTokens,
    sceneItemDefinitions,
    sceneItemInstances,
    sceneBackpackItems,
    tokenAvatarImages,
    itemIconImages,
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
      renderDicePanel();
    },
    getInspectedCharacterId: () => inspectedCharacterId,
    setInspectedCharacterId: (characterId: string | null) => {
      inspectedCharacterId = characterId;
    },
    getInspectedItemDefinitionId: () => inspectedItemDefinitionId,
    setInspectedItemDefinitionId: (definitionId: string | null) => {
      inspectedItemDefinitionId = definitionId;
    },
    getInspectedItemInstanceId: () => inspectedItemInstanceId,
    setInspectedItemInstanceId: (instanceId: string | null) => {
      inspectedItemInstanceId = instanceId;
    },
    getInspectedBackpackItemId: () => inspectedBackpackItemId,
    setInspectedBackpackItemId: (backpackItemId: string | null) => {
      inspectedBackpackItemId = backpackItemId;
    },
    getSelectedItemInstanceId: () => selectedItemInstanceId,
    setSelectedItemInstanceId: (instanceId: string | null) => {
      selectedItemInstanceId = instanceId;
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
    getNextItemIndex: () => nextItemIndex,
    setNextItemIndex: (nextIndex: number) => {
      nextItemIndex = nextIndex;
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
    setItemNameEditing: (editing: boolean) => {
      itemNameEditing = editing;
    },
    setItemDescriptionEditing: (editing: boolean) => {
      itemDescriptionEditing = editing;
    },
    clearItemNameEditing: () => {
      itemNameEditing = false;
    },
    clearItemDescriptionEditing: () => {
      itemDescriptionEditing = false;
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
    renderItemPanel,
    openTokenInspector,
    updateTokenInspector,
    openItemDefinitionInspector,
    closeItemDefinitionInspector,
    openItemInstanceInspector,
    closeItemInstanceInspector,
    updateItemDefinitionInspector,
    updateItemInstanceInspector,
    updateWarehouseOverlay,
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
    sendCharacterStatsUpdated: (
      characterId: string,
      statCategories: SceneCharacter["statCategories"],
      scope: CharacterStatsUpdateScope,
    ) => networkClient.sendCharacterStatsUpdated(characterId, statCategories, scope),
    sendCharacterBackgroundUpdated: (characterId: string, backgroundEntries: SceneCharacter["backgroundEntries"]) =>
      networkClient.sendCharacterBackgroundUpdated(characterId, backgroundEntries),
    sendCharacterDeleted: (characterId: string) => networkClient.sendCharacterDeleted(characterId),
    sendTokenAdded: (token: SceneToken) => networkClient.sendTokenAdded(token),
    sendTokenDeleted: (tokenId: string) => networkClient.sendTokenDeleted(tokenId),
    sendItemDefinitionAdded: (definition: SceneItemDefinition) => networkClient.sendItemDefinitionAdded(definition),
    sendItemDefinitionUpdated: (definition: SceneItemDefinition) => networkClient.sendItemDefinitionUpdated(definition),
    sendItemDefinitionDeleted: (definitionId: string) => networkClient.sendItemDefinitionDeleted(definitionId),
    sendItemInstanceAdded: (instance: SceneItemInstance) => networkClient.sendItemInstanceAdded(instance),
    sendItemInstanceUpdated: (instance: SceneItemInstance) => networkClient.sendItemInstanceUpdated(instance),
    sendItemInstanceDeleted: (instanceId: string) => networkClient.sendItemInstanceDeleted(instanceId),
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

sceneSync = createSceneSyncApplier({
  ...appContext.collections,
  ...appContext.state,
  updateNetworkIdentity: appContext.network.updateIdentity,
  updateIdentityBadge: appContext.ui.updateIdentityBadge,
  renderIdentityList: appContext.ui.renderIdentityList,
  renderCharacterPanel: appContext.ui.renderCharacterPanel,
  renderItemPanel: appContext.ui.renderItemPanel,
  updateTokenInspector: appContext.ui.updateTokenInspector,
  updateItemDefinitionInspector: appContext.ui.updateItemDefinitionInspector,
  updateItemInstanceInspector: appContext.ui.updateItemInstanceInspector,
  updateWarehouseOverlay,
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
    getStatsUpdateScope,
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
const itemController = new ItemController(
  {
    ...appContext.collections,
    ...appContext.state,
  },
  {
    isAdmin,
    getInspectedItemDefinition,
    getInspectedItemInstance,
  },
  {
    itemNameInput,
    itemDescriptionInput,
    itemQuantityInput,
  },
  {
    renderItemPanel: appContext.ui.renderItemPanel,
    openItemDefinitionInspector: appContext.ui.openItemDefinitionInspector,
    closeItemDefinitionInspector: appContext.ui.closeItemDefinitionInspector,
    openItemInstanceInspector: appContext.ui.openItemInstanceInspector,
    closeItemInstanceInspector: appContext.ui.closeItemInstanceInspector,
    updateItemDefinitionInspector: appContext.ui.updateItemDefinitionInspector,
    updateItemInstanceInspector: appContext.ui.updateItemInstanceInspector,
  },
  appContext.network,
);
const warehouseController = new WarehouseController(
  {
    getPlayerCharacterId,
    canTransferWarehouse,
  },
  {
    sendWarehouseTransfer: (fromWarehouse, toWarehouse, itemId) =>
      networkClient.sendWarehouseTransfer(fromWarehouse, toWarehouse, itemId),
    sendWarehouseSplit: (warehouseId, itemId, splitQuantity) =>
      networkClient.sendWarehouseSplit(warehouseId, itemId, splitQuantity),
  },
);
avatarEditorController = new AvatarEditorController(
  {
    overlay: avatarEditorOverlay,
    stage: avatarEditorStage,
    image: avatarEditorImage,
  },
  {
    getIconSubject: () => {
      const itemDefinition = sceneItemDefinitions.find((definition) => definition.id === inspectedItemDefinitionId);
      if (itemDefinition) {
        return {
          id: itemDefinition.id,
          name: itemDefinition.name,
          iconSrc: itemDefinition.iconSrc,
          iconScale: itemDefinition.iconScale,
          iconOffsetX: itemDefinition.iconOffsetX,
          iconOffsetY: itemDefinition.iconOffsetY,
        };
      }

      const character = sceneCharacters.find((candidate) => candidate.id === inspectedCharacterId);
      if (!character) {
        return null;
      }

      return {
        id: character.id,
        name: character.name,
        iconSrc: character.avatarSrc,
        iconScale: character.avatarScale,
        iconOffsetX: character.avatarOffsetX,
        iconOffsetY: character.avatarOffsetY,
      };
    },
    canEditIcon: () => {
      if (inspectedItemDefinitionId) {
        return isAdmin();
      }

      const character = sceneCharacters.find((candidate) => candidate.id === inspectedCharacterId);
      return character ? canControlToken(character) : false;
    },
    findSubjectById: (subjectId) => {
      const itemDefinition = sceneItemDefinitions.find((definition) => definition.id === subjectId);
      if (itemDefinition) {
        return {
          id: itemDefinition.id,
          name: itemDefinition.name,
          iconSrc: itemDefinition.iconSrc,
          iconScale: itemDefinition.iconScale,
          iconOffsetX: itemDefinition.iconOffsetX,
          iconOffsetY: itemDefinition.iconOffsetY,
        };
      }

      const character = sceneCharacters.find((candidate) => candidate.id === subjectId);
      if (!character) {
        return null;
      }

      return {
        id: character.id,
        name: character.name,
        iconSrc: character.avatarSrc,
        iconScale: character.avatarScale,
        iconOffsetX: character.avatarOffsetX,
        iconOffsetY: character.avatarOffsetY,
      };
    },
    iconImages: () => (inspectedItemDefinitionId ? itemIconImages : tokenAvatarImages),
  },
  {
    onIconSaved: (subject) => {
      const itemDefinition = sceneItemDefinitions.find((definition) => definition.id === subject.id);
      if (itemDefinition) {
        itemDefinition.iconSrc = subject.iconSrc;
        itemDefinition.iconScale = subject.iconScale;
        itemDefinition.iconOffsetX = subject.iconOffsetX;
        itemDefinition.iconOffsetY = subject.iconOffsetY;
        itemController.updateItemDefinitionIcon(itemDefinition);
        return;
      }

      const character = sceneCharacters.find((candidate) => candidate.id === subject.id);
      if (!character) {
        return;
      }

      character.avatarSrc = subject.iconSrc;
      character.avatarScale = subject.iconScale;
      character.avatarOffsetX = subject.iconOffsetX;
      character.avatarOffsetY = subject.iconOffsetY;
      updateTokenAvatar(character);
    },
  },
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

function renderItemPanel(): void {
  itemPanelController.render();
}

function setItemPanelOpen(open: boolean): void {
  itemPanelController.setOpen(open);
}

function getRollTargetTokenId(): string | null {
  if (!isLoggedIn() || appMode !== "play") {
    return null;
  }

  if (isAdmin()) {
    return getSelectedToken()?.id ?? null;
  }

  if (currentIdentity?.type === "player") {
    return currentIdentity.id;
  }

  return null;
}

function getAdminRollVisibility(): DiceRollVisibility {
  if (!isAdmin() || appMode !== "play" || getRollTargetTokenId() !== null) {
    return "hidden";
  }

  return adminUnfocusedRollVisibility;
}

function getDiceFocusLabel(): { text: string; toggleable: boolean; visibility: DiceRollVisibility | null } | null {
  if (!isAdmin() || appMode !== "play") {
    return null;
  }

  const token = getSelectedToken();
  if (token) {
    return {
      text: token.name,
      toggleable: false,
      visibility: null,
    };
  }

  return {
    text: adminUnfocusedRollVisibility === "hidden" ? "暗投" : "明投",
    toggleable: true,
    visibility: adminUnfocusedRollVisibility,
  };
}

function toggleAdminRollVisibility(): void {
  adminUnfocusedRollVisibility = adminUnfocusedRollVisibility === "hidden" ? "public" : "hidden";
  renderDicePanel();
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

function getInspectedItemDefinition(): SceneItemDefinition | null {
  return sceneItemDefinitions.find((definition) => definition.id === inspectedItemDefinitionId) ?? null;
}

function getInspectedItemInstance(): SceneItemInstance | null {
  return sceneItemInstances.find((instance) => instance.id === inspectedItemInstanceId) ?? null;
}

function getInspectedBackpackItem(): SceneBackpackItem | null {
  return sceneBackpackItems.find((item) => item.id === inspectedBackpackItemId) ?? null;
}

function getItemDefinitionForBackpackItem(item: SceneBackpackItem | null): SceneItemDefinition | null {
  if (!item) {
    return null;
  }

  return sceneItemDefinitions.find((definition) => definition.id === item.definitionId) ?? null;
}

function getItemDefinitionForInstance(instance: SceneItemInstance | null): SceneItemDefinition | null {
  if (!instance) {
    return null;
  }

  return sceneItemDefinitions.find((definition) => definition.id === instance.definitionId) ?? null;
}

function canInspectItem(): boolean {
  return isLoggedIn();
}

function getPlayerCharacterId(): string | null {
  if (currentIdentity?.type === "player") {
    return currentIdentity.id;
  }

  return null;
}

function canTransferWarehouse(characterId: string): boolean {
  if (!isLoggedIn()) {
    return false;
  }

  if (isAdmin()) {
    return true;
  }

  return currentIdentity?.type === "player" && currentIdentity.id === characterId;
}

function canTakeItem(): boolean {
  return getPlayerCharacterId() !== null;
}

function canSplitInspectedItem(): boolean {
  if (!isLoggedIn()) {
    return false;
  }

  const backpackItem = getInspectedBackpackItem();
  if (backpackItem) {
    return canTransferWarehouse(backpackItem.characterId);
  }

  return getInspectedItemInstance() !== null;
}

function getInspectedSplitContext(): { warehouseId: string; itemId: string; maxSplit: number } | null {
  const backpackItem = getInspectedBackpackItem();
  if (backpackItem && backpackItem.quantity > 1) {
    return {
      warehouseId: backpackWarehouseId(backpackItem.characterId),
      itemId: backpackItem.id,
      maxSplit: backpackItem.quantity - 1,
    };
  }

  const instance = getInspectedItemInstance();
  if (instance && instance.quantity > 1) {
    return {
      warehouseId: groundWarehouseId(instance.cell),
      itemId: instance.id,
      maxSplit: instance.quantity - 1,
    };
  }

  return null;
}

function syncItemSplitSlider(maxSplit: number): void {
  itemSplitSlider.min = "1";
  itemSplitSlider.max = String(maxSplit);
  itemSplitSlider.value = "1";
  itemSplitValue.textContent = "1";
}

function openItemSplitPopover(): void {
  const context = getInspectedSplitContext();
  if (!context) {
    return;
  }

  itemSplitPopoverOpen = true;
  syncItemSplitSlider(context.maxSplit);
  updateItemInstanceInspector();
}

function closeItemSplitPopover(): void {
  itemSplitPopoverOpen = false;
  updateItemInstanceInspector();
}

function updateItemSplitSlider(value: number): void {
  const context = getInspectedSplitContext();
  if (!context) {
    return;
  }

  const normalized = Math.min(context.maxSplit, Math.max(1, Math.floor(value)));
  itemSplitSlider.value = String(normalized);
  itemSplitValue.textContent = String(normalized);
}

function confirmItemSplit(): void {
  const context = getInspectedSplitContext();
  if (!context) {
    closeItemSplitPopover();
    return;
  }

  const splitQuantity = Number.parseInt(itemSplitSlider.value, 10);
  if (!Number.isFinite(splitQuantity) || splitQuantity < 1 || splitQuantity > context.maxSplit) {
    return;
  }

  warehouseController.splitItem(context.warehouseId, context.itemId, splitQuantity);
  closeItemSplitPopover();
}

function transferWarehouseItem(fromWarehouseId: string, toWarehouseId: string, itemId: string): void {
  warehouseController.transferItem(fromWarehouseId, toWarehouseId, itemId);
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

function getStatsUpdateScope(): CharacterStatsUpdateScope | null {
  if (!isAdmin()) {
    return null;
  }

  return appMode === "edit" ? "structure" : "values";
}

function canEditStatStructure(): boolean {
  return getStatsUpdateScope() === "structure";
}

function canEditStatValues(): boolean {
  return getStatsUpdateScope() === "values";
}

function canEditBackground(): boolean {
  return canEditStatStructure();
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
  rebuildEditModeSelectOptions(editModeSelect, ["background", "blocking"]);
}

function renderIdentityList(): void {
  renderIdentityOptions(identityList, buildIdentities(sceneCharacters), enterIdentity);
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
  inspectedItemDefinitionId = null;
  inspectedItemInstanceId = null;
  inspectedBackpackItemId = null;
  selectedItemInstanceId = null;
  selectedDoorId = null;
  selectedRoomId = null;
  interaction = null;
  previewPath = [];
  previewRoomCells = [];
  previewTokenPosition = null;
  characterPanelController.setOpen(false);
  itemPanelController.setOpen(false);
  closeWarehouseOverlay();
  identityBadge.textContent = identityLabel(null);
  renderIdentityList();
  rebuildModeOptions();
  updateModeControls();
  updateTokenInspector();
  updateItemDefinitionInspector();
  updateItemInstanceInspector();
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
      itemInstances: sceneItemInstances,
      itemDefinitions: sceneItemDefinitions,
      itemIconImages: new Map([...itemIconImages].map(([definitionId, icon]) => [definitionId, icon.image])),
      selectedItemInstanceId,
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
  diceRollDisplayController.updatePositions();
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

function hitTestItemInstance(worldPoint: Vector2): SceneItemInstance | null {
  return findHitItemInstance(sceneItemInstances, worldPoint, camera.zoom);
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
      tokenInspectorTabStats,
      tokenInspectorTabProfile,
      tokenInspectorTabBackpack,
      tokenInspectorTabBackground,
      tokenStatsPanel,
      tokenStatsList,
      tokenProfilePanel,
      tokenBackpackPanel,
      tokenBackpackTitle,
      tokenBackpackList,
      tokenBackpackHelp,
      tokenBackgroundPanel,
      tokenBackgroundList,
    },
    character,
    tokenInstance: getInspectedTokenInstance(),
    activeTab: tokenInspectorTab,
    backpackItems: character ? getBackpackWarehouseItems(character.id, sceneBackpackItems) : [],
    definitionsById: new Map(sceneItemDefinitions.map((definition) => [definition.id, definition])),
    iconImages: itemIconImages,
    canTransferBackpack: character ? canTransferWarehouse(character.id) : false,
    onWarehouseTransfer: transferWarehouseItem,
    onItemInspect: openWarehouseItemInspect,
    canInspectToken: canInspectToken(),
    canControlToken: canEditToken,
    isAdmin: isAdmin(),
    canEditStatStructure: canEditStatStructure(),
    canEditStatValues: canEditStatValues(),
    canEditBackground: canEditBackground(),
    onAddCharacterStatCategory: () => characterTokenController.addCharacterStatCategory(),
    onDeleteCharacterStatCategory: (categoryId) => characterTokenController.deleteCharacterStatCategory(categoryId),
    onUpdateCharacterStatCategoryName: (categoryId, name) =>
      characterTokenController.updateCharacterStatCategoryName(categoryId, name),
    onAddCharacterStat: (categoryId) => characterTokenController.addCharacterStat(categoryId),
    onDeleteCharacterStat: (categoryId, statId) => characterTokenController.deleteCharacterStat(categoryId, statId),
    onUpdateCharacterStatName: (categoryId, statId, name) =>
      characterTokenController.updateCharacterStatName(categoryId, statId, name),
    onUpdateCharacterStatValue: (categoryId, statId, value) =>
      characterTokenController.updateCharacterStatValue(categoryId, statId, value),
    onAddCharacterBackgroundEntry: () => characterTokenController.addCharacterBackgroundEntry(),
    onDeleteCharacterBackgroundEntry: (entryId) => characterTokenController.deleteCharacterBackgroundEntry(entryId),
    onUpdateCharacterBackgroundTitle: (entryId, title) =>
      characterTokenController.updateCharacterBackgroundTitle(entryId, title),
    onUpdateCharacterBackgroundText: (entryId, text) =>
      characterTokenController.updateCharacterBackgroundText(entryId, text),
    isEditingTokenName: tokenNameEditing && canEditToken,
    clearTokenNameEditing: () => {
      tokenNameEditing = false;
    },
  });
}

function updateWarehouseOverlay(): void {
  const playerCharacterId = getPlayerCharacterId();
  const playerCharacter = playerCharacterId
    ? (sceneCharacters.find((character) => character.id === playerCharacterId) ?? null)
    : null;

  renderWarehouseOverlayPanel({
    elements: {
      warehouseOverlay,
      warehouseOverlayEyebrow,
      warehouseOverlayTitle,
      warehouseSingleView,
      warehouseSingleList,
      warehouseTransferView,
      warehouseTransferGroundTitle,
      warehouseTransferGroundList,
      warehouseTransferBackpackTitle,
      warehouseTransferBackpackList,
      warehouseOverlayHelp,
    },
    mode: warehouseOverlayMode,
    cell: warehouseOverlayCell,
    groundItems: warehouseOverlayCell ? getGroundWarehouseItems(warehouseOverlayCell, sceneItemInstances) : [],
    backpackItems: playerCharacterId ? getBackpackWarehouseItems(playerCharacterId, sceneBackpackItems) : [],
    backpackCharacterId: playerCharacterId,
    backpackCharacterName: playerCharacter?.name ?? null,
    definitionsById: new Map(sceneItemDefinitions.map((definition) => [definition.id, definition])),
    iconImages: itemIconImages,
    canTransfer: Boolean(playerCharacterId && canTransferWarehouse(playerCharacterId)),
    onWarehouseTransfer: transferWarehouseItem,
    onItemInspect: openWarehouseItemInspect,
  });
}

function openWarehouse(cell: Cell, mode: WarehouseOverlayMode): void {
  warehouseOverlayCell = { ...cell };
  warehouseOverlayMode = mode;
  closeItemInstanceInspector();
  updateWarehouseOverlay();
}

function openGroundWarehouse(cell: Cell): void {
  openWarehouse(cell, "single");
}

function openWarehouseTransfer(cell: Cell): void {
  openWarehouse(cell, "transfer");
}

function closeWarehouseOverlay(): void {
  warehouseOverlayCell = null;
  warehouseOverlayMode = null;
  updateWarehouseOverlay();
}

function setTokenInspectorTab(tab: TokenInspectorTab): void {
  tokenInspectorTab = tab;
  updateTokenInspector();
}

function openWarehouseItemInspect(entry: WarehouseItemEntry): void {
  if (!canInspectItem()) {
    return;
  }

  if (entry.source === "ground") {
    openItemInstanceInspector(entry.id, { keepWarehouseOpen: true, singleItemFocus: true });
    return;
  }

  openBackpackItemInspector(entry.id);
}

function openBackpackItemInspector(backpackItemId: string): void {
  if (!sceneBackpackItems.some((item) => item.id === backpackItemId)) {
    return;
  }

  inspectedBackpackItemId = backpackItemId;
  inspectedItemInstanceId = null;
  inspectedItemDefinitionId = null;
  itemNameEditing = false;
  itemDescriptionEditing = false;
  updateItemDefinitionInspector();
  updateItemInstanceInspector();
}


function canDiscardInspectedBackpackItem(): boolean {
  const backpackItem = getInspectedBackpackItem();
  if (!backpackItem || !canTransferWarehouse(backpackItem.characterId)) {
    return false;
  }

  return sceneTokens.some((token) => token.id === backpackItem.characterId);
}

function takeInspectedItemToBackpack(): void {
  const instance = getInspectedItemInstance();
  const playerCharacterId = getPlayerCharacterId();
  if (!instance || !playerCharacterId) {
    return;
  }

  warehouseController.takeItemToPlayerBackpack(instance.id, instance.cell);
  closeItemInstanceInspector();
}

function discardInspectedBackpackItem(): void {
  const backpackItem = getInspectedBackpackItem();
  if (!backpackItem || !canDiscardInspectedBackpackItem()) {
    return;
  }

  const token = sceneTokens.find((candidate) => candidate.id === backpackItem.characterId);
  if (!token) {
    return;
  }

  warehouseController.discardBackpackItemToGround(backpackItem.id, backpackItem.characterId, token.cell);
  closeItemInstanceInspector();
}

function openTokenInspector(characterId: string): void {
  if (!sceneCharacters.some((character) => character.id === characterId)) {
    return;
  }

  inspectedCharacterId = characterId;
  inspectedItemDefinitionId = null;
  inspectedItemInstanceId = null;
  inspectedBackpackItemId = null;
  tokenNameEditing = false;
  tokenInspectorTab = "stats";
  closeWarehouseOverlay();
  avatarEditorTitle.textContent = "调整角色头像";
  updateTokenInspector();
  updateItemDefinitionInspector();
  updateItemInstanceInspector();
}

function closeTokenInspector(): void {
  inspectedCharacterId = null;
  tokenNameEditing = false;
  tokenInspectorTab = "stats";
  updateTokenInspector();
}

function openItemDefinitionInspector(definitionId: string): void {
  if (!sceneItemDefinitions.some((definition) => definition.id === definitionId)) {
    return;
  }

  inspectedItemDefinitionId = definitionId;
  inspectedItemInstanceId = null;
  inspectedBackpackItemId = null;
  itemNameEditing = false;
  itemDescriptionEditing = false;
  avatarEditorTitle.textContent = "调整物品图标";
  updateItemDefinitionInspector();
  updateItemInstanceInspector();
}

function closeItemDefinitionInspector(): void {
  inspectedItemDefinitionId = null;
  itemNameEditing = false;
  itemDescriptionEditing = false;
  updateItemDefinitionInspector();
}

function openItemInstanceInspector(
  instanceId: string,
  options?: { keepWarehouseOpen?: boolean; singleItemFocus?: boolean },
): void {
  if (!sceneItemInstances.some((instance) => instance.id === instanceId)) {
    return;
  }

  inspectedItemInstanceId = instanceId;
  inspectedBackpackItemId = null;
  inspectedItemDefinitionId = null;
  itemNameEditing = false;
  itemDescriptionEditing = false;
  inspectedItemSingleFocus = options?.singleItemFocus ?? false;
  if (!options?.keepWarehouseOpen) {
    closeWarehouseOverlay();
  }
  updateItemDefinitionInspector();
  updateItemInstanceInspector();
}

function closeItemInstanceInspector(): void {
  inspectedItemInstanceId = null;
  inspectedBackpackItemId = null;
  inspectedItemSingleFocus = false;
  itemSplitPopoverOpen = false;
  updateItemInstanceInspector();
}

function updateItemDefinitionInspector(): void {
  renderItemDefinitionInspectorPanel({
    elements: {
      itemDefinitionInspectorOverlay,
      itemNameDisplay,
      itemNameValue,
      editItemNameButton,
      itemNameInput,
      itemDescriptionInput,
      itemIconUploadInput,
      itemIconUploadButton,
      itemIconAdjustControls,
      editItemIconButton,
      resetItemIconAdjustmentButton,
      deleteItemDefinitionButton,
      itemDefinitionPanelHelp,
    },
    definition: getInspectedItemDefinition(),
    isAdmin: isAdmin(),
    isEditingItemName: itemNameEditing && isAdmin(),
    isEditingItemDescription: itemDescriptionEditing && isAdmin(),
    clearItemNameEditing: () => {
      itemNameEditing = false;
    },
    clearItemDescriptionEditing: () => {
      itemDescriptionEditing = false;
    },
  });
}

function updateItemInstanceInspector(): void {
  const instance = getInspectedItemInstance();
  const backpackItem = getInspectedBackpackItem();
  renderItemInstanceInspectorPanel({
    elements: {
      itemInstanceInspectorOverlay,
      itemInstanceNameValue,
      itemInstanceDescriptionValue,
      itemInstanceIconPreview,
      itemInstanceQuantityValue,
      itemInstanceQuantityEdit,
      itemQuantityInput,
      deleteItemInstanceButton,
      splitItemInstanceButton,
      takeItemInstanceButton,
      discardItemInstanceButton,
      itemSplitPopover,
      itemSplitSlider,
      itemSplitValue,
      cancelItemSplitButton,
      confirmItemSplitButton,
    },
    definition: backpackItem ? getItemDefinitionForBackpackItem(backpackItem) : getItemDefinitionForInstance(instance),
    instance,
    backpackItem,
    stack: getItemStackForInstance(instance, sceneItemInstances),
    singleItemFocus: inspectedItemSingleFocus,
    definitionsById: new Map(sceneItemDefinitions.map((definition) => [definition.id, definition])),
    iconImages: itemIconImages,
    isAdmin: isAdmin(),
    canInspect: canInspectItem(),
    canTakeItem: canTakeItem(),
    canSplitItem: canSplitInspectedItem(),
    canDiscardBackpackItem: canDiscardInspectedBackpackItem(),
    itemSplitPopoverOpen,
  });
}

function selectImage(imageId: string | null): void {
  selectedImageId = imageId;
  if (imageId) {
    selectedTokenId = null;
    selectedItemInstanceId = null;
    closeTokenInspector();
    selectedDoorId = null;
    renderDicePanel();
  }
  updateSelectionPanel();
}

function selectToken(tokenId: string | null, inspect = false): void {
  selectedTokenId = tokenId;
  if (tokenId) {
    selectedImageId = null;
    selectedDoorId = null;
    selectedRoomId = null;
    selectedItemInstanceId = null;
    if (inspect) {
      openTokenInspector(tokenId);
    }
  } else {
    selectedTokenId = null;
  }
  renderDicePanel();
  updateSelectionPanel();
}

function selectItemInstance(instanceId: string | null, inspect = false): void {
  selectedItemInstanceId = instanceId;
  if (instanceId) {
    selectedImageId = null;
    selectedTokenId = null;
    selectedDoorId = null;
    selectedRoomId = null;
    closeTokenInspector();
    if (inspect) {
      const instance = sceneItemInstances.find((candidate) => candidate.id === instanceId);
      const stack = getItemStackForInstance(instance ?? null, sceneItemInstances);
      if (stack && stack.instances.length > 1) {
        if (isAdmin()) {
          openGroundWarehouse(stack.cell);
        } else {
          openWarehouseTransfer(stack.cell);
        }
      } else {
        openItemInstanceInspector(instanceId);
      }
    }
  }
  renderDicePanel();
  updateSelectionPanel();
}

function selectDoor(door: SceneDoor | null): void {
  selectedDoorId = door ? doorId(door) : null;
  if (door) {
    selectedImageId = null;
    selectedTokenId = null;
    selectedItemInstanceId = null;
    closeTokenInspector();
    selectedRoomId = null;
    renderDicePanel();
  }
  updateSelectionPanel();
}

function selectRoom(roomId: string | null): void {
  selectedRoomId = roomId;
  if (roomId) {
    selectedImageId = null;
    selectedTokenId = null;
    selectedItemInstanceId = null;
    closeTokenInspector();
    selectedDoorId = null;
    renderDicePanel();
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
  renderItemPanel();
  updateTokenInspector();
  updateItemDefinitionInspector();
  updateItemInstanceInspector();
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
      modeToggle,
      modeToggleOptions,
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
  renderItemPanel();
}

function addCharacter(): void {
  characterTokenController.addCharacter();
}

function addItemDefinition(): void {
  itemController.addItemDefinition();
}

function deleteItemDefinition(definitionId: string): void {
  itemController.deleteItemDefinition(definitionId);
}

function placeItemAtCell(definitionId: string, cell: Cell): void {
  itemController.placeItemAtCell(definitionId, cell);
}

function deleteItemInstance(instanceId: string): void {
  itemController.deleteItemInstance(instanceId);
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

function duplicateCharacter(characterId: string): void {
  characterTokenController.duplicateCharacter(characterId);
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
  avatarEditorTitle.textContent = inspectedItemDefinitionId ? "调整物品图标" : "调整角色头像";
  await avatarEditorController.uploadSelected(file);
}

async function editSelectedTokenAvatar(): Promise<void> {
  avatarEditorTitle.textContent = inspectedItemDefinitionId ? "调整物品图标" : "调整角色头像";
  await avatarEditorController.editSelected();
}

async function uploadSelectedItemIcon(file: File): Promise<void> {
  avatarEditorTitle.textContent = "调整物品图标";
  await avatarEditorController.uploadSelected(file);
}

async function editSelectedItemIcon(): Promise<void> {
  avatarEditorTitle.textContent = "调整物品图标";
  await avatarEditorController.editSelected();
}

function resetSelectedTokenAvatarAdjustment(): void {
  avatarEditorController.resetSelectedAdjustment();
}

function resetSelectedItemIconAdjustment(): void {
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
    canInspectItem,
    canControlToken,
    isTokenAnimating,
    getSelectedImage,
    hitTestRotateHandle,
    hitTestResizeHandle,
    hitTestRoom,
    hitTestWallIntersection,
    hitTestToken,
    hitTestItemInstance,
    hitTestDoor,
    hitTestImage,
    movementBlockedEdgeSets,
    sceneImageSnapshot,
  },
  actions: {
    closeTokenInspector,
    closeItemDefinitionInspector,
    updateSelectionPanel,
    setCursor,
    placeCharacterAtCell,
    placeItemAtCell,
    selectRoom,
    closedRegionAt,
    selectRoomFromCells,
    toggleDoorAtEdge,
    selectToken,
    selectItemInstance,
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
    modeToggleOptions,
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
    itemToggleButton,
    itemCloseButton,
    addItemButton,
    closeTokenInspectorButton,
    tokenInspectorOverlay,
    deleteTokenInstanceButton,
    tokenNpcTypeInput,
    itemDefinitionInspectorOverlay,
    closeItemDefinitionInspectorButton,
    itemDefinitionSelectionForm,
    editItemNameButton,
    itemNameInput,
    itemDescriptionInput,
    itemIconUploadInput,
    editItemIconButton,
    resetItemIconAdjustmentButton,
    deleteItemDefinitionButton,
    itemInstanceInspectorOverlay,
    closeItemInstanceInspectorButton,
    itemInstanceSelectionForm,
    itemQuantityInput,
    deleteItemInstanceButton,
    splitItemInstanceButton,
    takeItemInstanceButton,
    discardItemInstanceButton,
    itemSplitPopover,
    itemSplitSlider,
    cancelItemSplitButton,
    confirmItemSplitButton,
    tokenInspectorTabStats,
    tokenInspectorTabProfile,
    tokenInspectorTabBackpack,
    tokenInspectorTabBackground,
    warehouseOverlay,
    closeWarehouseOverlayButton,
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
    isItemPanelOpen: () => itemPanelController.isOpen,
    inspectedTokenInstance: getInspectedTokenInstance,
    inspectedItemInstance: getInspectedItemInstance,
    inspectedItemDefinitionId: () => inspectedItemDefinitionId,
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
    setItemPanelOpen,
    addItemDefinition,
    startItemNameEditing: () => itemController.startItemNameEditing(),
    updateItemDefinitionName: (name) => itemController.updateItemDefinitionName(name),
    stopItemNameEditing: () => itemController.stopItemNameEditing(),
    updateItemDefinitionDescription: (description) => itemController.updateItemDefinitionDescription(description),
    stopItemDescriptionEditing: () => itemController.stopItemDescriptionEditing(),
    uploadSelectedItemIcon,
    editSelectedItemIcon,
    resetSelectedItemIconAdjustment,
    closeItemDefinitionInspector,
    deleteItemDefinition,
    closeItemInstanceInspector,
    updateItemInstanceQuantity: (quantity) => itemController.updateItemInstanceQuantity(quantity),
    stopItemQuantityEditing: () => itemController.stopItemQuantityEditing(),
    deleteItemInstance,
    takeInspectedItemToBackpack,
    discardInspectedBackpackItem,
    openItemSplitPopover,
    closeItemSplitPopover,
    updateItemSplitSlider,
    confirmItemSplit,
    setTokenInspectorTab,
    closeWarehouseOverlay,
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
renderItemPanel();
updateTokenInspector();
updateItemDefinitionInspector();
updateItemInstanceInspector();
updateWarehouseOverlay();
resizeCanvas();
requestAnimationFrame(tick);
