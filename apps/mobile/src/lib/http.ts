import type { z } from 'zod';

export type HttpErrorKind =
  'offline' | 'timeout' | 'rate_limited' | 'server' | 'client' | 'invalid_response';

/** Typed error so screens can show the right message (offline vs. rate limit vs. server problem). */
export class HttpError extends Error {
  constructor(
    readonly kind: HttpErrorKind,
    message: string,
    readonly status?: number,
    /** Seconds to wait, from a Retry-After header. */
    readonly retryAfter?: number,
    /** Parsed JSON error body, if the server sent one. */
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export interface RequestOptions<T> {
  schema: z.ZodType<T>;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  /** Retries for network errors, timeouts and 5xx (not 4xx). */
  retries?: number;
  signal?: AbortSignal;
  /** Injected for tests. */
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Exponential backoff with jitter: ~0.5 s, 1 s, 2 s … capped at 8 s. */
export const backoffMs = (attempt: number, random = Math.random) =>
  Math.min(8000, 500 * 2 ** attempt) * (0.75 + random() * 0.5);

async function once<T>(url: string, opts: RequestOptions<T>): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 10_000);
  const onAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onAbort);
  let res: Response;
  try {
    res = await (opts.fetchImpl ?? fetch)(url, {
      method: opts.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(opts.body !== undefined && { 'Content-Type': 'application/json' }),
        ...opts.headers,
      },
      ...(opts.body !== undefined && { body: JSON.stringify(opts.body) }),
      signal: controller.signal,
    });
  } catch (e) {
    if (opts.signal?.aborted) throw e;
    if (controller.signal.aborted) throw new HttpError('timeout', 'Request timed out');
    throw new HttpError('offline', e instanceof Error ? e.message : 'Network request failed');
  } finally {
    clearTimeout(timeout);
    opts.signal?.removeEventListener('abort', onAbort);
  }

  if (!res.ok) {
    const body: unknown = await res.json().catch(() => undefined);
    const retryAfter = Number(res.headers.get('Retry-After')) || undefined;
    if (res.status === 429)
      throw new HttpError('rate_limited', 'Too many requests', 429, retryAfter, body);
    if (res.status >= 500)
      throw new HttpError('server', `Server error ${res.status}`, res.status, retryAfter, body);
    throw new HttpError('client', `Request failed ${res.status}`, res.status, retryAfter, body);
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new HttpError('invalid_response', 'Response is not JSON', res.status);
  }
  const parsed = opts.schema.safeParse(json);
  if (!parsed.success) throw new HttpError('invalid_response', parsed.error.message, res.status);
  return parsed.data;
}

const RETRYABLE: HttpErrorKind[] = ['offline', 'timeout', 'server'];

/** Fetch JSON, validate it with Zod and retry transient failures with backoff. */
export async function requestJson<T>(url: string, opts: RequestOptions<T>): Promise<T> {
  const retries = opts.retries ?? 2;
  const sleep = opts.sleep ?? defaultSleep;
  for (let attempt = 0; ; attempt++) {
    try {
      return await once(url, opts);
    } catch (e) {
      const retryable = e instanceof HttpError && RETRYABLE.includes(e.kind);
      if (!retryable || attempt >= retries || opts.signal?.aborted) throw e;
      await sleep(backoffMs(attempt));
    }
  }
}

const inFlight = new Map<string, Promise<unknown>>();

/** Identical concurrent GETs share one request (e.g. the same barcode scanned twice quickly). */
export function getJsonDeduped<T>(
  url: string,
  opts: Omit<RequestOptions<T>, 'method' | 'body'>,
): Promise<T> {
  const existing = inFlight.get(url);
  if (existing) return existing as Promise<T>;
  const p = requestJson(url, opts).finally(() => inFlight.delete(url));
  inFlight.set(url, p);
  return p;
}

/**
 * Client-side token bucket so we stay within third-party limits
 * (Open Food Facts allows ~10 searches per minute per client).
 */
export class RateLimiter {
  private timestamps: number[] = [];
  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  tryAcquire(): boolean {
    const t = this.now();
    this.timestamps = this.timestamps.filter((x) => t - x < this.windowMs);
    if (this.timestamps.length >= this.max) return false;
    this.timestamps.push(t);
    return true;
  }
}
