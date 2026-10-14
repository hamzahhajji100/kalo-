import type { Food } from '@kalo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Db } from '@/data/db';
import { addEntry, listEntries } from '@/data/repositories/diary';
import { isFavorite, listFavorites, toggleFavorite } from '@/data/repositories/favorites';
import {
  deleteFood,
  getFood,
  getFoodByBarcode,
  listUserFoods,
  upsertFood,
} from '@/data/repositories/foods';
import { ensureDefaultMealTypes, listMealTypes } from '@/data/repositories/mealTypes';
import {
  deleteRecipe,
  getRecipe,
  listRecipes,
  recipeAsFood,
  recipeIngredients,
  recipeNutrition,
  saveRecipe,
} from '@/data/repositories/recipes';
import {
  applyTemplate,
  deleteTemplate,
  listTemplates,
  saveTemplateFromMeal,
} from '@/data/repositories/templates';
import { createTestDb } from './testDb';

let db: Db;
beforeEach(() => {
  db = createTestDb();
  ensureDefaultMealTypes(db);
});

const skyr: Food = {
  id: 'off:5701000000001',
  source: 'off',
  sourceId: '5701000000001',
  barcode: '5701000000001',
  name: 'Skyr Natur',
  brand: 'Arla',
  isLiquid: false,
  per100g: { kcal: 63, protein: 11, carbs: 4, fat: 0.2, sugar: 4 },
  micros: { calciumMg: 150 },
  portions: [{ label: '1 Becher', grams: 450 }],
  nutriScore: 'a',
  ingredients: 'Magermilch',
  allergens: ['milk'],
  verified: true,
};

describe('foods', () => {
  it('upserts and reads foods by id and barcode', () => {
    upsertFood(db, skyr);
    upsertFood(db, { ...skyr, name: 'Skyr Natur 0,2 %' });
    const f = getFood(db, skyr.id)!;
    expect({ ...f, updatedAt: undefined }).toEqual({
      ...skyr,
      name: 'Skyr Natur 0,2 %',
      updatedAt: undefined,
    });
    expect(getFoodByBarcode(db, '5701000000001')?.name).toBe('Skyr Natur 0,2 %');
    expect(getFoodByBarcode(db, '1')).toBeUndefined();
    expect(getFood(db, 'nope')).toBeUndefined();
  });

  it('prefers a user-created product for a barcode', () => {
    upsertFood(db, skyr);
    upsertFood(db, {
      ...skyr,
      id: 'custom:abc',
      source: 'custom',
      sourceId: 'abc',
      name: 'Mein Skyr',
    });
    expect(getFoodByBarcode(db, skyr.barcode!)?.name).toBe('Mein Skyr');
  });

  it('lists and deletes user foods, rejecting invalid ones', () => {
    upsertFood(db, skyr);
    upsertFood(db, {
      ...skyr,
      id: 'recipe:x',
      source: 'recipe',
      sourceId: 'x',
      barcode: undefined,
    });
    expect(listUserFoods(db).map((f) => f.id)).toEqual([skyr.id]);
    deleteFood(db, skyr.id);
    expect(listUserFoods(db)).toEqual([]);
    expect(() =>
      upsertFood(db, { ...skyr, per100g: { kcal: -1, protein: 0, carbs: 0, fat: 0 } }),
    ).toThrow();
  });
});

describe('favorites', () => {
  it('toggles and lists snapshots', () => {
    expect(toggleFavorite(db, skyr)).toBe(true);
    expect(isFavorite(db, skyr.id)).toBe(true);
    expect(listFavorites(db)).toEqual([skyr]);
    expect(toggleFavorite(db, skyr)).toBe(false);
    expect(listFavorites(db)).toEqual([]);
  });
});

describe('recipes', () => {
  const ingredients = [
    {
      foodId: 'usda:oats',
      name: 'Haferflocken',
      grams: 200,
      per100g: { kcal: 380, protein: 13, carbs: 60, fat: 7, fiber: 10 },
    },
    {
      foodId: 'usda:milk',
      name: 'Milch',
      grams: 600,
      per100g: { kcal: 64, protein: 3.4, carbs: 4.8, fat: 3.5 },
    },
  ];

  it('saves, updates and computes nutrition per serving', () => {
    const id = saveRecipe(db, { name: 'Porridge', servings: 4, ingredients });
    saveRecipe(db, {
      id,
      name: 'Porridge (4 Portionen)',
      servings: 4,
      totalGrams: 1000,
      ingredients,
    });
    const r = getRecipe(db, id)!;
    expect(r.name).toBe('Porridge (4 Portionen)');
    expect(recipeIngredients(r)).toEqual(ingredients);

    const n = recipeNutrition({ ...r, ingredients: recipeIngredients(r) });
    expect(n.total.kcal).toBeCloseTo(760 + 384);
    expect(n.perServing.kcal).toBeCloseTo(286);
    expect(n.grams).toBe(1000);
    expect(n.servingGrams).toBe(250);

    const food = recipeAsFood(r)!;
    expect(food).toMatchObject({
      id: `recipe:${id}`,
      source: 'recipe',
      portions: [{ label: '1 Portion', grams: 250 }],
    });
    expect(food.per100g.kcal).toBeCloseTo(114.4);
  });

  it('falls back to raw weight and handles empty recipes', () => {
    const id = saveRecipe(db, { name: 'Leer', servings: 0, ingredients: [] });
    const r = getRecipe(db, id)!;
    expect(recipeAsFood(r)).toBeUndefined();
    expect(recipeNutrition({ ...r, ingredients: recipeIngredients(r) }).grams).toBe(0);
    expect(listRecipes(db)).toHaveLength(1);
    deleteRecipe(db, id);
    expect(getRecipe(db, id)).toBeUndefined();
  });
});

describe('templates', () => {
  it('saves a meal as template and applies it to another day', () => {
    const [breakfast, , dinner] = listMealTypes(db);
    addEntry(db, {
      date: '2026-10-14',
      mealTypeId: breakfast!.id,
      foodId: 'usda:oats',
      name: 'Haferflocken',
      grams: 50,
      nutrients: { kcal: 190, protein: 6.5, carbs: 30, fat: 3.5 },
      source: 'search',
    });
    addEntry(db, {
      date: '2026-10-14',
      mealTypeId: breakfast!.id,
      name: 'Kaffee',
      nutrients: { kcal: 5, protein: 0, carbs: 0, fat: 0 },
      source: 'quick',
    });
    expect(
      saveTemplateFromMeal(db, {
        name: 'Mein Frühstück',
        date: '2026-10-14',
        mealTypeId: dinner!.id,
      }),
    ).toBeUndefined();
    const id = saveTemplateFromMeal(db, {
      name: 'Mein Frühstück',
      date: '2026-10-14',
      mealTypeId: breakfast!.id,
    })!;

    expect(listTemplates(db)).toMatchObject([
      { name: 'Mein Frühstück', items: [{ name: 'Haferflocken' }, { name: 'Kaffee' }] },
    ]);
    expect(applyTemplate(db, { templateId: id, date: '2026-10-15', mealTypeId: dinner!.id })).toBe(
      2,
    );
    expect(listEntries(db, '2026-10-15')).toMatchObject([
      { name: 'Haferflocken', source: 'template', grams: 50 },
      { name: 'Kaffee' },
    ]);
    deleteTemplate(db, id);
    expect(listTemplates(db)).toEqual([]);
  });
});
