import type { CharacterStat, CharacterStatCategory } from "../../core/types";

const MAX_STAT_NAME_LENGTH = 16;
const MAX_CATEGORY_NAME_LENGTH = 24;

export const STATS_PER_CATEGORY = 8;
export const MAX_STAT_CATEGORIES = 8;

export function getCharacterStatCategories(character: { statCategories?: CharacterStatCategory[] }): CharacterStatCategory[] {
  return character.statCategories ?? [];
}

export function createCharacterStat(index: number): CharacterStat {
  return {
    id: crypto.randomUUID(),
    name: `数值${index}`,
    value: 0,
  };
}

export function createCharacterStatCategory(index: number): CharacterStatCategory {
  return {
    id: crypto.randomUUID(),
    name: `属性${index}`,
    stats: [],
  };
}

export function cloneCharacterStatCategories(
  categories: CharacterStatCategory[] | undefined,
): CharacterStatCategory[] | undefined {
  if (!categories?.length) {
    return undefined;
  }

  return categories.map((category) => ({
    id: crypto.randomUUID(),
    name: category.name,
    stats: category.stats.map((stat) => ({
      id: crypto.randomUUID(),
      name: stat.name,
      value: stat.value,
    })),
  }));
}

export function normalizeStatName(name: string): string {
  return name.trim().slice(0, MAX_STAT_NAME_LENGTH);
}

export function normalizeCategoryName(name: string): string {
  return name.trim().slice(0, MAX_CATEGORY_NAME_LENGTH);
}

export function normalizeStatValue(value: unknown): number | null {
  const numericValue = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return numericValue;
}

export function statsStructureMatches(previous: CharacterStat[], next: CharacterStat[]): boolean {
  if (previous.length !== next.length) {
    return false;
  }

  const previousById = new Map(previous.map((stat) => [stat.id, stat]));
  return next.every((stat) => {
    const existing = previousById.get(stat.id);
    return Boolean(existing && existing.name === stat.name);
  });
}

export function statCategoriesStructureMatches(
  previous: CharacterStatCategory[],
  next: CharacterStatCategory[],
): boolean {
  if (previous.length !== next.length) {
    return false;
  }

  return previous.every((category, index) => {
    const incoming = next[index];
    return Boolean(incoming && incoming.id === category.id && incoming.name === category.name && statsStructureMatches(category.stats, incoming.stats));
  });
}

export function buildDuplicateCharacterName(sourceName: string): string {
  const suffix = " 副本";
  const maxBaseLength = 24 - suffix.length;
  return `${sourceName.slice(0, maxBaseLength)}${suffix}`;
}
