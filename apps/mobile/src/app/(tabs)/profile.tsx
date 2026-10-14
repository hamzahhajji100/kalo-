import { ageOn } from '@kalo/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { db } from '@/data/client';
import { latestWeight } from '@/data/repositories/body';
import { getProfile, listGoals } from '@/data/repositories/profile';
import { SettingsSection } from '@/features/settings/SettingsSection';
import { isoToDate, localIsoDate } from '@/lib/date';
import { formatDate, formatDecimal, formatInt } from '@/lib/format';
import { usePreferences } from '@/lib/preferences';
import { Button, Card, Text } from '@/ui';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const relaxed = usePreferences((s) => s.relaxedMode);
  const { data } = useQuery({
    queryKey: ['profile', 'overview'],
    queryFn: () => ({
      profile: getProfile(db) ?? null,
      goals: listGoals(db),
      weight: latestWeight(db) ?? null,
    }),
  });
  const profile = data?.profile;
  const goal = data?.goals[0];

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <ScrollView contentContainerClassName="gap-4 px-5 pb-12 pt-2">
        <Text variant="title" accessibilityRole="header">
          {t('tabs.profile')}
        </Text>

        {profile && (
          <Card className="gap-1">
            <Text variant="heading">{t(`onboarding.goals.${profile.goal}.title`)}</Text>
            <Text variant="caption">
              {[
                t(profile.sex === 'female' ? 'onboarding.female' : 'onboarding.male'),
                `${ageOn(profile.birthDate, localIsoDate())} ${t('onboarding.years')}`,
                `${formatInt(profile.heightCm)} cm`,
                data?.weight ? `${formatDecimal(data.weight.kg)} kg` : null,
                profile.targetWeightKg
                  ? `${t('profile.target')} ${formatDecimal(profile.targetWeightKg)} kg`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            <Text variant="caption">
              {t(`onboarding.activity.${profile.activity}.title`)} ·{' '}
              {t('profile.trainingDays', { count: profile.trainingDaysPerWeek })} ·{' '}
              {t(`onboarding.diets.${profile.diet}`)}
            </Text>
          </Card>
        )}

        {goal && !relaxed && (
          <Card className="gap-2">
            <Text variant="label">{t('profile.currentPlan')}</Text>
            <Text className="text-3xl font-bold text-text">{formatInt(goal.kcal)} kcal</Text>
            <Text>
              {t('recipes.nutritionLine', {
                kcal: formatInt(goal.kcal),
                protein: formatInt(goal.protein),
                carbs: formatInt(goal.carbs),
                fat: formatInt(goal.fat),
              })}
            </Text>
            <Text variant="caption">{t('profile.tdee', { kcal: formatInt(goal.tdee) })}</Text>
          </Card>
        )}

        <Button
          variant="secondary"
          label={profile ? t('profile.edit') : t('profile.create')}
          onPress={() =>
            router.push({ pathname: '/onboarding', params: { edit: profile ? '1' : '0' } })
          }
        />

        {!relaxed && data && data.goals.length > 1 && (
          <View className="gap-1">
            <Text variant="label">{t('profile.history')}</Text>
            {data.goals.slice(0, 8).map((g) => (
              <View key={g.id} className="flex-row justify-between border-b border-border py-2">
                <Text variant="caption">
                  {formatDate(isoToDate(g.validFrom), {
                    day: '2-digit',
                    month: '2-digit',
                    year: '2-digit',
                  })}
                </Text>
                <Text className="flex-1 px-3 text-text" numberOfLines={1}>
                  {t(`profile.reasons.${g.reason}`)}
                </Text>
                <Text className="font-semibold text-text">{formatInt(g.kcal)} kcal</Text>
              </View>
            ))}
          </View>
        )}

        <SettingsSection />
      </ScrollView>
    </SafeAreaView>
  );
}
