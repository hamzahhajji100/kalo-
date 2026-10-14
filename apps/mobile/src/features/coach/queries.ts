import { addDays } from '@kalo/core';
import { useQuery } from '@tanstack/react-query';

import { db } from '@/data/client';
import { listWeights } from '@/data/repositories/body';
import { lastCheckIn } from '@/data/repositories/checkIns';
import { dailyTotals } from '@/data/repositories/diary';
import { getProfile, goalOn } from '@/data/repositories/profile';
import { localIsoDate } from '@/lib/date';
import { forecast, isCheckInDue, runCheckIn } from './logic';

export const coachKey = ['coach'] as const;

/** Everything the coach shows on Home: whether a check-in is due and the goal-date forecast. */
export function useCoachStatus() {
  return useQuery({
    queryKey: [...coachKey, 'status'],
    queryFn: () => {
      const today = localIsoDate();
      const profile = getProfile(db) ?? null;
      const goal = goalOn(db, today);
      const weights = listWeights(db);
      const plannedWeeklyKg = goal ? ((goal.kcal - goal.tdee) * 7) / 7700 : 0;
      return {
        profile,
        goal: goal ?? null,
        checkInDue: isCheckInDue({ goal, lastCheckIn: lastCheckIn(db)?.date, today }),
        forecast:
          profile && goal
            ? forecast({ weights, targetKg: profile.targetWeightKg, plannedWeeklyKg, today })
            : null,
      };
    },
  });
}

export function useCheckIn() {
  return useQuery({
    queryKey: [...coachKey, 'checkIn'],
    queryFn: () => {
      const today = localIsoDate();
      const profile = getProfile(db);
      const goal = goalOn(db, today);
      if (!profile || !goal) return null;
      const result = runCheckIn({
        profile,
        goal,
        days: dailyTotals(db, addDays(today, -28), today),
        weights: listWeights(db),
        today,
      });
      return result ? { profile, goal, result, today } : null;
    },
    staleTime: 0,
  });
}
