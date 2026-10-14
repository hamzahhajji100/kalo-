import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

import { localIsoDate } from '@/lib/date';
import { mealKeyForTime } from '@/data/repositories/mealTypes';
import { useMealTypes } from './queries';

/**
 * Date and meal an add flow writes to. Comes from route params when opened from a meal's "+",
 * otherwise today and the meal matching the current time.
 */
export function useAddTarget(): { date: string; mealTypeId: number | undefined } {
  const params = useLocalSearchParams<{ date?: string; meal?: string }>();
  const { data: meals } = useMealTypes();
  return useMemo(() => {
    const date = params.date ?? localIsoDate();
    if (params.meal) return { date, mealTypeId: Number(params.meal) };
    const key = mealKeyForTime(new Date());
    return { date, mealTypeId: meals?.find((m) => m.key === key)?.id ?? meals?.[0]?.id };
  }, [params.date, params.meal, meals]);
}
