import Database from 'better-sqlite3';
import type { Food } from '@kalo/schemas';

import { CATALOG_DDL, CATALOG_SCHEMA_VERSION, foodToRow, type CatalogRow } from '../../src/catalog';
import type { SqlRunner } from '../../src/search';

export interface CatalogWriter {
  db: Database.Database;
  /** Insert or replace foods. Later inserts of the same id win (higher-priority sources go last). */
  add(foods: { food: Food; popularity?: number }[]): void;
  count(): number;
  /** Rebuild the FTS index, write metadata and compact the file. */
  finish(meta: Record<string, string>): void;
}

export function openCatalogWriter(path: string): CatalogWriter {
  const db = new Database(path);
  db.pragma('journal_mode = OFF');
  db.pragma('synchronous = OFF');
  db.exec(CATALOG_DDL);

  const cols = Object.keys(
    foodToRow({
      id: 'x:1',
      source: 'custom',
      sourceId: '1',
      name: 'x',
      isLiquid: false,
      per100g: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
      portions: [],
      allergens: [],
      verified: false,
    }),
  );
  const insert = db.prepare<CatalogRow>(
    `INSERT INTO foods (${cols.join(', ')}) VALUES (${cols.map((c) => `@${c}`).join(', ')})
     ON CONFLICT(id) DO UPDATE SET ${cols
       .filter((c) => c !== 'id')
       .map((c) => `${c} = excluded.${c}`)
       .join(', ')}`,
  );
  const insertMany = db.transaction((rows: CatalogRow[]) => {
    for (const r of rows) insert.run(r);
  });

  return {
    db,
    add: (foods) => insertMany(foods.map(({ food, popularity }) => foodToRow(food, popularity))),
    count: () => (db.prepare('SELECT count(*) AS n FROM foods').get() as { n: number }).n,
    finish(meta) {
      db.exec(
        `INSERT INTO foods_fts(foods_fts) VALUES('rebuild'); INSERT INTO foods_fts(foods_fts) VALUES('optimize');`,
      );
      const setMeta = db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)');
      for (const [k, v] of Object.entries({
        ...meta,
        schema_version: String(CATALOG_SCHEMA_VERSION),
      }))
        setMeta.run(k, v);
      db.exec('VACUUM');
      db.close();
    },
  };
}

/** Adapter from better-sqlite3 to the search module's SqlRunner. */
export const runner = (db: Database.Database): SqlRunner => ({
  all: <T>(sql: string, params: (string | number | null)[] = []) =>
    db.prepare(sql).all(...params) as T[],
});
