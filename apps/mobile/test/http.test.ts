import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { fetchOffProduct, searchOff } from '@/features/search/openFoodFacts';
import { backoffMs, getJsonDeduped, HttpError, RateLimiter, requestJson } from '@/lib/http';
import nutella from '../../../packages/schemas/test/fixtures/off-nutella.json';

const schema = z.object({ ok: z.boolean() });
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });
const noSleep = () => Promise.resolve();

afterEach(() => vi.unstubAllGlobals());

describe('requestJson', () => {
  it('validates the response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ ok: true }));
    await expect(requestJson('https://x', { schema, fetchImpl })).resolves.toEqual({ ok: true });
    const bad = vi.fn().mockResolvedValue(json({ nope: 1 }));
    await expect(requestJson('https://x', { schema, fetchImpl: bad })).rejects.toMatchObject({
      kind: 'invalid_response',
    });
    const notJson = vi.fn().mockResolvedValue(new Response('<html>', { status: 200 }));
    await expect(requestJson('https://x', { schema, fetchImpl: notJson })).rejects.toMatchObject({
      kind: 'invalid_response',
    });
  });

  it('sends JSON bodies', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ ok: true }));
    await requestJson('https://x', { schema, fetchImpl, method: 'POST', body: { a: 1 } });
    expect(fetchImpl.mock.calls[0]![1]).toMatchObject({
      method: 'POST',
      body: '{"a":1}',
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('retries transient failures with backoff', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce(json({}, 503))
      .mockResolvedValueOnce(json({ ok: true }));
    const sleep = vi.fn(noSleep);
    await expect(requestJson('https://x', { schema, fetchImpl, sleep })).resolves.toEqual({
      ok: true,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('gives up after the retry budget', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('offline'));
    await expect(
      requestJson('https://x', { schema, fetchImpl, retries: 1, sleep: noSleep }),
    ).rejects.toMatchObject({ kind: 'offline' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not retry client errors and reports rate limits', async () => {
    const notFound = vi.fn().mockResolvedValue(json({}, 404));
    await expect(
      requestJson('https://x', { schema, fetchImpl: notFound, sleep: noSleep }),
    ).rejects.toMatchObject({ kind: 'client', status: 404 });
    expect(notFound).toHaveBeenCalledTimes(1);
    const limited = vi.fn().mockResolvedValue(json({}, 429, { 'Retry-After': '30' }));
    await expect(requestJson('https://x', { schema, fetchImpl: limited })).rejects.toMatchObject({
      kind: 'rate_limited',
      retryAfter: 30,
    });
  });

  it('times out slow requests', async () => {
    const fetchImpl = vi.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_, reject) =>
          init!.signal!.addEventListener('abort', () => reject(new Error('aborted'))),
        ),
    );
    await expect(
      requestJson('https://x', { schema, fetchImpl, timeoutMs: 10, retries: 0 }),
    ).rejects.toMatchObject({ kind: 'timeout' });
  });

  it('propagates caller aborts without retrying', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_, reject) =>
          init!.signal!.addEventListener('abort', () => reject(new Error('aborted'))),
        ),
    );
    const p = requestJson('https://x', {
      schema,
      fetchImpl,
      signal: controller.signal,
      sleep: noSleep,
    });
    controller.abort();
    await expect(p).rejects.toThrow('aborted');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('helpers', () => {
  it('dedupes concurrent GETs', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(json({ ok: true })));
    const [a, b] = await Promise.all([
      getJsonDeduped('https://d', { schema, fetchImpl }),
      getJsonDeduped('https://d', { schema, fetchImpl }),
    ]);
    expect(a).toEqual(b);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await getJsonDeduped('https://d', { schema, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('computes capped backoff', () => {
    expect(backoffMs(0, () => 0.5)).toBe(500);
    expect(backoffMs(10, () => 0.5)).toBe(8000);
  });

  it('rate-limits within a window', () => {
    let t = 0;
    const rl = new RateLimiter(2, 1000, () => t);
    expect([rl.tryAcquire(), rl.tryAcquire(), rl.tryAcquire()]).toEqual([true, true, false]);
    t = 1001;
    expect(rl.tryAcquire()).toBe(true);
  });

  it('HttpError carries its kind', () => {
    expect(new HttpError('server', 'x', 500)).toMatchObject({
      name: 'HttpError',
      kind: 'server',
      status: 500,
    });
  });
});

describe('Open Food Facts client', () => {
  it('maps a product lookup', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ status: 1, product: nutella }));
    vi.stubGlobal('fetch', fetchMock);
    expect((await fetchOffProduct('3017620422003', 'de'))?.name).toBe('Nutella');
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/api/v2/product/3017620422003.json');
  });

  it('returns undefined for unknown or unusable products', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ status: 0 }, 404)));
    expect(await fetchOffProduct('0000000000000', 'de')).toBeUndefined();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json({ status: 0, status_verbose: 'product not found' })),
    );
    expect(await fetchOffProduct('0000000000001', 'de')).toBeUndefined();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json({ status: 1, product: { code: '0000000000002' } })),
    );
    expect(await fetchOffProduct('0000000000002', 'de')).toBeUndefined();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({}, 500)));
    await expect(fetchOffProduct('0000000000003', 'de', undefined)).rejects.toBeInstanceOf(
      HttpError,
    );
  });

  it('searches and drops unusable products, then rate-limits locally', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(json({ count: 2, page: 1, products: [nutella, { code: '1' }] }))),
    );
    expect((await searchOff('nutella', 'de')).map((f) => f.name)).toEqual(['Nutella']);
    for (let i = 0; i < 9; i++) await searchOff('x', 'en');
    await expect(searchOff('x', 'de')).rejects.toMatchObject({ kind: 'rate_limited' });
  });
});
