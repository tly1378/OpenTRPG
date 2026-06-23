import { avatarOffsetLimit } from "../config.mjs";
import { sceneImages } from "../state/index.mjs";
import { clampNumber } from "../lib/utils.mjs";

export function normalizeSceneImage(image) {
  if (!image || typeof image !== "object") {
    return null;
  }

  const id = String(image.id ?? "");
  const name = String(image.name ?? "");
  const src = String(image.src ?? "");
  const numericFields = [
    image.x,
    image.y,
    image.width,
    image.height,
    image.originalWidth,
    image.originalHeight,
    image.rotation,
    image.z,
  ];

  if (
    !id ||
    !name ||
    !src.startsWith("data:image/") ||
    numericFields.some((value) => !Number.isFinite(value)) ||
    image.width <= 0 ||
    image.height <= 0 ||
    image.originalWidth <= 0 ||
    image.originalHeight <= 0
  ) {
    return null;
  }

  return {
    id,
    src,
    name,
    x: image.x,
    y: image.y,
    width: image.width,
    height: image.height,
    originalWidth: image.originalWidth,
    originalHeight: image.originalHeight,
    rotation: image.rotation,
    z: image.z,
  };
}

export function normalizeImageZIndexes() {
  sceneImages
    .sort((a, b) => a.z - b.z)
    .forEach((image, index) => {
      image.z = index + 1;
    });
}

export function upsertSceneImage(image) {
  const existingImageIndex = sceneImages.findIndex((candidate) => candidate.id === image.id);
  if (existingImageIndex === -1) {
    sceneImages.push(image);
  } else {
    sceneImages[existingImageIndex] = image;
  }
}

export function normalizeTokenAvatarFields(token) {
  const avatarSrc = typeof token.avatarSrc === "string" && token.avatarSrc.startsWith("data:image/") ? token.avatarSrc : null;
  if (!avatarSrc) {
    return {};
  }

  return {
    avatarSrc,
    avatarScale: clampNumber(token.avatarScale, 1, 3, 1),
    avatarOffsetX: clampNumber(token.avatarOffsetX, -avatarOffsetLimit, avatarOffsetLimit, 0),
    avatarOffsetY: clampNumber(token.avatarOffsetY, -avatarOffsetLimit, avatarOffsetLimit, 0),
  };
}
