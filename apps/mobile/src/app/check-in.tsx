import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { db } from '@/data/client';
import { decideCheckIn } from '@/features/coach/service';
import { useCheckIn } from '@/features/coach/queries';
import { formatDecimal, formatInt } from '@/lib/format';
import { Button, Card, EmptyState, SheetScreen, Skeleton, Text } from '@/ui';

/** Weekly check-in: explains what the data shows and proposes (but never forces) a new target. */
export default function CheckInScreen() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data, isLoading } = useCheckIn();

  if (isLoading)
    return (
      <SheetScreen title={t('coach.checkInTitle')}>
        <Skeleton className="h-64" />
      </SheetScreen>
    );
  if (!data) {
    return (
      <SheetScreen title={t('coach.checkInTitle')}>
        <EmptyState
          icon="scale-outline"
          title={t('coach.needWeight')}
          actionLabel={t('home.logWeight')}
          onAction={() => router.replace('/log-weight')}
        />
      </SheetScreen>
    );
  }

  const { result, profile, today } = data;
  const decide = (accept: boolean) => {
    decideCheckIn(db, { profile, result, accept, today });
    void qc.invalidateQueries();
    router.back();
  };
  const kg = (v: number | undefined) =>
    v === undefined ? '–' : `${v > 0 ? '+' : v < 0 ? '−' : '±'}${formatDecimal(Math.abs(v), 2)} kg`;
  const changes = result.change !== 0;

  return (
    <SheetScreen
      title={t('coach.checkInTitle')}
      footer={
        changes ? (
          <>
            <Button
              label={t('coach.accept', { kcal: formatInt(result.newKcal) })}
              onPress={() => decide(true)}
            />
            <Button
              variant="ghost"
              label={t('coach.keep', { kcal: formatInt(result.previousKcal) })}
              onPress={() => decide(false)}
            />
          </>
        ) : (
          <Button label={t('coach.ok')} onPress={() => decide(false)} />
        )
      }
    >
      <Text variant="heading">{t(`coach.reasons.${result.reason}.title`)}</Text>
      <Text>
        {t(`coach.reasons.${result.reason}.body`, {
          planned: kg(result.plannedWeeklyChangeKg),
          actual: kg(result.actualWeeklyChangeKg),
          tdee: formatInt(result.estimate.tdee),
        })}
      </Text>

      {result.reason !== 'insufficient_data' && (
        <Card className="gap-2">
          <Row label={t('coach.plannedPerWeek')} value={kg(result.plannedWeeklyChangeKg)} />
          <Row label={t('coach.actualPerWeek')} value={kg(result.actualWeeklyChangeKg)} />
          <Row label={t('coach.estimatedTdee')} value={`${formatInt(result.estimate.tdee)} kcal`} />
          <Row
            label={t('coach.dataQuality')}
            value={t('coach.dataQualityValue', {
              days: result.estimate.loggedDays,
              weighIns: result.estimate.weighIns,
            })}
          />
          {changes && (
            <Row
              label={t('coach.newTarget')}
              value={`${formatInt(result.previousKcal)} → ${formatInt(result.newKcal)} kcal`}
            />
          )}
        </Card>
      )}
      <Text variant="caption">{t('coach.howItWorks')}</Text>
    </SheetScreen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between gap-4">
      <Text variant="caption" className="flex-1">
        {label}
      </Text>
      <Text className="font-semibold text-text">{value}</Text>
    </View>
  );
}
