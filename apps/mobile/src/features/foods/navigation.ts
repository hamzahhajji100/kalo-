import type { Food } from '@kalo/schemas';
import { router } from 'expo-router';

import { queryClient } from '@/lib/queryClient';

export type FoodMode = 'log' | 'recipe';

export const foodKey = (id: string) => ['food', id] as const;

/** Open the food detail. The food is put into the query cache first, so the screen renders instantly. */
export function openFood(
  food: Food,
  params: {
    date?: string;
    meal?: string;
    mode?: FoodMode;
    grams?: number;
    via?: 'barcode' | 'photo';
  },
): void {
  queryClient.setQueryData(foodKey(food.id), food);
  router.push({
    pathname: '/food/[id]',
    params: {
      id: food.id,
      ...(params.date && { date: params.date }),
      ...(params.meal && { meal: params.meal }),
      ...(params.mode && { mode: params.mode }),
      ...(params.grams !== undefined && { grams: String(params.grams) }),
      ...(params.via && { via: params.via }),
    },
  });
}
