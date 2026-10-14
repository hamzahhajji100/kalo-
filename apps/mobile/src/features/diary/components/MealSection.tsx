import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { copyEntries, type DiaryEntry } from '@/data/repositories/diary';
import { saveTemplateFromMeal } from '@/data/repositories/templates';
import { shiftIsoDate } from '@/lib/date';
import type { MealType } from '@/data/repositories/mealTypes';
import { formatInt } from '@/lib/format';
import { usePreferences } from '@/lib/preferences';
import { useTheme } from '@/theme/ThemeProvider';
import { Card, Text } from '@/ui';
import { keys, useDbMutation } from '../queries';

/** A user-given name wins over the translated default name. */
export function mealName(meal: MealType, t: (k: string) => string): string {
  return meal.name ?? (meal.key ? t(`meals.${meal.key}`) : '');
}

export function MealSection({
  meal,
  entries,
  date,
}: {
  meal: MealType;
  entries: DiaryEntry[];
  date: string;
}) {
  const { t } = useTranslation();
  const { color } = useTheme();
  const relaxed = usePreferences((s) => s.relaxedMode);
  const kcal = entries.reduce((s, e) => s + e.kcal, 0);
  const name = mealName(meal, t);
  const copyYesterday = useDbMutation(
    (db, _: void) =>
      copyEntries(db, { fromDate: shiftIsoDate(date, -1), toDate: date, mealTypeId: meal.id }),
    () => [keys.day(date), keys.recent],
  );
  const saveTemplate = useDbMutation(
    (db, _: void) =>
      saveTemplateFromMeal(db, { name: `${name} (${date})`, date, mealTypeId: meal.id }),
    () => [['templates']],
  );

  const openMenu = () =>
    Alert.alert(name, undefined, [
      { text: t('diary.copyMealYesterday'), onPress: () => copyYesterday.mutate() },
      ...(entries.length > 0
        ? [
            {
              text: t('diary.saveTemplate'),
              onPress: () =>
                saveTemplate.mutate(undefined, {
                  onSuccess: () => Alert.alert(t('diary.templateSaved')),
                }),
            },
          ]
        : []),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);

  return (
    <Card className="gap-1 py-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text variant="heading">{name}</Text>
          {!relaxed && entries.length > 0 && <Text variant="caption">{formatInt(kcal)} kcal</Text>}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('diary.mealMenu', { meal: name })}
          hitSlop={8}
          onPress={openMenu}
          className="mr-2 h-10 w-10 items-center justify-center rounded-full active:bg-surface-2"
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={color('muted')} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('diary.addTo', { meal: name })}
          hitSlop={8}
          onPress={() => router.push({ pathname: '/add', params: { date, meal: String(meal.id) } })}
          className="h-10 w-10 items-center justify-center rounded-full bg-brand-soft active:opacity-70"
        >
          <Ionicons name="add" size={22} color={color('brand')} />
        </Pressable>
      </View>
      {entries.length === 0 ? (
        <Text variant="caption" className="py-1">
          {t('diary.emptyMeal')}
        </Text>
      ) : (
        entries.map((e) => (
          <Animated.View
            key={e.id}
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            layout={LinearTransition}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${e.name}, ${e.amountLabel ?? (e.grams ? `${formatInt(e.grams)} g` : '')}, ${formatInt(e.kcal)} kcal`}
              accessibilityHint={t('diary.editHint')}
              onPress={() => router.push({ pathname: '/entry/[id]', params: { id: e.id } })}
              className="flex-row items-center gap-3 border-t border-border py-2.5 active:opacity-70"
            >
              <View className="flex-1">
                <Text numberOfLines={1}>{e.name}</Text>
                <Text variant="caption" numberOfLines={1}>
                  {[e.brand, e.amountLabel ?? (e.grams ? `${formatInt(e.grams)} g` : null)]
                    .filter(Boolean)
                    .join(' · ') || t(`diary.source.${e.source}`)}
                </Text>
              </View>
              {!relaxed && (
                <Text className="font-semibold text-text" style={{ fontVariant: ['tabular-nums'] }}>
                  {formatInt(e.kcal)}
                </Text>
              )}
            </Pressable>
          </Animated.View>
        ))
      )}
    </Card>
  );
}
