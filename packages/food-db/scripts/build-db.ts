/**
 * Builds the offline food catalogue (kalo-core.db) shipped with the app.
 *
 *   pnpm db:build                         # USDA (download) + top 50k DACH products via OFF API
 *   pnpm db:build --off-dump products.jsonl.gz --off-limit 50000
 *   pnpm db:build --usda-dir ./sr_legacy --usda-dir ./foundation --skip-off
 *   pnpm db:build --empty                 # schema only (used for CI / fresh clones)
 *
 * Licences: Open Food Facts data is ODbL 1.0 (attribution + share-alike for the database),
 * USDA FoodData Central is public domain (CC0). See docs/data-sources-licenses.md.
 */
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';

import { BASICS_DE } from './data/basics-de';
import { applyGermanBasics } from './lib/basics';
import { openCatalogWriter } from './lib/catalogWriter';
import { fetchOffTopProducts } from './lib/offApi';
import { DACH_COUNTRIES, readOffDump } from './lib/offDump';
import { readUsdaCsvDir } from './lib/usdaCsv';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');

/** Default USDA releases. Check https://fdc.nal.usda.gov/download-datasets for newer file names. */
const USDA_DEFAULT_URLS = [
  'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip',
  'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_csv_2025-04-24.zip',
];

const { values: args } = parseArgs({
  options: {
    out: { type: 'string', default: path.join(repoRoot, 'apps/mobile/assets/db/kalo-core.db') },
    cache: { type: 'string', default: path.join(repoRoot, '.cache/food-db') },
    empty: { type: 'boolean', default: false },
    'skip-usda': { type: 'boolean', default: false },
    'skip-off': { type: 'boolean', default: false },
    'usda-dir': { type: 'string', multiple: true },
    'usda-url': { type: 'string', multiple: true },
    'off-dump': { type: 'string' },
    'off-limit': { type: 'string', default: '50000' },
    'off-country': { type: 'string', multiple: true },
    'user-agent': {
      type: 'string',
      default: 'Kalo/0.1 (food catalogue builder; https://github.com/hamzahhajji100/kalo-)',
    },
  },
});

const log = (msg: string) => console.warn(`[db:build] ${msg}`);

async function downloadAndUnzip(url: string, cacheDir: string): Promise<string> {
  const name = path.basename(new URL(url).pathname, '.zip');
  const target = path.join(cacheDir, name);
  if (existsSync(path.join(target, '.done'))) return target;
  log(`downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  const files = unzipSync(new Uint8Array(await res.arrayBuffer()));
  mkdirSync(target, { recursive: true });
  for (const [file, data] of Object.entries(files)) {
    if (!file.endsWith('.csv')) continue;
    writeFileSync(path.join(target, path.basename(file)), data);
  }
  writeFileSync(path.join(target, '.done'), '');
  return target;
}

async function main() {
  mkdirSync(path.dirname(args.out), { recursive: true });
  mkdirSync(args.cache, { recursive: true });
  if (existsSync(args.out)) rmSync(args.out);
  const writer = openCatalogWriter(args.out);
  const meta: Record<string, string> = { built_at: new Date().toISOString(), sources: '' };
  const sources: string[] = [];

  if (!args.empty && !args['skip-usda']) {
    const dirs = args['usda-dir'] ?? [];
    if (dirs.length === 0) {
      for (const url of args['usda-url'] ?? USDA_DEFAULT_URLS)
        dirs.push(await downloadAndUnzip(url, args.cache));
    }
    const all = [];
    for (const dir of dirs) {
      const { foods, stats } = await readUsdaCsvDir(dir);
      log(
        `USDA ${path.basename(dir)}: ${stats.mapped}/${stats.foods} mapped, rejected ${JSON.stringify(stats.rejected)}`,
      );
      all.push(...foods);
    }
    const { foods, missing } = applyGermanBasics(all, BASICS_DE);
    if (missing.length)
      log(`German basics without USDA match (${missing.length}):\n  - ${missing.join('\n  - ')}`);
    writer.add(foods);
    meta.usda_foods = String(foods.length);
    sources.push('usda');
  }

  if (!args.empty && !args['skip-off']) {
    const limit = Number(args['off-limit']);
    let products;
    if (args['off-dump']) {
      const r = await readOffDump(args['off-dump'], {
        limit,
        countries:
          args['off-country']?.map((c) => (c.includes(':') ? c : `en:${c}`)) ?? DACH_COUNTRIES,
        onProgress: (n) => log(`OFF dump: ${n.toLocaleString()} lines`),
      });
      log(`OFF dump: ${r.stats.mapped} usable of ${r.stats.inCountries} in selected countries`);
      products = r.foods;
    } else {
      const countries = args['off-country'] ?? ['germany'];
      const perCountry = Math.ceil(limit / countries.length);
      products = [];
      for (const country of countries) {
        products.push(
          ...(await fetchOffTopProducts({
            country,
            limit: perCountry,
            cacheFile: path.join(args.cache, `off-${country}.jsonl`),
            userAgent: args['user-agent'],
            log,
          })),
        );
      }
    }
    writer.add(products);
    meta.off_products = String(products.length);
    sources.push('off');
  }

  meta.sources = sources.join(',');
  const total = writer.count();
  writer.finish(meta);
  log(
    `wrote ${total.toLocaleString()} foods to ${args.out} (${(statSync(args.out).size / 1e6).toFixed(1)} MB)`,
  );
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
