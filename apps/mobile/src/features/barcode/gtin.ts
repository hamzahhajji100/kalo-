/** GTIN helpers for EAN-13, EAN-8, UPC-A and UPC-E codes. */

export const digitsOnly = (raw: string) => raw.replace(/\D/g, '');

/** Validate the GS1 check digit (works for GTIN-8/12/13/14). */
export function hasValidCheckDigit(code: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  const digits = code.split('').map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** Expand an 8-digit UPC-E code to its 12-digit UPC-A form. */
export function upcEToUpcA(upcE: string): string | undefined {
  if (!/^[01]\d{7}$/.test(upcE)) return undefined;
  const [ns, d1, d2, d3, d4, d5, d6, check] = upcE.split('') as string[];
  let body: string;
  switch (d6) {
    case '0':
    case '1':
    case '2':
      body = `${d1}${d2}${d6}0000${d3}${d4}${d5}`;
      break;
    case '3':
      body = `${d1}${d2}${d3}00000${d4}${d5}`;
      break;
    case '4':
      body = `${d1}${d2}${d3}${d4}00000${d5}`;
      break;
    default:
      body = `${d1}${d2}${d3}${d4}${d5}0000${d6}`;
  }
  return `${ns}${body}${check}`;
}

/**
 * Codes to try for one scan, most specific first. Scanners report UPC-A either as 12 digits or as
 * EAN-13 with a leading 0, and databases store either form.
 */
export function barcodeCandidates(raw: string, type?: string): string[] {
  const code = digitsOnly(raw);
  const out = new Set<string>();
  if (!code) return [];
  out.add(code);
  if (
    type?.toLowerCase().includes('upc_e') ||
    (code.length === 8 && type === undefined && /^[01]/.test(code))
  ) {
    const a = upcEToUpcA(code);
    if (a) {
      out.add(a);
      out.add(`0${a}`);
    }
  }
  if (code.length === 13 && code.startsWith('0')) out.add(code.slice(1));
  if (code.length === 12) out.add(`0${code}`);
  return [...out];
}
