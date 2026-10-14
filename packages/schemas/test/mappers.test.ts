import { describe, expect, it } from 'vitest';

import { Food, mapOffProduct, mapUsdaFood, usdaNutrientMap, usdaToFood } from '../src';
import nutella from './fixtures/off-nutella.json';
import branded from './fixtures/usda-branded-search-hit.json';
import chicken from './fixtures/usda-chicken-detail.json';

describe('mapOffProduct', () => {
  it('maps a complete product', () => {
    const r = mapOffProduct(nutella);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Food.parse(r.food)).toEqual(r.food);
    expect(r.food).toMatchObject({
      id: 'off:3017620422003',
      barcode: '3017620422003',
      name: 'Nutella',
      brand: 'Nutella',
      isLiquid: false,
      per100g: {
        kcal: 539,
        protein: 6.3,
        carbs: 57.5,
        sugar: 56.3,
        fat: 30.9,
        saturatedFat: 10.6,
        salt: 0.107,
      },
      micros: { calciumMg: 120 },
      portions: [
        { label: '15 g', grams: 15 },
        { label: 'package', grams: 400 },
      ],
      nutriScore: 'e',
      allergens: ['milk', 'nuts', 'soybeans'],
      verified: true,
    });
    expect(r.popularity).toBe(9123);
  });

  it('falls back to kJ, sodium, other-language names and detects liquids', () => {
    const r = mapOffProduct({
      code: '4000000000001',
      product_name_en: 'Whole milk',
      quantity: '1 l',
      nutriments: {
        'energy-kj_100g': '268',
        proteins_100g: 3.4,
        carbohydrates_100g: 4.8,
        fat_100g: 3.5,
        sodium_100g: 0.04,
        'vitamin-d_100g': 0.0000001,
        'vitamin-b12_100g': 0.0000004,
      },
    });
    expect(r).toMatchObject({
      ok: true,
      popularity: 0,
      food: {
        name: 'Whole milk',
        isLiquid: true,
        per100g: { kcal: 64.1, salt: 0.1 },
        micros: { vitaminDUg: 0.1, vitaminB12Ug: 0.4 },
        verified: false,
        portions: [],
      },
    });
  });

  it('prefers English names in English mode', () => {
    const r = mapOffProduct(
      { ...nutella, product_name_en: 'Nutella spread', product_name: 'Nutella' },
      'en',
    );
    expect(r.ok && r.food.name).toBe('Nutella spread');
  });

  it.each([
    [{ code: 'abc', product_name: 'x' }, 'barcode'],
    [{ code: '12345678' }, 'name'],
    [{ code: '12345678', product_name: 'x', nutriments: { 'energy-kcal_100g': 100 } }, 'nutrients'],
    [
      {
        code: '12345678',
        product_name: 'x',
        nutriments: {
          'energy-kcal_100g': 900,
          proteins_100g: 1,
          carbohydrates_100g: 1,
          fat_100g: 1,
        },
      },
      'implausible',
    ],
    [{ product_name: 'no code' }, 'schema'],
  ])('rejects %o (%s)', (raw, reason) => {
    expect(mapOffProduct(raw)).toEqual({ ok: false, reason });
  });

  it('ignores http images, invalid nutri-score and absurd portions', () => {
    const r = mapOffProduct({
      ...nutella,
      image_front_url: 'http://insecure',
      image_url: undefined,
      nutriscore_grade: 'unknown',
      serving_quantity: 0,
      product_quantity: 999999,
    });
    expect(r.ok && r.food.imageUrl).toBeUndefined();
    expect(r.ok && r.food.nutriScore).toBeUndefined();
    expect(r.ok && r.food.portions).toEqual([]);
  });
});

describe('USDA', () => {
  it('maps a detail response with portions and micros', () => {
    const r = mapUsdaFood(chicken);
    expect(r).toMatchObject({
      ok: true,
      food: {
        id: 'usda:171077',
        name: 'Chicken, broilers or fryers, breast, meat only, raw',
        per100g: { kcal: 120, protein: 22.5, fat: 2.62, carbs: 0, salt: 0.112 },
        micros: { ironMg: 0.37 },
        portions: [
          { label: '0.5 breast, bone and skin removed', grams: 174 },
          { label: '1 unit', grams: 112 },
        ],
        verified: true,
      },
    });
  });

  it('maps a branded search hit with serving and barcode', () => {
    const r = mapUsdaFood(branded);
    expect(r).toMatchObject({
      ok: true,
      food: {
        brand: 'Example Foods Inc.',
        barcode: '12345678905',
        verified: false,
        portions: [{ label: '1 bar', grams: 60 }],
        per100g: { sugar: 5 },
      },
    });
  });

  it('uses Atwater energy for Foundation foods and rejects incomplete data', () => {
    const r = usdaToFood({
      fdcId: 1,
      description: 'Oats',
      nutrients: new Map([
        [2047, 379],
        [1003, 13.2],
        [1004, 6.5],
        [1005, 67.7],
      ]),
    });
    expect(r.ok && r.food.per100g.kcal).toBe(379);
    expect(usdaToFood({ fdcId: 1, description: 'x', nutrients: new Map([[1008, 100]]) })).toEqual({
      ok: false,
      reason: 'nutrients',
    });
    expect(
      usdaToFood({
        fdcId: 1,
        description: 'x',
        nutrients: new Map([
          [1008, 800],
          [1003, 1],
          [1004, 1],
          [1005, 1],
        ]),
      }),
    ).toEqual({ ok: false, reason: 'implausible' });
    expect(mapUsdaFood({ description: 'missing id' })).toEqual({ ok: false, reason: 'schema' });
  });

  it('keeps the first value for duplicate nutrient ids', () => {
    expect(
      usdaNutrientMap([
        { nutrientId: 1008, value: 1 },
        { nutrientId: 1008, value: 2 },
      ]).get(1008),
    ).toBe(1);
  });
});
