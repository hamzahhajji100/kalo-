import type { ActivityLevel, Profile, Sex } from './types';

/** Multipliers on BMR. The level is meant to include planned exercise. */
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** Mifflin-St Jeor (1990): the most accurate general-population BMR equation. */
export function bmrMifflinStJeor(
  sex: Sex,
  weightKg: number,
  heightCm: number,
  age: number,
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

/** Katch-McArdle: BMR from lean body mass; better for lean, trained people. */
export function bmrKatchMcArdle(weightKg: number, bodyFatPct: number): number {
  const leanMassKg = weightKg * (1 - bodyFatPct / 100);
  return 370 + 21.6 * leanMassKg;
}

export interface BmrResult {
  kcal: number;
  method: 'mifflin_st_jeor' | 'blend';
  mifflinStJeor: number;
  katchMcArdle?: number;
}

/**
 * BMR estimate. With a known body-fat percentage both equations are averaged:
 * each has its own bias, and the mean is more robust than either alone.
 */
export function estimateBmr(profile: Profile): BmrResult {
  const mifflin = bmrMifflinStJeor(profile.sex, profile.weightKg, profile.heightCm, profile.age);
  if (profile.bodyFatPct === undefined) {
    return { kcal: mifflin, method: 'mifflin_st_jeor', mifflinStJeor: mifflin };
  }
  const katch = bmrKatchMcArdle(profile.weightKg, profile.bodyFatPct);
  return {
    kcal: (mifflin + katch) / 2,
    method: 'blend',
    mifflinStJeor: mifflin,
    katchMcArdle: katch,
  };
}

export function estimateTdee(bmrKcal: number, activity: ActivityLevel): number {
  return bmrKcal * ACTIVITY_FACTORS[activity];
}

/** Approximate energy content of 1 kg body-weight change (mixed fat/lean tissue). */
export const KCAL_PER_KG = 7700;

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

/** Body weight at a given BMI for this height. */
export function weightAtBmi(targetBmi: number, heightCm: number): number {
  const m = heightCm / 100;
  return targetBmi * m * m;
}
