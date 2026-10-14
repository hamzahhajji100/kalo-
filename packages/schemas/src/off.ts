import { isPlausiblePer100g, kjToKcal, sodiumToSalt } from '@kalo/core';
import { z } from 'zod';

import { foodId, type Food, type Portion } from './food';
import { looseNumber, round } from './num';

/**
 * Open Food Facts product (API v2/v3 `product` object and JSONL dump lines share this shape).
 * Only the fields we use are declared; everything is optional because OFF data is crowd-sourced.
 */
export const OffProduct = z.object({
  code: z.string(),
  product_name: z.string().optional(),
  product_name_de: z.string().optional(),
  product_name_en: z.string().optional(),
  generic_name_de: z.string().optional(),
  generic_name: z.string().optional(),
  brands: z.string().optional(),
  image_front_url: z.string().optional(),
  image_url: z.string().optional(),
  quantity: z.string().optional(),
  product_quantity: looseNumber,
  product_quantity_unit: z.string().optional(),
  serving_size: z.string().optional(),
  serving_quantity: looseNumber,
  nutrition_data_per: z.string().optional(),
  nutriscore_grade: z.string().optional(),
  ingredients_text_de: z.string().optional(),
  ingredients_text: z.string().optional(),
  allergens_tags: z.array(z.string()).optional(),
  states_tags: z.array(z.string()).optional(),
  unique_scans_n: looseNumber,
  last_modified_t: looseNumber,
  nutriments: z.record(z.string(), z.unknown()).optional(),
});
export type OffProduct = z.infer<typeof OffProduct>;

/** API envelope: `{ status: 1, product }` (v2) or `{ status: "success", product }` (v3). */
export const OffProductResponse = z.object({
  status: z.union([z.number(), z.string()]),
  product: z.unknown().optional(),
});

export const OffSearchResponse = z.object({
  count: looseNumber,
  page: looseNumber,
  products: z.array(z.unknown()),
});

/** Fields to request from OFF so responses stay small. */
export const OFF_FIELDS = [
  'code',
  'product_name',
  'product_name_de',
  'product_name_en',
  'generic_name_de',
  'generic_name',
  'brands',
  'image_front_url',
  'image_url',
  'quantity',
  'product_quantity',
  'product_quantity_unit',
  'serving_size',
  'serving_quantity',
  'nutrition_data_per',
  'nutriscore_grade',
  'ingredients_text_de',
  'ingredients_text',
  'allergens_tags',
  'states_tags',
  'unique_scans_n',
  'last_modified_t',
  'nutriments',
] as const;

const MICRO_KEYS = {
  ironMg: 'iron',
  calciumMg: 'calcium',
  magnesiumMg: 'magnesium',
  potassiumMg: 'potassium',
  zincMg: 'zinc',
  vitaminCMg: 'vitamin-c',
} as const;

const num = (n: Record<string, unknown>, key: string): number | undefined =>
  looseNumber.parse(n[key]);

const firstNonEmpty = (...values: (string | undefined)[]) =>
  values.map((v) => v?.trim()).find((v) => !!v);

const isLiquid = (p: OffProduct) =>
  p.product_quantity_unit?.toLowerCase() === 'ml' || /\d\s*(m?l|cl)\b/i.test(p.quantity ?? '');

export type MapResult =
  { ok: true; food: Food; popularity: number } | { ok: false; reason: string };

/**
 * Map an OFF product to the internal Food model. Rejects products without a name, without
 * per-100 g core values, or with implausible values (e.g. energy that contradicts the macros).
 */
export function mapOffProduct(raw: unknown, lang: 'de' | 'en' = 'de'): MapResult {
  const parsed = OffProduct.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: 'schema' };
  const p = parsed.data;
  if (!/^\d{8,14}$/.test(p.code)) return { ok: false, reason: 'barcode' };

  const name =
    lang === 'de'
      ? firstNonEmpty(
          p.product_name_de,
          p.product_name,
          p.generic_name_de,
          p.product_name_en,
          p.generic_name,
        )
      : firstNonEmpty(p.product_name_en, p.product_name, p.generic_name, p.product_name_de);
  if (!name) return { ok: false, reason: 'name' };

  const n = p.nutriments ?? {};
  const kcal =
    num(n, 'energy-kcal_100g') ??
    (num(n, 'energy-kj_100g') !== undefined ? kjToKcal(num(n, 'energy-kj_100g')!) : undefined);
  const protein = num(n, 'proteins_100g');
  const carbs = num(n, 'carbohydrates_100g');
  const fat = num(n, 'fat_100g');
  if (kcal === undefined || protein === undefined || carbs === undefined || fat === undefined) {
    return { ok: false, reason: 'nutrients' };
  }

  const salt =
    num(n, 'salt_100g') ??
    (num(n, 'sodium_100g') !== undefined ? sodiumToSalt(num(n, 'sodium_100g')!) : undefined);
  const per100g = {
    kcal: round(kcal, 1),
    protein: round(protein),
    carbs: round(carbs),
    fat: round(fat),
    ...(num(n, 'fiber_100g') !== undefined && { fiber: round(num(n, 'fiber_100g')!) }),
    ...(num(n, 'sugars_100g') !== undefined && { sugar: round(num(n, 'sugars_100g')!) }),
    ...(num(n, 'saturated-fat_100g') !== undefined && {
      saturatedFat: round(num(n, 'saturated-fat_100g')!),
    }),
    ...(salt !== undefined && { salt: round(salt, 3) }),
  };
  if (!isPlausiblePer100g(per100g)) return { ok: false, reason: 'implausible' };

  // OFF stores minerals/vitamins in grams per 100 g.
  const micros = Object.fromEntries(
    Object.entries(MICRO_KEYS)
      .map(([key, offKey]) => [key, num(n, `${offKey}_100g`)] as const)
      .filter(([, v]) => v !== undefined)
      .map(([key, v]) => [key, round(v! * 1000, 3)]),
  );
  const vitD = num(n, 'vitamin-d_100g');
  if (vitD !== undefined) micros.vitaminDUg = round(vitD * 1e6, 3);
  const b12 = num(n, 'vitamin-b12_100g');
  if (b12 !== undefined) micros.vitaminB12Ug = round(b12 * 1e6, 3);

  const liquid = isLiquid(p);
  const portions: Portion[] = [];
  if (p.serving_quantity && p.serving_quantity > 0 && p.serving_quantity < 5000) {
    portions.push({ label: p.serving_size?.trim() || 'serving', grams: p.serving_quantity });
  }
  if (p.product_quantity && p.product_quantity > 0 && p.product_quantity < 20000) {
    portions.push({ label: 'package', grams: p.product_quantity });
  }

  const imageUrl = firstNonEmpty(p.image_front_url, p.image_url);
  const nutriScore = p.nutriscore_grade?.toLowerCase();
  const ingredients =
    lang === 'de'
      ? firstNonEmpty(p.ingredients_text_de, p.ingredients_text)
      : firstNonEmpty(p.ingredients_text);
  const brand = firstNonEmpty(p.brands?.split(',')[0]);

  const food: Food = {
    id: foodId('off', p.code),
    source: 'off',
    sourceId: p.code,
    barcode: p.code,
    name,
    ...(brand && { brand }),
    ...(imageUrl?.startsWith('https://') && { imageUrl }),
    isLiquid: liquid,
    per100g,
    ...(Object.keys(micros).length > 0 && { micros }),
    portions,
    ...(nutriScore &&
      /^[a-e]$/.test(nutriScore) && { nutriScore: nutriScore as Food['nutriScore'] }),
    ...(ingredients && { ingredients }),
    allergens: (p.allergens_tags ?? []).map((t) => t.replace(/^[a-z]{2}:/, '')),
    verified: (p.states_tags ?? []).includes('en:nutrition-facts-completed'),
    ...(p.last_modified_t && { updatedAt: new Date(p.last_modified_t * 1000).toISOString() }),
  };
  return { ok: true, food, popularity: p.unique_scans_n ?? 0 };
}
