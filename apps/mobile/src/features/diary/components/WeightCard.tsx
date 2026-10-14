import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useWeightUnit } from '@/lib/units';
import { useTheme } from '@/theme/ThemeProvider';
import { Card, Text } from '@/ui';
import { useLatestWeight } from '../queries';

export function WeightCard({ today }: { today: string }) {
  const { t } = useTranslation();
  const { color } = useTheme();
  const { data: latest } = useLatestWeight();
  const units = useWeightUnit();
  const loggedToday = latest?.date === today;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        latest ? t('home.weightA11y', { weight: units.format(latest.kg) }) : t('home.logWeight')
      }
      onPress={() => router.push('/log-weight')}
      className="active:opacity-80"
    >
      <Card className="flex-row items-center gap-3">
        <Ionicons name="scale-outline" size={22} color={color('brand')} />
        <View className="flex-1">
          <Text variant="heading">{t('home.weight')}</Text>
          <Text variant="caption">
            {latest
              ? `${units.format(latest.kg)}${loggedToday ? ` · ${t('home.today')}` : ''}`
              : t('home.noWeight')}
          </Text>
        </View>
        {!loggedToday && <Text className="font-semibold text-brand">{t('home.logWeight')}</Text>}
      </Card>
    </Pressable>
  );
}
