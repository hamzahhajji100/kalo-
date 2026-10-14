import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import {
  AiLabelOutput,
  AiPhotoOutput,
  LabelReading,
  PhotoAnalysis,
  type ImageRequest,
} from '@kalo/schemas';

import type { Config } from './config';
import { ApiError } from './errors';

/** The part of the Anthropic client we use; injectable for tests. */
export type ClaudeClient = { beta: { messages: Pick<Anthropic['beta']['messages'], 'parse'> } };

const PHOTO_SYSTEM = `You are the food-recognition engine of a calorie-tracking app. You receive one photo of a meal.

Identify every separately visible component (e.g. rice, chicken, sauce, salad, bread) and estimate its weight in grams on the plate.
Use visual size cues: a standard dinner plate is about 26 cm wide, cutlery, cups, packaging and typical serving sizes.
For each component give energy and macronutrients for the estimated amount (not per 100 g), based on standard food composition data for that food as prepared.
Account for likely hidden fat: list cooking oil, butter, dressing or creamy sauce as their own component when the food is visibly fried, glossy or dressed.
Packaged products: if a brand or product is readable, use it in the name.
Confidence (0–1) reflects how sure you are about both identity and amount; below 0.6 add up to three plausible alternative identities.
If the image contains no food or drink, set containsFood to false and return no items.
Do not comment on health, dieting or body weight.`;

const LABEL_SYSTEM = `You read nutrition facts tables from product packaging (EU and US formats).
Return the values exactly as printed. Prefer the "per 100 g" or "per 100 ml" column and set basis accordingly.
If only a per-serving column exists, set basis to "serving_only", return those values and the serving size in grams.
Use null for anything not printed or not legible; never estimate missing values. Salt in grams (if only sodium is printed, return null for salt).
If no nutrition table is legible, set readable to false.`;

const langName = (locale: 'de' | 'en') => (locale === 'de' ? 'German' : 'English');

function imageContent(
  req: ImageRequest,
  instruction: string,
): Anthropic.Beta.BetaContentBlockParam[] {
  return [
    { type: 'image', source: { type: 'base64', media_type: req.mediaType, data: req.image } },
    { type: 'text', text: instruction },
  ];
}

/** Map SDK errors to API errors; never include request contents (images) in messages or logs. */
function mapError(e: unknown): never {
  if (e instanceof ApiError) throw e;
  if (e instanceof Anthropic.APIConnectionTimeoutError)
    throw new ApiError(504, 'upstream_timeout', 'Image analysis timed out');
  if (e instanceof Anthropic.RateLimitError)
    throw new ApiError(503, 'upstream_error', 'Analysis service is busy', 20);
  if (e instanceof Anthropic.APIError)
    throw new ApiError(502, 'upstream_error', `Analysis failed (${e.status ?? 'network'})`);
  throw new ApiError(502, 'upstream_error', 'Analysis failed');
}

async function callClaude<T>(
  client: ClaudeClient,
  cfg: Config,
  system: string,
  content: Anthropic.Beta.BetaContentBlockParam[],
  schema: Parameters<typeof betaZodOutputFormat>[0],
): Promise<T> {
  let res;
  try {
    res = await client.beta.messages.parse(
      {
        model: cfg.model,
        max_tokens: 4000,
        // Refusals are re-run server-side on Anthropic's recommended fallback model.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        output_config: { effort: cfg.effort, format: betaZodOutputFormat(schema) },
        messages: [{ role: 'user', content }],
      },
      { timeout: cfg.claudeTimeoutMs, maxRetries: 1 },
    );
  } catch (e) {
    mapError(e);
  }
  if (res.stop_reason === 'refusal')
    throw new ApiError(422, 'refused', 'The image could not be analysed');
  if (res.stop_reason === 'max_tokens' || res.parsed_output == null)
    throw new ApiError(502, 'upstream_error', 'Incomplete analysis');
  return res.parsed_output as T;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Clean up the model's estimate: drop empty items, clamp confidence and, if the stated energy
 * contradicts the macros by more than 25 %, use the Atwater energy instead.
 */
export function toPhotoAnalysis(out: AiPhotoOutput): PhotoAnalysis {
  if (!out.containsFood) return { status: 'no_food' };
  const items = out.items
    .filter((i) => i.name.trim() && i.grams > 0)
    .map((i) => {
      const macros = {
        protein: Math.max(0, i.protein),
        carbs: Math.max(0, i.carbs),
        fat: Math.max(0, i.fat),
      };
      const atwater = macros.protein * 4 + macros.carbs * 4 + macros.fat * 9;
      const kcal = Math.max(0, i.kcal);
      const consistent = atwater === 0 || Math.abs(kcal - atwater) <= Math.max(20, atwater * 0.25);
      return {
        name: i.name.trim(),
        nameEn: i.nameEn.trim(),
        grams: Math.round(Math.min(i.grams, 3000)),
        kcal: Math.round(consistent ? kcal : atwater),
        protein: r1(macros.protein),
        carbs: r1(macros.carbs),
        fat: r1(macros.fat),
        fiber: r1(Math.max(0, i.fiber)),
        sugar: r1(Math.max(0, i.sugar)),
        confidence: Math.min(1, Math.max(0, i.confidence)),
        alternatives: i.alternatives.filter((a) => a.trim()).slice(0, 3),
      };
    });
  if (items.length === 0) return { status: 'no_food' };
  return PhotoAnalysis.parse({
    status: 'ok',
    dishName: out.dishName.trim(),
    items,
    notes: out.notes.trim(),
  });
}

/** Normalise a label reading to per-100 g values; unusable readings become "unreadable". */
export function toLabelReading(out: AiLabelOutput): LabelReading {
  if (!out.readable) return { status: 'unreadable' };
  let factor = 1;
  if (out.basis === 'serving_only') {
    if (!out.servingGrams || out.servingGrams <= 0) return { status: 'unreadable' };
    factor = 100 / out.servingGrams;
  }
  const kcal = out.kcal ?? (out.kj !== null ? out.kj / 4.184 : null);
  if (kcal === null || out.protein === null || out.carbs === null || out.fat === null)
    return { status: 'unreadable' };
  const s = (v: number | null) => (v === null ? null : Math.round(v * factor * 100) / 100);
  const parsed = LabelReading.safeParse({
    status: 'ok',
    isLiquid: out.basis === '100ml',
    productName: out.productName?.trim() || null,
    brand: out.brand?.trim() || null,
    kcal: Math.round(kcal * factor),
    protein: s(out.protein),
    carbs: s(out.carbs),
    fat: s(out.fat),
    sugar: s(out.sugar),
    saturatedFat: s(out.saturatedFat),
    fiber: s(out.fiber),
    salt: s(out.salt),
    servingGrams: out.servingGrams && out.servingGrams > 0 ? out.servingGrams : null,
    packageGrams: out.packageGrams && out.packageGrams > 0 ? out.packageGrams : null,
  });
  return parsed.success ? parsed.data : { status: 'unreadable' };
}

export async function analyzePhoto(
  client: ClaudeClient,
  cfg: Config,
  req: ImageRequest,
): Promise<PhotoAnalysis> {
  const out = await callClaude<AiPhotoOutput>(
    client,
    cfg,
    PHOTO_SYSTEM,
    imageContent(
      req,
      `Analyse this meal. Write component names, dish name and notes in ${langName(req.locale)}; nameEn always in English.`,
    ),
    AiPhotoOutput,
  );
  return toPhotoAnalysis(out);
}

export async function readLabel(
  client: ClaudeClient,
  cfg: Config,
  req: ImageRequest,
): Promise<LabelReading> {
  const out = await callClaude<AiLabelOutput>(
    client,
    cfg,
    LABEL_SYSTEM,
    imageContent(req, 'Read the nutrition facts table in this photo.'),
    AiLabelOutput,
  );
  return toLabelReading(out);
}
