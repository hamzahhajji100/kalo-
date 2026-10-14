import { appendFileSync, existsSync, readFileSync } from 'node:fs';

import { mapOffProduct, OFF_FIELDS, OffSearchResponse, type Food } from '@kalo/schemas';

/**
 * Fetch the most scanned products of a country page by page from the Open Food Facts search API.
 * OFF allows ~10 search requests per minute, so requests are spaced out; raw pages are appended to
 * a JSONL cache file so an interrupted run resumes where it stopped.
 */
export async function fetchOffTopProducts(opts: {
  country: string;
  limit: number;
  cacheFile: string;
  userAgent: string;
  pageSize?: number;
  minIntervalMs?: number;
  fetchImpl?: typeof fetch;
  log?: (msg: string) => void;
}): Promise<{ food: Food; popularity: number }[]> {
  const pageSize = opts.pageSize ?? 100;
  const fetchFn = opts.fetchImpl ?? fetch;
  const pages = Math.ceil(opts.limit / pageSize);
  const cached = new Map<number, unknown[]>();
  if (existsSync(opts.cacheFile)) {
    for (const line of readFileSync(opts.cacheFile, 'utf8').split('\n')) {
      if (!line) continue;
      const { page, products } = JSON.parse(line) as { page: number; products: unknown[] };
      cached.set(page, products);
    }
  }

  let last = 0;
  for (let page = 1; page <= pages; page++) {
    if (cached.has(page)) continue;
    const wait = (opts.minIntervalMs ?? 6500) - (Date.now() - last);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();

    const url = new URL('https://world.openfoodfacts.org/api/v2/search');
    url.searchParams.set('countries_tags_en', opts.country);
    url.searchParams.set('sort_by', 'unique_scans_n');
    url.searchParams.set('page_size', String(pageSize));
    url.searchParams.set('page', String(page));
    url.searchParams.set('fields', [...OFF_FIELDS].join(','));

    const res = await fetchFn(url, { headers: { 'User-Agent': opts.userAgent } });
    if (!res.ok) throw new Error(`OFF search page ${page} failed: HTTP ${res.status}`);
    const body = OffSearchResponse.parse(await res.json());
    cached.set(page, body.products);
    appendFileSync(opts.cacheFile, `${JSON.stringify({ page, products: body.products })}\n`);
    opts.log?.(`OFF ${opts.country}: page ${page}/${pages}`);
    if (body.products.length < pageSize) break;
  }

  const out: { food: Food; popularity: number }[] = [];
  for (const products of cached.values()) {
    for (const p of products) {
      const r = mapOffProduct(p, 'de');
      if (r.ok) out.push({ food: r.food, popularity: r.popularity });
    }
  }
  return out;
}
