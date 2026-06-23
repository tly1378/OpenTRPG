import { normalizeBlockedEdge } from "./edges.mjs";

export function normalizeSceneDoor(door) {
  const edge = normalizeBlockedEdge(door);
  if (!edge || typeof door.isOpen !== "boolean") {
    return null;
  }

  return {
    type: edge.type,
    x: edge.x,
    y: edge.y,
    isOpen: door.isOpen,
  };
}
