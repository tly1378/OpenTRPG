import {
  backpackWarehouseId,
  groundWarehouseId,
} from "../modules/warehouses/warehouses";

export class WarehouseController {
  constructor(
    private readonly queries: {
      getPlayerCharacterId: () => string | null;
      canTransferWarehouse: (characterId: string) => boolean;
    },
    private readonly network: {
      sendWarehouseTransfer: (fromWarehouse: string, toWarehouse: string, itemId: string) => void;
      sendWarehouseSplit: (warehouseId: string, itemId: string, splitQuantity: number) => void;
    },
  ) {}

  transferItem(fromWarehouse: string, toWarehouse: string, itemId: string): void {
    const fromCharacterId = fromWarehouse.startsWith("backpack:") ? fromWarehouse.slice("backpack:".length) : null;
    const toCharacterId = toWarehouse.startsWith("backpack:") ? toWarehouse.slice("backpack:".length) : null;

    if (fromCharacterId && !this.queries.canTransferWarehouse(fromCharacterId)) {
      return;
    }

    if (toCharacterId && !this.queries.canTransferWarehouse(toCharacterId)) {
      return;
    }

    this.network.sendWarehouseTransfer(fromWarehouse, toWarehouse, itemId);
  }

  splitItem(warehouseId: string, itemId: string, splitQuantity: number): void {
    this.network.sendWarehouseSplit(warehouseId, itemId, splitQuantity);
  }

  takeItemToPlayerBackpack(instanceId: string, cell: { x: number; y: number }): void {
    const characterId = this.queries.getPlayerCharacterId();
    if (!characterId) {
      return;
    }

    this.transferItem(groundWarehouseId(cell), backpackWarehouseId(characterId), instanceId);
  }

  discardBackpackItemToGround(
    itemId: string,
    characterId: string,
    cell: { x: number; y: number },
  ): void {
    if (!this.queries.canTransferWarehouse(characterId)) {
      return;
    }

    this.transferItem(backpackWarehouseId(characterId), groundWarehouseId(cell), itemId);
  }
}
