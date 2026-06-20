import type { Vector2 } from "./types";

export async function loadImageFile(file: File): Promise<{ image: HTMLImageElement; name: string } | null> {
  if (!file.type.startsWith("image/")) {
    return null;
  }

  const url = URL.createObjectURL(file);
  const image = new Image();

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(`无法读取图片：${file.name}`));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }

  return { image, name: file.name };
}

export function hasDraggedImage(event: DragEvent): boolean {
  const items = event.dataTransfer?.items;
  const files = event.dataTransfer?.files;

  if (items?.length) {
    return [...items].some((item) => item.kind === "file" && item.type.startsWith("image/"));
  }

  return files ? [...files].some((file) => file.type.startsWith("image/")) : false;
}

export async function loadImageFiles(files: FileList | File[]): Promise<Array<{ image: HTMLImageElement; name: string }>> {
  const loadedImages = await Promise.all([...files].map((file) => loadImageFile(file)));

  return loadedImages.filter((image): image is { image: HTMLImageElement; name: string } => image !== null);
}

export function defaultImageDropPoint(canvas: HTMLCanvasElement): Vector2 {
  return {
    x: canvas.clientWidth / 2,
    y: canvas.clientHeight / 2,
  };
}
