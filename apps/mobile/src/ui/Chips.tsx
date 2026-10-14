import * as Haptics from 'expo-haptics';
import { Pressable, ScrollView } from 'react-native';

import { Text } from './Text';

export function Chips<T extends string | number>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (v: T) => void;
  accessibilityLabel?: string;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      contentContainerClassName="gap-2"
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(o.value);
            }}
            className={`min-h-[44px] justify-center rounded-pill px-4 ${selected ? 'bg-brand' : 'bg-surface-2'}`}
          >
            <Text className={`font-semibold ${selected ? 'text-on-brand' : 'text-text'}`}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
