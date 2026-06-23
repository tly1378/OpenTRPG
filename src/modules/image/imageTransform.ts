import { MIN_IMAGE_SIZE, ROTATE_HANDLE_DISTANCE } from "../../core/constants";
import { add, rotate, subtract } from "../../utilities/geometry";
import type { Interaction, ResizeHandle, SceneImage, Vector2 } from "../../core/types";

type ResizeResult = {
  centerLocal: Vector2;
  width: number;
  height: number;
};

export function getImageCorners(entity: SceneImage): Record<"nw" | "ne" | "sw" | "se", Vector2> {
  const handles = getResizeHandlePositions(entity);

  return {
    nw: handles.nw,
    ne: handles.ne,
    sw: handles.sw,
    se: handles.se,
  };
}

export function getResizeHandlePositions(entity: SceneImage): Record<ResizeHandle, Vector2> {
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

export function getRotateHandlePosition(entity: SceneImage, zoom: number): Vector2 {
  return add(
    { x: entity.x, y: entity.y },
    rotate({ x: 0, y: entity.height / 2 + ROTATE_HANDLE_DISTANCE / zoom }, entity.rotation),
  );
}

export function getResizeCursor(handle: ResizeHandle): string {
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

export function computeImageResize(
  currentWorld: Vector2,
  state: Extract<Interaction, { type: "resize-image" }>,
  lockAspectRatio: boolean,
): ResizeResult {
  const currentLocal = rotate(subtract(currentWorld, state.startCenter), -state.startRotation);

  return lockAspectRatio ? resizeWithAspectLock(currentLocal, state) : resizeWithoutAspectLock(currentLocal, state);
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
): ResizeResult {
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
): ResizeResult {
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
