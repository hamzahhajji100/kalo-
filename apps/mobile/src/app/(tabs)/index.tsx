import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, Text } from '@/ui';

export default function TodayScreen() {
  const { t } = useTranslation();
  return (
    <SafeAreaView className="flex-1 bg-bg px-5" edges={['top']}>
      <Text variant="title" className="mt-4">
        {t('tabs.today')}
      </Text>
      <EmptyState icon="construct-outline" title={t('tabs.today')} message={t('comingSoon')} />
    </SafeAreaView>
  );
}
