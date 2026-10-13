import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/ui';

type Option = {
  key: 'photo' | 'barcode' | 'search' | 'quick' | 'recipe';
  icon: ComponentProps<typeof Ionicons>['name'];
  href: Href;
};

// Routes for these options are added in their milestones; until then they fall back to the add sheet.
const OPTIONS: Option[] = [
  { key: 'photo', icon: 'camera', href: '/add' },
  { key: 'barcode', icon: 'barcode-outline', href: '/add' },
  { key: 'search', icon: 'search', href: '/add' },
  { key: 'quick', icon: 'flash-outline', href: '/add' },
  { key: 'recipe', icon: 'restaurant-outline', href: '/add' },
];

export default function AddSheet() {
  const { t } = useTranslation();
  const { color } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View className="bg-surface px-5 pt-6" style={{ paddingBottom: insets.bottom + 16 }}>
      <Text variant="title" className="mb-4">
        {t('add.title')}
      </Text>
      <View className="flex-row flex-wrap gap-3">
        {OPTIONS.map((o, i) => (
          <Pressable
            key={o.key}
            accessibilityRole="button"
            accessibilityLabel={`${t(`add.${o.key}`)}. ${t(`add.${o.key}Hint`)}`}
            onPress={() => router.replace(o.href)}
            className={`min-h-[96px] rounded-card bg-surface-2 p-4 active:opacity-80 ${i < 2 ? 'basis-[48%] flex-grow' : 'basis-[31%] flex-grow'}`}
          >
            <Ionicons name={o.icon} size={26} color={color(i === 0 ? 'brand' : 'text')} />
            <Text variant="heading" className="mt-2">
              {t(`add.${o.key}`)}
            </Text>
            <Text variant="caption" numberOfLines={1}>
              {t(`add.${o.key}Hint`)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
