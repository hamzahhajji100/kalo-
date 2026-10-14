import { forwardRef } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

export const NumberField = forwardRef<
  TextInput,
  Omit<TextInputProps, 'keyboardType'> & { label: string; unit?: string; error?: string }
>(function NumberField({ label, unit, error, ...props }, ref) {
  const { color } = useTheme();
  return (
    <View className="gap-1.5">
      <Text variant="label">{label}</Text>
      <View
        className={`min-h-[52px] flex-row items-center rounded-2xl border bg-surface-2 px-4 ${error ? 'border-danger' : 'border-transparent'}`}
      >
        <TextInput
          ref={ref}
          keyboardType="decimal-pad"
          accessibilityLabel={label}
          placeholderTextColor={color('muted')}
          className="flex-1 py-3 text-lg text-text"
          style={{ fontVariant: ['tabular-nums'] }}
          {...props}
        />
        {unit ? <Text variant="caption">{unit}</Text> : null}
      </View>
      {error ? (
        <Text className="text-sm text-danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
});

export function TextField({ label, ...props }: TextInputProps & { label: string }) {
  const { color } = useTheme();
  return (
    <View className="gap-1.5">
      <Text variant="label">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={color('muted')}
        className="min-h-[52px] rounded-2xl bg-surface-2 px-4 py-3 text-lg text-text"
        {...props}
      />
    </View>
  );
}
