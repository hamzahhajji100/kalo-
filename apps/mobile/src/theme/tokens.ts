/**
 * Design tokens – the single source of truth for colours.
 * Values are space-separated RGB triplets so they can feed both NativeWind CSS
 * variables (`rgb(var(--x) / alpha)`) and direct use in SVG/Skia via `rgb()`.
 */
export type ColorToken =
  | 'bg'
  | 'surface'
  | 'surface-2'
  | 'border'
  | 'text'
  | 'muted'
  | 'brand'
  | 'brand-soft'
  | 'on-brand'
  | 'protein'
  | 'carbs'
  | 'fat'
  | 'water'
  | 'warning'
  | 'danger';

export type Palette = Record<ColorToken, string>;

export const light: Palette = {
  bg: '247 247 245',
  surface: '255 255 255',
  'surface-2': '240 240 236',
  border: '228 228 222',
  text: '20 22 24',
  muted: '96 100 108',
  brand: '21 128 84',
  'brand-soft': '220 242 230',
  'on-brand': '255 255 255',
  // Macro hues validated with the dataviz palette checker (CVD, normal-vision floor, contrast) for both themes.
  protein: '201 79 134',
  carbs: '201 133 0',
  fat: '42 120 214',
  water: '20 140 190',
  warning: '180 110 0',
  danger: '200 40 40',
};

export const dark: Palette = {
  bg: '12 13 15',
  surface: '24 26 29',
  'surface-2': '34 37 41',
  border: '48 52 58',
  text: '240 241 243',
  muted: '160 165 174',
  brand: '62 196 132',
  'brand-soft': '22 56 40',
  'on-brand': '8 20 14',
  protein: '213 81 129',
  carbs: '201 133 0',
  fat: '57 135 229',
  water: '90 196 236',
  warning: '240 176 60',
  danger: '255 110 110',
};

/** `rgb()` string for places that cannot use Tailwind classes (SVG, Skia, navigation theme). */
export const rgb = (palette: Palette, token: ColorToken, alpha = 1): string =>
  alpha === 1
    ? `rgb(${palette[token].replaceAll(' ', ',')})`
    : `rgba(${palette[token].replaceAll(' ', ',')},${alpha})`;
