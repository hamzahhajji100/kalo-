import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { db } from '@/data/client';
import {
  listRecipes,
  recipeAsFood,
  recipeIngredients,
  recipeNutrition,
} from '@/data/repositories/recipes';
import { useAddTarget } from '@/features/diary/useAddTarget';
import { openFood } from '@/features/foods/navigation';
import { useRecipeDraft } from '@/features/recipes/draftStore';
import { formatInt } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { Button, EmptyState, SheetScreen, Text } from '@/ui';

export default function RecipesScreen() {
  const { t } = useTranslation();
  const { color } = useTheme();
  const target = useAddTarget();
  const start = useRecipeDraft((s) => s.start);
  const { data = [] } = useQuery({ queryKey: ['recipes'], queryFn: () => listRecipes(db) });

  const newRecipe = () => {
    start();
    router.push('/recipes/edit');
  };

  return (
    <SheetScreen
      title={t('recipes.title')}
      footer={<Button label={t('recipes.new')} onPress={newRecipe} />}
    >
      {data.length === 0 ? (
        <EmptyState
          icon="restaurant-outline"
          title={t('recipes.empty')}
          message={t('recipes.emptyHint')}
        />
      ) : (
        <View>
          {data.map((r) => {
            const n = recipeNutrition({ ...r, ingredients: recipeIngredients(r) });
            const food = recipeAsFood(r, t('food.onePortion'));
            return (
              <View
                key={r.id}
                className="flex-row items-center gap-2 border-b border-border py-2.5"
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityHint={t('recipes.logHint')}
                  disabled={!food}
                  onPress={() =>
                    food &&
                    openFood(food, {
                      date: target.date,
                      ...(target.mealTypeId !== undefined && { meal: String(target.mealTypeId) }),
                    })
                  }
                  className="flex-1 active:opacity-70"
                >
                  <Text className="font-medium text-text">{r.name}</Text>
                  <Text variant="caption">
                    {t('recipes.summary', {
                      kcal: formatInt(n.perServing.kcal),
                      protein: formatInt(n.perServing.protein),
                      servings: r.servings,
                    })}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('recipes.edit', { name: r.name })}
                  hitSlop={8}
                  onPress={() => {
                    start(r);
                    router.push('/recipes/edit');
                  }}
                  className="h-10 w-10 items-center justify-center rounded-full bg-surface-2"
                >
                  <Ionicons name="create-outline" size={20} color={color('text')} />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </SheetScreen>
  );
}
