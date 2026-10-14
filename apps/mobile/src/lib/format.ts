import i18n from '@/i18n';

const locale = () => (i18n.language === 'en' ? 'en-GB' : 'de-DE');

export const formatInt = (v: number) =>
  new Intl.NumberFormat(locale(), { maximumFractionDigits: 0 }).format(Math.round(v) || 0);

export const formatDecimal = (v: number, digits = 1) =>
  new Intl.NumberFormat(locale(), {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(v);

export const formatDate = (d: Date, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale(), opts).format(d);
