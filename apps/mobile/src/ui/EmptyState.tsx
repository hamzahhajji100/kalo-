import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Button } from './Button';
import { Text } from './Text';

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { color } = useTheme();
  return (
    <View className="items-center gap-3 px-8 py-10">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-brand-soft">
        <Ionicons name={icon} size={30} color={color('brand')} />
      </View>
      <Text variant="heading" className="text-center">
        {title}
      </Text>
      {message ? (
        <Text variant="caption" className="text-center">
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} className="mt-2" />
      ) : null}
    </View>
  );
}
