import { z } from 'zod';

/** Max decoded image size accepted by the API (the app sends ~1024 px JPEGs, typically 100–300 KB). */
export const MAX_IMAGE_BYTES = 1_500_000;

export const ImageMediaType = z.enum(['image/jpeg', 'image/png', 'image/webp']);

export const ImageRequest = z.object({
  /** Base64 without data-URL prefix. */
  image: z
    .string()
    .min(100)
    .max(Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 4)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, 'image must be plain base64'),
  mediaType: ImageMediaType,
  locale: z.enum(['de', 'en']).default('de'),
});
export type ImageRequest = z.infer<typeof ImageRequest>;

/**
 * Shape the model is asked to produce (kept free of numeric constraints so it can be used as a
 * structured-output schema). Values are for the estimated portion, not per 100 g.
 */
export const AiPhotoOutput = z.object({
  containsFood: z.boolean(),
  dishName: z.string(),
  items: z.array(
    z.object({
      name: z
        .string()
        .describe(
          'Short name of one component in the requested language, e.g. "Basmatireis, gekocht"',
        ),
      nameEn: z.string().describe('Same name in English, for database matching'),
      grams: z.number().describe('Estimated weight of this component on the plate in grams'),
      kcal: z.number(),
      protein: z.number(),
      carbs: z.number(),
      fat: z.number(),
      fiber: z.number(),
      sugar: z.number(),
      confidence: z.number().describe('0–1: how sure you are about identity and amount'),
      alternatives: z
        .array(z.string())
        .describe('Up to 3 plausible alternative identities if unsure, else empty'),
    }),
  ),
  notes: z
    .string()
    .describe('One short sentence about hidden ingredients (oil, sauce) if relevant, else empty'),
});
export type AiPhotoOutput = z.infer<typeof AiPhotoOutput>;

const nonNeg = z.number().finite().min(0);

/** Validated photo analysis returned by the Kalo API to the app. */
export const PhotoItem = z.object({
  name: z.string().min(1),
  nameEn: z.string(),
  grams: z.number().positive().max(3000),
  kcal: nonNeg.max(5000),
  protein: nonNeg.max(500),
  carbs: nonNeg.max(1000),
  fat: nonNeg.max(500),
  fiber: nonNeg.max(200),
  sugar: nonNeg.max(500),
  confidence: z.number().min(0).max(1),
  alternatives: z.array(z.string()).max(3),
});
export type PhotoItem = z.infer<typeof PhotoItem>;

export const PhotoAnalysis = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    dishName: z.string(),
    items: z.array(PhotoItem).min(1),
    notes: z.string(),
  }),
  z.object({ status: z.literal('no_food') }),
]);
export type PhotoAnalysis = z.infer<typeof PhotoAnalysis>;

/** Model output for reading a nutrition label. Null = not printed / not legible. */
export const AiLabelOutput = z.object({
  readable: z.boolean(),
  basis: z.enum(['100g', '100ml', 'serving_only']),
  productName: z.string().nullable(),
  brand: z.string().nullable(),
  kcal: z.number().nullable(),
  kj: z.number().nullable(),
  fat: z.number().nullable(),
  saturatedFat: z.number().nullable(),
  carbs: z.number().nullable(),
  sugar: z.number().nullable(),
  fiber: z.number().nullable(),
  protein: z.number().nullable(),
  salt: z.number().nullable(),
  servingGrams: z.number().nullable(),
  packageGrams: z.number().nullable(),
});
export type AiLabelOutput = z.infer<typeof AiLabelOutput>;

export const LabelReading = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    isLiquid: z.boolean(),
    productName: z.string().nullable(),
    brand: z.string().nullable(),
    /** Per 100 g/ml. */
    kcal: nonNeg.max(900),
    protein: nonNeg.max(100),
    carbs: nonNeg.max(100),
    fat: nonNeg.max(100),
    sugar: nonNeg.max(100).nullable(),
    saturatedFat: nonNeg.max(100).nullable(),
    fiber: nonNeg.max(100).nullable(),
    salt: nonNeg.max(100).nullable(),
    servingGrams: z.number().positive().max(5000).nullable(),
    packageGrams: z.number().positive().max(20000).nullable(),
  }),
  z.object({ status: z.literal('unreadable') }),
]);
export type LabelReading = z.infer<typeof LabelReading>;

export const DeviceTokenRequest = z.object({ deviceId: z.string().uuid() });

export const ApiErrorBody = z.object({
  error: z.enum([
    'invalid_request',
    'unauthorized',
    'rate_limited',
    'refused',
    'upstream_timeout',
    'upstream_error',
    'not_configured',
  ]),
  message: z.string(),
  retryAfter: z.number().optional(),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBody>;
