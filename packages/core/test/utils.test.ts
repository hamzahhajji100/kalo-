import { describe, expect, it } from 'vitest';

import {
  addDays,
  ageOn,
  cmToFtIn,
  daysBetween,
  flOzToMl,
  ftInToCm,
  gToOz,
  isPlausiblePer100g,
  kcalFromMacros,
  kgToLb,
  kjToKcal,
  lbToKg,
  mlToFlOz,
  relativeKcalDeviation,
  scaleNutrients,
  sodiumToSalt,
  sumNutrients,
} from '../src';

describe('dates', () => {
  it('computes ages around birthdays', () => {
    expect(ageOn('2000-06-15', '2026-06-14')).toBe(25);
    expect(ageOn('2000-06-15', '2026-06-15')).toBe(26);
    expect(ageOn('2000-06-15', '2026-05-20')).toBe(25);
  });

  it('adds days across DST and month ends', () => {
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(daysBetween('2026-10-24', '2026-10-27')).toBe(3);
  });
});

describe('units', () => {
  it('round-trips conversions', () => {
    expect(lbToKg(kgToLb(80))).toBeCloseTo(80);
    expect(flOzToMl(mlToFlOz(500))).toBeCloseTo(500);
    expect(cmToFtIn(180)).toEqual({ ft: 5, inch: 11 });
    expect(ftInToCm(5, 11)).toBeCloseTo(180.34);
    expect(gToOz(28.3495231)).toBeCloseTo(1);
    expect(kjToKcal(418.4)).toBeCloseTo(100);
    expect(sodiumToSalt(0.4)).toBeCloseTo(1);
  });
});

describe('nutrients', () => {
  const oats = { kcal: 372, protein: 13.5, carbs: 58.7, fat: 7, fiber: 10 };

  it('scales per-100 g values', () => {
    expect(scaleNutrients(oats, 50)).toEqual({
      kcal: 186,
      protein: 6.75,
      carbs: 29.35,
      fat: 3.5,
      fiber: 5,
    });
  });

  it('sums and only reports optional values that exist', () => {
    const s = sumNutrients([oats, { kcal: 64, protein: 3.4, carbs: 4.8, fat: 3.5 }]);
    expect(s).toEqual({ kcal: 436, protein: 16.9, carbs: 63.5, fat: 10.5, fiber: 10 });
    expect(sumNutrients([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it('checks plausibility', () => {
    expect(kcalFromMacros(oats)).toBeCloseTo(351.8);
    expect(isPlausiblePer100g(oats)).toBe(true);
    expect(isPlausiblePer100g({ kcal: 0, protein: 0, carbs: 0, fat: 0 })).toBe(true); // water
    expect(isPlausiblePer100g({ kcal: 2000, protein: 10, carbs: 10, fat: 10 })).toBe(false);
    expect(isPlausiblePer100g({ kcal: 300, protein: 60, carbs: 60, fat: 0 })).toBe(false);
    expect(isPlausiblePer100g({ kcal: -1, protein: 0, carbs: 0, fat: 0 })).toBe(false);
    expect(isPlausiblePer100g({ kcal: 100, protein: 0, carbs: 0, fat: 30 })).toBe(false);
  });

  it('measures deviation', () => {
    expect(relativeKcalDeviation(100, 120)).toBeCloseTo(1 / 6);
    expect(relativeKcalDeviation(0, 0)).toBe(0);
  });
});
