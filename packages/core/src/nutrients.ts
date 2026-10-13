import type { Nutrients } from './types';

const OPTIONAL_KEYS = ['fiber', 'sugar', 'saturatedFat', 'salt'] as const;

export const ZERO_NUTRIENTS: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

/** Scale per-100 g values to an eaten amount in grams. Optional values stay undefined if unknown. */
export function scaleNutrients(per100g: Nutrients, grams: number): Nutrients {
  const f = grams / 100;
  const out: Nutrients = {
    kcal: per100g.kcal * f,
    protein: per100g.protein * f,
    carbs: per100g.carbs * f,
    fat: per100g.fat * f,
  };
  for (const k of OPTIONAL_KEYS) {
    const v = per100g[k];
    if (v !== undefined) out[k] = v * f;
  }
  return out;
}

/** Sum nutrients. An optional value is only reported if at least one item has it. */
export function sumNutrients(items: readonly Nutrients[]): Nutrients {
  const out: Nutrients = { ...ZERO_NUTRIENTS };
  for (const n of items) {
    out.kcal += n.kcal;
    out.protein += n.protein;
    out.carbs += n.carbs;
    out.fat += n.fat;
    for (const k of OPTIONAL_KEYS) {
      const v = n[k];
      if (v !== undefined) out[k] = (out[k] ?? 0) + v;
    }
  }
  return out;
}

/** Energy implied by macros (Atwater factors 4/4/9). */
export const kcalFromMacros = (n: Pick<Nutrients, 'protein' | 'carbs' | 'fat'>) =>
  n.protein * 4 + n.carbs * 4 + n.fat * 9;

/**
 * Plausibility check for per-100 g values: macros cannot exceed 100 g and stated energy must roughly
 * match the Atwater estimate. Used to reject broken API/AI data.
 */
export function isPlausiblePer100g(n: Nutrients): boolean {
  const values = [n.kcal, n.protein, n.carbs, n.fat];
  if (values.some((v) => !Number.isFinite(v) || v < 0)) return false;
  if (n.kcal > 900 || n.protein + n.carbs + n.fat > 101) return false;
  const expected = kcalFromMacros(n);
  // Fibre, alcohol and polyols cause legitimate deviations, so the tolerance is generous.
  return Math.abs(expected - n.kcal) <= Math.max(40, n.kcal * 0.35);
}

/** Relative deviation between two per-100 g energy values (0 = identical). */
export function relativeKcalDeviation(a: number, b: number): number {
  const max = Math.max(a, b);
  return max === 0 ? 0 : Math.abs(a - b) / max;
}
