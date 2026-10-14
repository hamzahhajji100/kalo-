import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';

import { db } from '@/data/client';
import type { Db } from '@/data/db';
import { latestWeight, waterTotal } from '@/data/repositories/body';
import { dayTotals, listEntries, recentFoods } from '@/data/repositories/diary';
import { listMealTypes } from '@/data/repositories/mealTypes';
import { goalOn, getProfile } from '@/data/repositories/profile';

export const keys = {
  day: (date: string) => ['day', date] as const,
  mealTypes: ['mealTypes'] as const,
  recent: ['recent'] as const,
  body: ['body'] as const,
  profile: ['profile'] as const,
};

/** Everything a day screen needs, read in one go from the local database. */
export function useDay(date: string) {
  return useQuery({
    queryKey: keys.day(date),
    queryFn: () => ({
      entries: listEntries(db, date),
      totals: dayTotals(db, date),
      waterMl: waterTotal(db, date),
      goal: goalOn(db, date) ?? null,
    }),
  });
}

export function useMealTypes() {
  return useQuery({
    queryKey: keys.mealTypes,
    queryFn: () => listMealTypes(db),
    staleTime: Infinity,
  });
}

export function useRecentFoods(limit = 20) {
  return useQuery({ queryKey: [...keys.recent, limit], queryFn: () => recentFoods(db, limit) });
}

export function useLatestWeight() {
  return useQuery({ queryKey: [...keys.body, 'latest'], queryFn: () => latestWeight(db) ?? null });
}

export function useProfile() {
  return useQuery({ queryKey: keys.profile, queryFn: () => getProfile(db) ?? null });
}

/**
 * Mutation over the local database that refreshes the given query keys afterwards.
 * Day-level keys are invalidated by prefix, so `['day']` refreshes every day.
 */
export function useDbMutation<TVars, TResult = void>(
  fn: (db: Db, vars: TVars) => TResult,
  invalidate: (vars: TVars) => QueryKey[],
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: TVars) => fn(db, vars),
    onSuccess: (_r, vars) =>
      Promise.all(invalidate(vars).map((queryKey) => qc.invalidateQueries({ queryKey }))),
  });
}
