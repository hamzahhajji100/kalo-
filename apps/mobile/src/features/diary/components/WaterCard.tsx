import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { addWater, undoLastWater } from '@/data/repositories/body';
import { formatDecimal } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { Card, ProgressBar, Text } from '@/ui';
import { keys, useDbMutation } from '../queries';

const GLASS_ML = 250;

export function WaterCard({ date, ml, targetMl }: { date: string; ml: number; targetMl: number }) {
  const { t } = useTranslation();
  const { color } = useTheme();
  const add = useDbMutation(
    (db, d: string) => addWater(db, d, GLASS_ML),
    (d) => [keys.day(d)],
  );
  const undo = useDbMutation(
    (db, d: string) => undoLastWater(db, d),
    (d) => [keys.day(d)],
  );
  const liters = (v: number) => formatDecimal(v / 1000, 2);

  return (
    <Card className="gap-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Ionicons name="water" size={20} color={color('water')} />
          <Text variant="heading">{t('home.water')}</Text>
        </View>
        <Text variant="caption" style={{ fontVariant: ['tabular-nums'] }}>
          {liters(ml)} / {liters(targetMl)} l
        </Text>
      </View>
      <ProgressBar fraction={targetMl ? ml / targetMl : 0} color={color('water')} />
      <View className="flex-row gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.removeGlass')}
          disabled={ml === 0}
          onPress={() => undo.mutate(date)}
          className={`h-11 w-11 items-center justify-center rounded-full bg-surface-2 active:opacity-70 ${ml === 0 ? 'opacity-40' : ''}`}
        >
          <Ionicons name="remove" size={20} color={color('text')} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.addGlass', { ml: GLASS_ML })}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            add.mutate(date);
          }}
          className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-pill bg-surface-2 active:opacity-70"
        >
          <Ionicons name="add" size={20} color={color('water')} />
          <Text className="font-semibold text-text">{t('home.glass', { ml: GLASS_ML })}</Text>
        </Pressable>
      </View>
    </Card>
  );
}
