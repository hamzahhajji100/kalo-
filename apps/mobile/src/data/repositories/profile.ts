import { ageOn, type Profile as CoreProfile } from '@kalo/core';
import { desc, eq, lte } from 'drizzle-orm';

import type { Db } from '../db';
import { goalsHistory, profile } from '../schema';

export type StoredProfile = Omit<
  typeof profile.$inferSelect,
  'id' | 'updatedAt' | 'allergiesJson'
> & {
  allergies: string[];
};
export type Goal = typeof goalsHistory.$inferSelect;
export type NewGoal = Omit<typeof goalsHistory.$inferInsert, 'id' | 'createdAt'>;

export function getProfile(db: Db): StoredProfile | undefined {
  const row = db.select().from(profile).where(eq(profile.id, 1)).get();
  if (!row) return undefined;
  const { id: _id, updatedAt: _u, allergiesJson, ...rest } = row;
  return { ...rest, allergies: JSON.parse(allergiesJson) as string[] };
}

export function saveProfile(db: Db, p: StoredProfile): void {
  const { allergies, ...rest } = p;
  const values = {
    ...rest,
    allergiesJson: JSON.stringify(allergies),
    updatedAt: new Date().toISOString(),
  };
  db.insert(profile)
    .values({ id: 1, ...values })
    .onConflictDoUpdate({ target: profile.id, set: values })
    .run();
}

/** Combine the stored profile with a weight and date into the input the coach expects. */
export function toCoreProfile(p: StoredProfile, weightKg: number, today: string): CoreProfile {
  return {
    sex: p.sex,
    age: ageOn(p.birthDate, today),
    heightCm: p.heightCm,
    weightKg,
    ...(p.bodyFatPct !== null && { bodyFatPct: p.bodyFatPct }),
    activity: p.activity,
    trainingDaysPerWeek: p.trainingDaysPerWeek,
    goal: p.goal,
    ...(p.targetWeightKg !== null && { targetWeightKg: p.targetWeightKg }),
    pace: p.pace,
    ...(p.experience !== null && { experience: p.experience }),
    diet: p.diet,
  };
}

export function addGoal(db: Db, g: NewGoal): void {
  db.insert(goalsHistory).values(g).run();
}

/** Goal in effect on a date: the latest one whose validFrom is on or before it. */
export function goalOn(db: Db, date: string): Goal | undefined {
  return db
    .select()
    .from(goalsHistory)
    .where(lte(goalsHistory.validFrom, date))
    .orderBy(desc(goalsHistory.validFrom), desc(goalsHistory.id))
    .limit(1)
    .get();
}

export function listGoals(db: Db): Goal[] {
  return db
    .select()
    .from(goalsHistory)
    .orderBy(desc(goalsHistory.validFrom), desc(goalsHistory.id))
    .all();
}
