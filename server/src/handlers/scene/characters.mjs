import { syncClientIdentityForToken } from "../../clients/identity.mjs";
import { normalizeTokenAvatarFields } from "../../normalization/images.mjs";
import { normalizeCharacterStatCategories, normalizeCharacterBackgroundEntries, normalizeSceneCharacter, normalizeTokenName, statCategoriesStructureMatches } from "../../normalization/tokens.mjs";
import { broadcastScenePatch } from "../../scene/broadcast.mjs";
import { syncTokenFromCharacter } from "../../scene/sync.mjs";
import { sceneBackpackItems, sceneCharacters, sceneTokens } from "../../state/index.mjs";

function broadcastCharacterUpdate(character) {
  syncTokenFromCharacter(character);
  syncClientIdentityForToken(character);

  const patch = { characterUpserts: [{ ...character }] };
  const token = sceneTokens.find((candidate) => candidate.id === character.id);
  if (token) {
    patch.tokenUpserts = [{ ...token, cell: { ...token.cell } }];
  }

  broadcastScenePatch(patch);
}

export function handleSceneCharacterAdd(client, message) {
  if (client.identity.type !== "admin") {
    return;
  }

  const character = normalizeSceneCharacter(message.character);
  if (!character || sceneCharacters.some((candidate) => candidate.id === character.id)) {
    return;
  }

  sceneCharacters.push(character);
  client.lastSeenAt = Date.now();
  broadcastScenePatch({ characterUpserts: [{ ...character }] });
}

export function handleSceneCharacterUpdate(client, message) {
  const incomingCharacter = message.character;
  if (!incomingCharacter || typeof incomingCharacter !== "object") {
    return;
  }

  const character = sceneCharacters.find((candidate) => candidate.id === String(incomingCharacter.id ?? ""));
  const name = normalizeTokenName(incomingCharacter.name);
  const isAdmin = client.identity.type === "admin";
  if (!character || !name || (!isAdmin && client.identity.id !== character.id)) {
    return;
  }

  character.name = name;
  Object.assign(character, normalizeTokenAvatarFields(incomingCharacter));
  if (isAdmin) {
    character.isNpc = incomingCharacter.isNpc === true;
  }
  client.lastSeenAt = Date.now();
  broadcastCharacterUpdate(character);
}

export function handleSceneCharacterStatsUpdate(client, message) {
  if (client.identity.type !== "admin") {
    return;
  }

  const characterId = String(message.characterId ?? "");
  const character = sceneCharacters.find((candidate) => candidate.id === characterId);
  if (!character) {
    return;
  }

  const scope = message.scope === "values" ? "values" : "structure";
  const existingCategories = character.statCategories ?? [];

  if (scope === "values") {
    const incomingCategories = normalizeCharacterStatCategories(message.statCategories);
    if (!statCategoriesStructureMatches(existingCategories, incomingCategories)) {
      return;
    }

    if (incomingCategories.length > 0) {
      character.statCategories = incomingCategories;
    } else {
      delete character.statCategories;
    }
  } else {
    const incomingCategories = normalizeCharacterStatCategories(message.statCategories);
    if (incomingCategories.length > 0) {
      character.statCategories = incomingCategories;
    } else {
      delete character.statCategories;
    }
  }

  client.lastSeenAt = Date.now();
  broadcastCharacterUpdate(character);
}

export function handleSceneCharacterBackgroundUpdate(client, message) {
  if (client.identity.type !== "admin") {
    return;
  }

  const characterId = String(message.characterId ?? "");
  const character = sceneCharacters.find((candidate) => candidate.id === characterId);
  if (!character) {
    return;
  }

  const incomingEntries = normalizeCharacterBackgroundEntries(message.backgroundEntries);
  if (incomingEntries.length > 0) {
    character.backgroundEntries = incomingEntries;
  } else {
    delete character.backgroundEntries;
  }

  client.lastSeenAt = Date.now();
  broadcastCharacterUpdate(character);
}

export function handleSceneCharacterDelete(client, message) {
  if (client.identity.type !== "admin") {
    return;
  }

  const characterId = String(message.characterId ?? "");
  const characterIndex = sceneCharacters.findIndex((candidate) => candidate.id === characterId);
  if (characterIndex === -1) {
    return;
  }

  sceneCharacters.splice(characterIndex, 1);
  const tokenIndex = sceneTokens.findIndex((candidate) => candidate.id === characterId);
  if (tokenIndex !== -1) {
    sceneTokens.splice(tokenIndex, 1);
  }
  const deletedBackpackItemIds = sceneBackpackItems
    .filter((item) => item.characterId === characterId)
    .map((item) => item.id);
  for (let index = sceneBackpackItems.length - 1; index >= 0; index -= 1) {
    if (sceneBackpackItems[index].characterId === characterId) {
      sceneBackpackItems.splice(index, 1);
    }
  }
  client.lastSeenAt = Date.now();

  const patch = { characterDeletes: [characterId] };
  if (tokenIndex !== -1) {
    patch.tokenDeletes = [characterId];
  }
  if (deletedBackpackItemIds.length > 0) {
    patch.backpackItemDeletes = deletedBackpackItemIds;
  }

  broadcastScenePatch(patch);
}
