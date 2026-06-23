import { TOKEN_STEP_ANIMATION_MS } from "../core/constants";
import type {
  Identity,
  MovingToken,
  SceneCharacter,
  SceneDoor,
  SceneImage,
  SceneImageSnapshot,
  SceneRoom,
  SceneToken,
} from "../core/types";
import { findPath as findGridPath, movementBlockedEdgeSets as buildMovementBlockedEdgeSets, sameCell } from "../modules/grid/grid";
import { doorId } from "../modules/grid/logicMapUtils";
import { loadImageSource } from "../modules/image/imageImport";
import type { SceneSnapshot } from "./networkClient";

type TokenAvatarImage = {
  src: string;
  image: HTMLImageElement;
};

export function sceneImageSnapshot(image: SceneImage): SceneImageSnapshot {
  const { image: _imageElement, ...snapshot } = image;
  return { ...snapshot };
}

export function sceneImageSnapshots(images: SceneImage[]): SceneImageSnapshot[] {
  return images.map(sceneImageSnapshot);
}

export function createSceneSnapshotApplier(context: {
  sceneImages: SceneImage[];
  sceneCharacters: SceneCharacter[];
  sceneTokens: SceneToken[];
  tokenAvatarImages: Map<string, TokenAvatarImage>;
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
  getSelectedDoorId: () => string | null;
  setSelectedDoorId: (doorId: string | null) => void;
  getSelectedRoomId: () => string | null;
  setSelectedRoomId: (roomId: string | null) => void;
  getCurrentIdentity: () => Identity | null;
  setCurrentIdentity: (identity: Identity | null) => void;
  setNextTokenIndex: (nextIndex: number) => void;
  clearTokenNameEditing: () => void;
  clearPreviewState: () => void;
  updateNetworkIdentity: (identity: Identity) => void;
  updateIdentityBadge: (identity: Identity) => void;
  renderIdentityList: () => void;
  renderCharacterPanel: () => void;
  updateTokenInspector: () => void;
  updateSelectionPanel: () => void;
  showIdentityScreen: () => void;
}): (snapshot: SceneSnapshot) => void {
  let imageSnapshotVersion = 0;

  async function applyImageSnapshots(snapshots: SceneImageSnapshot[]): Promise<void> {
    const version = ++imageSnapshotVersion;
    const existingImages = new Map(context.sceneImages.map((image) => [image.id, image]));
    const nextImages = await Promise.all(
      snapshots.map(async (snapshot): Promise<SceneImage | null> => {
        const existingImage = existingImages.get(snapshot.id);
        if (existingImage?.src === snapshot.src) {
          Object.assign(existingImage, snapshot);
          return existingImage;
        }

        try {
          const imageElement = await loadImageSource(snapshot.src, snapshot.name);
          return {
            ...snapshot,
            image: imageElement,
          };
        } catch (error) {
          console.error(error);
          return null;
        }
      }),
    );

    if (version !== imageSnapshotVersion) {
      return;
    }

    context.sceneImages.splice(0, context.sceneImages.length, ...nextImages.filter((image): image is SceneImage => image !== null));

    if (context.getSelectedImageId() && !context.sceneImages.some((image) => image.id === context.getSelectedImageId())) {
      context.setSelectedImageId(null);
    }

    context.updateSelectionPanel();
  }

  return (snapshot: SceneSnapshot): void => {
    void applyImageSnapshots(snapshot.images);

    const nextCharacters = snapshot.characters.map((character) => ({ ...character }));
    const previousTokens = new Map(context.sceneTokens.map((token) => [token.id, token]));
    const nextTokens = snapshot.tokens.map((token) => ({ ...token, cell: { ...token.cell } }));

    applyPendingTokenNames(nextCharacters, context.pendingTokenNames);
    syncTokenFieldsFromCharacters(nextTokens, nextCharacters);

    const currentIdentity = context.getCurrentIdentity();
    const shouldExitDeletedIdentity =
      currentIdentity?.type === "player" && !nextCharacters.some((character) => character.id === currentIdentity.id);
    const animations = buildRemoteMoveAnimations({
      nextTokens,
      previousTokens,
      sceneTokens: context.sceneTokens,
      blockedVerticalEdges: context.blockedVerticalEdges,
      blockedHorizontalEdges: context.blockedHorizontalEdges,
      doors: context.sceneDoors.values(),
      movingTokens: context.getMovingTokens(),
    });

    context.sceneCharacters.splice(0, context.sceneCharacters.length, ...nextCharacters);
    context.sceneTokens.splice(0, context.sceneTokens.length, ...nextTokens);
    syncTokenAvatarImages(context.sceneCharacters, context.tokenAvatarImages);
    replaceSet(context.blockedVerticalEdges, snapshot.blockedVerticalEdges);
    replaceSet(context.blockedHorizontalEdges, snapshot.blockedHorizontalEdges);
    context.sceneDoors.clear();
    for (const door of snapshot.doors) {
      context.sceneDoors.set(doorId(door), { ...door });
    }
    context.sceneRooms.splice(
      0,
      context.sceneRooms.length,
      ...snapshot.rooms.map((room) => ({
        ...room,
        cells: room.cells.map((cell) => ({ ...cell })),
      })),
    );
    context.setNextTokenIndex(nextAvailableTokenIndex(context.sceneCharacters));

    clearDeletedSelections(context);
    syncCurrentPlayerIdentity(context);
    context.setMovingTokens([
      ...context.getMovingTokens().filter((animation) => context.sceneTokens.some((token) => token.id === animation.tokenId)),
      ...animations,
    ]);

    context.clearPreviewState();
    context.renderIdentityList();
    context.renderCharacterPanel();
    context.updateTokenInspector();
    context.updateSelectionPanel();

    if (shouldExitDeletedIdentity) {
      context.showIdentityScreen();
    }
  };
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

function clearDeletedSelections(
  context: Pick<
    Parameters<typeof createSceneSnapshotApplier>[0],
    | "sceneTokens"
    | "sceneCharacters"
    | "sceneDoors"
    | "sceneRooms"
    | "getSelectedTokenId"
    | "setSelectedTokenId"
    | "getInspectedCharacterId"
    | "setInspectedCharacterId"
    | "getSelectedDoorId"
    | "setSelectedDoorId"
    | "getSelectedRoomId"
    | "setSelectedRoomId"
    | "clearTokenNameEditing"
  >,
): void {
  if (context.getSelectedTokenId() && !context.sceneTokens.some((token) => token.id === context.getSelectedTokenId())) {
    context.setSelectedTokenId(null);
  }

  if (context.getInspectedCharacterId() && !context.sceneCharacters.some((character) => character.id === context.getInspectedCharacterId())) {
    context.setInspectedCharacterId(null);
    context.clearTokenNameEditing();
  }

  if (context.getSelectedDoorId() && !context.sceneDoors.has(context.getSelectedDoorId() ?? "")) {
    context.setSelectedDoorId(null);
  }

  if (context.getSelectedRoomId() && !context.sceneRooms.some((room) => room.id === context.getSelectedRoomId())) {
    context.setSelectedRoomId(null);
  }
}

function syncCurrentPlayerIdentity(
  context: Pick<
    Parameters<typeof createSceneSnapshotApplier>[0],
    "sceneCharacters" | "getCurrentIdentity" | "setCurrentIdentity" | "updateNetworkIdentity" | "updateIdentityBadge"
  >,
): void {
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
