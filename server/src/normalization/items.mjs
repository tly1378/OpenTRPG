import { normalizeTokenAvatarFields } from "./images.mjs";
import { isFiniteCell } from "../lib/utils.mjs";
import { clampNumber } from "../lib/utils.mjs";

export function normalizeItemName(name) {
  const normalizedName = String(name ?? "").trim();
  return normalizedName.length > 0 ? normalizedName.slice(0, 24) : null;
}

export function normalizeItemDescription(description) {
  if (description === undefined || description === null) {
    return "";
  }

  return String(description).slice(0, 500);
}

export function normalizeSceneItemDefinition(definition) {
  if (!definition || typeof definition !== "object") {
    return null;
  }

  const id = String(definition.id ?? "");
  const name = normalizeItemName(definition.name);
  if (!id || !name) {
    return null;
  }

  const iconFields = normalizeTokenAvatarFields({
    avatarSrc: definition.iconSrc,
    avatarScale: definition.iconScale,
    avatarOffsetX: definition.iconOffsetX,
    avatarOffsetY: definition.iconOffsetY,
  });

  return {
    id,
    name,
    description: normalizeItemDescription(definition.description),
    iconSrc: iconFields.avatarSrc,
    iconScale: iconFields.avatarScale,
    iconOffsetX: iconFields.avatarOffsetX,
    iconOffsetY: iconFields.avatarOffsetY,
  };
}

export function normalizeSceneItemInstance(instance) {
  if (!instance || typeof instance !== "object" || !isFiniteCell(instance.cell)) {
    return null;
  }

  const id = String(instance.id ?? "");
  const definitionId = String(instance.definitionId ?? "");
  if (!id || !definitionId) {
    return null;
  }

  return {
    id,
    definitionId,
    cell: {
      x: instance.cell.x,
      y: instance.cell.y,
    },
    quantity: clampNumber(instance.quantity, 1, 9999, 1),
  };
}
