import {
  BrickWall,
  BrushCleaning,
  DoorOpen,
  EyeOff,
  LandPlot,
  MessageCircle,
  RefreshCw,
  Trash2,
  Upload,
  Users,
  createIcons,
} from "lucide";
import { mustGetCanvasContext, mustQuery, mustQueryAll } from "../utilities/dom";

export function queryDomRefs() {
  const canvas = mustQuery<HTMLCanvasElement>("#world-canvas");
  const ctx = mustGetCanvasContext(canvas);
  const latencyPanel = document.createElement("aside");
  latencyPanel.className = "latency-panel";
  latencyPanel.hidden = true;
  document.body.append(latencyPanel);

  const diceOverlayRoot = document.createElement("div");
  diceOverlayRoot.className = "dice-overlay-root";
  diceOverlayRoot.setAttribute("aria-hidden", "true");
  document.body.append(diceOverlayRoot);

  const diceHiddenLogContainer = document.createElement("div");
  diceHiddenLogContainer.className = "dice-hidden-log";
  diceHiddenLogContainer.hidden = true;
  document.body.append(diceHiddenLogContainer);

  createIcons({
    icons: {
      BrickWall,
      BrushCleaning,
      DoorOpen,
      EyeOff,
      LandPlot,
      MessageCircle,
      RefreshCw,
      Trash2,
      Upload,
      Users,
    },
    nameAttr: "data-lucide",
    attrs: {
      "aria-hidden": "true",
      class: "tool-icon",
      focusable: "false",
    },
  });

  return {
    canvas,
    ctx,
    latencyPanel,
    diceOverlayRoot,
    diceHiddenLogContainer,
    identityScreen: mustQuery<HTMLElement>("#identity-screen"),
    identityList: mustQuery<HTMLDivElement>("#identity-list"),
    modeToggle: mustQuery<HTMLDivElement>("#mode-toggle"),
    modeToggleOptions: mustQueryAll<HTMLButtonElement>("#mode-toggle .mode-toggle-option"),
    editModeSelectLabel: mustQuery<HTMLLabelElement>(".edit-mode-select-label"),
    editModeSelect: mustQuery<HTMLSelectElement>("#edit-mode-select"),
    uploadButton: mustQuery<HTMLLabelElement>("#upload-button"),
    uploadInput: mustQuery<HTMLInputElement>("#image-upload"),
    wallModeButton: mustQuery<HTMLButtonElement>("#wall-mode-button"),
    doorModeButton: mustQuery<HTMLButtonElement>("#door-mode-button"),
    roomModeButton: mustQuery<HTMLButtonElement>("#room-mode-button"),
    clearWallsButton: mustQuery<HTMLButtonElement>("#clear-walls-button"),
    logicMapVisibilityButton: mustQuery<HTMLButtonElement>("#logic-map-visibility-button"),
    switchIdentityButton: mustQuery<HTMLButtonElement>("#switch-identity-button"),
    chatToggleButton: mustQuery<HTMLButtonElement>("#chat-toggle-button"),
    characterToggleButton: mustQuery<HTMLButtonElement>("#character-toggle-button"),
    identityBadge: mustQuery<HTMLSpanElement>("#identity-badge"),
    dropOverlay: mustQuery<HTMLDivElement>("#drop-overlay"),
    chatPanel: mustQuery<HTMLElement>("#chat-panel"),
    chatCloseButton: mustQuery<HTMLButtonElement>("#chat-close-button"),
    chatMessageList: mustQuery<HTMLDivElement>("#chat-message-list"),
    characterPanel: mustQuery<HTMLElement>("#character-panel"),
    characterCloseButton: mustQuery<HTMLButtonElement>("#character-close-button"),
    addCharacterButton: mustQuery<HTMLButtonElement>("#add-character-button"),
    characterList: mustQuery<HTMLDivElement>("#character-list"),
    selectionPanel: mustQuery<HTMLDivElement>("#selection-panel"),
    selectionEyebrow: mustQuery<HTMLDivElement>("#selection-eyebrow"),
    selectionTitle: mustQuery<HTMLDivElement>("#selection-title"),
    imageSelectionControls: mustQuery<HTMLDivElement>("#image-selection-controls"),
    imageSelectionActions: mustQuery<HTMLDivElement>("#image-selection-actions"),
    imageSelectionDanger: mustQuery<HTMLDivElement>("#image-selection-danger"),
    resetSizeButton: mustQuery<HTMLButtonElement>("#reset-size"),
    layerUpButton: mustQuery<HTMLButtonElement>("#layer-up"),
    layerDownButton: mustQuery<HTMLButtonElement>("#layer-down"),
    layerTopButton: mustQuery<HTMLButtonElement>("#layer-top"),
    layerBottomButton: mustQuery<HTMLButtonElement>("#layer-bottom"),
    deleteImageButton: mustQuery<HTMLButtonElement>("#delete-image"),
    tokenSelectionForm: mustQuery<HTMLFormElement>("#token-selection-form"),
    tokenNameDisplay: mustQuery<HTMLDivElement>("#token-name-display"),
    tokenNameValue: mustQuery<HTMLSpanElement>("#token-name-value"),
    editTokenNameButton: mustQuery<HTMLButtonElement>("#edit-token-name"),
    tokenNameInput: mustQuery<HTMLInputElement>("#token-name-input"),
    avatarUploadButton: mustQuery<HTMLLabelElement>("#avatar-upload-button"),
    avatarUploadInput: mustQuery<HTMLInputElement>("#avatar-upload-input"),
    avatarAdjustControls: mustQuery<HTMLDivElement>("#avatar-adjust-controls"),
    editAvatarButton: mustQuery<HTMLButtonElement>("#edit-avatar"),
    resetAvatarAdjustmentButton: mustQuery<HTMLButtonElement>("#reset-avatar-adjustment"),
    tokenPanelHelp: mustQuery<HTMLParagraphElement>("#token-panel-help"),
    tokenNpcTypeControls: mustQuery<HTMLDivElement>("#token-npc-type-controls"),
    tokenNpcTypeInput: mustQuery<HTMLInputElement>("#token-npc-type-input"),
    tokenInspectorOverlay: mustQuery<HTMLElement>("#token-inspector-overlay"),
    closeTokenInspectorButton: mustQuery<HTMLButtonElement>("#close-token-inspector"),
    tokenInstanceActions: mustQuery<HTMLDivElement>("#token-instance-actions"),
    deleteTokenInstanceButton: mustQuery<HTMLButtonElement>("#delete-token-instance"),
    doorSelectionForm: mustQuery<HTMLFormElement>("#door-selection-form"),
    doorBlocksMovementInput: mustQuery<HTMLInputElement>("#door-blocks-movement-input"),
    roomSelectionForm: mustQuery<HTMLFormElement>("#room-selection-form"),
    roomNameInput: mustQuery<HTMLInputElement>("#room-name-input"),
    deleteRoomButton: mustQuery<HTMLButtonElement>("#delete-room"),
    avatarEditorOverlay: mustQuery<HTMLElement>("#avatar-editor-overlay"),
    avatarEditorStage: mustQuery<HTMLDivElement>("#avatar-editor-stage"),
    avatarEditorImage: mustQuery<HTMLImageElement>("#avatar-editor-image"),
    cancelAvatarEditButton: mustQuery<HTMLButtonElement>("#cancel-avatar-edit"),
    saveAvatarEditButton: mustQuery<HTMLButtonElement>("#save-avatar-edit"),
    dicePanel: mustQuery<HTMLElement>("#dice-panel"),
    diceFocusLabel: mustQuery<HTMLButtonElement>("#dice-focus-label"),
    diceOptionButtons: Array.from(document.querySelectorAll<HTMLButtonElement>(".dice-option")),
    diceAdjustButtons: Array.from(document.querySelectorAll<HTMLButtonElement>(".dice-adjust-button[data-die]")),
    diceRollButton: mustQuery<HTMLButtonElement>("#dice-roll"),
    diceModifierInput: mustQuery<HTMLInputElement>("#dice-modifier"),
    diceModifierDecreaseButton: mustQuery<HTMLButtonElement>("#dice-modifier-decrease"),
    diceModifierIncreaseButton: mustQuery<HTMLButtonElement>("#dice-modifier-increase"),
  };
}
