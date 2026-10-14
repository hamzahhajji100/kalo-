import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Linking, View } from 'react-native';

import { usePreferences } from '@/lib/preferences';
import { useTheme } from '@/theme/ThemeProvider';
import { Button, Card, Text } from '@/ui';
import { useProgress } from './queries';

/** BZgA information and counselling on eating disorders (Germany). */
export const EATING_DISORDER_HELP_URL = 'https://www.bzga-essstoerungen.de';

/** Supportive message when several recent days had very little food. Shown on Home, never with numbers. */
export function CareCard() {
  const { t } = useTranslation();
  const { color } = useTheme();
  const { relaxedMode, set } = usePreferences();
  const { data } = useProgress(7, 30);
  if (!data?.insights.some((i) => i.tone === 'care')) return null;
  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-2">
        <Ionicons name="heart-outline" size={22} color={color('brand')} />
        <Text variant="heading">{t('care.title')}</Text>
      </View>
      <Text>{t('care.body')}</Text>
      {!relaxedMode && (
        <Button
          variant="secondary"
          label={t('care.relaxed')}
          onPress={() => set({ relaxedMode: true })}
        />
      )}
      <Button
        variant="ghost"
        label={t('care.help')}
        onPress={() => void Linking.openURL(EATING_DISORDER_HELP_URL)}
      />
    </Card>
  );
}
