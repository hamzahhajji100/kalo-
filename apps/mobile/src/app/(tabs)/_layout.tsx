import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Redirect, router, Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { usePreferences } from '@/lib/preferences';
import { useTheme } from '@/theme/ThemeProvider';

/** Centre "+" button: opens the add sheet so any entry type is at most 2 taps away. */
function AddButton() {
  const { t } = useTranslation();
  const { color } = useTheme();
  return (
    <View className="flex-1 items-center justify-center">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('tabs.add')}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push('/add');
        }}
        className="-mt-6 h-16 w-16 items-center justify-center rounded-full bg-brand shadow-lg active:scale-95"
      >
        <Ionicons name="add" size={34} color={color('on-brand')} />
      </Pressable>
    </View>
  );
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const { color } = useTheme();
  const hasOnboarded = usePreferences((s) => s.hasOnboarded);
  if (!hasOnboarded) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color('brand'),
        tabBarInactiveTintColor: color('muted'),
        tabBarStyle: { backgroundColor: color('surface'), borderTopColor: color('border') },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.today'),
          tabBarIcon: ({ color: c, size }) => (
            <Ionicons name="today-outline" color={c} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="diary"
        options={{
          title: t('tabs.diary'),
          tabBarIcon: ({ color: c, size }) => (
            <Ionicons name="book-outline" color={c} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="add-placeholder"
        options={{ title: t('tabs.add'), tabBarButton: () => <AddButton /> }}
        listeners={{ tabPress: (e) => e.preventDefault() }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: t('tabs.progress'),
          tabBarIcon: ({ color: c, size }) => (
            <Ionicons name="trending-up-outline" color={c} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color: c, size }) => (
            <Ionicons name="person-circle-outline" color={c} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
