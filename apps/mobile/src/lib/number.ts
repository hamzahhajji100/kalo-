/** Parse user input that may use a decimal comma ("1,5"). Returns undefined for empty/invalid input. */
export function parseDecimal(input: string): number | undefined {
  const normalized = input.trim().replace(',', '.');
  if (normalized === '') return undefined;
  const v = Number(normalized);
  return Number.isFinite(v) ? v : undefined;
}
