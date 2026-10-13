import { z } from 'zod';

/** Where a food record came from. Shown to the user and used for licence attribution. */
export const FoodSource = z.enum(['off', 'usda', 'custom', 'ai', 'recipe']);
export type FoodSource = z.infer<typeof FoodSource>;

const grams = z.number().finite().min(0);

/** Nutrients per 100 g (or 100 ml). Core macros are required; everything else optional. */
export const Nutrients = z.object({
  kcal: z.number().finite().min(0).max(900),
  protein: grams.max(100),
  carbs: grams.max(100),
  fat: grams.max(100),
  fiber: grams.max(100).optional(),
  sugar: grams.max(100).optional(),
  saturatedFat: grams.max(100).optional(),
  salt: grams.max(100).optional(),
});
export type Nutrients = z.infer<typeof Nutrients>;

/** Micronutrients per 100 g, units noted in the key (mg/µg). */
export const Micros = z
  .object({
    ironMg: z.number().min(0),
    calciumMg: z.number().min(0),
    magnesiumMg: z.number().min(0),
    potassiumMg: z.number().min(0),
    zincMg: z.number().min(0),
    vitaminCMg: z.number().min(0),
    vitaminDUg: z.number().min(0),
    vitaminB12Ug: z.number().min(0),
  })
  .partial();
export type Micros = z.infer<typeof Micros>;

export const Portion = z.object({
  /** e.g. "1 Portion", "1 Packung", "1 Scheibe" */
  label: z.string().min(1),
  grams: z.number().positive(),
});
export type Portion = z.infer<typeof Portion>;

export const NutriScore = z.enum(['a', 'b', 'c', 'd', 'e']);

/** The single internal food model every source is mapped to. */
export const Food = z.object({
  /** Stable id: `${source}:${sourceId}` */
  id: z.string().min(1),
  source: FoodSource,
  sourceId: z.string().min(1),
  barcode: z
    .string()
    .regex(/^\d{8,14}$/)
    .optional(),
  name: z.string().min(1),
  /** Name in the other supported language, for bilingual search. */
  nameAlt: z.string().optional(),
  brand: z.string().optional(),
  imageUrl: z.string().url().optional(),
  /** true for liquids: values are per 100 ml. */
  isLiquid: z.boolean().default(false),
  per100g: Nutrients,
  micros: Micros.optional(),
  portions: z.array(Portion).default([]),
  nutriScore: NutriScore.optional(),
  ingredients: z.string().optional(),
  /** Normalised allergen tags, e.g. "milk", "gluten", "nuts". */
  allergens: z.array(z.string()).default([]),
  /** Data from a curated database (USDA, verified OFF) rather than user/AI estimates. */
  verified: z.boolean().default(false),
  updatedAt: z.string().optional(),
});
export type Food = z.infer<typeof Food>;
export type FoodInput = z.input<typeof Food>;

export const foodId = (source: FoodSource, sourceId: string) => `${source}:${sourceId}`;
