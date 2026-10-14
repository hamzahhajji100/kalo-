import { z } from 'zod';

/** External APIs send numbers as numbers, numeric strings, "" or null. Normalise to number | undefined. */
export const looseNumber = z.preprocess((v) => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
}, z.number().optional());

export const round = (v: number, digits = 2) => Math.round(v * 10 ** digits) / 10 ** digits;
