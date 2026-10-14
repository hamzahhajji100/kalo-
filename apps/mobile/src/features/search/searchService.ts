import {
  getCatalogFood,
  findByBarcode,
  rankFoods,
  searchCatalog,
  type SearchHit,
} from '@kalo/food-db';
import type { Food } from '@kalo/schemas';

import { getCatalog } from '@/data/catalog';
import { db } from '@/data/client';
import { listFavorites } from '@/data/repositories/favorites';
import { getFood, getFoodByBarcode, listUserFoods } from '@/data/repositories/foods';
import { getRecipe, listRecipes, recipeAsFood } from '@/data/repositories/recipes';

export interface ResultSection {
  key: 'mine' | 'catalog' | 'online';
  hits: SearchHit[];
}

/** Merge hit lists, keeping the first occurrence of a food id or barcode (earlier lists win). */
export function mergeHits(...lists: SearchHit[][]): SearchHit[] {
  const seenIds = new Set<string>();
  const seenBarcodes = new Set<string>();
  const out: SearchHit[] = [];
  for (const list of lists) {
    for (const h of list) {
      if (seenIds.has(h.food.id) || (h.food.barcode && seenBarcodes.has(h.food.barcode))) continue;
      seenIds.add(h.food.id);
      if (h.food.barcode) seenBarcodes.add(h.food.barcode);
      out.push(h);
    }
  }
  return out;
}

/** Offline search: own foods, recipes and favourites first, then the bundled catalogue. */
export function searchLocal(query: string, portionLabel: string): ResultSection[] {
  const own = [
    ...listUserFoods(db),
    ...listFavorites(db),
    ...listRecipes(db).flatMap((r) => recipeAsFood(r, portionLabel) ?? []),
  ];
  const mine = rankFoods(own, query).slice(0, 15);
  const catalog = getCatalog();
  const catalogHits = catalog ? searchCatalog(catalog, query, { limit: 40 }) : [];
  return [
    { key: 'mine', hits: mergeHits(mine) },
    { key: 'catalog', hits: mergeHits(mine, catalogHits).slice(mine.length) },
  ];
}

/** Resolve a food id from any local source (user DB, recipes, catalogue). */
export function resolveFoodLocal(id: string, portionLabel: string): Food | undefined {
  if (id.startsWith('recipe:')) {
    const r = getRecipe(db, id.slice('recipe:'.length));
    return r ? recipeAsFood(r, portionLabel) : undefined;
  }
  const own = getFood(db, id);
  if (own) return own;
  const catalog = getCatalog();
  return catalog ? getCatalogFood(catalog, id) : undefined;
}

/** Barcode lookup without network: device first (user-created/cached), then catalogue. */
export function findBarcodeLocal(barcode: string): Food | undefined {
  const own = getFoodByBarcode(db, barcode);
  if (own) return own;
  const catalog = getCatalog();
  return catalog ? findByBarcode(catalog, barcode) : undefined;
}
