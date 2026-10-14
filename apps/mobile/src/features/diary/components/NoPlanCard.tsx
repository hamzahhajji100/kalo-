import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { formatInt } from '@/lib/format';
import { Button, Card, Text } from '@/ui';

/** Shown until the user has a plan: today's total without targets. */
export function NoPlanCard({ kcal }: { kcal: number }) {
  const { t } = useTranslation();
  return (
    <Card className="gap-2">
      <Text variant="heading">{t('home.noPlanTitle')}</Text>
      <Text variant="caption">{t('home.noPlanBody')}</Text>
      <Text className="mt-2 text-3xl font-bold text-text">
        {t('home.eatenToday', { kcal: formatInt(kcal) })}
      </Text>
      <Button
        variant="secondary"
        label={t('profile.create')}
        onPress={() => router.push({ pathname: '/onboarding', params: { edit: '1' } })}
        className="mt-2"
      />
    </Card>
  );
}
