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
export type AppMode = "art" | "logic" | "play";
export type LogicTool = "add-token" | "wall";
export type WallEdgeType = "vertical" | "horizontal";

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

export type SceneToken = {
  id: string;
  name: string;
  cell: Cell;
  color: string;
};

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
    };
