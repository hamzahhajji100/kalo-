/** Counter storage for rate limits. KV in production, in-memory for tests and local Node. */
export interface CounterStore {
  /** Increment and return the new value; the key expires after ttlSeconds. */
  increment(key: string, ttlSeconds: number): Promise<number>;
}

export class MemoryCounterStore implements CounterStore {
  private readonly counts = new Map<string, { n: number; expires: number }>();
  constructor(private readonly now: () => number = Date.now) {}

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const t = this.now();
    const cur = this.counts.get(key);
    const next =
      cur && cur.expires > t
        ? { n: cur.n + 1, expires: cur.expires }
        : { n: 1, expires: t + ttlSeconds * 1000 };
    this.counts.set(key, next);
    return next.n;
  }
}

/**
 * Cloudflare KV counter. KV is eventually consistent, so concurrent requests from one device can
 * slightly exceed the limit; that is acceptable for cost control. Use a Durable Object for exact limits.
 */
export class KvCounterStore implements CounterStore {
  constructor(private readonly kv: KVNamespace) {}

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const n = Number((await this.kv.get(key)) ?? '0') + 1;
    await this.kv.put(key, String(n), { expirationTtl: Math.max(60, ttlSeconds) });
    return n;
  }
}

/** Seconds until the next UTC midnight (daily windows reset there). */
export const secondsUntilUtcMidnight = (now = Date.now()) => {
  const d = new Date(now);
  return Math.ceil(
    (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - now) / 1000,
  );
};

/** Count one use; returns null if allowed, else seconds until the window resets. */
export async function consume(
  store: CounterStore,
  kind: string,
  deviceId: string,
  dailyLimit: number,
  now = Date.now(),
): Promise<number | null> {
  const day = new Date(now).toISOString().slice(0, 10);
  const ttl = secondsUntilUtcMidnight(now);
  const n = await store.increment(`rl:${kind}:${deviceId}:${day}`, ttl);
  return n > dailyLimit ? ttl : null;
}
