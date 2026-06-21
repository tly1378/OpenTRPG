import { GRID_CELL_SIZE } from "./constants";
import { distance } from "./geometry";
import type { Cell, SceneDoor, SceneToken, Vector2, WallEdgeType } from "./types";

export function sameCell(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y;
}

export function cellKey(cell: Cell): string {
  return `${cell.x},${cell.y}`;
}

export function edgeKey(edge: { x: number; y: number }): string {
  return `${edge.x},${edge.y}`;
}

export function worldToCell(point: Vector2): Cell {
  return {
    x: Math.floor(point.x / GRID_CELL_SIZE),
    y: Math.floor(point.y / GRID_CELL_SIZE),
  };
}

export function cellCenter(cell: Cell): Vector2 {
  return {
    x: (cell.x + 0.5) * GRID_CELL_SIZE,
    y: (cell.y + 0.5) * GRID_CELL_SIZE,
  };
}

export function blockedEdgeSet(
  type: WallEdgeType,
  blockedVerticalEdges: Set<string>,
  blockedHorizontalEdges: Set<string>,
): Set<string> {
  return type === "vertical" ? blockedVerticalEdges : blockedHorizontalEdges;
}

export function hasBlockedEdge(
  type: WallEdgeType,
  x: number,
  y: number,
  blockedVerticalEdges: Set<string>,
  blockedHorizontalEdges: Set<string>,
): boolean {
  return blockedEdgeSet(type, blockedVerticalEdges, blockedHorizontalEdges).has(edgeKey({ x, y }));
}

export function toggleBlockedEdge(
  type: WallEdgeType,
  x: number,
  y: number,
  blockedVerticalEdges: Set<string>,
  blockedHorizontalEdges: Set<string>,
): void {
  const set = blockedEdgeSet(type, blockedVerticalEdges, blockedHorizontalEdges);
  const key = edgeKey({ x, y });

  if (set.has(key)) {
    set.delete(key);
  } else {
    set.add(key);
  }
}

export function canMoveCardinal(
  from: Cell,
  to: Cell,
  blockedVerticalEdges: Set<string>,
  blockedHorizontalEdges: Set<string>,
): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (Math.abs(dx) + Math.abs(dy) !== 1) {
    return false;
  }

  if (dx === 1) return !hasBlockedEdge("vertical", from.x + 1, from.y, blockedVerticalEdges, blockedHorizontalEdges);
  if (dx === -1) return !hasBlockedEdge("vertical", from.x, from.y, blockedVerticalEdges, blockedHorizontalEdges);
  if (dy === 1) return !hasBlockedEdge("horizontal", from.x, from.y + 1, blockedVerticalEdges, blockedHorizontalEdges);

  return !hasBlockedEdge("horizontal", from.x, from.y, blockedVerticalEdges, blockedHorizontalEdges);
}

export function canMoveBetween(
  from: Cell,
  to: Cell,
  blockedVerticalEdges: Set<string>,
  blockedHorizontalEdges: Set<string>,
): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (Math.abs(dx) + Math.abs(dy) === 1) {
    return canMoveCardinal(from, to, blockedVerticalEdges, blockedHorizontalEdges);
  }

  if (Math.abs(dx) === 1 && Math.abs(dy) === 1) {
    const horizontalFirst = { x: from.x + dx, y: from.y };
    const verticalFirst = { x: from.x, y: from.y + dy };

    return (
      canMoveCardinal(from, horizontalFirst, blockedVerticalEdges, blockedHorizontalEdges) &&
      canMoveCardinal(horizontalFirst, to, blockedVerticalEdges, blockedHorizontalEdges) &&
      canMoveCardinal(from, verticalFirst, blockedVerticalEdges, blockedHorizontalEdges) &&
      canMoveCardinal(verticalFirst, to, blockedVerticalEdges, blockedHorizontalEdges)
    );
  }

  return false;
}

export function occupiedByToken(cell: Cell, sceneTokens: SceneToken[], exceptTokenId?: string): boolean {
  return sceneTokens.some((token) => token.id !== exceptTokenId && sameCell(token.cell, cell));
}

export function findPath(
  start: Cell,
  target: Cell,
  tokenId: string,
  sceneTokens: SceneToken[],
  blockedVerticalEdges: Set<string>,
  blockedHorizontalEdges: Set<string>,
): Cell[] {
  if (sameCell(start, target)) {
    return [start];
  }

  const queue = new Map<string, { cell: Cell; priority: number }>();
  const cameFrom = new Map<string, string>();
  const costs = new Map<string, number>();
  const cells = new Map<string, Cell>();
  const startKey = cellKey(start);
  const targetKey = cellKey(target);
  const margin = 24;
  const minX = Math.min(start.x, target.x) - margin;
  const maxX = Math.max(start.x, target.x) + margin;
  const minY = Math.min(start.y, target.y) - margin;
  const maxY = Math.max(start.y, target.y) + margin;

  queue.set(startKey, { cell: start, priority: 0 });
  costs.set(startKey, 0);
  cells.set(startKey, start);

  while (queue.size > 0) {
    const current = [...queue.values()].sort((a, b) => a.priority - b.priority)[0];
    const currentKey = cellKey(current.cell);
    queue.delete(currentKey);

    if (currentKey === targetKey) {
      break;
    }

    for (const neighbor of getNeighborCells(current.cell, tokenId, sceneTokens, blockedVerticalEdges, blockedHorizontalEdges)) {
      if (neighbor.cell.x < minX || neighbor.cell.x > maxX || neighbor.cell.y < minY || neighbor.cell.y > maxY) {
        continue;
      }

      const neighborKey = cellKey(neighbor.cell);
      const nextCost = (costs.get(currentKey) ?? 0) + neighbor.cost;

      if (!costs.has(neighborKey) || nextCost < (costs.get(neighborKey) ?? Number.POSITIVE_INFINITY)) {
        costs.set(neighborKey, nextCost);
        cameFrom.set(neighborKey, currentKey);
        cells.set(neighborKey, neighbor.cell);
        queue.set(neighborKey, {
          cell: neighbor.cell,
          priority: nextCost + distance(neighbor.cell, target),
        });
      }
    }
  }

  if (!cameFrom.has(targetKey)) {
    return [];
  }

  const path: Cell[] = [target];
  let currentKey = targetKey;

  while (currentKey !== startKey) {
    const previousKey = cameFrom.get(currentKey);
    if (!previousKey) {
      return [];
    }

    const previousCell = cells.get(previousKey);
    if (!previousCell) {
      return [];
    }

    path.push(previousCell);
    currentKey = previousKey;
  }

  return path.reverse();
}

export function findClosedRegion(
  start: Cell,
  blockedVerticalEdges: Set<string>,
  blockedHorizontalEdges: Set<string>,
): Cell[] {
  const bounds = blockingBounds(blockedVerticalEdges, blockedHorizontalEdges);
  if (!bounds) {
    return [];
  }

  const minX = bounds.minX - 1;
  const maxX = bounds.maxX + 1;
  const minY = bounds.minY - 1;
  const maxY = bounds.maxY + 1;
  if (start.x < minX || start.x > maxX || start.y < minY || start.y > maxY) {
    return [];
  }

  const queue: Cell[] = [start];
  const visited = new Map<string, Cell>([[cellKey(start), start]]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    if (current.x <= minX || current.x >= maxX || current.y <= minY || current.y >= maxY) {
      return [];
    }

    for (const next of cardinalNeighbors(current)) {
      if (!canMoveCardinal(current, next, blockedVerticalEdges, blockedHorizontalEdges)) {
        continue;
      }

      const key = cellKey(next);
      if (visited.has(key)) {
        continue;
      }

      visited.set(key, next);
      queue.push(next);
    }
  }

  return [...visited.values()].sort((a, b) => a.y - b.y || a.x - b.x);
}

export function nearestEditableEdge(worldPoint: Vector2): { type: WallEdgeType; x: number; y: number } {
  const cell = worldToCell(worldPoint);
  const localX = worldPoint.x - cell.x * GRID_CELL_SIZE;
  const localY = worldPoint.y - cell.y * GRID_CELL_SIZE;
  const left = localX;
  const right = GRID_CELL_SIZE - localX;
  const bottom = localY;
  const top = GRID_CELL_SIZE - localY;
  const minDistance = Math.min(left, right, bottom, top);

  if (minDistance === left) return { type: "vertical", x: cell.x, y: cell.y };
  if (minDistance === right) return { type: "vertical", x: cell.x + 1, y: cell.y };
  if (minDistance === bottom) return { type: "horizontal", x: cell.x, y: cell.y };

  return { type: "horizontal", x: cell.x, y: cell.y + 1 };
}

export function roomKeyFromCells(cells: Cell[]): string {
  return cells.map(cellKey).sort().join("|");
}

export function roomCenter(cells: Cell[]): Vector2 {
  if (cells.length === 0) {
    return { x: 0, y: 0 };
  }

  const sum = cells.reduce(
    (total, cell) => ({
      x: total.x + cell.x + 0.5,
      y: total.y + cell.y + 0.5,
    }),
    { x: 0, y: 0 },
  );

  return {
    x: (sum.x / cells.length) * GRID_CELL_SIZE,
    y: (sum.y / cells.length) * GRID_CELL_SIZE,
  };
}

export function movementBlockedEdgeSets(
  blockedVerticalEdges: Set<string>,
  blockedHorizontalEdges: Set<string>,
  doors: Iterable<SceneDoor>,
): { vertical: Set<string>; horizontal: Set<string> } {
  const vertical = new Set(blockedVerticalEdges);
  const horizontal = new Set(blockedHorizontalEdges);

  for (const door of doors) {
    if (!door.isOpen) {
      blockedEdgeSet(door.type, vertical, horizontal).add(edgeKey(door));
    }
  }

  return { vertical, horizontal };
}

export function roomBoundaryEdgeSets(
  blockedVerticalEdges: Set<string>,
  blockedHorizontalEdges: Set<string>,
  doors: Iterable<SceneDoor>,
): { vertical: Set<string>; horizontal: Set<string> } {
  const vertical = new Set(blockedVerticalEdges);
  const horizontal = new Set(blockedHorizontalEdges);

  for (const door of doors) {
    blockedEdgeSet(door.type, vertical, horizontal).add(edgeKey(door));
  }

  return { vertical, horizontal };
}

function getNeighborCells(
  cell: Cell,
  tokenId: string,
  sceneTokens: SceneToken[],
  blockedVerticalEdges: Set<string>,
  blockedHorizontalEdges: Set<string>,
): Array<{ cell: Cell; cost: number }> {
  const neighbors: Array<{ cell: Cell; cost: number }> = [];

  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      if (dx === 0 && dy === 0) continue;

      const next = { x: cell.x + dx, y: cell.y + dy };
      if (
        occupiedByToken(next, sceneTokens, tokenId) ||
        !canMoveBetween(cell, next, blockedVerticalEdges, blockedHorizontalEdges)
      ) {
        continue;
      }

      neighbors.push({
        cell: next,
        cost: Math.abs(dx) + Math.abs(dy) === 2 ? Math.SQRT2 : 1,
      });
    }
  }

  return neighbors;
}

function blockingBounds(
  blockedVerticalEdges: Set<string>,
  blockedHorizontalEdges: Set<string>,
): { minX: number; maxX: number; minY: number; maxY: number } | null {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const key of blockedVerticalEdges) {
    const [x, y] = key.split(",").map(Number);
    minX = Math.min(minX, x - 1);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  for (const key of blockedHorizontalEdges) {
    const [x, y] = key.split(",").map(Number);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y - 1);
    maxY = Math.max(maxY, y);
  }

  return Number.isFinite(minX) ? { minX, maxX, minY, maxY } : null;
}

function cardinalNeighbors(cell: Cell): Cell[] {
  return [
    { x: cell.x + 1, y: cell.y },
    { x: cell.x - 1, y: cell.y },
    { x: cell.x, y: cell.y + 1 },
    { x: cell.x, y: cell.y - 1 },
  ];
}
