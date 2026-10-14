import type { Food } from '@kalo/schemas';

import { HttpError } from '@/lib/http';
import { barcodeCandidates } from './gtin';

export type LookupSource = 'device' | 'off' | 'usda';

export interface BarcodeSources {
  /** Device database and offline catalogue (synchronous, never throws). */
  local: (code: string) => Food | undefined;
  off: (code: string, signal?: AbortSignal) => Promise<Food | undefined>;
  /** Optional: USDA branded foods via the Kalo backend. */
  usda?: (code: string, signal?: AbortSignal) => Promise<Food | undefined>;
}

export type LookupResult =
  | { status: 'found'; food: Food; source: LookupSource; code: string }
  | { status: 'not_found'; code: string }
  /** Nothing locally and the online sources could not be reached. */
  | { status: 'offline'; code: string };

/**
 * Lookup order: device/catalogue → Open Food Facts → USDA. A network failure in one online source
 * does not hide a hit in the next; "offline" is only reported if no source could answer.
 */
export async function lookupBarcode(
  raw: string,
  sources: BarcodeSources,
  opts: { type?: string; signal?: AbortSignal } = {},
): Promise<LookupResult> {
  const candidates = barcodeCandidates(raw, opts.type);
  const primary = candidates[0] ?? raw;

  for (const code of candidates) {
    const food = sources.local(code);
    if (food) return { status: 'found', food, source: 'device', code };
  }

  let networkFailed = false;
  let anyAnswered = false;
  const online: [LookupSource, BarcodeSources['off'] | undefined][] = [
    ['off', sources.off],
    ['usda', sources.usda],
  ];
  for (const [source, fn] of online) {
    if (!fn) continue;
    try {
      for (const code of candidates) {
        const food = await fn(code, opts.signal);
        anyAnswered = true;
        if (food) return { status: 'found', food, source, code };
      }
    } catch (e) {
      if (opts.signal?.aborted) throw e;
      if (
        e instanceof HttpError &&
        ['offline', 'timeout', 'server', 'rate_limited'].includes(e.kind)
      )
        networkFailed = true;
      else throw e;
    }
  }
  return networkFailed && !anyAnswered
    ? { status: 'offline', code: primary }
    : { status: 'not_found', code: primary };
}
