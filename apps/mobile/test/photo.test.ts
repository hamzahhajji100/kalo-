import type { SearchHit } from '@kalo/food-db';
import type { Food, PhotoItem } from '@kalo/schemas';
import { describe, expect, it } from 'vitest';

import { toAiError } from '@/features/photo/api';
import { useAnalysis } from '@/features/photo/analysisStore';
import {
  aiPer100g,
  applyFood,
  itemNutrients,
  needsConfirmation,
  reconcileItem,
} from '@/features/photo/reconcile';
import { HttpError } from '@/lib/http';

const rice: PhotoItem = {
  name: 'Reis, gekocht',
  nameEn: 'Rice, white, cooked',
  grams: 200,
  kcal: 260,
  protein: 5.4,
  carbs: 56,
  fat: 0.6,
  fiber: 0.8,
  sugar: 0,
  confidence: 0.55,
  alternatives: ['Couscous'],
};
const food = (id: string, name: string, kcal: number, verified = true): Food => ({
  id,
  source: 'usda',
  sourceId: id,
  name,
  isLiquid: false,
  per100g: { kcal, protein: 2.7, carbs: 28, fat: 0.3 },
  portions: [],
  allergens: [],
  verified,
});
const hits = (...h: [Food, number][]): SearchHit[] => h.map(([f, score]) => ({ food: f, score }));

describe('reconcileItem', () => {
  it('derives per-100 g values from the AI estimate', () => {
    expect(aiPer100g(rice)).toMatchObject({ kcal: 130, protein: 2.7, carbs: 28 });
  });

  it('prefers a verified, relevant database match', () => {
    const r = reconcileItem(rice, 'a', (q) =>
      q === 'Reis, gekocht' ? hits([food('usda:1', 'Reis, weiß, gekocht', 130), 1.1]) : [],
    );
    expect(r).toMatchObject({ basis: 'db', foodId: 'usda:1', per100g: { kcal: 130 }, grams: 200 });
    expect(itemNutrients(r).kcal).toBe(260);
  });

  it('falls back to the AI when matches are weak, unverified or contradictory', () => {
    expect(reconcileItem(rice, 'a', () => hits([food('usda:1', 'Reis', 130), 0.5])).basis).toBe(
      'ai',
    );
    expect(
      reconcileItem(rice, 'a', () => hits([food('off:1', 'Reis', 130, false), 1.2])).basis,
    ).toBe('ai');
    // Raw rice (360 kcal) vs. cooked estimate (130 kcal): wrong state, keep the AI value but remember the candidate.
    const raw = reconcileItem(rice, 'a', () => hits([food('usda:2', 'Reis, weiß, roh', 360), 1.2]));
    expect(raw).toMatchObject({ basis: 'ai', rejectedMatch: { foodId: 'usda:2' } });
  });

  it('flags low confidence until the user decides', () => {
    const item = reconcileItem(rice, 'a', () => []);
    expect(needsConfirmation(item)).toBe(true);
    const picked = applyFood(item, food('usda:3', 'Couscous, gekocht', 112));
    expect(picked).toMatchObject({
      basis: 'user',
      name: 'Couscous, gekocht',
      grams: 200,
      confidence: 1,
      alternatives: [],
    });
    expect(needsConfirmation(picked)).toBe(false);
  });
});

describe('analysis store', () => {
  it('edits, replaces, adds and removes items', () => {
    const s = useAnalysis.getState();
    s.start({
      photoUri: 'file://x.jpg',
      dishName: 'Teller',
      notes: '',
      items: [reconcileItem(rice, 'a', () => [])],
    });
    useAnalysis.getState().setGrams('a', 150);
    expect(useAnalysis.getState().items[0]!.grams).toBe(150);
    useAnalysis.getState().beginReplace('a');
    useAnalysis.getState().pick(food('usda:3', 'Couscous', 112), 180);
    expect(useAnalysis.getState().items[0]).toMatchObject({
      name: 'Couscous',
      grams: 180,
      basis: 'user',
    });
    useAnalysis.getState().beginReplace(null);
    useAnalysis.getState().pick(food('usda:4', 'Olivenöl', 884), 10);
    expect(useAnalysis.getState().items.map((i) => i.name)).toEqual(['Couscous', 'Olivenöl']);
    useAnalysis.getState().remove('a');
    expect(useAnalysis.getState().items).toHaveLength(1);
    useAnalysis.getState().clear();
    expect(useAnalysis.getState().items).toEqual([]);
  });
});

describe('toAiError', () => {
  it('maps API codes and transport errors', () => {
    expect(
      toAiError(new HttpError('client', 'x', 422, undefined, { error: 'refused', message: '' }))
        .kind,
    ).toBe('refused');
    expect(
      toAiError(
        new HttpError('server', 'x', 503, undefined, { error: 'not_configured', message: '' }),
      ).kind,
    ).toBe('not_configured');
    expect(
      toAiError(
        new HttpError('server', 'x', 504, undefined, { error: 'upstream_timeout', message: '' }),
      ).kind,
    ).toBe('timeout');
    expect(toAiError(new HttpError('timeout', 'x')).kind).toBe('timeout');
    expect(toAiError(new HttpError('rate_limited', 'x', 429, 3600))).toMatchObject({
      kind: 'rate_limited',
      retryAfter: 3600,
    });
    expect(toAiError(new HttpError('offline', 'x')).kind).toBe('offline');
    expect(toAiError(new Error('?')).kind).toBe('server');
    const e = toAiError(new HttpError('offline', 'x'));
    expect(toAiError(e)).toBe(e);
  });
});
