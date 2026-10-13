import { calorieTarget } from './goals';
import { addDays, daysBetween } from './dates';
import { KCAL_PER_KG } from './energy';
import type { IntakePoint, Profile, WeightPoint } from './types';

/** Daily smoothing factor for the weight trend (≈ 10-day memory, like a classic diet "trend line"). */
export const TREND_ALPHA = 0.1;

export interface TrendPoint {
  date: string;
  kg: number;
  trendKg: number;
}

/**
 * Exponentially smoothed weight trend. Daily scale noise (water, salt, digestion) is damped;
 * gaps between weigh-ins are handled by compounding the smoothing factor per elapsed day.
 */
export function weightTrend(weights: WeightPoint[], alpha = TREND_ALPHA): TrendPoint[] {
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const out: TrendPoint[] = [];
  for (const w of sorted) {
    const prev = out[out.length - 1];
    if (!prev) {
      out.push({ ...w, trendKg: w.kg });
      continue;
    }
    const gap = Math.max(1, daysBetween(prev.date, w.date));
    const a = 1 - (1 - alpha) ** gap;
    out.push({ ...w, trendKg: prev.trendKg + a * (w.kg - prev.trendKg) });
  }
  return out;
}

export interface ExpenditureEstimate {
  /** Blended TDEE estimate in kcal/day. */
  tdee: number;
  /** TDEE implied purely by the data, if computable. */
  observedTdee?: number;
  /** 0–1: how much the data was trusted over the prior. */
  confidence: number;
  /** Trend change per week in kg over the window (negative = loss). */
  weeklyTrendChangeKg?: number;
  loggedDays: number;
  weighIns: number;
}

/**
 * Estimate real energy expenditure from what was eaten and how the weight trend moved:
 * TDEE = average intake − (Δtrend × 7700 kcal/kg) / days.
 * The result is blended with the prior estimate according to data quality, so a few missing
 * logs or weigh-ins cannot swing the target wildly.
 */
export function estimateExpenditure(params: {
  intakes: IntakePoint[];
  weights: WeightPoint[];
  priorTdee: number;
  endDate: string;
  windowDays?: number;
}): ExpenditureEstimate {
  const windowDays = params.windowDays ?? 21;
  const startDate = addDays(params.endDate, -windowDays);
  const inWindow = (d: string) => d > startDate && d <= params.endDate;

  const intakes = params.intakes.filter((i) => inWindow(i.date));
  // Trend is computed over all history so the window starts from a settled value.
  const trend = weightTrend(params.weights.filter((w) => w.date <= params.endDate));
  const trendInWindow = trend.filter((t) => inWindow(t.date));
  const base = { loggedDays: intakes.length, weighIns: trendInWindow.length };

  const first = trendInWindow[0];
  const last = trendInWindow[trendInWindow.length - 1];
  const spanDays = first && last ? daysBetween(first.date, last.date) : 0;
  if (intakes.length < 7 || !first || !last || spanDays < 7) {
    return { tdee: params.priorTdee, confidence: 0, ...base };
  }

  const avgIntake = intakes.reduce((s, i) => s + i.kcal, 0) / intakes.length;
  const deltaKg = last.trendKg - first.trendKg;
  const observedTdee = avgIntake - (deltaKg * KCAL_PER_KG) / spanDays;

  // Data quality: share of days logged and weigh-in density (≥ every other day counts as full).
  const logCoverage = Math.min(1, intakes.length / windowDays);
  const weighCoverage = Math.min(1, trendInWindow.length / (windowDays / 2));
  const confidence = Math.min(0.8, logCoverage * weighCoverage);

  return {
    tdee: params.priorTdee + confidence * (observedTdee - params.priorTdee),
    observedTdee,
    confidence,
    weeklyTrendChangeKg: (deltaKg / spanDays) * 7,
    ...base,
  };
}

/** Maximum change to the calorie target per weekly check-in. */
export const MAX_WEEKLY_ADJUSTMENT = 150;
/** Ideal-vs-current differences below this are ignored, so the target does not jitter week to week. */
export const MIN_ADJUSTMENT = 30;
/** Plan deviations smaller than this (kg/week) count as "on track". */
export const RATE_TOLERANCE_KG = 0.1;

export type CheckInReason =
  | 'insufficient_data'
  | 'on_track'
  | 'slower_than_planned'
  | 'faster_than_planned'
  | 'expenditure_updated';

export interface CheckInResult {
  previousKcal: number;
  newKcal: number;
  change: number;
  reason: CheckInReason;
  estimate: ExpenditureEstimate;
  /** Planned and actual weekly change for explaining the adjustment in the UI. */
  plannedWeeklyChangeKg: number;
  actualWeeklyChangeKg?: number;
}

/**
 * Weekly check-in: re-derive the calorie target from the measured expenditure and move towards it,
 * at most ±150 kcal per week, never below the safety floor.
 */
export function weeklyCheckIn(params: {
  profile: Profile;
  bmrKcal: number;
  currentKcal: number;
  priorTdee: number;
  intakes: IntakePoint[];
  weights: WeightPoint[];
  today: string;
}): CheckInResult {
  const estimate = estimateExpenditure({
    intakes: params.intakes,
    weights: params.weights,
    priorTdee: params.priorTdee,
    endDate: params.today,
  });
  const plannedWeeklyChangeKg = ((params.currentKcal - params.priorTdee) * 7) / KCAL_PER_KG;
  const base = { previousKcal: params.currentKcal, estimate, plannedWeeklyChangeKg };

  if (estimate.confidence === 0) {
    return { ...base, newKcal: params.currentKcal, change: 0, reason: 'insufficient_data' };
  }

  const ideal = calorieTarget(params.profile, estimate.tdee, params.bmrKcal).kcal;
  if (Math.abs(ideal - params.currentKcal) < MIN_ADJUSTMENT) {
    return {
      ...base,
      newKcal: params.currentKcal,
      change: 0,
      reason: 'on_track',
      actualWeeklyChangeKg: estimate.weeklyTrendChangeKg,
    };
  }
  const delta = Math.max(
    -MAX_WEEKLY_ADJUSTMENT,
    Math.min(MAX_WEEKLY_ADJUSTMENT, ideal - params.currentKcal),
  );
  const newKcal = Math.round((params.currentKcal + delta) / 10) * 10;
  const actual = estimate.weeklyTrendChangeKg!;
  const deviation = actual - plannedWeeklyChangeKg;

  let reason: CheckInReason;
  if (Math.abs(deviation) < RATE_TOLERANCE_KG) reason = 'expenditure_updated';
  else {
    // "Slower" means progress towards the goal lags the plan: less loss when cutting, less gain when bulking.
    const lagging = params.profile.goal === 'gain' ? deviation < 0 : deviation > 0;
    reason = lagging ? 'slower_than_planned' : 'faster_than_planned';
  }
  return {
    ...base,
    newKcal,
    change: newKcal - params.currentKcal,
    reason,
    actualWeeklyChangeKg: actual,
  };
}

/**
 * Projected date to reach the target weight at a given weekly rate.
 * Returns undefined if the rate does not move towards the target.
 */
export function forecastGoalDate(params: {
  currentKg: number;
  targetKg: number;
  weeklyChangeKg: number;
  today: string;
}): string | undefined {
  const remaining = params.targetKg - params.currentKg;
  if (remaining === 0) return params.today;
  if (params.weeklyChangeKg === 0 || Math.sign(remaining) !== Math.sign(params.weeklyChangeKg)) {
    return undefined;
  }
  const days = Math.ceil((remaining / params.weeklyChangeKg) * 7);
  return addDays(params.today, days);
}
