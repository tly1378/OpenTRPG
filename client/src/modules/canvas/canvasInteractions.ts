import { TOKEN_STEP_ANIMATION_MS } from "../../core/constants";
import { cellCenter, findPath as findGridPath, nearestEditableEdge, sameCell, worldToCell } from "../grid/grid";
import { hasDraggedImage } from "../image/imageImport";
import type { Cell, Interaction, SceneDoor, SceneImage, SceneImageSnapshot, SceneToken, Vector2, WallEdge } from "../../core/types";

type MovementBlockedEdges = {
  vertical: Set<string>;
  horizontal: Set<string>;
};

export function installCanvasInteractions(bindings: {
  elements: {
    canvas: HTMLCanvasElement;
    dropOverlay: HTMLDivElement;
  };
  viewport: {
    screenPointFromEvent: (event: { clientX: number; clientY: number }) => Vector2;
    screenToWorld: (point: Vector2) => Vector2;
  };
  state: {
    pointer: Vector2;
    camera: { x: number; y: number; zoom: number };
    sceneImages: SceneImage[];
    sceneTokens: SceneToken[];
    getSelectedImageId: () => string | null;
    setSelectedImageId: (imageId: string | null) => void;
    setSelectedTokenId: (tokenId: string | null) => void;
    setSelectedDoorId: (doorId: string | null) => void;
    setSelectedRoomId: (roomId: string | null) => void;
    getInteraction: () => Interaction | null;
    setInteraction: (interaction: Interaction | null) => void;
    getLogicTool: () => "wall" | "door" | "room" | "inspect-room";
    getPreviewRoomCells: () => Cell[];
    setPreviewRoomCells: (cells: Cell[]) => void;
    setPreviewTokenPosition: (position: Vector2 | null) => void;
    setPreviewPath: (path: Cell[]) => void;
    setHoverWallIntersection: (intersection: { x: number; y: number } | null) => void;
    setPreviewWallEdges: (edges: WallEdge[]) => void;
    setPreviewWallTargetBlocked: (blocked: boolean) => void;
    getMovingTokens: () => { tokenId: string; path: Cell[]; startedAt: number; duration: number }[];
    setMovingTokens: (movingTokens: { tokenId: string; path: Cell[]; startedAt: number; duration: number }[]) => void;
    getDragDepth: () => number;
    setDragDepth: (depth: number) => void;
  };
  queries: {
    isAdmin: () => boolean;
    isLoggedIn: () => boolean;
    isEditingBlocking: () => boolean;
    isEditingBackground: () => boolean;
    isPlayMode: () => boolean;
    canInspectDoor: () => boolean;
    canInspectToken: () => boolean;
    canControlToken: (token: SceneToken) => boolean;
    isTokenAnimating: (tokenId: string) => boolean;
    getSelectedImage: () => SceneImage | null;
    hitTestRotateHandle: (screenPoint: Vector2) => boolean;
    hitTestResizeHandle: (screenPoint: Vector2) => Extract<Interaction, { type: "resize-image" }>["handle"] | null;
    hitTestRoom: (worldPoint: Vector2) => { id: string } | null;
    hitTestWallIntersection: (worldPoint: Vector2) => { x: number; y: number } | null;
    hitTestToken: (worldPoint: Vector2) => SceneToken | null;
    hitTestDoor: (worldPoint: Vector2) => SceneDoor | null;
    hitTestImage: (worldPoint: Vector2) => SceneImage | null;
    movementBlockedEdgeSets: () => MovementBlockedEdges;
    sceneImageSnapshot: (image: SceneImage) => SceneImageSnapshot;
  };
  actions: {
    closeTokenInspector: () => void;
    updateSelectionPanel: () => void;
    setCursor: (screenPoint: Vector2) => void;
    placeCharacterAtCell: (characterId: string, cell: Cell) => void;
    selectRoom: (roomId: string | null) => void;
    closedRegionAt: (worldPoint: Vector2) => Cell[];
    selectRoomFromCells: (cells: Cell[]) => void;
    toggleDoorAtEdge: (edge: { type: "vertical" | "horizontal"; x: number; y: number }) => void;
    selectToken: (tokenId: string | null, inspect?: boolean) => void;
    selectDoor: (door: SceneDoor | null) => void;
    selectImage: (imageId: string | null) => void;
    updateRoomPreview: (worldPoint: Vector2) => void;
    updateWallHover: (worldPoint: Vector2) => void;
    updateResizeInteraction: (event: PointerEvent, state: Extract<Interaction, { type: "resize-image" }>) => void;
    updateRotateInteraction: (event: PointerEvent, state: Extract<Interaction, { type: "rotate-image" }>) => void;
    wallDragTarget: (start: { x: number; y: number }, worldPoint: Vector2) => { x: number; y: number };
    wallEdgesBetween: (start: { x: number; y: number }, target: { x: number; y: number }) => WallEdge[];
    wallEdgesTargetBlocked: (edges: WallEdge[]) => boolean;
    applyWallEdges: (edges: WallEdge[], blocked: boolean) => void;
    handleFiles: (files: FileList | File[], screenPoint?: Vector2) => void;
  };
  network: {
    sendImageUpdated: (image: SceneImageSnapshot) => void;
    sendTokenMoved: (token: SceneToken, path: Cell[]) => void;
  };
}): void {
  const { elements, viewport, state, queries, actions, network } = bindings;
  const { canvas, dropOverlay } = elements;

  function draggedCharacterId(event: DragEvent): string | null {
    return event.dataTransfer?.getData("application/x-trpg-character-id") || null;
  }

  canvas.addEventListener("dragover", (event) => {
    if (!queries.isAdmin() || !event.dataTransfer?.types.includes("application/x-trpg-character-id")) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  });

  canvas.addEventListener("drop", (event) => {
    const characterId = draggedCharacterId(event);
    if (!queries.isAdmin() || !characterId) {
      return;
    }

    event.preventDefault();
    actions.placeCharacterAtCell(characterId, worldToCell(viewport.screenToWorld(viewport.screenPointFromEvent(event))));
  });

  canvas.addEventListener("pointerdown", (event) => {
    const screenPoint = viewport.screenPointFromEvent(event);
    const worldPoint = viewport.screenToWorld(screenPoint);
    state.pointer.x = screenPoint.x;
    state.pointer.y = screenPoint.y;

    if (event.button === 2) {
      event.preventDefault();
      state.setSelectedImageId(null);
      state.setSelectedTokenId(null);
      actions.closeTokenInspector();
      state.setSelectedDoorId(null);
      actions.updateSelectionPanel();
      state.setInteraction({
        type: "pan-camera",
        pointerId: event.pointerId,
        startPointer: screenPoint,
        startCamera: { x: state.camera.x, y: state.camera.y },
      });
      canvas.setPointerCapture(event.pointerId);
      actions.setCursor(screenPoint);
      return;
    }

    if (!queries.isLoggedIn()) {
      return;
    }

    const selectedImage = queries.getSelectedImage();
    const rotateHandleHit = queries.hitTestRotateHandle(screenPoint);
    const resizeHandle = queries.hitTestResizeHandle(screenPoint);

    if (queries.isEditingBlocking()) {
      state.setSelectedImageId(null);
      state.setSelectedTokenId(null);

      if (state.getLogicTool() === "room" || state.getLogicTool() === "inspect-room") {
        if (state.getLogicTool() === "inspect-room") {
          actions.selectRoom(queries.hitTestRoom(worldPoint)?.id ?? null);
          return;
        }

        const existingRoom = queries.hitTestRoom(worldPoint);
        if (existingRoom) {
          actions.selectRoom(existingRoom.id);
          return;
        }

        state.setSelectedRoomId(null);
        actions.updateSelectionPanel();
        const region = state.getPreviewRoomCells().length > 0 ? state.getPreviewRoomCells() : actions.closedRegionAt(worldPoint);
        actions.selectRoomFromCells(region);
        return;
      }

      state.setSelectedRoomId(null);
      actions.updateSelectionPanel();

      if (state.getLogicTool() === "door") {
        actions.toggleDoorAtEdge(nearestEditableEdge(worldPoint));
        return;
      }

      const start = queries.hitTestWallIntersection(worldPoint);
      if (!start) {
        state.setHoverWallIntersection(null);
        return;
      }

      state.setHoverWallIntersection(start);
      state.setPreviewWallEdges([]);
      state.setPreviewWallTargetBlocked(true);
      state.setInteraction({
        type: "draw-wall",
        pointerId: event.pointerId,
        start,
        target: start,
        targetBlocked: true,
        edges: [],
      });
      canvas.setPointerCapture(event.pointerId);
      actions.setCursor(screenPoint);
      return;
    }

    if (queries.isEditingBackground() && selectedImage && rotateHandleHit) {
      const angle = Math.atan2(worldPoint.y - selectedImage.y, worldPoint.x - selectedImage.x);
      state.setInteraction({
        type: "rotate-image",
        imageId: selectedImage.id,
        pointerId: event.pointerId,
        startAngle: angle,
        startRotation: selectedImage.rotation,
      });
    } else if (queries.isEditingBackground() && selectedImage && resizeHandle) {
      state.setInteraction({
        type: "resize-image",
        imageId: selectedImage.id,
        pointerId: event.pointerId,
        handle: resizeHandle,
        startCenter: { x: selectedImage.x, y: selectedImage.y },
        startWidth: selectedImage.width,
        startHeight: selectedImage.height,
        startRotation: selectedImage.rotation,
      });
    } else {
      const tokenHit = queries.isPlayMode() ? queries.hitTestToken(worldPoint) : null;
      const doorHit = queries.canInspectDoor() ? queries.hitTestDoor(worldPoint) : null;
      const imageHit = queries.isEditingBackground() ? queries.hitTestImage(worldPoint) : null;

      if (doorHit) {
        actions.selectDoor(doorHit);
      } else if (tokenHit && queries.canControlToken(tokenHit) && !queries.isTokenAnimating(tokenHit.id)) {
        const targetCell = worldToCell(worldPoint);
        const movementBlockedEdges = queries.movementBlockedEdgeSets();
        const path = findGridPath(
          tokenHit.cell,
          targetCell,
          tokenHit.id,
          state.sceneTokens,
          movementBlockedEdges.vertical,
          movementBlockedEdges.horizontal,
        );
        actions.selectToken(tokenHit.id);
        state.setPreviewTokenPosition(cellCenter(tokenHit.cell));
        state.setPreviewPath(path);
        state.setInteraction({
          type: "drag-token",
          tokenId: tokenHit.id,
          pointerId: event.pointerId,
          startCell: tokenHit.cell,
          targetCell,
          path,
        });
      } else if (imageHit) {
        actions.selectImage(imageHit.id);
        state.setInteraction({
          type: "move-image",
          imageId: imageHit.id,
          pointerId: event.pointerId,
          startPointer: worldPoint,
          startImage: { x: imageHit.x, y: imageHit.y },
        });
      } else {
        state.setSelectedImageId(null);
        state.setSelectedTokenId(null);
        state.setSelectedDoorId(null);
        state.setSelectedRoomId(null);
        actions.updateSelectionPanel();
      }
    }

    if (state.getInteraction()) {
      canvas.setPointerCapture(event.pointerId);
      actions.setCursor(screenPoint);
    }
  });

  canvas.addEventListener("pointermove", (event) => {
    const screenPoint = viewport.screenPointFromEvent(event);
    const worldPoint = viewport.screenToWorld(screenPoint);
    state.pointer.x = screenPoint.x;
    state.pointer.y = screenPoint.y;

    const currentInteraction = state.getInteraction();

    if (!currentInteraction || currentInteraction.pointerId !== event.pointerId) {
      actions.updateRoomPreview(worldPoint);
      actions.updateWallHover(worldPoint);
      actions.setCursor(screenPoint);
      return;
    }

    if (currentInteraction.type === "move-image") {
      const entity = state.sceneImages.find((image) => image.id === currentInteraction.imageId);
      if (entity) {
        entity.x = currentInteraction.startImage.x + worldPoint.x - currentInteraction.startPointer.x;
        entity.y = currentInteraction.startImage.y + worldPoint.y - currentInteraction.startPointer.y;
      }
    }

    if (currentInteraction.type === "resize-image") {
      actions.updateResizeInteraction(event, currentInteraction);
    }

    if (currentInteraction.type === "rotate-image") {
      actions.updateRotateInteraction(event, currentInteraction);
    }

    if (currentInteraction.type === "drag-token") {
      const targetCell = worldToCell(worldPoint);
      state.setPreviewTokenPosition(cellCenter(targetCell));

      if (!sameCell(targetCell, currentInteraction.targetCell)) {
        const movementBlockedEdges = queries.movementBlockedEdgeSets();
        const path = findGridPath(
          currentInteraction.startCell,
          targetCell,
          currentInteraction.tokenId,
          state.sceneTokens,
          movementBlockedEdges.vertical,
          movementBlockedEdges.horizontal,
        );
        currentInteraction.targetCell = targetCell;
        currentInteraction.path = path;
        state.setPreviewPath(path);
      }
    }

    if (currentInteraction.type === "draw-wall") {
      currentInteraction.target = actions.wallDragTarget(currentInteraction.start, worldPoint);
      currentInteraction.edges = actions.wallEdgesBetween(currentInteraction.start, currentInteraction.target);
      currentInteraction.targetBlocked = actions.wallEdgesTargetBlocked(currentInteraction.edges);
      state.setHoverWallIntersection(currentInteraction.start);
      state.setPreviewWallEdges(currentInteraction.edges);
      state.setPreviewWallTargetBlocked(currentInteraction.targetBlocked);
    }

    if (currentInteraction.type === "pan-camera") {
      state.camera.x = currentInteraction.startCamera.x - (screenPoint.x - currentInteraction.startPointer.x) / state.camera.zoom;
      state.camera.y = currentInteraction.startCamera.y + (screenPoint.y - currentInteraction.startPointer.y) / state.camera.zoom;
    }

    actions.setCursor(screenPoint);
  });

  canvas.addEventListener("pointerup", (event) => {
    const currentInteraction = state.getInteraction();

    if (currentInteraction?.pointerId === event.pointerId) {
      if (
        currentInteraction.type === "move-image" ||
        currentInteraction.type === "resize-image" ||
        currentInteraction.type === "rotate-image"
      ) {
        const image = state.sceneImages.find((candidate) => candidate.id === currentInteraction.imageId);
        if (image) {
          network.sendImageUpdated(queries.sceneImageSnapshot(image));
        }
      }

      if (currentInteraction.type === "drag-token") {
        const token = state.sceneTokens.find((candidate) => candidate.id === currentInteraction.tokenId);
        if (token && currentInteraction.path.length > 1) {
          const finalCell = currentInteraction.path[currentInteraction.path.length - 1];
          token.cell = { ...finalCell };
          state.setMovingTokens(state.getMovingTokens().filter((animation) => animation.tokenId !== token.id));
          state.getMovingTokens().push({
            tokenId: token.id,
            path: currentInteraction.path.map((cell) => ({ ...cell })),
            startedAt: performance.now(),
            duration: Math.max(1, currentInteraction.path.length - 1) * TOKEN_STEP_ANIMATION_MS,
          });
          network.sendTokenMoved(token, currentInteraction.path);
        }

        state.setPreviewPath([]);
        state.setPreviewTokenPosition(null);
      }

      if (currentInteraction.type === "draw-wall") {
        actions.applyWallEdges(currentInteraction.edges, currentInteraction.targetBlocked);
        state.setPreviewWallEdges([]);
        state.setPreviewWallTargetBlocked(true);
        state.setHoverWallIntersection(queries.hitTestWallIntersection(viewport.screenToWorld(viewport.screenPointFromEvent(event))));
      }

      state.setInteraction(null);
      canvas.releasePointerCapture(event.pointerId);
    }

    actions.setCursor(viewport.screenPointFromEvent(event));
  });

  canvas.addEventListener("pointercancel", (event) => {
    const currentInteraction = state.getInteraction();
    if (currentInteraction?.pointerId === event.pointerId) {
      if (currentInteraction.type === "drag-token") {
        state.setPreviewPath([]);
        state.setPreviewTokenPosition(null);
      }

      if (currentInteraction.type === "draw-wall") {
        state.setPreviewWallEdges([]);
        state.setPreviewWallTargetBlocked(true);
      }

      state.setInteraction(null);
    }

    actions.setCursor(viewport.screenPointFromEvent(event));
  });

  canvas.addEventListener("dblclick", (event) => {
    if (!queries.canInspectToken()) {
      return;
    }

    const tokenHit = queries.hitTestToken(viewport.screenToWorld(viewport.screenPointFromEvent(event)));
    if (!tokenHit) {
      return;
    }

    event.preventDefault();
    actions.selectToken(tokenHit.id, true);
  });

  canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });

  canvas.addEventListener("pointerleave", () => {
    state.setPreviewRoomCells([]);
    state.setHoverWallIntersection(null);
  });

  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const before = viewport.screenToWorld(viewport.screenPointFromEvent(event));
      const zoomFactor = Math.exp(-event.deltaY * 0.001);
      state.camera.zoom = Math.min(4, Math.max(0.2, state.camera.zoom * zoomFactor));
      const after = viewport.screenToWorld(viewport.screenPointFromEvent(event));
      state.camera.x += before.x - after.x;
      state.camera.y += before.y - after.y;
    },
    { passive: false },
  );

  window.addEventListener("dragenter", (event) => {
    if (!queries.isEditingBackground() || !hasDraggedImage(event)) {
      return;
    }

    event.preventDefault();
    state.setDragDepth(state.getDragDepth() + 1);
    dropOverlay.hidden = false;
  });

  window.addEventListener("dragover", (event) => {
    if (!queries.isEditingBackground() && hasDraggedImage(event)) {
      event.preventDefault();
      return;
    }

    if (!hasDraggedImage(event)) {
      return;
    }

    event.preventDefault();
  });

  window.addEventListener("dragleave", (event) => {
    if (!queries.isEditingBackground() || !hasDraggedImage(event)) {
      return;
    }

    event.preventDefault();
    state.setDragDepth(Math.max(0, state.getDragDepth() - 1));
    dropOverlay.hidden = state.getDragDepth() === 0;
  });

  window.addEventListener("drop", (event) => {
    if (!queries.isEditingBackground()) {
      if (hasDraggedImage(event)) {
        event.preventDefault();
      }

      state.setDragDepth(0);
      dropOverlay.hidden = true;
      return;
    }

    event.preventDefault();
    state.setDragDepth(0);
    dropOverlay.hidden = true;

    if (event.dataTransfer?.files.length) {
      actions.handleFiles(event.dataTransfer.files, viewport.screenPointFromEvent(event));
    }
  });
}
