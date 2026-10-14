import type { Food } from '@kalo/schemas';
import { beforeAll, describe, expect, it } from 'vitest';

import { searchCatalog, type SqlRunner } from '../src';
import { openCatalogWriter, runner } from '../scripts/lib/catalogWriter';

/**
 * Performance guard: 50,000 synthetic products (combinatorial names, test-only data) must be
 * searchable in well under 100 ms per query on a developer machine.
 */
const A = [
  'Bio',
  'Vollkorn',
  'Classic',
  'Mini',
  'Protein',
  'Light',
  'Extra',
  'Family',
  'Premium',
  'Original',
];
const B = [
  'Joghurt',
  'Müsli',
  'Riegel',
  'Brot',
  'Käse',
  'Wurst',
  'Schokolade',
  'Saft',
  'Nudeln',
  'Pizza',
  'Quark',
  'Kekse',
  'Chips',
  'Eis',
  'Skyr',
  'Hähnchen',
  'Döner',
  'Tofu',
  'Reis',
  'Suppe',
];
const C = [
  'Erdbeere',
  'Vanille',
  'Natur',
  'Salami',
  'Tomate',
  'Schoko',
  'Kräuter',
  'Paprika',
  'Honig',
  'Zitrone',
  'Mango',
  'Käse',
  'Spinat',
  'Curry',
  'Nuss',
  'Karamell',
  'Kirsche',
  'Pfirsich',
  'Zimt',
  'Kokos',
];
const BRANDS = [
  'Alnatura',
  'Rewe Bio',
  'Ja!',
  'Gut & Günstig',
  'Milbona',
  'Ehrmann',
  'Dr. Oetker',
  'Ferrero',
  'Zott',
  'Seitenbacher',
  'Kölln',
  'Lorenz',
  'Wagner',
  'Iglo',
  'Rügenwalder',
];

let db: SqlRunner;
beforeAll(() => {
  const w = openCatalogWriter(':memory:');
  const rows: { food: Food; popularity: number }[] = [];
  for (let i = 0; i < 50_000; i++) {
    const name = `${A[i % A.length]} ${B[Math.floor(i / A.length) % B.length]} ${C[Math.floor(i / (A.length * B.length)) % C.length]} ${Math.floor(i / 4000) + 1}`;
    rows.push({
      food: {
        id: `off:${100000000 + i}`,
        source: 'off',
        sourceId: String(100000000 + i),
        barcode: String(4000000000000 + i),
        name,
        brand: BRANDS[i % BRANDS.length],
        isLiquid: false,
        per100g: { kcal: 200, protein: 10, carbs: 25, fat: 7 },
        portions: [],
        allergens: [],
        verified: false,
      },
      popularity: i % 997,
    });
  }
  w.add(rows);
  w.db.exec(`INSERT INTO foods_fts(foods_fts) VALUES('rebuild')`);
  db = runner(w.db);
}, 60_000);

describe('search performance (50k rows)', () => {
  it.each([
    'Skyr',
    'Hähnchen',
    'Döner',
    'protein riegel schoko',
    'Hänchen',
    'jogurt erdbere',
    'ei',
    'Alnatura Müsli',
  ])('"%s" is fast', (q) => {
    searchCatalog(db, q); // warm-up
    const runs = 5;
    const start = performance.now();
    for (let i = 0; i < runs; i++) searchCatalog(db, q);
    const avg = (performance.now() - start) / runs;
    expect(avg).toBeLessThan(100);
  });

  it('finds typo matches among 50k rows', () => {
    expect(searchCatalog(db, 'jogurt erdbere')[0]?.food.name).toMatch(/Joghurt Erdbeere/);
  });
});
