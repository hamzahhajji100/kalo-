import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export function ProgressBar({
  fraction,
  color,
  trackClassName = 'bg-surface-2',
}: {
  fraction: number;
  color: string;
  trackClassName?: string;
}) {
  const width = useSharedValue(0);
  useEffect(() => {
    width.value = withTiming(Math.max(0, Math.min(1, fraction)), {
      duration: 600,
      reduceMotion: ReduceMotion.System,
    });
  }, [fraction, width]);
  const style = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));
  return (
    <View className={`h-2 overflow-hidden rounded-pill ${trackClassName}`}>
      <Animated.View
        style={[style, { backgroundColor: color, height: '100%', borderRadius: 999 }]}
      />
    </View>
  );
}
