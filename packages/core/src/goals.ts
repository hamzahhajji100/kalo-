import { estimateBmr, estimateTdee, KCAL_PER_KG, bmi, weightAtBmi, type BmrResult } from './energy';
import { checkProfileSafety, MIN_KCAL, type BlockReason } from './safety';
import type { Diet, Goal, Pace, Profile, TrainingExperience } from './types';

/** Target weekly weight loss as a fraction of body weight. */
export const LOSS_RATE_PER_WEEK: Record<Pace, number> = { slow: 0.0025, medium: 0.005, fast: 0.01 };
/** Deficit is kept within 10–25 % of TDEE regardless of the rate above. */
export const DEFICIT_BOUNDS = { min: 0.1, max: 0.25 } as const;
/** Surplus as a fraction of TDEE when building muscle. */
export const SURPLUS_BY_PACE: Record<Pace, number> = { slow: 0.05, medium: 0.1, fast: 0.15 };
/** Trained people gain muscle more slowly, so a large surplus mostly adds fat. */
export const SURPLUS_CAP_BY_EXPERIENCE: Record<TrainingExperience, number> = {
  beginner: 0.15,
  intermediate: 0.1,
  advanced: 0.075,
};

export interface MacroTargets {
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export interface Plan {
  bmr: BmrResult;
  tdee: number;
  kcal: number;
  macros: MacroTargets;
  waterMl: number;
  steps: number;
  /** Expected weekly weight change in kg (negative = loss). */
  weeklyChangeKg: number;
  /** True if the calorie target was raised to the safety floor. */
  clampedToMinimum: boolean;
}

export type PlanResult =
  { ok: true; plan: Plan } | { ok: false; block: BlockReason; minHealthyWeightKg: number };

const round = (v: number, step = 1) => Math.round(v / step) * step;

/** Calorie floor: never below the sex-specific minimum and never below BMR. */
export function calorieFloor(sex: Profile['sex'], bmrKcal: number): number {
  return Math.max(MIN_KCAL[sex], bmrKcal);
}

/** Daily calorie target before rounding, plus whether the floor kicked in. */
export function calorieTarget(
  profile: Pick<Profile, 'sex' | 'weightKg' | 'goal' | 'pace' | 'experience'>,
  tdee: number,
  bmrKcal: number,
): { kcal: number; clampedToMinimum: boolean } {
  let kcal: number;
  switch (profile.goal) {
    case 'lose': {
      const wanted = (profile.weightKg * LOSS_RATE_PER_WEEK[profile.pace] * KCAL_PER_KG) / 7;
      const deficit = Math.min(
        Math.max(wanted, tdee * DEFICIT_BOUNDS.min),
        tdee * DEFICIT_BOUNDS.max,
      );
      kcal = tdee - deficit;
      break;
    }
    case 'gain': {
      const cap = SURPLUS_CAP_BY_EXPERIENCE[profile.experience ?? 'intermediate'];
      kcal = tdee * (1 + Math.min(SURPLUS_BY_PACE[profile.pace], cap));
      break;
    }
    case 'maintain':
      kcal = tdee;
      break;
  }
  const floor = calorieFloor(profile.sex, bmrKcal);
  return kcal < floor ? { kcal: floor, clampedToMinimum: true } : { kcal, clampedToMinimum: false };
}

/**
 * Weight used for g/kg macro rules. For BMI > 30, using total weight overstates protein needs,
 * so we use the weight at BMI 27 (a common "adjusted body weight" approach).
 */
export function referenceWeightKg(weightKg: number, heightCm: number): number {
  return bmi(weightKg, heightCm) > 30 ? weightAtBmi(27, heightCm) : weightKg;
}

/** Protein in g per kg reference weight: higher when dieting and when training often. */
export function proteinPerKg(goal: Goal, trainingDaysPerWeek: number): number {
  const trains = trainingDaysPerWeek >= 3;
  switch (goal) {
    case 'lose':
      return trains ? 2.2 : 2.0;
    case 'gain':
      return trains ? 2.0 : 1.8;
    case 'maintain':
      return trains ? 1.8 : 1.6;
  }
}

const CARB_CAP_G: Partial<Record<Diet, number>> = { low_carb: 100, keto: 30 };
const MIN_FAT_PER_KG = 0.7;
const MIN_PROTEIN_PER_KG = 1.6;

/**
 * Split calories into macros: protein first (by goal), fat at least 0.7 g/kg and ~25 % of energy,
 * carbs fill the rest. Low-carb diets cap carbs and move the remainder to fat.
 */
export function macroSplit(
  kcal: number,
  profile: Pick<Profile, 'weightKg' | 'heightCm' | 'goal' | 'trainingDaysPerWeek' | 'diet'>,
): MacroTargets {
  const refKg = referenceWeightKg(profile.weightKg, profile.heightCm);
  let proteinG = refKg * proteinPerKg(profile.goal, profile.trainingDaysPerWeek);
  let fatG = Math.max(refKg * MIN_FAT_PER_KG, (kcal * 0.25) / 9);
  let carbsG = (kcal - proteinG * 4 - fatG * 9) / 4;

  // Very low budgets: fat is already at its floor here, so give back protein (down to 1.6 g/kg).
  if (carbsG < 0) {
    proteinG = Math.max(refKg * MIN_PROTEIN_PER_KG, proteinG + carbsG);
    carbsG = Math.max(0, (kcal - proteinG * 4 - fatG * 9) / 4);
  }

  const cap = profile.diet ? CARB_CAP_G[profile.diet] : undefined;
  if (cap !== undefined && carbsG > cap) {
    fatG += ((carbsG - cap) * 4) / 9;
    carbsG = cap;
  }
  return { proteinG: round(proteinG), fatG: round(fatG), carbsG: round(carbsG) };
}

/** ~35 ml per kg plus ~500 ml per training session, averaged over the week. Rounded to 100 ml. */
export function waterTargetMl(weightKg: number, trainingDaysPerWeek: number): number {
  return round(weightKg * 35 + (trainingDaysPerWeek / 7) * 500, 100);
}

export function stepTarget(activity: Profile['activity']): number {
  return activity === 'sedentary' ? 7000 : activity === 'light' ? 8000 : 10000;
}

/** Build the full daily plan, or return why no plan can be offered. */
export function buildPlan(profile: Profile): PlanResult {
  const safety = checkProfileSafety(profile);
  if (!safety.ok) return safety;
  const bmr = estimateBmr(profile);
  const tdee = estimateTdee(bmr.kcal, profile.activity);
  const { kcal: rawKcal, clampedToMinimum } = calorieTarget(profile, tdee, bmr.kcal);
  // Round to 10 kcal, but never round a floored target below the floor.
  const kcal = clampedToMinimum ? Math.ceil(rawKcal / 10) * 10 : round(rawKcal, 10);
  return {
    ok: true,
    plan: {
      bmr,
      tdee: round(tdee),
      kcal,
      macros: macroSplit(kcal, profile),
      waterMl: waterTargetMl(profile.weightKg, profile.trainingDaysPerWeek),
      steps: stepTarget(profile.activity),
      weeklyChangeKg: Math.round((((kcal - tdee) * 7) / KCAL_PER_KG) * 100) / 100,
      clampedToMinimum,
    },
  };
}
