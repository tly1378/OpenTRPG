import { broadcastScenePatch } from "../../scene/broadcast.mjs";
import { normalizeSceneItemDefinition } from "../../normalization/items.mjs";
import { sceneBackpackItems, sceneItemDefinitions, sceneItemInstances } from "../../state/index.mjs";

export function handleSceneItemDefinitionAdd(client, message) {
  if (client.identity.type !== "admin") {
    return;
  }

  const definition = normalizeSceneItemDefinition(message.definition);
  if (!definition || sceneItemDefinitions.some((candidate) => candidate.id === definition.id)) {
    return;
  }

  sceneItemDefinitions.push(definition);
  client.lastSeenAt = Date.now();
  broadcastScenePatch({ itemDefinitionUpserts: [{ ...definition }] });
}

export function handleSceneItemDefinitionUpdate(client, message) {
  if (client.identity.type !== "admin") {
    return;
  }

  const incomingDefinition = message.definition;
  if (!incomingDefinition || typeof incomingDefinition !== "object") {
    return;
  }

  const definition = sceneItemDefinitions.find((candidate) => candidate.id === String(incomingDefinition.id ?? ""));
  const normalized = normalizeSceneItemDefinition(incomingDefinition);
  if (!definition || !normalized || definition.id !== normalized.id) {
    return;
  }

  Object.assign(definition, normalized);
  client.lastSeenAt = Date.now();
  broadcastScenePatch({ itemDefinitionUpserts: [{ ...definition }] });
}

export function handleSceneItemDefinitionDelete(client, message) {
  if (client.identity.type !== "admin") {
    return;
  }

  const definitionId = String(message.definitionId ?? "");
  const definitionIndex = sceneItemDefinitions.findIndex((candidate) => candidate.id === definitionId);
  if (definitionIndex === -1) {
    return;
  }

  sceneItemDefinitions.splice(definitionIndex, 1);
  const deletedInstanceIds = sceneItemInstances
    .filter((instance) => instance.definitionId === definitionId)
    .map((instance) => instance.id);
  for (let index = sceneItemInstances.length - 1; index >= 0; index -= 1) {
    if (sceneItemInstances[index].definitionId === definitionId) {
      sceneItemInstances.splice(index, 1);
    }
  }
  const deletedBackpackItemIds = sceneBackpackItems
    .filter((item) => item.definitionId === definitionId)
    .map((item) => item.id);
  for (let index = sceneBackpackItems.length - 1; index >= 0; index -= 1) {
    if (sceneBackpackItems[index].definitionId === definitionId) {
      sceneBackpackItems.splice(index, 1);
    }
  }

  client.lastSeenAt = Date.now();
  const patch = { itemDefinitionDeletes: [definitionId] };
  if (deletedInstanceIds.length > 0) {
    patch.itemInstanceDeletes = deletedInstanceIds;
  }
  if (deletedBackpackItemIds.length > 0) {
    patch.backpackItemDeletes = deletedBackpackItemIds;
  }

  broadcastScenePatch(patch);
}
