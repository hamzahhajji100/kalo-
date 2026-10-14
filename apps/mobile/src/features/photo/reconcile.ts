import { relativeKcalDeviation, scaleNutrients, type Nutrients } from '@kalo/core';
import type { SearchHit } from '@kalo/food-db';
import type { Food, PhotoItem } from '@kalo/schemas';

export interface EditableItem {
  key: string;
  name: string;
  grams: number;
  /** Values per 100 g used for calculation. */
  per100g: Nutrients;
  /** 'db' = verified database values; 'ai' = AI estimate; 'user' = picked by the user. */
  basis: 'db' | 'ai' | 'user';
  foodId: string | null;
  confidence: number;
  alternatives: string[];
  /** The AI's own per-100 g estimate, kept to explain deviations. */
  aiPer100g: Nutrients;
  /** A database match that was not applied because it contradicts the AI estimate too much. */
  rejectedMatch?: { foodId: string; name: string };
}

/** Database hits must be at least this relevant to be used automatically. */
export const MATCH_MIN_SCORE = 0.8;
/** If database and AI energy per 100 g differ by more than this, the match is probably wrong (e.g. raw vs cooked). */
export const MAX_DEVIATION = 0.6;
export const LOW_CONFIDENCE = 0.6;

export function aiPer100g(item: PhotoItem): Nutrients {
  const f = 100 / item.grams;
  return {
    kcal: item.kcal * f,
    protein: item.protein * f,
    carbs: item.carbs * f,
    fat: item.fat * f,
    fiber: item.fiber * f,
    sugar: item.sugar * f,
  };
}

/**
 * Prefer verified per-100 g values from the database for the AI's portion estimate.
 * The AI estimate is used when no good match exists or the match contradicts it strongly.
 */
export function reconcileItem(
  item: PhotoItem,
  key: string,
  search: (query: string) => SearchHit[],
): EditableItem {
  const ai = aiPer100g(item);
  const base: EditableItem = {
    key,
    name: item.name,
    grams: item.grams,
    per100g: ai,
    basis: 'ai',
    foodId: null,
    confidence: item.confidence,
    alternatives: item.alternatives,
    aiPer100g: ai,
  };
  const queries = [item.name, item.nameEn].filter((q, i, a) => q && a.indexOf(q) === i);
  const hit = queries
    .flatMap((q) => search(q).slice(0, 3))
    .filter((h) => h.food.verified && h.score >= MATCH_MIN_SCORE)
    .sort((a, b) => b.score - a.score)[0];
  if (!hit) return base;
  if (relativeKcalDeviation(hit.food.per100g.kcal, ai.kcal) > MAX_DEVIATION) {
    return { ...base, rejectedMatch: { foodId: hit.food.id, name: hit.food.name } };
  }
  return { ...base, per100g: hit.food.per100g, basis: 'db', foodId: hit.food.id };
}

/** Replace an item's identity with a food the user picked; the amount stays. */
export function applyFood(item: EditableItem, food: Food): EditableItem {
  return {
    ...item,
    name: food.name,
    per100g: food.per100g,
    basis: 'user',
    foodId: food.id,
    confidence: 1,
    alternatives: [],
    rejectedMatch: undefined,
  };
}

export const itemNutrients = (i: EditableItem) => scaleNutrients(i.per100g, i.grams);

export const needsConfirmation = (i: EditableItem) =>
  i.basis !== 'user' && i.confidence < LOW_CONFIDENCE;
