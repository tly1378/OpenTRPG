import type { SceneItemDefinition, WarehouseItemEntry } from "../../core/types";
import type { TokenAvatarImage } from "../../core/appState";
import { WAREHOUSE_ITEM_MIME, type WarehouseDragPayload } from "./warehouses";

type WarehouseListOptions = {
  container: HTMLElement;
  warehouseId: string;
  items: WarehouseItemEntry[];
  definitionsById: Map<string, SceneItemDefinition>;
  iconImages: Map<string, TokenAvatarImage>;
  draggable: boolean;
  droppable: boolean;
  onTransfer: (fromWarehouseId: string, toWarehouseId: string, itemId: string) => void;
  onItemInspect?: (item: WarehouseItemEntry) => void;
};

const dropBoundContainers = new WeakSet<HTMLElement>();

function formatItemLabel(definition: SceneItemDefinition | undefined, quantity: number): string {
  const name = definition?.name ?? "物品";
  return quantity > 1 ? `${name} ×${quantity}` : name;
}

function createItemIcon(
  definition: SceneItemDefinition | undefined,
  iconImages: Map<string, TokenAvatarImage>,
): HTMLDivElement {
  const icon = document.createElement("div");
  icon.className = "warehouse-item-icon";

  if (!definition) {
    icon.textContent = "物";
    return icon;
  }

  const iconImage = iconImages.get(definition.id);
  if (iconImage) {
    const image = document.createElement("img");
    image.src = iconImage.src;
    image.alt = `${definition.name} 图标`;
    icon.append(image);
    return icon;
  }

  icon.textContent = definition.name.trim().slice(0, 1) || "物";
  return icon;
}

function ensureDropHandlers(
  container: HTMLElement,
  warehouseId: string,
  onTransfer: (fromWarehouseId: string, toWarehouseId: string, itemId: string) => void,
): void {
  if (dropBoundContainers.has(container)) {
    return;
  }

  dropBoundContainers.add(container);

  container.addEventListener("dragover", (event) => {
    if (!event.dataTransfer?.types.includes(WAREHOUSE_ITEM_MIME)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    container.classList.add("is-drop-target");
  });

  container.addEventListener("dragleave", (event) => {
    if (event.currentTarget === event.target || !container.contains(event.relatedTarget as Node)) {
      container.classList.remove("is-drop-target");
    }
  });

  container.addEventListener("drop", (event) => {
    container.classList.remove("is-drop-target");
    if (!event.dataTransfer?.types.includes(WAREHOUSE_ITEM_MIME)) {
      return;
    }

    event.preventDefault();
    const rawPayload = event.dataTransfer.getData(WAREHOUSE_ITEM_MIME);
    if (!rawPayload) {
      return;
    }

    let payload: WarehouseDragPayload;
    try {
      payload = JSON.parse(rawPayload) as WarehouseDragPayload;
    } catch {
      return;
    }

    const targetWarehouseId = container.dataset.warehouseId ?? warehouseId;
    if (!payload.warehouseId || !payload.itemId || payload.warehouseId === targetWarehouseId) {
      return;
    }

    onTransfer(payload.warehouseId, targetWarehouseId, payload.itemId);
  });
}

export function renderWarehouseList(options: WarehouseListOptions): void {
  const { container, warehouseId, items, definitionsById, iconImages, draggable, droppable, onTransfer, onItemInspect } =
    options;

  container.dataset.warehouseId = warehouseId;
  container.replaceChildren();

  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "warehouse-empty";
    empty.textContent = "暂无物品";
    container.append(empty);
  } else {
    for (const item of items) {
      const definition = definitionsById.get(item.definitionId);
      const row = document.createElement("div");
      row.className = "warehouse-item-row";
      row.draggable = draggable;
      row.dataset.itemId = item.id;

      if (draggable) {
        row.addEventListener("dragstart", (event) => {
          if (!event.dataTransfer) {
            return;
          }

          const payload: WarehouseDragPayload = {
            warehouseId,
            itemId: item.id,
          };
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData(WAREHOUSE_ITEM_MIME, JSON.stringify(payload));
          event.dataTransfer.setData("text/plain", item.id);
          row.classList.add("is-dragging");
        });

        row.addEventListener("dragend", () => {
          row.classList.remove("is-dragging");
        });
      }

      const icon = createItemIcon(definition, iconImages);
      const label = document.createElement("div");
      label.className = "warehouse-item-label";
      label.textContent = formatItemLabel(definition, item.quantity);

      row.append(icon, label);

      if (onItemInspect) {
        row.addEventListener("dblclick", () => {
          onItemInspect(item);
        });
      }

      container.append(row);
    }
  }

  if (droppable) {
    ensureDropHandlers(container, warehouseId, onTransfer);
  }
}
