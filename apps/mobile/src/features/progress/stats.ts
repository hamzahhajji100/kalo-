import { addDays, daysBetween, sumNutrients, type Nutrients } from '@kalo/core';

import type { DailyTotal } from '@/data/repositories/diary';

export interface DayTarget {
  kcal: number;
  protein: number;
  waterMl: number;
}

export interface PeriodStats {
  days: number;
  loggedDays: number;
  /** Averages over logged days. */
  avg: Nutrients;
  /** Share of logged days within ±10 % of the calorie target. */
  adherencePct: number | null;
  /** Share of logged days reaching ≥ 90 % of the protein target. */
  proteinHitPct: number | null;
  /** Energy share of each macro (Atwater). */
  macroPct: { protein: number; carbs: number; fat: number } | null;
  /** Consecutive logged days ending today (or yesterday, if today is still empty). */
  streak: number;
  microsAvg: Record<string, number>;
  waterAvgMl: number | null;
}

export const isLogged = (d: DailyTotal | undefined) => !!d && d.entries > 0;

export function computeStats(params: {
  from: string;
  to: string;
  days: DailyTotal[];
  targetFor: (date: string) => DayTarget | undefined;
  micros: Map<string, Record<string, number>>;
  water: Map<string, number>;
}): PeriodStats {
  const logged = params.days.filter(isLogged);
  const n = logged.length;
  const avgOf = (total: Nutrients): Nutrients =>
    Object.fromEntries(
      Object.entries(total).map(([k, v]) => [k, n ? (v as number) / n : 0]),
    ) as unknown as Nutrients;
  const avg = avgOf(sumNutrients(logged));

  let withTarget = 0;
  let onTarget = 0;
  let proteinHit = 0;
  for (const d of logged) {
    const t = params.targetFor(d.date);
    if (!t) continue;
    withTarget++;
    if (Math.abs(d.kcal - t.kcal) <= t.kcal * 0.1) onTarget++;
    if (d.protein >= t.protein * 0.9) proteinHit++;
  }

  const energy = avg.protein * 4 + avg.carbs * 4 + avg.fat * 9;
  const microsTotals: Record<string, number> = {};
  for (const d of logged)
    for (const [k, v] of Object.entries(params.micros.get(d.date) ?? {}))
      microsTotals[k] = (microsTotals[k] ?? 0) + v;

  const waterDays = [...params.water.entries()].filter(
    ([date]) => date >= params.from && date <= params.to,
  );

  const byDate = new Map(params.days.map((d) => [d.date, d]));
  let streak = 0;
  let cursor = isLogged(byDate.get(params.to)) ? params.to : addDays(params.to, -1);
  while (isLogged(byDate.get(cursor))) {
    streak++;
    cursor = addDays(cursor, -1);
  }

  return {
    days: daysBetween(params.from, params.to) + 1,
    loggedDays: n,
    avg,
    adherencePct: withTarget ? onTarget / withTarget : null,
    proteinHitPct: withTarget ? proteinHit / withTarget : null,
    macroPct:
      energy > 0
        ? {
            protein: (avg.protein * 4) / energy,
            carbs: (avg.carbs * 4) / energy,
            fat: (avg.fat * 9) / energy,
          }
        : null,
    streak,
    microsAvg: Object.fromEntries(Object.entries(microsTotals).map(([k, v]) => [k, n ? v / n : 0])),
    waterAvgMl: waterDays.length
      ? waterDays.reduce((s, [, ml]) => s + ml, 0) / waterDays.length
      : null,
  };
}

export type InsightKey =
  | 'protein_low_streak'
  | 'fiber_low'
  | 'sugar_high'
  | 'salt_high'
  | 'water_low'
  | 'streak'
  | 'on_target'
  | 'protein_good'
  | 'very_low_intake';

export interface Insight {
  key: InsightKey;
  /** 'care' = supportive health message, always shown first and also in relaxed mode. */
  tone: 'positive' | 'tip' | 'care';
  /** Whether the message contains calorie/number details (hidden in relaxed mode). */
  numeric: boolean;
  params: Record<string, number>;
}

/** Reference values: DGE recommends ≥ 30 g fibre and ≤ 6 g salt; WHO suggests < 50 g free sugars. */
export const FIBER_MIN_G = 25;
export const SUGAR_MAX_G = 50;
export const SALT_MAX_G = 6;
/** Daily intake below this on several days triggers a supportive check. */
export const VERY_LOW_KCAL = 800;

/** Rule-based hints from recent days. Tips are phrased constructively, never as failures. */
export function generateInsights(params: {
  days: DailyTotal[];
  stats: PeriodStats;
  targetFor: (date: string) => DayTarget | undefined;
  today: string;
}): Insight[] {
  const out: Insight[] = [];
  const { stats } = params;

  // Several logged days with very little food can be a sign of under-eating; respond with care, not numbers.
  const recent = params.days.filter(
    (d) => isLogged(d) && d.date < params.today && d.date >= addDays(params.today, -7),
  );
  if (recent.filter((d) => d.kcal < VERY_LOW_KCAL).length >= 3)
    out.push({ key: 'very_low_intake', tone: 'care', numeric: false, params: {} });

  // Protein under target on the last N logged days in a row.
  const byDate = new Map(params.days.map((d) => [d.date, d]));
  let low = 0;
  for (let i = 1; i <= 7; i++) {
    const d = byDate.get(addDays(params.today, -i));
    const t = params.targetFor(addDays(params.today, -i));
    if (!isLogged(d) || !t || d!.protein >= t.protein * 0.9) break;
    low++;
  }
  if (low >= 3)
    out.push({ key: 'protein_low_streak', tone: 'tip', numeric: true, params: { days: low } });

  if (stats.loggedDays >= 3) {
    if (stats.avg.fiber !== undefined && stats.avg.fiber < FIBER_MIN_G)
      out.push({
        key: 'fiber_low',
        tone: 'tip',
        numeric: true,
        params: { grams: Math.round(stats.avg.fiber) },
      });
    if (stats.avg.sugar !== undefined && stats.avg.sugar > SUGAR_MAX_G)
      out.push({
        key: 'sugar_high',
        tone: 'tip',
        numeric: true,
        params: { grams: Math.round(stats.avg.sugar) },
      });
    if (stats.avg.salt !== undefined && stats.avg.salt > SALT_MAX_G)
      out.push({
        key: 'salt_high',
        tone: 'tip',
        numeric: true,
        params: { grams: Math.round(stats.avg.salt * 10) / 10 },
      });
    if (stats.proteinHitPct !== null && stats.proteinHitPct >= 0.8)
      out.push({ key: 'protein_good', tone: 'positive', numeric: false, params: {} });
    if (stats.adherencePct !== null && stats.adherencePct >= 0.7)
      out.push({
        key: 'on_target',
        tone: 'positive',
        numeric: true,
        params: { pct: Math.round(stats.adherencePct * 100) },
      });
  }
  const waterTarget = params.targetFor(params.today)?.waterMl;
  if (stats.waterAvgMl !== null && waterTarget && stats.waterAvgMl < waterTarget * 0.7) {
    out.push({ key: 'water_low', tone: 'tip', numeric: false, params: {} });
  }
  if (stats.streak >= 3)
    out.push({ key: 'streak', tone: 'positive', numeric: false, params: { days: stats.streak } });
  return out;
}
