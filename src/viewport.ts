import type { ClientPointEvent, Vector2 } from "./types";

export type Camera = {
  x: number;
  y: number;
  zoom: number;
};

export function createViewport(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, camera: Camera) {
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

  function screenPointFromEvent(event: ClientPointEvent): Vector2 {
    const rect = canvas.getBoundingClientRect();

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  return {
    screenSize,
    screenToWorld,
    worldToScreen,
    resizeCanvas,
    screenPointFromEvent,
  };
}
