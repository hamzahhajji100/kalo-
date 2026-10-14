import { Ionicons } from '@expo/vector-icons';
import { getCatalogFood } from '@kalo/food-db';
import { scaleNutrients } from '@kalo/core';
import type { Food } from '@kalo/schemas';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { getCatalog } from '@/data/catalog';
import { db } from '@/data/client';
import { addEntry } from '@/data/repositories/diary';
import { isFavorite, toggleFavorite } from '@/data/repositories/favorites';
import { upsertFood } from '@/data/repositories/foods';
import { MealPicker } from '@/features/diary/components/MealPicker';
import { keys, useDbMutation } from '@/features/diary/queries';
import { useAddTarget } from '@/features/diary/useAddTarget';
import { foodKey } from '@/features/foods/navigation';
import { microsFor } from '@/features/foods/micros';
import { NutritionTable } from '@/features/foods/NutritionTable';
import { initialAmount, unitOptions, type UnitOption } from '@/features/foods/portions';
import { useAnalysis } from '@/features/photo/analysisStore';
import { useRecipeDraft } from '@/features/recipes/draftStore';
import { fetchOffProduct } from '@/features/search/openFoodFacts';
import { resolveFoodLocal } from '@/features/search/searchService';
import { formatDecimal, formatInt } from '@/lib/format';
import { parseDecimal } from '@/lib/number';
import { useTheme } from '@/theme/ThemeProvider';
import { Button, Card, Chips, EmptyState, NumberField, SheetScreen, Skeleton, Text } from '@/ui';

export default function FoodScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useQuery({
    queryKey: foodKey(id),
    queryFn: async ({ signal }): Promise<Food | null> => {
      const local = resolveFoodLocal(id, t('food.onePortion'));
      if (local) return local;
      if (id.startsWith('off:'))
        return (
          (await fetchOffProduct(id.slice(4), i18n.language === 'en' ? 'en' : 'de', signal)) ?? null
        );
      return null;
    },
    staleTime: Infinity,
  });

  if (query.isLoading) {
    return (
      <SheetScreen title="">
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </SheetScreen>
    );
  }
  if (!query.data) {
    return (
      <SheetScreen title={t('food.title')}>
        <EmptyState
          icon={query.error ? 'cloud-offline-outline' : 'help-circle-outline'}
          title={query.error ? t('food.loadError') : t('food.notFound')}
          {...(query.error && {
            actionLabel: t('common.retry'),
            onAction: () => void query.refetch(),
          })}
        />
      </SheetScreen>
    );
  }
  return <FoodDetail food={query.data} />;
}

function FoodDetail({ food }: { food: Food }) {
  const { t } = useTranslation();
  const { color } = useTheme();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ mode?: string; grams?: string; via?: string }>();
  const mode = params.mode === 'recipe' || params.mode === 'photo' ? params.mode : 'log';
  const target = useAddTarget();
  const addIngredient = useRecipeDraft((s) => s.addIngredient);

  const options = useMemo(() => unitOptions(food, t), [food, t]);
  const initial = useMemo(
    () => initialAmount(options, params.grams ? Number(params.grams) : undefined),
    [options, params.grams],
  );
  const [unit, setUnit] = useState<UnitOption>(initial.unit);
  const [quantity, setQuantity] = useState(String(initial.quantity).replace('.', ','));
  const [mealTypeId, setMealTypeId] = useState<number>();
  const [favorite, setFavorite] = useState(() => isFavorite(db, food.id));

  const qty = parseDecimal(quantity);
  const grams = qty !== undefined ? qty * unit.grams : undefined;
  const valid = grams !== undefined && grams > 0 && grams <= 5000;
  const n = scaleNutrients(food.per100g, valid ? grams : 0);
  const amountLabel = unit.key === 'g' ? null : `${formatDecimal(qty ?? 0)} × ${unit.label}`;
  const meal = mealTypeId ?? target.mealTypeId;

  const log = useDbMutation(
    (d, _: void) => {
      // Keep online results available offline; catalogue and recipe foods are already local.
      const catalog = getCatalog();
      if (food.source !== 'recipe' && !(catalog && getCatalogFood(catalog, food.id)))
        upsertFood(d, food);
      addEntry(d, {
        date: target.date,
        mealTypeId: meal!,
        foodId: food.id,
        ...(food.source === 'recipe' && { recipeId: food.sourceId }),
        name: food.name,
        brand: food.brand ?? null,
        grams: grams!,
        amountLabel,
        nutrients: n,
        micros: microsFor(food, grams!),
        source:
          food.source === 'recipe'
            ? 'recipe'
            : params.via === 'barcode'
              ? 'barcode'
              : params.via === 'photo'
                ? 'photo'
                : 'search',
      });
    },
    () => [keys.day(target.date), keys.recent],
  );

  const onPrimary = () => {
    if (!valid) return;
    if (mode === 'recipe') {
      addIngredient({ foodId: food.id, name: food.name, grams: grams!, per100g: food.per100g });
      router.dismissTo('/recipes/edit');
      return;
    }
    if (mode === 'photo') {
      useAnalysis.getState().pick(food, grams!);
      router.dismissTo('/analysis');
      return;
    }
    if (meal === undefined) return;
    log.mutate(undefined, { onSuccess: () => router.dismissAll() });
  };

  const toggleFav = () => {
    setFavorite(toggleFavorite(db, food));
    void qc.invalidateQueries({ queryKey: ['favorites'] });
  };

  const sourceNote =
    food.source === 'off'
      ? t('food.sourceOff')
      : food.source === 'usda'
        ? t('food.sourceUsda')
        : food.source === 'ai'
          ? t('food.sourceAi')
          : food.source === 'recipe'
            ? t('food.sourceRecipe')
            : t('food.sourceCustom');

  return (
    <SheetScreen
      title={food.name}
      footer={
        <Button
          label={
            mode === 'recipe'
              ? t('food.addToRecipe')
              : t('food.addToDiary', { kcal: formatInt(n.kcal) })
          }
          disabled={!valid || (mode === 'log' && meal === undefined)}
          loading={log.isPending}
          onPress={onPrimary}
        />
      }
    >
      <Stack.Screen options={{ title: food.name }} />
      <View className="flex-row items-center gap-4">
        {food.imageUrl ? (
          <Image
            source={{ uri: food.imageUrl }}
            style={{ width: 72, height: 72, borderRadius: 16 }}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
        ) : null}
        <View className="flex-1 gap-1">
          {food.brand ? <Text variant="caption">{food.brand}</Text> : null}
          <View className="flex-row flex-wrap items-center gap-2">
            {food.nutriScore ? (
              <View
                className="rounded-md bg-surface-2 px-2 py-0.5"
                accessibilityLabel={t('food.nutriScoreA11y', {
                  grade: food.nutriScore.toUpperCase(),
                })}
              >
                <Text className="text-xs font-bold text-text">
                  Nutri-Score {food.nutriScore.toUpperCase()}
                </Text>
              </View>
            ) : null}
            {food.verified ? (
              <View className="flex-row items-center gap-1">
                <Ionicons name="checkmark-circle" size={14} color={color('brand')} />
                <Text variant="caption">{t('food.verified')}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={favorite ? t('food.unfavorite') : t('food.favorite')}
          accessibilityState={{ selected: favorite }}
          onPress={toggleFav}
          hitSlop={10}
        >
          <Ionicons
            name={favorite ? 'star' : 'star-outline'}
            size={26}
            color={color(favorite ? 'carbs' : 'muted')}
          />
        </Pressable>
      </View>

      <View className="flex-row gap-3">
        <View className="w-32">
          <NumberField
            label={t('food.quantity')}
            value={quantity}
            onChangeText={setQuantity}
            selectTextOnFocus
            error={quantity && !valid ? t('entry.invalidAmount') : undefined}
          />
        </View>
        <View className="flex-1 justify-end pb-1">
          <Chips
            accessibilityLabel={t('food.unit')}
            value={unit.key}
            onChange={(k) => setUnit(options.find((o) => o.key === k)!)}
            options={options.map((o) => ({ value: o.key, label: o.label }))}
          />
        </View>
      </View>

      <Card
        className="flex-row justify-between"
        accessible
        accessibilityLabel={t('food.totalsA11y', {
          kcal: formatInt(n.kcal),
          protein: formatInt(n.protein),
          carbs: formatInt(n.carbs),
          fat: formatInt(n.fat),
        })}
      >
        {(
          [
            ['kcal', n.kcal, 'kcal', 'text'],
            ['protein', n.protein, 'g', 'protein'],
            ['carbsShort', n.carbs, 'g', 'carbs'],
            ['fat', n.fat, 'g', 'fat'],
          ] as const
        ).map(([k, v, u, c]) => (
          <View key={k} className="items-center">
            <Text
              className="text-xl font-bold"
              style={{ color: color(c), fontVariant: ['tabular-nums'] }}
            >
              {formatInt(v)}
            </Text>
            <Text variant="caption">{k === 'kcal' ? u : `${t(`macros.${k}`)}`}</Text>
          </View>
        ))}
      </Card>

      {mode === 'log' && <MealPicker value={meal} onChange={setMealTypeId} />}

      <NutritionTable food={food} />

      {food.allergens.length > 0 && (
        <View className="gap-1">
          <Text variant="label">{t('food.allergens')}</Text>
          <Text>
            {food.allergens.map((a) => t(`allergens.${a}`, { defaultValue: a })).join(', ')}
          </Text>
        </View>
      )}
      {food.ingredients ? (
        <View className="gap-1">
          <Text variant="label">{t('food.ingredients')}</Text>
          <Text variant="caption">{food.ingredients}</Text>
        </View>
      ) : null}
      <Text variant="caption">{sourceNote}</Text>
    </SheetScreen>
  );
}
