import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Chips, Text } from '@/ui';
import { useMealTypes } from '../queries';
import { mealName } from './MealSection';

export function MealPicker({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (id: number) => void;
}) {
  const { t } = useTranslation();
  const { data: meals = [] } = useMealTypes();
  return (
    <View className="gap-1.5">
      <Text variant="label">{t('diary.meal')}</Text>
      <Chips
        accessibilityLabel={t('diary.meal')}
        value={value}
        onChange={onChange}
        options={meals.map((m) => ({ value: m.id, label: mealName(m, t) }))}
      />
    </View>
  );
}
