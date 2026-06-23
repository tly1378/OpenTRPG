import { HANDLE_RADIUS, TOKEN_RADIUS } from "../../core/constants";
import { distance, rotate, subtract } from "../../utilities/geometry";
import { getResizeHandlePositions, getRotateHandlePosition } from "../image/imageTransform";
import { tokenRenderPosition } from "./renderer";
import type { Interaction, MovingToken, ResizeHandle, SceneImage, SceneToken, Vector2 } from "../../core/types";

type HitTestViewport = {
  zoom: number;
  worldToScreen: (point: Vector2) => Vector2;
};

export function pointInImage(entity: SceneImage, worldPoint: Vector2): boolean {
  const local = rotate(subtract(worldPoint, { x: entity.x, y: entity.y }), -entity.rotation);

  return Math.abs(local.x) <= entity.width / 2 && Math.abs(local.y) <= entity.height / 2;
}

export function hitTestImage(sceneImages: SceneImage[], worldPoint: Vector2): SceneImage | null {
  return [...sceneImages]
    .sort((a, b) => b.z - a.z)
    .find((image) => pointInImage(image, worldPoint)) ?? null;
}

export function hitTestToken(
  sceneTokens: SceneToken[],
  worldPoint: Vector2,
  state: {
    interaction: Interaction | null;
    movingTokens: MovingToken[];
    previewTokenPosition: Vector2 | null;
  },
  zoom: number,
): SceneToken | null {
  return [...sceneTokens]
    .reverse()
    .find((token) => distance(tokenRenderPosition(token, state), worldPoint) <= TOKEN_RADIUS + 8 / zoom) ?? null;
}

export function hitTestResizeHandle(
  selectedImage: SceneImage | null,
  screenPoint: Vector2,
  viewport: HitTestViewport,
): ResizeHandle | null {
  if (!selectedImage) {
    return null;
  }

  const handles = getResizeHandlePositions(selectedImage);
  const handleOrder: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

  return (
    handleOrder.find((handle) => distance(viewport.worldToScreen(handles[handle]), screenPoint) <= HANDLE_RADIUS + 5) ??
    null
  );
}

export function hitTestRotateHandle(
  selectedImage: SceneImage | null,
  screenPoint: Vector2,
  viewport: HitTestViewport,
): boolean {
  return selectedImage
    ? distance(viewport.worldToScreen(getRotateHandlePosition(selectedImage, viewport.zoom)), screenPoint) <=
        HANDLE_RADIUS + 6
    : false;
}
