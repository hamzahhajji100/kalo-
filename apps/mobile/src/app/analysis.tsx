import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { sumNutrients } from '@kalo/core';
import { searchCatalog } from '@kalo/food-db';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { getCatalog } from '@/data/catalog';
import { addEntries } from '@/data/repositories/diary';
import { MealPicker } from '@/features/diary/components/MealPicker';
import { keys, useDbMutation } from '@/features/diary/queries';
import { useAddTarget } from '@/features/diary/useAddTarget';
import { useAnalysis } from '@/features/photo/analysisStore';
import { itemNutrients, needsConfirmation, type EditableItem } from '@/features/photo/reconcile';
import { formatInt } from '@/lib/format';
import { parseDecimal } from '@/lib/number';
import { useTheme } from '@/theme/ThemeProvider';
import { Button, Card, EmptyState, NumberField, SheetScreen, Text } from '@/ui';

export default function AnalysisScreen() {
  const { t } = useTranslation();
  const { photoUri, dishName, notes, items, clear, beginReplace } = useAnalysis();
  const target = useAddTarget();
  const [mealTypeId, setMealTypeId] = useState<number>();
  const meal = mealTypeId ?? target.mealTypeId;
  const total = sumNutrients(items.map(itemNutrients));
  const nav = { date: target.date, ...(meal !== undefined && { meal: String(meal) }) };

  const save = useDbMutation(
    (db, _: void) =>
      addEntries(
        db,
        items.map((i) => ({
          date: target.date,
          mealTypeId: meal!,
          foodId: i.foodId,
          name: i.name,
          grams: i.grams,
          nutrients: itemNutrients(i),
          source: 'photo' as const,
        })),
      ),
    () => [keys.day(target.date), keys.recent],
  );

  const searchFor = (key: string | null) => {
    beginReplace(key);
    router.push({ pathname: '/add/search', params: { ...nav, mode: 'photo' } });
  };

  if (items.length === 0) {
    return (
      <SheetScreen title={t('analysis.title')}>
        <EmptyState
          icon="restaurant-outline"
          title={t('analysis.empty')}
          actionLabel={t('analysis.addItem')}
          onAction={() => searchFor(null)}
        />
      </SheetScreen>
    );
  }

  return (
    <SheetScreen
      title={dishName || t('analysis.title')}
      footer={
        <Button
          label={t('analysis.save', { count: items.length, kcal: formatInt(total.kcal) })}
          disabled={meal === undefined}
          loading={save.isPending}
          onPress={() =>
            save.mutate(undefined, {
              onSuccess: () => {
                clear();
                router.dismissAll();
              },
            })
          }
        />
      }
    >
      <View className="flex-row items-center gap-4">
        {photoUri ? (
          <Image
            source={{ uri: photoUri }}
            style={{ width: 84, height: 84, borderRadius: 18 }}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
        ) : null}
        <View className="flex-1">
          <Text
            className="text-3xl font-bold text-text"
            style={{ fontVariant: ['tabular-nums'] }}
            accessibilityLabel={t('analysis.totalA11y', { kcal: formatInt(total.kcal) })}
          >
            {formatInt(total.kcal)} kcal
          </Text>
          <Text variant="caption">
            {t('recipes.nutritionLine', {
              kcal: formatInt(total.kcal),
              protein: formatInt(total.protein),
              carbs: formatInt(total.carbs),
              fat: formatInt(total.fat),
            })}
          </Text>
        </View>
      </View>
      {notes ? <Text variant="caption">{notes}</Text> : null}

      {items.map((item) => (
        <ItemCard key={item.key} item={item} onReplace={() => searchFor(item.key)} />
      ))}

      <Button variant="secondary" label={t('analysis.addItem')} onPress={() => searchFor(null)} />
      <MealPicker value={meal} onChange={setMealTypeId} />
      <Text variant="caption">{t('analysis.disclaimer')}</Text>
    </SheetScreen>
  );
}

function ItemCard({ item, onReplace }: { item: EditableItem; onReplace: () => void }) {
  const { t } = useTranslation();
  const { color } = useTheme();
  const { setGrams, remove, beginReplace } = useAnalysis();
  const [text, setText] = useState(String(item.grams));
  const n = itemNutrients(item);
  const maxGrams = Math.max(500, Math.ceil((item.grams * 2) / 50) * 50);

  const updateFromText = (v: string) => {
    setText(v);
    const g = parseDecimal(v);
    if (g !== undefined && g > 0 && g <= 3000) setGrams(item.key, g);
  };

  // Choosing an alternative looks up verified values; if the catalogue has none, the search opens prefilled.
  const chooseAlternative = (name: string) => {
    const catalog = getCatalog();
    const hit = catalog ? searchCatalog(catalog, name, { limit: 1 })[0] : undefined;
    if (hit) {
      beginReplace(item.key);
      useAnalysis.getState().pick(hit.food, item.grams);
    } else onReplace();
  };

  return (
    <Card className="gap-3">
      <View className="flex-row items-start gap-2">
        <View className="flex-1">
          <Text variant="heading">{item.name}</Text>
          <Text variant="caption">
            {t(`analysis.basis.${item.basis}`)}
            {item.basis === 'ai' && item.confidence < 1
              ? ` · ${t('analysis.confidence', { pct: Math.round(item.confidence * 100) })}`
              : ''}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('analysis.replace', { name: item.name })}
          onPress={onReplace}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-full bg-surface-2"
        >
          <Ionicons name="swap-horizontal" size={18} color={color('text')} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('analysis.remove', { name: item.name })}
          onPress={() => remove(item.key)}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-full bg-surface-2"
        >
          <Ionicons name="trash-outline" size={18} color={color('danger')} />
        </Pressable>
      </View>

      {needsConfirmation(item) && (
        <View className="gap-2 rounded-2xl bg-brand-soft p-3" accessibilityLiveRegion="polite">
          <Text className="text-text">
            {t('analysis.question', {
              options: [item.name, ...item.alternatives].join(t('analysis.or')),
            })}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                useAnalysis.setState((s) => ({
                  items: s.items.map((i) => (i.key === item.key ? { ...i, confidence: 1 } : i)),
                }))
              }
              className="rounded-pill bg-brand px-3 py-2"
            >
              <Text className="font-semibold text-on-brand">
                {t('analysis.yesIts', { name: item.name })}
              </Text>
            </Pressable>
            {item.alternatives.map((a) => (
              <Pressable
                key={a}
                accessibilityRole="button"
                onPress={() => chooseAlternative(a)}
                className="rounded-pill bg-surface px-3 py-2"
              >
                <Text className="font-semibold text-text">{a}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {item.rejectedMatch && (
        <Text variant="caption">
          {t('analysis.rejectedMatch', { name: item.rejectedMatch.name })}
        </Text>
      )}

      <View className="flex-row items-center gap-3">
        <View className="w-28">
          <NumberField
            label={t('entry.amount')}
            unit="g"
            value={text}
            onChangeText={updateFromText}
            selectTextOnFocus
          />
        </View>
        <View className="flex-1 pt-5">
          <Slider
            accessibilityLabel={t('analysis.amountSlider', { name: item.name })}
            minimumValue={5}
            maximumValue={maxGrams}
            step={5}
            value={item.grams}
            onValueChange={(v) => {
              setGrams(item.key, v);
              setText(String(v));
            }}
            minimumTrackTintColor={color('brand')}
            maximumTrackTintColor={color('surface-2')}
            thumbTintColor={color('brand')}
          />
        </View>
      </View>
      <Text style={{ fontVariant: ['tabular-nums'] }}>
        {t('recipes.nutritionLine', {
          kcal: formatInt(n.kcal),
          protein: formatInt(n.protein),
          carbs: formatInt(n.carbs),
          fat: formatInt(n.fat),
        })}
      </Text>
    </Card>
  );
}
