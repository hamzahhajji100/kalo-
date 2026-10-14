import type { SqlRunner } from '@kalo/food-db';
import { Asset } from 'expo-asset';
import { importDatabaseFromAssetAsync, openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import Storage from 'expo-sqlite/kv-store';

const CATALOG_DB = 'kalo-core.db';
const HASH_KEY = 'kalo.catalogAssetHash';
const CATALOG_ASSET = require('../../assets/db/kalo-core.db') as number;

let catalogDb: SQLiteDatabase | null = null;
let runner: SqlRunner | null = null;

export interface CatalogInfo {
  foods: number;
  builtAt: string | null;
  sources: string[];
}

/**
 * Copy the bundled read-only food catalogue into the SQLite directory (again whenever the app ships
 * a new version of it) and open it. The user database is never touched by this.
 */
export async function initCatalog(): Promise<void> {
  const asset = Asset.fromModule(CATALOG_ASSET);
  const previousHash = Storage.getItemSync(HASH_KEY);
  const changed = !!asset.hash && asset.hash !== previousHash;
  await importDatabaseFromAssetAsync(CATALOG_DB, {
    assetId: CATALOG_ASSET,
    forceOverwrite: changed,
  });
  if (asset.hash) Storage.setItemSync(HASH_KEY, asset.hash);

  catalogDb = openDatabaseSync(CATALOG_DB);
  const db = catalogDb;
  runner = {
    all: <T>(sql: string, params: (string | number | null)[] = []) => db.getAllSync<T>(sql, params),
  };
}

/** The catalogue, or null while it is being prepared or if preparing it failed (search then falls back to online). */
export function getCatalog(): SqlRunner | null {
  return runner;
}

export function catalogInfo(): CatalogInfo | null {
  if (!runner) return null;
  const count = runner.all<{ n: number }>('SELECT count(*) AS n FROM foods')[0]?.n ?? 0;
  const meta = Object.fromEntries(
    runner
      .all<{ key: string; value: string }>('SELECT key, value FROM meta')
      .map((r) => [r.key, r.value]),
  );
  return {
    foods: count,
    builtAt: meta.built_at ?? null,
    sources: meta.sources ? meta.sources.split(',').filter(Boolean) : [],
  };
}
