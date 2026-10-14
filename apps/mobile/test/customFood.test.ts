import { describe, expect, it } from 'vitest';

import { buildCustomFood, emptyCustomFood } from '@/features/foods/customFood';

const t = (k: string) => k;
const valid = {
  ...emptyCustomFood('4012345678901'),
  name: ' Proteinriegel ',
  brand: 'Marke',
  kcal: '360',
  protein: '33',
  carbs: '30',
  sugar: '3,5',
  fat: '12',
  saturatedFat: '6',
  fiber: '8',
  salt: '0,4',
  servingGrams: '45',
  packageGrams: '45',
};

describe('buildCustomFood', () => {
  it('builds a food from a complete label', () => {
    const r = buildCustomFood(valid, 'abc', t);
    expect(r).toMatchObject({
      ok: true,
      food: {
        id: 'custom:abc',
        source: 'custom',
        barcode: '4012345678901',
        name: 'Proteinriegel',
        brand: 'Marke',
        per100g: {
          kcal: 360,
          protein: 33,
          carbs: 30,
          sugar: 3.5,
          fat: 12,
          saturatedFat: 6,
          fiber: 8,
          salt: 0.4,
        },
        portions: [
          { label: 'serving', grams: 45 },
          { label: 'package', grams: 45 },
        ],
      },
    });
  });

  it('accepts a minimal label without optional values', () => {
    const r = buildCustomFood(
      {
        ...emptyCustomFood(),
        name: 'Wasser',
        kcal: '0',
        protein: '0',
        carbs: '0',
        fat: '0',
        isLiquid: true,
      },
      'w',
      t,
    );
    expect(r).toMatchObject({
      ok: true,
      food: { isLiquid: true, portions: [], per100g: { kcal: 0 } },
    });
    expect(r.ok && r.food.barcode).toBeUndefined();
  });

  it('reports field errors', () => {
    const r = buildCustomFood(
      {
        ...valid,
        name: '',
        kcal: '',
        sugar: '40',
        saturatedFat: '20',
        protein: '-1',
        barcode: '12',
        fiber: 'abc',
      },
      'x',
      t,
    );
    expect(r).toEqual({
      ok: false,
      errors: {
        name: 'customFood.errors.name',
        kcal: 'customFood.errors.number',
        protein: 'customFood.errors.range',
        sugar: 'customFood.errors.sugar',
        saturatedFat: 'customFood.errors.saturatedFat',
        fiber: 'customFood.errors.number',
        barcode: 'customFood.errors.barcode',
      },
    });
  });

  it('rejects labels whose energy contradicts the macros', () => {
    expect(buildCustomFood({ ...valid, kcal: '800' }, 'x', t)).toEqual({
      ok: false,
      errors: { plausibility: 'customFood.errors.plausibility' },
    });
  });
});
