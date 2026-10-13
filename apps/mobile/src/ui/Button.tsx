import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, type PressableProps } from 'react-native';

import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const containers: Record<Variant, string> = {
  primary: 'bg-brand',
  secondary: 'bg-surface-2',
  ghost: 'bg-transparent',
  danger: 'bg-danger',
};
const labels: Record<Variant, string> = {
  primary: 'text-on-brand',
  secondary: 'text-text',
  ghost: 'text-brand',
  danger: 'text-on-brand',
};

export interface ButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: Variant;
  loading?: boolean;
  className?: string;
}

export function Button({
  label,
  variant = 'primary',
  loading,
  disabled,
  onPress,
  className,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      onPress={(e) => {
        void Haptics.selectionAsync();
        onPress?.(e);
      }}
      className={`min-h-[52px] flex-row items-center justify-center rounded-pill px-6 active:opacity-80 ${containers[variant]} ${isDisabled ? 'opacity-50' : ''} ${className ?? ''}`}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? 'white' : undefined} />
      ) : (
        <Text className={`text-base font-semibold ${labels[variant]}`}>{label}</Text>
      )}
    </Pressable>
  );
}
