import type { Cell, Identity, MovingToken, SceneCharacter, SceneToken } from "../core/types";
import { occupiedByToken as isCellOccupiedByToken } from "../modules/grid/grid";
import { createSceneCharacter, createSceneToken } from "../modules/scene/sceneActions";

export class CharacterTokenController {
  constructor(
    private readonly state: {
      sceneCharacters: SceneCharacter[];
      sceneTokens: SceneToken[];
      pendingTokenNames: Map<string, string>;
      getMovingTokens: () => MovingToken[];
      setMovingTokens: (movingTokens: MovingToken[]) => void;
      getSelectedTokenId: () => string | null;
      setSelectedTokenId: (tokenId: string | null) => void;
      getInspectedCharacterId: () => string | null;
      setInspectedCharacterId: (characterId: string | null) => void;
      getCurrentIdentity: () => Identity | null;
      setCurrentIdentity: (identity: Identity | null) => void;
      getNextTokenIndex: () => number;
      setNextTokenIndex: (nextIndex: number) => void;
      setTokenNameEditing: (editing: boolean) => void;
    },
    private readonly queries: {
      isAdmin: () => boolean;
      canControlToken: (token: SceneCharacter) => boolean;
      getInspectedCharacter: () => SceneCharacter | null;
    },
    private readonly elements: {
      tokenNameInput: HTMLInputElement;
    },
    private readonly actions: {
      renderIdentityList: () => void;
      renderCharacterPanel: () => void;
      openTokenInspector: (characterId: string) => void;
      updateTokenInspector: () => void;
      updateSelectionPanel: () => void;
      updateIdentityBadge: (identity: Identity) => void;
    },
    private readonly network: {
      updateIdentity: (identity: Identity) => void;
      sendCharacterAdded: (character: SceneCharacter) => void;
      sendCharacterUpdated: (character: SceneCharacter) => void;
      sendCharacterDeleted: (characterId: string) => void;
      sendTokenAdded: (token: SceneToken) => void;
      sendTokenDeleted: (tokenId: string) => void;
    },
  ) {}

  addCharacter(): void {
    const tokenIndex = this.state.getNextTokenIndex();
    this.state.setNextTokenIndex(tokenIndex + 1);
    const character = createSceneCharacter(tokenIndex);

    this.state.sceneCharacters.push(character);
    this.actions.renderIdentityList();
    this.actions.renderCharacterPanel();
    this.actions.openTokenInspector(character.id);
    this.network.sendCharacterAdded(character);
  }

  placeCharacterAtCell(characterId: string, cell: Cell): void {
    if (
      !this.queries.isAdmin() ||
      isCellOccupiedByToken(cell, this.state.sceneTokens) ||
      this.state.sceneTokens.some((token) => token.id === characterId)
    ) {
      return;
    }

    const character = this.state.sceneCharacters.find((candidate) => candidate.id === characterId);
    if (!character) {
      return;
    }

    const token = createSceneToken(character, cell);
    this.state.sceneTokens.push(token);
    this.state.setSelectedTokenId(token.id);
    this.actions.renderCharacterPanel();
    this.actions.updateTokenInspector();
    this.network.sendTokenAdded(token);
  }

  addTokenAtCell(cell: Cell): void {
    if (isCellOccupiedByToken(cell, this.state.sceneTokens)) {
      return;
    }

    const tokenIndex = this.state.getNextTokenIndex();
    this.state.setNextTokenIndex(tokenIndex + 1);
    const character = createSceneCharacter(tokenIndex);
    const token = createSceneToken(character, cell);

    this.state.sceneCharacters.push(character);
    this.state.sceneTokens.push(token);
    this.actions.renderIdentityList();
    this.actions.renderCharacterPanel();
    this.actions.openTokenInspector(token.id);
    this.network.sendCharacterAdded(character);
    this.network.sendTokenAdded(token);
  }

  deleteToken(tokenId: string): void {
    const tokenIndex = this.state.sceneTokens.findIndex((token) => token.id === tokenId);
    if (tokenIndex === -1) {
      return;
    }

    this.state.sceneTokens.splice(tokenIndex, 1);
    this.state.pendingTokenNames.delete(tokenId);
    this.state.setMovingTokens(this.state.getMovingTokens().filter((animation) => animation.tokenId !== tokenId));
    if (this.state.getSelectedTokenId() === tokenId) {
      this.state.setSelectedTokenId(null);
    }
    this.actions.renderCharacterPanel();
    this.actions.updateTokenInspector();
    this.actions.updateSelectionPanel();
    this.network.sendTokenDeleted(tokenId);
  }

  deleteCharacter(characterId: string): void {
    if (!this.queries.isAdmin()) {
      return;
    }

    const characterIndex = this.state.sceneCharacters.findIndex((character) => character.id === characterId);
    if (characterIndex === -1) {
      return;
    }

    this.state.sceneCharacters.splice(characterIndex, 1);
    const tokenIndex = this.state.sceneTokens.findIndex((token) => token.id === characterId);
    if (tokenIndex !== -1) {
      this.state.sceneTokens.splice(tokenIndex, 1);
    }
    this.state.pendingTokenNames.delete(characterId);
    this.state.setMovingTokens(this.state.getMovingTokens().filter((animation) => animation.tokenId !== characterId));
    if (this.state.getSelectedTokenId() === characterId) {
      this.state.setSelectedTokenId(null);
    }
    if (this.state.getInspectedCharacterId() === characterId) {
      this.state.setInspectedCharacterId(null);
      this.state.setTokenNameEditing(false);
    }
    this.actions.renderIdentityList();
    this.actions.renderCharacterPanel();
    this.actions.updateTokenInspector();
    this.actions.updateSelectionPanel();
    this.network.sendCharacterDeleted(characterId);
  }

  updateSelectedTokenName(name: string): void {
    const token = this.queries.getInspectedCharacter();
    const normalizedName = name.trim();
    if (!token || !this.queries.canControlToken(token) || normalizedName.length === 0 || token.name === normalizedName) {
      return;
    }

    token.name = normalizedName.slice(0, 24);

    const currentIdentity = this.state.getCurrentIdentity();
    if (currentIdentity?.type === "player" && currentIdentity.id === token.id) {
      const nextIdentity = { ...currentIdentity, name: token.name };
      this.state.setCurrentIdentity(nextIdentity);
      this.network.updateIdentity(nextIdentity);
      this.actions.updateIdentityBadge(nextIdentity);
    }

    this.actions.renderIdentityList();
    this.actions.renderCharacterPanel();
    this.syncTokenInstanceFromCharacter(token);
    this.actions.updateTokenInspector();
    this.sendTokenNameUpdate(token);
  }

  startTokenNameEditing(): void {
    const token = this.queries.getInspectedCharacter();
    if (!token || !this.queries.canControlToken(token)) {
      return;
    }

    this.state.setTokenNameEditing(true);
    this.actions.updateTokenInspector();
    this.elements.tokenNameInput.focus();
    this.elements.tokenNameInput.select();
  }

  stopTokenNameEditing(): void {
    this.updateSelectedTokenName(this.elements.tokenNameInput.value);
    this.state.setTokenNameEditing(false);
    this.actions.updateTokenInspector();
  }

  updateTokenAvatar(token: SceneCharacter): void {
    this.syncTokenInstanceFromCharacter(token);
    this.actions.renderCharacterPanel();
    this.actions.updateTokenInspector();
    this.network.sendCharacterUpdated(token);
  }

  private syncTokenInstanceFromCharacter(character: SceneCharacter): void {
    const token = this.state.sceneTokens.find((candidate) => candidate.id === character.id);
    if (!token) {
      return;
    }

    Object.assign(token, character, { cell: token.cell });
  }

  private sendTokenNameUpdate(character: SceneCharacter): void {
    this.state.pendingTokenNames.set(character.id, character.name);
    this.network.sendCharacterUpdated(character);
  }
}
