import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import de from './locales/de.json';
import en from './locales/en.json';

export const SUPPORTED_LANGUAGES = ['de', 'en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

/** German is the default; English is used when the device prefers it. */
export function resolveLanguage(preference: 'system' | Language): Language {
  if (preference !== 'system') return preference;
  const device = getLocales()[0]?.languageCode;
  return device === 'en' ? 'en' : 'de';
}

const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources: { de: { translation: de }, en: { translation: en } },
  lng: resolveLanguage('system'),
  fallbackLng: 'de',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
