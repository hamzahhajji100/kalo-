import { isPlausiblePer100g } from '@kalo/core';
import { foodId, type Food } from '@kalo/schemas';

import { parseDecimal } from '@/lib/number';

export interface CustomFoodForm {
  name: string;
  brand: string;
  barcode: string;
  isLiquid: boolean;
  kcal: string;
  protein: string;
  carbs: string;
  sugar: string;
  fat: string;
  saturatedFat: string;
  fiber: string;
  salt: string;
  servingGrams: string;
  packageGrams: string;
}

export const emptyCustomFood = (barcode = ''): CustomFoodForm => ({
  name: '',
  brand: '',
  barcode,
  isLiquid: false,
  kcal: '',
  protein: '',
  carbs: '',
  sugar: '',
  fat: '',
  saturatedFat: '',
  fiber: '',
  salt: '',
  servingGrams: '',
  packageGrams: '',
});

export type CustomFoodErrors = Partial<Record<keyof CustomFoodForm | 'plausibility', string>>;

/**
 * Validate the form and build a Food. Required: name, kcal, protein, carbs, fat (per 100 g).
 * "Sub-values" (sugar ≤ carbs, saturates ≤ fat) and energy-vs-macros plausibility are checked.
 */
export function buildCustomFood(
  form: CustomFoodForm,
  id: string,
  t: (k: string) => string,
): { ok: true; food: Food } | { ok: false; errors: CustomFoodErrors } {
  const errors: CustomFoodErrors = {};
  const num = (key: keyof CustomFoodForm, required: boolean, max: number) => {
    const raw = form[key] as string;
    const v = parseDecimal(raw);
    if (v === undefined) {
      if (required || raw.trim()) errors[key] = t('customFood.errors.number');
      return undefined;
    }
    if (v < 0 || v > max) errors[key] = t('customFood.errors.range');
    return v;
  };

  if (!form.name.trim()) errors.name = t('customFood.errors.name');
  const kcal = num('kcal', true, 900);
  const protein = num('protein', true, 100);
  const carbs = num('carbs', true, 100);
  const fat = num('fat', true, 100);
  const sugar = num('sugar', false, 100);
  const saturatedFat = num('saturatedFat', false, 100);
  const fiber = num('fiber', false, 100);
  const salt = num('salt', false, 100);
  const servingGrams = num('servingGrams', false, 5000);
  const packageGrams = num('packageGrams', false, 20000);
  if (sugar !== undefined && carbs !== undefined && sugar > carbs)
    errors.sugar = t('customFood.errors.sugar');
  if (saturatedFat !== undefined && fat !== undefined && saturatedFat > fat)
    errors.saturatedFat = t('customFood.errors.saturatedFat');
  const barcode = form.barcode.replace(/\D/g, '');
  if (barcode && !/^\d{8,14}$/.test(barcode)) errors.barcode = t('customFood.errors.barcode');

  if (
    Object.keys(errors).length > 0 ||
    kcal === undefined ||
    protein === undefined ||
    carbs === undefined ||
    fat === undefined
  ) {
    return { ok: false, errors };
  }
  const per100g = {
    kcal,
    protein,
    carbs,
    fat,
    ...(sugar !== undefined && { sugar }),
    ...(saturatedFat !== undefined && { saturatedFat }),
    ...(fiber !== undefined && { fiber }),
    ...(salt !== undefined && { salt }),
  };
  if (!isPlausiblePer100g(per100g))
    return { ok: false, errors: { plausibility: t('customFood.errors.plausibility') } };

  return {
    ok: true,
    food: {
      id: foodId('custom', id),
      source: 'custom',
      sourceId: id,
      ...(barcode && { barcode }),
      name: form.name.trim(),
      ...(form.brand.trim() && { brand: form.brand.trim() }),
      isLiquid: form.isLiquid,
      per100g,
      portions: [
        ...(servingGrams ? [{ label: 'serving', grams: servingGrams }] : []),
        ...(packageGrams ? [{ label: 'package', grams: packageGrams }] : []),
      ],
      allergens: [],
      verified: false,
    },
  };
}
