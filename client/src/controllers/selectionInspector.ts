import type { SceneCharacter, SceneDoor, SceneImage, SceneItemDefinition, SceneItemInstance, SceneRoom, SceneToken } from "../core/types";
import { buildItemDisplayLabel, buildItemStackDescription, getItemStackForInstance, type ItemStack } from "../modules/items/itemStacks";

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

export function renderItemDefinitionInspector(options: {
  elements: {
    itemDefinitionInspectorOverlay: HTMLElement;
    itemNameDisplay: HTMLDivElement;
    itemNameValue: HTMLSpanElement;
    editItemNameButton: HTMLButtonElement;
    itemNameInput: HTMLInputElement;
    itemDescriptionInput: HTMLTextAreaElement;
    itemIconUploadInput: HTMLInputElement;
    itemIconUploadButton: HTMLLabelElement;
    itemIconAdjustControls: HTMLDivElement;
    editItemIconButton: HTMLButtonElement;
    resetItemIconAdjustmentButton: HTMLButtonElement;
    deleteItemDefinitionButton: HTMLButtonElement;
    itemDefinitionPanelHelp: HTMLParagraphElement;
  };
  definition: SceneItemDefinition | null;
  isAdmin: boolean;
  isEditingItemName: boolean;
  isEditingItemDescription: boolean;
  clearItemNameEditing: () => void;
  clearItemDescriptionEditing: () => void;
}): void {
  const { elements, definition } = options;

  if (!definition || !options.isAdmin) {
    elements.itemDefinitionInspectorOverlay.hidden = true;
    options.clearItemNameEditing();
    options.clearItemDescriptionEditing();
    return;
  }

  elements.itemDefinitionInspectorOverlay.hidden = false;
  elements.itemNameValue.textContent = definition.name;
  elements.itemNameValue.hidden = options.isEditingItemName;
  elements.editItemNameButton.disabled = !options.isAdmin;
  elements.itemNameInput.hidden = !options.isEditingItemName;
  elements.itemNameInput.disabled = !options.isAdmin;
  elements.itemIconUploadInput.disabled = !options.isAdmin;
  elements.itemIconUploadButton.classList.toggle("is-disabled", !options.isAdmin);
  elements.itemIconAdjustControls.hidden = !definition.iconSrc;
  elements.editItemIconButton.disabled = !options.isAdmin;
  elements.resetItemIconAdjustmentButton.disabled = !options.isAdmin;
  elements.deleteItemDefinitionButton.disabled = !options.isAdmin;
  elements.itemDefinitionPanelHelp.textContent = "修改后会同步到所有客户端。";

  if (document.activeElement !== elements.itemNameInput || !options.isEditingItemName) {
    elements.itemNameInput.value = definition.name;
  }

  if (document.activeElement !== elements.itemDescriptionInput || !options.isEditingItemDescription) {
    elements.itemDescriptionInput.value = definition.description ?? "";
  }
}

export function renderItemInstanceInspector(options: {
  elements: {
    itemInstanceInspectorOverlay: HTMLElement;
    itemInstanceNameValue: HTMLSpanElement;
    itemInstanceDescriptionValue: HTMLParagraphElement;
    itemInstanceIconPreview: HTMLDivElement;
    itemQuantityInput: HTMLInputElement;
    deleteItemInstanceButton: HTMLButtonElement;
    itemInstancePanelHelp: HTMLParagraphElement;
  };
  definition: SceneItemDefinition | null;
  instance: SceneItemInstance | null;
  stack: ItemStack | null;
  definitionsById: Map<string, SceneItemDefinition>;
  iconImages: Map<string, { src: string; image: HTMLImageElement }>;
  isAdmin: boolean;
  canInspect: boolean;
}): void {
  const { elements, definition, instance, stack } = options;

  if (!definition || !instance || !stack || !options.canInspect) {
    elements.itemInstanceInspectorOverlay.hidden = true;
    return;
  }

  const isMultiItemStack = stack.instances.length > 1;
  const displayLabel = buildItemDisplayLabel(stack, options.definitionsById);

  elements.itemInstanceInspectorOverlay.hidden = false;
  elements.itemInstanceNameValue.textContent = displayLabel;
  elements.itemInstanceDescriptionValue.textContent = buildItemStackDescription(stack, options.definitionsById);
  elements.itemQuantityInput.value = String(instance.quantity);
  elements.itemQuantityInput.disabled = !options.isAdmin || isMultiItemStack;
  elements.deleteItemInstanceButton.disabled = !options.isAdmin;
  elements.itemInstancePanelHelp.textContent = isMultiItemStack
    ? options.isAdmin
      ? "该格子里有多个物品叠放。双击后可删除当前选中的单个物品。"
      : "该格子里有多个物品叠放。"
    : options.isAdmin
      ? "场景中的物品实体只能修改数量或删除。"
      : "你只能查看场景物品的信息。";

  const iconImage = options.iconImages.get(definition.id);
  elements.itemInstanceIconPreview.replaceChildren();
  elements.itemInstanceIconPreview.style.removeProperty("--character-color");

  if (iconImage) {
    const image = document.createElement("img");
    const diameter = 100;
    const radius = diameter / 2;
    const scale = definition.iconScale ?? 1;
    const offsetX = (definition.iconOffsetX ?? 0) * radius;
    const offsetY = (definition.iconOffsetY ?? 0) * radius;
    const ratio = iconImage.image.naturalWidth / iconImage.image.naturalHeight || 1;
    const width = ratio >= 1 ? diameter * scale * ratio : diameter * scale;
    const height = ratio >= 1 ? diameter * scale : (diameter * scale) / ratio;

    image.src = iconImage.src;
    image.alt = `${definition.name} 图标`;
    image.style.width = `${width}%`;
    image.style.height = `${height}%`;
    image.style.left = `${50 + offsetX}%`;
    image.style.top = `${50 + offsetY}%`;
    elements.itemInstanceIconPreview.append(image);
  } else {
    elements.itemInstanceIconPreview.textContent = definition.name.trim().slice(0, 1) || "物";
  }
}
