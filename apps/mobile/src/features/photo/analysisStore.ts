import type { Food } from '@kalo/schemas';
import { create } from 'zustand';

import { applyFood, type EditableItem } from './reconcile';

interface AnalysisState {
  photoUri: string | null;
  dishName: string;
  notes: string;
  items: EditableItem[];
  /** Item being replaced via search, or null when adding a new one. */
  replacingKey: string | null;
  start: (p: { photoUri: string; dishName: string; notes: string; items: EditableItem[] }) => void;
  setGrams: (key: string, grams: number) => void;
  remove: (key: string) => void;
  beginReplace: (key: string | null) => void;
  /** Apply a food picked in search: replaces `replacingKey` or adds a new item. */
  pick: (food: Food, grams: number) => void;
  clear: () => void;
}

let counter = 0;

/** Editable result of a photo analysis; lives only in memory (the photo is never uploaded twice or stored). */
export const useAnalysis = create<AnalysisState>((set) => ({
  photoUri: null,
  dishName: '',
  notes: '',
  items: [],
  replacingKey: null,
  start: (p) => set({ ...p, replacingKey: null }),
  setGrams: (key, grams) =>
    set((s) => ({ items: s.items.map((i) => (i.key === key ? { ...i, grams } : i)) })),
  remove: (key) => set((s) => ({ items: s.items.filter((i) => i.key !== key) })),
  beginReplace: (key) => set({ replacingKey: key }),
  pick: (food, grams) =>
    set((s) => {
      if (s.replacingKey) {
        return {
          items: s.items.map((i) =>
            i.key === s.replacingKey ? { ...applyFood(i, food), grams } : i,
          ),
          replacingKey: null,
        };
      }
      const added: EditableItem = {
        key: `user-${++counter}`,
        name: food.name,
        grams,
        per100g: food.per100g,
        basis: 'user',
        foodId: food.id,
        confidence: 1,
        alternatives: [],
        aiPer100g: food.per100g,
      };
      return { items: [...s.items, added] };
    }),
  clear: () => set({ photoUri: null, dishName: '', notes: '', items: [], replacingKey: null }),
}));
