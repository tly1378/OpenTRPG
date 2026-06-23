import type { DiceSides } from "../core/appState";
import type { AppMode, EditMode, LogicTool, SceneItemInstance, SceneToken } from "../core/types";

export function installControlEventHandlers(options: {
  elements: {
    modeToggleOptions: HTMLButtonElement[];
    editModeSelect: HTMLSelectElement;
    wallModeButton: HTMLButtonElement;
    doorModeButton: HTMLButtonElement;
    roomModeButton: HTMLButtonElement;
    logicMapVisibilityButton: HTMLButtonElement;
    uploadInput: HTMLInputElement;
    layerUpButton: HTMLButtonElement;
    layerDownButton: HTMLButtonElement;
    layerTopButton: HTMLButtonElement;
    layerBottomButton: HTMLButtonElement;
    deleteImageButton: HTMLButtonElement;
    deleteRoomButton: HTMLButtonElement;
    diceOptionButtons: HTMLButtonElement[];
    diceAdjustButtons: HTMLButtonElement[];
    diceRollButton: HTMLButtonElement;
    diceModifierInput: HTMLInputElement;
    diceModifierDecreaseButton: HTMLButtonElement;
    diceModifierIncreaseButton: HTMLButtonElement;
    resetSizeButton: HTMLButtonElement;
    editTokenNameButton: HTMLButtonElement;
    tokenNameInput: HTMLInputElement;
    tokenSelectionForm: HTMLFormElement;
    tokenNpcTypeInput: HTMLInputElement;
    doorBlocksMovementInput: HTMLInputElement;
    roomNameInput: HTMLInputElement;
    roomSelectionForm: HTMLFormElement;
    avatarUploadInput: HTMLInputElement;
    editAvatarButton: HTMLButtonElement;
    resetAvatarAdjustmentButton: HTMLButtonElement;
    cancelAvatarEditButton: HTMLButtonElement;
    saveAvatarEditButton: HTMLButtonElement;
    switchIdentityButton: HTMLButtonElement;
    chatToggleButton: HTMLButtonElement;
    chatCloseButton: HTMLButtonElement;
    characterToggleButton: HTMLButtonElement;
    characterCloseButton: HTMLButtonElement;
    addCharacterButton: HTMLButtonElement;
    itemToggleButton: HTMLButtonElement;
    itemCloseButton: HTMLButtonElement;
    addItemButton: HTMLButtonElement;
    closeTokenInspectorButton: HTMLButtonElement;
    tokenInspectorOverlay: HTMLElement;
    deleteTokenInstanceButton: HTMLButtonElement;
    itemDefinitionInspectorOverlay: HTMLElement;
    closeItemDefinitionInspectorButton: HTMLButtonElement;
    itemDefinitionSelectionForm: HTMLFormElement;
    editItemNameButton: HTMLButtonElement;
    itemNameInput: HTMLInputElement;
    itemDescriptionInput: HTMLTextAreaElement;
    itemIconUploadInput: HTMLInputElement;
    editItemIconButton: HTMLButtonElement;
    resetItemIconAdjustmentButton: HTMLButtonElement;
    deleteItemDefinitionButton: HTMLButtonElement;
    itemInstanceInspectorOverlay: HTMLElement;
    closeItemInstanceInspectorButton: HTMLButtonElement;
    itemInstanceSelectionForm: HTMLFormElement;
    itemQuantityInput: HTMLInputElement;
    deleteItemInstanceButton: HTMLButtonElement;
  };
  state: {
    isLoggedIn: () => boolean;
    isAdmin: () => boolean;
    isEditingBlocking: () => boolean;
    isEditingRooms: () => boolean;
    isEditingBackground: () => boolean;
    isPlayMode: () => boolean;
    appMode: () => AppMode;
    logicTool: () => LogicTool;
    isLogicMapVisible: () => boolean;
    isChatPanelOpen: () => boolean;
    isCharacterPanelOpen: () => boolean;
    isItemPanelOpen: () => boolean;
    inspectedTokenInstance: () => SceneToken | null;
    inspectedItemInstance: () => SceneItemInstance | null;
    inspectedItemDefinitionId: () => string | null;
  };
  actions: {
    setAppMode: (mode: AppMode) => void;
    setEditMode: (mode: EditMode) => void;
    setLogicTool: (tool: LogicTool) => void;
    setLogicMapVisible: (visible: boolean) => void;
    handleFiles: (files: FileList | File[]) => void;
    moveLayer: (direction: "up" | "down" | "top" | "bottom") => void;
    deleteSelectedImage: () => void;
    deleteSelectedRoom: () => void;
    parseDiceButton: (button: HTMLButtonElement) => DiceSides | null;
    changeDieSelection: (sides: DiceSides, delta: number) => void;
    rollSelectedDice: () => void;
    renderDicePanel: () => void;
    changeDiceModifier: (delta: number) => void;
    resetSelectedImageSize: () => void;
    startTokenNameEditing: () => void;
    updateSelectedTokenName: (name: string) => void;
    stopTokenNameEditing: () => void;
    updateSelectedDoorState: (isOpen: boolean) => void;
    updateSelectedRoomName: (name: string) => void;
    uploadSelectedTokenAvatar: (file: File) => Promise<void>;
    editSelectedTokenAvatar: () => Promise<void>;
    resetSelectedTokenAvatarAdjustment: () => void;
    closeAvatarEditor: () => void;
    saveAvatarEditor: () => void;
    showIdentityScreen: () => void;
    setChatPanelOpen: (open: boolean) => void;
    setCharacterPanelOpen: (open: boolean) => void;
    addCharacter: () => void;
    setItemPanelOpen: (open: boolean) => void;
    addItemDefinition: () => void;
    startItemNameEditing: () => void;
    updateItemDefinitionName: (name: string) => void;
    stopItemNameEditing: () => void;
    updateItemDefinitionDescription: (description: string) => void;
    stopItemDescriptionEditing: () => void;
    uploadSelectedItemIcon: (file: File) => Promise<void>;
    editSelectedItemIcon: () => Promise<void>;
    resetSelectedItemIconAdjustment: () => void;
    closeItemDefinitionInspector: () => void;
    deleteItemDefinition: (definitionId: string) => void;
    closeItemInstanceInspector: () => void;
    updateItemInstanceQuantity: (quantity: number) => void;
    stopItemQuantityEditing: () => void;
    deleteItemInstance: (instanceId: string) => void;
    updateCharacterIsNpc: (isNpc: boolean) => void;
    closeTokenInspector: () => void;
    deleteToken: (tokenId: string) => void;
  };
}): void {
  const { elements, state, actions } = options;

  for (const option of elements.modeToggleOptions) {
    option.addEventListener("click", () => {
      if (!state.isLoggedIn()) {
        return;
      }

      const nextMode = option.dataset.mode as AppMode | undefined;
      if (nextMode) {
        actions.setAppMode(nextMode);
      }
    });
  }

  elements.editModeSelect.addEventListener("change", () => {
    if (state.isAdmin() && state.appMode() === "edit") {
      actions.setEditMode(elements.editModeSelect.value as EditMode);
    }
  });

  elements.wallModeButton.addEventListener("click", () => {
    if (state.isEditingBlocking()) {
      actions.setLogicTool("wall");
    }
  });

  elements.doorModeButton.addEventListener("click", () => {
    if (state.isEditingBlocking()) {
      actions.setLogicTool("door");
    }
  });

  elements.roomModeButton.addEventListener("click", () => {
    if (state.isEditingRooms()) {
      actions.setLogicTool(state.logicTool() === "room" ? "inspect-room" : "room");
    }
  });

  elements.logicMapVisibilityButton.addEventListener("click", () => {
    if (state.isPlayMode()) {
      actions.setLogicMapVisible(!state.isLogicMapVisible());
    }
  });

  elements.uploadInput.addEventListener("change", () => {
    if (state.isEditingBackground() && elements.uploadInput.files) {
      actions.handleFiles(elements.uploadInput.files);
    }

    elements.uploadInput.value = "";
  });

  elements.layerUpButton.addEventListener("click", () => actions.moveLayer("up"));
  elements.layerDownButton.addEventListener("click", () => actions.moveLayer("down"));
  elements.layerTopButton.addEventListener("click", () => actions.moveLayer("top"));
  elements.layerBottomButton.addEventListener("click", () => actions.moveLayer("bottom"));
  elements.deleteImageButton.addEventListener("click", actions.deleteSelectedImage);
  elements.deleteRoomButton.addEventListener("click", actions.deleteSelectedRoom);

  elements.diceOptionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const sides = actions.parseDiceButton(button);

      if (sides !== null) {
        actions.changeDieSelection(sides, 1);
      }
    });
  });

  elements.diceAdjustButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const sides = actions.parseDiceButton(button);

      if (sides !== null) {
        actions.changeDieSelection(sides, button.dataset.diceAction === "decrease" ? -1 : 1);
      }
    });
  });

  elements.diceRollButton.addEventListener("click", actions.rollSelectedDice);
  elements.diceModifierInput.addEventListener("input", actions.renderDicePanel);
  elements.diceModifierDecreaseButton.addEventListener("click", () => actions.changeDiceModifier(-1));
  elements.diceModifierIncreaseButton.addEventListener("click", () => actions.changeDiceModifier(1));
  elements.resetSizeButton.addEventListener("click", actions.resetSelectedImageSize);
  elements.editTokenNameButton.addEventListener("click", actions.startTokenNameEditing);
  elements.tokenNameInput.addEventListener("input", () => {
    actions.updateSelectedTokenName(elements.tokenNameInput.value);
  });
  elements.tokenNameInput.addEventListener("change", () => {
    actions.updateSelectedTokenName(elements.tokenNameInput.value);
  });
  elements.tokenNameInput.addEventListener("blur", actions.stopTokenNameEditing);
  elements.tokenSelectionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    actions.updateSelectedTokenName(elements.tokenNameInput.value);
    actions.stopTokenNameEditing();
  });
  elements.tokenNpcTypeInput.addEventListener("change", () => {
    actions.updateCharacterIsNpc(elements.tokenNpcTypeInput.checked);
  });
  elements.doorBlocksMovementInput.addEventListener("change", () => {
    actions.updateSelectedDoorState(!elements.doorBlocksMovementInput.checked);
  });
  elements.roomNameInput.addEventListener("input", () => {
    actions.updateSelectedRoomName(elements.roomNameInput.value);
  });
  elements.roomSelectionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    actions.updateSelectedRoomName(elements.roomNameInput.value);
    elements.roomNameInput.blur();
  });
  elements.avatarUploadInput.addEventListener("change", () => {
    const file = elements.avatarUploadInput.files?.[0];
    if (file) {
      void actions.uploadSelectedTokenAvatar(file).catch((error: unknown) => {
        console.error(error);
      });
    }

    elements.avatarUploadInput.value = "";
  });
  elements.editAvatarButton.addEventListener("click", () => {
    void actions.editSelectedTokenAvatar().catch((error: unknown) => {
      console.error(error);
    });
  });
  elements.resetAvatarAdjustmentButton.addEventListener("click", actions.resetSelectedTokenAvatarAdjustment);
  elements.cancelAvatarEditButton.addEventListener("click", actions.closeAvatarEditor);
  elements.saveAvatarEditButton.addEventListener("click", actions.saveAvatarEditor);

  elements.switchIdentityButton.addEventListener("click", () => {
    actions.showIdentityScreen();
  });
  elements.chatToggleButton.addEventListener("click", () => {
    actions.setChatPanelOpen(!state.isChatPanelOpen());
  });
  elements.chatCloseButton.addEventListener("click", () => {
    actions.setChatPanelOpen(false);
  });
  elements.characterToggleButton.addEventListener("click", () => {
    actions.setCharacterPanelOpen(!state.isCharacterPanelOpen());
  });
  elements.characterCloseButton.addEventListener("click", () => {
    actions.setCharacterPanelOpen(false);
  });
  elements.addCharacterButton.addEventListener("click", actions.addCharacter);
  elements.itemToggleButton.addEventListener("click", () => {
    actions.setItemPanelOpen(!state.isItemPanelOpen());
  });
  elements.itemCloseButton.addEventListener("click", () => {
    actions.setItemPanelOpen(false);
  });
  elements.addItemButton.addEventListener("click", actions.addItemDefinition);
  elements.editItemNameButton.addEventListener("click", actions.startItemNameEditing);
  elements.itemNameInput.addEventListener("input", () => {
    actions.updateItemDefinitionName(elements.itemNameInput.value);
  });
  elements.itemNameInput.addEventListener("change", () => {
    actions.updateItemDefinitionName(elements.itemNameInput.value);
  });
  elements.itemNameInput.addEventListener("blur", actions.stopItemNameEditing);
  elements.itemDefinitionSelectionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    actions.updateItemDefinitionName(elements.itemNameInput.value);
    actions.stopItemNameEditing();
  });
  elements.itemDescriptionInput.addEventListener("input", () => {
    actions.updateItemDefinitionDescription(elements.itemDescriptionInput.value);
  });
  elements.itemDescriptionInput.addEventListener("blur", actions.stopItemDescriptionEditing);
  elements.itemIconUploadInput.addEventListener("change", () => {
    const file = elements.itemIconUploadInput.files?.[0];
    if (file) {
      void actions.uploadSelectedItemIcon(file).catch((error: unknown) => {
        console.error(error);
      });
    }

    elements.itemIconUploadInput.value = "";
  });
  elements.editItemIconButton.addEventListener("click", () => {
    void actions.editSelectedItemIcon().catch((error: unknown) => {
      console.error(error);
    });
  });
  elements.resetItemIconAdjustmentButton.addEventListener("click", actions.resetSelectedItemIconAdjustment);
  elements.closeItemDefinitionInspectorButton.addEventListener("click", actions.closeItemDefinitionInspector);
  elements.itemDefinitionInspectorOverlay.addEventListener("click", (event) => {
    if (event.target === elements.itemDefinitionInspectorOverlay) {
      actions.closeItemDefinitionInspector();
    }
  });
  elements.deleteItemDefinitionButton.addEventListener("click", () => {
    const definitionId = state.inspectedItemDefinitionId();
    if (definitionId && state.isAdmin()) {
      actions.deleteItemDefinition(definitionId);
    }
  });
  elements.closeItemInstanceInspectorButton.addEventListener("click", actions.closeItemInstanceInspector);
  elements.itemInstanceInspectorOverlay.addEventListener("click", (event) => {
    if (event.target === elements.itemInstanceInspectorOverlay) {
      actions.closeItemInstanceInspector();
    }
  });
  elements.itemQuantityInput.addEventListener("change", () => {
    actions.stopItemQuantityEditing();
  });
  elements.itemQuantityInput.addEventListener("blur", actions.stopItemQuantityEditing);
  elements.itemInstanceSelectionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    actions.stopItemQuantityEditing();
  });
  elements.deleteItemInstanceButton.addEventListener("click", () => {
    const instance = state.inspectedItemInstance();
    if (instance && state.isAdmin()) {
      actions.deleteItemInstance(instance.id);
    }
  });
  elements.closeTokenInspectorButton.addEventListener("click", actions.closeTokenInspector);
  elements.tokenInspectorOverlay.addEventListener("click", (event) => {
    if (event.target === elements.tokenInspectorOverlay) {
      actions.closeTokenInspector();
    }
  });
  elements.deleteTokenInstanceButton.addEventListener("click", () => {
    const token = state.inspectedTokenInstance();
    if (token && state.isAdmin()) {
      actions.deleteToken(token.id);
    }
  });
}
