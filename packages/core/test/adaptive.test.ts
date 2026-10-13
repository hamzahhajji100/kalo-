import { describe, expect, it } from 'vitest';

import {
  addDays,
  buildPlan,
  estimateExpenditure,
  forecastGoalDate,
  weeklyCheckIn,
  weightTrend,
  type IntakePoint,
  type Profile,
  type WeightPoint,
} from '../src';

const TODAY = '2026-06-30';

/** Daily weigh-ins over `days` days ending today, changing linearly by `perWeekKg`. */
function linearWeights(startKg: number, perWeekKg: number, days = 60): WeightPoint[] {
  return Array.from({ length: days + 1 }, (_, i) => ({
    date: addDays(TODAY, i - days),
    kg: startKg + (perWeekKg / 7) * i,
  }));
}

function intakes(kcal: number, days = 21): IntakePoint[] {
  return Array.from({ length: days }, (_, i) => ({ date: addDays(TODAY, -i), kcal }));
}

describe('weightTrend', () => {
  it('smooths noise and starts at the first weigh-in', () => {
    const t = weightTrend([
      { date: '2026-01-02', kg: 81 },
      { date: '2026-01-01', kg: 80 },
    ]);
    expect(t[0]).toEqual({ date: '2026-01-01', kg: 80, trendKg: 80 });
    expect(t[1]!.trendKg).toBeCloseTo(80.1);
  });

  it('compounds the smoothing over gaps', () => {
    const t = weightTrend([
      { date: '2026-01-01', kg: 80 },
      { date: '2026-01-11', kg: 70 },
    ]);
    expect(t[1]!.trendKg).toBeCloseTo(80 - 10 * (1 - 0.9 ** 10));
  });

  it('handles duplicate dates as a one-day step', () => {
    const t = weightTrend([
      { date: '2026-01-01', kg: 80 },
      { date: '2026-01-01', kg: 82 },
    ]);
    expect(t[1]!.trendKg).toBeCloseTo(80.2);
  });
});

describe('estimateExpenditure', () => {
  it('falls back to the prior without enough data', () => {
    const r = estimateExpenditure({
      intakes: intakes(2000, 3),
      weights: linearWeights(80, 0),
      priorTdee: 2300,
      endDate: TODAY,
    });
    expect(r).toMatchObject({ tdee: 2300, confidence: 0, loggedDays: 3 });
    const noWeights = estimateExpenditure({
      intakes: intakes(2000),
      weights: [],
      priorTdee: 2300,
      endDate: TODAY,
    });
    expect(noWeights.confidence).toBe(0);
  });

  it('recovers true expenditure from intake and trend', () => {
    // Eating 2000 kcal while losing 0.5 kg/week ⇒ TDEE ≈ 2000 + 0.5 × 7700 / 7 = 2550.
    const r = estimateExpenditure({
      intakes: intakes(2000),
      weights: linearWeights(80, -0.5),
      priorTdee: 2300,
      endDate: TODAY,
    });
    expect(r.observedTdee).toBeGreaterThan(2500);
    expect(r.observedTdee).toBeLessThan(2600);
    expect(r.confidence).toBe(0.8);
    expect(r.tdee).toBeCloseTo(2300 + 0.8 * (r.observedTdee! - 2300));
    expect(r.weeklyTrendChangeKg).toBeCloseTo(-0.5, 1);
  });

  it('trusts sparse data less', () => {
    const sparse = linearWeights(80, -0.5).filter((_, i) => i % 4 === 0);
    const r = estimateExpenditure({
      intakes: intakes(2000, 10),
      weights: sparse,
      priorTdee: 2300,
      endDate: TODAY,
    });
    expect(r.confidence).toBeGreaterThan(0);
    expect(r.confidence).toBeLessThan(0.4);
  });
});

describe('weeklyCheckIn', () => {
  const anna: Profile = {
    sex: 'female',
    age: 28,
    heightCm: 165,
    weightKg: 68,
    activity: 'light',
    trainingDaysPerWeek: 2,
    goal: 'lose',
    targetWeightKg: 60,
    pace: 'medium',
  };
  const plan = buildPlan(anna);
  if (!plan.ok) throw new Error('fixture must produce a plan');
  const common = {
    profile: anna,
    bmrKcal: plan.plan.bmr.kcal,
    currentKcal: 1570,
    priorTdee: plan.plan.tdee,
    today: TODAY,
  };

  it('does nothing without data', () => {
    const r = weeklyCheckIn({ ...common, intakes: [], weights: [] });
    expect(r).toMatchObject({ newKcal: 1570, change: 0, reason: 'insufficient_data' });
  });

  it('lowers the target by at most 150 kcal when weight stalls', () => {
    const r = weeklyCheckIn({ ...common, intakes: intakes(1570), weights: linearWeights(68, 0) });
    expect(r.reason).toBe('slower_than_planned');
    expect(r.change).toBe(-150);
    expect(r.newKcal).toBe(1420);
  });

  it('raises the target when losing faster than planned', () => {
    const r = weeklyCheckIn({ ...common, intakes: intakes(1570), weights: linearWeights(70, -1) });
    expect(r.reason).toBe('faster_than_planned');
    expect(r.change).toBe(150);
  });

  it('keeps the target when progress matches the plan', () => {
    const r = weeklyCheckIn({
      ...common,
      intakes: intakes(1570),
      weights: linearWeights(70, -0.3355),
    });
    expect(r.reason).toBe('on_track');
    expect(r.change).toBe(0);
  });

  it('reports a changed expenditure when the rate is right but intake differed', () => {
    const r = weeklyCheckIn({
      ...common,
      intakes: intakes(1800),
      weights: linearWeights(70, -0.3355),
    });
    expect(r.reason).toBe('expenditure_updated');
    expect(r.change).toBeGreaterThan(0);
  });

  it('treats a stalled bulk as slower than planned', () => {
    const markus: Profile = {
      sex: 'male',
      age: 32,
      heightCm: 182,
      weightKg: 85,
      activity: 'moderate',
      trainingDaysPerWeek: 4,
      goal: 'gain',
      pace: 'slow',
      experience: 'intermediate',
    };
    const r = weeklyCheckIn({
      profile: markus,
      bmrKcal: 1832.5,
      currentKcal: 2980,
      priorTdee: 2840,
      today: TODAY,
      intakes: intakes(2980),
      weights: linearWeights(85, 0),
    });
    // Observed 2980 → blended 2952 → ideal 2952 × 1.05 ≈ 3100 ⇒ +120.
    expect(r.reason).toBe('slower_than_planned');
    expect(r.change).toBe(120);
  });

  it('flags a bulk that gains faster than planned', () => {
    const markus: Profile = {
      sex: 'male',
      age: 32,
      heightCm: 182,
      weightKg: 85,
      activity: 'moderate',
      trainingDaysPerWeek: 4,
      goal: 'gain',
      pace: 'slow',
      experience: 'intermediate',
    };
    const r = weeklyCheckIn({
      profile: markus,
      bmrKcal: 1832.5,
      currentKcal: 2980,
      priorTdee: 2840,
      today: TODAY,
      intakes: intakes(2980),
      weights: linearWeights(84, 0.8),
    });
    expect(r.reason).toBe('faster_than_planned');
    expect(r.change).toBe(-150);
  });
});

describe('forecastGoalDate', () => {
  it('projects the date at the current rate', () => {
    expect(
      forecastGoalDate({ currentKg: 68, targetKg: 60, weeklyChangeKg: -0.5, today: TODAY }),
    ).toBe(addDays(TODAY, 112));
  });

  it('returns today when already at target and undefined when moving away', () => {
    expect(
      forecastGoalDate({ currentKg: 60, targetKg: 60, weeklyChangeKg: -0.5, today: TODAY }),
    ).toBe(TODAY);
    expect(
      forecastGoalDate({ currentKg: 68, targetKg: 60, weeklyChangeKg: 0.2, today: TODAY }),
    ).toBeUndefined();
    expect(
      forecastGoalDate({ currentKg: 68, targetKg: 60, weeklyChangeKg: 0, today: TODAY }),
    ).toBeUndefined();
  });
});
