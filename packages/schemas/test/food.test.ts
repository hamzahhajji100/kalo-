import type { Nutrients as CoreNutrients } from '@kalo/core';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { Food, foodId, type Nutrients } from '../src';

describe('Food', () => {
  it('applies defaults', () => {
    const f = Food.parse({
      id: foodId('usda', '171077'),
      source: 'usda',
      sourceId: '171077',
      name: 'Hähnchenbrust, roh',
      per100g: { kcal: 120, protein: 22.5, carbs: 0, fat: 2.6 },
    });
    expect(f).toMatchObject({
      id: 'usda:171077',
      isLiquid: false,
      portions: [],
      allergens: [],
      verified: false,
    });
  });

  it('rejects impossible values and bad barcodes', () => {
    const base = { id: 'x:1', source: 'custom', sourceId: '1', name: 'x' } as const;
    expect(
      Food.safeParse({ ...base, per100g: { kcal: 1200, protein: 0, carbs: 0, fat: 0 } }).success,
    ).toBe(false);
    expect(
      Food.safeParse({
        ...base,
        barcode: 'abc',
        per100g: { kcal: 1, protein: 0, carbs: 0, fat: 0 },
      }).success,
    ).toBe(false);
  });

  it('is compatible with the core nutrient type', () => {
    expectTypeOf<Nutrients>().toExtend<CoreNutrients>();
  });
});
