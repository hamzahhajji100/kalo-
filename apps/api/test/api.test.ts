import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';

import { createApp, type Deps } from '../src/app';
import { toLabelReading, toPhotoAnalysis, type ClaudeClient } from '../src/claude';
import { readConfig } from '../src/config';
import { consume, MemoryCounterStore, secondsUntilUtcMidnight } from '../src/rateLimit';
import { issueToken, verifyToken } from '../src/token';

const SECRET = 'test-secret';
const DEVICE = '3f1c2b9e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
const IMAGE = 'A'.repeat(400);

const photoOut = {
  containsFood: true,
  dishName: 'Hähnchen mit Reis',
  items: [
    {
      name: 'Hähnchenbrust, gebraten',
      nameEn: 'Chicken breast, roasted',
      grams: 150,
      kcal: 248,
      protein: 46.5,
      carbs: 0,
      fat: 5.4,
      fiber: 0,
      sugar: 0,
      confidence: 0.9,
      alternatives: [],
    },
    {
      name: 'Basmatireis',
      nameEn: 'Basmati rice, cooked',
      grams: 180,
      kcal: 900,
      protein: 4.9,
      carbs: 50,
      fat: 0.5,
      fiber: 0.7,
      sugar: 0.1,
      confidence: 0.5,
      alternatives: ['Couscous', 'Quinoa', 'Bulgur', 'Hirse'],
    },
    {
      name: ' ',
      nameEn: '',
      grams: 10,
      kcal: 1,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      confidence: 2,
      alternatives: [],
    },
  ],
  notes: 'Vermutlich mit etwas Öl gebraten.',
};

function fakeClaude(
  result: Partial<{ stop_reason: string; parsed_output: unknown }> | Error,
): ClaudeClient & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    beta: {
      messages: {
        parse: vi.fn(async (params: unknown) => {
          calls.push(params);
          if (result instanceof Error) throw result;
          return { stop_reason: 'end_turn', ...result };
        }) as unknown as ClaudeClient['beta']['messages']['parse'],
      },
    },
  };
}

function setup(over: Partial<Deps> = {}) {
  const config = {
    ...readConfig({ TOKEN_SECRET: SECRET, USDA_API_KEY: 'k', PHOTO_DAILY_LIMIT: '2' }),
  };
  const deps: Deps = {
    config,
    claude: fakeClaude({ parsed_output: photoOut }),
    counters: new MemoryCounterStore(),
    ...over,
  };
  return { app: createApp(deps), deps };
}

async function auth(app: ReturnType<typeof createApp>) {
  const res = await app.request('/v1/device', {
    method: 'POST',
    body: JSON.stringify({ deviceId: DEVICE }),
    headers: { 'Content-Type': 'application/json' },
  });
  const { token } = (await res.json()) as { token: string };
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

const post = (
  app: ReturnType<typeof createApp>,
  path: string,
  headers: Record<string, string>,
  body: unknown,
) => app.request(path, { method: 'POST', headers, body: JSON.stringify(body) });

describe('device tokens', () => {
  it('issues and verifies tokens, rejecting tampering and expiry', async () => {
    const { token } = await issueToken(SECRET, DEVICE, 1000);
    expect(await verifyToken(SECRET, token, 2000)).toBe(DEVICE);
    expect(await verifyToken('other', token, 2000)).toBeNull();
    expect(await verifyToken(SECRET, `${token}x`, 2000)).toBeNull();
    expect(await verifyToken(SECRET, token, 1000 + 31 * 24 * 3600 * 1000)).toBeNull();
    expect(await verifyToken(SECRET, 'garbage', 2000)).toBeNull();
    expect(await verifyToken(SECRET, 'a.b', 2000)).toBeNull();
  });
});

describe('rate limits', () => {
  it('counts per day and reports the reset time', async () => {
    const now = Date.UTC(2026, 9, 14, 23, 0, 0);
    const store = new MemoryCounterStore(() => now);
    expect(await consume(store, 'photo', DEVICE, 2, now)).toBeNull();
    expect(await consume(store, 'photo', DEVICE, 2, now)).toBeNull();
    expect(await consume(store, 'photo', DEVICE, 2, now)).toBe(3600);
    expect(await consume(store, 'photo', 'other', 2, now)).toBeNull();
    expect(secondsUntilUtcMidnight(Date.UTC(2026, 0, 1, 0, 0, 0))).toBe(86400);
  });

  it('expires memory counters', async () => {
    let t = 0;
    const store = new MemoryCounterStore(() => t);
    await store.increment('k', 1);
    t = 2000;
    expect(await store.increment('k', 1)).toBe(1);
  });
});

describe('config', () => {
  it('defaults to Claude Opus 5.5 at low effort and validates values', () => {
    expect(readConfig({})).toMatchObject({
      model: 'claude-opus-5-5',
      effort: 'low',
      tokenSecret: null,
      limits: { photo: 30, label: 30 },
    });
    expect(
      readConfig({
        ANTHROPIC_MODEL: 'claude-sonnet-5-5',
        ANTHROPIC_EFFORT: 'bogus',
        PHOTO_DAILY_LIMIT: 'x',
      }),
    ).toMatchObject({ model: 'claude-sonnet-5-5', effort: 'low', limits: { photo: 30 } });
  });
});

describe('post-processing', () => {
  it('cleans photo output and fixes inconsistent energy', () => {
    const r = toPhotoAnalysis(photoOut);
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.items).toHaveLength(2);
    // 900 kcal contradicts ~225 kcal from macros → Atwater energy is used.
    expect(r.items[1]).toMatchObject({ kcal: 224, alternatives: ['Couscous', 'Quinoa', 'Bulgur'] });
    expect(r.items[0]!.kcal).toBe(248);
    expect(toPhotoAnalysis({ ...photoOut, containsFood: false })).toEqual({ status: 'no_food' });
    expect(toPhotoAnalysis({ ...photoOut, items: [] })).toEqual({ status: 'no_food' });
  });

  const label = {
    readable: true,
    basis: '100g' as const,
    productName: ' Proteinriegel ',
    brand: null,
    kcal: 360,
    kj: null,
    fat: 12,
    saturatedFat: 6,
    carbs: 30,
    sugar: 3,
    fiber: 8,
    protein: 33,
    salt: 0.4,
    servingGrams: 45,
    packageGrams: null,
  };

  it('normalises label readings', () => {
    expect(toLabelReading(label)).toMatchObject({
      status: 'ok',
      isLiquid: false,
      productName: 'Proteinriegel',
      kcal: 360,
      protein: 33,
      servingGrams: 45,
    });
    expect(toLabelReading({ ...label, basis: '100ml', kcal: null, kj: 188 })).toMatchObject({
      isLiquid: true,
      kcal: 45,
    });
    expect(
      toLabelReading({
        ...label,
        basis: 'serving_only',
        kcal: 162,
        protein: 15,
        carbs: 13.5,
        fat: 5.4,
      }),
    ).toMatchObject({ kcal: 360, protein: 33.33, carbs: 30 });
    expect(toLabelReading({ ...label, basis: 'serving_only', servingGrams: null })).toEqual({
      status: 'unreadable',
    });
    expect(toLabelReading({ ...label, protein: null })).toEqual({ status: 'unreadable' });
    expect(toLabelReading({ ...label, readable: false })).toEqual({ status: 'unreadable' });
    expect(toLabelReading({ ...label, kcal: 5000 })).toEqual({ status: 'unreadable' });
  });
});

describe('routes', () => {
  it('reports health and 404s', async () => {
    const { app } = setup();
    expect(await (await app.request('/health')).json()).toEqual({ ok: true, ai: true, usda: true });
    expect((await app.request('/nope')).status).toBe(404);
  });

  it('requires a valid device token', async () => {
    const { app } = setup();
    expect((await post(app, '/v1/analyze-photo', {}, {})).status).toBe(401);
    expect(
      (await post(app, '/v1/device', { 'Content-Type': 'application/json' }, { deviceId: 'nope' }))
        .status,
    ).toBe(400);
  });

  it('analyses a photo with the configured model and structured output', async () => {
    const claude = fakeClaude({ parsed_output: photoOut });
    const { app } = setup({ claude });
    const res = await post(app, '/v1/analyze-photo', await auth(app), {
      image: IMAGE,
      mediaType: 'image/jpeg',
      locale: 'de',
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { status: string }).status).toBe('ok');
    const params = claude.calls[0] as Record<string, unknown>;
    expect(params).toMatchObject({
      model: 'claude-opus-5-5',
      fallbacks: 'default',
      betas: ['server-side-fallback-2026-07-01'],
      output_config: { effort: 'low' },
    });
    expect(JSON.stringify(params.messages)).toContain('German');
  });

  it('validates image requests', async () => {
    const { app } = setup();
    const headers = await auth(app);
    expect(
      (
        await post(app, '/v1/analyze-photo', headers, {
          image: 'not base64!',
          mediaType: 'image/jpeg',
        })
      ).status,
    ).toBe(400);
    expect(
      (await post(app, '/v1/analyze-photo', headers, { image: IMAGE, mediaType: 'image/gif' }))
        .status,
    ).toBe(400);
    const huge = await post(app, '/v1/analyze-photo', headers, {
      image: 'A'.repeat(2_100_000),
      mediaType: 'image/jpeg',
    });
    expect(huge.status).toBe(400);
  });

  it('enforces the daily limit', async () => {
    const { app } = setup();
    const headers = await auth(app);
    const body = { image: IMAGE, mediaType: 'image/jpeg' };
    expect((await post(app, '/v1/analyze-photo', headers, body)).status).toBe(200);
    expect((await post(app, '/v1/analyze-photo', headers, body)).status).toBe(200);
    const limited = await post(app, '/v1/analyze-photo', headers, body);
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).toMatch(/^\d+$/);
    expect(await limited.json()).toMatchObject({ error: 'rate_limited' });
  });

  it('maps refusals, truncation and upstream errors', async () => {
    const cases: [Parameters<typeof fakeClaude>[0], number, string][] = [
      [{ stop_reason: 'refusal', parsed_output: null }, 422, 'refused'],
      [{ stop_reason: 'max_tokens', parsed_output: null }, 502, 'upstream_error'],
      [new Anthropic.APIConnectionTimeoutError({ message: 'timeout' }), 504, 'upstream_timeout'],
      [new Anthropic.RateLimitError(429, undefined, 'busy', new Headers()), 503, 'upstream_error'],
      [
        new Anthropic.InternalServerError(500, undefined, 'boom', new Headers()),
        502,
        'upstream_error',
      ],
      [new Error('weird'), 502, 'upstream_error'],
    ];
    for (const [result, status, code] of cases) {
      const { app } = setup({ claude: fakeClaude(result) });
      const res = await post(app, '/v1/analyze-photo', await auth(app), {
        image: IMAGE,
        mediaType: 'image/jpeg',
      });
      expect([res.status, ((await res.json()) as { error: string }).error]).toEqual([status, code]);
    }
  });

  it('reads labels', async () => {
    const { app } = setup({
      claude: fakeClaude({
        parsed_output: {
          readable: true,
          basis: '100g',
          productName: 'Skyr',
          brand: 'Arla',
          kcal: 63,
          kj: null,
          fat: 0.2,
          saturatedFat: 0.1,
          carbs: 4,
          sugar: 4,
          fiber: null,
          protein: 11,
          salt: 0.1,
          servingGrams: null,
          packageGrams: 450,
        },
      }),
    });
    const res = await post(app, '/v1/read-label', await auth(app), {
      image: IMAGE,
      mediaType: 'image/png',
      locale: 'en',
    });
    expect(await res.json()).toMatchObject({ status: 'ok', kcal: 63, packageGrams: 450 });
  });

  it('answers 503 when AI or secrets are not configured', async () => {
    const { app } = setup({ claude: null });
    expect(
      (
        await post(app, '/v1/analyze-photo', await auth(app), {
          image: IMAGE,
          mediaType: 'image/jpeg',
        })
      ).status,
    ).toBe(503);
    const noSecret = createApp({
      config: readConfig({}),
      claude: null,
      counters: new MemoryCounterStore(),
    });
    expect(
      (
        await post(
          noSecret,
          '/v1/device',
          { 'Content-Type': 'application/json' },
          { deviceId: DEVICE },
        )
      ).status,
    ).toBe(503);
    expect((await post(noSecret, '/v1/read-label', {}, {})).status).toBe(503);
  });

  it('proxies USDA with exact GTIN filtering', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            totalHits: 2,
            foods: [
              { fdcId: 1, gtinUpc: '00012345678905' },
              { fdcId: 2, gtinUpc: '99999' },
            ],
          }),
        ),
    );
    const { app } = setup({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const headers = await auth(app);
    const res = await app.request('/v1/usda/search?gtin=012345678905', { headers });
    expect(await res.json()).toEqual({
      totalHits: 1,
      foods: [{ fdcId: 1, gtinUpc: '00012345678905' }],
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('api_key=k');
    expect(JSON.parse(init.body as string)).toMatchObject({ dataType: ['Branded'] });

    await app.request('/v1/usda/search?q=oats', { headers });
    expect(
      JSON.parse((fetchImpl.mock.calls[1] as unknown as [string, RequestInit])[1].body as string),
    ).toMatchObject({ query: 'oats', pageSize: 25 });
    expect((await app.request('/v1/usda/search', { headers })).status).toBe(400);
    fetchImpl.mockResolvedValueOnce(new Response('', { status: 500 }));
    expect((await app.request('/v1/usda/search?q=x', { headers })).status).toBe(502);
  });
});
