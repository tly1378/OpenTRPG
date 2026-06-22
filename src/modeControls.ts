import type { AppMode, EditMode, LogicTool } from "./types";

type ModeControls = {
  modeSelectLabel: HTMLLabelElement;
  modeSelect: HTMLSelectElement;
  editModeSelectLabel: HTMLLabelElement;
  editModeSelect: HTMLSelectElement;
  uploadInput: HTMLInputElement;
  uploadButton: HTMLLabelElement;
  addTokenButton: HTMLButtonElement;
  deleteTokenButton: HTMLButtonElement;
  wallModeButton: HTMLButtonElement;
  doorModeButton: HTMLButtonElement;
  roomModeButton: HTMLButtonElement;
  clearWallsButton: HTMLButtonElement;
  resetSizeButton: HTMLButtonElement;
  layerUpButton: HTMLButtonElement;
  layerDownButton: HTMLButtonElement;
  layerTopButton: HTMLButtonElement;
  layerBottomButton: HTMLButtonElement;
  canvas: HTMLCanvasElement;
};

export function updateModeControls(
  controls: ModeControls,
  params: {
    appMode: AppMode;
    editMode: EditMode;
    logicTool: LogicTool;
    isLoggedIn: boolean;
    isAdmin: boolean;
  },
): void {
  const { appMode, editMode, logicTool, isLoggedIn, isAdmin } = params;
  const isEditing = isLoggedIn && isAdmin && appMode === "edit";
  const isEditingBackground = isEditing && editMode === "background";
  const isEditingBlocking = isEditing && editMode === "blocking";
  const isEditingTokens = isEditing && editMode === "tokens";
  const isEditingRooms = isEditing && editMode === "rooms";

  controls.modeSelect.value = appMode;
  controls.modeSelect.disabled = !isLoggedIn || !isAdmin;
  controls.modeSelectLabel.classList.toggle("is-hidden", !isLoggedIn || !isAdmin);
  controls.editModeSelect.value = editMode;
  controls.editModeSelect.disabled = !isEditing;
  controls.editModeSelectLabel.classList.toggle("is-hidden", appMode !== "edit" || !isLoggedIn || !isAdmin);

  controls.uploadInput.disabled = !isEditingBackground;
  controls.uploadButton.classList.toggle("is-disabled", controls.uploadInput.disabled);
  controls.uploadButton.classList.toggle("is-hidden", !isEditingBackground);
  controls.addTokenButton.disabled = !isEditingTokens;
  controls.addTokenButton.classList.toggle("is-hidden", !isEditingTokens);
  controls.deleteTokenButton.disabled = !isEditingTokens;
  controls.deleteTokenButton.classList.toggle("is-hidden", !isEditingTokens);
  controls.wallModeButton.disabled = !isEditingBlocking;
  controls.wallModeButton.classList.toggle("is-hidden", !isEditingBlocking);
  controls.doorModeButton.disabled = !isEditingBlocking;
  controls.doorModeButton.classList.toggle("is-hidden", !isEditingBlocking);
  controls.roomModeButton.disabled = !isEditingRooms;
  controls.roomModeButton.classList.toggle("is-hidden", !isEditingRooms);
  controls.clearWallsButton.disabled = !isEditingBlocking;
  controls.clearWallsButton.classList.toggle("is-hidden", !isEditingBlocking);
  controls.resetSizeButton.disabled = !isEditingBackground;
  controls.layerUpButton.disabled = !isEditingBackground;
  controls.layerDownButton.disabled = !isEditingBackground;
  controls.layerTopButton.disabled = !isEditingBackground;
  controls.layerBottomButton.disabled = !isEditingBackground;

  controls.addTokenButton.classList.toggle("is-active", isEditingTokens && logicTool === "add-token");
  controls.deleteTokenButton.classList.toggle("is-active", isEditingTokens && logicTool === "delete-token");
  controls.wallModeButton.classList.toggle("is-active", isEditingBlocking && logicTool === "wall");
  controls.doorModeButton.classList.toggle("is-active", isEditingBlocking && logicTool === "door");
  controls.roomModeButton.classList.toggle("is-active", isEditingRooms);
  controls.addTokenButton.setAttribute("aria-pressed", String(isEditingTokens && logicTool === "add-token"));
  controls.deleteTokenButton.setAttribute("aria-pressed", String(isEditingTokens && logicTool === "delete-token"));
  controls.wallModeButton.setAttribute("aria-pressed", String(isEditingBlocking && logicTool === "wall"));
  controls.doorModeButton.setAttribute("aria-pressed", String(isEditingBlocking && logicTool === "door"));
  controls.roomModeButton.setAttribute("aria-pressed", String(isEditingRooms));
  controls.canvas.classList.toggle(
    "is-wall-mode",
    (isEditingBlocking && (logicTool === "wall" || logicTool === "door")) || isEditingRooms,
  );
  controls.canvas.classList.toggle("is-art-mode", isEditingBackground);
  controls.canvas.classList.toggle("is-play-mode", isLoggedIn && appMode === "play");
}
