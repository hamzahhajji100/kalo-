import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { findByBarcode, searchCatalog } from '../src';
import { BASIC_POPULARITY, applyGermanBasics } from '../scripts/lib/basics';
import { openCatalogWriter, runner } from '../scripts/lib/catalogWriter';
import { fetchOffTopProducts } from '../scripts/lib/offApi';
import { readOffDump } from '../scripts/lib/offDump';
import { readUsdaCsvDir } from '../scripts/lib/usdaCsv';

const fixtures = path.resolve(__dirname, '../fixtures');
const tmp = mkdtempSync(path.join(tmpdir(), 'kalo-food-db-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('USDA CSV import', () => {
  it('maps foods, nutrients and portions', async () => {
    const { foods, stats } = await readUsdaCsvDir(path.join(fixtures, 'usda-sr'));
    expect(stats).toEqual({ foods: 3, mapped: 2, rejected: { nutrients: 1 } });
    const banana = foods.find((f) => f.sourceId === '173944')!;
    expect(banana).toMatchObject({
      per100g: { kcal: 89, protein: 1.09, carbs: 22.84, fat: 0.33, fiber: 2.6, sugar: 12.23 },
      portions: [
        { label: '1 medium (7" to 7-7/8" long)', grams: 118 },
        { label: '1 cup', grams: 150 },
      ],
      verified: true,
    });
    expect(foods.find((f) => f.sourceId === '171077')?.portions).toEqual([
      { label: '0.5 breast, bone and skin removed', grams: 174 },
    ]);
  });

  it('rejects directories that are not FDC releases', async () => {
    await expect(readUsdaCsvDir(tmp)).rejects.toThrow(/does not look like/);
  });

  it('attaches German names and reports missing basics', async () => {
    const { foods } = await readUsdaCsvDir(path.join(fixtures, 'usda-sr'));
    const r = applyGermanBasics(foods, [
      { usda: 'Bananas, raw', de: 'Banane', portions: [{ label: '1 Banane', grams: 120 }] },
      { usda: 'Does not exist', de: 'Gibt es nicht' },
    ]);
    const banana = r.foods.find((f) => f.food.sourceId === '173944')!;
    expect(banana.popularity).toBe(BASIC_POPULARITY);
    expect(banana.food).toMatchObject({ name: 'Banane', nameAlt: 'Bananas, raw' });
    expect(banana.food.portions[0]).toEqual({ label: '1 Banane', grams: 120 });
    expect(r.missing).toEqual(['Does not exist']);
  });
});

describe('OFF dump import', () => {
  it.each(['off-dump.jsonl', 'off-dump.jsonl.gz'])(
    'filters countries and ranks by scans (%s)',
    async (file) => {
      const progress = vi.fn();
      const { foods, stats } = await readOffDump(path.join(fixtures, file), {
        limit: 10,
        onProgress: progress,
      });
      expect(foods.map((f) => f.food.name)).toEqual(['Döner Kebab', 'Skyr Natur']);
      expect(stats).toMatchObject({
        lines: 7,
        inCountries: 3,
        mapped: 2,
        rejected: { json: 1, nutrients: 1 },
      });
    },
  );

  it('respects the limit and custom countries', async () => {
    const { foods } = await readOffDump(path.join(fixtures, 'off-dump.jsonl'), {
      limit: 1,
      countries: ['en:united-states'],
    });
    expect(foods.map((f) => f.food.name)).toEqual(['US only']);
  });
});

describe('OFF API import', () => {
  it('pages through results, caches pages and resumes', async () => {
    const page = (n: number, count: number) => ({
      count: 150,
      page: n,
      products: Array.from({ length: count }, (_, i) => ({
        code: String(4000000000100 + n * 100 + i),
        product_name: `Produkt ${n}-${i}`,
        unique_scans_n: 1000 - i,
        nutriments: {
          'energy-kcal_100g': 100,
          proteins_100g: 5,
          carbohydrates_100g: 15,
          fat_100g: 2,
        },
      })),
    });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(page(1, 100))))
      .mockResolvedValueOnce(new Response(JSON.stringify(page(2, 50))));
    const cacheFile = path.join(tmp, 'off-germany.jsonl');
    const opts = {
      country: 'germany',
      limit: 300,
      cacheFile,
      userAgent: 'test',
      minIntervalMs: 0,
      fetchImpl: fetchImpl as typeof fetch,
    };

    const first = await fetchOffTopProducts(opts);
    expect(first).toHaveLength(150);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const url = new URL(fetchImpl.mock.calls[0]![0] as URL);
    expect(url.searchParams.get('countries_tags_en')).toBe('germany');
    expect(url.searchParams.get('sort_by')).toBe('unique_scans_n');

    // Second run reads pages 1–2 from the cache; page 3 is requested and fails.
    fetchImpl.mockResolvedValueOnce(new Response('{}', { status: 503 }));
    await expect(fetchOffTopProducts(opts)).rejects.toThrow(/HTTP 503/);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});

describe('catalogue build', () => {
  it('writes a searchable database file with metadata', async () => {
    const out = path.join(tmp, 'kalo-core.db');
    const w = openCatalogWriter(out);
    const usda = await readUsdaCsvDir(path.join(fixtures, 'usda-sr'));
    w.add(applyGermanBasics(usda.foods, [{ usda: 'Bananas, raw', de: 'Banane' }]).foods);
    w.add((await readOffDump(path.join(fixtures, 'off-dump.jsonl'), { limit: 10 })).foods);
    expect(w.count()).toBe(4);
    w.finish({ sources: 'usda,off' });

    const db = new Database(out, { readonly: true });
    const r = runner(db);
    expect(searchCatalog(r, 'Banane')[0]?.food.name).toBe('Banane');
    expect(searchCatalog(r, 'doener')[0]?.food.name).toBe('Döner Kebab');
    expect(findByBarcode(r, '5701000000001')?.brand).toBe('Arla');
    expect(r.all<{ key: string; value: string }>('SELECT * FROM meta ORDER BY key')).toEqual([
      { key: 'schema_version', value: '1' },
      { key: 'sources', value: 'usda,off' },
    ]);
    db.close();
  });
});
