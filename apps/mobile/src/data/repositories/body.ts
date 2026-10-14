import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';

import type { Db } from '../db';
import { bodyMeasurements, waterLogs, weights } from '../schema';

export type Weight = typeof weights.$inferSelect;
export type BodyMeasurement = typeof bodyMeasurements.$inferSelect;

/** One weight per day; logging again on the same day replaces it. */
export function upsertWeight(db: Db, date: string, kg: number): void {
  db.insert(weights)
    .values({ date, kg })
    .onConflictDoUpdate({ target: weights.date, set: { kg } })
    .run();
}

export function deleteWeight(db: Db, date: string): void {
  db.delete(weights).where(eq(weights.date, date)).run();
}

export function listWeights(db: Db, from?: string, to?: string): Weight[] {
  const conditions = [from && gte(weights.date, from), to && lte(weights.date, to)].filter(Boolean);
  return db
    .select()
    .from(weights)
    .where(conditions.length ? and(...(conditions as never[])) : undefined)
    .orderBy(asc(weights.date))
    .all();
}

export function latestWeight(db: Db, onOrBefore?: string): Weight | undefined {
  return db
    .select()
    .from(weights)
    .where(onOrBefore ? lte(weights.date, onOrBefore) : undefined)
    .orderBy(desc(weights.date))
    .limit(1)
    .get();
}

export function upsertMeasurement(db: Db, m: BodyMeasurement): void {
  const { date, ...rest } = m;
  db.insert(bodyMeasurements)
    .values(m)
    .onConflictDoUpdate({ target: bodyMeasurements.date, set: rest })
    .run();
}

export function listMeasurements(db: Db): BodyMeasurement[] {
  return db.select().from(bodyMeasurements).orderBy(asc(bodyMeasurements.date)).all();
}

export function addWater(db: Db, date: string, ml: number): void {
  db.insert(waterLogs).values({ date, ml }).run();
}

export function waterTotal(db: Db, date: string): number {
  return (
    db
      .select({ ml: sql<number>`coalesce(sum(${waterLogs.ml}), 0)` })
      .from(waterLogs)
      .where(eq(waterLogs.date, date))
      .get()?.ml ?? 0
  );
}

/** Remove the most recent water log of a day (undo for the "+ glass" button). */
export function undoLastWater(db: Db, date: string): void {
  const last = db
    .select({ id: waterLogs.id })
    .from(waterLogs)
    .where(eq(waterLogs.date, date))
    .orderBy(desc(waterLogs.id))
    .limit(1)
    .get();
  if (last) db.delete(waterLogs).where(eq(waterLogs.id, last.id)).run();
}
