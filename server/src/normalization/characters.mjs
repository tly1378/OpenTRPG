import { normalizeTokenAvatarFields } from "./images.mjs";

export function normalizeSceneCharacter(character) {
  if (!character || typeof character !== "object") {
    return null;
  }

  const id = String(character.id ?? "");
  const name = String(character.name ?? "");
  const color = String(character.color ?? "");

  if (!id || !name || !color) {
    return null;
  }

  return {
    id,
    name,
    color,
    isNpc: character.isNpc === true,
    ...normalizeTokenAvatarFields(character),
  };
}

export function normalizeTokenName(name) {
  const normalizedName = String(name ?? "").trim();
  return normalizedName.length > 0 ? normalizedName.slice(0, 24) : null;
}
