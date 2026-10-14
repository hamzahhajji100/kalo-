import { desc, eq } from 'drizzle-orm';

import { newId } from '@/lib/id';
import type { Db } from '../db';
import { mealTemplateItems, mealTemplates } from '../schema';
import { addEntries, entryNutrients, listEntries } from './diary';

export type MealTemplate = typeof mealTemplates.$inferSelect & {
  items: (typeof mealTemplateItems.$inferSelect)[];
};

/** Save the entries of one meal on a day as a reusable template. */
export function saveTemplateFromMeal(
  db: Db,
  params: { name: string; date: string; mealTypeId: number },
): string | undefined {
  const entries = listEntries(db, params.date).filter((e) => e.mealTypeId === params.mealTypeId);
  if (entries.length === 0) return undefined;
  const id = newId();
  db.transaction((tx) => {
    tx.insert(mealTemplates).values({ id, name: params.name }).run();
    for (const e of entries) {
      tx.insert(mealTemplateItems)
        .values({
          templateId: id,
          foodId: e.foodId,
          name: e.name,
          brand: e.brand,
          grams: e.grams,
          amountLabel: e.amountLabel,
          kcal: e.kcal,
          protein: e.protein,
          carbs: e.carbs,
          fat: e.fat,
          fiber: e.fiber,
          sugar: e.sugar,
          saturatedFat: e.saturatedFat,
          salt: e.salt,
        })
        .run();
    }
  });
  return id;
}

export function listTemplates(db: Db): MealTemplate[] {
  return db
    .select()
    .from(mealTemplates)
    .orderBy(desc(mealTemplates.createdAt))
    .all()
    .map((t) => ({
      ...t,
      items: db
        .select()
        .from(mealTemplateItems)
        .where(eq(mealTemplateItems.templateId, t.id))
        .all(),
    }));
}

export function deleteTemplate(db: Db, id: string): void {
  db.delete(mealTemplates).where(eq(mealTemplates.id, id)).run();
}

/** Log every item of a template into a meal. Returns the number of entries added. */
export function applyTemplate(
  db: Db,
  params: { templateId: string; date: string; mealTypeId: number },
): number {
  const items = db
    .select()
    .from(mealTemplateItems)
    .where(eq(mealTemplateItems.templateId, params.templateId))
    .all();
  addEntries(
    db,
    items.map((i) => ({
      date: params.date,
      mealTypeId: params.mealTypeId,
      foodId: i.foodId,
      name: i.name,
      brand: i.brand,
      grams: i.grams,
      amountLabel: i.amountLabel,
      nutrients: entryNutrients(i),
      source: 'template' as const,
    })),
  );
  return items.length;
}
