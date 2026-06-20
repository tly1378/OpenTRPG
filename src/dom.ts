export function mustQuery<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`页面初始化失败：缺少 ${selector}。`);
  }

  return element;
}

export function mustGetCanvasContext(targetCanvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = targetCanvas.getContext("2d");

  if (!context) {
    throw new Error("页面初始化失败：当前浏览器不支持 Canvas 2D。");
  }

  return context;
}
