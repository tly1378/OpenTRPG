import { TOKEN_RADIUS } from "../core/constants";
import type { ChatMessage, DiceChatMessage, SceneToken, Vector2 } from "../core/types";
import { tokenRenderPosition } from "../modules/canvas/renderer";
import type { RenderState } from "../modules/canvas/renderer";

const DISPLAY_DURATION_MS = 6000;
const FADE_DURATION_MS = 1500;
const STACK_GAP_PX = 4;
const OVERLAY_BAR_HEIGHT_PX = 32;
const DICE_STEP_PATTERN = /^(\d+)d(\d+):\s*(.+)$/;

const D6_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" aria-hidden="true"><path fill="currentColor" d="M422.19 109.95L256.21 9.07c-19.91-12.1-44.52-12.1-64.43 0L25.81 109.95c-5.32 3.23-5.29 11.27.06 14.46L224 242.55l198.14-118.14c5.35-3.19 5.38-11.22.05-14.46zm13.84 44.63L240 271.46v223.82c0 12.88 13.39 20.91 24.05 14.43l152.16-92.48c19.68-11.96 31.79-33.94 31.79-57.7v-197.7c0-6.41-6.64-10.43-11.97-7.25zM0 161.83v197.7c0 23.77 12.11 45.74 31.79 57.7l152.16 92.47c10.67 6.48 24.05-1.54 24.05-14.43V271.46L11.97 154.58C6.64 151.4 0 155.42 0 161.83z"/></svg>`;

type ParsedDieStep = {
  count: number;
  sides: number;
  rolls: string[];
  raw: string;
};

function splitDiceDetail(detail: string): string[] {
  return detail.split(" · ").filter(Boolean);
}

function isModifierStep(step: string): boolean {
  return step.startsWith("加值:");
}

function parseDieStep(step: string): ParsedDieStep | null {
  const match = step.match(DICE_STEP_PATTERN);
  if (!match) {
    return null;
  }

  const rolls = match[3]
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    count: Number(match[1]),
    sides: Number(match[2]),
    rolls,
    raw: step,
  };
}

function getDiceDetailSteps(detail: string): string[] {
  return splitDiceDetail(detail).filter((step) => !isModifierStep(step));
}

function getLoneDieStep(detail: string): ParsedDieStep | null {
  const steps = splitDiceDetail(detail);
  if (steps.some(isModifierStep)) {
    return null;
  }

  const diceSteps = getDiceDetailSteps(detail);
  if (diceSteps.length !== 1) {
    return null;
  }

  const parsed = parseDieStep(diceSteps[0]);
  if (!parsed || parsed.count !== 1 || parsed.rolls.length !== 1) {
    return null;
  }

  return parsed;
}

function resolveSingleD20Natural(detail: string): "natural-1" | "natural-20" | null {
  const step = getLoneDieStep(detail);
  if (!step || step.sides !== 20) {
    return null;
  }

  const roll = Number(step.rolls[0]);
  if (roll === 1) {
    return "natural-1";
  }

  if (roll === 20) {
    return "natural-20";
  }

  return null;
}

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

function appendRollValues(container: HTMLElement, sides: number, rolls: string[]): void {
  rolls.forEach((rollValue, index) => {
    if (index > 0) {
      container.append(", ");
    }
    appendHighlightedRollValue(container, rollValue, sides);
  });
}

function appendOverlayRolls(container: HTMLElement, detail: string): boolean {
  const steps = getDiceDetailSteps(detail);
  if (steps.length === 0) {
    return false;
  }

  const showLabels = steps.length > 1;

  steps.forEach((step, stepIndex) => {
    if (stepIndex > 0) {
      container.append(" · ");
    }

    const parsed = parseDieStep(step);
    if (!parsed) {
      container.append(step);
      return;
    }

    if (showLabels) {
      container.append(`${parsed.count}d${parsed.sides}: `);
    }

    appendRollValues(container, parsed.sides, parsed.rolls);
  });

  return true;
}

function appendDiceStepContent(container: HTMLElement, step: string): void {
  const parsed = parseDieStep(step);
  if (!parsed) {
    container.textContent = step;
    return;
  }

  if (parsed.count === 1 && parsed.sides === 20 && parsed.rolls.length === 1 && Number(parsed.rolls[0]) === 20) {
    container.classList.add("dice-roll-natural-20");
    container.textContent = parsed.raw;
    return;
  }

  if (parsed.sides === 20 && parsed.rolls.length > 0) {
    container.append(`${parsed.count}d${parsed.sides}: `);
    appendRollValues(container, parsed.sides, parsed.rolls);
    return;
  }

  container.textContent = parsed.raw;
}

function createDiceStepElement(step: string, className: string): HTMLElement {
  const stepElement = document.createElement("div");
  stepElement.className = className;
  appendDiceStepContent(stepElement, step);
  return stepElement;
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
  private readonly tokenOverlays: TokenDiceOverlay[] = [];
  private readonly hiddenLogs: HiddenDiceLog[] = [];
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

    const overlaysByToken = new Map<string, TokenDiceOverlay[]>();
    for (const overlay of this.tokenOverlays) {
      const group = overlaysByToken.get(overlay.tokenId) ?? [];
      group.push(overlay);
      overlaysByToken.set(overlay.tokenId, group);
    }

    for (const [tokenId, overlays] of overlaysByToken) {
      const token = this.state.tokens().find((candidate) => candidate.id === tokenId);
      if (!token) {
        for (const overlay of overlays) {
          overlay.element.remove();
        }
        const orphaned = new Set(overlays);
        this.tokenOverlays = this.tokenOverlays.filter((overlay) => !orphaned.has(overlay));
        continue;
      }

      const worldPoint = tokenRenderPosition(token, renderState);
      const screenPoint = this.state.worldToScreen(worldPoint);
      const radius = TOKEN_RADIUS * zoom;
      const baseOffset = Math.max(28, 36 * zoom);
      const baseY = screenPoint.y - radius - baseOffset;
      const stackStep = OVERLAY_BAR_HEIGHT_PX + STACK_GAP_PX;

      const stacked = [...overlays].sort((left, right) => right.createdAt - left.createdAt);
      stacked.forEach((overlay, stackIndex) => {
        overlay.element.style.left = `${screenPoint.x}px`;
        overlay.element.style.top = `${baseY - stackIndex * stackStep}px`;
        this.applyFade(overlay.element, overlay.createdAt, now);
      });
    }

    if (this.hiddenLogs.length > 0) {
      const latencyRect = this.latencyPanel.getBoundingClientRect();
      this.hiddenLogContainer.style.left = `${latencyRect.left}px`;
      this.hiddenLogContainer.style.width = `${latencyRect.width}px`;
      this.hiddenLogContainer.style.bottom = `${window.innerHeight - latencyRect.top + 8}px`;
      this.hiddenLogContainer.hidden = false;

      for (const log of this.hiddenLogs) {
        this.applyFade(log.element, log.createdAt, now);
      }
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
    const element = this.createTokenOverlayElement(message);
    this.overlayRoot.append(element);
    this.tokenOverlays.push({
      tokenId,
      element,
      createdAt: performance.now(),
    });
  }

  private showBroadcastLog(message: DiceChatMessage): void {
    const element = this.createBroadcastLogEntry(message);
    this.hiddenLogContainer.append(element);
    this.hiddenLogs.push({
      element,
      createdAt: performance.now(),
    });
  }

  private createBroadcastLogEntry(message: DiceChatMessage): HTMLElement {
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
    return element;
  }

  private createTokenOverlayElement(message: DiceChatMessage): HTMLElement {
    const element = document.createElement("div");
    element.className = "dice-token-overlay";

    const natural = resolveSingleD20Natural(message.detail);
    if (natural) {
      element.classList.add(`is-${natural}`);
    }

    const icon = document.createElement("span");
    icon.className = "dice-token-overlay-icon";
    icon.innerHTML = D6_ICON_SVG;

    const total = document.createElement("span");
    total.className = "dice-token-overlay-total";
    total.textContent = String(message.total);

    if (getLoneDieStep(message.detail)) {
      element.append(icon, total);
      return element;
    }

    const rolls = document.createElement("span");
    rolls.className = "dice-token-overlay-rolls";

    if (!appendOverlayRolls(rolls, message.detail)) {
      element.append(icon, total);
      return element;
    }

    const equals = document.createElement("span");
    equals.className = "dice-token-overlay-equals";
    equals.textContent = "=";

    element.append(icon, rolls, equals, total);
    return element;
  }

  private expireOverlays(now: number): void {
    for (let index = this.tokenOverlays.length - 1; index >= 0; index -= 1) {
      const overlay = this.tokenOverlays[index];
      if (now - overlay.createdAt >= DISPLAY_DURATION_MS + FADE_DURATION_MS) {
        overlay.element.remove();
        this.tokenOverlays.splice(index, 1);
      }
    }

    for (let index = this.hiddenLogs.length - 1; index >= 0; index -= 1) {
      const log = this.hiddenLogs[index];
      if (now - log.createdAt >= DISPLAY_DURATION_MS + FADE_DURATION_MS) {
        log.element.remove();
        this.hiddenLogs.splice(index, 1);
      }
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
    for (const overlay of this.tokenOverlays) {
      overlay.element.remove();
    }
    this.tokenOverlays.length = 0;
    for (const log of this.hiddenLogs) {
      log.element.remove();
    }
    this.hiddenLogs.length = 0;
    this.hiddenLogContainer.replaceChildren();
    this.hiddenLogContainer.hidden = true;
  }
}
