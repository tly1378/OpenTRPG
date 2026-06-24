import type { Cell, SceneBackpackItem, SceneItemInstance, WarehouseItemEntry } from "../../core/types";
import { cellKey } from "../grid/grid";

export const WAREHOUSE_ITEM_MIME = "application/x-trpg-warehouse-item";

export type WarehouseDragPayload = {
  warehouseId: string;
  itemId: string;
};

export function backpackWarehouseId(characterId: string): string {
  return `backpack:${characterId}`;
}

export function groundWarehouseId(cell: Cell): string {
  return `ground:${cell.x},${cell.y}`;
}

export function groundWarehouseLabel(cell: Cell): string {
  return `空地(${cell.x},${cell.y})`;
}

export function parseGroundWarehouseId(warehouseId: string): Cell | null {
  if (!warehouseId.startsWith("ground:")) {
    return null;
  }

  const parts = warehouseId.slice("ground:".length).split(",");
  const x = Number.parseInt(parts[0] ?? "", 10);
  const y = Number.parseInt(parts[1] ?? "", 10);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return { x, y };
}

export function parseBackpackWarehouseId(warehouseId: string): string | null {
  if (!warehouseId.startsWith("backpack:")) {
    return null;
  }

  const characterId = warehouseId.slice("backpack:".length);
  return characterId || null;
}

export function findGroundItemStack(
  instances: SceneItemInstance[],
  cell: Cell,
  definitionId: string,
): SceneItemInstance | undefined {
  return instances.find(
    (instance) => cellKey(instance.cell) === cellKey(cell) && instance.definitionId === definitionId,
  );
}

export function getGroundWarehouseItems(
  cell: Cell,
  instances: SceneItemInstance[],
): WarehouseItemEntry[] {
  return instances
    .filter((instance) => cellKey(instance.cell) === cellKey(cell))
    .map((instance) => ({
      id: instance.id,
      definitionId: instance.definitionId,
      quantity: instance.quantity,
      source: "ground" as const,
    }));
}

export function getBackpackWarehouseItems(
  characterId: string,
  backpackItems: SceneBackpackItem[],
): WarehouseItemEntry[] {
  return backpackItems
    .filter((item) => item.characterId === characterId)
    .map((item) => ({
      id: item.id,
      definitionId: item.definitionId,
      quantity: item.quantity,
      source: "backpack" as const,
    }));
}

export function getWarehouseLabel(
  warehouseId: string,
  characterName?: string | null,
): string {
  const groundCell = parseGroundWarehouseId(warehouseId);
  if (groundCell) {
    return groundWarehouseLabel(groundCell);
  }

  const characterId = parseBackpackWarehouseId(warehouseId);
  if (characterId) {
    return characterName ? `${characterName}的背包` : "背包";
  }

  return "仓库";
}
