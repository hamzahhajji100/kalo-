import type { PlanResult } from '@kalo/core';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { formatDecimal, formatInt } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { Card, Text } from '@/ui';

/** Calories, macros and expected weekly change for a plan – or the reason no plan is offered. */
export function PlanPreview({ result, compact }: { result: PlanResult; compact?: boolean }) {
  const { t } = useTranslation();
  const { color } = useTheme();
  if (!result.ok) {
    return (
      <Card className="gap-2">
        <Text variant="heading">{t(`coach.block.${result.block}.title`)}</Text>
        <Text>
          {t(`coach.block.${result.block}.body`, { kg: formatDecimal(result.minHealthyWeightKg) })}
        </Text>
      </Card>
    );
  }
  const { plan } = result;
  if (compact) {
    return (
      <Text variant="caption" className="text-center" accessibilityLiveRegion="polite">
        {t('coach.previewLine', {
          kcal: formatInt(plan.kcal),
          protein: formatInt(plan.macros.proteinG),
        })}
      </Text>
    );
  }
  return (
    <Card className="gap-4">
      <View className="items-center">
        <Text className="text-5xl font-bold text-text" style={{ fontVariant: ['tabular-nums'] }}>
          {formatInt(plan.kcal)}
        </Text>
        <Text variant="caption">{t('coach.kcalPerDay')}</Text>
      </View>
      <View className="flex-row justify-around">
        {(
          [
            ['protein', plan.macros.proteinG],
            ['carbs', plan.macros.carbsG],
            ['fat', plan.macros.fatG],
          ] as const
        ).map(([k, v]) => (
          <View key={k} className="items-center">
            <Text className="text-xl font-bold" style={{ color: color(k) }}>
              {formatInt(v)} g
            </Text>
            <Text variant="caption">{t(`macros.${k}`)}</Text>
          </View>
        ))}
      </View>
      <Text variant="caption" className="text-center">
        {t('coach.planDetails', {
          bmr: formatInt(plan.bmr.kcal),
          tdee: formatInt(plan.tdee),
          water: formatDecimal(plan.waterMl / 1000, 1),
        })}
      </Text>
      {plan.weeklyChangeKg !== 0 && (
        <Text className="text-center text-text">
          {t(plan.weeklyChangeKg < 0 ? 'coach.weeklyLoss' : 'coach.weeklyGain', {
            kg: formatDecimal(Math.abs(plan.weeklyChangeKg), 2),
          })}
        </Text>
      )}
      {plan.clampedToMinimum && (
        <Text className="text-center text-warning">{t('coach.clamped')}</Text>
      )}
    </Card>
  );
}
