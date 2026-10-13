import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, Text } from '@/ui';

export default function DiaryScreen() {
  const { t } = useTranslation();
  return (
    <SafeAreaView className="flex-1 bg-bg px-5" edges={['top']}>
      <Text variant="title" className="mt-4">
        {t('tabs.diary')}
      </Text>
      <EmptyState icon="construct-outline" title={t('tabs.diary')} message={t('comingSoon')} />
    </SafeAreaView>
  );
}
