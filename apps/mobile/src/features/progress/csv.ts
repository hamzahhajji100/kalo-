import type { DiaryEntry } from '@/data/repositories/diary';
import type { Weight } from '@/data/repositories/body';

type Lang = 'de' | 'en';

/** CSV in the user's spreadsheet convention: German Excel expects ";" and decimal commas. */
export function toCsv(header: string[], rows: (string | number | null)[][], lang: Lang): string {
  const sep = lang === 'de' ? ';' : ',';
  const cell = (v: string | number | null) => {
    if (v === null) return '';
    const s =
      typeof v === 'number'
        ? lang === 'de'
          ? String(Math.round(v * 100) / 100).replace('.', ',')
          : String(Math.round(v * 100) / 100)
        : v;
    return s.includes(sep) || /["\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // BOM so Excel opens UTF-8 (umlauts) correctly.
  return `﻿${[header, ...rows].map((r) => r.map(cell).join(sep)).join('\r\n')}\r\n`;
}

export function diaryCsv(
  entries: DiaryEntry[],
  mealName: (id: number) => string,
  lang: Lang,
): string {
  const header =
    lang === 'de'
      ? [
          'Datum',
          'Mahlzeit',
          'Lebensmittel',
          'Marke',
          'Menge (g)',
          'kcal',
          'Protein (g)',
          'Kohlenhydrate (g)',
          'Zucker (g)',
          'Fett (g)',
          'ges. Fettsäuren (g)',
          'Ballaststoffe (g)',
          'Salz (g)',
          'Quelle',
        ]
      : [
          'Date',
          'Meal',
          'Food',
          'Brand',
          'Amount (g)',
          'kcal',
          'Protein (g)',
          'Carbs (g)',
          'Sugar (g)',
          'Fat (g)',
          'Saturated fat (g)',
          'Fibre (g)',
          'Salt (g)',
          'Source',
        ];
  return toCsv(
    header,
    entries.map((e) => [
      e.date,
      mealName(e.mealTypeId),
      e.name,
      e.brand,
      e.grams,
      e.kcal,
      e.protein,
      e.carbs,
      e.sugar,
      e.fat,
      e.saturatedFat,
      e.fiber,
      e.salt,
      e.source,
    ]),
    lang,
  );
}

export function weightsCsv(weights: Weight[], lang: Lang): string {
  return toCsv(
    lang === 'de' ? ['Datum', 'Gewicht (kg)'] : ['Date', 'Weight (kg)'],
    weights.map((w) => [w.date, w.kg]),
    lang,
  );
}
