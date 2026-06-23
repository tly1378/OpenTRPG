import { diceSides, type DiceSides } from "../core/appState";
import type { DiceRollVisibility } from "../core/types";

type DiceRollMessage = {
  kind: "dice";
  formula: string;
  total: number;
  detail: string;
  tokenId?: string | null;
  rollVisibility?: DiceRollVisibility | null;
};

export type DiceFocusLabelState = {
  text: string;
  toggleable: boolean;
  visibility: DiceRollVisibility | null;
};

export class DiceController {
  private readonly selectedDice = new Map<DiceSides, number>();

  constructor(
    private readonly elements: {
      panel: HTMLElement;
      focusLabel: HTMLButtonElement;
      optionButtons: HTMLButtonElement[];
      adjustButtons: HTMLButtonElement[];
      rollButton: HTMLButtonElement;
      modifierInput: HTMLInputElement;
    },
    private readonly canUseDicePanel: () => boolean,
    private readonly getRollTargetTokenId: () => string | null,
    private readonly getRollVisibility: () => DiceRollVisibility,
    private readonly getFocusLabel: () => DiceFocusLabelState | null,
    private readonly toggleRollVisibility: () => void,
    private readonly sendDiceChatMessage: (message: DiceRollMessage) => void,
  ) {
    this.elements.focusLabel.addEventListener("click", () => {
      if (this.getFocusLabel()?.toggleable) {
        this.toggleRollVisibility();
      }
    });
  }

  parseButton(button: HTMLButtonElement): DiceSides | null {
    const sides = Number(button.dataset.die);
    return this.isDiceSides(sides) ? sides : null;
  }

  render(): void {
    this.elements.panel.hidden = !this.canUseDicePanel();

    const focusLabel = this.getFocusLabel();
    if (focusLabel === null) {
      this.elements.focusLabel.hidden = true;
      this.elements.focusLabel.textContent = "";
      this.elements.focusLabel.classList.remove("is-toggle", "is-character", "is-public");
    } else {
      this.elements.focusLabel.hidden = false;
      this.elements.focusLabel.textContent = focusLabel.text;
      this.elements.focusLabel.classList.toggle("is-toggle", focusLabel.toggleable);
      this.elements.focusLabel.classList.toggle("is-character", !focusLabel.toggleable);
      this.elements.focusLabel.classList.toggle("is-public", focusLabel.visibility === "public");
      this.elements.focusLabel.setAttribute(
        "aria-label",
        focusLabel.toggleable ? `当前为${focusLabel.text}，点击切换` : `聚焦 ${focusLabel.text}`,
      );
    }

    for (const button of this.elements.optionButtons) {
      const sides = this.parseButton(button);
      const count = sides === null ? 0 : (this.selectedDice.get(sides) ?? 0);

      button.classList.toggle("is-selected", count > 0);

      if (sides === null) {
        continue;
      }

      if (count === 0) {
        button.textContent = `d${sides}`;
        continue;
      }

      const countElement = document.createElement("span");
      const sidesElement = document.createElement("span");
      countElement.className = "dice-option-count";
      sidesElement.textContent = `d${sides}`;
      countElement.textContent = String(count);
      button.replaceChildren(countElement, sidesElement);
    }

    for (const button of this.elements.adjustButtons) {
      const sides = this.parseButton(button);
      const count = sides === null ? 0 : (this.selectedDice.get(sides) ?? 0);
      button.disabled = button.dataset.diceAction === "decrease" && count === 0;
    }

    this.elements.rollButton.disabled = this.selectedDice.size === 0;
  }

  changeSelection(sides: DiceSides, delta: number): void {
    const nextCount = Math.max(0, (this.selectedDice.get(sides) ?? 0) + delta);

    if (nextCount === 0) {
      this.selectedDice.delete(sides);
    } else {
      this.selectedDice.set(sides, nextCount);
    }

    this.render();
  }

  clearSelection(): void {
    this.selectedDice.clear();
    this.elements.modifierInput.value = "0";
    this.render();
  }

  changeModifier(delta: number): void {
    this.elements.modifierInput.value = String(this.getModifier() + delta);
    this.render();
  }

  rollSelected(): void {
    if (this.selectedDice.size === 0) {
      return;
    }

    let total = 0;
    const details: string[] = [];
    const modifier = this.getModifier();
    const formula = this.formatSelection();
    const tokenId = this.getRollTargetTokenId();
    const rollVisibility = tokenId === null ? (this.getRollVisibility() ?? "hidden") : null;

    for (const sides of diceSides) {
      const count = this.selectedDice.get(sides) ?? 0;

      if (count === 0) {
        continue;
      }

      const rolls = Array.from({ length: count }, () => this.rollDie(sides));
      const subtotal = rolls.reduce((sum, roll) => sum + roll, 0);
      total += subtotal;
      details.push(`${count}d${sides}: ${rolls.join(", ")}`);
    }

    total += modifier;

    if (modifier !== 0) {
      details.push(`加值: ${modifier > 0 ? "+" : ""}${modifier}`);
    }

    this.sendDiceChatMessage({
      kind: "dice",
      formula,
      total,
      detail: details.join(" · "),
      tokenId,
      rollVisibility,
    });
    this.clearSelection();
  }

  private isDiceSides(value: number): value is DiceSides {
    return diceSides.includes(value as DiceSides);
  }

  private getModifier(): number {
    const value = Number(this.elements.modifierInput.value);
    return Number.isFinite(value) ? Math.trunc(value) : 0;
  }

  private formatModifier(modifier: number): string | null {
    if (modifier === 0) {
      return null;
    }

    return modifier > 0 ? `+ ${modifier}` : `- ${Math.abs(modifier)}`;
  }

  private formatSelection(): string {
    const parts = diceSides
      .map((sides) => {
        const count = this.selectedDice.get(sides) ?? 0;
        return count > 0 ? `${count}d${sides}` : null;
      })
      .filter((part): part is string => part !== null);
    const modifier = this.formatModifier(this.getModifier());

    if (parts.length === 0) {
      return "";
    }

    return modifier === null ? parts.join(" + ") : `${parts.join(" + ")} ${modifier}`;
  }

  private rollDie(sides: DiceSides): number {
    return Math.floor(Math.random() * sides) + 1;
  }
}
