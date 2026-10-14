/**
 * Search normalisation shared by the index builder and the query side:
 * lowercase, ß → ss, diacritics removed (ä → a, é → e), punctuation → space.
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * German spellings without umlaut letters ("haehnchen", "kaese") are mapped to the
 * normalised form ("hahnchen", "kase"). Applied to queries only.
 */
export function foldUmlautDigraphs(word: string): string {
  return word.replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u');
}

/** Character trigrams of a word, padded so short words and word starts carry weight. */
export function trigrams(word: string): string[] {
  const padded = ` ${word} `;
  const out = new Set<string>();
  for (let i = 0; i + 3 <= padded.length; i++) out.add(padded.slice(i, i + 3));
  return [...out];
}

/** Dice similarity of the trigram sets of two words (0–1). */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const ta = trigrams(a);
  const tb = new Set(trigrams(b));
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return (2 * shared) / (ta.length + tb.size);
}
