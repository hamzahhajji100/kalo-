import type { Food } from '@kalo/schemas';

export interface UnitOption {
  key: string;
  label: string;
  grams: number;
}

/** Unit choices for a food: grams (or ml) plus its portions, without duplicates. */
export function unitOptions(food: Food, t: (k: string) => string): UnitOption[] {
  const base: UnitOption = { key: 'g', label: food.isLiquid ? 'ml' : 'g', grams: 1 };
  const seen = new Set<string>();
  const portions = food.portions.flatMap((p, i) => {
    const label =
      p.label === 'package'
        ? t('food.package')
        : p.label === 'serving'
          ? t('food.serving')
          : p.label;
    const key = `${label}|${p.grams}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [
      { key: `p${i}`, label: `${label} (${Math.round(p.grams)} ${base.label})`, grams: p.grams },
    ];
  });
  return [base, ...portions];
}

/** Initial unit and quantity: a remembered gram amount, else the first portion, else 100 g. */
export function initialAmount(
  options: UnitOption[],
  grams?: number,
): { unit: UnitOption; quantity: number } {
  if (grams && grams > 0) return { unit: options[0]!, quantity: grams };
  const portion = options[1];
  return portion ? { unit: portion, quantity: 1 } : { unit: options[0]!, quantity: 100 };
}
