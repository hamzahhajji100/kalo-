import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { isoToDate, localIsoDate, shiftIsoDate } from '@/lib/date';
import { formatDate } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/ui';

export function useDayLabel() {
  const { t } = useTranslation();
  return (iso: string) => {
    const today = localIsoDate();
    if (iso === today) return t('home.today');
    if (iso === shiftIsoDate(today, -1)) return t('home.yesterday');
    if (iso === shiftIsoDate(today, 1)) return t('home.tomorrow');
    return formatDate(isoToDate(iso), { weekday: 'short', day: 'numeric', month: 'short' });
  };
}

export function DayNavigator({
  date,
  onChange,
}: {
  date: string;
  onChange: (iso: string) => void;
}) {
  const { t } = useTranslation();
  const { color } = useTheme();
  const label = useDayLabel();

  return (
    <View className="flex-row items-center justify-between">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('diary.previousDay')}
        hitSlop={10}
        onPress={() => onChange(shiftIsoDate(date, -1))}
        className="h-10 w-10 items-center justify-center rounded-full active:bg-surface-2"
      >
        <Ionicons name="chevron-back" size={22} color={color('text')} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityHint={t('diary.jumpToToday')}
        onPress={() => onChange(localIsoDate())}
      >
        <Text variant="title" accessibilityRole="header">
          {label(date)}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('diary.nextDay')}
        hitSlop={10}
        onPress={() => onChange(shiftIsoDate(date, 1))}
        className="h-10 w-10 items-center justify-center rounded-full active:bg-surface-2"
      >
        <Ionicons name="chevron-forward" size={22} color={color('text')} />
      </Pressable>
    </View>
  );
}
