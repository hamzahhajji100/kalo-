import type { Nutrients } from '@kalo/core';

export interface DayTargets {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  waterMl: number;
}

export interface MacroProgress {
  eaten: number;
  target: number;
  remaining: number;
  /** 0–1 for progress bars; values above 1 are capped, `over` tells whether the target was exceeded. */
  fraction: number;
  over: boolean;
}

const progress = (eaten: number, target: number): MacroProgress => ({
  eaten,
  target,
  remaining: Math.max(0, target - eaten),
  fraction: target > 0 ? Math.min(1, eaten / target) : 0,
  over: target > 0 && eaten > target,
});

export interface DaySummary {
  kcal: MacroProgress;
  protein: MacroProgress;
  carbs: MacroProgress;
  fat: MacroProgress;
  water: MacroProgress;
}

/** Pure view model for the home ring and macro bars. */
export function summarizeDay(totals: Nutrients, targets: DayTargets, waterMl: number): DaySummary {
  return {
    kcal: progress(totals.kcal, targets.kcal),
    protein: progress(totals.protein, targets.protein),
    carbs: progress(totals.carbs, targets.carbs),
    fat: progress(totals.fat, targets.fat),
    water: progress(waterMl, targets.waterMl),
  };
}

/** Whole numbers for display; avoids "-0". */
export const displayInt = (v: number) => Math.round(v) || 0;
