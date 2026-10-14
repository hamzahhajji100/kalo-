import { beforeEach, describe, expect, it } from 'vitest';

import type { Db } from '@/data/db';
import {
  addWater,
  deleteWeight,
  latestWeight,
  listMeasurements,
  listWeights,
  undoLastWater,
  upsertMeasurement,
  upsertWeight,
  waterTotal,
} from '@/data/repositories/body';
import {
  addGoal,
  getProfile,
  goalOn,
  listGoals,
  saveProfile,
  toCoreProfile,
  type StoredProfile,
} from '@/data/repositories/profile';
import { createTestDb } from './testDb';

let db: Db;
beforeEach(() => {
  db = createTestDb();
});

describe('weights & water', () => {
  it('keeps one weight per day', () => {
    upsertWeight(db, '2026-10-01', 70.4);
    upsertWeight(db, '2026-10-01', 70.1);
    upsertWeight(db, '2026-10-03', 69.8);
    expect(listWeights(db)).toEqual([
      { date: '2026-10-01', kg: 70.1 },
      { date: '2026-10-03', kg: 69.8 },
    ]);
    expect(listWeights(db, '2026-10-02')).toHaveLength(1);
    expect(listWeights(db, undefined, '2026-10-02')).toHaveLength(1);
    expect(latestWeight(db)?.kg).toBe(69.8);
    expect(latestWeight(db, '2026-10-02')?.kg).toBe(70.1);
    deleteWeight(db, '2026-10-03');
    expect(latestWeight(db)?.date).toBe('2026-10-01');
  });

  it('sums water and undoes the last glass', () => {
    addWater(db, '2026-10-01', 250);
    addWater(db, '2026-10-01', 500);
    expect(waterTotal(db, '2026-10-01')).toBe(750);
    undoLastWater(db, '2026-10-01');
    expect(waterTotal(db, '2026-10-01')).toBe(250);
    undoLastWater(db, '2026-10-02');
    expect(waterTotal(db, '2026-10-02')).toBe(0);
  });

  it('stores body measurements', () => {
    upsertMeasurement(db, {
      date: '2026-10-01',
      waistCm: 80,
      hipCm: null,
      chestCm: null,
      armCm: null,
      thighCm: null,
    });
    upsertMeasurement(db, {
      date: '2026-10-01',
      waistCm: 79,
      hipCm: 95,
      chestCm: null,
      armCm: null,
      thighCm: null,
    });
    expect(listMeasurements(db)).toMatchObject([{ waistCm: 79, hipCm: 95 }]);
  });
});

describe('profile & goals', () => {
  const p: StoredProfile = {
    sex: 'female',
    birthDate: '1998-03-10',
    heightCm: 165,
    bodyFatPct: null,
    activity: 'light',
    trainingDaysPerWeek: 2,
    experience: null,
    goal: 'lose',
    targetWeightKg: 60,
    pace: 'medium',
    diet: 'vegetarian',
    allergies: ['nuts'],
  };

  it('round-trips the profile and maps it for the coach', () => {
    expect(getProfile(db)).toBeUndefined();
    saveProfile(db, p);
    saveProfile(db, { ...p, pace: 'slow' });
    expect(getProfile(db)).toEqual({ ...p, pace: 'slow' });
    expect(toCoreProfile(p, 68, '2026-10-14')).toEqual({
      sex: 'female',
      age: 28,
      heightCm: 165,
      weightKg: 68,
      activity: 'light',
      trainingDaysPerWeek: 2,
      goal: 'lose',
      targetWeightKg: 60,
      pace: 'medium',
      diet: 'vegetarian',
    });
    expect(
      toCoreProfile(
        { ...p, bodyFatPct: 25, experience: 'beginner', targetWeightKg: null },
        68,
        '2026-10-14',
      ),
    ).toMatchObject({
      bodyFatPct: 25,
      experience: 'beginner',
    });
  });

  it('resolves the goal valid on a date', () => {
    const g = {
      kcal: 1570,
      protein: 136,
      carbs: 149,
      fat: 48,
      waterMl: 2500,
      steps: 8000,
      tdee: 1939,
    };
    addGoal(db, { ...g, validFrom: '2026-10-01', reason: 'onboarding' });
    addGoal(db, { ...g, kcal: 1420, validFrom: '2026-10-08', reason: 'slower_than_planned' });
    expect(goalOn(db, '2026-09-30')).toBeUndefined();
    expect(goalOn(db, '2026-10-05')?.kcal).toBe(1570);
    expect(goalOn(db, '2026-10-08')?.kcal).toBe(1420);
    expect(listGoals(db).map((x) => x.kcal)).toEqual([1420, 1570]);
  });
});
