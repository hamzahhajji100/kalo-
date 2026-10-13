import { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  ReduceMotion,
} from 'react-native-reanimated';

/** Pulsing placeholder for loading states. Respects the system "reduce motion" setting. */
export function Skeleton({ className }: { className?: string }) {
  const opacity = useSharedValue(0.5);
  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 700, reduceMotion: ReduceMotion.System }),
      -1,
      true,
    );
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={style}
      className={`rounded-xl bg-surface-2 ${className ?? ''}`}
    />
  );
}
