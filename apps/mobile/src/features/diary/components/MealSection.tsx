import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import type { DiaryEntry } from '@/data/repositories/diary';
import type { MealType } from '@/data/repositories/mealTypes';
import { formatInt } from '@/lib/format';
import { usePreferences } from '@/lib/preferences';
import { useTheme } from '@/theme/ThemeProvider';
import { Card, Text } from '@/ui';

export function mealName(meal: MealType, t: (k: string) => string): string {
  return meal.key ? t(`meals.${meal.key}`) : (meal.name ?? '');
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

  return (
    <Card className="gap-1 py-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text variant="heading">{name}</Text>
          {!relaxed && entries.length > 0 && <Text variant="caption">{formatInt(kcal)} kcal</Text>}
        </View>
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
          <Pressable
            key={e.id}
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
        ))
      )}
    </Card>
  );
}
