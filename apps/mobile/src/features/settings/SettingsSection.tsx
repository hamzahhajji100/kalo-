import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import Storage from 'expo-sqlite/kv-store';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, Pressable, Switch, View } from 'react-native';

import { db } from '@/data/client';
import { wipeUserData } from '@/data/repositories/wipe';
import { EATING_DISORDER_HELP_URL } from '@/features/progress/CareCard';
import { deleteAllPhotoFiles } from '@/features/progress/progressPhotos';
import { clearApiToken } from '@/lib/api';
import { usePreferences } from '@/lib/preferences';
import { queryClient } from '@/lib/queryClient';
import { useTheme } from '@/theme/ThemeProvider';
import { Card, Chips, Text } from '@/ui';

function Row({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const { color } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-[52px] flex-row items-center gap-3 border-b border-border active:opacity-70"
    >
      <Ionicons name={icon} size={20} color={color(danger ? 'danger' : 'text')} />
      <Text className={`flex-1 ${danger ? 'text-danger' : 'text-text'}`}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={color('muted')} />
    </Pressable>
  );
}

/** Delete diary, profile, foods, photos and preferences. The app starts over with onboarding. */
function deleteEverything() {
  wipeUserData(db);
  deleteAllPhotoFiles();
  clearApiToken();
  for (const key of ['kalo.deviceId', 'kalo.catalogAssetHash']) Storage.removeItemSync(key);
  usePreferences.getState().set({
    hasOnboarded: false,
    relaxedMode: false,
    theme: 'system',
    language: 'system',
    units: 'metric',
  });
  queryClient.clear();
  router.replace('/onboarding');
}

export function SettingsSection() {
  const { t } = useTranslation();
  const { color } = useTheme();
  const prefs = usePreferences();

  const confirmDelete = () =>
    Alert.alert(t('settings.deleteTitle'), t('settings.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.deleteConfirm'),
        style: 'destructive',
        onPress: () =>
          Alert.alert(t('settings.deleteReallyTitle'), undefined, [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('settings.deleteConfirm'), style: 'destructive', onPress: deleteEverything },
          ]),
      },
    ]);

  return (
    <View className="gap-4">
      <Text variant="title" accessibilityRole="header" className="mt-4">
        {t('settings.title')}
      </Text>

      <Card className="gap-3">
        <Text variant="label">{t('settings.appearance')}</Text>
        <Chips
          accessibilityLabel={t('settings.theme')}
          value={prefs.theme}
          onChange={(theme) => prefs.set({ theme })}
          options={[
            { value: 'system', label: t('settings.system') },
            { value: 'light', label: t('settings.light') },
            { value: 'dark', label: t('settings.dark') },
          ]}
        />
        <Text variant="label">{t('settings.language')}</Text>
        <Chips
          accessibilityLabel={t('settings.language')}
          value={prefs.language}
          onChange={(language) => prefs.set({ language })}
          options={[
            { value: 'system', label: t('settings.system') },
            { value: 'de', label: 'Deutsch' },
            { value: 'en', label: 'English' },
          ]}
        />
        <Text variant="label">{t('settings.units')}</Text>
        <Chips
          accessibilityLabel={t('settings.units')}
          value={prefs.units}
          onChange={(units) => prefs.set({ units })}
          options={[
            { value: 'metric', label: t('settings.metric') },
            { value: 'imperial', label: t('settings.imperial') },
          ]}
        />
      </Card>

      <Card className="gap-2">
        <View className="flex-row items-center gap-3">
          <View className="flex-1">
            <Text className="font-semibold text-text">{t('settings.relaxed')}</Text>
            <Text variant="caption">{t('settings.relaxedHint')}</Text>
          </View>
          <Switch
            accessibilityLabel={t('settings.relaxed')}
            value={prefs.relaxedMode}
            onValueChange={(relaxedMode) => prefs.set({ relaxedMode })}
            trackColor={{ true: color('brand') }}
          />
        </View>
      </Card>

      <Card className="py-1">
        <Row
          icon="restaurant-outline"
          label={t('settings.mealTypes')}
          onPress={() => router.push('/meal-types')}
        />
        <Row
          icon="book-outline"
          label={t('recipes.title')}
          onPress={() => router.push('/recipes')}
        />
        <Row
          icon="document-text-outline"
          label={t('settings.licenses')}
          onPress={() => router.push('/licenses')}
        />
        <Row
          icon="heart-outline"
          label={t('care.help')}
          onPress={() => void Linking.openURL(EATING_DISORDER_HELP_URL)}
        />
      </Card>

      <Card className="gap-2">
        <Text variant="label">{t('settings.privacy')}</Text>
        <Text variant="caption">{t('settings.privacyBody')}</Text>
        <Row icon="trash-outline" label={t('settings.deleteAll')} onPress={confirmDelete} danger />
      </Card>

      <Text variant="caption" className="text-center">
        {t('settings.disclaimer')}
      </Text>
      <Text variant="caption" className="text-center">
        Kalo {Constants.expoConfig?.version ?? ''}
      </Text>
    </View>
  );
}
