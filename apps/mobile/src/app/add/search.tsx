import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { db } from '@/data/client';
import { listFavorites } from '@/data/repositories/favorites';
import { applyTemplate, listTemplates } from '@/data/repositories/templates';
import { keys, useDbMutation, useRecentFoods } from '@/features/diary/queries';
import { useAddTarget } from '@/features/diary/useAddTarget';
import { FoodRow } from '@/features/foods/FoodRow';
import { openFood, type FoodMode } from '@/features/foods/navigation';
import { resolveFoodLocal } from '@/features/search/searchService';
import { useFoodSearch } from '@/features/search/useFoodSearch';
import { formatInt } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { Button, Chips, EmptyState, Skeleton, Text } from '@/ui';

type Tab = 'recent' | 'favorites' | 'templates';

export default function SearchScreen() {
  const { t } = useTranslation();
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: FoodMode }>();
  const mode: FoodMode = params.mode === 'recipe' || params.mode === 'photo' ? params.mode : 'log';
  const target = useAddTarget();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('recent');
  const { sections, localCount, online } = useFoodSearch(query);
  const nav = {
    date: target.date,
    ...(target.mealTypeId !== undefined && { meal: String(target.mealTypeId) }),
    mode,
  };

  const searching = query.trim().length >= 2;
  const total = localCount + (sections.find((s) => s.key === 'online')?.hits.length ?? 0);

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: 12 }}>
      <View className="flex-row items-center gap-3 px-5 pb-3">
        <View className="h-12 flex-1 flex-row items-center gap-2 rounded-2xl bg-surface-2 px-3">
          <Ionicons name="search" size={20} color={color('muted')} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder={t('search.placeholder')}
            placeholderTextColor={color('muted')}
            accessibilityLabel={t('search.placeholder')}
            returnKeyType="search"
            autoCorrect={false}
            className="flex-1 text-base text-text"
          />
          {query ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('search.clear')}
              onPress={() => setQuery('')}
              hitSlop={10}
            >
              <Ionicons name="close-circle" size={20} color={color('muted')} />
            </Pressable>
          ) : null}
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={10}>
          <Text className="font-semibold text-brand">{t('common.cancel')}</Text>
        </Pressable>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        contentContainerClassName="px-5"
      >
        {searching ? (
          <>
            {sections.map((section) =>
              section.hits.length === 0 ? null : (
                <View key={section.key} className="mb-4">
                  <Text variant="label" className="mb-1 mt-2">
                    {t(`search.section.${section.key}`)}
                  </Text>
                  {section.hits.map((h) => (
                    <FoodRow key={h.food.id} food={h.food} onPress={() => openFood(h.food, nav)} />
                  ))}
                </View>
              ),
            )}
            {online.loading && (
              <View className="gap-2 py-2" accessibilityLabel={t('search.loadingOnline')}>
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </View>
            )}
            {online.error && (
              <Text variant="caption" className="py-2 text-center" accessibilityLiveRegion="polite">
                {t(`search.onlineError.${online.error}`)}
              </Text>
            )}
            {online.canRequest && (
              <Button
                variant="secondary"
                label={t('search.searchOnline')}
                onPress={online.request}
                className="mt-2"
              />
            )}
            {!online.loading && total === 0 && !online.canRequest && (
              <EmptyState
                icon="search-outline"
                title={t('search.noResults')}
                message={t('search.noResultsHint')}
                actionLabel={t('add.quick')}
                onAction={() =>
                  router.replace({
                    pathname: '/add/quick',
                    params: {
                      date: target.date,
                      ...(target.mealTypeId !== undefined && { meal: String(target.mealTypeId) }),
                    },
                  })
                }
              />
            )}
          </>
        ) : (
          <>
            <View className="mb-3">
              <Chips<Tab>
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'recent', label: t('search.tabs.recent') },
                  { value: 'favorites', label: t('search.tabs.favorites') },
                  ...(mode === 'log'
                    ? [{ value: 'templates' as const, label: t('search.tabs.templates') }]
                    : []),
                ]}
              />
            </View>
            {tab === 'recent' && <RecentList nav={nav} />}
            {tab === 'favorites' && <FavoritesList nav={nav} />}
            {tab === 'templates' && target.mealTypeId !== undefined && (
              <TemplatesList date={target.date} mealTypeId={target.mealTypeId} />
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

type Nav = Parameters<typeof openFood>[1];

function RecentList({ nav }: { nav: Nav }) {
  const { t } = useTranslation();
  const { data, isLoading } = useRecentFoods(30);
  if (isLoading) return <Skeleton className="h-40" />;
  const items = (data ?? []).flatMap((r) => {
    const food = resolveFoodLocal(r.foodId, t('food.onePortion'));
    return food ? [{ r, food }] : [];
  });
  if (items.length === 0)
    return (
      <EmptyState
        icon="time-outline"
        title={t('search.emptyRecent')}
        message={t('search.emptyRecentHint')}
      />
    );
  return (
    <>
      {items.map(({ r, food }) => (
        <FoodRow
          key={r.foodId}
          food={food}
          subtitle={[
            r.brand,
            r.amountLabel ?? (r.grams ? `${formatInt(r.grams)} g` : null),
            `${formatInt(r.kcal)} kcal`,
          ]
            .filter(Boolean)
            .join(' · ')}
          onPress={() => openFood(food, { ...nav, ...(r.grams && { grams: r.grams }) })}
        />
      ))}
    </>
  );
}

function FavoritesList({ nav }: { nav: Nav }) {
  const { t } = useTranslation();
  const { data = [] } = useQuery({ queryKey: ['favorites'], queryFn: () => listFavorites(db) });
  if (data.length === 0)
    return (
      <EmptyState
        icon="star-outline"
        title={t('search.emptyFavorites')}
        message={t('search.emptyFavoritesHint')}
      />
    );
  return (
    <>
      {data.map((food) => (
        <FoodRow key={food.id} food={food} onPress={() => openFood(food, nav)} />
      ))}
    </>
  );
}

function TemplatesList({ date, mealTypeId }: { date: string; mealTypeId: number }) {
  const { t } = useTranslation();
  const { data = [], isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: () => listTemplates(db),
  });
  const apply = useDbMutation(
    (d, id: string) => applyTemplate(d, { templateId: id, date, mealTypeId }),
    () => [keys.day(date), keys.recent],
  );
  if (isLoading) return <ActivityIndicator />;
  if (data.length === 0)
    return (
      <EmptyState
        icon="albums-outline"
        title={t('search.emptyTemplates')}
        message={t('search.emptyTemplatesHint')}
      />
    );
  return (
    <>
      {data.map((tpl) => {
        const kcal = tpl.items.reduce((s, i) => s + i.kcal, 0);
        return (
          <Pressable
            key={tpl.id}
            accessibilityRole="button"
            onPress={() =>
              Alert.alert(tpl.name, t('search.applyTemplate', { count: tpl.items.length }), [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('search.add'),
                  onPress: () => apply.mutate(tpl.id, { onSuccess: () => router.dismissAll() }),
                },
              ])
            }
            className="min-h-[60px] justify-center border-b border-border py-2.5 active:opacity-70"
          >
            <Text className="font-medium text-text">{tpl.name}</Text>
            <Text variant="caption" numberOfLines={1}>
              {`${tpl.items.map((i) => i.name).join(', ')} · ${formatInt(kcal)} kcal`}
            </Text>
          </Pressable>
        );
      })}
    </>
  );
}
