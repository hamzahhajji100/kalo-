import {
  addDays,
  buildPlan,
  daysBetween,
  estimateBmr,
  forecastGoalDate,
  macroSplit,
  waterTargetMl,
  weeklyCheckIn,
  weightTrend,
  type CheckInResult,
  type IntakePoint,
  type Plan,
  type PlanResult,
  type WeightPoint,
} from '@kalo/core';

import type { DailyTotal } from '@/data/repositories/diary';
import type { Goal, NewGoal, StoredProfile } from '@/data/repositories/profile';
import { toCoreProfile } from '@/data/repositories/profile';

export const CHECK_IN_INTERVAL_DAYS = 7;

export function planFor(profile: StoredProfile, weightKg: number, today: string): PlanResult {
  return buildPlan(toCoreProfile(profile, weightKg, today));
}

export function goalFromPlan(plan: Plan, validFrom: string, reason: NewGoal['reason']): NewGoal {
  return {
    validFrom,
    kcal: plan.kcal,
    protein: plan.macros.proteinG,
    carbs: plan.macros.carbsG,
    fat: plan.macros.fatG,
    waterMl: plan.waterMl,
    steps: plan.steps,
    tdee: plan.tdee,
    reason,
  };
}

/**
 * Days count for the expenditure estimate only if they look completely logged: very low totals
 * usually mean a forgotten meal and would make the estimate too low.
 */
export function intakesForCoach(days: DailyTotal[], targetKcal: number): IntakePoint[] {
  return days
    .filter((d) => d.kcal >= targetKcal * 0.5)
    .map((d) => ({ date: d.date, kcal: d.kcal }));
}

/** A check-in is due a week after the current goal started and after the last check-in. */
export function isCheckInDue(params: {
  goal: Goal | undefined;
  lastCheckIn: string | undefined;
  today: string;
}): boolean {
  if (!params.goal) return false;
  const since = [params.goal.validFrom, params.lastCheckIn].filter(Boolean).sort().at(-1)!;
  return daysBetween(since, params.today) >= CHECK_IN_INTERVAL_DAYS;
}

export function runCheckIn(params: {
  profile: StoredProfile;
  goal: Goal;
  days: DailyTotal[];
  weights: WeightPoint[];
  today: string;
}): CheckInResult | null {
  const latest = params.weights.at(-1);
  if (!latest) return null;
  const core = toCoreProfile(params.profile, latest.kg, params.today);
  return weeklyCheckIn({
    profile: core,
    bmrKcal: estimateBmr(core).kcal,
    currentKcal: params.goal.kcal,
    priorTdee: params.goal.tdee,
    intakes: intakesForCoach(params.days, params.goal.kcal),
    weights: params.weights,
    today: params.today,
  });
}

/** New goal after an accepted check-in: macros are re-split for the new calories and current weight. */
export function goalFromCheckIn(params: {
  profile: StoredProfile;
  result: CheckInResult;
  weightKg: number;
  today: string;
}): NewGoal {
  const core = toCoreProfile(params.profile, params.weightKg, params.today);
  const macros = macroSplit(params.result.newKcal, core);
  return {
    validFrom: params.today,
    kcal: params.result.newKcal,
    protein: macros.proteinG,
    carbs: macros.carbsG,
    fat: macros.fatG,
    waterMl: waterTargetMl(params.weightKg, params.profile.trainingDaysPerWeek),
    steps: null,
    tdee: Math.round(params.result.estimate.tdee),
    reason: params.result.reason,
  };
}

/**
 * Goal-date forecast. Uses the measured trend once there are two weeks of weigh-ins,
 * otherwise the planned rate.
 */
export function forecast(params: {
  weights: WeightPoint[];
  targetKg: number | null;
  plannedWeeklyKg: number;
  today: string;
}) {
  if (params.targetKg === null || params.weights.length === 0) return null;
  const trend = weightTrend(params.weights);
  const last = trend.at(-1)!;
  const twoWeeksAgo = addDays(params.today, -14);
  const ref = trend.filter((t) => t.date <= twoWeeksAgo).at(-1);
  const measured = ref
    ? ((last.trendKg - ref.trendKg) / daysBetween(ref.date, last.date)) * 7
    : undefined;
  const weeklyKg =
    measured !== undefined && Number.isFinite(measured) ? measured : params.plannedWeeklyKg;
  return {
    currentKg: last.trendKg,
    weeklyKg,
    basedOn: measured !== undefined ? ('trend' as const) : ('plan' as const),
    date: forecastGoalDate({
      currentKg: last.trendKg,
      targetKg: params.targetKg,
      weeklyChangeKg: weeklyKg,
      today: params.today,
    }),
  };
}
