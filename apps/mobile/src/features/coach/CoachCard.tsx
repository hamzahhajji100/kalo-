import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { isoToDate } from '@/lib/date';
import { formatDate, formatDecimal } from '@/lib/format';
import { usePreferences } from '@/lib/preferences';
import { useTheme } from '@/theme/ThemeProvider';
import { Card, Text } from '@/ui';
import { useCoachStatus } from './queries';

export function CoachCard() {
  const { t } = useTranslation();
  const { color } = useTheme();
  const relaxed = usePreferences((s) => s.relaxedMode);
  const { data } = useCoachStatus();
  if (!data?.goal) return null;

  return (
    <View className="gap-3">
      {data.checkInDue && (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/check-in')}
          className="active:opacity-80"
        >
          <Card className="flex-row items-center gap-3 bg-brand-soft">
            <Ionicons name="pulse-outline" size={24} color={color('brand')} />
            <View className="flex-1">
              <Text variant="heading">{t('coach.checkInReady')}</Text>
              <Text variant="caption">{t('coach.checkInReadyHint')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={color('brand')} />
          </Card>
        </Pressable>
      )}
      {!relaxed && data.forecast?.date && data.profile?.targetWeightKg && (
        <Card className="gap-1">
          <Text variant="label">{t('coach.forecastTitle')}</Text>
          <Text>
            {t('coach.forecast', {
              date: formatDate(isoToDate(data.forecast.date), {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              }),
              target: formatDecimal(data.profile.targetWeightKg),
            })}
          </Text>
          <Text variant="caption">
            {t(data.forecast.basedOn === 'trend' ? 'coach.forecastTrend' : 'coach.forecastPlan', {
              kg: formatDecimal(Math.abs(data.forecast.weeklyKg), 2),
            })}
          </Text>
        </Card>
      )}
    </View>
  );
}
