import { mapUsdaFood, UsdaSearchResponse, type Food } from '@kalo/schemas';

import { apiHeaders } from '@/lib/api';
import { config } from '@/lib/config';
import { getJsonDeduped } from '@/lib/http';

/**
 * USDA FoodData Central branded foods by GTIN, through the Kalo backend (which holds the API key).
 * Returns undefined when no backend is configured.
 */
export async function fetchUsdaByBarcode(
  code: string,
  signal?: AbortSignal,
): Promise<Food | undefined> {
  if (!config.apiUrl) return undefined;
  const body = await getJsonDeduped(
    `${config.apiUrl}/v1/usda/search?gtin=${encodeURIComponent(code)}`,
    {
      schema: UsdaSearchResponse,
      headers: await apiHeaders(),
      timeoutMs: 6000,
      retries: 1,
      ...(signal && { signal }),
    },
  );
  for (const raw of body.foods) {
    const r = mapUsdaFood(raw);
    if (r.ok) return r.food;
  }
  return undefined;
}
