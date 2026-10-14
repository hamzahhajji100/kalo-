import { Ionicons } from '@expo/vector-icons';
import type { Food } from '@kalo/schemas';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { formatInt } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/ui';

export function FoodRow({
  food,
  onPress,
  subtitle,
}: {
  food: Food;
  onPress: () => void;
  subtitle?: string;
}) {
  const { t } = useTranslation();
  const { color } = useTheme();
  const unit = food.isLiquid ? '100 ml' : '100 g';
  const detail =
    subtitle ??
    [food.brand, `${formatInt(food.per100g.kcal)} kcal / ${unit}`].filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${food.name}${food.brand ? `, ${food.brand}` : ''}, ${formatInt(food.per100g.kcal)} ${t('food.kcalPer', { unit })}`}
      onPress={onPress}
      className="min-h-[60px] flex-row items-center gap-3 border-b border-border py-2.5 active:opacity-70"
    >
      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text numberOfLines={1} className="shrink font-medium text-text">
            {food.name}
          </Text>
          {food.verified && (
            <Ionicons
              name="checkmark-circle"
              size={14}
              color={color('brand')}
              accessibilityLabel={t('food.verified')}
            />
          )}
        </View>
        <Text variant="caption" numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={color('muted')} />
    </Pressable>
  );
}
