import type { Food } from '@kalo/schemas';

import { rowToFood, type CatalogRow } from './catalog';
import { foldUmlautDigraphs, normalize, similarity, trigrams } from './normalize';
import { buildSynonymIndex, type SynonymIndex } from './synonyms';

/** Minimal synchronous SQL interface, implemented by expo-sqlite in the app and better-sqlite3 in tests. */
export interface SqlRunner {
  all<T>(sql: string, params?: (string | number | null)[]): T[];
}

export interface SearchHit {
  food: Food;
  score: number;
}

export interface QueryWord {
  word: string;
  /** Normalised word plus spelling variants and synonyms. */
  alternatives: string[];
}

const defaultSynonyms = buildSynonymIndex();

/** Split a query into words with their alternatives (umlaut digraphs, synonyms). */
export function parseQuery(query: string, synonyms: SynonymIndex = defaultSynonyms): QueryWord[] {
  const words = normalize(query).split(' ').filter(Boolean);
  return words.map((word) => {
    const folded = foldUmlautDigraphs(word);
    const alts = new Set([
      word,
      folded,
      ...(synonyms.get(word) ?? []),
      ...(synonyms.get(folded) ?? []),
    ]);
    return { word, alternatives: [...alts] };
  });
}

/** FTS5 string literal. Normalised text contains only [a-z0-9 ], so quoting is enough. */
const lit = (s: string) => `"${s}"`;

/**
 * Strict query: every word must occur (as substring) in one of its alternatives.
 * Words shorter than 3 characters cannot be matched by the trigram index and are checked in JS.
 */
export function strictMatch(words: QueryWord[]): string | undefined {
  const groups = words
    .map((w) => w.alternatives.filter((a) => a.length >= 3))
    .filter((alts) => alts.length > 0)
    .map((alts) => `(${alts.map(lit).join(' OR ')})`);
  return groups.length ? groups.join(' AND ') : undefined;
}

/** Fuzzy query: any trigram of any word. Candidates are re-ranked by similarity in JS. */
export function fuzzyMatch(words: QueryWord[]): string | undefined {
  const grams = new Set<string>();
  for (const w of words) for (const g of trigrams(w.word)) if (!g.includes(' ')) grams.add(g);
  return grams.size ? [...grams].map(lit).join(' OR ') : undefined;
}

const MIN_FUZZY_SCORE = 0.5;

/** How well one query word matches a list of target words (0–1). */
function wordMatch(q: QueryWord, targets: string[]): number {
  let best = 0;
  for (const alt of q.alternatives) {
    const isOriginal = alt === q.word || alt === foldUmlautDigraphs(q.word);
    const weight = isOriginal ? 1 : 0.95;
    // Multi-word synonyms ("chicken breast") match against the joined text.
    if (alt.includes(' ') && targets.join(' ').includes(alt)) best = Math.max(best, weight);
    for (const t of targets) {
      let s: number;
      if (t === alt) s = 1;
      else if (t.startsWith(alt)) s = 0.95;
      else if (alt.length >= 3 && t.includes(alt)) s = 0.85;
      else s = similarity(alt, t) * 0.9;
      best = Math.max(best, s * weight);
      if (best === 1) return 1;
    }
  }
  return best;
}

/**
 * Relevance score for a food. Name matches dominate; short (generic) names, verified data and
 * popular products get small boosts so "Skyr" ranks above "Skyr Drink Vanille 3er-Pack".
 */
export function scoreFood(
  words: QueryWord[],
  f: {
    name: string;
    name_alt?: string | null;
    brand?: string | null;
    verified?: number | boolean;
    popularity?: number;
  },
): number {
  const nameWords = normalize([f.name, f.name_alt].filter(Boolean).join(' '))
    .split(' ')
    .filter(Boolean);
  const brandWords = f.brand ? normalize(f.brand).split(' ').filter(Boolean) : [];
  if (words.length === 0 || nameWords.length === 0) return 0;

  const matches = words.map((w) =>
    Math.max(wordMatch(w, nameWords), wordMatch(w, brandWords) * 0.8),
  );
  const base = matches.reduce((s, m) => s + m, 0) / matches.length;
  if (Math.min(...matches) < 0.35) return base * 0.5; // a query word that matches nothing is a strong negative

  const nameNorm = normalize(f.name);
  const queryNorm = words.map((w) => w.word).join(' ');
  const firstWord = nameWords[0] ?? '';
  let bonus = 0;
  if (nameNorm === queryNorm) bonus += 0.3;
  else if (nameNorm.startsWith(queryNorm) || words.some((w) => w.alternatives.includes(firstWord)))
    bonus += 0.15;
  bonus += Math.max(0, 0.12 - 0.02 * Math.max(0, nameWords.length - 2));
  if (f.verified === true || f.verified === 1) bonus += 0.05;
  bonus += Math.min(0.1, Math.log10((f.popularity ?? 0) + 1) / 40);
  return base + bonus;
}

const SELECT = `SELECT f.* FROM foods_fts JOIN foods f ON f.rowid = foods_fts.rowid WHERE foods_fts MATCH ? ORDER BY bm25(foods_fts) LIMIT ?`;

/**
 * Search the offline catalogue. Strict substring matching first; if that yields too little,
 * a trigram OR-query fetches fuzzy candidates (typos) that are re-ranked by similarity.
 */
export function searchCatalog(
  db: SqlRunner,
  query: string,
  opts: { limit?: number; synonyms?: SynonymIndex } = {},
): SearchHit[] {
  const limit = opts.limit ?? 30;
  const words = parseQuery(query, opts.synonyms);
  if (words.length === 0) return [];

  const byId = new Map<string, CatalogRow>();
  const strict = strictMatch(words);
  if (strict) for (const r of db.all<CatalogRow>(SELECT, [strict, 400])) byId.set(r.id, r);
  else {
    // Only short words (e.g. "ei"): word-start match via LIKE.
    const w = words[0]!.word;
    for (const r of db.all<CatalogRow>(
      `SELECT * FROM foods WHERE search_text LIKE ? OR search_text LIKE ? ORDER BY popularity DESC LIMIT 400`,
      [`${w} %`, `% ${w} %`],
    )) {
      byId.set(r.id, r);
    }
  }

  let fuzzy = false;
  if (byId.size < Math.min(limit, 10)) {
    const fq = fuzzyMatch(words);
    if (fq) {
      fuzzy = true;
      for (const r of db.all<CatalogRow>(SELECT, [fq, 400])) if (!byId.has(r.id)) byId.set(r.id, r);
    }
  }

  const hits: SearchHit[] = [];
  for (const r of byId.values()) {
    const score = scoreFood(words, r);
    if (fuzzy && score < MIN_FUZZY_SCORE) continue;
    if (!fuzzy && score < 0.3) continue;
    hits.push({ food: rowToFood(r), score });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Rank arbitrary foods (e.g. the user's own foods, online results) with the same scoring. */
export function rankFoods(
  foods: Food[],
  query: string,
  opts: { synonyms?: SynonymIndex; minScore?: number } = {},
): SearchHit[] {
  const words = parseQuery(query, opts.synonyms);
  return foods
    .map((food) => ({
      food,
      score: scoreFood(words, {
        name: food.name,
        name_alt: food.nameAlt ?? null,
        brand: food.brand ?? null,
        verified: food.verified,
      }),
    }))
    .filter((h) => h.score >= (opts.minScore ?? MIN_FUZZY_SCORE))
    .sort((a, b) => b.score - a.score);
}

export function findByBarcode(db: SqlRunner, barcode: string): Food | undefined {
  const row = db.all<CatalogRow>(`SELECT * FROM foods WHERE barcode = ? LIMIT 1`, [barcode])[0];
  return row ? rowToFood(row) : undefined;
}

export function getCatalogFood(db: SqlRunner, id: string): Food | undefined {
  const row = db.all<CatalogRow>(`SELECT * FROM foods WHERE id = ? LIMIT 1`, [id])[0];
  return row ? rowToFood(row) : undefined;
}
