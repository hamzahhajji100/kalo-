import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/ui';

type OptionKey = 'photo' | 'barcode' | 'search' | 'quick' | 'recipe';
type Option = {
  key: OptionKey;
  icon: ComponentProps<typeof Ionicons>['name'];
  pathname?: Href & string;
};

// Options without a pathname are built in later milestones and shown as "coming soon".
const OPTIONS: Option[] = [
  { key: 'photo', icon: 'camera' },
  { key: 'barcode', icon: 'barcode-outline' },
  { key: 'search', icon: 'search', pathname: '/add/search' },
  { key: 'quick', icon: 'flash-outline', pathname: '/add/quick' },
  { key: 'recipe', icon: 'restaurant-outline', pathname: '/recipes' },
];

export default function AddSheet() {
  const { t } = useTranslation();
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  // Forward date/meal from a meal's "+" button to the chosen flow.
  const params = useLocalSearchParams<{ date?: string; meal?: string }>();

  return (
    <View className="bg-surface px-5 pt-6" style={{ paddingBottom: insets.bottom + 16 }}>
      <Text variant="title" className="mb-4" accessibilityRole="header">
        {t('add.title')}
      </Text>
      <View className="flex-row flex-wrap gap-3">
        {OPTIONS.map((o, i) => {
          const enabled = !!o.pathname;
          return (
            <Pressable
              key={o.key}
              accessibilityRole="button"
              accessibilityState={{ disabled: !enabled }}
              accessibilityLabel={`${t(`add.${o.key}`)}. ${enabled ? t(`add.${o.key}Hint`) : t('add.soon')}`}
              disabled={!enabled}
              onPress={() => o.pathname && router.replace({ pathname: o.pathname, params })}
              className={`min-h-[96px] rounded-card bg-surface-2 p-4 active:opacity-80 ${i < 2 ? 'flex-grow basis-[48%]' : 'flex-grow basis-[31%]'} ${enabled ? '' : 'opacity-50'}`}
            >
              <Ionicons name={o.icon} size={26} color={color(i === 0 ? 'brand' : 'text')} />
              <Text variant="heading" className="mt-2">
                {t(`add.${o.key}`)}
              </Text>
              <Text variant="caption" numberOfLines={1}>
                {enabled ? t(`add.${o.key}Hint`) : t('add.soon')}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
