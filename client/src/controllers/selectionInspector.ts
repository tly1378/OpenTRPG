import type { Cell, SceneCharacter, SceneDoor, SceneImage, SceneItemDefinition, SceneItemInstance, SceneBackpackItem, SceneRoom, SceneToken, TokenInspectorTab, WarehouseItemEntry, WarehouseOverlayMode } from "../core/types";
import { renderCharacterStatsPanel } from "../modules/scene/characterStatsUi";
import { renderCharacterBackgroundPanel } from "../modules/scene/characterBackgroundUi";
import { renderWarehouseList } from "../modules/warehouses/warehouseUi";
import { backpackWarehouseId, getWarehouseLabel, groundWarehouseId, groundWarehouseLabel } from "../modules/warehouses/warehouses";
import { buildItemDisplayLabel, buildItemStackDescription, getItemStackForInstance, type ItemStack } from "../modules/items/itemStacks";
import type { TokenAvatarImage } from "../core/appState";

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
    tokenInspectorTabStats: HTMLButtonElement;
    tokenInspectorTabProfile: HTMLButtonElement;
    tokenInspectorTabBackpack: HTMLButtonElement;
    tokenInspectorTabBackground: HTMLButtonElement;
    tokenStatsPanel: HTMLDivElement;
    tokenStatsList: HTMLDivElement;
    tokenProfilePanel: HTMLDivElement;
    tokenBackpackPanel: HTMLDivElement;
    tokenBackpackTitle: HTMLDivElement;
    tokenBackpackList: HTMLDivElement;
    tokenBackpackHelp: HTMLParagraphElement;
    tokenBackgroundPanel: HTMLDivElement;
    tokenBackgroundList: HTMLDivElement;
  };
  character: SceneCharacter | null;
  tokenInstance: SceneToken | null;
  activeTab: TokenInspectorTab;
  backpackItems: WarehouseItemEntry[];
  definitionsById: Map<string, SceneItemDefinition>;
  iconImages: Map<string, TokenAvatarImage>;
  canTransferBackpack: boolean;
  onWarehouseTransfer: (fromWarehouseId: string, toWarehouseId: string, itemId: string) => void;
  onItemInspect: (item: WarehouseItemEntry) => void;
  canInspectToken: boolean;
  canControlToken: boolean;
  isAdmin: boolean;
  canEditStatStructure: boolean;
  canEditStatValues: boolean;
  canEditBackground: boolean;
  onAddCharacterStatCategory: () => void;
  onDeleteCharacterStatCategory: (categoryId: string) => void;
  onUpdateCharacterStatCategoryName: (categoryId: string, name: string) => void;
  onAddCharacterStat: (categoryId: string) => void;
  onDeleteCharacterStat: (categoryId: string, statId: string) => void;
  onUpdateCharacterStatName: (categoryId: string, statId: string, name: string) => void;
  onUpdateCharacterStatValue: (categoryId: string, statId: string, value: number) => void;
  onAddCharacterBackgroundEntry: () => void;
  onDeleteCharacterBackgroundEntry: (entryId: string) => void;
  onUpdateCharacterBackgroundTitle: (entryId: string, title: string) => void;
  onUpdateCharacterBackgroundText: (entryId: string, text: string) => void;
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

  const canShowProfileTab = options.canControlToken;
  elements.tokenInspectorTabProfile.hidden = !canShowProfileTab;

  const activeTab = !canShowProfileTab && options.activeTab === "profile" ? "stats" : options.activeTab;
  const isStatsTab = activeTab === "stats";
  const isProfileTab = activeTab === "profile";
  const isBackpackTab = activeTab === "backpack";
  const isBackgroundTab = activeTab === "background";

  elements.tokenInspectorTabStats.classList.toggle("is-active", isStatsTab);
  elements.tokenInspectorTabStats.setAttribute("aria-selected", String(isStatsTab));
  elements.tokenInspectorTabProfile.classList.toggle("is-active", isProfileTab);
  elements.tokenInspectorTabProfile.setAttribute("aria-selected", String(isProfileTab));
  elements.tokenInspectorTabBackpack.classList.toggle("is-active", isBackpackTab);
  elements.tokenInspectorTabBackpack.setAttribute("aria-selected", String(isBackpackTab));
  elements.tokenInspectorTabBackground.classList.toggle("is-active", isBackgroundTab);
  elements.tokenInspectorTabBackground.setAttribute("aria-selected", String(isBackgroundTab));
  elements.tokenStatsPanel.hidden = !isStatsTab;
  elements.tokenProfilePanel.hidden = !isProfileTab;
  elements.tokenBackpackPanel.hidden = !isBackpackTab;
  elements.tokenBackgroundPanel.hidden = !isBackgroundTab;

  renderCharacterStatsPanel({
    listContainer: elements.tokenStatsList,
    character,
    canEditStructure: options.canEditStatStructure,
    canEditValues: options.canEditStatValues,
    onAddCharacterStatCategory: options.onAddCharacterStatCategory,
    onDeleteCharacterStatCategory: options.onDeleteCharacterStatCategory,
    onUpdateCharacterStatCategoryName: options.onUpdateCharacterStatCategoryName,
    onAddCharacterStat: options.onAddCharacterStat,
    onDeleteCharacterStat: options.onDeleteCharacterStat,
    onUpdateCharacterStatName: options.onUpdateCharacterStatName,
    onUpdateCharacterStatValue: options.onUpdateCharacterStatValue,
  });

  renderCharacterBackgroundPanel({
    listContainer: elements.tokenBackgroundList,
    character,
    canEdit: options.canEditBackground,
    onAddCharacterBackgroundEntry: options.onAddCharacterBackgroundEntry,
    onDeleteCharacterBackgroundEntry: options.onDeleteCharacterBackgroundEntry,
    onUpdateCharacterBackgroundTitle: options.onUpdateCharacterBackgroundTitle,
    onUpdateCharacterBackgroundText: options.onUpdateCharacterBackgroundText,
  });

  elements.tokenNameDisplay.hidden = !isProfileTab;
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
  elements.tokenInstanceActions.hidden = !options.isAdmin || !options.tokenInstance || !isProfileTab;
  elements.deleteTokenInstanceButton.disabled = !options.isAdmin || !options.tokenInstance;
  elements.tokenNpcTypeControls.hidden = !options.isAdmin || !isProfileTab;
  elements.tokenNpcTypeInput.checked = Boolean(character.isNpc);
  elements.tokenNpcTypeInput.disabled = !options.isAdmin;

  if (character.isNpc && !options.canControlToken) {
    elements.tokenPanelHelp.hidden = !isProfileTab;
    elements.tokenPanelHelp.textContent = "NPC 只能由主持人操控。";
  } else if (options.canControlToken) {
    elements.tokenPanelHelp.hidden = true;
    elements.tokenPanelHelp.textContent = "";
  } else {
    elements.tokenPanelHelp.hidden = !isProfileTab;
    elements.tokenPanelHelp.textContent = "只有主持人或该角色玩家可以修改姓名。";
  }

  if (document.activeElement !== elements.tokenNameInput || !options.isEditingTokenName) {
    elements.tokenNameInput.value = character.name;
  }

  elements.tokenBackpackTitle.textContent = getWarehouseLabel(backpackWarehouseId(character.id), character.name);
  renderWarehouseList({
    container: elements.tokenBackpackList,
    warehouseId: backpackWarehouseId(character.id),
    items: options.backpackItems,
    definitionsById: options.definitionsById,
    iconImages: options.iconImages,
    draggable: options.canTransferBackpack,
    droppable: options.canTransferBackpack,
    onTransfer: options.onWarehouseTransfer,
    onItemInspect: options.onItemInspect,
  });

  elements.tokenBackpackHelp.textContent = "双击条目可查看详情。";
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
    itemInstanceQuantityValue: HTMLSpanElement;
    itemInstanceQuantityEdit: HTMLLabelElement;
    itemQuantityInput: HTMLInputElement;
    deleteItemInstanceButton: HTMLButtonElement;
    splitItemInstanceButton: HTMLButtonElement;
    takeItemInstanceButton: HTMLButtonElement;
    discardItemInstanceButton: HTMLButtonElement;
    itemSplitPopover: HTMLDivElement;
    itemSplitSlider: HTMLInputElement;
    itemSplitValue: HTMLOutputElement;
    cancelItemSplitButton: HTMLButtonElement;
    confirmItemSplitButton: HTMLButtonElement;
  };
  definition: SceneItemDefinition | null;
  instance: SceneItemInstance | null;
  backpackItem: SceneBackpackItem | null;
  stack: ItemStack | null;
  singleItemFocus: boolean;
  definitionsById: Map<string, SceneItemDefinition>;
  iconImages: Map<string, { src: string; image: HTMLImageElement }>;
  isAdmin: boolean;
  canInspect: boolean;
  canTakeItem: boolean;
  canSplitItem: boolean;
  canDiscardBackpackItem: boolean;
  itemSplitPopoverOpen: boolean;
}): void {
  const { elements, definition, instance, backpackItem, stack } = options;

  const hasGroundItem = Boolean(definition && instance && stack);
  const hasBackpackItem = Boolean(definition && backpackItem);

  if ((!hasGroundItem && !hasBackpackItem) || !options.canInspect) {
    elements.itemInstanceInspectorOverlay.hidden = true;
    return;
  }

  const isMultiItemStack = Boolean(stack && stack.instances.length > 1 && !options.singleItemFocus);
  const useSimpleItemPresentation = hasBackpackItem || options.singleItemFocus || !isMultiItemStack;
  const displayLabel = useSimpleItemPresentation
    ? definition!.name
    : buildItemDisplayLabel(stack!, options.definitionsById);

  elements.itemInstanceInspectorOverlay.hidden = false;
  elements.itemInstanceNameValue.textContent = displayLabel;
  const descriptionText = useSimpleItemPresentation
    ? definition!.description?.trim() || "暂无描述"
    : buildItemStackDescription(stack!, options.definitionsById);
  elements.itemInstanceDescriptionValue.textContent = descriptionText;
  elements.itemInstanceDescriptionValue.classList.toggle(
    "is-placeholder",
    useSimpleItemPresentation ? !definition!.description?.trim() : false,
  );
  const itemQuantity = hasBackpackItem ? backpackItem!.quantity : instance!.quantity;
  const canEditQuantity = options.isAdmin && !hasBackpackItem && !isMultiItemStack;
  elements.itemInstanceQuantityValue.textContent = `数量：${itemQuantity}`;
  elements.itemInstanceQuantityValue.hidden = canEditQuantity;
  elements.itemInstanceQuantityEdit.hidden = !canEditQuantity;
  elements.itemQuantityInput.value = String(itemQuantity);
  elements.itemQuantityInput.disabled = !canEditQuantity;
  elements.deleteItemInstanceButton.hidden = hasBackpackItem || !options.isAdmin;
  elements.deleteItemInstanceButton.disabled = !options.isAdmin;
  const canSplitStack = itemQuantity > 1 && !isMultiItemStack && options.canSplitItem;
  elements.splitItemInstanceButton.hidden = !canSplitStack;
  elements.splitItemInstanceButton.disabled = !canSplitStack;
  elements.takeItemInstanceButton.hidden = hasBackpackItem || isMultiItemStack || !options.canTakeItem;
  elements.takeItemInstanceButton.disabled = !options.canTakeItem;
  elements.discardItemInstanceButton.hidden = !hasBackpackItem || !options.canDiscardBackpackItem;
  elements.discardItemInstanceButton.disabled = !options.canDiscardBackpackItem;
  elements.itemSplitPopover.hidden = !options.itemSplitPopoverOpen || !canSplitStack;

  if (!definition) {
    elements.itemInstanceInspectorOverlay.hidden = true;
    return;
  }

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

export function renderWarehouseOverlay(options: {
  elements: {
    warehouseOverlay: HTMLElement;
    warehouseOverlayEyebrow: HTMLParagraphElement;
    warehouseOverlayTitle: HTMLHeadingElement;
    warehouseSingleView: HTMLDivElement;
    warehouseSingleList: HTMLDivElement;
    warehouseTransferView: HTMLDivElement;
    warehouseTransferGroundTitle: HTMLDivElement;
    warehouseTransferGroundList: HTMLDivElement;
    warehouseTransferBackpackTitle: HTMLDivElement;
    warehouseTransferBackpackList: HTMLDivElement;
    warehouseOverlayHelp: HTMLParagraphElement;
  };
  mode: WarehouseOverlayMode | null;
  cell: Cell | null;
  groundItems: WarehouseItemEntry[];
  backpackItems: WarehouseItemEntry[];
  backpackCharacterId: string | null;
  backpackCharacterName: string | null;
  definitionsById: Map<string, SceneItemDefinition>;
  iconImages: Map<string, TokenAvatarImage>;
  canTransfer: boolean;
  onWarehouseTransfer: (fromWarehouseId: string, toWarehouseId: string, itemId: string) => void;
  onItemInspect: (item: WarehouseItemEntry) => void;
}): void {
  const { elements, cell, mode } = options;

  if (!cell || !mode) {
    elements.warehouseOverlay.hidden = true;
    return;
  }

  const groundLabel = groundWarehouseLabel(cell);
  const groundWarehouse = groundWarehouseId(cell);
  const backpackWarehouse = options.backpackCharacterId ? backpackWarehouseId(options.backpackCharacterId) : null;
  const isSingle = mode === "single";

  elements.warehouseOverlay.hidden = false;
  elements.warehouseSingleView.hidden = !isSingle;
  elements.warehouseTransferView.hidden = isSingle;

  if (isSingle) {
    elements.warehouseOverlayEyebrow.textContent = "仓库";
    elements.warehouseOverlayTitle.textContent = groundLabel;

    renderWarehouseList({
      container: elements.warehouseSingleList,
      warehouseId: groundWarehouse,
      items: options.groundItems,
      definitionsById: options.definitionsById,
      iconImages: options.iconImages,
      draggable: false,
      droppable: false,
      onTransfer: options.onWarehouseTransfer,
      onItemInspect: options.onItemInspect,
    });

    elements.warehouseOverlayHelp.textContent = "双击物品条目可查看详情。";
    return;
  }

  elements.warehouseOverlayEyebrow.textContent = "物品交换";
  elements.warehouseOverlayTitle.textContent = "物品交换";
  elements.warehouseTransferGroundTitle.textContent = groundLabel;
  elements.warehouseTransferBackpackTitle.textContent = options.backpackCharacterId
    ? getWarehouseLabel(backpackWarehouseId(options.backpackCharacterId), options.backpackCharacterName)
    : "背包";

  renderWarehouseList({
    container: elements.warehouseTransferGroundList,
    warehouseId: groundWarehouse,
    items: options.groundItems,
    definitionsById: options.definitionsById,
    iconImages: options.iconImages,
    draggable: options.canTransfer,
    droppable: options.canTransfer,
    onTransfer: options.onWarehouseTransfer,
    onItemInspect: options.onItemInspect,
  });

  renderWarehouseList({
    container: elements.warehouseTransferBackpackList,
    warehouseId: backpackWarehouse ?? "backpack:unknown",
    items: options.backpackItems,
    definitionsById: options.definitionsById,
    iconImages: options.iconImages,
    draggable: options.canTransfer && Boolean(backpackWarehouse),
    droppable: options.canTransfer && Boolean(backpackWarehouse),
    onTransfer: options.onWarehouseTransfer,
    onItemInspect: options.onItemInspect,
  });

  if (!options.backpackCharacterId) {
    elements.warehouseOverlayHelp.textContent = "以玩家身份登录后才能使用背包。";
  } else if (options.canTransfer) {
    elements.warehouseOverlayHelp.textContent = "拖动物品可在两个仓库之间转移；双击条目可查看详情。";
  } else {
    elements.warehouseOverlayHelp.textContent = "你没有权限转移这些物品。";
  }
}
