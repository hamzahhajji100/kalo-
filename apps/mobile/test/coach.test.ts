import { addDays } from '@kalo/core';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Db } from '@/data/db';
import { latestWeight, upsertWeight } from '@/data/repositories/body';
import { lastCheckIn } from '@/data/repositories/checkIns';
import { addEntry, dailyTotals } from '@/data/repositories/diary';
import { ensureDefaultMealTypes, listMealTypes } from '@/data/repositories/mealTypes';
import { getProfile, goalOn, listGoals, type StoredProfile } from '@/data/repositories/profile';
import { forecast, intakesForCoach, isCheckInDue, runCheckIn } from '@/features/coach/logic';
import {
  birthDateFromAge,
  draftFromProfile,
  emptyDraft,
  profileFromDraft,
} from '@/features/coach/onboardingDraft';
import { completeOnboarding, decideCheckIn, updateProfileAndGoal } from '@/features/coach/service';
import { createTestDb } from './testDb';

const TODAY = '2026-10-14';
const anna: StoredProfile = {
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
  diet: 'omnivore',
  allergies: [],
};

let db: Db;
beforeEach(() => {
  db = createTestDb();
  ensureDefaultMealTypes(db);
});

describe('onboarding', () => {
  it('stores profile, weight and the first goal', () => {
    expect(completeOnboarding(db, { profile: anna, weightKg: 68, today: TODAY })).toBe(true);
    expect(getProfile(db)).toEqual(anna);
    expect(latestWeight(db)).toEqual({ date: TODAY, kg: 68 });
    expect(goalOn(db, TODAY)).toMatchObject({
      kcal: 1570,
      protein: 136,
      carbs: 149,
      fat: 48,
      tdee: 1939,
      reason: 'onboarding',
    });
  });

  it('stores no goal for blocked profiles', () => {
    expect(
      completeOnboarding(db, {
        profile: { ...anna, birthDate: '2012-01-01' },
        weightKg: 50,
        today: TODAY,
      }),
    ).toBe(false);
    expect(getProfile(db)).toBeDefined();
    expect(listGoals(db)).toEqual([]);
  });

  it('recalculates when the profile changes', () => {
    completeOnboarding(db, { profile: anna, weightKg: 68, today: TODAY });
    expect(
      updateProfileAndGoal(db, {
        profile: { ...anna, goal: 'maintain' },
        today: addDays(TODAY, 1),
      }),
    ).toBe(true);
    expect(goalOn(db, addDays(TODAY, 1))).toMatchObject({ kcal: 1940, reason: 'profile_changed' });
    expect(updateProfileAndGoal(createTestDb(), { profile: anna, today: TODAY })).toBe(false);
  });
});

describe('check-ins', () => {
  it('is due one week after the goal or the last check-in', () => {
    const goal = { validFrom: '2026-10-01' } as Parameters<typeof isCheckInDue>[0]['goal'];
    expect(isCheckInDue({ goal: undefined, lastCheckIn: undefined, today: TODAY })).toBe(false);
    expect(isCheckInDue({ goal, lastCheckIn: undefined, today: '2026-10-07' })).toBe(false);
    expect(isCheckInDue({ goal, lastCheckIn: undefined, today: '2026-10-08' })).toBe(true);
    expect(isCheckInDue({ goal, lastCheckIn: '2026-10-10', today: TODAY })).toBe(false);
  });

  it('ignores incompletely logged days', () => {
    expect(
      intakesForCoach(
        [
          { date: 'a', entries: 1, kcal: 300, protein: 0, carbs: 0, fat: 0 },
          { date: 'b', entries: 3, kcal: 1500, protein: 0, carbs: 0, fat: 0 },
        ],
        1570,
      ),
    ).toEqual([{ date: 'b', kcal: 1500 }]);
  });

  it('lowers the target when weight stalls and records the decision', () => {
    const start = addDays(TODAY, -35);
    completeOnboarding(db, { profile: anna, weightKg: 68, today: start });
    const meal = listMealTypes(db)[0]!.id;
    for (let i = 0; i <= 35; i++) {
      const date = addDays(start, i);
      upsertWeight(db, date, 68);
      addEntry(db, {
        date,
        mealTypeId: meal,
        name: 'Tag',
        nutrients: { kcal: 1570, protein: 136, carbs: 149, fat: 48 },
        source: 'quick',
      });
    }
    const goal = goalOn(db, TODAY)!;
    const result = runCheckIn({
      profile: anna,
      goal,
      days: dailyTotals(db, addDays(TODAY, -28), TODAY),
      weights: [...Array(36).keys()].map((i) => ({ date: addDays(start, i), kg: 68 })),
      today: TODAY,
    })!;
    expect(result).toMatchObject({ reason: 'slower_than_planned', change: -150, newKcal: 1420 });

    decideCheckIn(db, { profile: anna, result, accept: true, today: TODAY });
    expect(goalOn(db, TODAY)).toMatchObject({ kcal: 1420, reason: 'slower_than_planned' });
    expect(lastCheckIn(db)).toMatchObject({ date: TODAY, accepted: true });

    // Declining later the same day keeps the goal history but records the decision.
    decideCheckIn(db, { profile: anna, result, accept: false, today: TODAY });
    expect(lastCheckIn(db)?.accepted).toBe(false);
  });

  it('needs a weight to run', () => {
    expect(
      runCheckIn({ profile: anna, goal: {} as never, days: [], weights: [], today: TODAY }),
    ).toBeNull();
  });
});

describe('forecast', () => {
  it('uses the plan until two weeks of trend exist, then the trend', () => {
    const one = [{ date: TODAY, kg: 68 }];
    expect(
      forecast({ weights: one, targetKg: 60, plannedWeeklyKg: -0.5, today: TODAY }),
    ).toMatchObject({ basedOn: 'plan', date: addDays(TODAY, 112) });
    const weights = [...Array(29).keys()].map((i) => ({
      date: addDays(TODAY, i - 28),
      kg: 70 - (i / 7) * 0.25,
    }));
    const f = forecast({ weights, targetKg: 60, plannedWeeklyKg: -0.5, today: TODAY })!;
    expect(f.basedOn).toBe('trend');
    expect(f.weeklyKg).toBeCloseTo(-0.25, 1);
    expect(forecast({ weights: [], targetKg: 60, plannedWeeklyKg: -0.5, today: TODAY })).toBeNull();
    expect(
      forecast({ weights: one, targetKg: null, plannedWeeklyKg: -0.5, today: TODAY }),
    ).toBeNull();
  });
});

describe('onboarding draft', () => {
  const full = {
    ...emptyDraft(),
    goal: 'lose' as const,
    sex: 'female' as const,
    age: '28',
    heightCm: '165',
    weightKg: '68,0',
    activity: 'light' as const,
    targetWeightKg: '60',
  };

  it('builds a profile from answers', () => {
    expect(profileFromDraft(full, TODAY)).toEqual({
      ok: true,
      weightKg: 68,
      profile: { ...anna, birthDate: '1998-10-14' },
    });
    expect(birthDateFromAge(30, '2026-02-28')).toBe('1996-02-28');
  });

  it('lists missing or invalid answers', () => {
    expect(profileFromDraft(emptyDraft(), TODAY)).toEqual({
      ok: false,
      missing: ['goal', 'sex', 'age', 'heightCm', 'weightKg', 'activity'],
    });
    expect(profileFromDraft({ ...full, bodyFatPct: '95', targetWeightKg: 'x' }, TODAY)).toEqual({
      ok: false,
      missing: ['bodyFatPct', 'targetWeightKg'],
    });
  });

  it('drops target weight for maintenance and keeps experience only for gain', () => {
    const m = profileFromDraft({ ...full, goal: 'maintain' }, TODAY);
    expect(m.ok && m.profile.targetWeightKg).toBeNull();
    const g = profileFromDraft(
      { ...full, goal: 'gain', targetWeightKg: '75', experience: 'advanced', bodyFatPct: '22' },
      TODAY,
    );
    expect(g.ok && g.profile).toMatchObject({
      experience: 'advanced',
      bodyFatPct: 22,
      targetWeightKg: 75,
    });
  });

  it('prefills from a stored profile', () => {
    expect(draftFromProfile({ ...anna, bodyFatPct: 24.5 }, 67.5, 28)).toMatchObject({
      goal: 'lose',
      age: '28',
      weightKg: '67,5',
      bodyFatPct: '24,5',
      targetWeightKg: '60',
      experience: 'beginner',
    });
  });
});
