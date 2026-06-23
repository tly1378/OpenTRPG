import type { SceneCharacter, SceneDoor, SceneImage, SceneRoom, SceneToken } from "../core/types";

export function renderSelectionPanel(options: {
  elements: {
    selectionPanel: HTMLDivElement;
    selectionEyebrow: HTMLDivElement;
    selectionTitle: HTMLDivElement;
    imageSelectionControls: HTMLDivElement;
    imageSelectionActions: HTMLDivElement;
    imageSelectionDanger: HTMLDivElement;
    doorSelectionForm: HTMLFormElement;
    doorBlocksMovementInput: HTMLInputElement;
    roomSelectionForm: HTMLFormElement;
    roomNameInput: HTMLInputElement;
  };
  selectedImage: SceneImage | null;
  selectedDoor: SceneDoor | null;
  selectedRoom: SceneRoom | null;
  isAdmin: boolean;
  clearTokenNameEditing: () => void;
}): void {
  const { elements, selectedImage, selectedDoor, selectedRoom } = options;

  if (!selectedImage && !selectedDoor && !selectedRoom) {
    elements.selectionPanel.classList.remove("is-open");
    elements.selectionPanel.setAttribute("aria-hidden", "true");
    return;
  }

  if (selectedImage) {
    options.clearTokenNameEditing();
    elements.selectionEyebrow.textContent = "图片检视";
    elements.selectionTitle.textContent = selectedImage.name;
    elements.imageSelectionControls.hidden = false;
    elements.imageSelectionActions.hidden = false;
    elements.imageSelectionDanger.hidden = false;
    elements.doorSelectionForm.hidden = true;
    elements.roomSelectionForm.hidden = true;
  }

  if (selectedDoor) {
    options.clearTokenNameEditing();
    elements.selectionEyebrow.textContent = "门检视";
    elements.selectionTitle.textContent = `${selectedDoor.type === "vertical" ? "纵向" : "横向"}门 (${selectedDoor.x}, ${selectedDoor.y})`;
    elements.imageSelectionControls.hidden = true;
    elements.imageSelectionActions.hidden = true;
    elements.imageSelectionDanger.hidden = true;
    elements.doorSelectionForm.hidden = false;
    elements.roomSelectionForm.hidden = true;
    elements.doorBlocksMovementInput.checked = !selectedDoor.isOpen;
    elements.doorBlocksMovementInput.disabled = !options.isAdmin;
  }

  if (selectedRoom) {
    options.clearTokenNameEditing();
    elements.selectionEyebrow.textContent = "房间检视";
    elements.selectionTitle.textContent = selectedRoom.name || "未命名房间";
    elements.imageSelectionControls.hidden = true;
    elements.imageSelectionActions.hidden = true;
    elements.imageSelectionDanger.hidden = true;
    elements.doorSelectionForm.hidden = true;
    elements.roomSelectionForm.hidden = false;
    if (document.activeElement !== elements.roomNameInput) {
      elements.roomNameInput.value = selectedRoom.name;
    }
  }

  elements.selectionPanel.classList.add("is-open");
  elements.selectionPanel.setAttribute("aria-hidden", "false");
}

export function renderTokenInspector(options: {
  elements: {
    tokenInspectorOverlay: HTMLElement;
    tokenNameDisplay: HTMLDivElement;
    tokenNameValue: HTMLSpanElement;
    editTokenNameButton: HTMLButtonElement;
    tokenNameInput: HTMLInputElement;
    avatarUploadInput: HTMLInputElement;
    avatarUploadButton: HTMLLabelElement;
    avatarAdjustControls: HTMLDivElement;
    editAvatarButton: HTMLButtonElement;
    resetAvatarAdjustmentButton: HTMLButtonElement;
    tokenInstanceActions: HTMLDivElement;
    deleteTokenInstanceButton: HTMLButtonElement;
    tokenPanelHelp: HTMLParagraphElement;
    tokenNpcTypeControls: HTMLDivElement;
    tokenNpcTypeInput: HTMLInputElement;
  };
  character: SceneCharacter | null;
  tokenInstance: SceneToken | null;
  canInspectToken: boolean;
  canControlToken: boolean;
  isAdmin: boolean;
  isEditingTokenName: boolean;
  clearTokenNameEditing: () => void;
}): void {
  const { elements, character } = options;

  if (!character || !options.canInspectToken) {
    elements.tokenInspectorOverlay.hidden = true;
    options.clearTokenNameEditing();
    return;
  }

  elements.tokenInspectorOverlay.hidden = false;
  elements.tokenNameDisplay.hidden = false;
  elements.tokenNameValue.textContent = character.name;
  elements.tokenNameValue.hidden = options.isEditingTokenName;
  elements.editTokenNameButton.disabled = !options.canControlToken;
  elements.tokenNameInput.hidden = !options.isEditingTokenName;
  elements.tokenNameInput.disabled = !options.canControlToken;
  elements.avatarUploadInput.disabled = !options.canControlToken;
  elements.avatarUploadButton.classList.toggle("is-disabled", !options.canControlToken);
  elements.avatarAdjustControls.hidden = !character.avatarSrc;
  elements.editAvatarButton.disabled = !options.canControlToken;
  elements.resetAvatarAdjustmentButton.disabled = !options.canControlToken;
  elements.tokenInstanceActions.hidden = !options.isAdmin || !options.tokenInstance;
  elements.deleteTokenInstanceButton.disabled = !options.isAdmin || !options.tokenInstance;
  elements.tokenNpcTypeControls.hidden = !options.isAdmin;
  elements.tokenNpcTypeInput.checked = Boolean(character.isNpc);
  elements.tokenNpcTypeInput.disabled = !options.isAdmin;

  if (character.isNpc && !options.canControlToken) {
    elements.tokenPanelHelp.textContent = "NPC 只能由主持人操控。";
  } else if (options.canControlToken) {
    elements.tokenPanelHelp.textContent = "修改后会同步到所有客户端。";
  } else {
    elements.tokenPanelHelp.textContent = "只有主持人或该角色玩家可以修改姓名。";
  }

  if (document.activeElement !== elements.tokenNameInput || !options.isEditingTokenName) {
    elements.tokenNameInput.value = character.name;
  }
}
