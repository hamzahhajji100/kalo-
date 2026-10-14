import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { formatInt } from '@/lib/format';
import { usePreferences } from '@/lib/preferences';
import { useTheme } from '@/theme/ThemeProvider';
import { Card, ProgressBar, ProgressRing, Text } from '@/ui';
import type { DaySummary } from '../summary';

const MACROS = [
  { key: 'protein', color: 'protein' },
  { key: 'carbs', color: 'carbs' },
  { key: 'fat', color: 'fat' },
] as const;

/** Ring with remaining calories plus macro bars. In relaxed mode numbers give way to a gentle message. */
export function DaySummaryCard({ summary }: { summary: DaySummary }) {
  const { t } = useTranslation();
  const { color } = useTheme();
  const relaxed = usePreferences((s) => s.relaxedMode);
  const { kcal, protein } = summary;

  const ringLabel = kcal.over
    ? t('home.overBy', { kcal: formatInt(kcal.eaten - kcal.target) })
    : t('home.remainingA11y', {
        kcal: formatInt(kcal.remaining),
        protein: formatInt(protein.remaining),
      });

  return (
    <Card className="items-center gap-5 py-6">
      <ProgressRing
        size={208}
        stroke={16}
        fraction={kcal.fraction}
        color={color(kcal.over ? 'warning' : 'brand')}
        trackColor={color('surface-2')}
        accessibilityLabel={relaxed ? t('home.relaxedRing') : ringLabel}
      >
        {relaxed ? (
          <Text variant="heading" className="px-10 text-center">
            {t('home.relaxedRing')}
          </Text>
        ) : (
          <View className="items-center">
            <Text
              className="text-5xl font-bold text-text"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {formatInt(kcal.over ? kcal.eaten - kcal.target : kcal.remaining)}
            </Text>
            <Text variant="caption">{kcal.over ? t('home.kcalOver') : t('home.kcalLeft')}</Text>
          </View>
        )}
      </ProgressRing>

      {!relaxed && (
        <Text variant="body" className="text-center">
          {kcal.over
            ? t('home.overBy', { kcal: formatInt(kcal.eaten - kcal.target) })
            : t('home.youMayEat', {
                kcal: formatInt(kcal.remaining),
                protein: formatInt(protein.remaining),
              })}
        </Text>
      )}

      <View className="w-full flex-row gap-4">
        {MACROS.map((m) => {
          const p = summary[m.key];
          return (
            <View
              key={m.key}
              className="flex-1 gap-1.5"
              accessible
              accessibilityLabel={`${t(`macros.${m.key}`)}: ${formatInt(p.eaten)} ${t('common.of')} ${formatInt(p.target)} ${t('common.g')}`}
            >
              <Text variant="caption" numberOfLines={1}>
                {t(`macros.${m.key}`)}
              </Text>
              <ProgressBar fraction={p.fraction} color={color(m.color)} />
              {!relaxed && (
                <Text
                  className="text-sm font-semibold text-text"
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {formatInt(p.eaten)}
                  <Text variant="caption"> / {formatInt(p.target)} g</Text>
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </Card>
  );
}
