import { asc, eq } from 'drizzle-orm';

import type { Db } from '../db';
import { mealTypes } from '../schema';

export type MealType = typeof mealTypes.$inferSelect;
export const DEFAULT_MEAL_KEYS = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;

/** Insert the four default meal types once. Safe to call on every start. */
export function ensureDefaultMealTypes(db: Db): void {
  const existing = db.select({ id: mealTypes.id }).from(mealTypes).limit(1).all();
  if (existing.length > 0) return;
  db.insert(mealTypes)
    .values(DEFAULT_MEAL_KEYS.map((key, sort) => ({ key, sort })))
    .run();
}

export function listMealTypes(db: Db, { includeArchived = false } = {}): MealType[] {
  const rows = db.select().from(mealTypes).orderBy(asc(mealTypes.sort)).all();
  return includeArchived ? rows : rows.filter((r) => !r.archived);
}

export function addMealType(db: Db, name: string): number {
  const all = listMealTypes(db, { includeArchived: true });
  const sort = all.reduce((max, m) => Math.max(max, m.sort), -1) + 1;
  return db.insert(mealTypes).values({ name, sort }).returning({ id: mealTypes.id }).get().id;
}

export function renameMealType(db: Db, id: number, name: string): void {
  db.update(mealTypes).set({ name }).where(eq(mealTypes.id, id)).run();
}

/** Archive instead of delete so old diary entries keep their meal. */
export function setMealTypeArchived(db: Db, id: number, archived: boolean): void {
  db.update(mealTypes).set({ archived }).where(eq(mealTypes.id, id)).run();
}

/** Meal that fits the current time of day; used to preselect the meal when adding food. */
export function mealKeyForTime(d: Date): (typeof DEFAULT_MEAL_KEYS)[number] {
  const minutes = d.getHours() * 60 + d.getMinutes();
  if (minutes >= 4 * 60 && minutes < 10 * 60 + 30) return 'breakfast';
  if (minutes >= 11 * 60 && minutes < 14 * 60 + 30) return 'lunch';
  if (minutes >= 17 * 60 && minutes < 21 * 60 + 30) return 'dinner';
  return 'snacks';
}
