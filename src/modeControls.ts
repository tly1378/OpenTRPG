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
  const isEditingArt = isLoggedIn && isAdmin && appMode === "edit" && editMode === "art";
  const isEditingLogic = isLoggedIn && isAdmin && appMode === "edit" && editMode === "logic";

  controls.modeSelect.value = appMode;
  controls.modeSelect.disabled = !isLoggedIn || !isAdmin;
  controls.modeSelectLabel.classList.toggle("is-hidden", !isLoggedIn || !isAdmin);
  controls.editModeSelect.value = editMode;
  controls.editModeSelect.disabled = !isEditingArt && !isEditingLogic;
  controls.editModeSelectLabel.classList.toggle("is-hidden", appMode !== "edit" || !isLoggedIn || !isAdmin);

  controls.uploadInput.disabled = !isEditingArt;
  controls.uploadButton.classList.toggle("is-disabled", controls.uploadInput.disabled);
  controls.uploadButton.classList.toggle("is-hidden", !isEditingArt);
  controls.addTokenButton.disabled = !isEditingLogic;
  controls.addTokenButton.classList.toggle("is-hidden", !isEditingLogic);
  controls.deleteTokenButton.disabled = !isEditingLogic;
  controls.deleteTokenButton.classList.toggle("is-hidden", !isEditingLogic);
  controls.wallModeButton.disabled = !isEditingLogic;
  controls.wallModeButton.classList.toggle("is-hidden", !isEditingLogic);
  controls.doorModeButton.disabled = !isEditingLogic;
  controls.doorModeButton.classList.toggle("is-hidden", !isEditingLogic);
  controls.clearWallsButton.disabled = !isEditingLogic;
  controls.clearWallsButton.classList.toggle("is-hidden", !isEditingLogic);
  controls.resetSizeButton.disabled = !isEditingArt;
  controls.layerUpButton.disabled = !isEditingArt;
  controls.layerDownButton.disabled = !isEditingArt;
  controls.layerTopButton.disabled = !isEditingArt;
  controls.layerBottomButton.disabled = !isEditingArt;

  controls.addTokenButton.classList.toggle("is-active", isEditingLogic && logicTool === "add-token");
  controls.deleteTokenButton.classList.toggle("is-active", isEditingLogic && logicTool === "delete-token");
  controls.wallModeButton.classList.toggle("is-active", isEditingLogic && logicTool === "wall");
  controls.doorModeButton.classList.toggle("is-active", isEditingLogic && logicTool === "door");
  controls.addTokenButton.setAttribute("aria-pressed", String(isEditingLogic && logicTool === "add-token"));
  controls.deleteTokenButton.setAttribute("aria-pressed", String(isEditingLogic && logicTool === "delete-token"));
  controls.wallModeButton.setAttribute("aria-pressed", String(isEditingLogic && logicTool === "wall"));
  controls.doorModeButton.setAttribute("aria-pressed", String(isEditingLogic && logicTool === "door"));
  controls.canvas.classList.toggle("is-wall-mode", isEditingLogic && (logicTool === "wall" || logicTool === "door"));
  controls.canvas.classList.toggle("is-art-mode", isEditingArt);
  controls.canvas.classList.toggle("is-play-mode", isLoggedIn && appMode === "play");
}
