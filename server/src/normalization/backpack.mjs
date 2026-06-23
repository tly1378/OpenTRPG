const MAX_QUANTITY = 9999;

export function normalizeSceneBackpackItem(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const id = String(raw.id ?? "").trim();
  const characterId = String(raw.characterId ?? "").trim();
  const definitionId = String(raw.definitionId ?? "").trim();
  const quantity = Math.min(MAX_QUANTITY, Math.max(1, Math.floor(Number(raw.quantity) || 1)));

  if (!id || !characterId || !definitionId) {
    return null;
  }

  return { id, characterId, definitionId, quantity };
}
