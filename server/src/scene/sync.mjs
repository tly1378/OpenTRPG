import {
  blockedHorizontalEdges,
  blockedVerticalEdges,
  sceneCharacters,
  sceneDoors,
  sceneImages,
  sceneItemDefinitions,
  sceneItemInstances,
  sceneRooms,
  sceneTokens,
} from "../state/index.mjs";

export function upsertSceneCharacter(character) {
  const existingCharacterIndex = sceneCharacters.findIndex((candidate) => candidate.id === character.id);
  if (existingCharacterIndex === -1) {
    sceneCharacters.push(character);
  } else {
    sceneCharacters[existingCharacterIndex] = character;
  }
}

export function syncTokenFromCharacter(character) {
  const token = sceneTokens.find((candidate) => candidate.id === character.id);
  if (!token) {
    return;
  }

  Object.assign(token, character, { cell: token.cell });
}

export function syncCharacterFromToken(token) {
  const { cell: _cell, ...character } = token;
  upsertSceneCharacter(character);
}

export function isCellOccupied(cell, exceptTokenId) {
  return sceneTokens.some(
    (token) =>
      token.id !== exceptTokenId &&
      token.cell.x === cell.x &&
      token.cell.y === cell.y,
  );
}

export function sceneSnapshotPayload(serverTime = Date.now()) {
  return {
    type: "scene:snapshot",
    images: sceneImages,
    characters: sceneCharacters,
    tokens: sceneTokens,
    itemDefinitions: sceneItemDefinitions,
    itemInstances: sceneItemInstances,
    blockedVerticalEdges: [...blockedVerticalEdges],
    blockedHorizontalEdges: [...blockedHorizontalEdges],
    doors: [...sceneDoors.values()],
    rooms: [...sceneRooms.values()],
    serverTime,
  };
}

export function characterFromToken(token) {
  const { cell: _cell, ...character } = token;
  return character;
}

export function allImageSnapshots() {
  return sceneImages.map((image) => ({ ...image }));
}
