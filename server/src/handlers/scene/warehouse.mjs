import { randomUUID } from "node:crypto";
import { broadcastScenePatch } from "../../scene/broadcast.mjs";
import { addGroundItemQuantity, findGroundItemStack } from "../../scene/groundItems.mjs";
import { sceneBackpackItems, sceneCharacters, sceneItemDefinitions, sceneItemInstances } from "../../state/index.mjs";

const MAX_QUANTITY = 9999;

function parseWarehouseId(warehouseId) {
  const value = String(warehouseId ?? "");
  if (value.startsWith("backpack:")) {
    const characterId = value.slice("backpack:".length);
    return characterId ? { type: "backpack", characterId } : null;
  }

  if (value.startsWith("ground:")) {
    const parts = value.slice("ground:".length).split(",");
    const x = Number.parseInt(parts[0] ?? "", 10);
    const y = Number.parseInt(parts[1] ?? "", 10);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }
    return { type: "ground", cell: { x, y } };
  }

  return null;
}

function canPerformWarehouseTransfer(client) {
  return client.identity.type === "admin" || client.identity.type === "player";
}

function canAccessBackpack(client, characterId) {
  if (!sceneCharacters.some((character) => character.id === characterId)) {
    return false;
  }

  if (client.identity.type === "admin") {
    return true;
  }

  return client.identity.type === "player" && client.identity.id === characterId;
}

function canAccessWarehouse(client, warehouse) {
  if (!warehouse) {
    return false;
  }

  if (warehouse.type === "ground") {
    return canPerformWarehouseTransfer(client);
  }

  return canAccessBackpack(client, warehouse.characterId);
}

function clampQuantity(quantity) {
  return Math.min(MAX_QUANTITY, Math.max(1, Math.floor(quantity)));
}

function removeGroundItem(instanceId, quantity) {
  const instance = sceneItemInstances.find((candidate) => candidate.id === instanceId);
  if (!instance) {
    return null;
  }

  const transferQuantity = clampQuantity(Math.min(quantity, instance.quantity));
  const definitionId = instance.definitionId;

  if (transferQuantity >= instance.quantity) {
    const index = sceneItemInstances.indexOf(instance);
    sceneItemInstances.splice(index, 1);
    return { definitionId, quantity: transferQuantity, deletedInstanceId: instance.id };
  }

  instance.quantity -= transferQuantity;
  return {
    definitionId,
    quantity: transferQuantity,
    updatedInstance: { ...instance, cell: { ...instance.cell } },
  };
}

function removeBackpackItem(itemId, quantity) {
  const item = sceneBackpackItems.find((candidate) => candidate.id === itemId);
  if (!item) {
    return null;
  }

  const transferQuantity = clampQuantity(Math.min(quantity, item.quantity));
  const definitionId = item.definitionId;
  const characterId = item.characterId;

  if (transferQuantity >= item.quantity) {
    const index = sceneBackpackItems.indexOf(item);
    sceneBackpackItems.splice(index, 1);
    return { definitionId, quantity: transferQuantity, characterId, deletedBackpackItemId: item.id };
  }

  item.quantity -= transferQuantity;
  return {
    definitionId,
    quantity: transferQuantity,
    characterId,
    updatedBackpackItem: { ...item },
  };
}

function addToGround(cell, definitionId, quantity) {
  const existing = findGroundItemStack(sceneItemInstances, cell, definitionId);

  if (existing) {
    addGroundItemQuantity(existing, quantity);
    return { updatedInstance: { ...existing, cell: { ...existing.cell } } };
  }

  const instance = {
    id: randomUUID(),
    definitionId,
    cell: { ...cell },
    quantity,
  };
  sceneItemInstances.push(instance);
  return { createdInstance: instance };
}

function addToBackpack(characterId, definitionId, quantity) {
  const existing = sceneBackpackItems.find(
    (item) => item.characterId === characterId && item.definitionId === definitionId,
  );

  if (existing) {
    existing.quantity = Math.min(MAX_QUANTITY, existing.quantity + quantity);
    return { updatedBackpackItem: { ...existing } };
  }

  const item = {
    id: randomUUID(),
    characterId,
    definitionId,
    quantity,
  };
  sceneBackpackItems.push(item);
  return { createdBackpackItem: item };
}

function extractFromWarehouse(warehouse, itemId, quantity) {
  if (warehouse.type === "ground") {
    const instance = sceneItemInstances.find((candidate) => candidate.id === itemId);
    if (!instance || instance.cell.x !== warehouse.cell.x || instance.cell.y !== warehouse.cell.y) {
      return null;
    }

    return removeGroundItem(itemId, quantity);
  }

  const item = sceneBackpackItems.find((candidate) => candidate.id === itemId);
  if (!item || item.characterId !== warehouse.characterId) {
    return null;
  }

  return removeBackpackItem(itemId, quantity);
}

function depositToWarehouse(warehouse, definitionId, quantity) {
  if (!sceneItemDefinitions.some((definition) => definition.id === definitionId)) {
    return null;
  }

  if (warehouse.type === "ground") {
    return addToGround(warehouse.cell, definitionId, quantity);
  }

  return addToBackpack(warehouse.characterId, definitionId, quantity);
}

export function handleSceneWarehouseTransfer(client, message) {
  if (!canPerformWarehouseTransfer(client)) {
    return;
  }

  const fromWarehouse = parseWarehouseId(message.fromWarehouse);
  const toWarehouse = parseWarehouseId(message.toWarehouse);
  const itemId = String(message.itemId ?? "");
  const requestedQuantity = Number(message.quantity);

  if (!fromWarehouse || !toWarehouse || !itemId || fromWarehouse.type === toWarehouse.type && JSON.stringify(fromWarehouse) === JSON.stringify(toWarehouse)) {
    return;
  }

  if (!canAccessWarehouse(client, fromWarehouse) || !canAccessWarehouse(client, toWarehouse)) {
    return;
  }

  const sourceItem =
    fromWarehouse.type === "ground"
      ? sceneItemInstances.find((instance) => instance.id === itemId)
      : sceneBackpackItems.find((item) => item.id === itemId);

  if (!sourceItem) {
    return;
  }

  const transferQuantity = Number.isFinite(requestedQuantity) && requestedQuantity > 0
    ? clampQuantity(requestedQuantity)
    : sourceItem.quantity;

  const extracted = extractFromWarehouse(fromWarehouse, itemId, transferQuantity);
  if (!extracted) {
    return;
  }

  const deposited = depositToWarehouse(toWarehouse, extracted.definitionId, extracted.quantity);
  if (!deposited) {
    depositToWarehouse(fromWarehouse, extracted.definitionId, extracted.quantity);
    return;
  }

  client.lastSeenAt = Date.now();

  const patch = {};

  if (extracted.deletedInstanceId) {
    patch.itemInstanceDeletes = [extracted.deletedInstanceId];
  } else if (extracted.updatedInstance) {
    patch.itemInstanceUpserts = [extracted.updatedInstance];
  }

  if (extracted.deletedBackpackItemId) {
    patch.backpackItemDeletes = [extracted.deletedBackpackItemId];
  } else if (extracted.updatedBackpackItem) {
    patch.backpackItemUpserts = [extracted.updatedBackpackItem];
  }

  if (deposited.createdInstance) {
    patch.itemInstanceUpserts = [...(patch.itemInstanceUpserts ?? []), deposited.createdInstance];
  } else if (deposited.updatedInstance) {
    patch.itemInstanceUpserts = [...(patch.itemInstanceUpserts ?? []), deposited.updatedInstance];
  }

  if (deposited.createdBackpackItem) {
    patch.backpackItemUpserts = [...(patch.backpackItemUpserts ?? []), deposited.createdBackpackItem];
  } else if (deposited.updatedBackpackItem) {
    patch.backpackItemUpserts = [...(patch.backpackItemUpserts ?? []), deposited.updatedBackpackItem];
  }

  broadcastScenePatch(patch);
}

function splitGroundItem(instanceId, splitQuantity) {
  const instance = sceneItemInstances.find((candidate) => candidate.id === instanceId);
  if (!instance || instance.quantity <= 1 || splitQuantity < 1 || splitQuantity >= instance.quantity) {
    return null;
  }

  instance.quantity -= splitQuantity;
  const newInstance = {
    id: randomUUID(),
    definitionId: instance.definitionId,
    cell: { ...instance.cell },
    quantity: splitQuantity,
  };
  sceneItemInstances.push(newInstance);

  return {
    updatedInstance: { ...instance, cell: { ...instance.cell } },
    createdInstance: newInstance,
  };
}

function splitBackpackItem(itemId, splitQuantity) {
  const item = sceneBackpackItems.find((candidate) => candidate.id === itemId);
  if (!item || item.quantity <= 1 || splitQuantity < 1 || splitQuantity >= item.quantity) {
    return null;
  }

  item.quantity -= splitQuantity;
  const newItem = {
    id: randomUUID(),
    characterId: item.characterId,
    definitionId: item.definitionId,
    quantity: splitQuantity,
  };
  sceneBackpackItems.push(newItem);

  return {
    updatedBackpackItem: { ...item },
    createdBackpackItem: newItem,
  };
}

export function handleSceneWarehouseSplit(client, message) {
  if (!canPerformWarehouseTransfer(client)) {
    return;
  }

  const warehouse = parseWarehouseId(message.warehouseId);
  const itemId = String(message.itemId ?? "");
  const splitQuantity = clampQuantity(Number(message.splitQuantity));

  if (!warehouse || !itemId) {
    return;
  }

  if (!canAccessWarehouse(client, warehouse)) {
    return;
  }

  let result = null;
  if (warehouse.type === "ground") {
    const instance = sceneItemInstances.find((candidate) => candidate.id === itemId);
    if (!instance || instance.cell.x !== warehouse.cell.x || instance.cell.y !== warehouse.cell.y) {
      return;
    }

    result = splitGroundItem(itemId, splitQuantity);
    if (!result) {
      return;
    }

    client.lastSeenAt = Date.now();
    broadcastScenePatch({
      itemInstanceUpserts: [result.updatedInstance, result.createdInstance],
    });
    return;
  }

  const item = sceneBackpackItems.find((candidate) => candidate.id === itemId);
  if (!item || item.characterId !== warehouse.characterId) {
    return;
  }

  result = splitBackpackItem(itemId, splitQuantity);
  if (!result) {
    return;
  }

  client.lastSeenAt = Date.now();
  broadcastScenePatch({
    backpackItemUpserts: [result.updatedBackpackItem, result.createdBackpackItem],
  });
}
