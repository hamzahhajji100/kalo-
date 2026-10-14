import { addDays, weightTrend } from '@kalo/core';
import { useQuery } from '@tanstack/react-query';

import { db } from '@/data/client';
import { listMeasurements, listWeights, waterTotals } from '@/data/repositories/body';
import { dailyMicros, dailyTotals, type DailyTotal } from '@/data/repositories/diary';
import { listProgressPhotos } from '@/data/repositories/photos';
import { getProfile, goalOn } from '@/data/repositories/profile';
import { localIsoDate } from '@/lib/date';
import { computeStats, generateInsights, type DayTarget } from './stats';

export const progressKey = ['progress'] as const;

/** Nutrition stats for the last `days` days plus weight history for `weightDays` (null = all). */
export function useProgress(days: number, weightDays: number | null) {
  return useQuery({
    queryKey: [...progressKey, days, weightDays],
    queryFn: () => {
      const today = localIsoDate();
      const from = addDays(today, -(days - 1));
      const totals = dailyTotals(db, from, today);
      const byDate = new Map(totals.map((d) => [d.date, d]));
      // Fill gaps so charts show empty days as zero bars.
      const series: DailyTotal[] = Array.from({ length: days }, (_, i) => {
        const date = addDays(from, i);
        return byDate.get(date) ?? { date, entries: 0, kcal: 0, protein: 0, carbs: 0, fat: 0 };
      });
      const targetFor = (date: string): DayTarget | undefined => {
        const g = goalOn(db, date);
        return g ? { kcal: g.kcal, protein: g.protein, waterMl: g.waterMl } : undefined;
      };
      const stats = computeStats({
        from,
        to: today,
        days: series,
        targetFor,
        micros: dailyMicros(db, from, today),
        water: waterTotals(db, from, today),
      });
      const allWeights = listWeights(db);
      const trend = weightTrend(allWeights);
      const weightFrom = weightDays === null ? '' : addDays(today, -(weightDays - 1));
      return {
        today,
        series,
        stats,
        insights: generateInsights({ days: series, stats, targetFor, today }),
        goal: goalOn(db, today) ?? null,
        profile: getProfile(db) ?? null,
        trend: trend.filter((p) => p.date >= weightFrom),
        allTrend: trend,
        measurements: listMeasurements(db),
        photos: listProgressPhotos(db),
      };
    },
  });
}
