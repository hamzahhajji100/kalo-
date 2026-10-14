import { create } from 'zustand';

import type { RecipeIngredient, RecipeWithItems } from '@/data/repositories/recipes';
import { recipeIngredients } from '@/data/repositories/recipes';

export interface RecipeDraft {
  id?: string;
  name: string;
  servings: number;
  totalGrams: number | null;
  ingredients: RecipeIngredient[];
}

interface DraftState {
  draft: RecipeDraft | null;
  start: (recipe?: RecipeWithItems) => void;
  update: (patch: Partial<Omit<RecipeDraft, 'ingredients'>>) => void;
  addIngredient: (i: RecipeIngredient) => void;
  setIngredientGrams: (index: number, grams: number) => void;
  removeIngredient: (index: number) => void;
  clear: () => void;
}

/** In-memory recipe being edited; ingredients are picked through the normal search flow. */
export const useRecipeDraft = create<DraftState>((set) => ({
  draft: null,
  start: (recipe) =>
    set({
      draft: recipe
        ? {
            id: recipe.id,
            name: recipe.name,
            servings: recipe.servings,
            totalGrams: recipe.totalGrams,
            ingredients: recipeIngredients(recipe),
          }
        : { name: '', servings: 1, totalGrams: null, ingredients: [] },
    }),
  update: (patch) => set((s) => (s.draft ? { draft: { ...s.draft, ...patch } } : s)),
  addIngredient: (i) =>
    set((s) => (s.draft ? { draft: { ...s.draft, ingredients: [...s.draft.ingredients, i] } } : s)),
  setIngredientGrams: (index, grams) =>
    set((s) =>
      s.draft
        ? {
            draft: {
              ...s.draft,
              ingredients: s.draft.ingredients.map((x, i) => (i === index ? { ...x, grams } : x)),
            },
          }
        : s,
    ),
  removeIngredient: (index) =>
    set((s) =>
      s.draft
        ? { draft: { ...s.draft, ingredients: s.draft.ingredients.filter((_, i) => i !== index) } }
        : s,
    ),
  clear: () => set({ draft: null }),
}));
