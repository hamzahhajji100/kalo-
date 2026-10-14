import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { copyEntries } from '@/data/repositories/diary';
import { DayMeals } from '@/features/diary/components/DayMeals';
import { DayNavigator, useDayLabel } from '@/features/diary/components/DayNavigator';
import { keys, useDay, useDbMutation } from '@/features/diary/queries';
import { localIsoDate, shiftIsoDate } from '@/lib/date';
import { formatInt } from '@/lib/format';
import { usePreferences } from '@/lib/preferences';
import { Button, Card, Text } from '@/ui';

export default function DiaryScreen() {
  const { t } = useTranslation();
  const [date, setDate] = useState(localIsoDate());
  const { data } = useDay(date);
  const relaxed = usePreferences((s) => s.relaxedMode);
  const label = useDayLabel();
  const copy = useDbMutation(
    (db, v: { from: string; to: string }) => copyEntries(db, { fromDate: v.from, toDate: v.to }),
    (v) => [keys.day(v.to), keys.recent],
  );

  const previous = shiftIsoDate(date, -1);
  const confirmCopy = () =>
    Alert.alert(
      t('diary.copyTitle'),
      t('diary.copyBody', { from: label(previous), to: label(date) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('diary.copyConfirm'), onPress: () => copy.mutate({ from: previous, to: date }) },
      ],
    );

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <ScrollView contentContainerClassName="gap-4 px-5 pb-10 pt-2">
        <DayNavigator date={date} onChange={setDate} />
        {data && !relaxed && (
          <Card className="flex-row justify-between">
            {(
              [
                ['kcal', data.totals.kcal, data.goal?.kcal],
                ['protein', data.totals.protein, data.goal?.protein],
                ['carbs', data.totals.carbs, data.goal?.carbs],
                ['fat', data.totals.fat, data.goal?.fat],
              ] as const
            ).map(([key, v, goal]) => (
              <View key={key} className="items-center" accessible>
                <Text
                  className="text-lg font-bold text-text"
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {formatInt(v)}
                </Text>
                <Text variant="caption">
                  {key === 'kcal' ? 'kcal' : t(`macros.${key}Short`)}
                  {goal ? ` / ${formatInt(goal)}` : ''}
                </Text>
              </View>
            ))}
          </Card>
        )}
        <DayMeals date={date} entries={data?.entries} />
        {data && data.entries.length === 0 && (
          <Button
            variant="secondary"
            label={t('diary.copyFrom', { day: label(previous) })}
            onPress={confirmCopy}
            loading={copy.isPending}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
