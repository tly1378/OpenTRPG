import type { Vector2 } from "./types";

export type LoadedImageFile = {
  image: HTMLImageElement;
  name: string;
  src: string;
};

export async function loadImageSource(src: string, name: string): Promise<HTMLImageElement> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`无法读取图片：${name}`));
    image.src = src;
  });

  return image;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error(`无法读取图片：${file.name}`));
      }
    };
    reader.onerror = () => reject(new Error(`无法读取图片：${file.name}`));
    reader.readAsDataURL(file);
  });
}

export async function loadImageFile(file: File): Promise<LoadedImageFile | null> {
  if (!file.type.startsWith("image/")) {
    return null;
  }

  const src = await readFileAsDataUrl(file);
  const image = await loadImageSource(src, file.name);

  return { image, name: file.name, src };
}

export function hasDraggedImage(event: DragEvent): boolean {
  const items = event.dataTransfer?.items;
  const files = event.dataTransfer?.files;

  if (items?.length) {
    return [...items].some((item) => item.kind === "file" && item.type.startsWith("image/"));
  }

  return files ? [...files].some((file) => file.type.startsWith("image/")) : false;
}

export async function loadImageFiles(files: FileList | File[]): Promise<LoadedImageFile[]> {
  const loadedImages = await Promise.all([...files].map((file) => loadImageFile(file)));

  return loadedImages.filter((image): image is LoadedImageFile => image !== null);
}

export function defaultImageDropPoint(canvas: HTMLCanvasElement): Vector2 {
  return {
    x: canvas.clientWidth / 2,
    y: canvas.clientHeight / 2,
  };
}
