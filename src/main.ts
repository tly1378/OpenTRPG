import "./styles.css";

type Vector2 = {
  x: number;
  y: number;
};

type ClientPointEvent = {
  clientX: number;
  clientY: number;
};

type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

type SceneImage = {
  id: string;
  image: HTMLImageElement;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  rotation: number;
  z: number;
};

type Interaction =
  | {
      type: "move-image";
      imageId: string;
      pointerId: number;
      startPointer: Vector2;
      startImage: Vector2;
    }
  | {
      type: "resize-image";
      imageId: string;
      pointerId: number;
      handle: ResizeHandle;
      startCenter: Vector2;
      startWidth: number;
      startHeight: number;
      startRotation: number;
    }
  | {
      type: "rotate-image";
      imageId: string;
      pointerId: number;
      startAngle: number;
      startRotation: number;
    }
  | {
      type: "pan-camera";
      pointerId: number;
      startPointer: Vector2;
      startCamera: Vector2;
    };

function mustQuery<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`页面初始化失败：缺少 ${selector}。`);
  }

  return element;
}

const canvas = mustQuery<HTMLCanvasElement>("#world-canvas");
const moveCameraButton = mustQuery<HTMLButtonElement>("#move-camera-button");
const uploadInput = mustQuery<HTMLInputElement>("#image-upload");
const dropOverlay = mustQuery<HTMLDivElement>("#drop-overlay");
const selectionPanel = mustQuery<HTMLDivElement>("#selection-panel");
const selectionTitle = mustQuery<HTMLDivElement>("#selection-title");
const resetSizeButton = mustQuery<HTMLButtonElement>("#reset-size");
const layerUpButton = mustQuery<HTMLButtonElement>("#layer-up");
const layerDownButton = mustQuery<HTMLButtonElement>("#layer-down");
const layerTopButton = mustQuery<HTMLButtonElement>("#layer-top");
const layerBottomButton = mustQuery<HTMLButtonElement>("#layer-bottom");

function mustGetCanvasContext(targetCanvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = targetCanvas.getContext("2d");

  if (!context) {
    throw new Error("页面初始化失败：当前浏览器不支持 Canvas 2D。");
  }

  return context;
}

const ctx = mustGetCanvasContext(canvas);

const camera = {
  x: 0,
  y: 0,
  zoom: 1,
};

const pointer = {
  x: 0,
  y: 0,
};

const keys = new Set<string>();
const sceneImages: SceneImage[] = [];

let selectedImageId: string | null = null;
let interaction: Interaction | null = null;
let cameraMoveMode = false;
let lastFrameTime = performance.now();
let nextZ = 1;
let dragDepth = 0;

const HANDLE_RADIUS = 8;
const ROTATE_HANDLE_DISTANCE = 44;
const MIN_IMAGE_SIZE = 24;
const CAMERA_SPEED = 680;

function screenSize(): Vector2 {
  return {
    x: canvas.clientWidth,
    y: canvas.clientHeight,
  };
}

function screenToWorld(point: Vector2): Vector2 {
  const size = screenSize();

  return {
    x: (point.x - size.x / 2) / camera.zoom + camera.x,
    y: -(point.y - size.y / 2) / camera.zoom + camera.y,
  };
}

function worldToScreen(point: Vector2): Vector2 {
  const size = screenSize();

  return {
    x: (point.x - camera.x) * camera.zoom + size.x / 2,
    y: -(point.y - camera.y) * camera.zoom + size.y / 2,
  };
}

function rotate(point: Vector2, radians: number): Vector2 {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

function add(a: Vector2, b: Vector2): Vector2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

function subtract(a: Vector2, b: Vector2): Vector2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function distance(a: Vector2, b: Vector2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getSelectedImage(): SceneImage | null {
  return sceneImages.find((image) => image.id === selectedImageId) ?? null;
}

function normalizeZIndexes(): void {
  sceneImages
    .sort((a, b) => a.z - b.z)
    .forEach((image, index) => {
      image.z = index + 1;
    });
  nextZ = sceneImages.length + 1;
}

function sortedImagesAscending(): SceneImage[] {
  return [...sceneImages].sort((a, b) => a.z - b.z);
}

function resizeCanvas(): void {
  const dpr = window.devicePixelRatio || 1;
  const width = Math.floor(canvas.clientWidth * dpr);
  const height = Math.floor(canvas.clientHeight * dpr);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawGrid(): void {
  const size = screenSize();
  const topLeft = screenToWorld({ x: 0, y: 0 });
  const bottomRight = screenToWorld(size);
  const baseStep = 64;
  const step = baseStep * Math.max(1, Math.pow(2, Math.floor(Math.log2(1 / camera.zoom))));
  const majorStep = step * 5;

  ctx.save();
  ctx.lineWidth = 1;

  for (let x = Math.floor(topLeft.x / step) * step; x <= bottomRight.x; x += step) {
    const screen = worldToScreen({ x, y: 0 }).x;
    const isMajor = Math.abs(x % majorStep) < 0.001;
    ctx.strokeStyle = isMajor ? "rgb(92 114 142 / 0.28)" : "rgb(92 114 142 / 0.14)";
    ctx.beginPath();
    ctx.moveTo(screen, 0);
    ctx.lineTo(screen, size.y);
    ctx.stroke();
  }

  for (let y = Math.floor(bottomRight.y / step) * step; y <= topLeft.y; y += step) {
    const screen = worldToScreen({ x: 0, y }).y;
    const isMajor = Math.abs(y % majorStep) < 0.001;
    ctx.strokeStyle = isMajor ? "rgb(92 114 142 / 0.28)" : "rgb(92 114 142 / 0.14)";
    ctx.beginPath();
    ctx.moveTo(0, screen);
    ctx.lineTo(size.x, screen);
    ctx.stroke();
  }

  const origin = worldToScreen({ x: 0, y: 0 });
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgb(104 191 255 / 0.68)";
  ctx.beginPath();
  ctx.moveTo(origin.x, 0);
  ctx.lineTo(origin.x, size.y);
  ctx.moveTo(0, origin.y);
  ctx.lineTo(size.x, origin.y);
  ctx.stroke();

  ctx.fillStyle = "#7fd3ff";
  ctx.font = "12px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("(0, 0)", origin.x + 8, origin.y - 8);
  ctx.restore();
}

function drawImageEntity(entity: SceneImage): void {
  const screen = worldToScreen({ x: entity.x, y: entity.y });

  ctx.save();
  ctx.translate(screen.x, screen.y);
  ctx.rotate(-entity.rotation);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.drawImage(entity.image, -entity.width / 2, -entity.height / 2, entity.width, entity.height);
  ctx.restore();
}

function getImageCorners(entity: SceneImage): Record<"nw" | "ne" | "sw" | "se", Vector2> {
  const handles = getResizeHandlePositions(entity);

  return {
    nw: handles.nw,
    ne: handles.ne,
    sw: handles.sw,
    se: handles.se,
  };
}

function getResizeHandlePositions(entity: SceneImage): Record<ResizeHandle, Vector2> {
  const halfWidth = entity.width / 2;
  const halfHeight = entity.height / 2;

  return {
    nw: add({ x: entity.x, y: entity.y }, rotate({ x: -halfWidth, y: halfHeight }, entity.rotation)),
    n: add({ x: entity.x, y: entity.y }, rotate({ x: 0, y: halfHeight }, entity.rotation)),
    ne: add({ x: entity.x, y: entity.y }, rotate({ x: halfWidth, y: halfHeight }, entity.rotation)),
    e: add({ x: entity.x, y: entity.y }, rotate({ x: halfWidth, y: 0 }, entity.rotation)),
    se: add({ x: entity.x, y: entity.y }, rotate({ x: halfWidth, y: -halfHeight }, entity.rotation)),
    s: add({ x: entity.x, y: entity.y }, rotate({ x: 0, y: -halfHeight }, entity.rotation)),
    sw: add({ x: entity.x, y: entity.y }, rotate({ x: -halfWidth, y: -halfHeight }, entity.rotation)),
    w: add({ x: entity.x, y: entity.y }, rotate({ x: -halfWidth, y: 0 }, entity.rotation)),
  };
}

function getRotateHandlePosition(entity: SceneImage): Vector2 {
  return add(
    { x: entity.x, y: entity.y },
    rotate({ x: 0, y: entity.height / 2 + ROTATE_HANDLE_DISTANCE / camera.zoom }, entity.rotation),
  );
}

function drawSelection(entity: SceneImage): void {
  const corners = getImageCorners(entity);
  const handles = getResizeHandlePositions(entity);
  const cornerOrder: Array<"nw" | "ne" | "se" | "sw"> = ["nw", "ne", "se", "sw"];
  const handleOrder: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
  const screenCorners = cornerOrder.map((key) => worldToScreen(corners[key]));
  const screenHandles = handleOrder.map((key) => worldToScreen(handles[key]));
  const rotateHandle = worldToScreen(getRotateHandlePosition(entity));
  const topMiddle = {
    x: (screenCorners[0].x + screenCorners[1].x) / 2,
    y: (screenCorners[0].y + screenCorners[1].y) / 2,
  };

  ctx.save();
  ctx.strokeStyle = "#68bfff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  screenCorners.forEach((corner, index) => {
    if (index === 0) {
      ctx.moveTo(corner.x, corner.y);
    } else {
      ctx.lineTo(corner.x, corner.y);
    }
  });
  ctx.closePath();
  ctx.stroke();

  ctx.strokeStyle = "rgb(104 191 255 / 0.7)";
  ctx.beginPath();
  ctx.moveTo(topMiddle.x, topMiddle.y);
  ctx.lineTo(rotateHandle.x, rotateHandle.y);
  ctx.stroke();

  ctx.fillStyle = "#101319";
  ctx.strokeStyle = "#68bfff";
  for (const handle of screenHandles) {
    ctx.beginPath();
    ctx.rect(handle.x - HANDLE_RADIUS, handle.y - HANDLE_RADIUS, HANDLE_RADIUS * 2, HANDLE_RADIUS * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(rotateHandle.x, rotateHandle.y, HANDLE_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function render(): void {
  resizeCanvas();
  const size = screenSize();

  ctx.clearRect(0, 0, size.x, size.y);
  ctx.fillStyle = "#101319";
  ctx.fillRect(0, 0, size.x, size.y);
  drawGrid();

  for (const image of sortedImagesAscending()) {
    drawImageEntity(image);
  }

  const selectedImage = getSelectedImage();
  if (selectedImage) {
    drawSelection(selectedImage);
  }
}

function updateCamera(deltaSeconds: number): void {
  if (!cameraMoveMode) {
    return;
  }

  const direction = { x: 0, y: 0 };

  if (keys.has("w")) direction.y += 1;
  if (keys.has("s")) direction.y -= 1;
  if (keys.has("a")) direction.x -= 1;
  if (keys.has("d")) direction.x += 1;

  const length = Math.hypot(direction.x, direction.y);
  if (length === 0) {
    return;
  }

  const distancePerFrame = (CAMERA_SPEED / camera.zoom) * deltaSeconds;
  camera.x += (direction.x / length) * distancePerFrame;
  camera.y += (direction.y / length) * distancePerFrame;
}

function tick(now: number): void {
  const deltaSeconds = Math.min((now - lastFrameTime) / 1000, 0.05);
  lastFrameTime = now;
  updateCamera(deltaSeconds);
  render();
  updateSelectionPanel();
  requestAnimationFrame(tick);
}

function setCameraMoveMode(nextValue: boolean): void {
  cameraMoveMode = nextValue;
  moveCameraButton.textContent = `移动相机：${cameraMoveMode ? "开启" : "关闭"}`;
  moveCameraButton.classList.toggle("is-active", cameraMoveMode);
  moveCameraButton.setAttribute("aria-pressed", String(cameraMoveMode));
  canvas.classList.toggle("is-camera-mode", cameraMoveMode);
}

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

function pointInImage(entity: SceneImage, worldPoint: Vector2): boolean {
  const local = rotate(subtract(worldPoint, { x: entity.x, y: entity.y }), -entity.rotation);

  return Math.abs(local.x) <= entity.width / 2 && Math.abs(local.y) <= entity.height / 2;
}

function hitTestImage(worldPoint: Vector2): SceneImage | null {
  return [...sceneImages]
    .sort((a, b) => b.z - a.z)
    .find((image) => pointInImage(image, worldPoint)) ?? null;
}

function hitTestResizeHandle(screenPoint: Vector2): ResizeHandle | null {
  const selectedImage = getSelectedImage();
  if (!selectedImage) {
    return null;
  }

  const handles = getResizeHandlePositions(selectedImage);
  const handleOrder: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

  return (
    handleOrder.find((handle) => distance(worldToScreen(handles[handle]), screenPoint) <= HANDLE_RADIUS + 5) ?? null
  );
}

function hitTestRotateHandle(screenPoint: Vector2): boolean {
  const selectedImage = getSelectedImage();

  return selectedImage
    ? distance(worldToScreen(getRotateHandlePosition(selectedImage)), screenPoint) <= HANDLE_RADIUS + 6
    : false;
}

function setCursor(screenPoint: Vector2): void {
  if (interaction) {
    canvas.classList.add("is-dragging");
    return;
  }

  canvas.classList.remove("is-dragging");

  const resizeHandle = hitTestResizeHandle(screenPoint);

  if (hitTestRotateHandle(screenPoint)) {
    canvas.style.cursor = "grab";
  } else if (resizeHandle) {
    canvas.style.cursor = getResizeCursor(resizeHandle);
  } else if (hitTestImage(screenToWorld(screenPoint))) {
    canvas.style.cursor = "move";
  } else {
    canvas.style.cursor = cameraMoveMode ? "grab" : "default";
  }
}

function getResizeCursor(handle: ResizeHandle): string {
  if (handle === "n" || handle === "s") {
    return "ns-resize";
  }

  if (handle === "e" || handle === "w") {
    return "ew-resize";
  }

  if (handle === "ne" || handle === "sw") {
    return "nesw-resize";
  }

  return "nwse-resize";
}

function screenPointFromEvent(event: ClientPointEvent): Vector2 {
  const rect = canvas.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function getHandleSigns(handle: ResizeHandle): Vector2 {
  return {
    x: handle.includes("w") ? -1 : handle.includes("e") ? 1 : 0,
    y: handle.includes("s") ? -1 : handle.includes("n") ? 1 : 0,
  };
}

function resizeWithoutAspectLock(
  currentLocal: Vector2,
  state: Extract<Interaction, { type: "resize-image" }>,
): { centerLocal: Vector2; width: number; height: number } {
  const signs = getHandleSigns(state.handle);
  let left = -state.startWidth / 2;
  let right = state.startWidth / 2;
  let bottom = -state.startHeight / 2;
  let top = state.startHeight / 2;

  if (signs.x < 0) left = Math.min(currentLocal.x, right - MIN_IMAGE_SIZE);
  if (signs.x > 0) right = Math.max(currentLocal.x, left + MIN_IMAGE_SIZE);
  if (signs.y < 0) bottom = Math.min(currentLocal.y, top - MIN_IMAGE_SIZE);
  if (signs.y > 0) top = Math.max(currentLocal.y, bottom + MIN_IMAGE_SIZE);

  return {
    centerLocal: {
      x: (left + right) / 2,
      y: (bottom + top) / 2,
    },
    width: right - left,
    height: top - bottom,
  };
}

function resizeWithAspectLock(
  currentLocal: Vector2,
  state: Extract<Interaction, { type: "resize-image" }>,
): { centerLocal: Vector2; width: number; height: number } {
  const signs = getHandleSigns(state.handle);
  const aspectRatio = state.startWidth / state.startHeight;

  if (signs.x !== 0 && signs.y !== 0) {
    const anchorLocal = {
      x: -signs.x * state.startWidth * 0.5,
      y: -signs.y * state.startHeight * 0.5,
    };
    const widthCandidate = Math.max((currentLocal.x - anchorLocal.x) * signs.x, MIN_IMAGE_SIZE);
    const heightCandidate = Math.max((currentLocal.y - anchorLocal.y) * signs.y, MIN_IMAGE_SIZE);
    const scale = Math.max(widthCandidate / state.startWidth, heightCandidate / state.startHeight);
    const width = Math.max(state.startWidth * scale, MIN_IMAGE_SIZE);
    const height = Math.max(state.startHeight * scale, MIN_IMAGE_SIZE);
    const draggedLocal = {
      x: anchorLocal.x + signs.x * width,
      y: anchorLocal.y + signs.y * height,
    };

    return {
      centerLocal: {
        x: (anchorLocal.x + draggedLocal.x) / 2,
        y: (anchorLocal.y + draggedLocal.y) / 2,
      },
      width,
      height,
    };
  }

  if (signs.x !== 0) {
    const anchorX = -signs.x * state.startWidth * 0.5;
    let width = Math.max((currentLocal.x - anchorX) * signs.x, MIN_IMAGE_SIZE);
    let height = width / aspectRatio;

    if (height < MIN_IMAGE_SIZE) {
      height = MIN_IMAGE_SIZE;
      width = height * aspectRatio;
    }

    return {
      centerLocal: {
        x: anchorX + signs.x * width * 0.5,
        y: 0,
      },
      width,
      height,
    };
  }

  const anchorY = -signs.y * state.startHeight * 0.5;
  let height = Math.max((currentLocal.y - anchorY) * signs.y, MIN_IMAGE_SIZE);
  let width = height * aspectRatio;

  if (width < MIN_IMAGE_SIZE) {
    width = MIN_IMAGE_SIZE;
    height = width / aspectRatio;
  }

  return {
    centerLocal: {
      x: 0,
      y: anchorY + signs.y * height * 0.5,
    },
    width,
    height,
  };
}

function updateResizeInteraction(event: PointerEvent, state: Extract<Interaction, { type: "resize-image" }>): void {
  const entity = sceneImages.find((image) => image.id === state.imageId);
  if (!entity) {
    return;
  }

  const currentWorld = screenToWorld(screenPointFromEvent(event));
  const currentLocal = rotate(subtract(currentWorld, state.startCenter), -state.startRotation);
  const nextSize = event.shiftKey
    ? resizeWithAspectLock(currentLocal, state)
    : resizeWithoutAspectLock(currentLocal, state);
  const nextCenter = add(state.startCenter, rotate(nextSize.centerLocal, state.startRotation));

  entity.x = nextCenter.x;
  entity.y = nextCenter.y;
  entity.width = nextSize.width;
  entity.height = nextSize.height;
}

function updateRotateInteraction(event: PointerEvent, state: Extract<Interaction, { type: "rotate-image" }>): void {
  const entity = sceneImages.find((image) => image.id === state.imageId);
  if (!entity) {
    return;
  }

  const worldPoint = screenToWorld(screenPointFromEvent(event));
  const angle = Math.atan2(worldPoint.y - entity.y, worldPoint.x - entity.x);
  entity.rotation = state.startRotation + angle - state.startAngle;
}

function updateSelectionPanel(): void {
  const selectedImage = getSelectedImage();

  if (!selectedImage) {
    selectionPanel.classList.remove("is-open");
    selectionPanel.setAttribute("aria-hidden", "true");
    return;
  }

  selectionTitle.textContent = selectedImage.name;
  selectionPanel.classList.add("is-open");
  selectionPanel.setAttribute("aria-hidden", "false");
}

function selectImage(imageId: string | null): void {
  selectedImageId = imageId;
  updateSelectionPanel();
}

function addImageElement(imageElement: HTMLImageElement, name: string, worldPoint: Vector2): void {
  const maxInitialSize = 420;
  const ratio = imageElement.naturalWidth / imageElement.naturalHeight || 1;
  const width = ratio >= 1 ? maxInitialSize : maxInitialSize * ratio;
  const height = ratio >= 1 ? maxInitialSize / ratio : maxInitialSize;

  const entity: SceneImage = {
    id: crypto.randomUUID(),
    image: imageElement,
    name,
    x: worldPoint.x,
    y: worldPoint.y,
    width,
    height,
    originalWidth: imageElement.naturalWidth,
    originalHeight: imageElement.naturalHeight,
    rotation: 0,
    z: nextZ++,
  };

  sceneImages.push(entity);
  normalizeZIndexes();
  selectImage(entity.id);
}

async function loadImageFile(file: File, worldPoint: Vector2): Promise<void> {
  if (!file.type.startsWith("image/")) {
    return;
  }

  const url = URL.createObjectURL(file);
  const image = new Image();

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`无法读取图片：${file.name}`));
    image.src = url;
  });

  addImageElement(image, file.name, worldPoint);
}

function handleFiles(files: FileList | File[], screenPoint?: Vector2): void {
  const targetWorldPoint = screenToWorld(screenPoint ?? { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 });

  void Promise.all([...files].map((file) => loadImageFile(file, targetWorldPoint))).catch((error: unknown) => {
    console.error(error);
  });
}

function hasDraggedImage(event: DragEvent): boolean {
  const items = event.dataTransfer?.items;
  const files = event.dataTransfer?.files;

  if (items?.length) {
    return [...items].some((item) => item.kind === "file" && item.type.startsWith("image/"));
  }

  return files ? [...files].some((file) => file.type.startsWith("image/")) : false;
}

function moveLayer(direction: "up" | "down" | "top" | "bottom"): void {
  const selectedImage = getSelectedImage();
  if (!selectedImage) {
    return;
  }

  normalizeZIndexes();

  if (direction === "up") selectedImage.z += 1.5;
  if (direction === "down") selectedImage.z -= 1.5;
  if (direction === "top") selectedImage.z = nextZ + 1;
  if (direction === "bottom") selectedImage.z = -1;

  normalizeZIndexes();
}

function resetSelectedImageSize(): void {
  const selectedImage = getSelectedImage();
  if (!selectedImage) {
    return;
  }

  selectedImage.width = selectedImage.originalWidth;
  selectedImage.height = selectedImage.originalHeight;
}

moveCameraButton.addEventListener("click", () => {
  setCameraMoveMode(!cameraMoveMode);
});

uploadInput.addEventListener("change", () => {
  if (uploadInput.files) {
    handleFiles(uploadInput.files);
  }

  uploadInput.value = "";
});

window.addEventListener("keydown", (event) => {
  if (isEditableTarget(event.target)) {
    return;
  }

  const key = event.key.toLowerCase();
  if (["w", "a", "s", "d"].includes(key)) {
    keys.add(key);
    if (cameraMoveMode) {
      event.preventDefault();
    }
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

canvas.addEventListener("pointerdown", (event) => {
  const screenPoint = screenPointFromEvent(event);
  const worldPoint = screenToWorld(screenPoint);
  pointer.x = screenPoint.x;
  pointer.y = screenPoint.y;

  const selectedImage = getSelectedImage();
  const rotateHandleHit = hitTestRotateHandle(screenPoint);
  const resizeHandle = hitTestResizeHandle(screenPoint);

  if (selectedImage && rotateHandleHit) {
    const angle = Math.atan2(worldPoint.y - selectedImage.y, worldPoint.x - selectedImage.x);
    interaction = {
      type: "rotate-image",
      imageId: selectedImage.id,
      pointerId: event.pointerId,
      startAngle: angle,
      startRotation: selectedImage.rotation,
    };
  } else if (selectedImage && resizeHandle) {
    interaction = {
      type: "resize-image",
      imageId: selectedImage.id,
      pointerId: event.pointerId,
      handle: resizeHandle,
      startCenter: { x: selectedImage.x, y: selectedImage.y },
      startWidth: selectedImage.width,
      startHeight: selectedImage.height,
      startRotation: selectedImage.rotation,
    };
  } else {
    const imageHit = hitTestImage(worldPoint);
    if (imageHit) {
      selectImage(imageHit.id);
      interaction = {
        type: "move-image",
        imageId: imageHit.id,
        pointerId: event.pointerId,
        startPointer: worldPoint,
        startImage: { x: imageHit.x, y: imageHit.y },
      };
    } else if (cameraMoveMode) {
      selectImage(null);
      interaction = {
        type: "pan-camera",
        pointerId: event.pointerId,
        startPointer: screenPoint,
        startCamera: { x: camera.x, y: camera.y },
      };
    } else {
      selectImage(null);
    }
  }

  if (interaction) {
    canvas.setPointerCapture(event.pointerId);
    setCursor(screenPoint);
  }
});

canvas.addEventListener("pointermove", (event) => {
  const screenPoint = screenPointFromEvent(event);
  const worldPoint = screenToWorld(screenPoint);
  pointer.x = screenPoint.x;
  pointer.y = screenPoint.y;

  const currentInteraction = interaction;

  if (!currentInteraction || currentInteraction.pointerId !== event.pointerId) {
    setCursor(screenPoint);
    return;
  }

  if (currentInteraction.type === "move-image") {
    const entity = sceneImages.find((image) => image.id === currentInteraction.imageId);
    if (entity) {
      entity.x = currentInteraction.startImage.x + worldPoint.x - currentInteraction.startPointer.x;
      entity.y = currentInteraction.startImage.y + worldPoint.y - currentInteraction.startPointer.y;
    }
  }

  if (currentInteraction.type === "resize-image") {
    updateResizeInteraction(event, currentInteraction);
  }

  if (currentInteraction.type === "rotate-image") {
    updateRotateInteraction(event, currentInteraction);
  }

  if (currentInteraction.type === "pan-camera") {
    camera.x = currentInteraction.startCamera.x - (screenPoint.x - currentInteraction.startPointer.x) / camera.zoom;
    camera.y = currentInteraction.startCamera.y + (screenPoint.y - currentInteraction.startPointer.y) / camera.zoom;
  }

  setCursor(screenPoint);
});

canvas.addEventListener("pointerup", (event) => {
  if (interaction?.pointerId === event.pointerId) {
    interaction = null;
    canvas.releasePointerCapture(event.pointerId);
  }

  setCursor(screenPointFromEvent(event));
});

canvas.addEventListener("pointercancel", (event) => {
  if (interaction?.pointerId === event.pointerId) {
    interaction = null;
  }

  setCursor(screenPointFromEvent(event));
});

canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    const before = screenToWorld(screenPointFromEvent(event));
    const zoomFactor = Math.exp(-event.deltaY * 0.001);
    camera.zoom = Math.min(4, Math.max(0.2, camera.zoom * zoomFactor));
    const after = screenToWorld(screenPointFromEvent(event));
    camera.x += before.x - after.x;
    camera.y += before.y - after.y;
  },
  { passive: false },
);

window.addEventListener("dragenter", (event) => {
  if (!hasDraggedImage(event)) {
    return;
  }

  event.preventDefault();
  dragDepth += 1;
  dropOverlay.hidden = false;
});

window.addEventListener("dragover", (event) => {
  if (!hasDraggedImage(event)) {
    return;
  }

  event.preventDefault();
});

window.addEventListener("dragleave", (event) => {
  if (!hasDraggedImage(event)) {
    return;
  }

  event.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  dropOverlay.hidden = dragDepth === 0;
});

window.addEventListener("drop", (event) => {
  event.preventDefault();
  dragDepth = 0;
  dropOverlay.hidden = true;

  if (event.dataTransfer?.files.length) {
    handleFiles(event.dataTransfer.files, screenPointFromEvent(event));
  }
});

layerUpButton.addEventListener("click", () => moveLayer("up"));
layerDownButton.addEventListener("click", () => moveLayer("down"));
layerTopButton.addEventListener("click", () => moveLayer("top"));
layerBottomButton.addEventListener("click", () => moveLayer("bottom"));
resetSizeButton.addEventListener("click", resetSelectedImageSize);

window.addEventListener("resize", resizeCanvas);

setCameraMoveMode(false);
resizeCanvas();
requestAnimationFrame(tick);
