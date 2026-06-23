import type { Interaction, SceneImage, Vector2 } from "../core/types";
import { defaultImageDropPoint, loadImageFiles } from "../modules/image/imageImport";
import { createSceneImage, moveImageLayer, normalizeImageZIndexes, resetImageSize } from "../modules/scene/sceneActions";
import { sceneImageSnapshot, sceneImageSnapshots } from "../services/sceneSnapshotSync";

export class BackgroundImageController {
  constructor(
    private readonly state: {
      canvas: HTMLCanvasElement;
      sceneImages: SceneImage[];
      getNextZ: () => number;
      setNextZ: (nextZ: number) => void;
      getSelectedImage: () => SceneImage | null;
      setSelectedImageId: (imageId: string | null) => void;
      getInteraction: () => Interaction | null;
      setInteraction: (interaction: Interaction | null) => void;
    },
    private readonly viewport: {
      screenToWorld: (point: Vector2) => Vector2;
    },
    private readonly queries: {
      isEditingBackground: () => boolean;
    },
    private readonly actions: {
      selectImage: (imageId: string | null) => void;
      updateSelectionPanel: () => void;
    },
    private readonly network: {
      sendImageAdded: (image: ReturnType<typeof sceneImageSnapshot>) => void;
      sendImageUpdated: (image: ReturnType<typeof sceneImageSnapshot>) => void;
      sendImagesUpdated: (images: ReturnType<typeof sceneImageSnapshots>) => void;
      sendImageDeleted: (imageId: string) => void;
    },
  ) {}

  handleFiles(files: FileList | File[], screenPoint?: Vector2): void {
    const targetWorldPoint = this.viewport.screenToWorld(screenPoint ?? defaultImageDropPoint(this.state.canvas));

    void loadImageFiles(files)
      .then((loadedImages) => {
        for (const loadedImage of loadedImages) {
          this.addImageElement(loadedImage.image, loadedImage.src, loadedImage.name, targetWorldPoint);
        }
      })
      .catch((error: unknown) => {
        console.error(error);
      });
  }

  moveLayer(direction: "up" | "down" | "top" | "bottom"): void {
    const selectedImage = this.state.getSelectedImage();
    if (!selectedImage) {
      return;
    }

    this.state.setNextZ(moveImageLayer(this.state.sceneImages, selectedImage, direction, this.state.getNextZ()));
    this.network.sendImagesUpdated(sceneImageSnapshots(this.state.sceneImages));
  }

  resetSelectedImageSize(): void {
    const selectedImage = this.state.getSelectedImage();
    if (!selectedImage) {
      return;
    }

    resetImageSize(selectedImage);
    this.network.sendImageUpdated(sceneImageSnapshot(selectedImage));
  }

  deleteSelectedImage(): void {
    const selectedImage = this.state.getSelectedImage();
    if (!selectedImage || !this.queries.isEditingBackground()) {
      return;
    }

    const imageIndex = this.state.sceneImages.findIndex((image) => image.id === selectedImage.id);
    if (imageIndex === -1) {
      return;
    }

    this.state.sceneImages.splice(imageIndex, 1);
    this.normalizeZIndexes();
    this.state.setSelectedImageId(null);

    const interaction = this.state.getInteraction();
    if (
      interaction &&
      (interaction.type === "move-image" || interaction.type === "resize-image" || interaction.type === "rotate-image") &&
      interaction.imageId === selectedImage.id
    ) {
      this.state.setInteraction(null);
    }

    this.actions.updateSelectionPanel();
    this.network.sendImageDeleted(selectedImage.id);
  }

  normalizeZIndexes(): void {
    this.state.setNextZ(normalizeImageZIndexes(this.state.sceneImages));
  }

  private addImageElement(imageElement: HTMLImageElement, src: string, name: string, worldPoint: Vector2): void {
    const entity = createSceneImage(imageElement, src, name, worldPoint, this.state.getNextZ());
    this.state.setNextZ(this.state.getNextZ() + 1);

    this.state.sceneImages.push(entity);
    this.normalizeZIndexes();
    this.actions.selectImage(entity.id);
    this.network.sendImageAdded(sceneImageSnapshot(entity));
  }
}
