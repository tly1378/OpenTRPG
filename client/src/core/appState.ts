import type {
  AppMode,
  Cell,
  EditMode,
  GridIntersection,
  Identity,
  Interaction,
  LogicTool,
  MovingToken,
  SceneCharacter,
  SceneDoor,
  SceneImage,
  SceneItemDefinition,
  SceneItemInstance,
  SceneBackpackItem,
  SceneRoom,
  SceneToken,
  TokenInspectorTab,
  WarehouseOverlayMode,
  Vector2,
  WallEdge,
} from "./types";

export const diceSides = [4, 6, 8, 10, 12, 20, 100] as const;
export type DiceSides = (typeof diceSides)[number];

export type TokenAvatarImage = {
  src: string;
  image: HTMLImageElement;
};

export type AvatarEditorState = {
  tokenId: string;
  src: string;
  image: HTMLImageElement;
  scale: number;
  offsetX: number;
  offsetY: number;
  drag: {
    pointerId: number;
    startPointer: Vector2;
    startOffsetX: number;
    startOffsetY: number;
  } | null;
};

export type AppState = ReturnType<typeof createAppState>;

export function createAppState() {
  return {
    camera: {
      x: 0,
      y: 0,
      zoom: 1,
    },
    pointer: {
      x: 0,
      y: 0,
    },
    sceneImages: [] as SceneImage[],
    sceneCharacters: [] as SceneCharacter[],
    sceneTokens: [] as SceneToken[],
    sceneItemDefinitions: [] as SceneItemDefinition[],
    sceneItemInstances: [] as SceneItemInstance[],
    sceneBackpackItems: [] as SceneBackpackItem[],
    tokenAvatarImages: new Map<string, TokenAvatarImage>(),
    itemIconImages: new Map<string, TokenAvatarImage>(),
    blockedVerticalEdges: new Set<string>(),
    blockedHorizontalEdges: new Set<string>(),
    sceneDoors: new Map<string, SceneDoor>(),
    sceneRooms: [] as SceneRoom[],
    selectedImageId: null as string | null,
    selectedTokenId: null as string | null,
    inspectedCharacterId: null as string | null,
    inspectedItemDefinitionId: null as string | null,
    inspectedItemInstanceId: null as string | null,
    inspectedBackpackItemId: null as string | null,
    selectedItemInstanceId: null as string | null,
    nextItemIndex: 1,
    itemNameEditing: false,
    itemDescriptionEditing: false,
    selectedDoorId: null as string | null,
    selectedRoomId: null as string | null,
    currentIdentity: null as Identity | null,
    interaction: null as Interaction | null,
    appMode: "play" as AppMode,
    editMode: "background" as EditMode,
    logicTool: "wall" as LogicTool,
    isLogicMapVisible: true,
    nextZ: 1,
    nextTokenIndex: 1,
    dragDepth: 0,
    movingTokens: [] as MovingToken[],
    previewTokenPosition: null as Vector2 | null,
    previewPath: [] as Cell[],
    previewRoomCells: [] as Cell[],
    hoverWallIntersection: null as GridIntersection | null,
    previewWallEdges: [] as WallEdge[],
    previewWallTargetBlocked: true,
    imageSnapshotVersion: 0,
    tokenNameEditing: false,
    tokenInspectorTab: "profile" as TokenInspectorTab,
    warehouseOverlayCell: null as Cell | null,
    warehouseOverlayMode: null as WarehouseOverlayMode | null,
    pendingTokenNames: new Map<string, string>(),
    selectedDice: new Map<DiceSides, number>(),
    avatarEditor: null as AvatarEditorState | null,
  };
}
