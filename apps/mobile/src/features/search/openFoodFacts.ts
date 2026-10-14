import {
  mapOffProduct,
  OFF_FIELDS,
  OffProductResponse,
  OffSearchResponse,
  type Food,
} from '@kalo/schemas';

import { getJsonDeduped, HttpError, RateLimiter, requestJson } from '@/lib/http';

const BASE = 'https://world.openfoodfacts.org';
/** OFF asks API users to identify themselves. */
const USER_AGENT =
  'Kalo/0.1 (iOS/Android calorie tracker; contact: github.com/hamzahhajji100/kalo)';
const FIELDS = OFF_FIELDS.join(',');

const searchLimiter = new RateLimiter(10, 60_000);

/** Look up one product by barcode. Returns undefined if OFF does not know it or its data is unusable. */
export async function fetchOffProduct(
  barcode: string,
  lang: 'de' | 'en',
  signal?: AbortSignal,
): Promise<Food | undefined> {
  let body;
  try {
    body = await getJsonDeduped(
      `${BASE}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`,
      {
        schema: OffProductResponse,
        headers: { 'User-Agent': USER_AGENT },
        timeoutMs: 6000,
        ...(signal && { signal }),
      },
    );
  } catch (e) {
    // OFF answers 404 for unknown barcodes.
    if (e instanceof HttpError && e.status === 404) return undefined;
    throw e;
  }
  if (!body.product || body.status === 0 || body.status === 'failure') return undefined;
  const r = mapOffProduct(body.product, lang);
  return r.ok ? r.food : undefined;
}

/**
 * Full-text product search. Throws HttpError('rate_limited') locally before hitting OFF's
 * per-minute limit, so the UI can explain instead of failing silently.
 */
export async function searchOff(
  query: string,
  lang: 'de' | 'en',
  signal?: AbortSignal,
): Promise<Food[]> {
  if (!searchLimiter.tryAcquire())
    throw new HttpError('rate_limited', 'Local OFF search limit reached');
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '24',
    lc: lang,
    cc: lang === 'de' ? 'de' : 'world',
    sort_by: 'unique_scans_n',
    fields: FIELDS,
  });
  const body = await requestJson(`${BASE}/cgi/search.pl?${params.toString()}`, {
    schema: OffSearchResponse,
    headers: { 'User-Agent': USER_AGENT },
    timeoutMs: 8000,
    retries: 1,
    ...(signal && { signal }),
  });
  return body.products.flatMap((p) => {
    const r = mapOffProduct(p, lang);
    return r.ok ? [r.food] : [];
  });
}
