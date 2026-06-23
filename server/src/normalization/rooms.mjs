import { isFiniteCell } from "../lib/utils.mjs";

export function normalizeSceneRoom(room) {
  if (!room || typeof room !== "object" || !Array.isArray(room.cells)) {
    return null;
  }

  const id = String(room.id ?? "");
  const name = String(room.name ?? "").trim().slice(0, 32);
  if (!id || room.cells.length === 0 || room.cells.length > 2048) {
    return null;
  }

  const cells = [];
  const seenCells = new Set();
  for (const cell of room.cells) {
    if (!isFiniteCell(cell)) {
      return null;
    }

    const key = `${cell.x},${cell.y}`;
    if (seenCells.has(key)) {
      continue;
    }

    seenCells.add(key);
    cells.push({ x: cell.x, y: cell.y });
  }

  return {
    id,
    name,
    cells,
  };
}
