/** Colours resolve to CSS variables set per theme in src/theme/ThemeProvider.tsx. */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        'surface-2': token('surface-2'),
        border: token('border'),
        text: token('text'),
        muted: token('muted'),
        brand: token('brand'),
        'brand-soft': token('brand-soft'),
        'on-brand': token('on-brand'),
        protein: token('protein'),
        carbs: token('carbs'),
        fat: token('fat'),
        water: token('water'),
        warning: token('warning'),
        danger: token('danger'),
      },
      borderRadius: { card: '20px', pill: '999px' },
      fontSize: { display: ['40px', { lineHeight: '44px', fontWeight: '700' }] },
    },
  },
  plugins: [],
};
