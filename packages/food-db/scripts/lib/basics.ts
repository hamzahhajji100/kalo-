import type { Food } from '@kalo/schemas';

import type { BasicFood } from '../data/basics-de';

/** Popularity given to curated basics so generic queries ("Reis") rank them first. */
export const BASIC_POPULARITY = 50_000;

/**
 * Attach German names to USDA foods. Returns the localised foods plus the curated entries that had no
 * matching USDA description (so they can be fixed instead of silently dropped).
 */
export function applyGermanBasics(
  usdaFoods: Food[],
  basics: BasicFood[],
): { foods: { food: Food; popularity: number }[]; missing: string[] } {
  const byDescription = new Map(basics.map((b) => [b.usda.toLowerCase(), b]));
  const found = new Set<string>();
  const foods = usdaFoods.map((f) => {
    const b = byDescription.get(f.name.toLowerCase());
    if (!b) return { food: f, popularity: 0 };
    found.add(b.usda.toLowerCase());
    return {
      food: {
        ...f,
        name: b.de,
        nameAlt: f.name,
        isLiquid: b.liquid ?? f.isLiquid,
        portions: [...(b.portions ?? []), ...f.portions],
      },
      popularity: BASIC_POPULARITY,
    };
  });
  return {
    foods,
    missing: basics.filter((b) => !found.has(b.usda.toLowerCase())).map((b) => b.usda),
  };
}
