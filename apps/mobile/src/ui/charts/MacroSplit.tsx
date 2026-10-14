import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '../Text';

const KEYS = ['protein', 'carbs', 'fat'] as const;

/**
 * Energy share of protein, carbs and fat as one 100 % bar with 2 px gaps. Every segment is
 * labelled in text next to its colour, so identity never relies on colour alone.
 */
export function MacroSplit({
  pct,
  grams,
}: {
  pct: Record<(typeof KEYS)[number], number>;
  grams: Record<(typeof KEYS)[number], number>;
}) {
  const { t } = useTranslation();
  const { color } = useTheme();
  return (
    <View
      className="gap-3"
      accessible
      accessibilityLabel={KEYS.map((k) => `${t(`macros.${k}`)} ${Math.round(pct[k] * 100)} %`).join(
        ', ',
      )}
    >
      <View className="h-3 flex-row overflow-hidden rounded-pill" style={{ gap: 2 }}>
        {KEYS.map((k) => (
          <View key={k} style={{ flex: Math.max(pct[k], 0.001), backgroundColor: color(k) }} />
        ))}
      </View>
      <View className="flex-row justify-between">
        {KEYS.map((k) => (
          <View key={k} className="gap-0.5">
            <View className="flex-row items-center gap-1.5">
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color(k) }} />
              <Text variant="caption">{t(`macros.${k}`)}</Text>
            </View>
            <Text className="font-semibold text-text">
              {Math.round(pct[k] * 100)} % · {Math.round(grams[k])} g
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
