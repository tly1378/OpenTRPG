import type { CharacterStat, CharacterStatCategory, SceneCharacter } from "../../core/types";
import {
  getCharacterStatCategories,
  MAX_STAT_CATEGORIES,
  normalizeCategoryName,
  normalizeStatName,
  normalizeStatValue,
  STATS_PER_CATEGORY,
} from "./characterStats";

const DELETE_ICON_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" /></svg>';

export function renderCharacterStatsPanel(options: {
  listContainer: HTMLDivElement;
  character: SceneCharacter;
  canEditStructure: boolean;
  canEditValues: boolean;
  onAddCharacterStatCategory: () => void;
  onDeleteCharacterStatCategory: (categoryId: string) => void;
  onUpdateCharacterStatCategoryName: (categoryId: string, name: string) => void;
  onAddCharacterStat: (categoryId: string) => void;
  onDeleteCharacterStat: (categoryId: string, statId: string) => void;
  onUpdateCharacterStatName: (categoryId: string, statId: string, name: string) => void;
  onUpdateCharacterStatValue: (categoryId: string, statId: string, value: number) => void;
}): void {
  const categories = getCharacterStatCategories(options.character);
  const { listContainer, canEditStructure, canEditValues } = options;

  if (categories.length === 0) {
    if (canEditStructure) {
      listContainer.replaceChildren(createAddCategoryButton(options.onAddCharacterStatCategory, true));
    } else {
      const empty = document.createElement("p");
      empty.className = "token-inspector-empty character-stats-empty";
      empty.textContent = "还没有数值条目。";
      listContainer.replaceChildren(empty);
    }
    return;
  }

  const elements: HTMLElement[] = categories.map((category) =>
    createCategoryBlock({
      category,
      canEditStructure,
      canEditValues,
      onDeleteCharacterStatCategory: options.onDeleteCharacterStatCategory,
      onUpdateCharacterStatCategoryName: options.onUpdateCharacterStatCategoryName,
      onAddCharacterStat: options.onAddCharacterStat,
      onDeleteCharacterStat: options.onDeleteCharacterStat,
      onUpdateCharacterStatName: options.onUpdateCharacterStatName,
      onUpdateCharacterStatValue: options.onUpdateCharacterStatValue,
    }),
  );

  if (canEditStructure && categories.length < MAX_STAT_CATEGORIES) {
    elements.push(createAddCategoryButton(options.onAddCharacterStatCategory, false));
  }

  listContainer.replaceChildren(...elements);
}

function createAddCategoryButton(onAdd: () => void, prominent: boolean): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = prominent ? "token-inspector-add-entry" : "token-inspector-add-entry-inline";
  button.setAttribute("aria-label", "添加属性类");
  button.textContent = "+";
  button.addEventListener("click", onAdd);
  return button;
}

function createCategoryBlock(options: {
  category: CharacterStatCategory;
  canEditStructure: boolean;
  canEditValues: boolean;
  onDeleteCharacterStatCategory: (categoryId: string) => void;
  onUpdateCharacterStatCategoryName: (categoryId: string, name: string) => void;
  onAddCharacterStat: (categoryId: string) => void;
  onDeleteCharacterStat: (categoryId: string, statId: string) => void;
  onUpdateCharacterStatName: (categoryId: string, statId: string, name: string) => void;
  onUpdateCharacterStatValue: (categoryId: string, statId: string, value: number) => void;
}): HTMLDivElement {
  const { category, canEditStructure, canEditValues } = options;
  const block = document.createElement("div");
  block.className = "character-stat-category";

  const header = document.createElement("div");
  header.className = "character-stat-category-header";

  if (canEditStructure) {
    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.className = "character-stat-category-title character-entry-title";
    titleInput.maxLength = 24;
    titleInput.value = category.name;
    titleInput.placeholder = "属性类名称";
    titleInput.addEventListener("change", () => {
      const normalizedName = normalizeCategoryName(titleInput.value);
      if (normalizedName.length === 0 || normalizedName === category.name) {
        titleInput.value = category.name;
        return;
      }
      options.onUpdateCharacterStatCategoryName(category.id, normalizedName);
    });
    header.append(titleInput);

    const deleteCategoryButton = document.createElement("button");
    deleteCategoryButton.type = "button";
    deleteCategoryButton.className = "character-stat-category-delete character-entry-delete";
    deleteCategoryButton.setAttribute("aria-label", `删除 ${category.name}`);
    deleteCategoryButton.innerHTML = DELETE_ICON_SVG;
    deleteCategoryButton.addEventListener("click", () => {
      options.onDeleteCharacterStatCategory(category.id);
    });
    header.append(deleteCategoryButton);
  } else {
    const title = document.createElement("div");
    title.className = "character-stat-category-title-display character-entry-title-display";
    title.textContent = category.name;
    header.append(title);
  }

  const row = document.createElement("div");
  row.className = "character-stats-row";
  const chips: HTMLElement[] = category.stats.map((stat) =>
    createStatChip({
      categoryId: category.id,
      stat,
      canEditStructure,
      canEditValues,
      onDeleteCharacterStat: options.onDeleteCharacterStat,
      onUpdateCharacterStatName: options.onUpdateCharacterStatName,
      onUpdateCharacterStatValue: options.onUpdateCharacterStatValue,
    }),
  );

  if (canEditStructure && category.stats.length < STATS_PER_CATEGORY) {
    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "character-stat-add";
    addButton.setAttribute("aria-label", `在 ${category.name} 中添加数值条目`);
    addButton.textContent = "+";
    addButton.addEventListener("click", () => {
      options.onAddCharacterStat(category.id);
    });
    chips.push(addButton);
  }

  row.append(...chips);
  block.append(header, row);
  return block;
}

function createStatChip(options: {
  categoryId: string;
  stat: CharacterStat;
  canEditStructure: boolean;
  canEditValues: boolean;
  onDeleteCharacterStat: (categoryId: string, statId: string) => void;
  onUpdateCharacterStatName: (categoryId: string, statId: string, name: string) => void;
  onUpdateCharacterStatValue: (categoryId: string, statId: string, value: number) => void;
}): HTMLDivElement {
  const { categoryId, stat, canEditStructure, canEditValues } = options;
  const chip = document.createElement("div");
  chip.className = "character-stat-chip";

  if (canEditStructure) {
    const header = document.createElement("div");
    header.className = "character-stat-chip-header";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "character-stat-name character-entry-title";
    nameInput.maxLength = 16;
    nameInput.value = stat.name;
    nameInput.placeholder = "名称";
    nameInput.addEventListener("change", () => {
      const normalizedName = normalizeStatName(nameInput.value);
      if (normalizedName.length === 0 || normalizedName === stat.name) {
        nameInput.value = stat.name;
        return;
      }
      options.onUpdateCharacterStatName(categoryId, stat.id, normalizedName);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "character-stat-delete character-entry-delete";
    deleteButton.setAttribute("aria-label", `删除 ${stat.name}`);
    deleteButton.innerHTML = DELETE_ICON_SVG;
    deleteButton.addEventListener("click", () => {
      options.onDeleteCharacterStat(categoryId, stat.id);
    });

    header.append(nameInput, deleteButton);
    chip.append(header);
  } else {
    const nameLabel = document.createElement("span");
    nameLabel.className = "character-stat-name-display";
    nameLabel.textContent = stat.name;
    chip.append(nameLabel);
  }

  if (canEditValues) {
    chip.append(
      createStatValueEditor({
        stat,
        onUpdateStatValue: (value) => {
          options.onUpdateCharacterStatValue(categoryId, stat.id, value);
        },
      }),
    );
  } else {
    const valueLabel = document.createElement("span");
    valueLabel.className = "character-stat-value-display";
    valueLabel.textContent = String(stat.value);
    chip.append(valueLabel);
  }

  return chip;
}

function createStatValueEditor(options: {
  stat: CharacterStat;
  onUpdateStatValue: (value: number) => void;
}): HTMLDivElement {
  const { stat } = options;
  const editor = document.createElement("div");
  editor.className = "character-stat-value-editor";

  const valueInput = document.createElement("input");
  valueInput.type = "number";
  valueInput.className = "character-stat-value";
  valueInput.step = "any";
  valueInput.value = String(stat.value);
  valueInput.setAttribute("aria-label", `${stat.name} 数值`);

  const applyValue = (nextValue: number): void => {
    valueInput.value = String(nextValue);
    options.onUpdateStatValue(nextValue);
  };

  const commitInputValue = (): void => {
    const normalizedValue = normalizeStatValue(valueInput.value);
    if (normalizedValue === null) {
      valueInput.value = String(stat.value);
      return;
    }
    if (normalizedValue === stat.value) {
      return;
    }
    applyValue(normalizedValue);
  };

  valueInput.addEventListener("change", commitInputValue);

  const stepper = document.createElement("div");
  stepper.className = "character-stat-value-stepper";

  const upButton = document.createElement("button");
  upButton.type = "button";
  upButton.className = "character-stat-step-button character-stat-step-up";
  upButton.setAttribute("aria-label", `增加 ${stat.name}`);
  upButton.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  upButton.addEventListener("click", () => {
    const currentValue = normalizeStatValue(valueInput.value) ?? stat.value;
    applyValue(currentValue + 1);
  });

  const downButton = document.createElement("button");
  downButton.type = "button";
  downButton.className = "character-stat-step-button character-stat-step-down";
  downButton.setAttribute("aria-label", `减少 ${stat.name}`);
  downButton.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  downButton.addEventListener("click", () => {
    const currentValue = normalizeStatValue(valueInput.value) ?? stat.value;
    applyValue(currentValue - 1);
  });

  stepper.append(upButton, downButton);
  editor.append(valueInput, stepper);
  return editor;
}
