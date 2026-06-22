import type { AppMode, EditMode, LogicTool } from "./types";

type ModeControls = {
  modeSelectLabel: HTMLLabelElement;
  modeSelect: HTMLSelectElement;
  editModeSelectLabel: HTMLLabelElement;
  editModeSelect: HTMLSelectElement;
  uploadInput: HTMLInputElement;
  uploadButton: HTMLLabelElement;
  wallModeButton: HTMLButtonElement;
  doorModeButton: HTMLButtonElement;
  roomModeButton: HTMLButtonElement;
  clearWallsButton: HTMLButtonElement;
  logicMapVisibilityButton: HTMLButtonElement;
  resetSizeButton: HTMLButtonElement;
  layerUpButton: HTMLButtonElement;
  layerDownButton: HTMLButtonElement;
  layerTopButton: HTMLButtonElement;
  layerBottomButton: HTMLButtonElement;
  deleteImageButton: HTMLButtonElement;
  canvas: HTMLCanvasElement;
};

export function updateModeControls(
  controls: ModeControls,
  params: {
    appMode: AppMode;
    editMode: EditMode;
    logicTool: LogicTool;
    isLogicMapVisible: boolean;
    isLoggedIn: boolean;
    isAdmin: boolean;
  },
): void {
  const { appMode, editMode, logicTool, isLogicMapVisible, isLoggedIn, isAdmin } = params;
  const isEditing = isLoggedIn && isAdmin && appMode === "edit";
  const isEditingBackground = isEditing && editMode === "background";
  const isEditingBlocking = isEditing && editMode === "blocking";
  const isPlaying = isLoggedIn && appMode === "play";

  controls.modeSelect.value = appMode;
  controls.modeSelect.disabled = !isLoggedIn || !isAdmin;
  controls.modeSelectLabel.classList.toggle("is-hidden", !isLoggedIn || !isAdmin);
  controls.editModeSelect.value = editMode;
  controls.editModeSelect.disabled = !isEditing;
  controls.editModeSelectLabel.classList.toggle("is-hidden", appMode !== "edit" || !isLoggedIn || !isAdmin);

  controls.uploadInput.disabled = !isEditingBackground;
  controls.uploadButton.classList.toggle("is-disabled", controls.uploadInput.disabled);
  controls.uploadButton.classList.toggle("is-hidden", !isEditingBackground);
  controls.wallModeButton.disabled = !isEditingBlocking;
  controls.wallModeButton.classList.toggle("is-hidden", !isEditingBlocking);
  controls.doorModeButton.disabled = !isEditingBlocking;
  controls.doorModeButton.classList.toggle("is-hidden", !isEditingBlocking);
  controls.roomModeButton.disabled = !isEditingBlocking;
  controls.roomModeButton.classList.toggle("is-hidden", !isEditingBlocking);
  controls.clearWallsButton.disabled = !isEditingBlocking;
  controls.clearWallsButton.classList.toggle("is-hidden", !isEditingBlocking);
  controls.logicMapVisibilityButton.disabled = !isPlaying;
  controls.logicMapVisibilityButton.classList.toggle("is-hidden", !isPlaying);
  controls.logicMapVisibilityButton.classList.toggle("is-active", isPlaying && isLogicMapVisible);
  controls.logicMapVisibilityButton.setAttribute("aria-pressed", String(isPlaying && isLogicMapVisible));
  controls.logicMapVisibilityButton.setAttribute("aria-label", isLogicMapVisible ? "隐藏逻辑地图" : "显示逻辑地图");
  controls.logicMapVisibilityButton.dataset.tooltip = isLogicMapVisible ? "隐藏逻辑地图" : "显示逻辑地图";
  controls.resetSizeButton.disabled = !isEditingBackground;
  controls.layerUpButton.disabled = !isEditingBackground;
  controls.layerDownButton.disabled = !isEditingBackground;
  controls.layerTopButton.disabled = !isEditingBackground;
  controls.layerBottomButton.disabled = !isEditingBackground;
  controls.deleteImageButton.disabled = !isEditingBackground;

  controls.wallModeButton.classList.toggle("is-active", isEditingBlocking && logicTool === "wall");
  controls.doorModeButton.classList.toggle("is-active", isEditingBlocking && logicTool === "door");
  controls.roomModeButton.classList.toggle("is-active", isEditingBlocking && logicTool === "room");
  controls.wallModeButton.setAttribute("aria-pressed", String(isEditingBlocking && logicTool === "wall"));
  controls.doorModeButton.setAttribute("aria-pressed", String(isEditingBlocking && logicTool === "door"));
  controls.roomModeButton.setAttribute("aria-pressed", String(isEditingBlocking && logicTool === "room"));
  controls.canvas.classList.toggle(
    "is-wall-mode",
    isEditingBlocking && (logicTool === "wall" || logicTool === "door" || logicTool === "room"),
  );
  controls.canvas.classList.toggle("is-art-mode", isEditingBackground);
  controls.canvas.classList.toggle("is-play-mode", isLoggedIn && appMode === "play");
}
