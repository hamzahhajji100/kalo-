import { Food, type Portion } from '@kalo/schemas';
import { desc, eq, ne } from 'drizzle-orm';

import type { Db } from '../db';
import { foods } from '../schema';

type FoodRow = typeof foods.$inferSelect;

export function rowToFood(r: FoodRow): Food {
  return {
    id: r.id,
    source: r.source,
    sourceId: r.sourceId,
    ...(r.barcode && { barcode: r.barcode }),
    name: r.name,
    ...(r.nameAlt && { nameAlt: r.nameAlt }),
    ...(r.brand && { brand: r.brand }),
    ...(r.imageUrl && { imageUrl: r.imageUrl }),
    isLiquid: r.isLiquid,
    per100g: {
      kcal: r.kcal,
      protein: r.protein,
      carbs: r.carbs,
      fat: r.fat,
      ...(r.fiber !== null && { fiber: r.fiber }),
      ...(r.sugar !== null && { sugar: r.sugar }),
      ...(r.saturatedFat !== null && { saturatedFat: r.saturatedFat }),
      ...(r.salt !== null && { salt: r.salt }),
    },
    ...(r.microsJson && { micros: JSON.parse(r.microsJson) as Food['micros'] }),
    portions: JSON.parse(r.portionsJson) as Portion[],
    ...(r.nutriScore && { nutriScore: r.nutriScore as Food['nutriScore'] }),
    ...(r.ingredients && { ingredients: r.ingredients }),
    allergens: JSON.parse(r.allergensJson) as string[],
    verified: r.verified,
    updatedAt: r.updatedAt,
  };
}

/** Save a food the user created, scanned or looked up online, so it is available offline later. */
export function upsertFood(db: Db, input: Food): void {
  const f = Food.parse(input);
  const values = {
    source: f.source,
    sourceId: f.sourceId,
    barcode: f.barcode ?? null,
    name: f.name,
    nameAlt: f.nameAlt ?? null,
    brand: f.brand ?? null,
    imageUrl: f.imageUrl ?? null,
    isLiquid: f.isLiquid,
    kcal: f.per100g.kcal,
    protein: f.per100g.protein,
    carbs: f.per100g.carbs,
    fat: f.per100g.fat,
    fiber: f.per100g.fiber ?? null,
    sugar: f.per100g.sugar ?? null,
    saturatedFat: f.per100g.saturatedFat ?? null,
    salt: f.per100g.salt ?? null,
    microsJson: f.micros ? JSON.stringify(f.micros) : null,
    portionsJson: JSON.stringify(f.portions),
    nutriScore: f.nutriScore ?? null,
    ingredients: f.ingredients ?? null,
    allergensJson: JSON.stringify(f.allergens),
    verified: f.verified,
    updatedAt: new Date().toISOString(),
  };
  db.insert(foods)
    .values({ id: f.id, ...values })
    .onConflictDoUpdate({ target: foods.id, set: values })
    .run();
}

export function getFood(db: Db, id: string): Food | undefined {
  const r = db.select().from(foods).where(eq(foods.id, id)).get();
  return r ? rowToFood(r) : undefined;
}

/** Most recently saved food with this barcode (user-created entries win over cached ones). */
export function getFoodByBarcode(db: Db, barcode: string): Food | undefined {
  const rows = db
    .select()
    .from(foods)
    .where(eq(foods.barcode, barcode))
    .orderBy(desc(foods.updatedAt))
    .all();
  const r = rows.find((x) => x.source === 'custom') ?? rows[0];
  return r ? rowToFood(r) : undefined;
}

/** All foods stored on the device except recipe snapshots, newest first. */
export function listUserFoods(db: Db, { limit = 2000 } = {}): Food[] {
  return db
    .select()
    .from(foods)
    .where(ne(foods.source, 'recipe'))
    .orderBy(desc(foods.updatedAt))
    .limit(limit)
    .all()
    .map(rowToFood);
}

export function deleteFood(db: Db, id: string): void {
  db.delete(foods).where(eq(foods.id, id)).run();
}
