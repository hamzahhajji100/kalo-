import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import de from '@/i18n/locales/de.json';

const SRC = path.resolve(__dirname, '../src');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(tsx?|ts)$/.test(f) ? [p] : [];
  });
}

const has = (key: string) =>
  key
    .split('.')
    .reduce<unknown>(
      (o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined),
      de,
    ) !== undefined;

describe('translation keys used in code', () => {
  it('exist in the German locale', () => {
    const missing = new Set<string>();
    for (const file of files(SRC)) {
      const src = readFileSync(file, 'utf8');
      // Literal keys only: t('a.b') / t("a.b"); template-literal keys are covered by the locale parity test.
      for (const m of src.matchAll(/\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]/g))
        if (!has(m[1]!)) missing.add(`${m[1]} (${path.relative(SRC, file)})`);
    }
    expect([...missing]).toEqual([]);
  });
});
