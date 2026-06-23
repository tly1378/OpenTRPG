export type Vector2 = {
  x: number;
  y: number;
};

export type Cell = {
  x: number;
  y: number;
};

export type ClientPointEvent = {
  clientX: number;
  clientY: number;
};

export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
export type AppMode = "edit" | "play";
export type EditMode = "background" | "blocking";
export type LogicTool = "wall" | "door" | "room" | "inspect-room";
export type WallEdgeType = "vertical" | "horizontal";

export type GridIntersection = {
  x: number;
  y: number;
};

export type WallEdge = {
  type: WallEdgeType;
  x: number;
  y: number;
};

export type Identity =
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

export type SceneImage = {
  id: string;
  image: HTMLImageElement;
  src: string;
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

export type SceneImageSnapshot = Omit<SceneImage, "image">;

export type SceneCharacter = {
  id: string;
  name: string;
  color: string;
  isNpc?: boolean;
  avatarSrc?: string;
  avatarScale?: number;
  avatarOffsetX?: number;
  avatarOffsetY?: number;
};

export type SceneToken = SceneCharacter & {
  cell: Cell;
};

export type SceneItemDefinition = {
  id: string;
  name: string;
  description?: string;
  iconSrc?: string;
  iconScale?: number;
  iconOffsetX?: number;
  iconOffsetY?: number;
};

export type SceneItemInstance = {
  id: string;
  definitionId: string;
  cell: Cell;
  quantity: number;
};

export type SceneDoor = {
  type: WallEdgeType;
  x: number;
  y: number;
  isOpen: boolean;
};

export type SceneRoom = {
  id: string;
  name: string;
  cells: Cell[];
};

export type ChatMessageBase = {
  id: string;
  authorId: string;
  authorName: string;
  authorType: Identity["type"];
  createdAt: number;
};

export type DiceRollVisibility = "hidden" | "public";

export type DiceChatMessage = ChatMessageBase & {
  kind: "dice";
  formula: string;
  total: number;
  detail: string;
  tokenId?: string | null;
  tokenName?: string | null;
  rollVisibility?: DiceRollVisibility | null;
};

export type MoveChatMessage = ChatMessageBase & {
  kind: "move";
  tokenId: string;
  tokenName: string;
  fromCell: Cell;
  toCell: Cell;
  distance: number;
};

export type ChatMessage = DiceChatMessage | MoveChatMessage;

export type MovingToken = {
  tokenId: string;
  path: Cell[];
  startedAt: number;
  duration: number;
};

export type Interaction =
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
    }
  | {
      type: "draw-wall";
      pointerId: number;
      start: GridIntersection;
      target: GridIntersection;
      targetBlocked: boolean;
      edges: WallEdge[];
    };
