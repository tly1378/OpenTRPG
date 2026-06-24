import type { CharacterBackgroundEntry, SceneCharacter } from "../../core/types";
import {
  getCharacterBackgroundEntries,
  MAX_BACKGROUND_ENTRIES,
  normalizeBackgroundText,
  normalizeBackgroundTitle,
} from "./characterBackground";

const DELETE_ICON_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" /></svg>';

export function renderCharacterBackgroundPanel(options: {
  listContainer: HTMLDivElement;
  character: SceneCharacter;
  canEdit: boolean;
  onAddCharacterBackgroundEntry: () => void;
  onDeleteCharacterBackgroundEntry: (entryId: string) => void;
  onUpdateCharacterBackgroundTitle: (entryId: string, title: string) => void;
  onUpdateCharacterBackgroundText: (entryId: string, text: string) => void;
}): void {
  const entries = getCharacterBackgroundEntries(options.character);
  const { listContainer, canEdit } = options;

  if (entries.length === 0) {
    if (canEdit) {
      listContainer.replaceChildren(createAddEntryButton(options.onAddCharacterBackgroundEntry, true));
    } else {
      const empty = document.createElement("p");
      empty.className = "token-inspector-empty";
      empty.textContent = "还没有背景条目。";
      listContainer.replaceChildren(empty);
    }
    return;
  }

  const elements: HTMLElement[] = entries.map((entry) =>
    createEntryBlock({
      entry,
      canEdit,
      onDeleteCharacterBackgroundEntry: options.onDeleteCharacterBackgroundEntry,
      onUpdateCharacterBackgroundTitle: options.onUpdateCharacterBackgroundTitle,
      onUpdateCharacterBackgroundText: options.onUpdateCharacterBackgroundText,
    }),
  );

  if (canEdit && entries.length < MAX_BACKGROUND_ENTRIES) {
    elements.push(createAddEntryButton(options.onAddCharacterBackgroundEntry, false));
  }

  listContainer.replaceChildren(...elements);
}

function createAddEntryButton(onAdd: () => void, prominent: boolean): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = prominent ? "token-inspector-add-entry" : "token-inspector-add-entry-inline";
  button.setAttribute("aria-label", "添加背景条目");
  button.textContent = "+";
  button.addEventListener("click", onAdd);
  return button;
}

function createEntryBlock(options: {
  entry: CharacterBackgroundEntry;
  canEdit: boolean;
  onDeleteCharacterBackgroundEntry: (entryId: string) => void;
  onUpdateCharacterBackgroundTitle: (entryId: string, title: string) => void;
  onUpdateCharacterBackgroundText: (entryId: string, text: string) => void;
}): HTMLDivElement {
  const { entry, canEdit } = options;
  const block = document.createElement("div");
  block.className = "character-background-entry";

  const header = document.createElement("div");
  header.className = "character-background-entry-header";

  if (canEdit) {
    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.className = "character-background-entry-title character-entry-title";
    titleInput.maxLength = 24;
    titleInput.value = entry.title;
    titleInput.placeholder = "标题";
    titleInput.addEventListener("change", () => {
      const normalizedTitle = normalizeBackgroundTitle(titleInput.value);
      if (normalizedTitle.length === 0 || normalizedTitle === entry.title) {
        titleInput.value = entry.title;
        return;
      }
      options.onUpdateCharacterBackgroundTitle(entry.id, normalizedTitle);
    });
    header.append(titleInput);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "character-background-entry-delete character-entry-delete";
    deleteButton.setAttribute("aria-label", `删除 ${entry.title}`);
    deleteButton.innerHTML = DELETE_ICON_SVG;
    deleteButton.addEventListener("click", () => {
      options.onDeleteCharacterBackgroundEntry(entry.id);
    });
    header.append(deleteButton);
  } else {
    const title = document.createElement("div");
    title.className = "character-background-entry-title-display character-entry-title-display";
    title.textContent = entry.title;
    header.append(title);
  }

  if (canEdit) {
    const textInput = document.createElement("textarea");
    textInput.className = "character-background-entry-text";
    textInput.rows = 6;
    textInput.maxLength = 4000;
    textInput.value = entry.text;
    textInput.placeholder = "背景内容";
    textInput.addEventListener("blur", () => {
      const normalizedText = normalizeBackgroundText(textInput.value);
      if (normalizedText === entry.text) {
        return;
      }
      options.onUpdateCharacterBackgroundText(entry.id, normalizedText);
    });
    block.append(header, textInput);
  } else {
    const text = document.createElement("div");
    text.className = "character-background-entry-text-display";
    text.textContent = entry.text || "（无内容）";
    block.append(header, text);
  }

  return block;
}
