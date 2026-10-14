import { isPlausiblePer100g, sodiumToSalt } from '@kalo/core';
import { z } from 'zod';

import { foodId, type Food, type Micros, type Portion } from './food';
import { looseNumber, round } from './num';

/** FoodData Central nutrient ids we use (values per 100 g). */
export const USDA_NUTRIENT = {
  energyKcal: 1008,
  energyAtwaterGeneral: 2047,
  energyAtwaterSpecific: 2048,
  protein: 1003,
  fat: 1004,
  carbs: 1005,
  fiber: 1079,
  sugars: 2000,
  sugarsNlea: 1063,
  saturatedFat: 1258,
  sodiumMg: 1093,
  calciumMg: 1087,
  ironMg: 1089,
  magnesiumMg: 1090,
  potassiumMg: 1092,
  zincMg: 1095,
  vitaminCMg: 1162,
  vitaminDUg: 1114,
  vitaminB12Ug: 1178,
} as const;

/** Nutrient as returned by /foods/search (flat) or /food/{id} (nested). */
const UsdaFoodNutrient = z.union([
  z.object({ nutrientId: z.number(), value: looseNumber }),
  z.object({ nutrient: z.object({ id: z.number() }), amount: looseNumber }),
]);

const UsdaPortion = z.object({
  gramWeight: looseNumber,
  portionDescription: z.string().optional(),
  modifier: z.string().optional(),
  amount: looseNumber,
  measureUnit: z.object({ name: z.string().optional() }).optional(),
});

export const UsdaFood = z.object({
  fdcId: z.number(),
  description: z.string().min(1),
  dataType: z.string().optional(),
  brandOwner: z.string().optional(),
  brandName: z.string().optional(),
  gtinUpc: z.string().optional(),
  servingSize: looseNumber,
  servingSizeUnit: z.string().optional(),
  householdServingFullText: z.string().optional(),
  ingredients: z.string().optional(),
  foodNutrients: z.array(z.unknown()).default([]),
  foodPortions: z.array(z.unknown()).optional(),
});
export type UsdaFood = z.infer<typeof UsdaFood>;

export const UsdaSearchResponse = z.object({
  totalHits: looseNumber,
  foods: z.array(z.unknown()).default([]),
});

/** Flatten either nutrient shape into id → value. Unknown entries are skipped. */
export function usdaNutrientMap(foodNutrients: unknown[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const raw of foodNutrients) {
    const r = UsdaFoodNutrient.safeParse(raw);
    if (!r.success) continue;
    const [id, value] =
      'nutrientId' in r.data
        ? [r.data.nutrientId, r.data.value]
        : [r.data.nutrient.id, r.data.amount];
    if (value !== undefined && !out.has(id)) out.set(id, value);
  }
  return out;
}

const MICRO_IDS: [keyof Micros, number][] = [
  ['ironMg', USDA_NUTRIENT.ironMg],
  ['calciumMg', USDA_NUTRIENT.calciumMg],
  ['magnesiumMg', USDA_NUTRIENT.magnesiumMg],
  ['potassiumMg', USDA_NUTRIENT.potassiumMg],
  ['zincMg', USDA_NUTRIENT.zincMg],
  ['vitaminCMg', USDA_NUTRIENT.vitaminCMg],
  ['vitaminDUg', USDA_NUTRIENT.vitaminDUg],
  ['vitaminB12Ug', USDA_NUTRIENT.vitaminB12Ug],
];

export type UsdaMapResult = { ok: true; food: Food } | { ok: false; reason: string };

/**
 * Build a Food from USDA per-100 g nutrient values. Shared by the API mapper and the CSV importer.
 * Foundation foods often lack 1008 (kcal) and report Atwater energy (2047/2048) instead.
 */
export function usdaToFood(params: {
  fdcId: number;
  description: string;
  nutrients: Map<number, number>;
  dataType?: string;
  brand?: string;
  barcode?: string;
  portions?: Portion[];
  ingredients?: string;
}): UsdaMapResult {
  const n = params.nutrients;
  const kcal =
    n.get(USDA_NUTRIENT.energyKcal) ??
    n.get(USDA_NUTRIENT.energyAtwaterSpecific) ??
    n.get(USDA_NUTRIENT.energyAtwaterGeneral);
  const protein = n.get(USDA_NUTRIENT.protein);
  const fat = n.get(USDA_NUTRIENT.fat);
  const carbs = n.get(USDA_NUTRIENT.carbs);
  if (kcal === undefined || protein === undefined || fat === undefined || carbs === undefined) {
    return { ok: false, reason: 'nutrients' };
  }
  const sugar = n.get(USDA_NUTRIENT.sugars) ?? n.get(USDA_NUTRIENT.sugarsNlea);
  const sodiumMg = n.get(USDA_NUTRIENT.sodiumMg);
  const per100g = {
    kcal: round(kcal, 1),
    protein: round(protein),
    carbs: round(carbs),
    fat: round(fat),
    ...(n.has(USDA_NUTRIENT.fiber) && { fiber: round(n.get(USDA_NUTRIENT.fiber)!) }),
    ...(sugar !== undefined && { sugar: round(sugar) }),
    ...(n.has(USDA_NUTRIENT.saturatedFat) && {
      saturatedFat: round(n.get(USDA_NUTRIENT.saturatedFat)!),
    }),
    ...(sodiumMg !== undefined && { salt: round(sodiumToSalt(sodiumMg / 1000), 3) }),
  };
  if (!isPlausiblePer100g(per100g)) return { ok: false, reason: 'implausible' };

  const micros: Micros = {};
  for (const [key, id] of MICRO_IDS) {
    const v = n.get(id);
    if (v !== undefined) micros[key] = round(v, 3);
  }
  const barcode = params.barcode?.replace(/^0+(?=\d{8,14}$)/, '');
  const branded = params.dataType?.toLowerCase().includes('branded') ?? false;

  return {
    ok: true,
    food: {
      id: foodId('usda', String(params.fdcId)),
      source: 'usda',
      sourceId: String(params.fdcId),
      ...(barcode && /^\d{8,14}$/.test(barcode) && { barcode }),
      name: params.description,
      ...(params.brand && { brand: params.brand }),
      isLiquid: false,
      per100g,
      ...(Object.keys(micros).length > 0 && { micros }),
      portions: params.portions ?? [],
      ...(params.ingredients && { ingredients: params.ingredients }),
      allergens: [],
      // Foundation/SR Legacy are lab-analysed reference data; branded data is label data.
      verified: !branded,
    },
  };
}

/** Map a FoodData Central API food (search hit or detail). */
export function mapUsdaFood(raw: unknown): UsdaMapResult {
  const parsed = UsdaFood.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: 'schema' };
  const f = parsed.data;

  const portions: Portion[] = [];
  for (const raw of f.foodPortions ?? []) {
    const p = UsdaPortion.safeParse(raw);
    if (!p.success || !p.data.gramWeight) continue;
    const label =
      p.data.portionDescription ||
      [p.data.amount, p.data.modifier ?? p.data.measureUnit?.name].filter(Boolean).join(' ');
    if (label) portions.push({ label, grams: p.data.gramWeight });
  }
  if (f.servingSize && f.servingSizeUnit?.toLowerCase() === 'g') {
    portions.unshift({ label: f.householdServingFullText || 'serving', grams: f.servingSize });
  }

  return usdaToFood({
    fdcId: f.fdcId,
    description: f.description,
    nutrients: usdaNutrientMap(f.foodNutrients),
    ...(f.dataType && { dataType: f.dataType }),
    ...((f.brandName || f.brandOwner) && { brand: (f.brandName || f.brandOwner)! }),
    ...(f.gtinUpc && { barcode: f.gtinUpc }),
    portions,
    ...(f.ingredients && { ingredients: f.ingredients }),
  });
}
