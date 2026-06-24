import type { CharacterBackgroundEntry } from "../../core/types";

const MAX_TITLE_LENGTH = 24;
const MAX_TEXT_LENGTH = 4000;

export const MAX_BACKGROUND_ENTRIES = 16;

export function getCharacterBackgroundEntries(character: {
  backgroundEntries?: CharacterBackgroundEntry[];
}): CharacterBackgroundEntry[] {
  return character.backgroundEntries ?? [];
}

export function createCharacterBackgroundEntry(index: number): CharacterBackgroundEntry {
  return {
    id: crypto.randomUUID(),
    title: `背景${index}`,
    text: "",
  };
}

export function cloneCharacterBackgroundEntries(
  entries: CharacterBackgroundEntry[] | undefined,
): CharacterBackgroundEntry[] | undefined {
  if (!entries?.length) {
    return undefined;
  }

  return entries.map((entry) => ({
    id: crypto.randomUUID(),
    title: entry.title,
    text: entry.text,
  }));
}

export function normalizeBackgroundTitle(title: string): string {
  return title.trim().slice(0, MAX_TITLE_LENGTH);
}

export function normalizeBackgroundText(text: string): string {
  return text.slice(0, MAX_TEXT_LENGTH);
}
