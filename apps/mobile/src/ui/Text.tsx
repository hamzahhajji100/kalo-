import { Text as RNText, type TextProps } from 'react-native';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'caption' | 'label';

const variants: Record<Variant, string> = {
  display: 'text-display text-text',
  title: 'text-2xl font-bold text-text',
  heading: 'text-lg font-semibold text-text',
  body: 'text-base text-text',
  caption: 'text-sm text-muted',
  label: 'text-xs font-semibold uppercase tracking-wider text-muted',
};

export function Text({
  variant = 'body',
  className,
  ...props
}: TextProps & { variant?: Variant; className?: string }) {
  // Dynamic Type stays enabled; cap scaling so layouts don't break at extreme sizes.
  return (
    <RNText
      maxFontSizeMultiplier={1.6}
      className={`${variants[variant]} ${className ?? ''}`}
      {...props}
    />
  );
}
