import { isFiniteCell } from "../lib/utils.mjs";

export function normalizeMovementPath(path, fromCell, toCell) {
  if (!Array.isArray(path) || path.length < 2 || path.length > 512) {
    return null;
  }

  const cells = [];
  for (const cell of path) {
    if (!isFiniteCell(cell)) {
      return null;
    }

    cells.push({ x: cell.x, y: cell.y });
  }

  const firstCell = cells[0];
  const lastCell = cells[cells.length - 1];
  if (
    firstCell.x !== fromCell.x ||
    firstCell.y !== fromCell.y ||
    lastCell.x !== toCell.x ||
    lastCell.y !== toCell.y
  ) {
    return null;
  }

  for (let index = 1; index < cells.length; index += 1) {
    const previousCell = cells[index - 1];
    const currentCell = cells[index];
    const dx = Math.abs(currentCell.x - previousCell.x);
    const dy = Math.abs(currentCell.y - previousCell.y);

    if (dx > 1 || dy > 1 || (dx === 0 && dy === 0)) {
      return null;
    }
  }

  return cells;
}

export function movementDistance(fromCell, toCell, path) {
  const normalizedPath = normalizeMovementPath(path, fromCell, toCell);
  if (normalizedPath) {
    return normalizedPath.length - 1;
  }

  return Math.max(Math.abs(toCell.x - fromCell.x), Math.abs(toCell.y - fromCell.y));
}
