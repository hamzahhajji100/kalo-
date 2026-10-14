import { addDays } from '@kalo/core';
import { describe, expect, it } from 'vitest';

import type { DailyTotal, DiaryEntry } from '@/data/repositories/diary';
import { linear, nearestIndex, niceScale } from '@/features/progress/chartMath';
import { diaryCsv, toCsv, weightsCsv } from '@/features/progress/csv';
import { computeStats, generateInsights } from '@/features/progress/stats';

const TODAY = '2026-10-14';
const target = { kcal: 2000, protein: 140, waterMl: 2500 };
const day = (
  offset: number,
  kcal: number,
  protein: number,
  extra: Partial<DailyTotal> = {},
): DailyTotal => ({
  date: addDays(TODAY, offset),
  entries: kcal > 0 ? 3 : 0,
  kcal,
  protein,
  carbs: 200,
  fat: 70,
  ...extra,
});

describe('computeStats', () => {
  const days = [
    day(-6, 1900, 150, { fiber: 18, sugar: 60, salt: 8 }),
    day(-5, 2600, 100, { fiber: 20 }),
    day(-3, 2050, 110),
    day(-2, 1950, 120),
    day(-1, 2000, 100),
    day(0, 0, 0),
  ];

  it('averages logged days and measures adherence and streak', () => {
    const s = computeStats({
      from: addDays(TODAY, -6),
      to: TODAY,
      days,
      targetFor: () => target,
      micros: new Map([
        [addDays(TODAY, -6), { ironMg: 10 }],
        [addDays(TODAY, -3), { ironMg: 5 }],
      ]),
      water: new Map([
        [addDays(TODAY, -1), 1000],
        [addDays(TODAY, -2), 1200],
        ['2020-01-01', 9999],
      ]),
    });
    expect(s).toMatchObject({
      days: 7,
      loggedDays: 5,
      streak: 3,
      adherencePct: 0.8,
      proteinHitPct: 0.2,
      waterAvgMl: 1100,
    });
    expect(s.avg.kcal).toBe(2100);
    expect(s.avg.fiber).toBeCloseTo(38 / 5);
    expect(s.microsAvg).toEqual({ ironMg: 3 });
    expect(s.macroPct!.protein + s.macroPct!.carbs + s.macroPct!.fat).toBeCloseTo(1);
  });

  it('handles empty periods', () => {
    const s = computeStats({
      from: TODAY,
      to: TODAY,
      days: [],
      targetFor: () => undefined,
      micros: new Map(),
      water: new Map(),
    });
    expect(s).toMatchObject({
      loggedDays: 0,
      adherencePct: null,
      proteinHitPct: null,
      macroPct: null,
      streak: 0,
      waterAvgMl: null,
    });
  });

  it('generates insights', () => {
    const s = computeStats({
      from: addDays(TODAY, -6),
      to: TODAY,
      days,
      targetFor: () => target,
      micros: new Map(),
      water: new Map([[TODAY, 500]]),
    });
    const insights = generateInsights({ days, stats: s, targetFor: () => target, today: TODAY });
    expect(insights.map((i) => i.key)).toEqual([
      'protein_low_streak',
      'fiber_low',
      'on_target',
      'water_low',
      'streak',
    ]);
    expect(insights[0]!.params).toEqual({ days: 3 });

    const healthy = [
      day(-3, 2000, 150, { fiber: 35, sugar: 30, salt: 4 }),
      day(-2, 2000, 150, { fiber: 35, sugar: 30, salt: 4 }),
      day(-1, 2000, 150, { fiber: 35, sugar: 30, salt: 4 }),
    ];
    const hs = computeStats({
      from: addDays(TODAY, -3),
      to: TODAY,
      days: healthy,
      targetFor: () => target,
      micros: new Map(),
      water: new Map(),
    });
    expect(
      generateInsights({ days: healthy, stats: hs, targetFor: () => target, today: TODAY }).map(
        (i) => i.key,
      ),
    ).toEqual(['protein_good', 'on_target', 'streak']);

    const salty = [
      day(-2, 2000, 150, { sugar: 80, salt: 9 }),
      day(-1, 2000, 150, { sugar: 80, salt: 9 }),
      day(-3, 2000, 150, { sugar: 80, salt: 9 }),
    ];
    const ss = computeStats({
      from: addDays(TODAY, -3),
      to: TODAY,
      days: salty,
      targetFor: () => undefined,
      micros: new Map(),
      water: new Map(),
    });
    expect(
      generateInsights({ days: salty, stats: ss, targetFor: () => undefined, today: TODAY }).map(
        (i) => i.key,
      ),
    ).toEqual(['sugar_high', 'salt_high', 'streak']);
  });
});

describe('chart math', () => {
  it('produces nice scales', () => {
    expect(niceScale(68.3, 71.8)).toEqual({ min: 68, max: 72, ticks: [68, 69, 70, 71, 72] });
    expect(niceScale(0, 2340, 4)).toEqual({ min: 0, max: 3000, ticks: [0, 1000, 2000, 3000] });
    expect(niceScale(0, 1900, 4)).toEqual({ min: 0, max: 2000, ticks: [0, 500, 1000, 1500, 2000] });
    expect(niceScale(70, 70).min).toBeLessThan(70);
    expect(niceScale(0, 0).max).toBeGreaterThan(0);
    expect(niceScale(Number.NaN, 1)).toEqual({ min: 0, max: 1, ticks: [0, 1] });
  });

  it('maps values and touches', () => {
    expect(linear([0, 10], [0, 100])(5)).toBe(50);
    expect(linear([5, 5], [0, 100])(5)).toBe(50);
    expect(nearestIndex(49, 3, 100)).toBe(1);
    expect(nearestIndex(-10, 3, 100)).toBe(0);
    expect(nearestIndex(500, 3, 100)).toBe(2);
    expect(nearestIndex(10, 1, 100)).toBe(0);
  });
});

describe('CSV', () => {
  it('escapes cells and localises numbers', () => {
    expect(
      toCsv(
        ['a', 'b'],
        [
          ['x;y', 1.5],
          ['say "hi"', null],
        ],
        'de',
      ),
    ).toBe('﻿a;b\r\n"x;y";1,5\r\n"say ""hi""";\r\n');
    expect(toCsv(['a'], [[1.234]], 'en')).toBe('﻿a\r\n1.23\r\n');
  });

  it('exports diary entries and weights', () => {
    const e = {
      date: TODAY,
      mealTypeId: 1,
      name: 'Skyr',
      brand: 'Arla',
      grams: 150,
      kcal: 95,
      protein: 16.5,
      carbs: 6,
      sugar: 6,
      fat: 0.3,
      saturatedFat: null,
      fiber: null,
      salt: 0.15,
      source: 'barcode',
    } as DiaryEntry;
    expect(diaryCsv([e], () => 'Frühstück', 'de').split('\r\n')[1]).toBe(
      '2026-10-14;Frühstück;Skyr;Arla;150;95;16,5;6;6;0,3;;;0,15;barcode',
    );
    expect(weightsCsv([{ date: TODAY, kg: 68.4 }], 'en')).toContain('2026-10-14,68.4');
  });
});
