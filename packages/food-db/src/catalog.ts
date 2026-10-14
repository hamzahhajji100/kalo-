import type { Food } from '@kalo/schemas';

import { normalize } from './normalize';

/** Bump when the catalogue schema changes so the app replaces an outdated copy. */
export const CATALOG_SCHEMA_VERSION = 1;

/**
 * Read-only catalogue database (kalo-core.db). `search_text` holds the normalised name, alternative
 * name and brand; FTS5 with the trigram tokenizer indexes it for substring and fuzzy matching.
 */
export const CATALOG_DDL = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS foods (
  rowid INTEGER PRIMARY KEY,
  id TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  barcode TEXT,
  name TEXT NOT NULL,
  name_alt TEXT,
  brand TEXT,
  image_url TEXT,
  is_liquid INTEGER NOT NULL DEFAULT 0,
  kcal REAL NOT NULL,
  protein REAL NOT NULL,
  carbs REAL NOT NULL,
  fat REAL NOT NULL,
  fiber REAL,
  sugar REAL,
  saturated_fat REAL,
  salt REAL,
  micros_json TEXT,
  portions_json TEXT NOT NULL DEFAULT '[]',
  nutri_score TEXT,
  allergens_json TEXT NOT NULL DEFAULT '[]',
  verified INTEGER NOT NULL DEFAULT 0,
  popularity INTEGER NOT NULL DEFAULT 0,
  search_text TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS foods_barcode_idx ON foods(barcode);
CREATE VIRTUAL TABLE IF NOT EXISTS foods_fts USING fts5(
  search_text, content='foods', content_rowid='rowid', tokenize='trigram'
);
`;

export interface CatalogRow {
  rowid?: number;
  id: string;
  source: string;
  source_id: string;
  barcode: string | null;
  name: string;
  name_alt: string | null;
  brand: string | null;
  image_url: string | null;
  is_liquid: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sugar: number | null;
  saturated_fat: number | null;
  salt: number | null;
  micros_json: string | null;
  portions_json: string;
  nutri_score: string | null;
  allergens_json: string;
  verified: number;
  popularity: number;
  search_text: string;
}

export const searchTextFor = (f: Pick<Food, 'name' | 'nameAlt' | 'brand'>) =>
  [f.name, f.nameAlt, f.brand]
    .filter(Boolean)
    .map((s) => normalize(s!))
    .join(' | ');

export function foodToRow(f: Food, popularity = 0): CatalogRow {
  return {
    id: f.id,
    source: f.source,
    source_id: f.sourceId,
    barcode: f.barcode ?? null,
    name: f.name,
    name_alt: f.nameAlt ?? null,
    brand: f.brand ?? null,
    image_url: f.imageUrl ?? null,
    is_liquid: f.isLiquid ? 1 : 0,
    kcal: f.per100g.kcal,
    protein: f.per100g.protein,
    carbs: f.per100g.carbs,
    fat: f.per100g.fat,
    fiber: f.per100g.fiber ?? null,
    sugar: f.per100g.sugar ?? null,
    saturated_fat: f.per100g.saturatedFat ?? null,
    salt: f.per100g.salt ?? null,
    micros_json: f.micros && Object.keys(f.micros).length ? JSON.stringify(f.micros) : null,
    portions_json: JSON.stringify(f.portions),
    nutri_score: f.nutriScore ?? null,
    allergens_json: JSON.stringify(f.allergens),
    verified: f.verified ? 1 : 0,
    popularity,
    search_text: searchTextFor(f),
  };
}

const opt = <K extends string, V>(key: K, v: V | null) =>
  v === null ? {} : ({ [key]: v } as Record<K, V>);

export function rowToFood(r: CatalogRow): Food {
  return {
    id: r.id,
    source: r.source as Food['source'],
    sourceId: r.source_id,
    ...opt('barcode', r.barcode),
    name: r.name,
    ...opt('nameAlt', r.name_alt),
    ...opt('brand', r.brand),
    ...opt('imageUrl', r.image_url),
    isLiquid: r.is_liquid === 1,
    per100g: {
      kcal: r.kcal,
      protein: r.protein,
      carbs: r.carbs,
      fat: r.fat,
      ...opt('fiber', r.fiber),
      ...opt('sugar', r.sugar),
      ...opt('saturatedFat', r.saturated_fat),
      ...opt('salt', r.salt),
    },
    ...(r.micros_json && { micros: JSON.parse(r.micros_json) as Food['micros'] }),
    portions: JSON.parse(r.portions_json) as Food['portions'],
    ...opt('nutriScore', r.nutri_score as Food['nutriScore'] | null),
    allergens: JSON.parse(r.allergens_json) as string[],
    verified: r.verified === 1,
  };
}
