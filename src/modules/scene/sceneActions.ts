import { TOKEN_COLORS } from "../../core/constants";
import type { Cell, SceneCharacter, SceneImage, SceneToken } from "../../core/types";

export function normalizeImageZIndexes(images: SceneImage[]): number {
  images
    .sort((a, b) => a.z - b.z)
    .forEach((image, index) => {
      image.z = index + 1;
    });

  return images.length + 1;
}

export function createSceneImage(
  imageElement: HTMLImageElement,
  src: string,
  name: string,
  worldPoint: { x: number; y: number },
  z: number,
): SceneImage {
  const maxInitialSize = 420;
  const ratio = imageElement.naturalWidth / imageElement.naturalHeight || 1;
  const width = ratio >= 1 ? maxInitialSize : maxInitialSize * ratio;
  const height = ratio >= 1 ? maxInitialSize / ratio : maxInitialSize;

  return {
    id: crypto.randomUUID(),
    image: imageElement,
    src,
    name,
    x: worldPoint.x,
    y: worldPoint.y,
    width,
    height,
    originalWidth: imageElement.naturalWidth,
    originalHeight: imageElement.naturalHeight,
    rotation: 0,
    z,
  };
}

export function createSceneCharacter(tokenIndex: number): SceneCharacter {
  return {
    id: crypto.randomUUID(),
    name: `P${tokenIndex}`,
    color: TOKEN_COLORS[(tokenIndex - 1) % TOKEN_COLORS.length],
  };
}

export function createSceneToken(character: SceneCharacter, cell: Cell): SceneToken {
  return {
    ...character,
    cell,
  };
}

export function moveImageLayer(
  images: SceneImage[],
  selectedImage: SceneImage,
  direction: "up" | "down" | "top" | "bottom",
  nextZ: number,
): number {
  normalizeImageZIndexes(images);

  if (direction === "up") selectedImage.z += 1.5;
  if (direction === "down") selectedImage.z -= 1.5;
  if (direction === "top") selectedImage.z = nextZ + 1;
  if (direction === "bottom") selectedImage.z = -1;

  return normalizeImageZIndexes(images);
}

export function resetImageSize(image: SceneImage): void {
  image.width = image.originalWidth;
  image.height = image.originalHeight;
}
