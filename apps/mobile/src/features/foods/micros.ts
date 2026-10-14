import type { Food } from '@kalo/schemas';

/** Micronutrients for an eaten amount, from per-100 g values. */
export function microsFor(
  food: Pick<Food, 'micros'>,
  grams: number,
): Record<string, number> | null {
  if (!food.micros) return null;
  const entries = Object.entries(food.micros).filter(
    (e): e is [string, number] => typeof e[1] === 'number',
  );
  return entries.length
    ? Object.fromEntries(entries.map(([k, v]) => [k, (v * grams) / 100]))
    : null;
}
