import { TOKEN_STEP_ANIMATION_MS } from "../core/constants";
import type {
  Identity,
  MovingToken,
  SceneCharacter,
  SceneDoor,
  SceneImage,
  SceneImageSnapshot,
  SceneItemDefinition,
  SceneItemInstance,
  SceneRoom,
  SceneToken,
} from "../core/types";
import { findPath as findGridPath, movementBlockedEdgeSets as buildMovementBlockedEdgeSets, sameCell } from "../modules/grid/grid";
import { doorId } from "../modules/grid/logicMapUtils";
import { loadImageSource } from "../modules/image/imageImport";
import type { ScenePatch, SceneSnapshot } from "./networkClient";

type TokenAvatarImage = { src: string; image: HTMLImageElement };

export type SceneSyncApplierContext = {
  sceneImages: SceneImage[];
  sceneCharacters: SceneCharacter[];
  sceneTokens: SceneToken[];
  sceneItemDefinitions: SceneItemDefinition[];
  sceneItemInstances: SceneItemInstance[];
  tokenAvatarImages: Map<string, TokenAvatarImage>;
  itemIconImages: Map<string, TokenAvatarImage>;
  blockedVerticalEdges: Set<string>;
  blockedHorizontalEdges: Set<string>;
  sceneDoors: Map<string, SceneDoor>;
  sceneRooms: SceneRoom[];
  pendingTokenNames: Map<string, string>;
  getMovingTokens: () => MovingToken[];
  setMovingTokens: (movingTokens: MovingToken[]) => void;
  getSelectedImageId: () => string | null;
  setSelectedImageId: (imageId: string | null) => void;
  getSelectedTokenId: () => string | null;
  setSelectedTokenId: (tokenId: string | null) => void;
  getInspectedCharacterId: () => string | null;
  setInspectedCharacterId: (characterId: string | null) => void;
  getInspectedItemDefinitionId: () => string | null;
  setInspectedItemDefinitionId: (definitionId: string | null) => void;
  getInspectedItemInstanceId: () => string | null;
  setInspectedItemInstanceId: (instanceId: string | null) => void;
  getSelectedItemInstanceId: () => string | null;
  setSelectedItemInstanceId: (instanceId: string | null) => void;
  getSelectedDoorId: () => string | null;
  setSelectedDoorId: (doorId: string | null) => void;
  getSelectedRoomId: () => string | null;
  setSelectedRoomId: (roomId: string | null) => void;
  getCurrentIdentity: () => Identity | null;
  setCurrentIdentity: (identity: Identity | null) => void;
  setNextTokenIndex: (nextIndex: number) => void;
  setNextItemIndex: (nextIndex: number) => void;
  clearTokenNameEditing: () => void;
  clearItemNameEditing: () => void;
  clearItemDescriptionEditing: () => void;
  clearPreviewState: () => void;
  updateNetworkIdentity: (identity: Identity) => void;
  updateIdentityBadge: (identity: Identity) => void;
  renderIdentityList: () => void;
  renderCharacterPanel: () => void;
  renderItemPanel: () => void;
  updateTokenInspector: () => void;
  updateItemDefinitionInspector: () => void;
  updateItemInstanceInspector: () => void;
  updateSelectionPanel: () => void;
  showIdentityScreen: () => void;
};

export function sceneImageSnapshot(image: SceneImage): SceneImageSnapshot {
  const { image: _imageElement, ...snapshot } = image;
  return snapshot;
}

export function sceneImageSnapshots(images: SceneImage[]): SceneImageSnapshot[] {
  return images.map(sceneImageSnapshot);
}

export function createSceneSyncApplier(context: SceneSyncApplierContext) {
  let imageSyncVersion = 0;

  async function syncImages(snapshots: SceneImageSnapshot[], replaceAll: boolean): Promise<void> {
    const version = ++imageSyncVersion;
    const existingById = new Map(context.sceneImages.map((image) => [image.id, image]));
    const nextImages: SceneImage[] = replaceAll ? [] : [...context.sceneImages];

    for (const snapshot of snapshots) {
      const existing = existingById.get(snapshot.id);
      if (existing?.src === snapshot.src) {
        Object.assign(existing, snapshot);
        if (!replaceAll && !nextImages.includes(existing)) {
          nextImages.push(existing);
        }
        continue;
      }

      try {
        const imageElement = await loadImageSource(snapshot.src, snapshot.name);
        const nextImage: SceneImage = { ...snapshot, image: imageElement };
        const index = nextImages.findIndex((image) => image.id === snapshot.id);
        if (index === -1) {
          nextImages.push(nextImage);
        } else {
          nextImages[index] = nextImage;
        }
      } catch (error) {
        console.error(error);
      }
    }

    if (version !== imageSyncVersion) {
      return;
    }

    nextImages.sort((a, b) => a.z - b.z);
    context.sceneImages.splice(0, context.sceneImages.length, ...nextImages);

    if (context.getSelectedImageId() && !context.sceneImages.some((image) => image.id === context.getSelectedImageId())) {
      context.setSelectedImageId(null);
    }

    context.updateSelectionPanel();
  }

  function finalize(previousTokens: Map<string, SceneToken>, changedTokens: SceneToken[], shouldExitDeletedIdentity: boolean): void {
    syncTokenAvatarImages(context.sceneCharacters, context.tokenAvatarImages);
    syncItemIconImages(context.sceneItemDefinitions, context.itemIconImages);
    context.setNextTokenIndex(nextAvailableTokenIndex(context.sceneCharacters));
    context.setNextItemIndex(nextAvailableItemIndex(context.sceneItemDefinitions));

    const animations = buildRemoteMoveAnimations({
      nextTokens: changedTokens,
      previousTokens,
      sceneTokens: context.sceneTokens,
      blockedVerticalEdges: context.blockedVerticalEdges,
      blockedHorizontalEdges: context.blockedHorizontalEdges,
      doors: context.sceneDoors.values(),
      movingTokens: context.getMovingTokens(),
    });

    clearDeletedSelections(context);
    syncCurrentPlayerIdentity(context);
    context.setMovingTokens([
      ...context.getMovingTokens().filter((animation) => context.sceneTokens.some((token) => token.id === animation.tokenId)),
      ...animations,
    ]);
    context.clearPreviewState();
    context.renderIdentityList();
    context.renderCharacterPanel();
    context.renderItemPanel();
    context.updateTokenInspector();
    context.updateItemDefinitionInspector();
    context.updateItemInstanceInspector();
    context.updateSelectionPanel();

    if (shouldExitDeletedIdentity) {
      context.showIdentityScreen();
    }
  }

  function applySnapshot(snapshot: SceneSnapshot): void {
    void syncImages(snapshot.images, true);

    const previousTokens = new Map(context.sceneTokens.map((token) => [token.id, token]));
    const nextTokens = snapshot.tokens.map((token) => ({ ...token, cell: { ...token.cell } }));
    const nextCharacters = snapshot.characters.map((character) => ({ ...character }));
    const nextItemDefinitions = snapshot.itemDefinitions.map((definition) => ({ ...definition }));
    const nextItemInstances = snapshot.itemInstances.map((instance) => ({ ...instance, cell: { ...instance.cell } }));

    applyPendingTokenNames(nextCharacters, context.pendingTokenNames);
    syncTokenFieldsFromCharacters(nextTokens, nextCharacters);

    context.sceneCharacters.splice(0, context.sceneCharacters.length, ...nextCharacters);
    context.sceneTokens.splice(0, context.sceneTokens.length, ...nextTokens);
    context.sceneItemDefinitions.splice(0, context.sceneItemDefinitions.length, ...nextItemDefinitions);
    context.sceneItemInstances.splice(0, context.sceneItemInstances.length, ...nextItemInstances);
    replaceSet(context.blockedVerticalEdges, snapshot.blockedVerticalEdges);
    replaceSet(context.blockedHorizontalEdges, snapshot.blockedHorizontalEdges);
    context.sceneDoors.clear();
    for (const door of snapshot.doors) {
      context.sceneDoors.set(doorId(door), { ...door });
    }
    context.sceneRooms.splice(
      0,
      context.sceneRooms.length,
      ...snapshot.rooms.map((room) => ({ ...room, cells: room.cells.map((cell) => ({ ...cell })) })),
    );

    const identity = context.getCurrentIdentity();
    finalize(
      previousTokens,
      nextTokens,
      identity?.type === "player" && !nextCharacters.some((character) => character.id === identity.id && !character.isNpc),
    );
  }

  function applyPatch(patch: ScenePatch): void {
    const previousTokens = new Map(context.sceneTokens.map((token) => [token.id, { ...token, cell: { ...token.cell } }]));
    const changedTokens: SceneToken[] = [];

    for (const imageId of patch.imageDeletes ?? []) {
      removeById(context.sceneImages, imageId);
    }
    if (patch.imageUpserts?.length) {
      void syncImages(patch.imageUpserts, false);
    }

    for (const characterId of patch.characterDeletes ?? []) {
      removeById(context.sceneCharacters, characterId);
    }
    for (const character of patch.characterUpserts ?? []) {
      upsertById(context.sceneCharacters, { ...character });
    }
    if (patch.characterUpserts?.length) {
      applyPendingTokenNames(context.sceneCharacters, context.pendingTokenNames);
    }

    for (const tokenId of patch.tokenDeletes ?? []) {
      removeById(context.sceneTokens, tokenId);
    }
    for (const token of patch.tokenUpserts ?? []) {
      const nextToken = { ...token, cell: { ...token.cell } };
      upsertById(context.sceneTokens, nextToken);
      changedTokens.push(nextToken);
    }
    if (patch.tokenUpserts?.length) {
      syncTokenFieldsFromCharacters(context.sceneTokens, context.sceneCharacters);
    }

    for (const definitionId of patch.itemDefinitionDeletes ?? []) {
      removeById(context.sceneItemDefinitions, definitionId);
    }
    for (const definition of patch.itemDefinitionUpserts ?? []) {
      upsertById(context.sceneItemDefinitions, { ...definition });
    }

    for (const instanceId of patch.itemInstanceDeletes ?? []) {
      removeById(context.sceneItemInstances, instanceId);
    }
    for (const instance of patch.itemInstanceUpserts ?? []) {
      upsertById(context.sceneItemInstances, { ...instance, cell: { ...instance.cell } });
    }

    if (patch.blockedEdgesClear) {
      context.blockedVerticalEdges.clear();
      context.blockedHorizontalEdges.clear();
      context.sceneDoors.clear();
    }
    applyEdgeChanges(context.blockedVerticalEdges, patch.blockedVerticalEdges);
    applyEdgeChanges(context.blockedHorizontalEdges, patch.blockedHorizontalEdges);

    for (const edge of patch.doorDeletes ?? []) {
      context.sceneDoors.delete(doorId(edge));
    }
    for (const door of patch.doorUpserts ?? []) {
      context.sceneDoors.set(doorId(door), { ...door });
    }

    for (const roomId of patch.roomDeletes ?? []) {
      removeById(context.sceneRooms, roomId);
    }
    for (const room of patch.roomUpserts ?? []) {
      upsertById(context.sceneRooms, { ...room, cells: room.cells.map((cell) => ({ ...cell })) });
    }

    const identity = context.getCurrentIdentity();
    finalize(
      previousTokens,
      changedTokens,
      Boolean(patch.characterDeletes?.includes(identity?.id ?? "") && identity?.type === "player"),
    );
  }

  return { applySnapshot, applyPatch };
}

function upsertById<T extends { id: string }>(items: T[], item: T): void {
  const index = items.findIndex((candidate) => candidate.id === item.id);
  if (index === -1) {
    items.push(item);
  } else {
    items[index] = item;
  }
}

function removeById<T extends { id: string }>(items: T[], id: string): void {
  const index = items.findIndex((candidate) => candidate.id === id);
  if (index !== -1) {
    items.splice(index, 1);
  }
}

function applyEdgeChanges(target: Set<string>, changes: { key: string; blocked: boolean }[] | undefined): void {
  for (const change of changes ?? []) {
    if (change.blocked) {
      target.add(change.key);
    } else {
      target.delete(change.key);
    }
  }
}

function applyPendingTokenNames(characters: SceneCharacter[], pendingTokenNames: Map<string, string>): void {
  for (const character of characters) {
    const pendingName = pendingTokenNames.get(character.id);
    if (!pendingName) {
      continue;
    }

    if (character.name === pendingName) {
      pendingTokenNames.delete(character.id);
    } else {
      character.name = pendingName;
    }
  }

  const characterIds = new Set(characters.map((character) => character.id));
  for (const characterId of pendingTokenNames.keys()) {
    if (!characterIds.has(characterId)) {
      pendingTokenNames.delete(characterId);
    }
  }
}

function syncTokenFieldsFromCharacters(tokens: SceneToken[], characters: SceneCharacter[]): void {
  const charactersById = new Map(characters.map((character) => [character.id, character]));
  for (const token of tokens) {
    const character = charactersById.get(token.id);
    if (character) {
      Object.assign(token, character, { cell: token.cell });
    }
  }
}

function buildRemoteMoveAnimations(options: {
  nextTokens: SceneToken[];
  previousTokens: Map<string, SceneToken>;
  sceneTokens: SceneToken[];
  blockedVerticalEdges: Set<string>;
  blockedHorizontalEdges: Set<string>;
  doors: Iterable<SceneDoor>;
  movingTokens: MovingToken[];
}): MovingToken[] {
  const startedAt = performance.now();
  const animations: MovingToken[] = [];
  const movementBlockedEdges = buildMovementBlockedEdgeSets(options.blockedVerticalEdges, options.blockedHorizontalEdges, options.doors);

  for (const token of options.nextTokens) {
    const previousToken = options.previousTokens.get(token.id);
    const isAnimating = options.movingTokens.some((animation) => animation.tokenId === token.id);
    if (!previousToken || sameCell(previousToken.cell, token.cell) || isAnimating) {
      continue;
    }

    const path = findGridPath(
      previousToken.cell,
      token.cell,
      token.id,
      options.sceneTokens,
      movementBlockedEdges.vertical,
      movementBlockedEdges.horizontal,
    );
    const animationPath = path.length > 1 ? path : [previousToken.cell, token.cell];

    animations.push({
      tokenId: token.id,
      path: animationPath.map((cell) => ({ ...cell })),
      startedAt,
      duration: Math.max(1, animationPath.length - 1) * TOKEN_STEP_ANIMATION_MS,
    });
  }

  return animations;
}

function syncTokenAvatarImages(characters: SceneCharacter[], tokenAvatarImages: Map<string, TokenAvatarImage>): void {
  const activeCharacterIds = new Set(characters.map((character) => character.id));
  for (const characterId of tokenAvatarImages.keys()) {
    const character = characters.find((candidate) => candidate.id === characterId);
    if (!activeCharacterIds.has(characterId) || !character?.avatarSrc) {
      tokenAvatarImages.delete(characterId);
    }
  }

  for (const character of characters) {
    const avatarSrc = character.avatarSrc;
    if (!avatarSrc || tokenAvatarImages.get(character.id)?.src === avatarSrc) {
      continue;
    }

    void loadImageSource(avatarSrc, `${character.name} 头像`)
      .then((image) => {
        if (characters.some((candidate) => candidate.id === character.id && candidate.avatarSrc === avatarSrc)) {
          tokenAvatarImages.set(character.id, { src: avatarSrc, image });
        }
      })
      .catch((error: unknown) => {
        console.error(error);
      });
  }
}

function replaceSet(target: Set<string>, values: string[]): void {
  target.clear();
  for (const value of values) {
    target.add(value);
  }
}

function nextAvailableTokenIndex(characters: SceneCharacter[]): number {
  const maxTokenIndex = characters.reduce((maxIndex, character) => {
    const match = /^P(\d+)$/.exec(character.name);
    return match ? Math.max(maxIndex, Number.parseInt(match[1], 10)) : maxIndex;
  }, 0);

  return maxTokenIndex + 1;
}

function syncItemIconImages(definitions: SceneItemDefinition[], itemIconImages: Map<string, TokenAvatarImage>): void {
  const activeDefinitionIds = new Set(definitions.map((definition) => definition.id));
  for (const definitionId of itemIconImages.keys()) {
    const definition = definitions.find((candidate) => candidate.id === definitionId);
    if (!activeDefinitionIds.has(definitionId) || !definition?.iconSrc) {
      itemIconImages.delete(definitionId);
    }
  }

  for (const definition of definitions) {
    const iconSrc = definition.iconSrc;
    if (!iconSrc || itemIconImages.get(definition.id)?.src === iconSrc) {
      continue;
    }

    void loadImageSource(iconSrc, `${definition.name} 图标`)
      .then((image) => {
        if (definitions.some((candidate) => candidate.id === definition.id && candidate.iconSrc === iconSrc)) {
          itemIconImages.set(definition.id, { src: iconSrc, image });
        }
      })
      .catch((error: unknown) => {
        console.error(error);
      });
  }
}

function nextAvailableItemIndex(definitions: SceneItemDefinition[]): number {
  const maxItemIndex = definitions.reduce((maxIndex, definition) => {
    const match = /^物品(\d+)$/.exec(definition.name);
    return match ? Math.max(maxIndex, Number.parseInt(match[1], 10)) : maxIndex;
  }, 0);

  return maxItemIndex + 1;
}

function clearDeletedSelections(context: Pick<
  SceneSyncApplierContext,
  | "sceneTokens"
  | "sceneCharacters"
  | "sceneItemDefinitions"
  | "sceneItemInstances"
  | "sceneDoors"
  | "sceneRooms"
  | "getSelectedTokenId"
  | "setSelectedTokenId"
  | "getInspectedCharacterId"
  | "setInspectedCharacterId"
  | "getInspectedItemDefinitionId"
  | "setInspectedItemDefinitionId"
  | "getInspectedItemInstanceId"
  | "setInspectedItemInstanceId"
  | "getSelectedItemInstanceId"
  | "setSelectedItemInstanceId"
  | "getSelectedDoorId"
  | "setSelectedDoorId"
  | "getSelectedRoomId"
  | "setSelectedRoomId"
  | "clearTokenNameEditing"
  | "clearItemNameEditing"
  | "clearItemDescriptionEditing"
>): void {
  if (context.getSelectedTokenId() && !context.sceneTokens.some((token) => token.id === context.getSelectedTokenId())) {
    context.setSelectedTokenId(null);
  }

  if (context.getInspectedCharacterId() && !context.sceneCharacters.some((character) => character.id === context.getInspectedCharacterId())) {
    context.setInspectedCharacterId(null);
    context.clearTokenNameEditing();
  }

  if (
    context.getInspectedItemDefinitionId() &&
    !context.sceneItemDefinitions.some((definition) => definition.id === context.getInspectedItemDefinitionId())
  ) {
    context.setInspectedItemDefinitionId(null);
    context.clearItemNameEditing();
    context.clearItemDescriptionEditing();
  }

  if (
    context.getInspectedItemInstanceId() &&
    !context.sceneItemInstances.some((instance) => instance.id === context.getInspectedItemInstanceId())
  ) {
    context.setInspectedItemInstanceId(null);
  }

  if (
    context.getSelectedItemInstanceId() &&
    !context.sceneItemInstances.some((instance) => instance.id === context.getSelectedItemInstanceId())
  ) {
    context.setSelectedItemInstanceId(null);
  }

  if (context.getSelectedDoorId() && !context.sceneDoors.has(context.getSelectedDoorId() ?? "")) {
    context.setSelectedDoorId(null);
  }

  if (context.getSelectedRoomId() && !context.sceneRooms.some((room) => room.id === context.getSelectedRoomId())) {
    context.setSelectedRoomId(null);
  }
}

function syncCurrentPlayerIdentity(context: Pick<
  SceneSyncApplierContext,
  "sceneCharacters" | "getCurrentIdentity" | "setCurrentIdentity" | "updateNetworkIdentity" | "updateIdentityBadge"
>): void {
  const currentIdentity = context.getCurrentIdentity();
  if (currentIdentity?.type !== "player") {
    return;
  }

  const currentCharacter = context.sceneCharacters.find((character) => character.id === currentIdentity.id);
  if (currentCharacter && currentIdentity.name !== currentCharacter.name) {
    const nextIdentity = { ...currentIdentity, name: currentCharacter.name };
    context.setCurrentIdentity(nextIdentity);
    context.updateNetworkIdentity(nextIdentity);
    context.updateIdentityBadge(nextIdentity);
  }
}
