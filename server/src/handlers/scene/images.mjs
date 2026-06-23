import {
  normalizeImageZIndexes,
  normalizeSceneImage,
  upsertSceneImage,
} from "../../normalization/images.mjs";
import { broadcastSceneSnapshot } from "../../scene/snapshot.mjs";
import { sceneImages } from "../../state/index.mjs";

export function handleSceneImageAdd(client, message) {
  if (client.identity.type !== "admin") {
    return;
  }

  const image = normalizeSceneImage(message.image);
  if (!image) {
    return;
  }

  upsertSceneImage(image);
  normalizeImageZIndexes();
  client.lastSeenAt = Date.now();
  broadcastSceneSnapshot();
}

export function handleSceneImageUpdate(client, message) {
  if (client.identity.type !== "admin") {
    return;
  }

  const image = normalizeSceneImage(message.image);
  if (!image || !sceneImages.some((candidate) => candidate.id === image.id)) {
    return;
  }

  upsertSceneImage(image);
  normalizeImageZIndexes();
  client.lastSeenAt = Date.now();
  broadcastSceneSnapshot();
}

export function handleSceneImageDelete(client, message) {
  if (client.identity.type !== "admin") {
    return;
  }

  const imageId = String(message.imageId ?? "");
  const imageIndex = sceneImages.findIndex((candidate) => candidate.id === imageId);
  if (imageIndex === -1) {
    return;
  }

  sceneImages.splice(imageIndex, 1);
  normalizeImageZIndexes();
  client.lastSeenAt = Date.now();
  broadcastSceneSnapshot();
}

export function handleSceneImagesUpdate(client, message) {
  if (client.identity.type !== "admin" || !Array.isArray(message.images)) {
    return;
  }

  let hasChanged = false;
  for (const candidate of message.images) {
    const image = normalizeSceneImage(candidate);
    if (!image || !sceneImages.some((existingImage) => existingImage.id === image.id)) {
      continue;
    }

    upsertSceneImage(image);
    hasChanged = true;
  }

  if (!hasChanged) {
    return;
  }

  normalizeImageZIndexes();
  client.lastSeenAt = Date.now();
  broadcastSceneSnapshot();
}
