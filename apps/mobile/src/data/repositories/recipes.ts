import { scaleNutrients, sumNutrients, type Nutrients } from '@kalo/core';
import { foodId, type Food } from '@kalo/schemas';
import { asc, desc, eq } from 'drizzle-orm';

import { newId } from '@/lib/id';
import type { Db } from '../db';
import { recipeItems, recipes } from '../schema';

export type Recipe = typeof recipes.$inferSelect;
export type RecipeItem = typeof recipeItems.$inferSelect;

export interface RecipeIngredient {
  foodId: string;
  name: string;
  grams: number;
  /** Per 100 g. */
  per100g: Nutrients;
}

export interface RecipeWithItems extends Recipe {
  items: RecipeItem[];
}

const per100 = (i: RecipeItem): Nutrients => ({
  kcal: i.kcal,
  protein: i.protein,
  carbs: i.carbs,
  fat: i.fat,
  ...(i.fiber !== null && { fiber: i.fiber }),
  ...(i.sugar !== null && { sugar: i.sugar }),
  ...(i.saturatedFat !== null && { saturatedFat: i.saturatedFat }),
  ...(i.salt !== null && { salt: i.salt }),
});

export function saveRecipe(
  db: Db,
  r: {
    id?: string;
    name: string;
    servings: number;
    totalGrams?: number | null;
    ingredients: RecipeIngredient[];
  },
): string {
  const id = r.id ?? newId();
  db.transaction((tx) => {
    const now = new Date().toISOString();
    tx.insert(recipes)
      .values({
        id,
        name: r.name,
        servings: r.servings,
        totalGrams: r.totalGrams ?? null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: recipes.id,
        set: {
          name: r.name,
          servings: r.servings,
          totalGrams: r.totalGrams ?? null,
          updatedAt: now,
        },
      })
      .run();
    tx.delete(recipeItems).where(eq(recipeItems.recipeId, id)).run();
    r.ingredients.forEach((ing, sort) =>
      tx
        .insert(recipeItems)
        .values({
          recipeId: id,
          foodId: ing.foodId,
          name: ing.name,
          grams: ing.grams,
          sort,
          kcal: ing.per100g.kcal,
          protein: ing.per100g.protein,
          carbs: ing.per100g.carbs,
          fat: ing.per100g.fat,
          fiber: ing.per100g.fiber ?? null,
          sugar: ing.per100g.sugar ?? null,
          saturatedFat: ing.per100g.saturatedFat ?? null,
          salt: ing.per100g.salt ?? null,
        })
        .run(),
    );
  });
  return id;
}

export function getRecipe(db: Db, id: string): RecipeWithItems | undefined {
  const r = db.select().from(recipes).where(eq(recipes.id, id)).get();
  if (!r) return undefined;
  const items = db
    .select()
    .from(recipeItems)
    .where(eq(recipeItems.recipeId, id))
    .orderBy(asc(recipeItems.sort))
    .all();
  return { ...r, items };
}

export function listRecipes(db: Db): RecipeWithItems[] {
  return db
    .select()
    .from(recipes)
    .orderBy(desc(recipes.updatedAt))
    .all()
    .map((r) => getRecipe(db, r.id)!);
}

export function deleteRecipe(db: Db, id: string): void {
  db.delete(recipes).where(eq(recipes.id, id)).run();
}

export function recipeIngredients(r: RecipeWithItems): RecipeIngredient[] {
  return r.items.map((i) => ({
    foodId: i.foodId,
    name: i.name,
    grams: i.grams,
    per100g: per100(i),
  }));
}

/** Totals for the whole recipe and per serving. */
export function recipeNutrition(
  r: Pick<RecipeWithItems, 'servings' | 'totalGrams'> & { ingredients: RecipeIngredient[] },
) {
  const total = sumNutrients(r.ingredients.map((i) => scaleNutrients(i.per100g, i.grams)));
  const rawGrams = r.ingredients.reduce((s, i) => s + i.grams, 0);
  const grams = r.totalGrams && r.totalGrams > 0 ? r.totalGrams : rawGrams;
  const servings = Math.max(1, r.servings);
  const f = 1 / servings;
  return {
    total,
    grams,
    perServing: scaleNutrients(total, 100 * f),
    servingGrams: grams * f,
  };
}

/**
 * A recipe as a Food, so it can be searched and logged like any food. Values are per 100 g of the
 * finished dish; "1 Portion" is the default portion.
 */
export function recipeAsFood(r: RecipeWithItems, portionLabel = '1 Portion'): Food | undefined {
  const n = recipeNutrition({ ...r, ingredients: recipeIngredients(r) });
  if (n.grams <= 0) return undefined;
  return {
    id: foodId('recipe', r.id),
    source: 'recipe',
    sourceId: r.id,
    name: r.name,
    isLiquid: false,
    per100g: scaleNutrients(n.total, (100 / n.grams) * 100),
    portions: [{ label: portionLabel, grams: n.servingGrams }],
    allergens: [],
    verified: false,
  };
}
