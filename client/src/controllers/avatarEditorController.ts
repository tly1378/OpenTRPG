import { loadImageFile, loadImageSource } from "../modules/image/imageImport";

type TokenAvatarImage = {
  src: string;
  image: HTMLImageElement;
};

export type IconEditSubject = {
  id: string;
  name: string;
  iconSrc?: string;
  iconScale?: number;
  iconOffsetX?: number;
  iconOffsetY?: number;
};

type AvatarEditorState = {
  subjectId: string;
  src: string;
  image: HTMLImageElement;
  scale: number;
  offsetX: number;
  offsetY: number;
  drag: {
    pointerId: number;
    startPointer: { x: number; y: number };
    startOffsetX: number;
    startOffsetY: number;
  } | null;
};

export class AvatarEditorController {
  private editor: AvatarEditorState | null = null;

  constructor(
    private readonly elements: {
      overlay: HTMLElement;
      stage: HTMLDivElement;
      image: HTMLImageElement;
    },
    private readonly state: {
      getIconSubject: () => IconEditSubject | null;
      canEditIcon: () => boolean;
      findSubjectById: (subjectId: string) => IconEditSubject | null;
      iconImages: () => Map<string, TokenAvatarImage>;
    },
    private readonly actions: {
      onIconSaved: (subject: IconEditSubject) => void;
    },
  ) {
    this.installStageHandlers();
  }

  async uploadSelected(file: File): Promise<void> {
    const subject = this.state.getIconSubject();
    if (!subject || !this.state.canEditIcon()) {
      return;
    }

    const loadedAvatar = await loadImageFile(file);
    if (!loadedAvatar) {
      return;
    }

    this.open(subject, loadedAvatar.src, loadedAvatar.image, {
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    });
  }

  async editSelected(): Promise<void> {
    const subject = this.state.getIconSubject();
    if (!subject || !this.state.canEditIcon() || !subject.iconSrc) {
      return;
    }

    const cachedAvatar = this.state.iconImages().get(subject.id);
    const image =
      cachedAvatar?.src === subject.iconSrc ? cachedAvatar.image : await loadImageSource(subject.iconSrc, `${subject.name} 图标`);

    this.open(subject, subject.iconSrc, image, {
      scale: subject.iconScale ?? 1,
      offsetX: subject.iconOffsetX ?? 0,
      offsetY: subject.iconOffsetY ?? 0,
    });
  }

  resetSelectedAdjustment(): void {
    const subject = this.state.getIconSubject();
    if (!subject || !this.state.canEditIcon() || !subject.iconSrc) {
      return;
    }

    subject.iconScale = 1;
    subject.iconOffsetX = 0;
    subject.iconOffsetY = 0;
    this.actions.onIconSaved(subject);
  }

  render(): void {
    if (!this.editor) {
      this.elements.overlay.hidden = true;
      return;
    }

    this.elements.overlay.hidden = false;
    const nextTransform = this.clampTransform(this.editor, this.editor);
    this.editor.scale = nextTransform.scale;
    this.editor.offsetX = nextTransform.offsetX;
    this.editor.offsetY = nextTransform.offsetY;

    const maskSize = this.maskSize();
    const maskRadius = maskSize / 2;
    const ratio = this.editor.image.naturalWidth / this.editor.image.naturalHeight || 1;
    const width = ratio >= 1 ? maskSize * this.editor.scale * ratio : maskSize * this.editor.scale;
    const height = ratio >= 1 ? maskSize * this.editor.scale : (maskSize * this.editor.scale) / ratio;

    this.elements.image.src = this.editor.src;
    this.elements.image.style.width = `${width}px`;
    this.elements.image.style.height = `${height}px`;
    this.elements.image.style.left = `${this.elements.stage.clientWidth / 2 + this.editor.offsetX * maskRadius}px`;
    this.elements.image.style.top = `${this.elements.stage.clientHeight / 2 + this.editor.offsetY * maskRadius}px`;
    this.elements.image.style.transform = "translate(-50%, -50%)";
  }

  close(): void {
    this.editor = null;
    this.elements.stage.classList.remove("is-dragging");
    this.elements.overlay.hidden = true;
  }

  save(): void {
    if (!this.editor) {
      return;
    }

    const subject = this.state.findSubjectById(this.editor.subjectId);
    if (!subject || !this.state.canEditIcon()) {
      this.close();
      return;
    }

    const transform = this.clampTransform(this.editor, this.editor);
    subject.iconSrc = this.editor.src;
    subject.iconScale = transform.scale;
    subject.iconOffsetX = transform.offsetX;
    subject.iconOffsetY = transform.offsetY;
    this.state.iconImages().set(subject.id, { src: this.editor.src, image: this.editor.image });
    this.actions.onIconSaved(subject);
    this.close();
  }

  private open(
    subject: IconEditSubject,
    src: string,
    image: HTMLImageElement,
    transform: { scale: number; offsetX: number; offsetY: number },
  ): void {
    this.editor = {
      subjectId: subject.id,
      src,
      image,
      scale: transform.scale,
      offsetX: transform.offsetX,
      offsetY: transform.offsetY,
      drag: null,
    };
    this.render();
  }

  private maskSize(): number {
    return this.elements.stage.clientWidth * 0.72;
  }

  private clampTransform(
    editor: Pick<AvatarEditorState, "image">,
    transform: { scale: number; offsetX: number; offsetY: number },
  ): { scale: number; offsetX: number; offsetY: number } {
    const maskSize = this.maskSize();
    const maskRadius = maskSize / 2;
    const ratio = editor.image.naturalWidth / editor.image.naturalHeight || 1;
    const scale = Math.min(3, Math.max(1, transform.scale));
    const imageWidth = ratio >= 1 ? maskSize * scale * ratio : maskSize * scale;
    const imageHeight = ratio >= 1 ? maskSize * scale : (maskSize * scale) / ratio;
    const maxOffsetX = Math.max(0, (imageWidth - maskSize) / 2) / maskRadius;
    const maxOffsetY = Math.max(0, (imageHeight - maskSize) / 2) / maskRadius;

    return {
      scale,
      offsetX: Math.min(maxOffsetX, Math.max(-maxOffsetX, transform.offsetX)),
      offsetY: Math.min(maxOffsetY, Math.max(-maxOffsetY, transform.offsetY)),
    };
  }

  private installStageHandlers(): void {
    this.elements.stage.addEventListener("pointerdown", (event) => {
      if (!this.editor || event.button !== 0) {
        return;
      }

      event.preventDefault();
      this.editor.drag = {
        pointerId: event.pointerId,
        startPointer: { x: event.clientX, y: event.clientY },
        startOffsetX: this.editor.offsetX,
        startOffsetY: this.editor.offsetY,
      };
      this.elements.stage.classList.add("is-dragging");
      this.elements.stage.setPointerCapture(event.pointerId);
    });

    this.elements.stage.addEventListener("pointermove", (event) => {
      if (!this.editor?.drag || this.editor.drag.pointerId !== event.pointerId) {
        return;
      }

      const maskRadius = this.maskSize() / 2;
      const nextTransform = this.clampTransform(this.editor, {
        scale: this.editor.scale,
        offsetX: this.editor.drag.startOffsetX + (event.clientX - this.editor.drag.startPointer.x) / maskRadius,
        offsetY: this.editor.drag.startOffsetY + (event.clientY - this.editor.drag.startPointer.y) / maskRadius,
      });

      this.editor.scale = nextTransform.scale;
      this.editor.offsetX = nextTransform.offsetX;
      this.editor.offsetY = nextTransform.offsetY;
      this.render();
    });

    this.elements.stage.addEventListener("pointerup", (event) => {
      if (this.editor?.drag?.pointerId === event.pointerId) {
        this.editor.drag = null;
        this.elements.stage.classList.remove("is-dragging");
        this.elements.stage.releasePointerCapture(event.pointerId);
      }
    });

    this.elements.stage.addEventListener("pointercancel", (event) => {
      if (this.editor?.drag?.pointerId === event.pointerId) {
        this.editor.drag = null;
        this.elements.stage.classList.remove("is-dragging");
      }
    });

    this.elements.stage.addEventListener(
      "wheel",
      (event) => {
        if (!this.editor) {
          return;
        }

        event.preventDefault();
        const zoomFactor = Math.exp(-event.deltaY * 0.001);
        const nextTransform = this.clampTransform(this.editor, {
          scale: this.editor.scale * zoomFactor,
          offsetX: this.editor.offsetX,
          offsetY: this.editor.offsetY,
        });

        this.editor.scale = nextTransform.scale;
        this.editor.offsetX = nextTransform.offsetX;
        this.editor.offsetY = nextTransform.offsetY;
        this.render();
      },
      { passive: false },
    );
  }
}
