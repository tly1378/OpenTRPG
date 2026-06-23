export function clampNumber(value, min, max, fallback) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

export function isFiniteCell(cell) {
  return (
    cell &&
    typeof cell === "object" &&
    Number.isFinite(cell.x) &&
    Number.isFinite(cell.y)
  );
}
