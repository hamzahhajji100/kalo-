import type { CheckInResult } from '@kalo/core';

import type { Db } from '@/data/db';
import { latestWeight, upsertWeight } from '@/data/repositories/body';
import { saveCheckIn } from '@/data/repositories/checkIns';
import { addGoal, saveProfile, type StoredProfile } from '@/data/repositories/profile';
import { goalFromCheckIn, goalFromPlan, planFor } from './logic';

/** Persist the onboarding answers: profile, today's weight and the first goal. Returns false if no plan is allowed. */
export function completeOnboarding(
  db: Db,
  params: {
    profile: StoredProfile;
    weightKg: number;
    today: string;
    reason?: 'onboarding' | 'profile_changed';
  },
): boolean {
  const result = planFor(params.profile, params.weightKg, params.today);
  db.transaction(() => {
    saveProfile(db, params.profile);
    upsertWeight(db, params.today, params.weightKg);
    if (result.ok)
      addGoal(db, goalFromPlan(result.plan, params.today, params.reason ?? 'onboarding'));
  });
  return result.ok;
}

/** Recalculate the goal after the user changed their profile (goal, pace, activity …). */
export function updateProfileAndGoal(
  db: Db,
  params: { profile: StoredProfile; today: string },
): boolean {
  const weight = latestWeight(db)?.kg;
  if (weight === undefined) return false;
  const result = planFor(params.profile, weight, params.today);
  db.transaction(() => {
    saveProfile(db, params.profile);
    if (result.ok) addGoal(db, goalFromPlan(result.plan, params.today, 'profile_changed'));
  });
  return result.ok;
}

export function decideCheckIn(
  db: Db,
  params: { profile: StoredProfile; result: CheckInResult; accept: boolean; today: string },
): void {
  db.transaction(() => {
    saveCheckIn(db, params.today, params.result, params.accept);
    const weight = latestWeight(db)?.kg;
    if (params.accept && params.result.change !== 0 && weight !== undefined) {
      addGoal(
        db,
        goalFromCheckIn({
          profile: params.profile,
          result: params.result,
          weightKg: weight,
          today: params.today,
        }),
      );
    }
  });
}
