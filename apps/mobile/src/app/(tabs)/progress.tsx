import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { exportCsv } from '@/features/progress/export';
import { addPhoto, removePhoto } from '@/features/progress/progressPhotos';
import { progressKey, useProgress } from '@/features/progress/queries';
import type { Insight } from '@/features/progress/stats';
import { isoToDate } from '@/lib/date';
import { formatDate, formatDecimal, formatInt } from '@/lib/format';
import { usePreferences } from '@/lib/preferences';
import { useTheme } from '@/theme/ThemeProvider';
import { Button, Card, Chips, EmptyState, Skeleton, Text } from '@/ui';
import { CalorieBars } from '@/ui/charts/CalorieBars';
import { MacroSplit } from '@/ui/charts/MacroSplit';
import { WeightChart } from '@/ui/charts/WeightChart';

type Range = 7 | 30 | 90;
type WeightRange = 30 | 90 | 180 | 365 | 0;

const MICRO_UNITS: Record<string, string> = {
  ironMg: 'mg',
  calciumMg: 'mg',
  magnesiumMg: 'mg',
  potassiumMg: 'mg',
  zincMg: 'mg',
  vitaminCMg: 'mg',
  vitaminDUg: 'µg',
  vitaminB12Ug: 'µg',
};

export default function ProgressScreen() {
  const { t, i18n } = useTranslation();
  const { color } = useTheme();
  const qc = useQueryClient();
  const relaxed = usePreferences((s) => s.relaxedMode);
  const [range, setRange] = useState<Range>(7);
  const [weightRange, setWeightRange] = useState<WeightRange>(90);
  const { data, isLoading } = useProgress(range, weightRange || null);

  if (isLoading || !data) {
    return (
      <SafeAreaView className="flex-1 gap-4 bg-bg px-5" edges={['top']}>
        <Skeleton className="mt-14 h-56" />
        <Skeleton className="h-48" />
      </SafeAreaView>
    );
  }
  const { stats, goal, trend, allTrend } = data;
  const latest = allTrend.at(-1);
  const rangeStart = trend[0];
  const insights = data.insights.filter((i: Insight) => !relaxed || !i.numeric);

  const onExport = (kind: 'diary' | 'weights') =>
    void exportCsv(kind, i18n.language === 'en' ? 'en' : 'de', (key, name) =>
      key ? t(`meals.${key}`) : (name ?? ''),
    ).catch(() => Alert.alert(t('progress.exportFailed')));

  const onAddPhoto = () =>
    Alert.alert(t('progress.addPhoto'), t('progress.photosPrivate'), [
      {
        text: t('progress.camera'),
        onPress: () =>
          void addPhoto('camera').then(() => qc.invalidateQueries({ queryKey: progressKey })),
      },
      {
        text: t('photo.fromLibrary'),
        onPress: () =>
          void addPhoto('library').then(() => qc.invalidateQueries({ queryKey: progressKey })),
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <ScrollView contentContainerClassName="gap-4 px-5 pb-12 pt-2">
        <Text variant="title" accessibilityRole="header">
          {t('tabs.progress')}
        </Text>

        {insights.length > 0 && (
          <View className="gap-2">
            {insights.map((i) => (
              <Card key={i.key} className="flex-row items-center gap-3">
                <Ionicons
                  name={i.tone === 'positive' ? 'sparkles' : 'bulb-outline'}
                  size={22}
                  color={color(i.tone === 'positive' ? 'brand' : 'carbs')}
                />
                <Text className="flex-1 text-text">{t(`insights.${i.key}`, i.params)}</Text>
              </Card>
            ))}
          </View>
        )}

        <Card className="gap-3">
          <View className="flex-row items-end justify-between">
            <View>
              <Text variant="label">{t('progress.weight')}</Text>
              {latest ? (
                <Text className="text-3xl font-bold text-text">
                  {formatDecimal(latest.trendKg)} kg
                </Text>
              ) : (
                <Text variant="caption">{t('home.noWeight')}</Text>
              )}
            </View>
            {latest && rangeStart && rangeStart.date !== latest.date && (
              <Text variant="caption">
                {t('progress.change', {
                  kg: `${latest.trendKg - rangeStart.trendKg > 0 ? '+' : ''}${formatDecimal(latest.trendKg - rangeStart.trendKg)}`,
                })}
              </Text>
            )}
          </View>
          <Chips<WeightRange>
            accessibilityLabel={t('progress.range')}
            value={weightRange}
            onChange={setWeightRange}
            options={[
              { value: 30, label: t('progress.ranges.1m') },
              { value: 90, label: t('progress.ranges.3m') },
              { value: 180, label: t('progress.ranges.6m') },
              { value: 365, label: t('progress.ranges.1y') },
              { value: 0, label: t('progress.ranges.all') },
            ]}
          />
          {trend.length >= 2 ? (
            <WeightChart
              points={trend}
              targetKg={relaxed ? null : (data.profile?.targetWeightKg ?? null)}
            />
          ) : (
            <Text variant="caption">{t('progress.weightEmpty')}</Text>
          )}
          <Button
            variant="secondary"
            label={t('home.logWeight')}
            onPress={() => router.push('/log-weight')}
          />
        </Card>

        <Chips<Range>
          accessibilityLabel={t('progress.range')}
          value={range}
          onChange={setRange}
          options={[
            { value: 7, label: t('progress.ranges.7d') },
            { value: 30, label: t('progress.ranges.30d') },
            { value: 90, label: t('progress.ranges.90d') },
          ]}
        />

        {stats.loggedDays === 0 ? (
          <EmptyState
            icon="stats-chart-outline"
            title={t('progress.empty')}
            message={t('progress.emptyHint')}
          />
        ) : (
          <>
            {!relaxed && (
              <Card className="gap-3">
                <Text variant="label">{t('progress.calories')}</Text>
                <View className="flex-row justify-between">
                  <Stat label={t('progress.avgKcal')} value={formatInt(stats.avg.kcal)} />
                  <Stat
                    label={t('progress.onTarget')}
                    value={
                      stats.adherencePct === null
                        ? '–'
                        : `${Math.round(stats.adherencePct * 100)} %`
                    }
                  />
                  <Stat
                    label={t('progress.streak')}
                    value={t('progress.days', { count: stats.streak })}
                  />
                </View>
                <CalorieBars
                  days={data.series.map((d) => ({ date: d.date, kcal: d.kcal }))}
                  target={goal?.kcal ?? null}
                />
              </Card>
            )}

            {stats.macroPct && (
              <Card className="gap-3">
                <Text variant="label">{t('progress.macros')}</Text>
                <MacroSplit
                  pct={stats.macroPct}
                  grams={{ protein: stats.avg.protein, carbs: stats.avg.carbs, fat: stats.avg.fat }}
                />
                {!relaxed && goal && (
                  <Text variant="caption">
                    {t('progress.proteinHit', {
                      pct: Math.round((stats.proteinHitPct ?? 0) * 100),
                      target: formatInt(goal.protein),
                    })}
                  </Text>
                )}
              </Card>
            )}

            <Card className="gap-1">
              <Text variant="label" className="mb-1">
                {t('progress.micros')}
              </Text>
              {(
                [
                  ['fiber', stats.avg.fiber, 'g'],
                  ['sugar', stats.avg.sugar, 'g'],
                  ['saturatedFat', stats.avg.saturatedFat, 'g'],
                  ['salt', stats.avg.salt, 'g'],
                ] as const
              )
                .filter(([, v]) => v !== undefined)
                .map(([k, v, unit]) => (
                  <MicroRow
                    key={k}
                    label={t(`food.${k}`)}
                    value={`${formatDecimal(v!, 1)} ${unit}`}
                  />
                ))}
              {Object.entries(stats.microsAvg).map(([k, v]) => (
                <MicroRow
                  key={k}
                  label={t(`micros.${k.replace(/(Mg|Ug)$/, '')}`)}
                  value={`${formatDecimal(v, 1)} ${MICRO_UNITS[k] ?? ''}`}
                />
              ))}
              <Text variant="caption" className="mt-1">
                {t('progress.microsHint')}
              </Text>
            </Card>
          </>
        )}

        <Card className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text variant="label">{t('progress.measurements')}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/measurements')}
              hitSlop={8}
            >
              <Text className="font-semibold text-brand">{t('progress.addMeasurement')}</Text>
            </Pressable>
          </View>
          {data.measurements.length === 0 ? (
            <Text variant="caption">{t('progress.noMeasurements')}</Text>
          ) : (
            (() => {
              const m = data.measurements.at(-1)!;
              return (
                <View className="flex-row flex-wrap gap-x-5 gap-y-1">
                  <Text variant="caption">
                    {formatDate(isoToDate(m.date), {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </Text>
                  {(['waistCm', 'hipCm', 'chestCm', 'armCm', 'thighCm'] as const)
                    .filter((k) => m[k] !== null)
                    .map((k) => (
                      <Text key={k} className="text-text">
                        {t(`measurements.${k}`)} {formatDecimal(m[k]!)} cm
                      </Text>
                    ))}
                </View>
              );
            })()
          )}
        </Card>

        <Card className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text variant="label">{t('progress.photos')}</Text>
            <Pressable accessibilityRole="button" onPress={onAddPhoto} hitSlop={8}>
              <Text className="font-semibold text-brand">{t('progress.addPhoto')}</Text>
            </Pressable>
          </View>
          {data.photos.length === 0 ? (
            <Text variant="caption">{t('progress.photosPrivate')}</Text>
          ) : (
            <View className="flex-row flex-wrap gap-2">
              {data.photos.map((p) => (
                <Pressable
                  key={p.id}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={t('progress.photoOf', {
                    date: formatDate(isoToDate(p.date), {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    }),
                  })}
                  onLongPress={() =>
                    Alert.alert(t('progress.deletePhoto'), undefined, [
                      { text: t('common.cancel'), style: 'cancel' },
                      {
                        text: t('common.delete'),
                        style: 'destructive',
                        onPress: () => (
                          removePhoto(p),
                          void qc.invalidateQueries({ queryKey: progressKey })
                        ),
                      },
                    ])
                  }
                >
                  <Image
                    source={{ uri: p.uri }}
                    style={{ width: 96, height: 128, borderRadius: 12 }}
                    contentFit="cover"
                    accessibilityIgnoresInvertColors
                  />
                  <Text variant="caption" className="mt-0.5 text-center">
                    {formatDate(isoToDate(p.date), { day: '2-digit', month: '2-digit' })}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </Card>

        <Card className="gap-2">
          <Text variant="label">{t('progress.export')}</Text>
          <Text variant="caption">{t('progress.exportHint')}</Text>
          <View className="flex-row gap-3">
            <Button
              variant="secondary"
              label={t('progress.exportDiary')}
              onPress={() => onExport('diary')}
              className="flex-1"
            />
            <Button
              variant="secondary"
              label={t('progress.exportWeights')}
              onPress={() => onExport('weights')}
              className="flex-1"
            />
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text className="text-xl font-bold text-text" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
      <Text variant="caption">{label}</Text>
    </View>
  );
}

function MicroRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between border-b border-border py-1.5">
      <Text className="text-text">{label}</Text>
      <Text className="text-text" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </View>
  );
}
