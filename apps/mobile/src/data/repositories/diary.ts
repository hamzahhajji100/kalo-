import { and, asc, desc, eq, gte, isNotNull, lte, sql } from 'drizzle-orm';

import { newId } from '@/lib/id';
import type { Nutrients } from '@kalo/core';
import type { Db } from '../db';
import { diaryEntries, mealTypes } from '../schema';

export type DiaryEntry = typeof diaryEntries.$inferSelect;
export type EntrySource = DiaryEntry['source'];

export interface NewEntry {
  date: string;
  mealTypeId: number;
  name: string;
  brand?: string | null;
  foodId?: string | null;
  recipeId?: string | null;
  grams?: number | null;
  amountLabel?: string | null;
  /** Absolute values for the eaten amount. */
  nutrients: Nutrients;
  /** Absolute micronutrients for the eaten amount (mg/µg), if known. */
  micros?: Record<string, number> | null;
  source: EntrySource;
}

const nutrientFields = (n: Nutrients) => ({
  kcal: n.kcal,
  protein: n.protein,
  carbs: n.carbs,
  fat: n.fat,
  fiber: n.fiber ?? null,
  sugar: n.sugar ?? null,
  saturatedFat: n.saturatedFat ?? null,
  salt: n.salt ?? null,
});

export function entryNutrients(
  e: Pick<DiaryEntry, keyof ReturnType<typeof nutrientFields>>,
): Nutrients {
  const n: Nutrients = { kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat };
  if (e.fiber !== null) n.fiber = e.fiber;
  if (e.sugar !== null) n.sugar = e.sugar;
  if (e.saturatedFat !== null) n.saturatedFat = e.saturatedFat;
  if (e.salt !== null) n.salt = e.salt;
  return n;
}

export function addEntry(db: Db, e: NewEntry): string {
  const id = newId();
  db.insert(diaryEntries)
    .values({
      id,
      date: e.date,
      mealTypeId: e.mealTypeId,
      name: e.name,
      brand: e.brand ?? null,
      foodId: e.foodId ?? null,
      recipeId: e.recipeId ?? null,
      grams: e.grams ?? null,
      amountLabel: e.amountLabel ?? null,
      source: e.source,
      microsJson: e.micros && Object.keys(e.micros).length ? JSON.stringify(e.micros) : null,
      ...nutrientFields(e.nutrients),
    })
    .run();
  return id;
}

export function addEntries(db: Db, entries: NewEntry[]): string[] {
  return db.transaction(() => entries.map((e) => addEntry(db, e)));
}

export function getEntry(db: Db, id: string): DiaryEntry | undefined {
  return db.select().from(diaryEntries).where(eq(diaryEntries.id, id)).get();
}

/** Entries of a day, ordered by meal and time added. */
export function listEntries(db: Db, date: string): DiaryEntry[] {
  return db
    .select({ entry: diaryEntries })
    .from(diaryEntries)
    .innerJoin(mealTypes, eq(mealTypes.id, diaryEntries.mealTypeId))
    .where(eq(diaryEntries.date, date))
    .orderBy(asc(mealTypes.sort), asc(diaryEntries.createdAt))
    .all()
    .map((r) => r.entry);
}

/**
 * Change the eaten amount. Nutrients scale proportionally, so the per-gram values captured
 * when the entry was created are preserved.
 */
export function updateEntryAmount(
  db: Db,
  id: string,
  grams: number,
  amountLabel?: string | null,
): void {
  const e = getEntry(db, id);
  if (!e) throw new Error(`Entry ${id} not found`);
  if (!e.grams) throw new Error('Entry has no gram amount; edit its nutrients instead');
  const f = grams / e.grams;
  const scaled = entryNutrients(e);
  const micros = e.microsJson
    ? JSON.stringify(
        Object.fromEntries(
          Object.entries(JSON.parse(e.microsJson) as Record<string, number>).map(([k, v]) => [
            k,
            v * f,
          ]),
        ),
      )
    : null;
  db.update(diaryEntries)
    .set({
      grams,
      microsJson: micros,
      amountLabel: amountLabel ?? null,
      ...nutrientFields({
        kcal: scaled.kcal * f,
        protein: scaled.protein * f,
        carbs: scaled.carbs * f,
        fat: scaled.fat * f,
        ...(scaled.fiber !== undefined && { fiber: scaled.fiber * f }),
        ...(scaled.sugar !== undefined && { sugar: scaled.sugar * f }),
        ...(scaled.saturatedFat !== undefined && { saturatedFat: scaled.saturatedFat * f }),
        ...(scaled.salt !== undefined && { salt: scaled.salt * f }),
      }),
    })
    .where(eq(diaryEntries.id, id))
    .run();
}

/** Overwrite name/nutrients directly (quick-calorie entries have no gram amount). */
export function updateEntryDetails(
  db: Db,
  id: string,
  patch: { name?: string; nutrients?: Nutrients },
): void {
  const set = {
    ...(patch.name !== undefined && { name: patch.name }),
    ...(patch.nutrients && nutrientFields(patch.nutrients)),
  };
  if (Object.keys(set).length === 0) return;
  db.update(diaryEntries).set(set).where(eq(diaryEntries.id, id)).run();
}

export function moveEntry(db: Db, id: string, mealTypeId: number, date?: string): void {
  db.update(diaryEntries)
    .set({ mealTypeId, ...(date && { date }) })
    .where(eq(diaryEntries.id, id))
    .run();
}

export function deleteEntry(db: Db, id: string): void {
  db.delete(diaryEntries).where(eq(diaryEntries.id, id)).run();
}

/** Copy a whole day, or one meal of it, to another day. Returns the number of copied entries. */
export function copyEntries(
  db: Db,
  params: { fromDate: string; toDate: string; mealTypeId?: number; toMealTypeId?: number },
): number {
  const source = listEntries(db, params.fromDate).filter(
    (e) => params.mealTypeId === undefined || e.mealTypeId === params.mealTypeId,
  );
  addEntries(
    db,
    source.map((e) => ({
      date: params.toDate,
      mealTypeId: params.toMealTypeId ?? e.mealTypeId,
      name: e.name,
      brand: e.brand,
      foodId: e.foodId,
      recipeId: e.recipeId,
      grams: e.grams,
      amountLabel: e.amountLabel,
      nutrients: entryNutrients(e),
      micros: e.microsJson ? (JSON.parse(e.microsJson) as Record<string, number>) : null,
      source: 'copy' as const,
    })),
  );
  return source.length;
}

const totalsSelection = {
  kcal: sql<number>`coalesce(sum(${diaryEntries.kcal}), 0)`,
  protein: sql<number>`coalesce(sum(${diaryEntries.protein}), 0)`,
  carbs: sql<number>`coalesce(sum(${diaryEntries.carbs}), 0)`,
  fat: sql<number>`coalesce(sum(${diaryEntries.fat}), 0)`,
  fiber: sql<number | null>`sum(${diaryEntries.fiber})`,
  sugar: sql<number | null>`sum(${diaryEntries.sugar})`,
  saturatedFat: sql<number | null>`sum(${diaryEntries.saturatedFat})`,
  salt: sql<number | null>`sum(${diaryEntries.salt})`,
};

const stripNulls = (r: Record<string, number | null>): Nutrients =>
  Object.fromEntries(Object.entries(r).filter(([, v]) => v !== null)) as unknown as Nutrients;

export function dayTotals(db: Db, date: string): Nutrients {
  const row = db
    .select(totalsSelection)
    .from(diaryEntries)
    .where(eq(diaryEntries.date, date))
    .get();
  return stripNulls(row ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 });
}

export interface DailyTotal extends Nutrients {
  date: string;
  entries: number;
}

/** Per-day totals for days that have at least one entry, inclusive range. */
export function dailyTotals(db: Db, from: string, to: string): DailyTotal[] {
  return db
    .select({ date: diaryEntries.date, entries: sql<number>`count(*)`, ...totalsSelection })
    .from(diaryEntries)
    .where(and(gte(diaryEntries.date, from), lte(diaryEntries.date, to)))
    .groupBy(diaryEntries.date)
    .orderBy(asc(diaryEntries.date))
    .all()
    .map(({ date, entries, ...n }) => ({ date, entries, ...stripNulls(n) }));
}

export interface RecentFood {
  foodId: string;
  name: string;
  brand: string | null;
  grams: number | null;
  amountLabel: string | null;
  kcal: number;
  lastEatenAt: string;
  timesEaten: number;
}

/** Most recently eaten foods with their last amount, for one-tap re-logging. */
export function recentFoods(db: Db, limit = 20): RecentFood[] {
  const latest = db
    .select({
      foodId: diaryEntries.foodId,
      lastEatenAt: sql<string>`max(${diaryEntries.createdAt})`.as('last_eaten_at'),
      timesEaten: sql<number>`count(*)`.as('times_eaten'),
    })
    .from(diaryEntries)
    .where(isNotNull(diaryEntries.foodId))
    .groupBy(diaryEntries.foodId)
    .as('latest');

  return db
    .select({
      foodId: latest.foodId,
      name: diaryEntries.name,
      brand: diaryEntries.brand,
      grams: diaryEntries.grams,
      amountLabel: diaryEntries.amountLabel,
      kcal: diaryEntries.kcal,
      lastEatenAt: latest.lastEatenAt,
      timesEaten: latest.timesEaten,
    })
    .from(latest)
    .innerJoin(
      diaryEntries,
      and(eq(diaryEntries.foodId, latest.foodId), eq(diaryEntries.createdAt, latest.lastEatenAt)),
    )
    .orderBy(desc(latest.lastEatenAt))
    .limit(limit)
    .all() as RecentFood[];
}

/** Summed micronutrients per day (only entries that carry micros), inclusive range. */
export function dailyMicros(db: Db, from: string, to: string): Map<string, Record<string, number>> {
  const rows = db
    .select({ date: diaryEntries.date, micros: diaryEntries.microsJson })
    .from(diaryEntries)
    .where(
      and(
        gte(diaryEntries.date, from),
        lte(diaryEntries.date, to),
        isNotNull(diaryEntries.microsJson),
      ),
    )
    .all();
  const out = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const day = out.get(r.date) ?? {};
    for (const [k, v] of Object.entries(JSON.parse(r.micros!) as Record<string, number>))
      day[k] = (day[k] ?? 0) + v;
    out.set(r.date, day);
  }
  return out;
}

/** All entries in a date range, for export. */
export function entriesBetween(db: Db, from: string, to: string): DiaryEntry[] {
  return db
    .select()
    .from(diaryEntries)
    .where(and(gte(diaryEntries.date, from), lte(diaryEntries.date, to)))
    .orderBy(asc(diaryEntries.date), asc(diaryEntries.createdAt))
    .all();
}
