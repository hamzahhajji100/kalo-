import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { ComponentProps } from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

/** Large selectable answer used in onboarding and settings. */
export function OptionCard({
  title,
  subtitle,
  icon,
  selected,
  onPress,
  multi,
}: {
  title: string;
  subtitle?: string;
  icon?: ComponentProps<typeof Ionicons>['name'];
  selected: boolean;
  onPress: () => void;
  multi?: boolean;
}) {
  const { color } = useTheme();
  return (
    <Pressable
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={multi ? { checked: selected } : { selected }}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      className={`min-h-[64px] flex-row items-center gap-3 rounded-card border-2 px-4 py-3 active:opacity-80 ${selected ? 'border-brand bg-brand-soft' : 'border-transparent bg-surface'}`}
    >
      {icon ? <Ionicons name={icon} size={24} color={color(selected ? 'brand' : 'muted')} /> : null}
      <View className="flex-1">
        <Text className="text-base font-semibold text-text">{title}</Text>
        {subtitle ? <Text variant="caption">{subtitle}</Text> : null}
      </View>
      {selected ? <Ionicons name="checkmark-circle" size={22} color={color('brand')} /> : null}
    </Pressable>
  );
}
