import { describe, expect, it } from 'vitest';

import { displayInt, summarizeDay } from '@/features/diary/summary';
import { parseDecimal } from '@/lib/number';

describe('summarizeDay', () => {
  it('computes remaining amounts and caps progress', () => {
    const s = summarizeDay(
      { kcal: 1800, protein: 90, carbs: 200, fat: 70 },
      { kcal: 1570, protein: 136, carbs: 149, fat: 48, waterMl: 2500 },
      1000,
    );
    expect(s.kcal).toEqual({ eaten: 1800, target: 1570, remaining: 0, fraction: 1, over: true });
    expect(s.protein).toMatchObject({ remaining: 46, over: false });
    expect(s.water.fraction).toBeCloseTo(0.4);
  });

  it('handles a zero target', () => {
    expect(
      summarizeDay(
        { kcal: 0, protein: 0, carbs: 0, fat: 0 },
        { kcal: 0, protein: 0, carbs: 0, fat: 0, waterMl: 0 },
        0,
      ).kcal,
    ).toEqual({
      eaten: 0,
      target: 0,
      remaining: 0,
      fraction: 0,
      over: false,
    });
    expect(displayInt(-0.2)).toBe(0);
  });
});

describe('parseDecimal', () => {
  it('accepts decimal commas and rejects junk', () => {
    expect(parseDecimal('72,5')).toBe(72.5);
    expect(parseDecimal(' 80 ')).toBe(80);
    expect(parseDecimal('')).toBeUndefined();
    expect(parseDecimal('abc')).toBeUndefined();
  });
});
