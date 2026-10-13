/** Date helpers on ISO calendar dates (YYYY-MM-DD), computed in UTC to avoid DST drift. */

const MS_PER_DAY = 86_400_000;

export function parseIsoDate(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

export function toIsoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((parseIsoDate(toIso) - parseIsoDate(fromIso)) / MS_PER_DAY);
}

export function addDays(iso: string, days: number): string {
  return toIsoDate(parseIsoDate(iso) + days * MS_PER_DAY);
}

/** Age in full years on a given date. */
export function ageOn(birthIso: string, onIso: string): number {
  const [by, bm, bd] = birthIso.split('-').map(Number) as [number, number, number];
  const [y, m, d] = onIso.split('-').map(Number) as [number, number, number];
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}
