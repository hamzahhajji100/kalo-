import type { Food } from '@kalo/schemas';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  buildSynonymIndex,
  findByBarcode,
  foldUmlautDigraphs,
  fuzzyMatch,
  getCatalogFood,
  normalize,
  parseQuery,
  rankFoods,
  rowToFood,
  foodToRow,
  searchCatalog,
  similarity,
  strictMatch,
  trigrams,
  type SqlRunner,
} from '../src';
import { openCatalogWriter, runner } from '../scripts/lib/catalogWriter';

/** Test catalogue; values are illustrative fixtures, not shipped data. */
function food(id: string, name: string, extra: Partial<Food> = {}): Food {
  return {
    id: `usda:${id}`,
    source: 'usda',
    sourceId: id,
    name,
    isLiquid: false,
    per100g: { kcal: 100, protein: 10, carbs: 10, fat: 2.2 },
    portions: [],
    allergens: [],
    verified: true,
    ...extra,
  };
}

const FOODS: { food: Food; popularity?: number }[] = [
  { food: food('1', 'Hähnchenbrust, roh', { nameAlt: 'Chicken breast, raw' }) },
  { food: food('2', 'Hähnchenbrust, gebraten', { nameAlt: 'Chicken breast, roasted' }) },
  { food: food('3', 'Hähnchenschenkel, roh', { nameAlt: 'Chicken thigh, raw' }) },
  {
    food: {
      ...food('4', 'Skyr Natur'),
      id: 'off:5000',
      source: 'off',
      sourceId: '5000',
      brand: 'Arla',
      barcode: '5701000000001',
    },
    popularity: 2000,
  },
  {
    food: {
      ...food('5', 'Skyr Drink Vanille 3er-Pack'),
      id: 'off:5001',
      source: 'off',
      sourceId: '5001',
      brand: 'Exquisa',
      verified: false,
    },
    popularity: 50,
  },
  {
    food: {
      ...food('6', 'Döner Kebab im Fladenbrot'),
      id: 'off:5002',
      source: 'off',
      sourceId: '5002',
      brand: 'Imbiss',
    },
    popularity: 300,
  },
  { food: food('7', 'Hühnerei, roh', { nameAlt: 'Egg, whole, raw' }) },
  { food: food('8', 'Haferflocken', { nameAlt: 'Oats, rolled' }) },
  { food: food('9', 'Käse, Gouda', { nameAlt: 'Cheese, gouda' }) },
  { food: food('10', 'Couscous, gekocht', { nameAlt: 'Couscous, cooked' }) },
  { food: food('11', 'Reis, weiß, gekocht', { nameAlt: 'Rice, white, cooked' }) },
];

let db: SqlRunner;
beforeAll(() => {
  const w = openCatalogWriter(':memory:');
  w.add(FOODS);
  w.db.exec(`INSERT INTO foods_fts(foods_fts) VALUES('rebuild')`);
  db = runner(w.db);
});

const top = (q: string, n = 1) =>
  searchCatalog(db, q)
    .slice(0, n)
    .map((h) => h.food.name);

describe('normalisation', () => {
  it('folds case, umlauts, ß and punctuation', () => {
    expect(normalize('Hähnchen-Brust, ROH (Bio)')).toBe('hahnchen brust roh bio');
    expect(normalize('Weißbrot')).toBe('weissbrot');
    expect(foldUmlautDigraphs('haehnchen')).toBe('hahnchen');
    expect(trigrams('ei')).toEqual([' ei', 'ei ']);
    expect(similarity('hahnchen', 'hanchen')).toBeGreaterThan(0.6);
    expect(similarity('skyr', 'skyr')).toBe(1);
  });

  it('expands synonyms in both directions', () => {
    const idx = buildSynonymIndex([
      ['Huhn', 'Chicken'],
      ['Huhn', 'Hendl'],
    ]);
    expect(idx.get('huhn')).toEqual(['chicken', 'hendl']);
    expect(idx.get('chicken')).toEqual(['huhn']);
    expect(parseQuery('Döner')[0]!.alternatives).toEqual(
      expect.arrayContaining(['doner', 'kebab']),
    );
  });

  it('builds FTS queries', () => {
    expect(strictMatch(parseQuery('ei', buildSynonymIndex([])))).toBeUndefined();
    expect(fuzzyMatch(parseQuery('ei', buildSynonymIndex([])))).toBeUndefined();
    expect(strictMatch(parseQuery('skyr natur', buildSynonymIndex([])))).toBe(
      '("skyr") AND ("natur")',
    );
  });
});

describe('searchCatalog', () => {
  it('finds exact and partial German names', () => {
    expect(top('Hähnchenbrust')).toEqual(['Hähnchenbrust, roh']);
    expect(top('hähnchenbrust gebraten')).toEqual(['Hähnchenbrust, gebraten']);
    expect(top('Haferflocken')).toEqual(['Haferflocken']);
  });

  it('ranks the generic product above variants', () => {
    expect(top('Skyr', 2)).toEqual(['Skyr Natur', 'Skyr Drink Vanille 3er-Pack']);
  });

  it('tolerates typos and digraph spellings', () => {
    expect(top('Hänchenbrust')).toEqual(['Hähnchenbrust, roh']);
    expect(top('haehnchenbrust')).toEqual(['Hähnchenbrust, roh']);
    expect(top('Hafeflocken')).toEqual(['Haferflocken']);
  });

  it('uses synonyms and English names', () => {
    expect(top('Döner')).toEqual(['Döner Kebab im Fladenbrot']);
    expect(top('kebab')).toEqual(['Döner Kebab im Fladenbrot']);
    expect(top('chicken breast')[0]).toMatch(/^Hähnchenbrust/);
    expect(top('Käse')).toEqual(['Käse, Gouda']);
    expect(top('cheese')).toEqual(['Käse, Gouda']);
  });

  it('handles short words and brands', () => {
    expect(top('ei')).toEqual(['Hühnerei, roh']);
    expect(top('arla')).toEqual(['Skyr Natur']);
  });

  it('returns nothing for empty or unrelated queries', () => {
    expect(searchCatalog(db, '  ')).toEqual([]);
    expect(searchCatalog(db, 'xylophon')).toEqual([]);
  });

  it('looks up by barcode and id', () => {
    expect(findByBarcode(db, '5701000000001')?.name).toBe('Skyr Natur');
    expect(findByBarcode(db, '0')).toBeUndefined();
    expect(getCatalogFood(db, 'usda:8')?.name).toBe('Haferflocken');
    expect(getCatalogFood(db, 'usda:x')).toBeUndefined();
  });
});

describe('rows', () => {
  it('round-trips a full food', () => {
    const f: Food = {
      ...food('99', 'Test'),
      barcode: '12345678',
      brand: 'B',
      imageUrl: 'https://x/y.jpg',
      isLiquid: true,
      nutriScore: 'a',
      per100g: {
        kcal: 50,
        protein: 1,
        carbs: 10,
        fat: 0,
        fiber: 1,
        sugar: 9,
        saturatedFat: 0,
        salt: 0.01,
      },
      micros: { calciumMg: 10 },
      portions: [{ label: 'Glas', grams: 200 }],
      allergens: ['milk'],
    };
    expect(rowToFood(foodToRow(f))).toEqual(f);
  });
});

describe('rankFoods', () => {
  it('ranks in-memory foods with the same scoring', () => {
    const ranked = rankFoods(
      FOODS.map((f) => f.food),
      'skyr',
    );
    expect(ranked.map((h) => h.food.name)).toEqual(['Skyr Natur', 'Skyr Drink Vanille 3er-Pack']);
    expect(rankFoods([food('x', 'Apfel')], 'Banane')).toEqual([]);
  });
});
