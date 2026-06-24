export function installBackdropDismiss(overlay: HTMLElement, onDismiss: () => void): void {
  let pressedOnBackdrop = false;

  overlay.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      pressedOnBackdrop = false;
      return;
    }

    pressedOnBackdrop = event.target === overlay;
  });

  overlay.addEventListener("pointerup", (event) => {
    if (event.button !== 0) {
      pressedOnBackdrop = false;
      return;
    }

    if (pressedOnBackdrop && event.target === overlay) {
      onDismiss();
    }

    pressedOnBackdrop = false;
  });

  overlay.addEventListener("pointercancel", () => {
    pressedOnBackdrop = false;
  });
}
