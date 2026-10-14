import { View } from 'react-native';

import type { DiaryEntry } from '@/data/repositories/diary';
import { Skeleton } from '@/ui';
import { useMealTypes } from '../queries';
import { MealSection } from './MealSection';

export function DayMeals({ date, entries }: { date: string; entries: DiaryEntry[] | undefined }) {
  const { data: meals } = useMealTypes();
  if (!meals || !entries) {
    return (
      <View className="gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </View>
    );
  }
  return (
    <View className="gap-3">
      {meals.map((m) => (
        <MealSection
          key={m.id}
          meal={m}
          date={date}
          entries={entries.filter((e) => e.mealTypeId === m.id)}
        />
      ))}
    </View>
  );
}
