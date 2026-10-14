import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoachCard } from '@/features/coach/CoachCard';
import { DayMeals } from '@/features/diary/components/DayMeals';
import { DaySummaryCard } from '@/features/diary/components/DaySummaryCard';
import { NoPlanCard } from '@/features/diary/components/NoPlanCard';
import { WaterCard } from '@/features/diary/components/WaterCard';
import { WeightCard } from '@/features/diary/components/WeightCard';
import { useDay } from '@/features/diary/queries';
import { summarizeDay } from '@/features/diary/summary';
import { localIsoDate } from '@/lib/date';
import { formatDate } from '@/lib/format';
import { EmptyState, Skeleton, Text } from '@/ui';

export default function TodayScreen() {
  const { t } = useTranslation();
  const today = localIsoDate();
  const { data, isLoading, error, refetch } = useDay(today);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <ScrollView contentContainerClassName="gap-4 px-5 pb-10 pt-2">
        <View>
          <Text variant="caption">
            {formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
          <Text variant="title" accessibilityRole="header">
            {t('home.today')}
          </Text>
        </View>

        {error ? (
          <EmptyState
            icon="alert-circle-outline"
            title={t('errors.loadTitle')}
            actionLabel={t('common.retry')}
            onAction={() => void refetch()}
          />
        ) : isLoading || !data ? (
          <Skeleton className="h-80" />
        ) : data.goal ? (
          <DaySummaryCard
            summary={summarizeDay(
              data.totals,
              {
                kcal: data.goal.kcal,
                protein: data.goal.protein,
                carbs: data.goal.carbs,
                fat: data.goal.fat,
                waterMl: data.goal.waterMl,
              },
              data.waterMl,
            )}
          />
        ) : (
          <NoPlanCard kcal={data.totals.kcal} />
        )}

        <CoachCard />
        <DayMeals date={today} entries={data?.entries} />
        {data && <WaterCard date={today} ml={data.waterMl} targetMl={data.goal?.waterMl ?? 0} />}
        <WeightCard today={today} />
      </ScrollView>
    </SafeAreaView>
  );
}
