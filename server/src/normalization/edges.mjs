import { blockedHorizontalEdges, blockedVerticalEdges } from "../state/index.mjs";
import { isFiniteCell } from "../lib/utils.mjs";

export function normalizeBlockedEdge(edge) {
  if (!edge || typeof edge !== "object") {
    return null;
  }

  const type = edge.type === "vertical" ? "vertical" : edge.type === "horizontal" ? "horizontal" : null;
  if (!type || !Number.isFinite(edge.x) || !Number.isFinite(edge.y)) {
    return null;
  }

  return {
    type,
    x: edge.x,
    y: edge.y,
    key: `${edge.x},${edge.y}`,
  };
}

export function doorKey(door) {
  return `${door.type}:${door.x},${door.y}`;
}

export function blockedEdgeSet(type) {
  return type === "vertical" ? blockedVerticalEdges : blockedHorizontalEdges;
}

export { isFiniteCell };
