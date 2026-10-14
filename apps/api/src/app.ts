import { DeviceTokenRequest, ImageRequest, MAX_IMAGE_BYTES } from '@kalo/schemas';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';

import { analyzePhoto, readLabel, type ClaudeClient } from './claude';
import type { Config } from './config';
import { ApiError } from './errors';
import { consume, type CounterStore } from './rateLimit';
import { issueToken, verifyToken } from './token';

export interface Deps {
  config: Config;
  /** Null when ANTHROPIC_API_KEY is not configured. */
  claude: ClaudeClient | null;
  counters: CounterStore;
  fetchImpl?: typeof fetch;
}

type Vars = { Variables: { deviceId: string } };

const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';

export function createApp(deps: Deps) {
  const app = new Hono<Vars>();
  const { config } = deps;

  app.use(
    '*',
    cors({
      origin: '*',
      allowMethods: ['GET', 'POST'],
      allowHeaders: ['Authorization', 'Content-Type'],
    }),
  );

  app.onError((err, c) => {
    if (err instanceof ApiError) {
      if (err.retryAfter) c.header('Retry-After', String(err.retryAfter));
      return c.json(err.body(), err.status);
    }
    // Log only the error, never request bodies (they may contain meal photos).
    console.error('Unhandled error', err instanceof Error ? err.message : err);
    return c.json({ error: 'upstream_error', message: 'Internal error' }, 502);
  });

  app.get('/health', (c) => c.json({ ok: true, ai: !!deps.claude, usda: !!config.usdaApiKey }));

  app.post('/v1/device', async (c) => {
    if (!config.tokenSecret) throw new ApiError(503, 'not_configured', 'TOKEN_SECRET is not set');
    const body = DeviceTokenRequest.safeParse(await c.req.json().catch(() => null));
    if (!body.success) throw new ApiError(400, 'invalid_request', 'deviceId (UUID) required');
    return c.json(await issueToken(config.tokenSecret, body.data.deviceId));
  });

  // Everything below requires a device token.
  app.use('/v1/*', async (c, next) => {
    if (!config.tokenSecret) throw new ApiError(503, 'not_configured', 'TOKEN_SECRET is not set');
    const header = c.req.header('Authorization') ?? '';
    const deviceId = header.startsWith('Bearer ')
      ? await verifyToken(config.tokenSecret, header.slice(7))
      : null;
    if (!deviceId) throw new ApiError(401, 'unauthorized', 'Missing or invalid device token');
    c.set('deviceId', deviceId);
    await next();
  });

  const limit = async (c: Context<Vars>, kind: 'photo' | 'label' | 'usda') => {
    const retryAfter = await consume(deps.counters, kind, c.get('deviceId'), config.limits[kind]);
    if (retryAfter !== null)
      throw new ApiError(429, 'rate_limited', 'Daily limit reached', retryAfter);
  };

  const imageBody = async (c: Context<Vars>) => {
    const parsed = ImageRequest.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success)
      throw new ApiError(400, 'invalid_request', 'Expected { image (base64), mediaType, locale }');
    return parsed.data;
  };

  const requireClaude = () => {
    if (!deps.claude) throw new ApiError(503, 'not_configured', 'AI analysis is not configured');
    return deps.claude;
  };

  // Base64 inflates by 4/3; leave room for the JSON envelope.
  const imageLimit = bodyLimit({
    maxSize: Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 4096,
    onError: () => {
      throw new ApiError(400, 'invalid_request', 'Image too large');
    },
  });

  app.post('/v1/analyze-photo', imageLimit, async (c) => {
    const claude = requireClaude();
    const req = await imageBody(c);
    await limit(c, 'photo');
    return c.json(await analyzePhoto(claude, config, req));
  });

  app.post('/v1/read-label', imageLimit, async (c) => {
    const claude = requireClaude();
    const req = await imageBody(c);
    await limit(c, 'label');
    return c.json(await readLabel(claude, config, req));
  });

  /** USDA FoodData Central search proxy (keeps the API key on the server). ?gtin= or ?q= */
  app.get('/v1/usda/search', async (c) => {
    if (!config.usdaApiKey) throw new ApiError(503, 'not_configured', 'USDA_API_KEY is not set');
    const gtin = c.req.query('gtin')?.replace(/\D/g, '');
    const q = c.req.query('q')?.trim();
    if (!gtin && !q) throw new ApiError(400, 'invalid_request', 'gtin or q required');
    await limit(c, 'usda');
    const body = {
      query: gtin ? gtin : q,
      dataType: gtin ? ['Branded'] : ['Foundation', 'SR Legacy', 'Branded'],
      pageSize: gtin ? 5 : 25,
    };
    const res = await (deps.fetchImpl ?? fetch)(
      `${USDA_BASE}/foods/search?api_key=${encodeURIComponent(config.usdaApiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) throw new ApiError(502, 'upstream_error', `USDA error ${res.status}`);
    const data = (await res.json()) as { totalHits?: number; foods?: { gtinUpc?: string }[] };
    // A GTIN query is full-text; keep only exact barcode matches (USDA pads UPCs with leading zeros).
    const foods = gtin
      ? (data.foods ?? []).filter((f) => f.gtinUpc?.replace(/^0+/, '') === gtin.replace(/^0+/, ''))
      : (data.foods ?? []);
    c.header('Cache-Control', 'private, max-age=86400');
    return c.json({ totalHits: foods.length, foods });
  });

  app.notFound((c) => c.json({ error: 'invalid_request', message: 'Not found' }, 404));
  return app;
}
