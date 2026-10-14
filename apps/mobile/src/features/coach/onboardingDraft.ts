import type { ActivityLevel, Diet, Goal, Pace, Sex, TrainingExperience } from '@kalo/core';

import type { StoredProfile } from '@/data/repositories/profile';
import { parseDecimal } from '@/lib/number';

/** Raw onboarding answers; numbers stay strings while typing. */
export interface OnboardingDraft {
  goal: Goal | null;
  sex: Sex | null;
  age: string;
  heightCm: string;
  weightKg: string;
  bodyFatPct: string;
  activity: ActivityLevel | null;
  trainingDays: number;
  experience: TrainingExperience;
  targetWeightKg: string;
  pace: Pace;
  diet: Diet;
  allergies: string[];
}

export const emptyDraft = (): OnboardingDraft => ({
  goal: null,
  sex: null,
  age: '',
  heightCm: '',
  weightKg: '',
  bodyFatPct: '',
  activity: null,
  trainingDays: 2,
  experience: 'beginner',
  targetWeightKg: '',
  pace: 'medium',
  diet: 'omnivore',
  allergies: [],
});

/** Birth date from an age: the same calendar day `age` years ago keeps the age correct over time. */
export function birthDateFromAge(age: number, today: string): string {
  const [y, m, d] = today.split('-');
  return `${Number(y) - age}-${m}-${d}`;
}

export function draftFromProfile(p: StoredProfile, weightKg: number, age: number): OnboardingDraft {
  const s = (v: number | null) => (v === null ? '' : String(v).replace('.', ','));
  return {
    goal: p.goal,
    sex: p.sex,
    age: String(age),
    heightCm: s(p.heightCm),
    weightKg: s(weightKg),
    bodyFatPct: s(p.bodyFatPct),
    activity: p.activity,
    trainingDays: p.trainingDaysPerWeek,
    experience: p.experience ?? 'beginner',
    targetWeightKg: s(p.targetWeightKg),
    pace: p.pace,
    diet: p.diet,
    allergies: p.allergies,
  };
}

export type DraftResult =
  | { ok: true; profile: StoredProfile; weightKg: number }
  | { ok: false; missing: (keyof OnboardingDraft)[] };

/** Convert answers into a profile; reports which answers are still missing or invalid. */
export function profileFromDraft(d: OnboardingDraft, today: string): DraftResult {
  const missing: (keyof OnboardingDraft)[] = [];
  const age = parseDecimal(d.age);
  const height = parseDecimal(d.heightCm);
  const weight = parseDecimal(d.weightKg);
  const bf = parseDecimal(d.bodyFatPct);
  const target = parseDecimal(d.targetWeightKg);
  if (!d.goal) missing.push('goal');
  if (!d.sex) missing.push('sex');
  if (age === undefined || age < 10 || age > 110) missing.push('age');
  if (height === undefined || height < 100 || height > 250) missing.push('heightCm');
  if (weight === undefined || weight < 30 || weight > 350) missing.push('weightKg');
  if (d.bodyFatPct.trim() && (bf === undefined || bf < 3 || bf > 70)) missing.push('bodyFatPct');
  if (!d.activity) missing.push('activity');
  if (
    d.goal &&
    d.goal !== 'maintain' &&
    d.targetWeightKg.trim() &&
    (target === undefined || target < 30 || target > 350)
  )
    missing.push('targetWeightKg');
  if (missing.length > 0) return { ok: false, missing };
  return {
    ok: true,
    weightKg: weight!,
    profile: {
      sex: d.sex!,
      birthDate: birthDateFromAge(Math.round(age!), today),
      heightCm: height!,
      bodyFatPct: bf ?? null,
      activity: d.activity!,
      trainingDaysPerWeek: d.trainingDays,
      experience: d.goal === 'gain' ? d.experience : null,
      goal: d.goal!,
      targetWeightKg: d.goal !== 'maintain' && target !== undefined ? target : null,
      pace: d.pace,
      diet: d.diet,
      allergies: d.allergies,
    },
  };
}
