import { GRID_CELL_SIZE } from "../../core/constants";
import {
  blockedEdgeSet,
  edgeKey,
  findClosedRegion,
  nearestEditableEdge,
  roomBoundaryEdgeSets,
  roomKeyFromCells,
  worldToCell,
} from "./grid";
import type { Cell, GridIntersection, SceneDoor, SceneRoom, Vector2, WallEdge } from "../../core/types";

export function doorId(door: Pick<SceneDoor, "type" | "x" | "y">): string {
  return `${door.type}:${door.x},${door.y}`;
}

export function closedRegionAt(
  worldPoint: Vector2,
  blockedVerticalEdges: Set<string>,
  blockedHorizontalEdges: Set<string>,
  doors: Iterable<SceneDoor>,
): Cell[] {
  const boundaryEdges = roomBoundaryEdgeSets(blockedVerticalEdges, blockedHorizontalEdges, doors);
  return findClosedRegion(worldToCell(worldPoint), boundaryEdges.vertical, boundaryEdges.horizontal);
}

export function findRoomByCells(rooms: SceneRoom[], cells: Cell[]): SceneRoom | null {
  const key = roomKeyFromCells(cells);
  return rooms.find((room) => roomKeyFromCells(room.cells) === key) ?? null;
}

export function hitTestDoor(
  worldPoint: Vector2,
  doors: Map<string, SceneDoor>,
  cameraZoom: number,
): SceneDoor | null {
  const edge = nearestEditableEdge(worldPoint);
  const door = doors.get(doorId(edge));
  if (!door) {
    return null;
  }

  return distanceToEdge(worldPoint, door) <= Math.max(4, 10 / cameraZoom) ? door : null;
}

export function hitTestWallIntersection(worldPoint: Vector2, cameraZoom: number): GridIntersection | null {
  const intersection = nearestGridIntersection(worldPoint);
  const intersectionWorld = {
    x: intersection.x * GRID_CELL_SIZE,
    y: intersection.y * GRID_CELL_SIZE,
  };
  const hitRadius = Math.min(GRID_CELL_SIZE * 0.45, 12 / cameraZoom);
  const distance = Math.hypot(worldPoint.x - intersectionWorld.x, worldPoint.y - intersectionWorld.y);

  return distance <= hitRadius ? intersection : null;
}

export function wallDragTarget(start: GridIntersection, worldPoint: Vector2): GridIntersection {
  const rawTarget = nearestGridIntersection(worldPoint);
  const dx = rawTarget.x - start.x;
  const dy = rawTarget.y - start.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return { x: rawTarget.x, y: start.y };
  }

  return { x: start.x, y: rawTarget.y };
}

export function wallEdgesBetween(start: GridIntersection, target: GridIntersection): WallEdge[] {
  if (start.y === target.y) {
    const minX = Math.min(start.x, target.x);
    const maxX = Math.max(start.x, target.x);
    return Array.from({ length: maxX - minX }, (_, index) => ({
      type: "horizontal",
      x: minX + index,
      y: start.y,
    }));
  }

  const minY = Math.min(start.y, target.y);
  const maxY = Math.max(start.y, target.y);
  return Array.from({ length: maxY - minY }, (_, index) => ({
    type: "vertical",
    x: start.x,
    y: minY + index,
  }));
}

export function wallEdgesTargetBlocked(
  edges: WallEdge[],
  blockedVerticalEdges: Set<string>,
  blockedHorizontalEdges: Set<string>,
): boolean {
  const firstEdge = edges[0];

  if (!firstEdge) {
    return true;
  }

  return !blockedEdgeSet(firstEdge.type, blockedVerticalEdges, blockedHorizontalEdges).has(edgeKey(firstEdge));
}

export function cellsBesideWallEdge(edge: WallEdge): [Cell, Cell] {
  if (edge.type === "vertical") {
    return [
      { x: edge.x - 1, y: edge.y },
      { x: edge.x, y: edge.y },
    ];
  }

  return [
    { x: edge.x, y: edge.y - 1 },
    { x: edge.x, y: edge.y },
  ];
}

export function roomDisplayName(room: SceneRoom): string {
  return room.name.trim() || "未命名房间";
}

function nearestGridIntersection(worldPoint: Vector2): GridIntersection {
  return {
    x: Math.round(worldPoint.x / GRID_CELL_SIZE),
    y: Math.round(worldPoint.y / GRID_CELL_SIZE),
  };
}

function distanceToEdge(worldPoint: Vector2, edge: Pick<SceneDoor, "type" | "x" | "y">): number {
  if (edge.type === "vertical") {
    const x = edge.x * GRID_CELL_SIZE;
    const minY = edge.y * GRID_CELL_SIZE;
    const maxY = (edge.y + 1) * GRID_CELL_SIZE;
    return Math.hypot(worldPoint.x - x, worldPoint.y - Math.min(maxY, Math.max(minY, worldPoint.y)));
  }

  const y = edge.y * GRID_CELL_SIZE;
  const minX = edge.x * GRID_CELL_SIZE;
  const maxX = (edge.x + 1) * GRID_CELL_SIZE;
  return Math.hypot(worldPoint.x - Math.min(maxX, Math.max(minX, worldPoint.x)), worldPoint.y - y);
}
