import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { createGunzip } from 'node:zlib';

import { mapOffProduct, type Food } from '@kalo/schemas';

export const DACH_COUNTRIES = ['en:germany', 'en:austria', 'en:switzerland'];

export interface OffImportStats {
  lines: number;
  inCountries: number;
  mapped: number;
  rejected: Record<string, number>;
}

/**
 * Stream the Open Food Facts JSONL dump (optionally gzipped), keep products sold in the given
 * countries and return the `limit` most scanned ones.
 */
export async function readOffDump(
  file: string,
  opts: { countries?: string[]; limit: number; onProgress?: (lines: number) => void },
): Promise<{ foods: { food: Food; popularity: number }[]; stats: OffImportStats }> {
  const countries = new Set(opts.countries ?? DACH_COUNTRIES);
  const input = file.endsWith('.gz')
    ? createReadStream(file).pipe(createGunzip())
    : createReadStream(file);
  const rl = createInterface({ input, crlfDelay: Infinity });

  const stats: OffImportStats = { lines: 0, inCountries: 0, mapped: 0, rejected: {} };
  const kept: { food: Food; popularity: number }[] = [];
  for await (const line of rl) {
    stats.lines++;
    if (stats.lines % 100_000 === 0) opts.onProgress?.(stats.lines);
    if (!line.trim()) continue;
    let raw: { countries_tags?: unknown };
    try {
      raw = JSON.parse(line) as { countries_tags?: unknown };
    } catch {
      stats.rejected.json = (stats.rejected.json ?? 0) + 1;
      continue;
    }
    const tags = Array.isArray(raw.countries_tags) ? (raw.countries_tags as string[]) : [];
    if (!tags.some((t) => countries.has(t))) continue;
    stats.inCountries++;
    const r = mapOffProduct(raw, 'de');
    if (r.ok) {
      kept.push({ food: r.food, popularity: r.popularity });
      stats.mapped++;
    } else stats.rejected[r.reason] = (stats.rejected[r.reason] ?? 0) + 1;
  }
  kept.sort((a, b) => b.popularity - a.popularity);
  return { foods: kept.slice(0, opts.limit), stats };
}
