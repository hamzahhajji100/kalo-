/** "Nice" axis range and ticks (1, 2, 2.5, 5 × 10ⁿ steps) covering [min, max]. */
export function niceScale(
  min: number,
  max: number,
  maxTicks = 4,
): { min: number; max: number; ticks: number[] } {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1, ticks: [0, 1] };
  if (min === max) {
    const pad = Math.abs(min) * 0.05 || 1;
    min -= pad;
    max += pad;
  }
  const raw = (max - min) / Math.max(1, maxTicks);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { min: lo, max: hi, ticks };
}

export const linear = (domain: [number, number], range: [number, number]) => (v: number) =>
  domain[1] === domain[0]
    ? (range[0] + range[1]) / 2
    : range[0] + ((v - domain[0]) / (domain[1] - domain[0])) * (range[1] - range[0]);

/** Index of the closest of `count` evenly spaced points for a touch at x within width. */
export function nearestIndex(x: number, count: number, width: number): number {
  if (count <= 1) return 0;
  return Math.max(0, Math.min(count - 1, Math.round((x / width) * (count - 1))));
}
