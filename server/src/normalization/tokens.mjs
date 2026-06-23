import { isFiniteCell } from "../lib/utils.mjs";
import { normalizeSceneCharacter } from "./characters.mjs";

export function normalizeSceneToken(token) {
  if (!token || typeof token !== "object" || !isFiniteCell(token.cell)) {
    return null;
  }

  const character = normalizeSceneCharacter(token);
  if (!character) {
    return null;
  }

  return {
    ...character,
    cell: {
      x: token.cell.x,
      y: token.cell.y,
    },
  };
}

export { normalizeSceneCharacter, normalizeTokenName } from "./characters.mjs";
