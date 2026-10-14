import { describe, expect, it } from 'vitest';

import de from '@/i18n/locales/de.json';
import en from '@/i18n/locales/en.json';

const flatten = (o: object, prefix = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );

describe('locales', () => {
  it('German and English have the same keys', () => {
    expect(flatten(en).sort()).toEqual(flatten(de).sort());
  });

  it('use the same interpolation variables', () => {
    const vars = (s: string) => [...s.matchAll(/{{(\w+)}}/g)].map((m) => m[1]).sort();
    const get = (o: object, path: string) =>
      path.split('.').reduce<unknown>((x, k) => (x as Record<string, unknown>)[k], o) as string;
    for (const key of flatten(de)) expect(vars(get(en, key)), key).toEqual(vars(get(de, key)));
  });
});
