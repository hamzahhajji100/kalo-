import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, View } from 'react-native';

import { deleteRecipe, recipeNutrition, saveRecipe } from '@/data/repositories/recipes';
import { useDbMutation } from '@/features/diary/queries';
import { useRecipeDraft } from '@/features/recipes/draftStore';
import { formatInt } from '@/lib/format';
import { parseDecimal } from '@/lib/number';
import { useTheme } from '@/theme/ThemeProvider';
import { Button, Card, EmptyState, NumberField, SheetScreen, Text, TextField } from '@/ui';

export default function EditRecipeScreen() {
  const { t } = useTranslation();
  const { color } = useTheme();
  const qc = useQueryClient();
  const { draft, update, setIngredientGrams, removeIngredient, clear } = useRecipeDraft();

  const save = useDbMutation(
    (db, d: NonNullable<typeof draft>) =>
      saveRecipe(db, {
        ...(d.id && { id: d.id }),
        name: d.name.trim(),
        servings: d.servings,
        totalGrams: d.totalGrams,
        ingredients: d.ingredients,
      }),
    () => [['recipes'], ['food']],
  );
  const remove = useDbMutation(
    (db, id: string) => deleteRecipe(db, id),
    () => [['recipes']],
  );

  if (!draft) {
    return (
      <SheetScreen title={t('recipes.title')}>
        <EmptyState icon="restaurant-outline" title={t('recipes.noDraft')} />
      </SheetScreen>
    );
  }

  const n = recipeNutrition(draft);
  const canSave =
    draft.name.trim().length > 0 && draft.ingredients.length > 0 && draft.servings >= 1;
  const onSave = () =>
    save.mutate(draft, {
      onSuccess: () => {
        clear();
        void qc.invalidateQueries({ queryKey: ['recipes'] });
        router.back();
      },
    });
  const onDelete = () =>
    Alert.alert(t('recipes.deleteTitle'), draft.name, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () =>
          draft.id && remove.mutate(draft.id, { onSuccess: () => (clear(), router.back()) }),
      },
    ]);

  return (
    <SheetScreen
      title={draft.id ? t('recipes.editTitle') : t('recipes.new')}
      footer={
        <>
          <Button
            label={t('common.save')}
            disabled={!canSave}
            loading={save.isPending}
            onPress={onSave}
          />
          {draft.id ? (
            <Button variant="ghost" label={t('common.delete')} onPress={onDelete} />
          ) : null}
        </>
      }
    >
      <TextField
        label={t('recipes.name')}
        value={draft.name}
        onChangeText={(name) => update({ name })}
        placeholder={t('recipes.namePlaceholder')}
      />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <NumberField
            label={t('recipes.servings')}
            value={String(draft.servings)}
            onChangeText={(v) =>
              update({ servings: Math.max(1, Math.round(parseDecimal(v) ?? 1)) })
            }
          />
        </View>
        <View className="flex-1">
          <NumberField
            label={t('recipes.cookedWeight')}
            unit="g"
            placeholder={formatInt(draft.ingredients.reduce((s, i) => s + i.grams, 0))}
            value={draft.totalGrams ? String(draft.totalGrams) : ''}
            onChangeText={(v) => update({ totalGrams: parseDecimal(v) ?? null })}
          />
        </View>
      </View>
      <Text variant="caption">{t('recipes.cookedWeightHint')}</Text>

      <View className="gap-1">
        <Text variant="label">{t('recipes.ingredients')}</Text>
        {draft.ingredients.map((ing, i) => (
          <View
            key={`${ing.foodId}-${i}`}
            className="flex-row items-center gap-3 border-b border-border py-2"
          >
            <Text className="flex-1" numberOfLines={2}>
              {ing.name}
            </Text>
            <View className="w-24">
              <NumberField
                label={t('entry.amount')}
                unit="g"
                value={String(ing.grams).replace('.', ',')}
                onChangeText={(v) => {
                  const g = parseDecimal(v);
                  if (g !== undefined && g > 0) setIngredientGrams(i, g);
                }}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('recipes.removeIngredient', { name: ing.name })}
              onPress={() => removeIngredient(i)}
              hitSlop={8}
            >
              <Ionicons name="trash-outline" size={20} color={color('danger')} />
            </Pressable>
          </View>
        ))}
        <Button
          variant="secondary"
          label={t('recipes.addIngredient')}
          onPress={() => router.push({ pathname: '/add/search', params: { mode: 'recipe' } })}
          className="mt-2"
        />
      </View>

      {draft.ingredients.length > 0 && (
        <Card className="gap-1">
          <Text variant="heading">{t('recipes.perServing')}</Text>
          <Text>
            {t('recipes.nutritionLine', {
              kcal: formatInt(n.perServing.kcal),
              protein: formatInt(n.perServing.protein),
              carbs: formatInt(n.perServing.carbs),
              fat: formatInt(n.perServing.fat),
            })}
          </Text>
          <Text variant="caption">
            {t('recipes.totalLine', { kcal: formatInt(n.total.kcal), grams: formatInt(n.grams) })}
          </Text>
        </Card>
      )}
    </SheetScreen>
  );
}
