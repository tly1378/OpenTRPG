import { broadcastScenePatch } from "../../scene/broadcast.mjs";
import { normalizeSceneItemInstance } from "../../normalization/items.mjs";
import { sceneItemDefinitions, sceneItemInstances } from "../../state/index.mjs";

export function handleSceneItemInstanceAdd(client, message) {
  if (client.identity.type !== "admin") {
    return;
  }

  const instance = normalizeSceneItemInstance(message.instance);
  if (
    !instance ||
    !sceneItemDefinitions.some((definition) => definition.id === instance.definitionId) ||
    sceneItemInstances.some((candidate) => candidate.id === instance.id)
  ) {
    return;
  }

  sceneItemInstances.push(instance);
  client.lastSeenAt = Date.now();
  broadcastScenePatch({ itemInstanceUpserts: [{ ...instance, cell: { ...instance.cell } }] });
}

export function handleSceneItemInstanceUpdate(client, message) {
  if (client.identity.type !== "admin") {
    return;
  }

  const incomingInstance = message.instance;
  if (!incomingInstance || typeof incomingInstance !== "object") {
    return;
  }

  const instance = sceneItemInstances.find((candidate) => candidate.id === String(incomingInstance.id ?? ""));
  const normalized = normalizeSceneItemInstance(incomingInstance);
  if (!instance || !normalized || instance.id !== normalized.id) {
    return;
  }

  instance.quantity = normalized.quantity;
  client.lastSeenAt = Date.now();
  broadcastScenePatch({ itemInstanceUpserts: [{ ...instance, cell: { ...instance.cell } }] });
}

export function handleSceneItemInstanceDelete(client, message) {
  if (client.identity.type !== "admin") {
    return;
  }

  const instanceId = String(message.instanceId ?? "");
  const instanceIndex = sceneItemInstances.findIndex((candidate) => candidate.id === instanceId);
  if (instanceIndex === -1) {
    return;
  }

  sceneItemInstances.splice(instanceIndex, 1);
  client.lastSeenAt = Date.now();
  broadcastScenePatch({ itemInstanceDeletes: [instanceId] });
}
