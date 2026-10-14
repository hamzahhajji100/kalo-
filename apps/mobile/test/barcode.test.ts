import type { Food } from '@kalo/schemas';
import { describe, expect, it, vi } from 'vitest';

import {
  barcodeCandidates,
  digitsOnly,
  hasValidCheckDigit,
  upcEToUpcA,
} from '@/features/barcode/gtin';
import { lookupBarcode } from '@/features/barcode/lookup';
import { HttpError } from '@/lib/http';

const food = (id: string): Food => ({
  id,
  source: 'off',
  sourceId: id,
  name: id,
  isLiquid: false,
  per100g: { kcal: 1, protein: 0, carbs: 0, fat: 0 },
  portions: [],
  allergens: [],
  verified: false,
});

describe('GTIN', () => {
  it('validates check digits', () => {
    expect(hasValidCheckDigit('3017620422003')).toBe(true); // Nutella EAN-13
    expect(hasValidCheckDigit('3017620422004')).toBe(false);
    expect(hasValidCheckDigit('96385074')).toBe(true); // EAN-8
    expect(hasValidCheckDigit('036000291452')).toBe(true); // UPC-A
    expect(hasValidCheckDigit('123')).toBe(false);
  });

  it('expands UPC-E', () => {
    expect(upcEToUpcA('01234505')).toBe('012000003455');
    expect(hasValidCheckDigit('042100005264')).toBe(true);
    expect(upcEToUpcA('04252614')).toBe('042100005264');
    expect(upcEToUpcA('01234531')).toBe('012300000451');
    expect(upcEToUpcA('01234541')).toBe('012340000051');
    expect(upcEToUpcA('21234505')).toBeUndefined();
  });

  it('generates lookup candidates', () => {
    expect(digitsOnly(' 30-176 ')).toBe('30176');
    expect(barcodeCandidates('0036000291452')).toEqual(['0036000291452', '036000291452']);
    expect(barcodeCandidates('036000291452')).toEqual(['036000291452', '0036000291452']);
    expect(barcodeCandidates('01234505', 'upc_e')).toEqual([
      '01234505',
      '012000003455',
      '0012000003455',
    ]);
    expect(barcodeCandidates('01234505')).toEqual(['01234505', '012000003455', '0012000003455']);
    expect(barcodeCandidates('96385074', 'ean8')).toEqual(['96385074']);
    expect(barcodeCandidates('')).toEqual([]);
  });
});

describe('lookupBarcode', () => {
  it('prefers the device, then OFF, then USDA', async () => {
    const off = vi.fn().mockResolvedValue(undefined);
    const usda = vi.fn().mockResolvedValue(food('usda'));
    expect(
      await lookupBarcode('3017620422003', { local: () => food('local'), off, usda }),
    ).toMatchObject({ status: 'found', source: 'device' });
    expect(off).not.toHaveBeenCalled();
    expect(
      await lookupBarcode('3017620422003', {
        local: () => undefined,
        off: vi.fn().mockResolvedValue(food('off')),
        usda,
      }),
    ).toMatchObject({ status: 'found', source: 'off', food: { id: 'off' } });
    expect(
      await lookupBarcode('3017620422003', { local: () => undefined, off, usda }),
    ).toMatchObject({ status: 'found', source: 'usda' });
  });

  it('tries UPC/EAN variants', async () => {
    const off = vi.fn(async (code: string) => (code === '036000291452' ? food('upc') : undefined));
    expect(await lookupBarcode('0036000291452', { local: () => undefined, off })).toMatchObject({
      status: 'found',
      code: '036000291452',
    });
  });

  it('reports not found vs. offline', async () => {
    const none = vi.fn().mockResolvedValue(undefined);
    expect(await lookupBarcode('4000000000001', { local: () => undefined, off: none })).toEqual({
      status: 'not_found',
      code: '4000000000001',
    });
    const offline = vi.fn().mockRejectedValue(new HttpError('offline', 'x'));
    expect(await lookupBarcode('4000000000001', { local: () => undefined, off: offline })).toEqual({
      status: 'offline',
      code: '4000000000001',
    });
    // OFF down, USDA answers "unknown": that is a definite not-found.
    expect(
      await lookupBarcode('4000000000001', { local: () => undefined, off: offline, usda: none }),
    ).toEqual({ status: 'not_found', code: '4000000000001' });
    // OFF down, USDA has it.
    expect(
      await lookupBarcode('4000000000001', {
        local: () => undefined,
        off: offline,
        usda: vi.fn().mockResolvedValue(food('u')),
      }),
    ).toMatchObject({ status: 'found', source: 'usda' });
  });

  it('rethrows unexpected errors and aborts', async () => {
    await expect(
      lookupBarcode('1', {
        local: () => undefined,
        off: vi.fn().mockRejectedValue(new Error('bug')),
      }),
    ).rejects.toThrow('bug');
    const controller = new AbortController();
    controller.abort();
    await expect(
      lookupBarcode(
        '1',
        { local: () => undefined, off: vi.fn().mockRejectedValue(new HttpError('offline', 'x')) },
        { signal: controller.signal },
      ),
    ).rejects.toThrow();
  });
});
