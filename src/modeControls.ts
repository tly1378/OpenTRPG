import type { AppMode, LogicTool } from "./types";

type ModeControls = {
  modeSelect: HTMLSelectElement;
  uploadInput: HTMLInputElement;
  uploadButton: HTMLLabelElement;
  addTokenButton: HTMLButtonElement;
  deleteTokenButton: HTMLButtonElement;
  wallModeButton: HTMLButtonElement;
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
    logicTool: LogicTool;
    isLoggedIn: boolean;
    isAdmin: boolean;
  },
): void {
  const { appMode, logicTool, isLoggedIn, isAdmin } = params;

  controls.modeSelect.value = appMode;
  controls.modeSelect.disabled = !isLoggedIn;

  controls.uploadInput.disabled = !isLoggedIn || appMode !== "art" || !isAdmin;
  controls.uploadButton.classList.toggle("is-disabled", controls.uploadInput.disabled);
  controls.uploadButton.classList.toggle("is-hidden", !isLoggedIn || appMode !== "art" || !isAdmin);
  controls.addTokenButton.disabled = !isLoggedIn || appMode !== "logic" || !isAdmin;
  controls.addTokenButton.classList.toggle("is-hidden", !isLoggedIn || appMode !== "logic" || !isAdmin);
  controls.deleteTokenButton.disabled = !isLoggedIn || appMode !== "logic" || !isAdmin;
  controls.deleteTokenButton.classList.toggle("is-hidden", !isLoggedIn || appMode !== "logic" || !isAdmin);
  controls.wallModeButton.disabled = !isLoggedIn || appMode !== "logic" || !isAdmin;
  controls.wallModeButton.classList.toggle("is-hidden", !isLoggedIn || appMode !== "logic" || !isAdmin);
  controls.clearWallsButton.disabled = !isLoggedIn || appMode !== "logic" || !isAdmin;
  controls.clearWallsButton.classList.toggle("is-hidden", !isLoggedIn || appMode !== "logic" || !isAdmin);
  controls.resetSizeButton.disabled = !isLoggedIn || appMode !== "art" || !isAdmin;
  controls.layerUpButton.disabled = !isLoggedIn || appMode !== "art" || !isAdmin;
  controls.layerDownButton.disabled = !isLoggedIn || appMode !== "art" || !isAdmin;
  controls.layerTopButton.disabled = !isLoggedIn || appMode !== "art" || !isAdmin;
  controls.layerBottomButton.disabled = !isLoggedIn || appMode !== "art" || !isAdmin;

  controls.addTokenButton.classList.toggle("is-active", isAdmin && appMode === "logic" && logicTool === "add-token");
  controls.deleteTokenButton.classList.toggle("is-active", isAdmin && appMode === "logic" && logicTool === "delete-token");
  controls.wallModeButton.classList.toggle("is-active", isAdmin && appMode === "logic" && logicTool === "wall");
  controls.addTokenButton.setAttribute("aria-pressed", String(isAdmin && appMode === "logic" && logicTool === "add-token"));
  controls.deleteTokenButton.setAttribute("aria-pressed", String(isAdmin && appMode === "logic" && logicTool === "delete-token"));
  controls.wallModeButton.setAttribute("aria-pressed", String(isAdmin && appMode === "logic" && logicTool === "wall"));
  controls.canvas.classList.toggle("is-wall-mode", isAdmin && appMode === "logic" && logicTool === "wall");
  controls.canvas.classList.toggle("is-art-mode", isLoggedIn && appMode === "art");
  controls.canvas.classList.toggle("is-play-mode", isLoggedIn && appMode === "play");
}
