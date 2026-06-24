import { randomUUID } from "node:crypto";
import { normalizeTokenAvatarFields } from "./images.mjs";

const MAX_STAT_NAME_LENGTH = 16;
const MAX_CATEGORY_NAME_LENGTH = 24;
const MAX_BACKGROUND_TITLE_LENGTH = 24;
const MAX_BACKGROUND_TEXT_LENGTH = 4000;
export const STATS_PER_CATEGORY = 8;
export const MAX_STAT_CATEGORIES = 8;
export const MAX_BACKGROUND_ENTRIES = 16;

export function normalizeCharacterStat(stat) {
  if (!stat || typeof stat !== "object") {
    return null;
  }

  const id = String(stat.id ?? "");
  const name = String(stat.name ?? "").trim().slice(0, MAX_STAT_NAME_LENGTH);
  const value = Number(stat.value);

  if (!id || !name || !Number.isFinite(value)) {
    return null;
  }

  return { id, name, value };
}

export function normalizeCharacterStatsInCategory(stats) {
  if (!Array.isArray(stats)) {
    return [];
  }

  return stats.map(normalizeCharacterStat).filter(Boolean).slice(0, STATS_PER_CATEGORY);
}

export function normalizeCharacterStatCategory(category) {
  if (!category || typeof category !== "object") {
    return null;
  }

  const id = String(category.id ?? "");
  const name = String(category.name ?? "").trim().slice(0, MAX_CATEGORY_NAME_LENGTH);
  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    stats: normalizeCharacterStatsInCategory(category.stats),
  };
}

export function normalizeCharacterStatCategories(categories) {
  if (!Array.isArray(categories)) {
    return [];
  }

  return categories.map(normalizeCharacterStatCategory).filter(Boolean).slice(0, MAX_STAT_CATEGORIES);
}

export function normalizeCharacterBackgroundEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const id = String(entry.id ?? "");
  const title = String(entry.title ?? "").trim().slice(0, MAX_BACKGROUND_TITLE_LENGTH);
  const text = String(entry.text ?? "").slice(0, MAX_BACKGROUND_TEXT_LENGTH);

  if (!id || !title) {
    return null;
  }

  return { id, title, text };
}

export function normalizeCharacterBackgroundEntries(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries.map(normalizeCharacterBackgroundEntry).filter(Boolean).slice(0, MAX_BACKGROUND_ENTRIES);
}

function migrateLegacyStats(character) {
  if (!Array.isArray(character.stats) || character.stats.length === 0) {
    return [];
  }

  return [
    {
      id: randomUUID(),
      name: "属性",
      stats: normalizeCharacterStatsInCategory(character.stats),
    },
  ];
}

export function normalizeSceneCharacter(character) {
  if (!character || typeof character !== "object") {
    return null;
  }

  const id = String(character.id ?? "");
  const name = String(character.name ?? "");
  const color = String(character.color ?? "");

  if (!id || !name || !color) {
    return null;
  }

  const normalizedCategories = character.statCategories
    ? normalizeCharacterStatCategories(character.statCategories)
    : migrateLegacyStats(character);
  const normalizedBackgroundEntries = character.backgroundEntries
    ? normalizeCharacterBackgroundEntries(character.backgroundEntries)
    : [];

  const nextCharacter = {
    id,
    name,
    color,
    isNpc: character.isNpc === true,
    ...normalizeTokenAvatarFields(character),
  };

  if (normalizedCategories.length > 0) {
    nextCharacter.statCategories = normalizedCategories;
  }

  if (normalizedBackgroundEntries.length > 0) {
    nextCharacter.backgroundEntries = normalizedBackgroundEntries;
  }

  return nextCharacter;
}

export function normalizeTokenName(name) {
  const normalizedName = String(name ?? "").trim();
  return normalizedName.length > 0 ? normalizedName.slice(0, 24) : null;
}

function statsStructureMatches(previous, next) {
  if (previous.length !== next.length) {
    return false;
  }

  const previousById = new Map(previous.map((stat) => [stat.id, stat]));
  return next.every((stat) => {
    const existing = previousById.get(stat.id);
    return Boolean(existing && existing.name === stat.name);
  });
}

export function statCategoriesStructureMatches(previous, next) {
  if (previous.length !== next.length) {
    return false;
  }

  return previous.every((category, index) => {
    const incoming = next[index];
    return Boolean(
      incoming &&
        incoming.id === category.id &&
        incoming.name === category.name &&
        statsStructureMatches(category.stats, incoming.stats),
    );
  });
}
