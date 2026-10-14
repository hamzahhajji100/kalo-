import { useTranslation } from 'react-i18next';
import { useCallback } from 'react';

import { fetchOffProduct } from '@/features/search/openFoodFacts';
import { findBarcodeLocal } from '@/features/search/searchService';
import { fetchUsdaByBarcode } from '@/features/search/usda';
import { lookupBarcode, type LookupResult } from './lookup';

/** Barcode lookup wired to the app's real sources. */
export function useBarcodeLookup() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'de';
  return useCallback(
    (code: string, type?: string, signal?: AbortSignal): Promise<LookupResult> =>
      lookupBarcode(
        code,
        {
          local: findBarcodeLocal,
          off: (c, s) => fetchOffProduct(c, lang, s),
          usda: fetchUsdaByBarcode,
        },
        { ...(type && { type }), ...(signal && { signal }) },
      ),
    [lang],
  );
}
