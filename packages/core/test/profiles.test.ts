import { describe, expect, it } from 'vitest';

import { buildPlan, type Plan, type Profile } from '../src';

/**
 * Five reference profiles. Expected numbers are worked out by hand in docs/nutrition-formulas.md,
 * so a change here is a deliberate change to the formulas, not an accident.
 */
const profiles: Record<
  string,
  { profile: Profile; expected: Partial<Plan> & { macros: Plan['macros'] } }
> = {
  'Anna – moderat abnehmen': {
    profile: {
      sex: 'female',
      age: 28,
      heightCm: 165,
      weightKg: 68,
      activity: 'light',
      trainingDaysPerWeek: 2,
      goal: 'lose',
      targetWeightKg: 60,
      pace: 'medium',
    },
    expected: {
      tdee: 1939,
      kcal: 1570,
      waterMl: 2500,
      steps: 8000,
      weeklyChangeKg: -0.34,
      clampedToMinimum: false,
      macros: { proteinG: 136, fatG: 48, carbsG: 149 },
    },
  },
  'Markus – sauber aufbauen': {
    profile: {
      sex: 'male',
      age: 32,
      heightCm: 182,
      weightKg: 85,
      activity: 'moderate',
      trainingDaysPerWeek: 4,
      goal: 'gain',
      targetWeightKg: 90,
      pace: 'slow',
      experience: 'intermediate',
    },
    expected: {
      tdee: 2840,
      kcal: 2980,
      waterMl: 3300,
      steps: 10000,
      clampedToMinimum: false,
      macros: { proteinG: 170, fatG: 83, carbsG: 389 },
    },
  },
  'Sabine – Gewicht halten': {
    profile: {
      sex: 'female',
      age: 45,
      heightCm: 170,
      weightKg: 72,
      activity: 'sedentary',
      trainingDaysPerWeek: 0,
      goal: 'maintain',
      pace: 'medium',
    },
    expected: {
      tdee: 1676,
      kcal: 1680,
      waterMl: 2500,
      steps: 7000,
      weeklyChangeKg: 0,
      clampedToMinimum: false,
      macros: { proteinG: 115, fatG: 50, carbsG: 191 },
    },
  },
  'Jonas – schlank, Körperfett bekannt, aufbauen': {
    profile: {
      sex: 'male',
      age: 24,
      heightCm: 178,
      weightKg: 74,
      bodyFatPct: 12,
      activity: 'very_active',
      trainingDaysPerWeek: 5,
      goal: 'gain',
      pace: 'medium',
      experience: 'beginner',
    },
    expected: {
      tdee: 3338,
      kcal: 3670,
      clampedToMinimum: false,
      macros: { proteinG: 148, fatG: 102, carbsG: 540 },
    },
  },
  'Petra – starkes Übergewicht, schnell abnehmen (Sicherheitsgrenze)': {
    profile: {
      sex: 'female',
      age: 55,
      heightCm: 160,
      weightKg: 95,
      activity: 'sedentary',
      trainingDaysPerWeek: 0,
      goal: 'lose',
      targetWeightKg: 75,
      pace: 'fast',
    },
    expected: {
      tdee: 1817,
      kcal: 1520,
      clampedToMinimum: true,
      macros: { proteinG: 138, fatG: 48, carbsG: 133 },
    },
  },
};

describe.each(Object.entries(profiles))('%s', (_name, { profile, expected }) => {
  const result = buildPlan(profile);

  it('produces a plan', () => {
    expect(result.ok).toBe(true);
  });

  const plan = result.ok ? result.plan : (undefined as never);

  it('matches the hand-calculated targets', () => {
    expect(plan).toMatchObject(expected);
  });

  it('macros add up to the calorie target (±1.5 %)', () => {
    const { proteinG, carbsG, fatG } = plan.macros;
    const fromMacros = proteinG * 4 + carbsG * 4 + fatG * 9;
    expect(Math.abs(fromMacros - plan.kcal) / plan.kcal).toBeLessThan(0.015);
  });

  it('respects the safety floor', () => {
    expect(plan.kcal).toBeGreaterThanOrEqual(
      Math.max(profile.sex === 'male' ? 1500 : 1200, plan.bmr.kcal),
    );
  });

  it('keeps protein within 1.6–2.2 g/kg of reference weight', () => {
    const bmiNow = profile.weightKg / (profile.heightCm / 100) ** 2;
    const ref = bmiNow > 30 ? 27 * (profile.heightCm / 100) ** 2 : profile.weightKg;
    const perKg = plan.macros.proteinG / ref;
    expect(perKg).toBeGreaterThanOrEqual(1.59);
    expect(perKg).toBeLessThanOrEqual(2.21);
  });
});
