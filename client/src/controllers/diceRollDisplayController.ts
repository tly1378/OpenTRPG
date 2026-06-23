import { TOKEN_RADIUS } from "../core/constants";
import type { ChatMessage, DiceChatMessage, SceneToken, Vector2 } from "../core/types";
import { tokenRenderPosition } from "../modules/canvas/renderer";
import type { RenderState } from "../modules/canvas/renderer";

const DISPLAY_DURATION_MS = 6000;
const FADE_DURATION_MS = 800;
const DICE_STEP_PATTERN = /^(\d+)d(\d+):\s*(.+)$/;

function appendHighlightedRollValue(container: HTMLElement, rollValue: string, sides: number): void {
  const roll = Number(rollValue);
  if (!Number.isFinite(roll)) {
    container.append(rollValue);
    return;
  }

  if (sides === 20 && roll === 1) {
    const highlight = document.createElement("span");
    highlight.className = "dice-roll-natural-1";
    highlight.textContent = String(roll);
    container.append(highlight);
    return;
  }

  if (sides === 20 && roll === 20) {
    const highlight = document.createElement("span");
    highlight.className = "dice-roll-natural-20";
    highlight.textContent = String(roll);
    container.append(highlight);
    return;
  }

  container.append(String(roll));
}

function appendDiceStepContent(container: HTMLElement, step: string): void {
  const match = step.match(DICE_STEP_PATTERN);
  if (!match) {
    container.textContent = step;
    return;
  }

  const count = Number(match[1]);
  const sides = Number(match[2]);
  const rolls = match[3]
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (count === 1 && sides === 20 && rolls.length === 1 && Number(rolls[0]) === 20) {
    container.classList.add("dice-roll-natural-20");
    container.textContent = step;
    return;
  }

  if (sides === 20 && rolls.length > 0) {
    container.append(`${count}d${sides}: `);
    rolls.forEach((rollValue, index) => {
      if (index > 0) {
        container.append(", ");
      }
      appendHighlightedRollValue(container, rollValue, sides);
    });
    return;
  }

  container.textContent = step;
}

function createDiceStepElement(step: string, className: string): HTMLElement {
  const stepElement = document.createElement("div");
  stepElement.className = className;
  appendDiceStepContent(stepElement, step);
  return stepElement;
}

function splitDiceDetail(detail: string): string[] {
  return detail.split(" · ").filter(Boolean);
}

type TokenDiceOverlay = {
  tokenId: string;
  element: HTMLElement;
  createdAt: number;
};

type HiddenDiceLog = {
  element: HTMLElement;
  createdAt: number;
};

export class DiceRollDisplayController {
  private readonly tokenOverlays = new Map<string, TokenDiceOverlay>();
  private hiddenLog: HiddenDiceLog | null = null;
  private seenMessageIds = new Set<string>();

  constructor(
    private readonly overlayRoot: HTMLElement,
    private readonly hiddenLogContainer: HTMLElement,
    private readonly latencyPanel: HTMLElement,
    private readonly state: {
      isAdmin: () => boolean;
      isLoggedIn: () => boolean;
      tokens: () => SceneToken[];
      getTokenRenderState: () => Pick<RenderState, "interaction" | "movingTokens" | "previewTokenPosition">;
      worldToScreen: (point: Vector2) => Vector2;
      cameraZoom: () => number;
    },
  ) {}

  applyMessages(messages: ChatMessage[], mode: "replace" | "append"): void {
    if (mode === "replace") {
      this.seenMessageIds = new Set(
        messages.filter((message): message is DiceChatMessage => message.kind === "dice").map((message) => message.id),
      );
      return;
    }

    for (const message of messages) {
      if (message.kind !== "dice" || this.seenMessageIds.has(message.id)) {
        continue;
      }

      this.seenMessageIds.add(message.id);
      this.showDiceRoll(message);
    }
  }

  updatePositions(now = performance.now()): void {
    if (!this.state.isLoggedIn()) {
      this.clearAll();
      return;
    }

    this.expireOverlays(now);

    const renderState = this.state.getTokenRenderState();
    const zoom = this.state.cameraZoom();

    for (const overlay of this.tokenOverlays.values()) {
      const token = this.state.tokens().find((candidate) => candidate.id === overlay.tokenId);
      if (!token) {
        overlay.element.remove();
        this.tokenOverlays.delete(overlay.tokenId);
        continue;
      }

      const worldPoint = tokenRenderPosition(token, renderState);
      const screenPoint = this.state.worldToScreen(worldPoint);
      const radius = TOKEN_RADIUS * zoom;
      const offset = Math.max(36, 44 * zoom);

      overlay.element.style.left = `${screenPoint.x}px`;
      overlay.element.style.top = `${screenPoint.y - radius - offset}px`;
      this.applyFade(overlay.element, overlay.createdAt, now);
    }

    if (this.hiddenLog) {
      const latencyRect = this.latencyPanel.getBoundingClientRect();
      this.hiddenLogContainer.style.left = `${latencyRect.left}px`;
      this.hiddenLogContainer.style.width = `${latencyRect.width}px`;
      this.hiddenLogContainer.style.bottom = `${window.innerHeight - latencyRect.top + 8}px`;
      this.hiddenLogContainer.hidden = false;
      this.applyFade(this.hiddenLog.element, this.hiddenLog.createdAt, now);
    } else {
      this.hiddenLogContainer.hidden = true;
    }
  }

  private showDiceRoll(message: DiceChatMessage): void {
    const tokenId = this.resolveTokenId(message);

    if (tokenId && this.state.tokens().some((token) => token.id === tokenId)) {
      this.showTokenOverlay(tokenId, message);
      return;
    }

    if (message.authorType === "admin" && !tokenId) {
      const isPublic = message.rollVisibility === "public";
      if (isPublic || this.state.isAdmin()) {
        this.showBroadcastLog(message);
      }
    }
  }

  private resolveTokenId(message: DiceChatMessage): string | null {
    if (message.tokenId) {
      return message.tokenId;
    }

    if (message.authorType === "player") {
      return message.authorId;
    }

    return null;
  }

  private showTokenOverlay(tokenId: string, message: DiceChatMessage): void {
    const existing = this.tokenOverlays.get(tokenId);
    existing?.element.remove();

    const element = this.createTokenOverlayElement(message);
    this.overlayRoot.append(element);
    this.tokenOverlays.set(tokenId, {
      tokenId,
      element,
      createdAt: performance.now(),
    });
  }

  private showBroadcastLog(message: DiceChatMessage): void {
    this.hiddenLog?.element.remove();

    const element = document.createElement("div");
    element.className = "dice-hidden-log-entry";
    element.classList.add(message.rollVisibility === "public" ? "is-public" : "is-hidden");

    const total = document.createElement("div");
    total.className = "dice-hidden-log-total";
    total.textContent = String(message.total);

    const process = document.createElement("div");
    process.className = "dice-hidden-log-process";

    const formula = document.createElement("div");
    formula.className = "dice-hidden-log-formula";
    formula.textContent = message.formula;
    process.append(formula);

    for (const step of splitDiceDetail(message.detail)) {
      process.append(createDiceStepElement(step, "dice-hidden-log-step"));
    }

    element.append(total, process);

    this.hiddenLogContainer.replaceChildren(element);
    this.hiddenLog = {
      element,
      createdAt: performance.now(),
    };
  }

  private createTokenOverlayElement(message: DiceChatMessage): HTMLElement {
    const element = document.createElement("div");
    const formula = document.createElement("div");
    const total = document.createElement("div");
    const detail = document.createElement("div");

    element.className = "dice-token-overlay";
    formula.className = "dice-token-overlay-formula";
    total.className = "dice-token-overlay-total";
    detail.className = "dice-token-overlay-detail";
    formula.textContent = message.formula;
    total.textContent = String(message.total);

    for (const step of splitDiceDetail(message.detail)) {
      detail.append(createDiceStepElement(step, "dice-token-overlay-detail-step"));
    }

    element.append(formula, total, detail);
    return element;
  }

  private expireOverlays(now: number): void {
    for (const [tokenId, overlay] of this.tokenOverlays) {
      if (now - overlay.createdAt >= DISPLAY_DURATION_MS + FADE_DURATION_MS) {
        overlay.element.remove();
        this.tokenOverlays.delete(tokenId);
      }
    }

    if (this.hiddenLog && now - this.hiddenLog.createdAt >= DISPLAY_DURATION_MS + FADE_DURATION_MS) {
      this.hiddenLog.element.remove();
      this.hiddenLog = null;
      this.hiddenLogContainer.replaceChildren();
    }
  }

  private applyFade(element: HTMLElement, createdAt: number, now: number): void {
    const elapsed = now - createdAt;
    if (elapsed <= DISPLAY_DURATION_MS) {
      element.style.opacity = "1";
      return;
    }

    const fadeProgress = Math.min(1, (elapsed - DISPLAY_DURATION_MS) / FADE_DURATION_MS);
    element.style.opacity = String(1 - fadeProgress);
  }

  private clearAll(): void {
    for (const overlay of this.tokenOverlays.values()) {
      overlay.element.remove();
    }
    this.tokenOverlays.clear();
    this.hiddenLog?.element.remove();
    this.hiddenLog = null;
    this.hiddenLogContainer.replaceChildren();
    this.hiddenLogContainer.hidden = true;
  }
}
