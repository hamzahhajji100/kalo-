import type { Food } from '@kalo/schemas';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { formatDecimal } from '@/lib/format';
import { Text } from '@/ui';

type Row = [label: string, value: number | undefined, unit: string, indent?: boolean];

/** Per-100 g nutrition facts as on an EU label, plus micronutrients when known. */
export function NutritionTable({ food }: { food: Food }) {
  const { t } = useTranslation();
  const n = food.per100g;
  const m = food.micros ?? {};
  const rows: Row[] = [
    [t('food.energy'), n.kcal, 'kcal'],
    [t('macros.fat'), n.fat, 'g'],
    [t('food.saturatedFat'), n.saturatedFat, 'g', true],
    [t('macros.carbs'), n.carbs, 'g'],
    [t('food.sugar'), n.sugar, 'g', true],
    [t('food.fiber'), n.fiber, 'g'],
    [t('macros.protein'), n.protein, 'g'],
    [t('food.salt'), n.salt, 'g'],
    [t('micros.calcium'), m.calciumMg, 'mg'],
    [t('micros.iron'), m.ironMg, 'mg'],
    [t('micros.magnesium'), m.magnesiumMg, 'mg'],
    [t('micros.potassium'), m.potassiumMg, 'mg'],
    [t('micros.zinc'), m.zincMg, 'mg'],
    [t('micros.vitaminC'), m.vitaminCMg, 'mg'],
    [t('micros.vitaminD'), m.vitaminDUg, 'µg'],
    [t('micros.vitaminB12'), m.vitaminB12Ug, 'µg'],
  ];
  return (
    <View accessibilityRole="summary">
      <Text variant="label" className="mb-1">
        {t('food.per100', { unit: food.isLiquid ? '100 ml' : '100 g' })}
      </Text>
      {rows
        .filter(([, v]) => v !== undefined)
        .map(([label, v, unit, indent]) => (
          <View key={label} className="flex-row justify-between border-b border-border py-2">
            <Text className={indent ? 'pl-4 text-muted' : 'text-text'}>{label}</Text>
            <Text className="text-text" style={{ fontVariant: ['tabular-nums'] }}>
              {formatDecimal(v!, unit === 'kcal' ? 0 : 1)} {unit}
            </Text>
          </View>
        ))}
    </View>
  );
}
