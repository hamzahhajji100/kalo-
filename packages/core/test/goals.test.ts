import { describe, expect, it } from 'vitest';

import {
  bmrKatchMcArdle,
  bmrMifflinStJeor,
  buildPlan,
  calorieTarget,
  checkProfileSafety,
  estimateBmr,
  macroSplit,
  proteinPerKg,
  referenceWeightKg,
  stepTarget,
  waterTargetMl,
  type Profile,
} from '../src';

const base: Profile = {
  sex: 'female',
  age: 30,
  heightCm: 170,
  weightKg: 70,
  activity: 'moderate',
  trainingDaysPerWeek: 3,
  goal: 'maintain',
  pace: 'medium',
};

describe('BMR equations', () => {
  it('Mifflin-St Jeor matches published examples', () => {
    expect(bmrMifflinStJeor('male', 80, 180, 30)).toBe(1780);
    expect(bmrMifflinStJeor('female', 60, 165, 25)).toBe(1345.25);
  });

  it('Katch-McArdle uses lean mass', () => {
    expect(bmrKatchMcArdle(80, 20)).toBeCloseTo(370 + 21.6 * 64);
  });

  it('blends both equations when body fat is known', () => {
    const r = estimateBmr({ ...base, bodyFatPct: 25 });
    expect(r.method).toBe('blend');
    expect(r.kcal).toBeCloseTo((r.mifflinStJeor + r.katchMcArdle!) / 2);
    expect(estimateBmr(base).method).toBe('mifflin_st_jeor');
  });
});

describe('safety', () => {
  it.each([
    [{ age: 16 }, 'minor'],
    [{ age: 0 }, 'invalid_input'],
    [{ heightCm: 90 }, 'invalid_input'],
    [{ weightKg: 500 }, 'invalid_input'],
    [{ trainingDaysPerWeek: 8 }, 'invalid_input'],
    [{ bodyFatPct: 1 }, 'invalid_input'],
    [{ targetWeightKg: 10 }, 'invalid_input'],
    [{ weightKg: Number.NaN }, 'invalid_input'],
    [{ goal: 'lose', weightKg: 50 }, 'underweight'],
    [{ goal: 'lose', targetWeightKg: 50 }, 'target_underweight'],
    [{ goal: 'lose', targetWeightKg: 75 }, 'target_direction'],
    [{ goal: 'gain', targetWeightKg: 65 }, 'target_direction'],
  ] as const)('%o → %s', (patch, block) => {
    const r = checkProfileSafety({ ...base, ...patch } as Profile);
    expect(r).toMatchObject({ ok: false, block });
    expect(buildPlan({ ...base, ...patch } as Profile).ok).toBe(false);
  });

  it('reports the minimum healthy weight', () => {
    expect(checkProfileSafety(base).minHealthyWeightKg).toBe(53.5);
  });

  it('accepts sensible lose and gain targets', () => {
    expect(checkProfileSafety({ ...base, goal: 'lose', targetWeightKg: 62 }).ok).toBe(true);
    expect(checkProfileSafety({ ...base, goal: 'gain', targetWeightKg: 75 }).ok).toBe(true);
    expect(checkProfileSafety({ ...base, goal: 'lose' }).ok).toBe(true);
  });
});

describe('calorie target', () => {
  it('keeps the deficit within 10–25 % of TDEE', () => {
    // 0.25 %/week of 50 kg ≈ 138 kcal, below the 10 % minimum of 3000 kcal.
    const slow = calorieTarget({ ...base, weightKg: 50, goal: 'lose', pace: 'slow' }, 3000, 1300);
    expect(slow.kcal).toBe(2700);
    const fast = calorieTarget({ ...base, weightKg: 120, goal: 'lose', pace: 'fast' }, 3000, 1300);
    expect(fast.kcal).toBe(2250);
  });

  it('caps the surplus for advanced lifters and defaults to intermediate', () => {
    expect(
      calorieTarget({ ...base, goal: 'gain', pace: 'fast', experience: 'advanced' }, 2000, 1400)
        .kcal,
    ).toBe(2150);
    expect(calorieTarget({ ...base, goal: 'gain', pace: 'fast' }, 2000, 1400).kcal).toBeCloseTo(
      2200,
    );
  });

  it('raises a target below the floor', () => {
    const r = calorieTarget({ ...base, sex: 'male', goal: 'lose', pace: 'fast' }, 1700, 1400);
    expect(r).toEqual({ kcal: 1500, clampedToMinimum: true });
  });
});

describe('macros', () => {
  it('uses adjusted weight for BMI > 30', () => {
    expect(referenceWeightKg(120, 170)).toBeCloseTo(27 * 1.7 ** 2);
    expect(referenceWeightKg(70, 170)).toBe(70);
  });

  it('protein depends on goal and training', () => {
    expect(proteinPerKg('lose', 0)).toBe(2.0);
    expect(proteinPerKg('lose', 4)).toBe(2.2);
    expect(proteinPerKg('gain', 0)).toBe(1.8);
    expect(proteinPerKg('gain', 3)).toBe(2.0);
    expect(proteinPerKg('maintain', 0)).toBe(1.6);
    expect(proteinPerKg('maintain', 5)).toBe(1.8);
  });

  it('gives back protein, not fat, when the budget is very small', () => {
    const m = macroSplit(1000, {
      weightKg: 100,
      heightCm: 190,
      goal: 'lose',
      trainingDaysPerWeek: 4,
    });
    expect(m).toEqual({ proteinG: 160, fatG: 70, carbsG: 0 });
  });

  it('caps carbs for low-carb and keto and moves energy to fat', () => {
    const p = { weightKg: 80, heightCm: 180, goal: 'maintain', trainingDaysPerWeek: 3 } as const;
    const normal = macroSplit(2500, p);
    const keto = macroSplit(2500, { ...p, diet: 'keto' });
    const lowCarb = macroSplit(2500, { ...p, diet: 'low_carb' });
    expect(keto.carbsG).toBe(30);
    expect(lowCarb.carbsG).toBe(100);
    expect(keto.fatG).toBeGreaterThan(normal.fatG);
    expect(macroSplit(2500, { ...p, diet: 'vegan' })).toEqual(normal);
    // Low-carb cap does not apply when carbs are already below it.
    expect(macroSplit(1300, { ...p, diet: 'low_carb' }).carbsG).toBeLessThan(100);
  });
});

describe('extras', () => {
  it('water and steps', () => {
    expect(waterTargetMl(70, 0)).toBe(2500);
    expect(waterTargetMl(70, 7)).toBe(3000);
    expect(stepTarget('sedentary')).toBe(7000);
    expect(stepTarget('light')).toBe(8000);
    expect(stepTarget('active')).toBe(10000);
  });
});
